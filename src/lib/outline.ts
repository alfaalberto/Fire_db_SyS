import type { CoursePosition, DeckMeta, IndexItem, OutlineItem } from './types';
import { flattenIndex, splitNumberPrefix } from './tree';
import { extractTitle } from './slide-document';

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

export function utf8Bytes(text: string): number {
  return encoder ? encoder.encode(text).byteLength : text.length;
}

export function deckMetaFromHtml(html: string, fallbackTitle: string): DeckMeta {
  return { title: extractTitle(html) ?? fallbackTitle, bytes: utf8Bytes(html) };
}

export function deckMetasFromContent(content: string[]): DeckMeta[] {
  return content.map((html, i) => deckMetaFromHtml(html, `Presentación ${i + 1}`));
}

/** Separa un árbol de respaldo en temario ligero + mapa de contenidos. */
export function splitIndex(index: IndexItem[], rev: number): { outline: OutlineItem[]; content: Map<string, string[]> } {
  const content = new Map<string, string[]>();
  const walk = (items: IndexItem[]): OutlineItem[] =>
    items.map((item) => {
      const node: OutlineItem = { id: item.id, title: item.title };
      const html = Array.isArray(item.content) ? item.content.filter((c): c is string => typeof c === 'string') : [];
      if (html.length > 0) {
        content.set(item.id, html);
        node.decks = deckMetasFromContent(html);
        node.rev = rev;
      }
      if (item.children && item.children.length > 0) node.children = walk(item.children);
      return node;
    });
  return { outline: walk(index), content };
}

/** Recompone el árbol de respaldo a partir del temario y los contenidos. */
export function joinIndex(outline: OutlineItem[], content: ReadonlyMap<string, string[]>): IndexItem[] {
  return outline.map((item) => {
    const node: IndexItem = { id: item.id, title: item.title };
    const html = content.get(item.id);
    if (html && html.length > 0) node.content = html;
    if (item.children && item.children.length > 0) node.children = joinIndex(item.children, content);
    return node;
  });
}

export function hasDecks(item: OutlineItem): boolean {
  return !!item.decks && item.decks.length > 0;
}

/** Ids de todos los temas que tienen al menos una presentación. */
export function topicsWithDecks(outline: OutlineItem[]): string[] {
  return flattenIndex(outline).filter(hasDecks).map((item) => item.id);
}

export interface CourseStats {
  topics: number;
  topicsWithDecks: number;
  decks: number;
  bytes: number;
}

export function courseStats(outline: OutlineItem[]): CourseStats {
  const stats: CourseStats = { topics: 0, topicsWithDecks: 0, decks: 0, bytes: 0 };
  for (const item of flattenIndex(outline)) {
    if (item.children && item.children.length > 0 && !hasDecks(item)) continue;
    stats.topics += 1;
    if (hasDecks(item)) {
      stats.topicsWithDecks += 1;
      stats.decks += item.decks!.length;
      for (const deck of item.decks!) stats.bytes += deck.bytes;
    }
  }
  return stats;
}

/**
 * Secuencia lineal de presentaciones del curso, en el orden del temario.
 * Es el recorrido que siguen "anterior" y "siguiente".
 */
export function coursePositions(outline: OutlineItem[]): CoursePosition[] {
  const positions: CoursePosition[] = [];
  for (const item of flattenIndex(outline)) {
    const count = item.decks?.length ?? 0;
    for (let deck = 0; deck < count; deck++) positions.push({ topicId: item.id, deck });
  }
  return positions;
}

export function neighbourPositions(
  outline: OutlineItem[],
  current: CoursePosition | null,
): { prev: CoursePosition | null; next: CoursePosition | null } {
  const positions = coursePositions(outline);
  if (positions.length === 0) return { prev: null, next: null };
  if (!current) return { prev: null, next: positions[0] };

  const at = positions.findIndex((p) => p.topicId === current.topicId && p.deck === current.deck);
  if (at !== -1) {
    return { prev: positions[at - 1] ?? null, next: positions[at + 1] ?? null };
  }

  // El tema actual no tiene presentaciones: se toma su lugar en el temario.
  const order = flattenIndex(outline).map((item) => item.id);
  const here = order.indexOf(current.topicId);
  if (here === -1) return { prev: null, next: positions[0] };
  let prev: CoursePosition | null = null;
  let next: CoursePosition | null = null;
  for (const position of positions) {
    const where = order.indexOf(position.topicId);
    if (where < here) prev = position;
    else if (where > here && !next) next = position;
  }
  return { prev, next };
}

/** Busca un tema por su número de sección ("1.2") para los enlaces cortos. */
export function findTopicByNumber(outline: OutlineItem[], number: string): OutlineItem | null {
  const wanted = number.replace(/\.$/, '');
  return flattenIndex(outline).find((item) => splitNumberPrefix(item.title).number === wanted) ?? null;
}

function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export interface SearchHit {
  topicId: string;
  topicTitle: string;
  /** Índice de la presentación, o null si coincidió el título del tema. */
  deck: number | null;
  label: string;
}

/**
 * Búsqueda por título de tema y por título de presentación. No necesita el
 * HTML, así que es instantánea aunque el contenido no se haya descargado.
 */
export function searchOutline(outline: OutlineItem[], query: string, limit = 40): SearchHit[] {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const matches = (text: string) => {
    const haystack = normalizeForSearch(text);
    return terms.every((term) => haystack.includes(term));
  };
  const hits: SearchHit[] = [];
  for (const item of flattenIndex(outline)) {
    if (matches(item.title)) {
      hits.push({ topicId: item.id, topicTitle: item.title, deck: null, label: item.title });
    }
    (item.decks ?? []).forEach((deck, i) => {
      if (matches(deck.title)) {
        hits.push({ topicId: item.id, topicTitle: item.title, deck: i, label: deck.title });
      }
    });
    if (hits.length >= limit) break;
  }
  return hits.slice(0, limit);
}

const MAX_TITLE = 300;
const MAX_ID = 500;
const MAX_NODES = 5000;

class OutlineError extends Error {}

function fail(message: string): never {
  throw new OutlineError(message);
}

function checkNode(raw: unknown, path: string, seen: Set<string>): { id: string; title: string; children?: unknown[] } & Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`${path}: se esperaba un objeto.`);
  const node = raw as Record<string, unknown>;
  if (typeof node.id !== 'string' || node.id.length === 0 || node.id.length > MAX_ID) fail(`${path}: "id" no es válido.`);
  if (node.id.includes('/')) fail(`${path}: "id" no puede contener "/".`);
  if (typeof node.title !== 'string' || node.title.length > MAX_TITLE) fail(`${path}: "title" no es válido.`);
  if (seen.has(node.id)) fail(`${path}: el id "${node.id}" está repetido.`);
  seen.add(node.id);
  if (seen.size > MAX_NODES) fail('El temario tiene demasiados elementos.');
  if (node.children !== undefined && !Array.isArray(node.children)) fail(`${path}: "children" debe ser una lista.`);
  return node as { id: string; title: string; children?: unknown[] } & Record<string, unknown>;
}

/**
 * Valida un respaldo antes de aceptarlo. Un archivo mal formado ya no puede
 * sustituir el temario: lanza un error que explica qué falló.
 */
export function parseIndexBackup(data: unknown): IndexItem[] {
  if (!Array.isArray(data)) fail('El archivo no contiene una lista de capítulos.');
  if (data.length === 0) fail('El respaldo está vacío.');
  const seen = new Set<string>();
  const walk = (items: unknown[], path: string): IndexItem[] =>
    items.map((raw, i) => {
      const here = `${path}[${i}]`;
      const node = checkNode(raw, here, seen);
      const item: IndexItem = { id: node.id, title: node.title };
      if (node.content !== undefined && node.content !== null) {
        if (!Array.isArray(node.content) || node.content.some((c) => typeof c !== 'string')) {
          fail(`${here}: "content" debe ser una lista de textos HTML.`);
        }
        if ((node.content as string[]).length > 0) item.content = node.content as string[];
      }
      if (node.children && node.children.length > 0) item.children = walk(node.children, `${here}.children`);
      return item;
    });
  return walk(data, 'temario');
}

/** Valida el temario ligero leído de la base de datos o de la caché local. */
export function parseOutline(data: unknown): OutlineItem[] {
  if (!Array.isArray(data)) fail('El temario guardado no es una lista.');
  const seen = new Set<string>();
  const walk = (items: unknown[], path: string): OutlineItem[] =>
    items.map((raw, i) => {
      const here = `${path}[${i}]`;
      const node = checkNode(raw, here, seen);
      const item: OutlineItem = { id: node.id, title: node.title };
      if (Array.isArray(node.decks) && node.decks.length > 0) {
        item.decks = node.decks.map((deck, k) => {
          const d = (deck ?? {}) as Record<string, unknown>;
          return {
            title: typeof d.title === 'string' && d.title ? d.title.slice(0, MAX_TITLE) : `Presentación ${k + 1}`,
            bytes: typeof d.bytes === 'number' && Number.isFinite(d.bytes) ? d.bytes : 0,
          };
        });
        if (typeof node.rev === 'number' && Number.isFinite(node.rev)) item.rev = node.rev;
      }
      if (node.children && node.children.length > 0) item.children = walk(node.children, `${here}.children`);
      return item;
    });
  return walk(data, 'temario');
}

export function isOutlineError(error: unknown): error is Error {
  return error instanceof OutlineError;
}
