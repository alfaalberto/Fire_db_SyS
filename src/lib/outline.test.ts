import { describe, expect, it } from 'vitest';
import type { IndexItem, OutlineItem } from './types';
import {
  coursePositions,
  courseStats,
  findTopicByNumber,
  isOutlineError,
  joinIndex,
  neighbourPositions,
  parseIndexBackup,
  parseOutline,
  searchOutline,
  splitIndex,
  topicsWithDecks,
} from './outline';

const doc = (title: string) => `<!DOCTYPE html><html><head><title>${title}</title></head><body>${title}</body></html>`;

function backup(): IndexItem[] {
  return [
    {
      id: 'cap1',
      title: '1 Señales y Sistemas',
      children: [
        { id: 'a', title: '1.1 Introducción', content: [doc('Ejemplo 1.1 · Energía')] },
        { id: 'b', title: '1.2 Señales continuas y discretas', content: [doc('Transformaciones'), doc('Señales periódicas')] },
        { id: 'c', title: '1.3 Señales de energía' },
      ],
    },
    { id: 'cap2', title: '2 Sistemas LTI', children: [{ id: 'd', title: '2.1 Convolución', content: [doc('Suma de convolución')] }] },
  ];
}

function outline(): OutlineItem[] {
  return splitIndex(backup(), 7).outline;
}

describe('splitIndex / joinIndex', () => {
  it('separa el HTML del temario y lo vuelve a unir sin pérdidas', () => {
    const { outline: light, content } = splitIndex(backup(), 7);
    expect(JSON.stringify(light)).not.toContain('<!DOCTYPE');
    expect(content.get('b')).toHaveLength(2);
    expect(light[0].children![1].decks!.map((d) => d.title)).toEqual(['Transformaciones', 'Señales periódicas']);
    expect(light[0].children![1].rev).toBe(7);
    expect(light[0].children![2].decks).toBeUndefined();
    expect(joinIndex(light, content)).toEqual(backup());
  });

  it('cuenta los bytes reales (UTF-8) de cada presentación', () => {
    const { outline: light } = splitIndex([{ id: 'x', title: 'X', content: ['ñandú'] }], 1);
    expect(light[0].decks![0]).toEqual({ title: 'Presentación 1', bytes: 7 });
  });
});

describe('recorrido del curso', () => {
  it('enumera las presentaciones en el orden del temario', () => {
    expect(coursePositions(outline())).toEqual([
      { topicId: 'a', deck: 0 },
      { topicId: 'b', deck: 0 },
      { topicId: 'b', deck: 1 },
      { topicId: 'd', deck: 0 },
    ]);
    expect(topicsWithDecks(outline())).toEqual(['a', 'b', 'd']);
  });

  it('anterior y siguiente cruzan temas y capítulos', () => {
    expect(neighbourPositions(outline(), { topicId: 'b', deck: 0 })).toEqual({
      prev: { topicId: 'a', deck: 0 },
      next: { topicId: 'b', deck: 1 },
    });
    expect(neighbourPositions(outline(), { topicId: 'b', deck: 1 }).next).toEqual({ topicId: 'd', deck: 0 });
    expect(neighbourPositions(outline(), { topicId: 'd', deck: 0 }).next).toBeNull();
    expect(neighbourPositions(outline(), { topicId: 'a', deck: 0 }).prev).toBeNull();
  });

  it('desde un tema sin presentaciones salta al contenido más cercano', () => {
    expect(neighbourPositions(outline(), { topicId: 'c', deck: 0 })).toEqual({
      prev: { topicId: 'b', deck: 1 },
      next: { topicId: 'd', deck: 0 },
    });
  });

  it('resume cuántos temas tienen contenido', () => {
    expect(courseStats(outline())).toMatchObject({ topics: 4, topicsWithDecks: 3, decks: 4 });
  });

  it('encuentra un tema por su número de sección', () => {
    expect(findTopicByNumber(outline(), '1.2')?.id).toBe('b');
    expect(findTopicByNumber(outline(), '2')?.id).toBe('cap2');
    expect(findTopicByNumber(outline(), '9.9')).toBeNull();
  });
});

describe('searchOutline', () => {
  it('ignora acentos y mayúsculas, y busca en títulos de presentaciones', () => {
    const hits = searchOutline(outline(), 'senales PERIODICAS');
    expect(hits).toEqual([{ topicId: 'b', topicTitle: '1.2 Señales continuas y discretas', deck: 1, label: 'Señales periódicas' }]);
  });

  it('devuelve temas cuando coincide el título', () => {
    expect(searchOutline(outline(), 'convolución').map((hit) => [hit.topicId, hit.deck])).toEqual([
      ['d', null],
      ['d', 0],
    ]);
  });

  it('una búsqueda vacía no devuelve nada', () => {
    expect(searchOutline(outline(), '   ')).toEqual([]);
  });
});

describe('validación de respaldos', () => {
  it('acepta un respaldo bien formado', () => {
    expect(parseIndexBackup(JSON.parse(JSON.stringify(backup())))).toEqual(backup());
  });

  it.each([
    ['no es una lista', { id: 'x' }],
    ['lista vacía', []],
    ['nodo sin id', [{ title: 'Sin id' }]],
    ['id con barra', [{ id: 'a/b', title: 'x' }]],
    ['ids repetidos', [{ id: 'a', title: 'x' }, { id: 'a', title: 'y' }]],
    ['contenido que no es texto', [{ id: 'a', title: 'x', content: [1, 2] }]],
    ['hijos que no son lista', [{ id: 'a', title: 'x', children: 'no' }]],
  ])('rechaza: %s', (_name, data) => {
    let thrown: unknown;
    try {
      parseIndexBackup(data);
    } catch (error) {
      thrown = error;
    }
    expect(isOutlineError(thrown)).toBe(true);
  });

  it('parseOutline tolera metadatos incompletos pero no estructura inválida', () => {
    const parsed = parseOutline([{ id: 'a', title: 'A', decks: [{}, { title: 'Dos', bytes: 5 }], rev: 3, extra: true }]);
    expect(parsed).toEqual([{ id: 'a', title: 'A', decks: [{ title: 'Presentación 1', bytes: 0 }, { title: 'Dos', bytes: 5 }], rev: 3 }]);
    expect(() => parseOutline({})).toThrow();
  });
});
