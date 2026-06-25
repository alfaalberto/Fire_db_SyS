import { describe, it, expect } from 'vitest';
import type { IndexItem } from './types';
import {
  flattenIndex,
  findItemById,
  getBreadcrumbs,
  updateItemContent,
  mergeLoadedContent,
  collectAllIds,
  collectContentIds,
  generateUniqueId,
  renameItem,
  deleteItem,
  addChildItem,
  isSelfOrDescendant,
  moveItem,
  renumberIndex,
  stripNumberPrefix,
} from './tree';

function sample(): IndexItem[] {
  return [
    {
      id: 'cap1',
      title: '1. Capítulo Uno',
      children: [
        { id: 'cap1-a', title: '1.1 Intro' },
        { id: 'cap1-b', title: '1.2 Señales', content: ['<h1>Hola</h1>'] },
      ],
    },
    {
      id: 'cap2',
      title: '2. Capítulo Dos',
      children: [{ id: 'cap2-a', title: '2.1 Otro' }],
    },
  ];
}

describe('lookup helpers', () => {
  it('flattenIndex returns parents before children, depth-first', () => {
    expect(flattenIndex(sample()).map((i) => i.id)).toEqual([
      'cap1', 'cap1-a', 'cap1-b', 'cap2', 'cap2-a',
    ]);
  });

  it('findItemById finds nested items and returns null when missing', () => {
    expect(findItemById(sample(), 'cap2-a')?.title).toBe('2.1 Otro');
    expect(findItemById(sample(), 'nope')).toBeNull();
  });

  it('getBreadcrumbs returns the full path to a node', () => {
    expect(getBreadcrumbs(sample(), 'cap1-b').map((i) => i.id)).toEqual(['cap1', 'cap1-b']);
    expect(getBreadcrumbs(sample(), 'missing')).toEqual([]);
  });

  it('collectAllIds and collectContentIds gather the right ids', () => {
    expect(collectAllIds(sample()).size).toBe(5);
    expect(collectContentIds(sample())).toEqual(['cap1-b']);
  });
});

describe('content helpers', () => {
  it('updateItemContent sets content and clears it when empty', () => {
    const withContent = updateItemContent(sample(), 'cap1-a', ['<p>x</p>']);
    expect(findItemById(withContent, 'cap1-a')?.content).toEqual(['<p>x</p>']);
    const cleared = updateItemContent(withContent, 'cap1-a', []);
    expect(findItemById(cleared, 'cap1-a')?.content).toBeUndefined();
  });

  it('mergeLoadedContent only fills missing local content', () => {
    const merged = mergeLoadedContent(sample(), [
      { id: 'cap1-a', content: ['<p>remote</p>'] },
      { id: 'cap1-b', content: ['<p>should-not-overwrite</p>'] },
    ]);
    expect(findItemById(merged, 'cap1-a')?.content).toEqual(['<p>remote</p>']);
    // cap1-b already had local content, so it is preserved.
    expect(findItemById(merged, 'cap1-b')?.content).toEqual(['<h1>Hola</h1>']);
  });
});

describe('mutation helpers', () => {
  it('renameItem updates only the targeted node (immutably)', () => {
    const original = sample();
    const renamed = renameItem(original, 'cap1-a', '1.1 Nuevo');
    expect(findItemById(renamed, 'cap1-a')?.title).toBe('1.1 Nuevo');
    expect(findItemById(original, 'cap1-a')?.title).toBe('1.1 Intro');
  });

  it('deleteItem removes a node and prunes empty children arrays', () => {
    const afterLeaf = deleteItem(sample(), 'cap2-a');
    expect(findItemById(afterLeaf, 'cap2-a')).toBeNull();
    expect(findItemById(afterLeaf, 'cap2')?.children).toBeUndefined();

    const afterParent = deleteItem(sample(), 'cap1');
    expect(findItemById(afterParent, 'cap1')).toBeNull();
    expect(findItemById(afterParent, 'cap1-a')).toBeNull();
  });

  it('addChildItem appends at top level and under a parent', () => {
    const top = addChildItem(sample(), null, { id: 'cap3', title: '3.' });
    expect(top.map((i) => i.id)).toContain('cap3');

    const child = addChildItem(sample(), 'cap2-a', { id: 'cap2-a-1', title: 'x' });
    expect(findItemById(child, 'cap2-a')?.children?.[0]?.id).toBe('cap2-a-1');
  });

  it('generateUniqueId avoids collisions', () => {
    const items: IndexItem[] = [{ id: 'intro', title: 'Intro' }];
    expect(generateUniqueId(items, 'Nueva sección')).toBe('nueva-seccion');
    expect(generateUniqueId(items, 'Intro')).toBe('intro-1');
  });
});

describe('moveItem', () => {
  it('reorders siblings with before/after', () => {
    const moved = moveItem(sample(), 'cap1-b', 'cap1-a', 'before');
    expect(findItemById(moved, 'cap1')?.children?.map((c) => c.id)).toEqual(['cap1-b', 'cap1-a']);
  });

  it('moves a node into another as a child with inside', () => {
    const moved = moveItem(sample(), 'cap2-a', 'cap1', 'inside');
    expect(findItemById(moved, 'cap1')?.children?.map((c) => c.id)).toEqual(['cap1-a', 'cap1-b', 'cap2-a']);
    // cap2 lost its only child.
    expect(findItemById(moved, 'cap2')?.children).toBeUndefined();
  });

  it('moves across chapters as a sibling', () => {
    const moved = moveItem(sample(), 'cap1-a', 'cap2-a', 'after');
    expect(findItemById(moved, 'cap2')?.children?.map((c) => c.id)).toEqual(['cap2-a', 'cap1-a']);
    expect(findItemById(moved, 'cap1')?.children?.map((c) => c.id)).toEqual(['cap1-b']);
  });

  it('is a no-op when dropping a node into its own subtree', () => {
    const before = sample();
    const after = moveItem(before, 'cap1', 'cap1-a', 'inside');
    expect(after).toBe(before);
  });

  it('isSelfOrDescendant detects subtree membership', () => {
    expect(isSelfOrDescendant(sample(), 'cap1', 'cap1-b')).toBe(true);
    expect(isSelfOrDescendant(sample(), 'cap1', 'cap2-a')).toBe(false);
  });
});

describe('renumberIndex', () => {
  it('renumbers numbered titles by position but leaves free-form titles', () => {
    const reordered: IndexItem[] = [
      {
        id: 'b', title: '5. Segundo',
        children: [
          { id: 'b1', title: '9.9 Hijo' },
          { id: 'b2', title: 'Resumen sin número' },
        ],
      },
      { id: 'a', title: '1. Primero' },
    ];
    const out = renumberIndex(reordered);
    expect(out[0].title).toBe('1. Segundo');
    expect(out[0].children?.[0].title).toBe('1.1 Hijo');
    expect(out[0].children?.[1].title).toBe('Resumen sin número');
    expect(out[1].title).toBe('2. Primero');
  });

  it('stripNumberPrefix removes leading numbering only', () => {
    expect(stripNumberPrefix('1.2.3 Título')).toBe('Título');
    expect(stripNumberPrefix('Sin número')).toBe('Sin número');
  });
});
