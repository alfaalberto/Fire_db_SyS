import { describe, expect, it } from 'vitest';
import { indexAfterMove, moveTo, slotToIndex } from './reorder';

describe('moveTo', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('lleva un elemento hacia delante o hacia atrás', () => {
    expect(moveTo(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveTo(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveTo(list, 1, 2)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('no cambia nada si el movimiento no tiene sentido, y nunca toca la lista original', () => {
    expect(moveTo(list, 1, 1)).toEqual(list);
    expect(moveTo(list, -1, 2)).toEqual(list);
    expect(moveTo(list, 1, 4)).toEqual(list);
    expect(moveTo(list, 0, 3)).not.toBe(list);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('indexAfterMove', () => {
  it('sigue al elemento movido', () => {
    expect(indexAfterMove(0, 0, 2)).toBe(2);
    expect(indexAfterMove(3, 3, 0)).toBe(0);
  });

  it('sigue a los demás cuando el movimiento los desplaza', () => {
    // De [a b c d] a [b c a d]: b y c retroceden un lugar; d se queda.
    expect(indexAfterMove(1, 0, 2)).toBe(0);
    expect(indexAfterMove(2, 0, 2)).toBe(1);
    expect(indexAfterMove(3, 0, 2)).toBe(3);
    // De [a b c d] a [d a b c]: a, b y c avanzan un lugar.
    expect(indexAfterMove(0, 3, 0)).toBe(1);
    expect(indexAfterMove(2, 3, 0)).toBe(3);
  });

  it('coincide con lo que hace moveTo', () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    for (let from = 0; from < list.length; from++) {
      for (let to = 0; to < list.length; to++) {
        const moved = moveTo(list, from, to);
        list.forEach((item, index) => expect(moved[indexAfterMove(index, from, to)]).toBe(item));
      }
    }
  });
});

describe('slotToIndex', () => {
  it('convierte el hueco donde se suelta en la posición final', () => {
    // Soltar junto a uno mismo no mueve nada.
    expect(slotToIndex(1, 1)).toBe(1);
    expect(slotToIndex(1, 2)).toBe(1);
    // Antes del primero y después del último (de cuatro).
    expect(slotToIndex(2, 0)).toBe(0);
    expect(slotToIndex(0, 4)).toBe(3);
    expect(slotToIndex(0, 2)).toBe(1);
  });
});
