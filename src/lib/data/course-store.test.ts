import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IndexItem } from '../types';
import { splitIndex } from '../outline';
import { findItemById } from '../tree';
import { cacheClear } from './cache';
import { CourseStore, effectiveOutline, topicContent } from './course-store';
import { FakeRest } from './fake-rest';

const deck = (title: string) => `<!DOCTYPE html><html><head><title>${title}</title></head><body>${title}</body></html>`;

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

function seedV2(rest: FakeRest, rev = 100): void {
  const { outline, content } = splitIndex(index, rev);
  rest.set('meta/outline', { v: 2, data: JSON.stringify(outline), updatedAt: rev });
  for (const [id, decks] of content) rest.set(`slides/${id}`, { id, content: decks, contentChunked: false });
}

function seedLegacy(rest: FakeRest, revision = 'rev-aaaaaaaa', updatedAt = 100): void {
  const serialized = JSON.stringify(index);
  const parts = [serialized.slice(0, 120), serialized.slice(120, 300), serialized.slice(300)];
  parts.forEach((data, i) => rest.set(`meta/fullIndex/indexChunks/${revision}-${i}`, { index: 1_000_000 + i, data }));
  rest.set('meta/fullIndex', { data: null, chunked: true, chunkCount: `v2:${revision}:${parts.length}`, updatedAt });
}

let rest: FakeRest;

beforeEach(async () => {
  rest = new FakeRest();
  vi.stubGlobal('fetch', rest.fetch);
  await cacheClear('kv');
  await cacheClear('content');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formato nuevo', () => {
  it('al arrancar solo descarga el temario', async () => {
    seedV2(rest);
    const store = new CourseStore(null);
    await store.start();
    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.format).toBe('v2');
    expect(findItemById(state.outline, 'b')?.decks).toHaveLength(2);
    expect(rest.requests).toEqual(['meta/outline']);
  });

  it('descarga el contenido de un tema una sola vez', async () => {
    seedV2(rest);
    const store = new CourseStore(null);
    await store.start();
    await Promise.all([store.ensureTopic('b'), store.ensureTopic('b')]);
    await store.ensureTopic('b');
    expect(topicContent(store.getState(), 'b')).toMatchObject({ status: 'ready', decks: [deck('B1'), deck('B2')] });
    expect(rest.count(/^slides\/b$/)).toBe(1);

    // Otra visita (nuevo almacén, misma caché local): no vuelve a pedirlo.
    const again = new CourseStore(null);
    await again.start();
    await again.ensureTopic('b');
    expect(rest.count(/^slides\/b$/)).toBe(1);
  });

  it('vuelve a descargar un tema cuando cambia su revisión', async () => {
    seedV2(rest);
    const store = new CourseStore(null);
    await store.start();
    await store.ensureTopic('a');

    const { outline } = splitIndex(index, 100);
    outline[0].children![0].rev = 200;
    rest.set('meta/outline', { v: 2, data: JSON.stringify(outline), updatedAt: 200 });
    rest.set('slides/a', { id: 'a', content: [deck('A nueva')], contentChunked: false });

    await store.refresh();
    expect(topicContent(store.getState(), 'a')).toBeUndefined();
    await store.ensureTopic('a');
    expect(topicContent(store.getState(), 'a')).toMatchObject({ status: 'ready', decks: [deck('A nueva')] });
    // El tema que no cambió sigue saliendo de la caché.
    await store.ensureTopic('b');
    await store.ensureTopic('b');
    expect(rest.count(/^slides\/b$/)).toBe(1);
  });

  it('informa cuando el contenido de un tema no existe', async () => {
    seedV2(rest);
    rest.docs.delete('slides/a');
    const store = new CourseStore(null);
    await store.start();
    await store.ensureTopic('a');
    expect(topicContent(store.getState(), 'a')).toMatchObject({ status: 'error' });
  });

  it('sin conexión conserva lo que ya tenía', async () => {
    seedV2(rest);
    const first = new CourseStore(null);
    await first.start();
    await first.ensureTopic('a');

    rest.offline = true;
    const store = new CourseStore(null);
    await store.start();
    expect(store.getState()).toMatchObject({ status: 'ready', offline: true });
    await store.ensureTopic('a');
    expect(topicContent(store.getState(), 'a')).toMatchObject({ status: 'ready' });
  }, 15_000);

  it('sin conexión y sin caché queda en error', async () => {
    rest.offline = true;
    const store = new CourseStore(null);
    await store.start();
    expect(store.getState().status).toBe('error');
  }, 15_000);
});

describe('formato anterior', () => {
  it('baja el paquete, lo reparte por tema y no lo repite si el sello no cambió', async () => {
    seedLegacy(rest);
    const store = new CourseStore(null);
    await store.start();
    expect(store.getState().format).toBe('legacy');
    await store.ensureTopic('b');
    expect(topicContent(store.getState(), 'b')).toMatchObject({ status: 'ready', decks: [deck('B1'), deck('B2')] });
    expect(rest.count(/indexChunks/)).toBe(3);

    const again = new CourseStore(null);
    await again.start();
    await again.ensureTopic('a');
    expect(topicContent(again.getState(), 'a')).toMatchObject({ status: 'ready', decks: [deck('A')] });
    expect(rest.count(/indexChunks/)).toBe(3);
    // No se usan los documentos slides/{id}: en este formato pueden estar atrasados.
    expect(rest.count(/^slides\//)).toBe(0);
  });

  it('una base vacía muestra el temario del libro', async () => {
    const store = new CourseStore(null);
    await store.start();
    expect(store.getState()).toMatchObject({ status: 'ready', format: 'empty' });
    expect(store.getState().outline.length).toBe(11);
  });
});

describe('borrador', () => {
  it('los cambios viven en el borrador y no tocan lo publicado', async () => {
    seedV2(rest);
    const store = new CourseStore(null);
    await store.start();
    await store.ensureTopic('a');

    store.setTopicDecks('a', [deck('A'), deck('Extra')]);
    store.setTopicDecks('c', [deck('Primera de C')]);
    const state = store.getState();
    expect(findItemById(state.outline, 'a')?.decks).toHaveLength(1);
    expect(findItemById(effectiveOutline(state), 'a')?.decks?.map((d) => d.title)).toEqual(['A', 'Extra']);
    expect(findItemById(effectiveOutline(state), 'c')?.decks?.map((d) => d.title)).toEqual(['Primera de C']);
    expect(topicContent(state, 'a')).toMatchObject({ status: 'ready', decks: [deck('A'), deck('Extra')] });

    await store.discardDraft();
    expect(store.getState().draft).toBeNull();
    expect(topicContent(store.getState(), 'a')).toMatchObject({ decks: [deck('A')] });
  });

  it('dejar un tema sin presentaciones lo marca como vacío', async () => {
    seedV2(rest);
    const store = new CourseStore(null);
    await store.start();
    store.setTopicDecks('a', []);
    const item = findItemById(effectiveOutline(store.getState()), 'a');
    expect(item?.decks).toBeUndefined();
    expect(store.getState().draft?.content.a).toEqual([]);
  });

  it('eliminar un capítulo quita también el contenido de sus temas del borrador', async () => {
    seedV2(rest);
    const store = new CourseStore(null);
    await store.start();
    store.setTopicDecks('a', [deck('Cambiada')]);
    store.deleteTopic('cap1');
    expect(effectiveOutline(store.getState())).toEqual([]);
    expect(store.getState().draft?.content).toEqual({});
  });

  it('el borrador se recupera en otra sesión', async () => {
    seedV2(rest);
    const store = new CourseStore(null);
    await store.start();
    store.setTopicDecks('c', [deck('C')]);
    store.flushDraft();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const again = new CourseStore(null);
    await again.start();
    expect(again.getState().draft).toBeNull();
    expect(await again.loadDraft()).toBe(true);
    expect(again.getState().draft?.content.c).toEqual([deck('C')]);
  });

  it('exporta un respaldo completo e importa uno como borrador', async () => {
    seedV2(rest);
    const store = new CourseStore(null);
    await store.start();
    expect(await store.exportIndex()).toEqual(index);

    const replacement: IndexItem[] = [{ id: 'z', title: '9 Laplace', content: [deck('Z')] }];
    store.importIndex(replacement);
    expect(effectiveOutline(store.getState()).map((item) => item.title)).toEqual(['9 Laplace']);
    expect(await store.exportIndex()).toEqual(replacement);
    // Lo publicado no cambia hasta publicar.
    expect(store.getState().outline[0].id).toBe('cap1');
  });
});
