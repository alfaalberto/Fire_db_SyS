import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTopicContent, probeCourse } from '../data/course-repo';
import type { Draft } from '../data/course-store';
import { FakeRest } from '../data/fake-rest';
import { parseOutline, splitIndex } from '../outline';
import { findItemById } from '../tree';
import type { IndexItem } from '../types';

// Estado compartido con el SDK simulado (vi.mock se evalúa antes que el resto).
const shared = vi.hoisted(() => ({ rest: null as unknown as { docs: Map<string, Record<string, unknown>> }, writes: [] as string[], fail: null as string | null }));

vi.mock('./firebase', () => {
  type Ref = { path: string };
  const guard = () => {
    if (shared.fail) throw Object.assign(new Error('denied'), { code: shared.fail });
  };
  const mod = {
    doc: (_db: unknown, ...segments: string[]): Ref => ({ path: segments.join('/') }),
    setDoc: async (ref: Ref, data: Record<string, unknown>) => {
      guard();
      shared.writes.push(`set ${ref.path}`);
      shared.rest.docs.set(ref.path, data);
    },
    deleteDoc: async (ref: Ref) => {
      guard();
      shared.writes.push(`del ${ref.path}`);
      shared.rest.docs.delete(ref.path);
    },
    writeBatch: () => {
      const paths: string[] = [];
      return {
        delete: (ref: Ref) => paths.push(ref.path),
        commit: async () => {
          guard();
          for (const path of paths) {
            shared.writes.push(`del ${path}`);
            shared.rest.docs.delete(path);
          }
        },
      };
    },
  };
  return { getAdminDb: async () => ({ db: {}, mod }) };
});

import { cleanLegacyStorage, legacyUsage, PublishConflictError, publishCourse } from './writer';

const deck = (title: string, filler = '') => `<!DOCTYPE html><html><head><title>${title}</title></head><body>${title}${filler}</body></html>`;

const index: IndexItem[] = [
  {
    id: 'cap1',
    title: '1 Señales',
    children: [
      { id: 'a', title: '1.1 Introducción', content: [deck('A')] },
      { id: 'b', title: '1.2 Señales continuas', content: [deck('B1'), deck('B2')] },
      { id: 'c', title: '1.3 Energía' },
    ],
  },
];

let rest: FakeRest;

function seedV2(rev = 100) {
  const { outline, content } = splitIndex(index, rev);
  rest.set('meta/outline', { v: 2, data: JSON.stringify(outline), updatedAt: rev });
  for (const [id, decks] of content) rest.set(`slides/${id}`, { id, content: decks, contentChunked: false });
  return { format: 'v2' as const, outline, stamp: `v2:${rev}` };
}

function storedOutline() {
  return parseOutline(JSON.parse(String(rest.docs.get('meta/outline')!.data)));
}

beforeEach(() => {
  rest = new FakeRest();
  shared.rest = rest;
  shared.writes = [];
  shared.fail = null;
  vi.stubGlobal('fetch', rest.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('publishCourse (formato nuevo)', () => {
  it('escribe solo los temas del borrador y renueva su revisión', async () => {
    const server = seedV2();
    const { outline } = splitIndex(
      [{ ...index[0], children: [index[0].children![0], { id: 'b', title: '1.2 Señales continuas', content: [deck('B1'), deck('B3')] }, index[0].children![2]] }],
      100,
    );
    const draft: Draft = { outline, content: { b: [deck('B1'), deck('B3')] }, baseStamp: server.stamp };

    const result = await publishCourse({ server, draft, readDecks: async (id) => draft.content[id] });

    expect(shared.writes.filter((w) => w.startsWith('set'))).toEqual(['set slides/b', 'set meta/outline']);
    expect([...result.written.keys()]).toEqual(['b']);
    expect(result.deleted).toEqual([]);
    const saved = storedOutline();
    expect(findItemById(saved, 'b')?.decks?.map((d) => d.title)).toEqual(['B1', 'B3']);
    expect(findItemById(saved, 'b')?.rev).toBeGreaterThan(100);
    expect(findItemById(saved, 'a')?.rev).toBe(100);
    expect(await fetchTopicContent('b')).toEqual([deck('B1'), deck('B3')]);
    expect((await probeCourse()).stamp).toBe(result.snapshot.stamp);
  });

  it('borra el contenido de los temas eliminados o vaciados', async () => {
    const server = seedV2();
    const draftOutline = [{ id: 'cap1', title: '1 Señales', children: [{ id: 'a', title: '1.1 Introducción' }] }];
    const draft: Draft = { outline: draftOutline, content: { a: [] }, baseStamp: server.stamp };

    const result = await publishCourse({ server, draft, readDecks: async () => [] });

    expect(result.deleted.sort()).toEqual(['a', 'b']);
    expect(rest.docs.has('slides/a')).toBe(false);
    expect(rest.docs.has('slides/b')).toBe(false);
    expect(storedOutline()).toEqual(draftOutline);
  });

  it('detecta que el servidor cambió y solo sobrescribe si se fuerza', async () => {
    const server = seedV2();
    const draft: Draft = { outline: server.outline, content: {}, baseStamp: server.stamp };
    rest.set('meta/outline', { ...rest.docs.get('meta/outline')!, updatedAt: 101 });

    await expect(publishCourse({ server, draft, readDecks: async () => [] })).rejects.toBeInstanceOf(PublishConflictError);
    expect(shared.writes).toEqual([]);

    await publishCourse({ server, draft, readDecks: async () => [], force: true });
    expect(shared.writes).toEqual(['set meta/outline']);
  });

  it('si la escritura falla no se publica el temario', async () => {
    const server = seedV2();
    const draft: Draft = { outline: server.outline, content: { a: [deck('A2')] }, baseStamp: server.stamp };
    shared.fail = 'permission-denied';
    await expect(publishCourse({ server, draft, readDecks: async (id) => draft.content[id] })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(JSON.parse(String(rest.docs.get('meta/outline')!.data))).toEqual(server.outline);
  });
});

describe('temas mayores a un documento de Firestore', () => {
  it('se trocean, se leen íntegros y al republicar no dejan trozos huérfanos', async () => {
    const server = seedV2();
    const big = [deck('Grande 1', 'ñ'.repeat(700_000)), deck('Grande 2', 'x'.repeat(900_000))];
    const draft: Draft = { outline: server.outline, content: { a: big }, baseStamp: server.stamp };

    const first = await publishCourse({ server, draft, readDecks: async () => big });
    const parent = rest.docs.get('slides/a')!;
    expect(parent.contentChunked).toBe(true);
    expect(parent.content).toBeNull();
    const firstChunks = [...rest.docs.keys()].filter((key) => key.startsWith('slides/a/contentChunks/'));
    expect(firstChunks.length).toBeGreaterThan(1);
    expect(await fetchTopicContent('a')).toEqual(big);

    // Segunda publicación con otro contenido grande: solo queda la revisión nueva.
    const bigger = [deck('Grande 3', 'y'.repeat(1_200_000))];
    const again: Draft = { outline: first.snapshot.outline, content: { a: bigger }, baseStamp: first.snapshot.stamp };
    const second = await publishCourse({ server: first.snapshot, draft: again, readDecks: async () => bigger });
    const secondChunks = [...rest.docs.keys()].filter((key) => key.startsWith('slides/a/contentChunks/'));
    expect(secondChunks.some((key) => firstChunks.includes(key))).toBe(false);
    expect(await fetchTopicContent('a')).toEqual(bigger);

    // Al volver a caber en un documento, los trozos desaparecen.
    const small = [deck('Pequeña')];
    const last: Draft = { outline: second.snapshot.outline, content: { a: small }, baseStamp: second.snapshot.stamp };
    await publishCourse({ server: second.snapshot, draft: last, readDecks: async () => small });
    expect([...rest.docs.keys()].filter((key) => key.startsWith('slides/a/contentChunks/'))).toEqual([]);
    expect(await fetchTopicContent('a')).toEqual(small);
  });
});

describe('migración desde el formato anterior', () => {
  function seedLegacy() {
    const serialized = JSON.stringify(index);
    const half = Math.ceil(serialized.length / 2);
    rest.set('meta/fullIndex/indexChunks/rev-aaaaaaaa-0', { index: 1_000_000, data: serialized.slice(0, half) });
    rest.set('meta/fullIndex/indexChunks/rev-aaaaaaaa-1', { index: 1_000_001, data: serialized.slice(half) });
    rest.set('meta/fullIndex', { data: null, chunked: true, chunkCount: 'v2:rev-aaaaaaaa:2', updatedAt: 50 });
    const { outline, content } = splitIndex(index, 50);
    return { server: { format: 'legacy' as const, outline, stamp: 'legacy:v2:rev-aaaaaaaa:2' }, content };
  }

  it('escribe solo los temas que difieren, retira los que sobran y no toca el formato anterior', async () => {
    const { server, content } = seedLegacy();
    rest.set('slides/a', { id: 'a', content: content.get('a'), contentChunked: false });
    rest.set('slides/b', { id: 'b', content: ['<p>atrasado</p>'], contentChunked: false });
    rest.set('slides/viejo', { id: 'viejo', content: ['<p>sobra</p>'], contentChunked: false });

    const result = await publishCourse({ server, draft: null, readDecks: async (id) => content.get(id) ?? [] });

    expect(shared.writes).toEqual(['set slides/b', 'del slides/viejo', 'set meta/outline']);
    expect(result.snapshot.format).toBe('v2');
    expect(await fetchTopicContent('b')).toEqual(content.get('b'));
    // Los temas sin cambios conservan la revisión con la que ya estaban en caché.
    expect(findItemById(result.snapshot.outline, 'a')?.rev).toBe(50);
    expect(rest.docs.has('meta/fullIndex')).toBe(true);
    expect((await probeCourse()).format).toBe('v2');
  });

  it('mide las copias sobrantes y las borra sin tocar la vigente', async () => {
    seedLegacy();
    for (let i = 0; i < 5; i++) rest.set(`meta/fullIndex/indexChunks/rev-zzzzzzzz-${i}`, { index: 1_000_000 + i, data: 'x' });
    rest.set('meta/fullIndex/indexChunks/3', { index: 3, data: 'x' });

    expect(await legacyUsage()).toMatchObject({ hasLegacyIndex: true, chunkDocs: 8, liveChunks: 2 });
    expect(await cleanLegacyStorage('stale')).toBe(6);
    expect([...rest.docs.keys()].filter((key) => key.includes('indexChunks')).sort()).toEqual([
      'meta/fullIndex/indexChunks/rev-aaaaaaaa-0',
      'meta/fullIndex/indexChunks/rev-aaaaaaaa-1',
    ]);

    expect(await cleanLegacyStorage('all')).toBe(2);
    expect([...rest.docs.keys()].filter((key) => key.startsWith('meta/fullIndex'))).toEqual([]);
    expect(await legacyUsage()).toMatchObject({ hasLegacyIndex: false, chunkDocs: 0 });
  });
});
