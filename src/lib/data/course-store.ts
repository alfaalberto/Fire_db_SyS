import { DEFAULT_OUTLINE } from '../constants';
import { deckMetasFromContent, hasDecks, joinIndex, splitIndex, topicsWithDecks } from '../outline';
import { deleteItem, findItemById, flattenIndex, updateItem } from '../tree';
import type { IndexItem, OutlineItem } from '../types';
import { cacheDelete, cacheGet, cacheSet, cacheSetMany, deleteLegacyLocalData } from './cache';
import {
  fetchTopicContent,
  loadLegacyBundle,
  probeCourse,
  type CourseFormat,
  type CourseSnapshot,
} from './course-repo';
import { mapLimit } from './rest';

export type TopicContent =
  | { status: 'loading' }
  | { status: 'ready'; decks: string[]; rev: number }
  | { status: 'error'; message: string };

/** Cambios hechos en modo edición que todavía no se publican. */
export interface Draft {
  outline: OutlineItem[];
  /** Temas cuyo contenido cambió. Lista vacía = el tema quedó sin presentaciones. */
  content: Record<string, string[]>;
  /** Versión del servidor sobre la que se empezó a editar. */
  baseStamp: string;
}

export interface CourseState {
  status: 'loading' | 'ready' | 'error';
  format: CourseFormat;
  /** Temario publicado (lo que ve cualquier visitante). */
  outline: OutlineItem[];
  updatedAt: number | null;
  stamp: string;
  refreshing: boolean;
  /** La última consulta falló y se muestra la copia guardada en este equipo. */
  offline: boolean;
  error: string | null;
  /** Avance de la descarga completa del formato heredado. */
  bundleProgress: { done: number; total: number } | null;
  content: ReadonlyMap<string, TopicContent>;
  draft: Draft | null;
}

interface CachedTopic {
  rev: number;
  decks: string[];
}

const SNAPSHOT_KEY = 'snapshot';
const DRAFT_KEY = 'draft';
const STALE_AFTER_MS = 2 * 60 * 1000;

function describe(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Error desconocido.';
}

export function effectiveOutline(state: CourseState): OutlineItem[] {
  return state.draft ? state.draft.outline : state.outline;
}

/** Contenido de un tema tal como debe mostrarse (el borrador tiene prioridad). */
export function topicContent(state: CourseState, id: string): TopicContent | undefined {
  const drafted = state.draft?.content[id];
  if (drafted) return { status: 'ready', decks: drafted, rev: -1 };
  return state.content.get(id);
}

export class CourseStore {
  private state: CourseState;
  private listeners = new Set<() => void>();
  private refreshPromise: Promise<void> | null = null;
  private bundlePromise: Promise<void> | null = null;
  private lastRefreshAt = 0;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private inflight = new Map<string, Promise<void>>();

  constructor(initial?: CourseSnapshot | null) {
    this.state = {
      status: initial ? 'ready' : 'loading',
      format: initial?.format ?? 'empty',
      outline: initial?.outline ?? DEFAULT_OUTLINE,
      updatedAt: initial?.updatedAt ?? null,
      stamp: initial?.stamp ?? '',
      refreshing: false,
      offline: false,
      error: null,
      bundleProgress: null,
      content: new Map(),
      draft: null,
    };
  }

  getState = (): CourseState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<CourseState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private setContent(id: string, value: TopicContent | null): void {
    const content = new Map(this.state.content);
    if (value) content.set(id, value);
    else content.delete(id);
    this.set({ content });
  }

  /** Arranque en el navegador: caché local primero, después el servidor. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const cached = await cacheGet<CourseSnapshot>('kv', SNAPSHOT_KEY);
    if (cached && Array.isArray(cached.outline)) {
      const newer = (cached.updatedAt ?? 0) >= (this.state.updatedAt ?? 0);
      // Lo que vino con la página puede ser más viejo que la copia local
      // (la página se sirve desde caché); se queda la más reciente.
      if (this.state.status !== 'ready' || newer) this.applySnapshot(cached);
    }
    await this.refresh();
  }

  private applySnapshot(snapshot: CourseSnapshot): void {
    // Se descarta de memoria el contenido cuya revisión ya no coincide.
    const content = new Map(this.state.content);
    for (const [id, value] of content) {
      if (value.status !== 'ready') continue;
      const item = findItemById(snapshot.outline, id);
      if (!item || (item.rev ?? 0) !== value.rev) content.delete(id);
    }
    this.set({
      status: 'ready',
      format: snapshot.format,
      outline: snapshot.outline,
      updatedAt: snapshot.updatedAt,
      stamp: snapshot.stamp,
      error: null,
      content,
    });
  }

  refresh(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.set({ refreshing: true });
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
      this.lastRefreshAt = Date.now();
      this.set({ refreshing: false });
    });
    return this.refreshPromise;
  }

  /** Vuelve a consultar si pasó tiempo suficiente (al regresar a la pestaña). */
  refreshIfStale(): void {
    if (Date.now() - this.lastRefreshAt > STALE_AFTER_MS) void this.refresh();
  }

  private async doRefresh(): Promise<void> {
    try {
      const probe = await probeCourse();
      if (probe.format === 'v2' && probe.snapshot) {
        if (probe.stamp !== this.state.stamp || this.state.status !== 'ready') {
          this.applySnapshot(probe.snapshot);
        }
        await cacheSet('kv', SNAPSHOT_KEY, probe.snapshot);
        deleteLegacyLocalData();
      } else if (probe.format === 'legacy' && probe.legacyDoc) {
        const current = this.state.format === 'legacy' && this.state.stamp === probe.stamp && this.state.status === 'ready';
        if (!current) await this.downloadBundle(probe.legacyDoc);
      } else {
        this.applySnapshot({ format: 'empty', outline: DEFAULT_OUTLINE, updatedAt: null, stamp: 'empty' });
      }
      this.set({ offline: false, error: null });
    } catch (error) {
      if (this.state.status === 'ready') this.set({ offline: true });
      else this.set({ status: 'error', error: describe(error) });
    }
  }

  private async downloadBundle(legacyDoc: Record<string, unknown>): Promise<void> {
    if (!this.bundlePromise) {
      this.bundlePromise = (async () => {
        this.set({ bundleProgress: { done: 0, total: 1 } });
        try {
          const bundle = await loadLegacyBundle(legacyDoc, undefined, (done, total) => {
            this.set({ bundleProgress: { done, total } });
          });
          const rev = bundle.snapshot.updatedAt ?? 1;
          await cacheSetMany(
            'content',
            Array.from(bundle.content, ([id, decks]) => [id, { rev, decks } satisfies CachedTopic] as [string, unknown]),
          );
          await cacheSet('kv', SNAPSHOT_KEY, bundle.snapshot);
          this.applySnapshot(bundle.snapshot);
        } finally {
          this.set({ bundleProgress: null });
          this.bundlePromise = null;
        }
      })();
    }
    return this.bundlePromise;
  }

  /** Carga (si falta) el contenido del tema. Segura de llamar repetidamente. */
  ensureTopic(id: string): Promise<void> {
    const running = this.inflight.get(id);
    if (running) return running;

    const state = this.state;
    if (state.draft?.content[id]) return Promise.resolve();
    const item = findItemById(state.outline, id);
    if (!item || !hasDecks(item)) return Promise.resolve();
    const existing = state.content.get(id);
    if (existing?.status === 'ready' && existing.rev === (item.rev ?? 0)) return Promise.resolve();

    const task = this.loadTopic(id, item.rev ?? 0).finally(() => this.inflight.delete(id));
    this.inflight.set(id, task);
    return task;
  }

  private async loadTopic(id: string, rev: number): Promise<void> {
    this.setContent(id, { status: 'loading' });
    try {
      const cached = await cacheGet<CachedTopic>('content', id);
      let decks: string[] | null = cached && cached.rev === rev && Array.isArray(cached.decks) ? cached.decks : null;
      if (!decks && this.state.format === 'legacy') {
        // Falta la copia local: en el formato heredado solo se puede recuperar
        // bajando de nuevo el paquete completo.
        const probe = await probeCourse();
        if (probe.format === 'legacy' && probe.legacyDoc) {
          await this.downloadBundle(probe.legacyDoc);
          decks = (await cacheGet<CachedTopic>('content', id))?.decks ?? null;
        } else if (probe.format === 'v2' && probe.snapshot) {
          this.applySnapshot(probe.snapshot);
        }
      }
      if (!decks && this.state.format !== 'legacy') {
        decks = await fetchTopicContent(id);
        const latestRev = findItemById(this.state.outline, id)?.rev ?? rev;
        if (decks) await cacheSet('content', id, { rev: latestRev, decks } satisfies CachedTopic);
      }
      if (!decks) {
        this.setContent(id, { status: 'error', message: 'No se encontró el contenido de este tema en la base de datos.' });
        return;
      }
      // El temario pudo cambiar mientras se descargaba.
      const latest = findItemById(this.state.outline, id);
      this.setContent(id, { status: 'ready', decks, rev: latest?.rev ?? rev });
    } catch (error) {
      this.setContent(id, { status: 'error', message: describe(error) });
    }
  }

  /** Descarga en segundo plano el tema vecino para que abrirlo sea inmediato. */
  prefetch(id: string | null | undefined): void {
    if (!id) return;
    const idle =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? (cb: () => void) => window.requestIdleCallback(cb, { timeout: 2500 })
        : (cb: () => void) => setTimeout(cb, 600);
    idle(() => void this.ensureTopic(id));
  }

  /* ------------------------------ edición ------------------------------ */

  /** Recupera un borrador guardado en este equipo (solo para docentes). */
  async loadDraft(): Promise<boolean> {
    if (this.state.draft) return true;
    const draft = await cacheGet<Draft>('kv', DRAFT_KEY);
    if (!draft || !Array.isArray(draft.outline) || typeof draft.content !== 'object') return false;
    this.set({ draft });
    return true;
  }

  private commitDraft(draft: Draft): void {
    this.set({ draft });
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => {
      this.draftTimer = null;
      const current = this.state.draft;
      if (current) void cacheSet('kv', DRAFT_KEY, current);
    }, 500);
  }

  private currentDraft(): Draft {
    return this.state.draft ?? { outline: this.state.outline, content: {}, baseStamp: this.state.stamp };
  }

  editOutline(change: (outline: OutlineItem[]) => OutlineItem[]): void {
    const draft = this.currentDraft();
    const outline = change(draft.outline);
    if (outline === draft.outline) return;
    this.commitDraft({ ...draft, outline });
  }

  /** Sustituye las presentaciones de un tema. */
  setTopicDecks(id: string, decks: string[]): void {
    const draft = this.currentDraft();
    if (!findItemById(draft.outline, id)) return;
    const outline = updateItem(draft.outline, id, (item) => {
      const next: OutlineItem = { ...item };
      if (decks.length > 0) next.decks = deckMetasFromContent(decks);
      else {
        delete next.decks;
        delete next.rev;
      }
      return next;
    });
    this.commitDraft({ ...draft, outline, content: { ...draft.content, [id]: decks } });
  }

  deleteTopic(id: string): void {
    const draft = this.currentDraft();
    const target = findItemById(draft.outline, id);
    if (!target) return;
    const content = { ...draft.content };
    for (const item of flattenIndex([target])) delete content[item.id];
    this.commitDraft({ ...draft, outline: deleteItem(draft.outline, id), content });
  }

  /** Guarda de inmediato el borrador pendiente (al ocultar o cerrar la pestaña). */
  flushDraft(): void {
    if (!this.draftTimer) return;
    clearTimeout(this.draftTimer);
    this.draftTimer = null;
    if (this.state.draft) void cacheSet('kv', DRAFT_KEY, this.state.draft);
  }

  /** Deja de mostrar el borrador sin borrarlo (al cerrar la sesión de docente). */
  suspendDraft(): void {
    this.flushDraft();
    if (this.state.draft) this.set({ draft: null });
  }

  async discardDraft(): Promise<void> {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = null;
    this.set({ draft: null });
    await cacheDelete('kv', DRAFT_KEY);
  }

  /** Presentaciones de un tema, descargándolas si hace falta. */
  async readDecks(id: string): Promise<string[]> {
    const drafted = this.state.draft?.content[id];
    if (drafted) return drafted;
    const item = findItemById(this.state.outline, id);
    if (!item || !hasDecks(item)) return [];
    await this.ensureTopic(id);
    const value = this.state.content.get(id);
    if (value?.status === 'ready') return value.decks;
    throw new Error(value?.status === 'error' ? value.message : `No se pudo cargar "${item.title}".`);
  }

  /** Árbol completo con HTML, para "Exportar respaldo" y para publicar. */
  async exportIndex(onProgress?: (done: number, total: number) => void): Promise<IndexItem[]> {
    const outline = effectiveOutline(this.state);
    const ids = topicsWithDecks(outline);
    const content = new Map<string, string[]>();
    let done = 0;
    await mapLimit(ids, 4, async (id) => {
      content.set(id, await this.readDecks(id));
      done += 1;
      onProgress?.(done, ids.length);
    });
    return joinIndex(outline, content);
  }

  /** Carga un respaldo como borrador: nada cambia en el servidor hasta publicar. */
  importIndex(index: IndexItem[]): void {
    const { outline, content } = splitIndex(index, 0);
    const strip = (items: OutlineItem[]): OutlineItem[] =>
      items.map((item) => {
        const { rev: _rev, ...rest } = item;
        return rest.children ? { ...rest, children: strip(rest.children) } : rest;
      });
    this.commitDraft({ outline: strip(outline), content: Object.fromEntries(content), baseStamp: this.state.stamp });
  }

  /** Tras publicar: el borrador pasa a ser la versión del servidor. */
  async applyPublished(snapshot: CourseSnapshot, written: ReadonlyMap<string, string[]>, deleted: readonly string[]): Promise<void> {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = null;
    const content = new Map(this.state.content);
    const entries: Array<[string, unknown]> = [];
    for (const [id, decks] of written) {
      const rev = findItemById(snapshot.outline, id)?.rev ?? 0;
      content.set(id, { status: 'ready', decks, rev });
      entries.push([id, { rev, decks } satisfies CachedTopic]);
    }
    for (const id of deleted) content.delete(id);
    await cacheSetMany('content', entries);
    await Promise.all(deleted.map((id) => cacheDelete('content', id)));
    await cacheSet('kv', SNAPSHOT_KEY, snapshot);
    await cacheDelete('kv', DRAFT_KEY);
    this.set({
      status: 'ready',
      format: snapshot.format,
      outline: snapshot.outline,
      updatedAt: snapshot.updatedAt,
      stamp: snapshot.stamp,
      content,
      draft: null,
      offline: false,
      error: null,
    });
  }
}
