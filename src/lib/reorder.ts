/**
 * Reordenar una lista arrastrando: operaciones puras, sin DOM.
 */

/** Lleva el elemento `from` a la posición `to` (la que ocupará al terminar). */
export function moveTo<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Dónde queda el elemento que estaba en `index` después de llevar `from` a `to`. */
export function indexAfterMove(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (from < index && to >= index) return index - 1;
  if (from > index && to <= index) return index + 1;
  return index;
}

/**
 * Posición final de un elemento soltado en el hueco `slot`. Los huecos se
 * cuentan entre elementos: 0 es antes del primero y `n` después del último.
 */
export function slotToIndex(from: number, slot: number): number {
  return slot > from ? slot - 1 : slot;
}
