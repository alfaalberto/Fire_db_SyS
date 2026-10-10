import { describe, it, expect } from 'vitest';
import type { IndexItem } from './types';
import {
  flattenIndex,
  findItemById,
  getBreadcrumbs,
  collectAllIds,
  generateUniqueId,
  renameItem,
  deleteItem,
  addChildItem,
  isSelfOrDescendant,
  moveItem,
  renumberIndex,
  splitNumberPrefix,
  stripNumberPrefix,
  updateItem,
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

  it('collectAllIds gathers every id', () => {
    expect(collectAllIds(sample()).size).toBe(5);
  });
});

describe('updateItem', () => {
  it('copies only the path to the target and shares the rest', () => {
    const original = sample();
    const updated = updateItem(original, 'cap1-a', (item) => ({ ...item, title: 'Cambiado' }));
    expect(findItemById(updated, 'cap1-a')?.title).toBe('Cambiado');
    expect(updated).not.toBe(original);
    expect(updated[0]).not.toBe(original[0]);
    // El capítulo que no se tocó es el mismo objeto.
    expect(updated[1]).toBe(original[1]);
    expect(findItemById(original, 'cap1-a')?.title).toBe('1.1 Intro');
  });

  it('returns the same array when the id does not exist', () => {
    const original = sample();
    expect(updateItem(original, 'nope', (item) => ({ ...item, title: 'x' }))).toBe(original);
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

  it('keeps each title\'s own style (with or without trailing dot)', () => {
    const live: IndexItem[] = [
      { id: 'b', title: '4 Segundo', children: [{ id: 'b1', title: '4.7 Hijo' }] },
      { id: 'a', title: '1 Primero' },
    ];
    const out = renumberIndex(live);
    expect(out.map((item) => item.title)).toEqual(['1 Segundo', '2 Primero']);
    expect(out[0].children?.[0].title).toBe('1.1 Hijo');
  });

  it('returns the same array when nothing changes', () => {
    const tidy: IndexItem[] = [{ id: 'a', title: '1 Uno', children: [{ id: 'a1', title: '1.1 Hijo' }] }];
    expect(renumberIndex(tidy)).toBe(tidy);
  });

  it('splitNumberPrefix separates the section number from the text', () => {
    expect(splitNumberPrefix('1.2 Señales continuas')).toEqual({ number: '1.2', text: 'Señales continuas' });
    expect(splitNumberPrefix('3. Fourier')).toEqual({ number: '3', text: 'Fourier' });
    expect(splitNumberPrefix('Resumen')).toEqual({ number: null, text: 'Resumen' });
  });

  it('stripNumberPrefix removes leading numbering only', () => {
    expect(stripNumberPrefix('1.2.3 Título')).toBe('Título');
    expect(stripNumberPrefix('Sin número')).toBe('Sin número');
  });
});
