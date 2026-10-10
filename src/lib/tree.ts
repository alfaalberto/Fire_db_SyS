/**
 * Operaciones puras sobre el árbol del temario. Son genéricas: funcionan igual
 * con el temario ligero (`OutlineItem`) y con el árbol de respaldo que lleva el
 * HTML incrustado (`IndexItem`). Ninguna muta su entrada.
 */
export interface TreeNode<T> {
  id: string;
  title: string;
  children?: T[];
}

type Node<T> = TreeNode<T>;

/** Recorrido en profundidad: cada padre antes que sus hijos. */
export function flattenIndex<T extends Node<T>>(items: T[]): T[] {
  const result: T[] = [];
  const walk = (nodes: T[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children && node.children.length > 0) walk(node.children);
    }
  };
  walk(items);
  return result;
}

export function findItemById<T extends Node<T>>(items: T[], id: string): T | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function getBreadcrumbs<T extends Node<T>>(items: T[], targetId: string, path: T[] = []): T[] {
  for (const item of items) {
    if (item.id === targetId) return [...path, item];
    if (item.children) {
      const result = getBreadcrumbs(item.children, targetId, [...path, item]);
      if (result.length > 0) return result;
    }
  }
  return [];
}

export function collectAllIds<T extends Node<T>>(items: T[], acc: Set<string> = new Set()): Set<string> {
  for (const item of items) {
    acc.add(item.id);
    if (item.children) collectAllIds(item.children, acc);
  }
  return acc;
}

/**
 * Aplica `update` al nodo `id` y devuelve un árbol nuevo. Solo se copian los
 * nodos del camino hasta el objetivo; el resto se comparte con el original.
 * Si el nodo no existe devuelve el mismo arreglo recibido.
 */
export function updateItem<T extends Node<T>>(items: T[], id: string, update: (item: T) => T): T[] {
  let changed = false;
  const next = items.map((item) => {
    if (item.id === id) {
      changed = true;
      return update(item);
    }
    if (item.children) {
      const children = updateItem(item.children, id, update);
      if (children !== item.children) {
        changed = true;
        return { ...item, children };
      }
    }
    return item;
  });
  return changed ? next : items;
}

export function slugify(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // "sección" -> "seccion"
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'item'
  );
}

export function generateUniqueId<T extends Node<T>>(items: T[], title: string): string {
  const existing = collectAllIds(items);
  const base = slugify(title);
  let candidate = base;
  let n = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

export function renameItem<T extends Node<T>>(items: T[], id: string, title: string): T[] {
  return updateItem(items, id, (item) => ({ ...item, title }));
}

function withChildren<T extends Node<T>>(item: T, children: T[]): T {
  if (children.length > 0) return { ...item, children };
  const { children: _dropped, ...rest } = item;
  return rest as T;
}

/** Quita el nodo `id` (y su subárbol). Devuelve también el nodo retirado. */
function detach<T extends Node<T>>(items: T[], id: string): { items: T[]; removed: T | null } {
  const index = items.findIndex((item) => item.id === id);
  if (index !== -1) {
    return { items: [...items.slice(0, index), ...items.slice(index + 1)], removed: items[index] };
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.children) continue;
    const result = detach(item.children, id);
    if (result.removed) {
      const next = [...items];
      next[i] = withChildren(item, result.items);
      return { items: next, removed: result.removed };
    }
  }
  return { items, removed: null };
}

export function deleteItem<T extends Node<T>>(items: T[], id: string): T[] {
  return detach(items, id).items;
}

export function addChildItem<T extends Node<T>>(items: T[], parentId: string | null, newItem: T): T[] {
  if (parentId === null) return [...items, newItem];
  return updateItem(items, parentId, (parent) => ({
    ...parent,
    children: [...(parent.children ?? []), newItem],
  }));
}

/** Verdadero si `id` es `ancestorId` o uno de sus descendientes. */
export function isSelfOrDescendant<T extends Node<T>>(items: T[], ancestorId: string, id: string): boolean {
  const node = findItemById(items, ancestorId);
  if (!node) return false;
  return collectAllIds([node]).has(id);
}

export type DropPosition = 'before' | 'after' | 'inside';

function insertSibling<T extends Node<T>>(items: T[], targetId: string, node: T, position: 'before' | 'after'): T[] | null {
  const index = items.findIndex((item) => item.id === targetId);
  if (index !== -1) {
    const at = position === 'before' ? index : index + 1;
    return [...items.slice(0, at), node, ...items.slice(at)];
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.children) continue;
    const children = insertSibling(item.children, targetId, node, position);
    if (children) {
      const next = [...items];
      next[i] = { ...item, children };
      return next;
    }
  }
  return null;
}

/**
 * Mueve `sourceId` respecto a `targetId`:
 * - 'before' / 'after': queda como hermano del destino.
 * - 'inside': queda como último hijo del destino.
 * Si el movimiento no es válido (por ejemplo, soltar un nodo dentro de su
 * propio subárbol) devuelve el mismo arreglo recibido.
 */
export function moveItem<T extends Node<T>>(items: T[], sourceId: string, targetId: string, position: DropPosition): T[] {
  if (sourceId === targetId) return items;
  if (isSelfOrDescendant(items, sourceId, targetId)) return items;
  if (!findItemById(items, targetId)) return items;

  const { items: without, removed } = detach(items, sourceId);
  if (!removed) return items;

  if (position === 'inside') {
    return updateItem(without, targetId, (target) => ({
      ...target,
      children: [...(target.children ?? []), removed],
    }));
  }
  return insertSibling(without, targetId, removed, position) ?? items;
}

const NUMBER_PREFIX = /^\s*\d+(\.\d+)*\.?\s+/;

/** Quita la numeración inicial ("1." / "1.2" / "1.2.3 ") de un título. */
export function stripNumberPrefix(title: string): string {
  return title.replace(NUMBER_PREFIX, '').trim();
}

/** Separa "1.2 Señales continuas" en { number: "1.2", text: "Señales continuas" }. */
export function splitNumberPrefix(title: string): { number: string | null; text: string } {
  const match = title.match(/^\s*(\d+(?:\.\d+)*)\.?\s+(.*)$/);
  if (!match) return { number: null, text: title.trim() };
  return { number: match[1], text: match[2].trim() };
}

/**
 * Renumera según la posición: "1", "2" en el primer nivel; "1.1", "1.2" en el
 * segundo, etc. Solo toca los títulos que ya empiezan con número, y conserva
 * el estilo de cada uno (con o sin punto final en el primer nivel).
 */
export function renumberIndex<T extends Node<T>>(items: T[]): T[] {
  const walk = (nodes: T[], parentNumber: string): T[] => {
    let changed = false;
    const next = nodes.map((item, i) => {
      const number = parentNumber ? `${parentNumber}.${i + 1}` : `${i + 1}`;
      let title = item.title;
      if (NUMBER_PREFIX.test(item.title)) {
        const hadTrailingDot = /^\s*\d+(\.\d+)*\.\s/.test(item.title);
        const label = hadTrailingDot ? `${number}.` : number;
        title = `${label} ${stripNumberPrefix(item.title)}`.trim();
      }
      const children = item.children && item.children.length > 0 ? walk(item.children, number) : item.children;
      if (title === item.title && children === item.children) return item;
      changed = true;
      return { ...item, title, ...(children ? { children } : {}) };
    });
    return changed ? next : nodes;
  };
  return walk(items, '');
}
