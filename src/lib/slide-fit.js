/**
 * Con qué tamaño se dibuja una presentación.
 *
 * El iframe puede dibujarse con un ancho distinto del disponible y escalarse
 * después para ocupar su sitio: más ancho y reducido cuando el contenido no
 * cabe (un teléfono), o más estrecho y ampliado cuando la presentación deja
 * márgenes vacíos a los lados (un proyector). Ampliar así equivale al zoom del
 * navegador: la presentación se acomoda a una ventana más pequeña y se ve más
 * grande. Aquí se decide ese ancho a partir de lo que mide el puente dentro de
 * la presentación.
 *
 * Reglas:
 *  - El contenido cortado manda: se reduce hasta que quepa (mínimo 60 %).
 *    Si lo único que se sale es una barra de botones y la ventana es amplia,
 *    solo se reduce cuando hace falta poco o cuando quedan fuera los botones
 *    de avanzar; achicar toda la presentación por un botón secundario no
 *    compensa.
 *  - Se amplía la presentación cuyas láminas caben en la pantalla y dejan
 *    márgenes a los lados: hasta que la columna de contenido llena el ancho
 *    (máximo 150 %) y sin cruzar sus puntos de corte, para que no pase a su
 *    diseño de tableta. Si la mayoría de las láminas ya llena la pantalla o
 *    necesita desplazarse, se deja como está.
 *  - El tamaño es uno para toda la presentación: una lámina que cabía tiene
 *    que seguir cabiendo, así que manda la más alta de las que caben. Las
 *    pocas que ya necesitaban desplazarse no limitan.
 *  - Mientras se recorre, la ampliación solo puede bajar, nunca subir.
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
 * @property {number} [soft]  Parte de `tall` que aportan paneles de los que aún no se sabe si dependen de la ventana.
 * @property {number} [clip]  Alto que recortan, sin poder desplazarse, los contenedores a la vista.
 * @property {number} col     Ancho de la columna de contenido si está centrada y deja márgenes; 0 si no.
 * @property {number} [floor] Ancho por debajo del cual la presentación cambiaría de diseño; 0 si no hay.
 * @property {Array<number | null> | null} [deck]  `tall` de cada lámina de la presentación; null donde no se sabe.
 * @property {number} [at]    Lugar de la lámina a la vista en `deck`.
 */

/**
 * @typedef {object} FitMemory
 * @property {number | null} width  Ancho con el que se dibuja; null = el disponible.
 * @property {number} steps    Reducciones seguidas.
 * @property {number} over     Lo que sobresalía en la última reducción.
 * @property {boolean} gaveUp  Reducir no sirvió: se deja a su tamaño.
 * @property {number} zooms    Ampliaciones probadas.
 * @property {number} ceiling  Ampliación máxima que admite lo visto hasta ahora.
 * @property {number} clip     Lo que ya se recortaba antes de ampliar (adornos).
 * @property {{ col: number, width: number } | null} probe  Columna y ancho previos a una ampliación aún sin comprobar.
 * @property {Array<number | null> | null} base  Alto de cada lámina antes de ampliar.
 * @property {boolean} lone    Sin láminas a la vista: la página cabía antes de ampliar.
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
  /** Parte de las láminas que debe caber en la pantalla para ampliar la presentación. */
  MOSTLY: 0.75,
  /** Sin datos de antes de ampliar: lo que ocupa hasta esto de la pantalla se supone que cabía. */
  NEAR_FIT: 1.1,
  /** Una página suelta más larga que esto es un documento: desplazarse es lo suyo. */
  LONG: 2,
  /** Holgura al comparar alturas. */
  SLACK: 6,
});

/**
 * @param {number} [ceiling]  Ampliación máxima ya conocida para esta presentación.
 * @returns {FitMemory}
 */
export function createFit(ceiling) {
  const top = ceiling > 0 ? Math.min(FIT.MAX_ZOOM, ceiling) : FIT.MAX_ZOOM;
  return { width: null, steps: 0, over: 0, gaveUp: false, zooms: 0, ceiling: top, clip: 0, probe: null, base: null, lone: false };
}

/** Escala con la que se ve la presentación (1 = tamaño natural). */
export function scaleOf(width, boxWidth) {
  return width && boxWidth > 0 ? boxWidth / width : 1;
}

function widthForZoom(zoom, boxWidth) {
  return zoom >= FIT.MIN_GAIN ? Math.round(boxWidth / zoom) : null;
}

/** Las láminas medidas, si hay al menos dos; si no, null (se trata como página suelta). */
function deckOf(report) {
  const deck = report.deck;
  if (!deck || deck.length < 2 || !(report.at >= 0) || report.at >= deck.length) return null;
  let known = 0;
  for (let j = 0; j < deck.length; j++) if (j === report.at || deck[j] > 0) known += 1;
  return known >= 2 ? deck : null;
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
  const cut = report.need > report.width * FIT.TOLERANCE;
  const deck = deckOf(report);
  const fits = (tall) => tall <= box.h + FIT.SLACK;

  /* ---------------- ampliada: ¿sigue valiendo? ---------------- */
  if (zoomed) {
    next.probe = null;
    let ceiling = memory.ceiling;
    const probe = memory.probe;
    if (probe && report.col > 0 && report.col <= probe.col * (report.width / probe.width) * 1.05) {
      // La columna encogió con la ventana (mide en `vw`): ampliar no la acerca
      // a los bordes. Se deja a su tamaño.
      ceiling = 1;
    }
    // La ampliación dejó algo fuera a lo ancho: se amplía solo lo que admite.
    if (cut) ceiling = Math.min(ceiling, box.w / report.need);
    if (box.h > 0 && report.tall > 0) {
      // Las láminas que cabían antes de ampliar tienen que seguir cabiendo:
      // manda la más alta. Sin datos de antes, se supone que cabía la que
      // ahora ocupa poco más que la pantalla.
      const base = deck && memory.base && memory.base.length === deck.length ? memory.base : null;
      const fitted = (j, tall) => (base && base[j] > 0 ? fits(base[j]) : tall <= box.h * FIT.NEAR_FIT);
      // Lo que ahora se recorta y antes no también es alto que falta.
      const live = report.tall + Math.max(0, (report.clip || 0) - memory.clip);
      let worst = 0;
      if (deck ? fitted(report.at, live) : memory.lone || live <= box.h * FIT.NEAR_FIT) worst = live;
      if (deck) {
        for (let j = 0; j < deck.length; j++) {
          const tall = deck[j];
          if (j !== report.at && tall > worst && fitted(j, tall)) worst = tall;
        }
      }
      if (worst > report.height + FIT.SLACK) ceiling = Math.min(ceiling, (box.h / worst) * 0.995);
      if (deck && !base) {
        // Las láminas se conocen ahora y no cuando se decidió ampliar: si la
        // mayoría no cabía, no había que haber ampliado.
        let known = 0;
        let fitting = 0;
        for (let j = 0; j < deck.length; j++) {
          const tall = j === report.at ? live : deck[j];
          if (!(tall > 0)) continue;
          known += 1;
          if (tall <= box.h * FIT.NEAR_FIT) fitting += 1;
        }
        if (fitting < known * FIT.MOSTLY) ceiling = 1;
      }
    }
    if (ceiling < memory.ceiling) {
      next.ceiling = ceiling;
      next.width = widthForZoom(ceiling, box.w);
    }
    return { memory: next, width: next.width };
  }

  /* ---------------- algo queda cortado a lo ancho ---------------- */
  if (cut) {
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
  if (!(report.col > 0) || memory.zooms >= FIT.MAX_STEPS) return same;
  // Lo que aportan los paneles aún sin clasificar no cuenta todavía: puede no
  // depender de la ventana, y eso solo se sabe probando.
  const firm = report.tall - (report.soft || 0);
  if (deck) {
    // Una presentación: se amplía si casi todas sus láminas caben en la pantalla.
    let known = 0;
    let fitting = 0;
    for (let j = 0; j < deck.length; j++) {
      const tall = j === report.at ? firm : deck[j];
      if (!(tall > 0)) continue;
      known += 1;
      if (fits(tall)) fitting += 1;
    }
    if (fitting < known * FIT.MOSTLY) return same;
  } else if (!fits(firm) && firm <= box.h * FIT.LONG) {
    // Una página suelta que ya rebasa la pantalla: ampliarla lo empeoraría.
    // (Un documento largo sí se amplía: desplazarse es lo suyo.)
    return same;
  }
  let zoom = Math.min(memory.ceiling, (FIT.FILL * box.w) / report.col);
  // Sin cruzar un punto de corte del diseño de la presentación.
  if (report.floor > 0) zoom = Math.min(zoom, box.w / report.floor);
  const wanted = widthForZoom(zoom, box.w);
  if (wanted === null) return same;
  next.width = wanted;
  next.zooms = memory.zooms + 1;
  next.clip = report.clip || 0;
  next.probe = { col: report.col, width: report.width };
  if (deck) {
    next.base = deck.slice();
    next.base[report.at] = firm;
    next.lone = false;
  } else {
    next.base = null;
    next.lone = fits(firm);
  }
  return { memory: next, width: wanted };
}
