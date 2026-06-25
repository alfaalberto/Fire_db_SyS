import { produce } from 'immer';
import type { IndexItem } from './types';

/** Depth-first flatten of the index tree (parents before children). */
export function flattenIndex(items: IndexItem[]): IndexItem[] {
  const result: IndexItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children && item.children.length > 0) {
      result.push(...flattenIndex(item.children));
    }
  }
  return result;
}

export function findItemById(items: IndexItem[], id: string): IndexItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function getBreadcrumbs(items: IndexItem[], targetId: string, path: IndexItem[] = []): IndexItem[] {
  for (const item of items) {
    if (item.id === targetId) return [...path, item];
    if (item.children) {
      const result = getBreadcrumbs(item.children, targetId, [...path, item]);
      if (result.length > 0) return result;
    }
  }
  return [];
}

export function updateItemContent(items: IndexItem[], id: string, content: string[] | null): IndexItem[] {
  return produce(items, (draft) => {
    const item = findItemById(draft, id);
    if (item) {
      item.content = content && content.length > 0 ? content : undefined;
    }
  });
}

export function mergeLoadedContent(
  items: IndexItem[],
  docs: Array<{ id: string; content: string[] | null }>
): IndexItem[] {
  return produce(items, (draft) => {
    for (const doc of docs) {
      const item = findItemById(draft, doc.id);
      if (!item) continue;
      const hasLocalContent = !!item.content && item.content.length > 0;
      const hasLoadedContent = !!doc.content && doc.content.length > 0;
      if (!hasLocalContent && hasLoadedContent) {
        item.content = doc.content;
      }
    }
  });
}

export function collectAllIds(items: IndexItem[], acc: Set<string> = new Set()): Set<string> {
  for (const item of items) {
    acc.add(item.id);
    if (item.children) collectAllIds(item.children, acc);
  }
  return acc;
}

export function collectContentIds(items: IndexItem[], acc: string[] = []): string[] {
  for (const item of items) {
    if (item.content && item.content.length > 0) acc.push(item.id);
    if (item.children) collectContentIds(item.children, acc);
  }
  return acc;
}

export function generateUniqueId(items: IndexItem[], title: string): string {
  const existing = collectAllIds(items);
  const base =
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics so "sección" -> "seccion"
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'item';
  let candidate = base;
  let n = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

export function renameItem(items: IndexItem[], id: string, title: string): IndexItem[] {
  return produce(items, (draft) => {
    const item = findItemById(draft, id);
    if (item) item.title = title;
  });
}

export function deleteItem(items: IndexItem[], id: string): IndexItem[] {
  return produce(items, (draft) => {
    const removeFrom = (arr: IndexItem[]): boolean => {
      const idx = arr.findIndex((it) => it.id === id);
      if (idx !== -1) {
        arr.splice(idx, 1);
        return true;
      }
      for (const it of arr) {
        if (it.children && removeFrom(it.children)) {
          if (it.children.length === 0) delete it.children;
          return true;
        }
      }
      return false;
    };
    removeFrom(draft);
  });
}

export function addChildItem(items: IndexItem[], parentId: string | null, newItem: IndexItem): IndexItem[] {
  return produce(items, (draft) => {
    if (parentId === null) {
      draft.push(newItem);
      return;
    }
    const parent = findItemById(draft, parentId);
    if (parent) {
      if (!parent.children) parent.children = [];
      parent.children.push(newItem);
    }
  });
}

/** True if `ancestorId` is `id` itself or one of its descendants. */
export function isSelfOrDescendant(items: IndexItem[], ancestorId: string, id: string): boolean {
  const node = findItemById(items, ancestorId);
  if (!node) return false;
  return collectAllIds([node]).has(id);
}

export type DropPosition = 'before' | 'after' | 'inside';

/**
 * Move `sourceId` relative to `targetId`.
 * - 'before' / 'after': becomes a sibling of the target.
 * - 'inside': becomes the last child of the target.
 * No-ops if the move is invalid (e.g. dropping a node into its own subtree).
 */
export function moveItem(
  items: IndexItem[],
  sourceId: string,
  targetId: string,
  position: DropPosition
): IndexItem[] {
  if (sourceId === targetId) return items;
  // Cannot move a node into itself or one of its descendants.
  if (isSelfOrDescendant(items, sourceId, targetId)) return items;

  return produce(items, (draft) => {
    // Detach the source node.
    let moved: IndexItem | null = null;
    const detach = (arr: IndexItem[]): boolean => {
      const idx = arr.findIndex((it) => it.id === sourceId);
      if (idx !== -1) {
        moved = arr.splice(idx, 1)[0];
        return true;
      }
      for (const it of arr) {
        if (it.children && detach(it.children)) {
          if (it.children.length === 0) delete it.children;
          return true;
        }
      }
      return false;
    };
    detach(draft);
    if (!moved) return;

    if (position === 'inside') {
      const target = findItemById(draft, targetId);
      if (!target) return;
      if (!target.children) target.children = [];
      target.children.push(moved);
      return;
    }

    // Insert as sibling before/after the target.
    const insertSibling = (arr: IndexItem[]): boolean => {
      const idx = arr.findIndex((it) => it.id === targetId);
      if (idx !== -1) {
        arr.splice(position === 'before' ? idx : idx + 1, 0, moved!);
        return true;
      }
      for (const it of arr) {
        if (it.children && insertSibling(it.children)) return true;
      }
      return false;
    };
    insertSibling(draft);
  });
}

const NUMBER_PREFIX = /^\s*\d+(\.\d+)*\.?\s+/;

/** Strip a leading "1." / "1.2" / "1.2.3 " numbering prefix from a title. */
export function stripNumberPrefix(title: string): string {
  return title.replace(NUMBER_PREFIX, '').trim();
}

/**
 * Re-number the tree based on position: top-level => "1", "2"; children => "1.1",
 * "1.2"; grandchildren => "1.1.1"; and so on. Only titles that already start with
 * a numeric prefix are renumbered, so free-form titles are left untouched.
 */
export function renumberIndex(items: IndexItem[]): IndexItem[] {
  return produce(items, (draft) => {
    const walk = (arr: IndexItem[], parentNumber: string) => {
      arr.forEach((item, i) => {
        const number = parentNumber ? `${parentNumber}.${i + 1}` : `${i + 1}`;
        // Top-level sections use a trailing dot ("1. Título"); nested ones do
        // not ("1.1 Título"), matching the book's numbering convention.
        const label = parentNumber ? number : `${number}.`;
        if (NUMBER_PREFIX.test(item.title)) {
          item.title = `${label} ${stripNumberPrefix(item.title)}`.trim();
        }
        if (item.children && item.children.length > 0) {
          walk(item.children, number);
        }
      });
    };
    walk(draft, '');
  });
}

/** Stable-ish serialization used to compare two index trees for equality. */
export function serializeIndex(items: IndexItem[]): string {
  return JSON.stringify(items);
}
