import type { Firestore } from 'firebase/firestore/lite';
import { COLLECTIONS } from '../firebase-config';
import {
  FIRESTORE_CHUNK_MAX_BYTES,
  FIRESTORE_VERSIONED_CHUNK_INDEX_OFFSET,
  createFirestoreChunkRevision,
  parseFirestoreChunkManifest,
  publishVersionedChunks,
  splitUtf8IntoChunks,
  utf8ByteLength,
} from '../firestore-chunking';
import { deckMetasFromContent, hasDecks, topicsWithDecks } from '../outline';
import type { OutlineItem } from '../types';
import { fetchTopicContent, probeCourse, type CourseFormat, type CourseSnapshot } from '../data/course-repo';
import type { Draft } from '../data/course-store';
import { listDocuments, mapLimit, readDocument } from '../data/rest';
import { getAdminDb } from './firebase';

type Lite = typeof import('firebase/firestore/lite');

const RETRYABLE = new Set(['aborted', 'deadline-exceeded', 'internal', 'resource-exhausted', 'unavailable']);

async function withBackoff(action: () => Promise<void>, attempts = 5): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await action();
      return;
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (!code || !RETRYABLE.has(code) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 600 * 2 ** attempt) + Math.random() * 250));
    }
  }
}

async function deletePaths(db: Firestore, mod: Lite, paths: string[], onProgress?: (done: number) => void): Promise<void> {
  const SIZE = 200;
  for (let start = 0; start < paths.length; start += SIZE) {
    const batch = mod.writeBatch(db);
    for (const path of paths.slice(start, start + SIZE)) batch.delete(mod.doc(db, path));
    await withBackoff(() => batch.commit());
    onProgress?.(Math.min(paths.length, start + SIZE));
  }
}

/**
 * Borra los trozos que ya no pertenecen a la revisión vigente. La versión
 * anterior nunca lo hacía, así que cada guardado dejaba una copia completa
 * del contenido ocupando espacio para siempre.
 */
async function pruneSlideChunks(db: Firestore, mod: Lite, id: string, keepRevision: string | null): Promise<void> {
  try {
    const collectionPath = `${COLLECTIONS.slides}/${id}/${COLLECTIONS.slideChunks}`;
    const listed = await listDocuments(collectionPath, { fields: ['index'] });
    const stale = listed
      .filter((doc) => keepRevision === null || !doc.id.startsWith(`${keepRevision}-`))
      .map((doc) => `${collectionPath}/${doc.id}`);
    if (stale.length > 0) await deletePaths(db, mod, stale);
  } catch {
    // La limpieza no es crítica: el contenido ya quedó publicado.
  }
}

async function writeTopic(db: Firestore, mod: Lite, id: string, decks: string[]): Promise<void> {
  const ref = mod.doc(db, COLLECTIONS.slides, id);
  const serialized = JSON.stringify(decks);

  if (utf8ByteLength(serialized) <= FIRESTORE_CHUNK_MAX_BYTES) {
    await withBackoff(() => mod.setDoc(ref, { id, content: decks, contentChunked: false }));
    await pruneSlideChunks(db, mod, id, null);
    return;
  }

  // Tema mayor a un documento de Firestore: se reparte en trozos con un id de
  // revisión propio y el manifiesto se publica solo cuando todos llegaron.
  const chunks = splitUtf8IntoChunks(serialized);
  const revision = createFirestoreChunkRevision();
  await publishVersionedChunks(
    chunks,
    revision,
    async (documentId, index, data) => {
      const chunkRef = mod.doc(db, COLLECTIONS.slides, id, COLLECTIONS.slideChunks, documentId);
      await withBackoff(() => mod.setDoc(chunkRef, { index: FIRESTORE_VERSIONED_CHUNK_INDEX_OFFSET + index, data }));
    },
    async (manifest) => {
      await withBackoff(() => mod.setDoc(ref, { id, content: null, contentChunked: true, contentChunkCount: manifest }));
    },
  );
  await pruneSlideChunks(db, mod, id, revision);
}

async function deleteTopic(db: Firestore, mod: Lite, id: string): Promise<void> {
  await pruneSlideChunks(db, mod, id, null);
  await withBackoff(() => mod.deleteDoc(mod.doc(db, COLLECTIONS.slides, id)));
}

function sameDecks(a: string[] | null, b: string[]): boolean {
  return !!a && a.length === b.length && a.every((html, i) => html === b[i]);
}

export class PublishConflictError extends Error {
  constructor() {
    super('El temario cambió en otro dispositivo desde que empezaste a editar.');
    this.name = 'PublishConflictError';
  }
}

export interface PublishProgress {
  phase: 'checking' | 'comparing' | 'writing' | 'deleting' | 'outline';
  done: number;
  total: number;
}

export interface PublishInput {
  server: { format: CourseFormat; outline: OutlineItem[]; stamp: string };
  draft: Draft | null;
  /** Presentaciones de un tema tal como deben quedar publicadas. */
  readDecks: (id: string) => Promise<string[]>;
  /** Publicar aunque el servidor haya cambiado mientras se editaba. */
  force?: boolean;
  onProgress?: (progress: PublishProgress) => void;
}

export interface PublishResult {
  snapshot: CourseSnapshot;
  written: Map<string, string[]>;
  deleted: string[];
}

/**
 * Publica los cambios. Si el servidor todavía usa el formato heredado, esta
 * misma operación lo migra: compara cada tema con su documento `slides/{id}`,
 * escribe los que difieren y crea `meta/outline`.
 */
export async function publishCourse(input: PublishInput): Promise<PublishResult> {
  const { server, draft, readDecks, onProgress } = input;
  const { db, mod } = await getAdminDb();
  const outline = draft?.outline ?? server.outline;
  const migrating = server.format !== 'v2';

  onProgress?.({ phase: 'checking', done: 0, total: 1 });
  const probe = await probeCourse();
  if (!input.force && probe.stamp !== (draft?.baseStamp ?? server.stamp)) throw new PublishConflictError();

  const wanted = topicsWithDecks(outline);
  const written = new Map<string, string[]>();

  if (migrating) {
    let done = 0;
    onProgress?.({ phase: 'comparing', done, total: wanted.length });
    await mapLimit(wanted, 4, async (id) => {
      const decks = await readDecks(id);
      const current = await fetchTopicContent(id).catch(() => null);
      if (!sameDecks(current, decks)) written.set(id, decks);
      done += 1;
      onProgress?.({ phase: 'comparing', done, total: wanted.length });
    });
  } else if (draft) {
    for (const id of Object.keys(draft.content)) {
      if (draft.content[id].length > 0 && wanted.includes(id)) written.set(id, draft.content[id]);
    }
  }

  // Temas que tenían contenido publicado y ya no deben tenerlo.
  const published = migrating
    ? (await listDocuments(COLLECTIONS.slides, { fields: ['id'] })).map((doc) => doc.id)
    : topicsWithDecks(server.outline);
  const keep = new Set(wanted);
  const deleted = published.filter((id) => !keep.has(id));

  let step = 0;
  for (const [id, decks] of written) {
    onProgress?.({ phase: 'writing', done: step, total: written.size });
    await writeTopic(db, mod, id, decks);
    step += 1;
  }
  onProgress?.({ phase: 'writing', done: written.size, total: written.size });

  step = 0;
  for (const id of deleted) {
    onProgress?.({ phase: 'deleting', done: step, total: deleted.length });
    await deleteTopic(db, mod, id);
    step += 1;
  }

  const now = Date.now();
  const finalize = (items: OutlineItem[]): OutlineItem[] =>
    items.map((item) => {
      const next: OutlineItem = { id: item.id, title: item.title };
      if (hasDecks(item)) {
        const fresh = written.get(item.id);
        next.decks = fresh ? deckMetasFromContent(fresh) : item.decks;
        next.rev = fresh ? now : (item.rev ?? now);
      }
      if (item.children && item.children.length > 0) next.children = finalize(item.children);
      return next;
    });
  const finalOutline = finalize(outline);

  onProgress?.({ phase: 'outline', done: 0, total: 1 });
  const outlineRef = mod.doc(db, COLLECTIONS.meta, COLLECTIONS.outlineDoc);
  await withBackoff(() => mod.setDoc(outlineRef, { v: 2, data: JSON.stringify(finalOutline), updatedAt: now }));
  onProgress?.({ phase: 'outline', done: 1, total: 1 });

  return {
    snapshot: { format: 'v2', outline: finalOutline, updatedAt: now, stamp: `v2:${now}` },
    written,
    deleted,
  };
}

export interface LegacyUsage {
  /** Existe `meta/fullIndex` (formato anterior). */
  hasLegacyIndex: boolean;
  /** Trozos guardados en `meta/fullIndex/indexChunks`. */
  chunkDocs: number;
  /** De ellos, los que pertenecen a la versión vigente. */
  liveChunks: number;
  /** Estimación del espacio ocupado por los trozos sobrantes. */
  staleBytesEstimate: number;
}

const LEGACY_DOC = `${COLLECTIONS.meta}/${COLLECTIONS.legacyIndexDoc}`;
const LEGACY_CHUNKS = `${LEGACY_DOC}/${COLLECTIONS.legacyIndexChunks}`;

async function legacyInventory(): Promise<{ hasLegacyIndex: boolean; all: string[]; live: Set<string> }> {
  const [legacyDoc, listed] = await Promise.all([readDocument(LEGACY_DOC), listDocuments(LEGACY_CHUNKS, { fields: ['index'] })]);
  const live = new Set<string>();
  if (legacyDoc?.chunked) {
    const manifest = parseFirestoreChunkManifest(legacyDoc.chunkCount);
    if (manifest.format === 'versioned') {
      for (const doc of listed) if (doc.id.startsWith(`${manifest.revision}-`)) live.add(doc.id);
    } else {
      // Formato sin revisiones: los vigentes son los primeros `count` por índice.
      const ordered = listed
        .filter((doc) => typeof doc.data.index === 'number')
        .sort((a, b) => (a.data.index as number) - (b.data.index as number));
      for (const doc of ordered.slice(0, manifest.count)) live.add(doc.id);
    }
  }
  return { hasLegacyIndex: !!legacyDoc, all: listed.map((doc) => doc.id), live };
}

export async function legacyUsage(): Promise<LegacyUsage> {
  const { hasLegacyIndex, all, live } = await legacyInventory();
  return {
    hasLegacyIndex,
    chunkDocs: all.length,
    liveChunks: live.size,
    staleBytesEstimate: (all.length - live.size) * FIRESTORE_CHUNK_MAX_BYTES,
  };
}

/**
 * Libera el espacio del formato anterior.
 *  - `stale`: borra solo las revisiones sobrantes; lo vigente no se toca.
 *  - `all`: borra también la versión vigente y `meta/fullIndex`. Solo tiene
 *    sentido después de migrar al formato nuevo.
 */
export async function cleanLegacyStorage(scope: 'stale' | 'all', onProgress?: (done: number, total: number) => void): Promise<number> {
  const { db, mod } = await getAdminDb();
  const { all, live } = await legacyInventory();
  const targets = (scope === 'all' ? all : all.filter((id) => !live.has(id))).map((id) => `${LEGACY_CHUNKS}/${id}`);
  await deletePaths(db, mod, targets, (done) => onProgress?.(done, targets.length));
  if (scope === 'all') await withBackoff(() => mod.deleteDoc(mod.doc(db, LEGACY_DOC)));
  return targets.length;
}
