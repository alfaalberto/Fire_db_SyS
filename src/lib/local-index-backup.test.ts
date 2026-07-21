import { describe, expect, it } from 'vitest';
import type { IndexItem } from '@/lib/types';
import { stripIndexContent } from '@/lib/local-index-backup';

describe('stripIndexContent', () => {
  it('keeps the tree metadata while removing slide HTML recursively', () => {
    const index: IndexItem[] = [
      {
        id: 'unit-1',
        title: 'Unidad 1',
        content: ['<h1>Contenido grande</h1>'],
        children: [
          {
            id: 'topic-1',
            title: 'Tema 1',
            parentId: 'unit-1',
            content: ['<script>window.example = true</script>'],
          },
        ],
      },
    ];

    expect(stripIndexContent(index)).toEqual([
      {
        id: 'unit-1',
        title: 'Unidad 1',
        children: [
          {
            id: 'topic-1',
            title: 'Tema 1',
            parentId: 'unit-1',
          },
        ],
      },
    ]);
    expect(index[0].content).toEqual(['<h1>Contenido grande</h1>']);
    expect(index[0].children?.[0].content).toEqual(['<script>window.example = true</script>']);
  });
});
