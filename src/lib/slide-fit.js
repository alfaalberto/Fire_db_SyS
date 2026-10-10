/**
 * Con qué tamaño se dibuja una presentación.
 *
 * El iframe puede dibujarse con un ancho distinto del disponible y escalarse
 * después para ocupar su sitio: más ancho y reducido cuando el contenido no
 * cabe (un teléfono), o más estrecho y ampliado cuando la presentación deja
 * márgenes vacíos a los lados (un proyector). Aquí se decide ese ancho a
 * partir de lo que mide el puente dentro de la presentación.
 *
 * Reglas:
 *  - El contenido cortado manda: se reduce hasta que quepa (mínimo 60 %).
 *    Si lo único que se sale es una barra de botones y la ventana es amplia,
 *    solo se reduce cuando hace falta poco o cuando quedan fuera los botones
 *    de avanzar; achicar toda la presentación por un botón secundario no
 *    compensa.
 *  - Si la columna de contenido es más estrecha que la ventana, se amplía
 *    hasta llenarla (máximo 150 %), pero una lámina que cabía en la pantalla
 *    tiene que seguir cabiendo: si deja de hacerlo se amplía menos.
 *  - Dentro de una misma presentación la ampliación solo baja, nunca sube:
 *    así el tamaño no salta de lámina en lámina.
 *
 * Es JavaScript llano, sin dependencias, para poder ejecutarlo también fuera
 * de la app al revisar presentaciones reales.
 */

/**
 * Lo que mide el puente, en píxeles de la presentación.
 * @typedef {object} LayoutReport
 * @property {number} width   Ancho con el que se midió.
 * @property {number} height  Alto con el que se midió.
 * @property {number} need    Ancho con el que nada quedaría cortado.
 * @property {number} main    Lo mismo, sin contar cabeceras ni pies.
 * @property {boolean} nav    Los botones de avanzar o retroceder quedan cortados.
 * @property {number} tall    Alto que ocuparía el contenido sin desplazarse.
 * @property {number} col     Ancho de la columna de contenido si está centrada y deja márgenes; 0 si no.
 */

/**
 * @typedef {object} FitMemory
 * @property {number | null} width  Ancho con el que se dibuja; null = el disponible.
 * @property {number} steps    Reducciones seguidas.
 * @property {number} over     Lo que sobresalía en la última reducción.
 * @property {boolean} gaveUp  Reducir no sirvió: se deja a su tamaño.
 * @property {number} zooms    Ampliaciones probadas.
 * @property {number} ceiling  Ampliación máxima que admite lo visto hasta ahora.
 */

export const FIT = Object.freeze({
  /** Reducción máxima: por debajo el texto deja de leerse. */
  MIN_SCALE: 0.6,
  /** Ampliación máxima. */
  MAX_ZOOM: 1.5,
  /** Un desborde mínimo (una barra de desplazamiento, un borde) no cuenta. */
  TOLERANCE: 1.03,
  /** Ampliar menos que esto no se nota y no compensa recolocar la página. */
  MIN_GAIN: 1.06,
  /** Parte del ancho que debe ocupar la columna una vez ampliada. */
  FILL: 0.96,
  /** Reducciones o ampliaciones seguidas mientras la presentación se acomoda. */
  MAX_STEPS: 3,
  /** Si agrandar la ventana no acorta lo que sobresale al menos esto, no tiene arreglo. */
  PROGRESS: 0.85,
  /** A partir de este ancho la ventana se considera amplia (no es un teléfono). */
  WIDE_BOX: 900,
  /** En una ventana amplia, una barra de botones solo justifica reducir hasta aquí. */
  MILD: 0.9,
  /** Una lámina que ocupa hasta esto de la pantalla "cabe" y debe seguir cabiendo. */
  NEAR_FIT: 1.1,
  /** Holgura al comparar alturas. */
  SLACK: 6,
});

/** @returns {FitMemory} */
export function createFit() {
  return { width: null, steps: 0, over: 0, gaveUp: false, zooms: 0, ceiling: FIT.MAX_ZOOM };
}

/** Escala con la que se ve la presentación (1 = tamaño natural). */
export function scaleOf(width, boxWidth) {
  return width && boxWidth > 0 ? boxWidth / width : 1;
}

function widthForZoom(zoom, boxWidth) {
  return zoom >= FIT.MIN_GAIN ? Math.round(boxWidth / zoom) : null;
}

/**
 * Decide el ancho siguiente a partir de una medida.
 *
 * @param {FitMemory} memory
 * @param {LayoutReport} report
 * @param {{ w: number, h: number }} box  Sitio disponible.
 * @returns {{ memory: FitMemory, width: number | null }}
 */
export function nextFit(memory, report, box) {
  const same = { memory, width: memory.width };
  const current = memory.width === null ? box.w : memory.width;
  // Medida tomada con otro ancho: llegó tarde, tras un cambio de tamaño.
  if (!(report.width > 0) || !(report.need > 0) || box.w <= 0 || Math.abs(report.width - current) > 2) return same;

  const next = { ...memory };
  const zoomed = current < box.w - 1;
  const shrunk = current > box.w + 1;

  /* ---------------- algo queda cortado a lo ancho ---------------- */
  if (report.need > report.width * FIT.TOLERANCE) {
    if (zoomed) {
      // La ampliación dejó algo fuera: se amplía solo lo que admite.
      next.ceiling = Math.min(next.ceiling, box.w / report.need);
      next.width = widthForZoom(next.ceiling, box.w);
      return { memory: next, width: next.width };
    }
    if (memory.gaveUp) return same;

    const contentCut = report.main > report.width * FIT.TOLERANCE;
    const barsCount = box.w < FIT.WIDE_BOX || report.nav || box.w / report.need >= FIT.MILD;
    const target = barsCount ? report.need : contentCut ? report.main : 0;
    if (!target) return same;

    const over = target - report.width;
    if (shrunk && over >= memory.over * FIT.PROGRESS) {
      // Agrandar no acortó lo que sobresale: mide según la ventana (un `97vw`
      // más relleno) y nunca cabrá. Se deja a su tamaño natural.
      next.gaveUp = true;
      next.width = null;
      return { memory: next, width: null };
    }
    if (memory.steps >= FIT.MAX_STEPS) return same;
    const wanted = Math.min(Math.ceil(target), Math.floor(box.w / FIT.MIN_SCALE));
    if (wanted <= current + 4) return same;
    next.width = wanted;
    next.steps = memory.steps + 1;
    next.over = over;
    return { memory: next, width: wanted };
  }

  /* ---------------- todo cabe: ¿se puede ampliar? ---------------- */
  if (shrunk || !(box.h > 0) || !(report.tall > 0)) return same;
  // ¿Esta lámina cabe (o casi) en la pantalla a tamaño natural?
  const fitsLike = report.tall <= box.h * FIT.NEAR_FIT;

  if (zoomed) {
    if (fitsLike && report.tall > report.height + FIT.SLACK) {
      // Cabía y, ampliada, ya no: se amplía hasta donde cabe.
      next.ceiling = Math.min(next.ceiling, (box.h / report.tall) * 0.995);
      next.width = widthForZoom(next.ceiling, box.w);
      return { memory: next, width: next.width };
    }
    return same;
  }

  if (!(report.col > 0) || memory.zooms >= FIT.MAX_STEPS) return same;
  // Ya rebasa un poco la pantalla: ampliarla lo empeoraría.
  if (fitsLike && report.tall > box.h + FIT.SLACK) return same;
  const zoom = Math.min(memory.ceiling, (FIT.FILL * box.w) / report.col);
  const wanted = widthForZoom(zoom, box.w);
  if (wanted === null) return same;
  next.width = wanted;
  next.zooms = memory.zooms + 1;
  return { memory: next, width: wanted };
}
