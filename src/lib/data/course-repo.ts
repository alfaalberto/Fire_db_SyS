import { COLLECTIONS } from '../firebase-config';
import { firestoreChunkDocumentId, parseFirestoreChunkManifest } from '../firestore-chunking';
import { parseIndexBackup, parseOutline, splitIndex } from '../outline';
import type { OutlineItem } from '../types';
import { listDocuments, mapLimit, readDocument, type DocumentData } from './rest';

/**
 * Formatos de almacenamiento:
 *
 *  - `v2`: `meta/outline` guarda solo el temario (unos kB) y cada tema guarda
 *    su HTML en `slides/{id}`. Al abrir la app se baja el temario; el contenido
 *    de un tema se baja cuando se abre.
 *  - `legacy`: `meta/fullIndex` guarda TODO el curso (≈12 MB repartidos en
 *    trozos). Es lo que escribía la versión anterior. Se sigue leyendo hasta
 *    que un docente migre desde el panel de mantenimiento.
 *  - `empty`: base de datos nueva, sin temario.
 */
export type CourseFormat = 'v2' | 'legacy' | 'empty';

export interface CourseSnapshot {
  format: CourseFormat;
  outline: OutlineItem[];
  /** Marca del servidor; sirve para detectar cambios hechos en otro dispositivo. */
  updatedAt: number | null;
  /**
   * Identifica la versión exacta descargada. En `legacy` es el manifiesto de
   * trozos: si no cambia, no hace falta volver a bajar los 12 MB.
   */
  stamp: string;
}

export interface LegacyBundle {
  snapshot: CourseSnapshot;
  content: Map<string, string[]>;
}

const OUTLINE_PATH = `${COLLECTIONS.meta}/${COLLECTIONS.outlineDoc}`;
const LEGACY_PATH = `${COLLECTIONS.meta}/${COLLECTIONS.legacyIndexDoc}`;

export function snapshotFromOutlineDoc(doc: DocumentData): CourseSnapshot {
  if (typeof doc.data !== 'string') throw new Error('El temario guardado no tiene el formato esperado.');
  const updatedAt = typeof doc.updatedAt === 'number' ? doc.updatedAt : null;
  return {
    format: 'v2',
    outline: parseOutline(JSON.parse(doc.data)),
    updatedAt,
    stamp: `v2:${updatedAt ?? 0}`,
  };
}

async function readChunks(
  collectionPath: string,
  manifestValue: unknown,
  signal?: AbortSignal,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  const manifest = parseFirestoreChunkManifest(manifestValue);
  let done = 0;
  const pick = (data: DocumentData | null, index: number): string => {
    if (!data || typeof data.data !== 'string') {
      throw new Error(`Falta el trozo ${index + 1} de ${manifest.count}.`);
    }
    done += 1;
    onProgress?.(done, manifest.count);
    return data.data;
  };

  if (manifest.format === 'versioned') {
    const indexes = Array.from({ length: manifest.count }, (_, i) => i);
    // En paralelo: la versión anterior leía los trozos uno tras otro.
    const parts = await mapLimit(indexes, 5, async (i) =>
      pick(await readDocument(`${collectionPath}/${firestoreChunkDocumentId(manifest.revision, i)}`, signal), i),
    );
    return parts.join('');
  }

  // Formato previo a las revisiones: los primeros `count` documentos por índice.
  const listed = await listDocuments(collectionPath, { orderBy: 'index', limit: manifest.count, signal });
  if (listed.length !== manifest.count) {
    throw new Error(`Faltan trozos: se esperaban ${manifest.count} y hay ${listed.length}.`);
  }
  return listed.map((doc, i) => pick(doc.data, i)).join('');
}

/** Sello del documento heredado sin descargar su contenido. */
function legacyStamp(doc: DocumentData): string {
  if (doc.chunked) return `legacy:${String(doc.chunkCount)}`;
  return `legacy:inline:${typeof doc.updatedAt === 'number' ? doc.updatedAt : 0}`;
}

export interface CourseProbe {
  format: CourseFormat;
  stamp: string;
  /** Presente cuando el formato es `v2`: no hace falta nada más. */
  snapshot?: CourseSnapshot;
  /** Documento heredado, para completar la descarga si el sello cambió. */
  legacyDoc?: DocumentData;
}

/**
 * Consulta barata (uno o dos documentos pequeños) que dice qué formato usa el
 * servidor y si lo que hay en caché sigue vigente.
 */
export async function probeCourse(signal?: AbortSignal): Promise<CourseProbe> {
  const outlineDoc = await readDocument(OUTLINE_PATH, signal);
  if (outlineDoc) {
    const snapshot = snapshotFromOutlineDoc(outlineDoc);
    return { format: 'v2', stamp: snapshot.stamp, snapshot };
  }
  const legacyDoc = await readDocument(LEGACY_PATH, signal);
  if (!legacyDoc) return { format: 'empty', stamp: 'empty' };
  return { format: 'legacy', stamp: legacyStamp(legacyDoc), legacyDoc };
}

/** Descarga el curso completo en formato heredado y lo separa por tema. */
export async function loadLegacyBundle(
  legacyDoc: DocumentData,
  signal?: AbortSignal,
  onProgress?: (done: number, total: number) => void,
): Promise<LegacyBundle> {
  const serialized = legacyDoc.chunked
    ? await readChunks(`${LEGACY_PATH}/${COLLECTIONS.legacyIndexChunks}`, legacyDoc.chunkCount, signal, onProgress)
    : typeof legacyDoc.data === 'string'
      ? legacyDoc.data
      : '[]';
  const index = parseIndexBackup(JSON.parse(serialized));
  const updatedAt = typeof legacyDoc.updatedAt === 'number' ? legacyDoc.updatedAt : null;
  const { outline, content } = splitIndex(index, updatedAt ?? 1);
  return {
    snapshot: { format: 'legacy', outline, updatedAt, stamp: legacyStamp(legacyDoc) },
    content,
  };
}

/** HTML de las presentaciones de un tema (`slides/{id}`), o `null` si no existe. */
export async function fetchTopicContent(id: string, signal?: AbortSignal): Promise<string[] | null> {
  const path = `${COLLECTIONS.slides}/${id}`;
  const doc = await readDocument(path, signal);
  if (!doc) return null;
  if (doc.contentChunked) {
    const serialized = await readChunks(`${path}/${COLLECTIONS.slideChunks}`, doc.contentChunkCount, signal);
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : null;
  }
  return Array.isArray(doc.content) ? doc.content.filter((c): c is string => typeof c === 'string') : null;
}
