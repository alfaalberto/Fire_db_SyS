/**
 * Tamaño con el que se muestra cada presentación.
 *
 * Una presentación se dibuja en un iframe con un ancho y un alto «virtuales»
 * (los que ella ve como su ventana) y se escala hasta ocupar el marco que le
 * deja la app. Con eso se resuelven dos casos:
 *
 *  - No cabe a lo ancho (una barra de botones en el teléfono): se le da el
 *    ancho que necesita y se reduce, en lugar de mostrarla recortada.
 *  - Queda pequeña (una columna de 1200 px o una lámina 16:9 de medidas fijas
 *    en una pantalla de 1920): se le da una ventana más pequeña, la justa para
 *    su contenido, y se amplía hasta aprovechar la pantalla.
 *
 * Ampliar solo consume espacio que la presentación deja vacío: nunca hace que
 * algo que cabía deje de caber ni obliga a desplazarse donde antes no hacía
 * falta. Si una lámina no cabe ampliada, la ampliación se rebaja para toda la
 * presentación, de modo que todas sus láminas se ven al mismo tamaño.
 *
 * El puente mide dentro de la presentación (`LayoutReport`) y aquí se decide.
 * Lo aprendido de cada presentación —el ancho de su columna, lo que necesita
 * a lo ancho y a lo alto— se guarda en un modelo que no depende del tamaño de
 * la pantalla: por eso el ajuste es inmediato al cambiar la ventana o entrar
 * en modo presentación, y puede recordarse para la siguiente visita.
 *
 * Lo medido solo crece (cada medida puede pedir más sitio, nunca menos), así
 * que el tamaño converge en pocos pasos y no oscila. Lo único que puede
 * rebajarse es una previsión: el alto que se calcula que pedirán las láminas
 * que aún no se han visto, y solo la corrige una medida a tamaño natural.
 *
 * Este módulo no depende de React ni del DOM: se prueba por separado.
 */

export interface FitBox {
  width: number;
  height: number;
}

/** Lo que ocupa a lo alto una lámina, medido con la ventana del momento. */
export interface SlideMeasure {
  /** Altura que queda vacía: franjas grandes sin nada dibujado. */
  vfree?: number;
  /** Lo que hay que desplazar el documento para ver su contenido. */
  vover?: number;
  /** Lo que el documento mide de más que la ventana, haya o no algo ahí abajo. */
  vdoc?: number;
  /** Lo mismo para su panel principal, si se desplaza por dentro. */
  vin?: number;
  /** Ídem, cuando el panel está en una caja de alto fijo: se desplaza por diseño. */
  vown?: number;
  /** Lo que la ventana o el contenedor principal recortan por abajo. */
  vcut?: number;
  /**
   * Su marco principal tiene un tamaño que no depende de la ventana (una
   * lámina de medidas fijas): si la llena justa es porque mide eso, no porque
   * se acomode a ella.
   */
  firm?: boolean;
}

/** Medidas que envía el puente, en píxeles de la propia presentación. */
export interface LayoutReport extends SlideMeasure {
  /** Ventana con la que se midió. */
  width: number;
  height?: number;
  /** Ancho con el que nada quedaría cortado por los lados (= `width` si cabe). */
  need: number;
  /** Margen libre a cada lado de la columna de contenido; -1 o ausente: no se sabe. */
  side?: number;
  /** Cuánto se adentran en ese margen los controles pegados al borde. */
  edge?: number;
  /** Lámina a la vista (-1 si la presentación no tiene láminas reconocibles). */
  slide?: number;
  /**
   * Las mismas medidas para la lámina más alta de las que no están a la
   * vista, puesta un instante en su lugar. `null`: ninguna pide más alto que
   * la visible. Ausente: no se midió.
   */
  tallest?: SlideMeasure | null;
}

/** Lo aprendido de una presentación, en sus propios píxeles. */
export interface DeckModel {
  /** Ancho mínimo de ventana con el que su columna conserva el tamaño. */
  col: number | null;
  /** Ancho que se ha visto necesario para que nada se corte por los lados. */
  wide: number | null;
  /** Alto que se ha visto necesario para que nada se corte ni se desplace. */
  tall: number | null;
  /**
   * Alto que se calcula que pedirá la lámina más alta, por lo medido de las
   * que no están a la vista. Es una previsión: no se acumula, la sustituye
   * cada medida a tamaño natural, y lo que cuenta es el mayor de los dos.
   */
  ahead: number | null;
  /**
   * Alto de ventana que se le ha visto ocupar entero, sin que sobrara ni
   * faltara nada. En una ventana así no hay qué ampliar. En una más alta no
   * se sabe: puede que su contenido mida justo eso o puede que se acomode a
   * la ventana que le den (y entonces la llenará también, sin ayuda).
   */
  fills: number | null;
  /** Proporción de margen que resultó depender de la ventana (no se amplía). */
  fluid: number | null;
  /**
   * Lo que se desplaza o se recorta dentro de su lámina no depende de la
   * ventana (una lámina de medidas fijas con un panel que se desplaza): no
   * limita la ampliación.
   */
  inner: boolean;
  /**
   * Lo que su documento mide de más que la ventana, sin nada ahí abajo y con
   * cualquier ventana (un `min-height:100vh` más un margen). Viene con la
   * presentación: no es algo que la ampliación haya dejado fuera.
   */
  slack: number;
}

export interface FitView {
  /** Ancho y alto de la ventana que ve la presentación. */
  width: number;
  height: number;
  /** Escala con la que se dibuja (1 = tamaño natural). */
  scale: number;
}

export interface FitState {
  box: FitBox;
  /** `false`: el lector pidió verla a su tamaño natural. */
  enabled: boolean;
  model: DeckModel;
  view: FitView;
  /** La última medida confirmó el tamaño actual. */
  settled: boolean;
  /** Escala que le corresponde con el ajuste activado (1: su tamaño natural). */
  fitted: number;
  /** El contenido se sale a lo ancho y no tiene arreglo: se deja como está. */
  gaveUp: boolean;
  /** Lo que sobresalía a lo ancho antes del último ensanche. */
  over: number;
  /** El tamaño actual es fruto de haber ensanchado para que quepa. */
  widened: boolean;
  /**
   * Primera ampliación, recién aplicada y pendiente de comprobar que sirvió:
   * la ventana que tenía y lo que medía entonces su columna.
   */
  trial: { width: number; col: number } | null;
  /** Ampliaciones intentadas con este marco. */
  tries: number;
  /** Láminas cuyo desborde a lo alto no depende de la ventana: no limitan. */
  scrolls: number[];
  /**
   * Lámina a la que se le está dando más alto: lo que le sobraba (y cuánto de
   * ello era alto de más del documento), con qué alto, y lo que se sabía antes.
   */
  chase: { slide: number; spill: number; whole: number; height: number; base: number | null } | null;
  /** Cambios de tamaño desde la última vez que se partió de cero. */
  changes: number;
}

/** Reducción máxima; por debajo el texto deja de leerse. Igual a MIN_FIT en el puente. */
export const MIN_SCALE = 0.6;
/** Ampliación máxima. */
export const MAX_SCALE = 3;
/**
 * Ventana más pequeña que se le da a una presentación al ampliarla: la de un
 * portátil corriente. Por debajo cambiarían a su disposición de tableta.
 */
export const DESIGN_WIDTH = 1280;
/**
 * Una ampliación menor que esta no compensa: apenas se nota y, como la
 * presentación ya casi llena la pantalla, es la que más veces hay que deshacer
 * al llegar a una lámina algo más alta. Se deja al tamaño natural.
 */
export const MIN_GAIN = 0.08;
/**
 * Ya ampliada, si una lámina obliga a rebajar la ampliación por debajo de ese
 * mínimo, se conserva la que quede: quitarla de golpe sería un salto mayor.
 */
const KEEP_GAIN = 0.02;
/** Un desborde mínimo (una barra de desplazamiento, un borde) no justifica reducir. */
const FIT_TOLERANCE = 1.03;
/** Si dar más sitio no acorta lo que sobra al menos esto, no tiene arreglo. */
const FIT_PROGRESS = 0.85;
/** Margen que se deja a cada lado de la columna al ampliar. */
const GUTTER = 16;
/** Separación mínima entre la columna y un control pegado al borde. */
const EDGE_GAP = 8;
/** Con menos margen que este no hay nada que aprovechar. */
const MIN_MARGIN = 24;
const MIN_MARGIN_RATIO = 0.05;
/** Lo que debe crecer la columna en pantalla para dar por buena una ampliación. */
const TRIAL_GAIN = 0.03;
const TRIAL_SHARE = 0.25;
/** Con esta parte de la altura vacía, un panel que se desplaza lo hace por diseño. */
const INNER_FREE = 0.08;
const MAX_TRIES = 3;
const MAX_CHANGES = 12;

export const EMPTY_MODEL: DeckModel = { col: null, wide: null, tall: null, ahead: null, fills: null, fluid: null, inner: false, slack: 0 };

function natural(box: FitBox): FitView {
  return { width: box.width, height: box.height, scale: 1 };
}

function grow(current: number | null, value: number): number {
  return current === null || value > current ? value : current;
}

function sameView(a: FitView, b: FitView): boolean {
  return Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}

function isFluid(model: DeckModel, ratio: number): boolean {
  return model.fluid !== null && Math.abs(ratio - model.fluid) <= model.fluid * 0.25 + 0.01;
}

function isEmpty(model: DeckModel): boolean {
  return model.col === null && model.wide === null && model.tall === null && model.ahead === null && model.fills === null && model.fluid === null && !model.inner && !(model.slack > 0);
}

/** ¿Hay sitio para ampliar algo en este marco? El puente solo mide el espacio libre si lo hay. */
export function canZoom(box: FitBox): boolean {
  return box.width >= DESIGN_WIDTH * (1 + MIN_GAIN) && box.height > 0;
}

/**
 * ¿Le sirve a la app que el puente mida también la lámina más alta de las que
 * no están a la vista? Esa medida cuesta, y solo se usa a tamaño natural y si
 * ampliar es posible: en este marco o en el mayor que cabe esperar (`screen`,
 * la pantalla completa).
 *   0: no · 1: solo si la lámina a la vista deja margen a los lados · 2: sí.
 */
export function forecastNeed(state: FitState, screen: FitBox | null = null): 0 | 1 | 2 {
  if (state.gaveUp || state.view.scale !== 1 || !canZoom(state.box)) return 0;
  if (state.model.col === null) return 1;
  // Solo sobra si, por lo que ya se ha visto que ocupa, no cabría ampliada ni
  // en el mejor de los marcos.
  return targetView({ ...state.model, ahead: null, fills: null }, bestFrame(state.box, screen)).scale > 1 ? 2 : 0;
}

function bestFrame(box: FitBox, screen: FitBox | null): FitBox {
  return screen ? { width: Math.max(screen.width, box.width), height: Math.max(screen.height, box.height) } : box;
}

/**
 * Alto a partir del cual una lámina ya no cabría ampliada ni en el mejor de
 * los marcos: si la que está a la vista lo alcanza, no hace falta medir más.
 */
export function forecastLimit(box: FitBox, screen: FitBox | null = null): number {
  return Math.round(bestFrame(box, screen).height / (1 + MIN_GAIN));
}

/** Tamaño que corresponde a lo aprendido, para el marco dado. */
export function targetView(model: DeckModel, box: FitBox, minGain: number = MIN_GAIN): FitView {
  const W = box.width;
  const H = box.height;
  if (!(W > 0) || !(H > 0)) return natural(box);

  let width = W;
  if (model.col !== null && canZoom(box)) {
    // Ampliar: la ventana más pequeña en la que cabe lo suyo, a lo ancho y a
    // lo alto. Lo que no cabe a lo alto ni a tamaño natural no la reduce.
    let tall = Math.max(model.tall ?? 0, model.ahead ?? 0);
    if (model.fills !== null) {
      // Ya llenó una ventana así de alta: aquí no hay qué ampliar. En una más
      // alta, sin otra medida de lo que ocupa, hay que verla antes a su tamaño.
      tall = H <= model.fills + 2 || tall === 0 ? H : Math.max(tall, model.fills);
    }
    width = Math.min(W, Math.max(model.col, DESIGN_WIDTH, W / MAX_SCALE, (tall * W) / H));
  }
  // Reducir: solo si algo se corta por los lados.
  if (model.wide !== null && model.wide > width) width = Math.min(model.wide, W / MIN_SCALE);
  // Entre un ajuste inapreciable y ninguno, ninguno.
  if (width <= W && width > W / (1 + minGain)) width = W;
  if (width > W && width <= W + 4) width = W;
  if (width === W) return natural(box);

  width = width < W ? Math.ceil(width) : Math.min(Math.ceil(width), Math.floor(W / MIN_SCALE));
  const scale = W / width;
  return { width, height: H / scale, scale };
}

/**
 * Alto de ventana que pide la lámina más alta de las que no están a la vista,
 * por sus medidas a tamaño natural y con las mismas reglas que la visible.
 * `null`: ocupa la ventana entera sin que nada sobre ni falte.
 */
function needOf(measure: SlideMeasure, model: DeckModel, height: number, box: FitBox): number | null {
  const free = measure.vfree ?? 0;
  const content = measure.vover ?? 0;
  const pushed = content > 2 || free <= 0;
  const outer = pushed ? Math.max(content, (measure.vdoc ?? 0) - model.slack) : content;
  let inner = model.inner || (measure.vown ?? 0) > 2 ? 0 : Math.max(measure.vin ?? 0, measure.vcut ?? 0);
  if (inner > 2 && free >= box.height * INNER_FREE) inner = 0;
  const spill = Math.max(outer, inner);
  if (spill > 2) return Math.ceil(height + spill);
  return free > 0 || measure.firm ? Math.floor(height - free) : null;
}

/** Aplica lo aprendido. `keep`: ya estaba ampliada en este marco (ver KEEP_GAIN). */
function settle(state: FitState, keep = false): FitState {
  const fitted = state.gaveUp ? natural(state.box) : targetView(state.model, state.box, keep ? KEEP_GAIN : MIN_GAIN);
  const view = state.enabled ? fitted : natural(state.box);
  return { ...state, view, fitted: fitted.scale };
}

const FRESH = { gaveUp: false, over: 0, widened: false, trial: null, tries: 0, chase: null, changes: 0, settled: false } as const;

/**
 * Lo aprendido que vale para este marco. El ancho que hizo falta para que
 * nada se cortara solo se conserva como límite de la ampliación: si no cabe
 * en el marco hay que reducir, y eso se mide de nuevo desde el tamaño natural
 * (con otro ancho la presentación puede acomodarse de otra forma).
 */
function modelFor(model: DeckModel | null, box: FitBox): DeckModel {
  if (!model) return { ...EMPTY_MODEL };
  return { ...model, wide: model.wide !== null && model.wide > box.width ? null : model.wide };
}

/** Estado inicial. Con un modelo recordado se parte ya del tamaño ajustado. */
export function createFit(box: FitBox, enabled: boolean, model: DeckModel | null = null): FitState {
  return settle({ ...FRESH, scrolls: [], box, enabled, model: modelFor(model, box), view: natural(box), fitted: 1 });
}

/** El marco cambió de tamaño: lo aprendido sigue valiendo y el ajuste es inmediato. */
export function resizeFit(state: FitState, box: FitBox): FitState {
  if (Math.abs(box.width - state.box.width) < 1 && Math.abs(box.height - state.box.height) < 1) return state;
  return settle({ ...state, ...FRESH, scrolls: [], box, model: modelFor(state.model, box) });
}

/** Activa o desactiva el ajuste (preferencia del lector). */
export function enableFit(state: FitState, enabled: boolean): FitState {
  if (state.enabled === enabled) return state;
  return settle({ ...state, ...FRESH, scrolls: [], enabled });
}

/** Olvida lo aprendido (las medidas dejaron de valer) y vuelve al tamaño natural. */
export function resetFit(state: FitState): FitState {
  return createFit(state.box, state.enabled, null);
}

/** Incorpora una medida del puente. Devuelve el mismo objeto si no le concierne. */
export function reportFit(state: FitState, report: LayoutReport): FitState {
  const { box } = state;
  const need = Number(report.need);
  const width = Number(report.width);
  const measuredHeight = Number(report.height);
  const height = measuredHeight > 0 ? measuredHeight : state.view.height;
  if (!(need > 0) || !(width > 0) || !(box.width > 0) || state.gaveUp) return state;
  // Medida tomada con otro tamaño: llegó tarde, tras un cambio.
  if (Math.abs(width - state.view.width) > 2) return state;
  if (measuredHeight > 0 && Math.abs(measuredHeight - state.view.height) > 2) return state;

  const model: DeckModel = { ...state.model };
  let { over, widened, trial, scrolls, chase } = state;
  const { tries } = state;
  const side = typeof report.side === 'number' && report.side >= 0 ? report.side : null;
  const zoomed = state.view.scale > 1;

  // ¿Sirvió la ampliación recién aplicada? Si la columna no creció en pantalla
  // es que su margen depende de la ventana (un `80vw`, un relleno en %): no
  // tiene sentido ampliarla y se vuelve a como estaba, sin aprender nada más
  // de esta medida, tomada con una ventana que se descarta.
  if (trial) {
    const expected = trial.width / width;
    const before = trial.col / trial.width;
    const now = side === null ? 0 : (width - 2 * side) / width;
    if (now < before * (1 + Math.max(TRIAL_GAIN, TRIAL_SHARE * (expected - 1)))) {
      const fluid = (trial.width - trial.col) / 2 / trial.width;
      const back = settle({ ...state, model: { ...model, col: null, fluid }, trial: null, chase: null });
      return { ...back, settled: false, changes: state.changes + 1 };
    }
    trial = null;
  }

  // A lo ancho: lo que se corta manda.
  if (need > width * FIT_TOLERANCE) {
    const excess = need - width;
    if (widened && excess >= over * FIT_PROGRESS) {
      // Ensanchar no acortó lo que sobresale: mide según la ventana (un
      // `97vw` más relleno) y nunca cabrá. Se deja a su tamaño natural.
      const stuck: FitState = { ...state, model: { ...model, wide: null }, gaveUp: true, over: 0, widened: false, trial: null, chase: null };
      return { ...settle(stuck), settled: true };
    }
    model.wide = grow(model.wide, Math.ceil(need));
  } else {
    over = 0;
    widened = false;
  }

  // A lo alto. Lo que el documento hay que desplazar depende de la ventana;
  // lo que se desplaza o se recorta dentro de la lámina puede ser cosa suya.
  const slide = typeof report.slide === 'number' ? report.slide : -1;
  if ((report.vown ?? 0) > 2) model.inner = true;
  // Un documento más alto que la ventana sin nada ahí abajo puede ser dos
  // cosas. Si su contenido llega hasta el pie de la ventana, lo empuja él: es
  // su propio relleno y hace falta ese alto. Si queda altura libre, es una
  // caja del alto de la ventana desplazada (un `min-height:100vh` más un
  // margen) y seguiría ahí con cualquier ventana: a tamaño natural no cuenta.
  // Ampliada cuenta siempre (asomaría una barra de desplazamiento), salvo el
  // alto de más que ya se sabe que viene con ella.
  const content = report.vover ?? 0;
  const whole = report.vdoc ?? 0;
  const filled = side !== null && typeof report.vfree === 'number' && report.vfree <= 0;
  const pushed = zoomed || content > 2 || filled;
  const outer = scrolls.includes(slide) ? 0 : pushed ? Math.max(content, whole - model.slack) : content;
  const inner = model.inner ? 0 : Math.max(report.vin ?? 0, report.vcut ?? 0);
  let spill = Math.max(outer, inner);
  if (!zoomed) {
    if (inner > 2 && (report.vfree ?? 0) >= box.height * INNER_FREE) {
      // Sobra altura y aun así su panel se desplaza: lo hace por diseño.
      model.inner = true;
      if (chase) model.tall = chase.base;
      spill = outer;
    }
    if (spill > 2) {
      // A tamaño natural ya no cabe: ampliarla lo empeoraría.
      model.tall = grow(model.tall, Math.ceil(height + spill));
    } else if (side !== null && typeof report.vfree === 'number') {
      // Cabe. Si deja franjas vacías, lo que ocupa es un hecho. Si llena la
      // ventana justa también lo es cuando su tamaño no depende de ella; si
      // no, solo se sabe eso: que una así la llena.
      if (report.vfree > 0 || report.firm) model.tall = grow(model.tall, Math.floor(height - report.vfree));
      else model.fills = grow(model.fills, Math.floor(height));
    }
    // Lo que pedirá la más alta de las demás es una previsión, y esta medida
    // (si la trae) la renueva: no se acumula con las anteriores.
    if (side !== null && report.tallest !== undefined) {
      model.ahead = report.tallest ? needOf(report.tallest, model, height, box) : null;
      if (report.tallest && model.ahead === null) model.fills = grow(model.fills, Math.floor(height));
    }
    chase = null;
  } else if (spill <= 2) {
    chase = null;
  } else if (chase && chase.slide === slide && height > chase.height + 1 && spill >= chase.spill * FIT_PROGRESS) {
    // Darle más alto no acortó lo que sobra: no depende de la ventana y
    // seguirá ahí a cualquier tamaño. Se deshace lo concedido. (Un documento
    // que se desplaza dentro de otro da la misma medida por dentro y por
    // fuera: se anotan las dos de una vez.)
    model.tall = chase.base;
    if (inner >= outer) model.inner = true;
    if (inner < outer || (outer > 2 && inner - outer <= 2)) {
      if (content <= 2) model.slack = Math.max(model.slack, whole, chase.whole);
      else scrolls = [...scrolls, slide];
    }
    chase = null;
    spill = 0;
  } else {
    // Cabía (o podría caber) con más alto: se rebaja la ampliación.
    const same = chase !== null && chase.slide === slide;
    if (!same || height > chase!.height + 1) chase = { slide, spill, whole: same ? Math.max(whole, chase!.whole) : whole, height, base: same ? chase!.base : state.model.tall };
    model.tall = grow(model.tall, Math.ceil(Math.min(height + spill, box.height)));
  }

  // Margen libre a los lados: el ancho mínimo con el que la columna no cambia.
  const kept = model.col;
  if (side !== null && side >= Math.max(MIN_MARGIN, width * MIN_MARGIN_RATIO) && !isFluid(model, side / width)) {
    const edge = typeof report.edge === 'number' && report.edge > 0 ? report.edge : 0;
    model.col = grow(model.col, Math.ceil(width - 2 * side + 2 * Math.max(GUTTER, edge + EDGE_GAP)));
  }

  let next = settle({ ...state, model, over, widened, trial, tries, scrolls, chase }, zoomed);
  if (kept === null && model.col !== null && side !== null && next.view.width < state.view.width && !sameView(next.view, state.view)) {
    // Primera ampliación: se acaba de medir su columna. Se prueba, si quedan
    // intentos, y la siguiente medida dirá si sirvió.
    if (tries < MAX_TRIES && state.changes < MAX_CHANGES) {
      return { ...next, trial: { width, col: width - 2 * side }, tries: tries + 1, settled: false, changes: state.changes + 1 };
    }
    next = settle({ ...next, model: { ...model, col: null } }, zoomed);
  }
  // (Si se amplía sin columna nueva es que se deshace un alto concedido en
  // vano: se vuelve a un tamaño que ya estaba comprobado, sin más pruebas.)
  if (sameView(next.view, state.view) || state.changes >= MAX_CHANGES) {
    // (El tope no debería alcanzarse: el modelo solo crece.)
    return { ...next, view: state.view, settled: true };
  }
  // Se ensancha para que quepa: la siguiente medida dirá si sirvió.
  if (need > width * FIT_TOLERANCE && next.view.width > state.view.width) next = { ...next, widened: true, over: need - width };
  return { ...next, settled: false, changes: state.changes + 1 };
}

/* ------------------------------------------------------------------ */
/* Memoria entre visitas                                               */
/* ------------------------------------------------------------------ */

const MEMORY_KEY = 'sys.tamanos';
const MEMORY_LIMIT = 240;
/**
 * Lo recordado caduca: una medida tomada en mal momento (a media animación,
 * con la pestaña recién abierta) no debe condicionar la presentación para
 * siempre. Pasado este plazo se vuelve a medir desde cero.
 */
const MEMORY_DAYS = 21;
const DAY = 86_400_000;

type Stored = Record<string, number[]>;

function readMemory(): Stored {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

function pack(value: number | null): number {
  return value === null ? 0 : Math.round(value * 1000) / 1000;
}

function unpack(value: unknown): number | null {
  return typeof value === 'number' && value > 0 && Number.isFinite(value) ? value : null;
}

/** Lo que se aprendió de esta presentación en una visita anterior. */
export function recallModel(key: string, now: number = Date.now()): DeckModel | null {
  if (!key) return null;
  const entry = readMemory()[key];
  if (!Array.isArray(entry)) return null;
  const day = unpack(entry[5]);
  if (day === null || Math.floor(now / DAY) - day > MEMORY_DAYS) return null;
  const model: DeckModel = { col: unpack(entry[0]), wide: unpack(entry[1]), tall: unpack(entry[2]), ahead: unpack(entry[7]), fills: unpack(entry[8]), fluid: unpack(entry[3]), inner: entry[4] === 1, slack: unpack(entry[6]) ?? 0 };
  return isEmpty(model) ? null : model;
}

/** Guarda lo aprendido; las presentaciones menos recientes se van olvidando. */
export function rememberModel(key: string, model: DeckModel, now: number = Date.now()): void {
  if (!key) return;
  try {
    const memory = readMemory();
    // Conserva la fecha en que se empezó a aprender: de ahí cuenta el plazo.
    const since = Array.isArray(memory[key]) ? unpack(memory[key][5]) : null;
    delete memory[key];
    if (!isEmpty(model)) {
      memory[key] = [pack(model.col), pack(model.wide), pack(model.tall), pack(model.fluid), model.inner ? 1 : 0, since ?? Math.floor(now / DAY), pack(model.slack), pack(model.ahead), pack(model.fills)];
    }
    const keys = Object.keys(memory);
    for (let i = 0; i < keys.length - MEMORY_LIMIT; i++) delete memory[keys[i]];
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Sin almacenamiento, simplemente se vuelve a medir en cada visita.
  }
}

/** Olvida lo recordado de una presentación. */
export function forgetModel(key: string): void {
  rememberModel(key, EMPTY_MODEL);
}

/** ¿Cambió lo aprendido? (para no escribir en el almacenamiento sin motivo). */
export function sameModel(a: DeckModel, b: DeckModel): boolean {
  return a.col === b.col && a.wide === b.wide && a.tall === b.tall && a.ahead === b.ahead && a.fills === b.fills && a.fluid === b.fluid && a.inner === b.inner && a.slack === b.slack;
}
