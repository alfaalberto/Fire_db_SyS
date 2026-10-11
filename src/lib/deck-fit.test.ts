import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DESIGN_WIDTH,
  EMPTY_MODEL,
  canZoom,
  createFit,
  enableFit,
  forgetModel,
  recallModel,
  rememberModel,
  reportFit,
  resetFit,
  resizeFit,
  targetView,
  type DeckModel,
  type FitBox,
  type FitState,
  type LayoutReport,
} from './deck-fit';

/** Una presentación simulada: qué mediría el puente con una ventana dada. */
type Deck = (width: number, height: number) => Omit<LayoutReport, 'width' | 'height'>;

const SCREEN: FitBox = { width: 1920, height: 1080 };
const LAPTOP: FitBox = { width: 1062, height: 560 };
const PHONE: FitBox = { width: 480, height: 800 };

/** Columna de ancho fijo, centrada, con `content` px de contenido a lo alto. */
function capped(column: number, content: number, extra: Partial<LayoutReport> = {}): Deck {
  return (width, height) => ({
    need: width,
    side: Math.max(0, Math.floor((width - column) / 2)),
    edge: 0,
    vfree: Math.max(0, height - content),
    vover: Math.max(0, content - height),
    ...extra,
  });
}

/** Aplica las medidas de `deck` hasta que el tamaño queda confirmado. */
function run(deck: Deck, start: FitState, limit = 20): { state: FitState; changes: number; views: number[] } {
  let state = start;
  let changes = 0;
  const views = [state.view.width];
  for (let i = 0; i < limit; i++) {
    const { width, height } = state.view;
    const next = reportFit(state, { width, height, ...deck(width, height) });
    if (next.view.width !== state.view.width) {
      changes += 1;
      views.push(next.view.width);
    }
    state = next;
    if (state.settled) return { state, changes, views };
  }
  throw new Error(`no converge: ${views.join(' → ')}`);
}

const fit = (deck: Deck, box: FitBox, model: DeckModel | null = null) => run(deck, createFit(box, true, model));

describe('lo que cabe sin margen', () => {
  it('se deja a su tamaño natural', () => {
    const { state, changes } = fit(() => ({ need: 1920, side: 0, vfree: 0, vover: 0 }), SCREEN);
    expect(state.view).toEqual({ width: 1920, height: 1080, scale: 1 });
    expect(state.fitted).toBe(1);
    expect(changes).toBe(0);
  });

  it('sin medidas del espacio libre tampoco se toca', () => {
    const { state } = fit((width) => ({ need: width }), SCREEN);
    expect(state.view.scale).toBe(1);
    expect(state.settled).toBe(true);
  });
});

describe('lo que no cabe a lo ancho', () => {
  const toolbar: Deck = () => ({ need: 550 });

  it('se dibuja con el ancho que necesita y se reduce', () => {
    const { state, changes } = fit(toolbar, PHONE);
    expect(state.view.width).toBe(550);
    expect(state.view.scale).toBeCloseTo(480 / 550, 5);
    expect(state.view.height).toBeCloseTo(800 / (480 / 550), 5);
    expect(state.fitted).toBeCloseTo(0.8727, 4);
    expect(changes).toBe(1);
  });

  it('un desborde mínimo no justifica reducir', () => {
    const { state } = fit(() => ({ need: 492 }), PHONE);
    expect(state.view.scale).toBe(1);
    expect(state.fitted).toBe(1);
  });

  it('no reduce por debajo del mínimo legible', () => {
    const { state } = fit(() => ({ need: 2000 }), PHONE);
    expect(state.view.width).toBe(800);
    expect(state.view.scale).toBeCloseTo(0.6, 5);
  });

  it('lo que mide según la ventana no se persigue: queda a su tamaño', () => {
    const { state } = fit((width) => ({ need: Math.ceil(width * 0.97 + 44) }), PHONE);
    expect(state.gaveUp).toBe(true);
    expect(state.view.scale).toBe(1);
    expect(state.fitted).toBe(1);
    expect(state.model.wide).toBeNull();
  });

  it('con el ajuste desactivado se ofrece pero no se aplica', () => {
    const { state } = run(toolbar, createFit(PHONE, false));
    expect(state.view.scale).toBe(1);
    expect(state.fitted).toBeCloseTo(0.8727, 4);
    const on = run(toolbar, enableFit(state, true));
    expect(on.state.view.width).toBe(550);
  });

  it('una medida tomada con otro tamaño se ignora', () => {
    const state = createFit(PHONE, true);
    expect(reportFit(state, { width: 900, height: 800, need: 1400 })).toBe(state);
    expect(reportFit(state, { width: 480, height: 500, need: 1400 })).toBe(state);
  });

  it('tras caber, una lámina más ancha vuelve a ensanchar sin darse por vencida', () => {
    let wide = 550;
    const deck: Deck = () => ({ need: wide });
    const first = fit(deck, PHONE);
    wide = 620;
    const second = run(deck, first.state);
    expect(second.state.gaveUp).toBe(false);
    expect(second.state.view.width).toBe(620);
  });
});

describe('lo que queda pequeño', () => {
  it('se amplía hasta donde llega su columna', () => {
    const { state, changes } = fit(capped(1500, 600), SCREEN);
    // 1500 px de columna más 16 px de margen a cada lado.
    expect(state.view.width).toBe(1532);
    expect(state.view.scale).toBeCloseTo(1920 / 1532, 5);
    expect(state.view.height).toBeCloseTo(1080 / (1920 / 1532), 5);
    expect(changes).toBe(1);
  });

  it('o hasta donde llega su contenido a lo alto', () => {
    const { state } = fit(capped(1200, 800), SCREEN);
    // 800 px de contenido en un marco 16:9 piden 1423 px de ancho.
    expect(state.view.width).toBe(Math.ceil((800 * 1920) / 1080));
    expect(state.view.height).toBeGreaterThanOrEqual(800);
  });

  it('nunca le da una ventana más pequeña que la de un portátil', () => {
    const { state } = fit(capped(900, 400), SCREEN);
    expect(state.view.width).toBe(DESIGN_WIDTH);
    expect(state.view.scale).toBeCloseTo(1.5, 5);
  });

  it('en un marco sin sitio no hay nada que ampliar', () => {
    expect(canZoom(LAPTOP)).toBe(false);
    const { state } = fit(capped(800, 300), LAPTOP);
    expect(state.view.scale).toBe(1);
    expect(state.fitted).toBe(1);
  });

  it('una ganancia inapreciable no compensa', () => {
    const { state, changes } = fit(capped(1800, 300), SCREEN);
    expect(state.view.scale).toBe(1);
    expect(changes).toBe(0);
  });

  it('con poco margen no se intenta', () => {
    const { state, changes } = fit((width, height) => ({ need: width, side: 60, vfree: height - 300, vover: 0 }), SCREEN);
    expect(state.view.scale).toBe(1);
    expect(changes).toBe(0);
  });

  it('deja sitio a los controles pegados al borde', () => {
    const { state } = fit(capped(1300, 500, { edge: 60 }), SCREEN);
    // 60 px del control más 8 de separación, a cada lado.
    expect(state.view.width).toBe(1300 + 2 * 68);
  });

  it('si el margen depende de la ventana, ampliar no sirve y se deshace', () => {
    const fluid: Deck = (width, height) => ({ need: width, side: Math.floor(width * 0.1), vfree: height - 300, vover: 0 });
    const { state, changes, views } = fit(fluid, SCREEN);
    expect(views).toEqual([1920, 1568, 1920]);
    expect(changes).toBe(2);
    expect(state.view.scale).toBe(1);
    expect(state.model.col).toBeNull();
    expect(state.model.fluid).toBeCloseTo(0.1, 3);
    // Y no se vuelve a intentar con el mismo margen.
    expect(run(fluid, { ...state, settled: false }).changes).toBe(0);
  });

  it('una columna que solo cede en parte se da por buena', () => {
    // Ocupa el 89 % de la ventana, con tope en 1556 px.
    const partly: Deck = (width, height) => {
      const column = Math.min(1556, Math.floor(width * 0.89));
      return { need: width, side: Math.floor((width - column) / 2), vfree: height - 300, vover: 0 };
    };
    const { state, changes } = fit(partly, SCREEN);
    expect(state.view.width).toBe(1588);
    expect(changes).toBe(1);
  });

  it('con el ajuste desactivado se queda como está, pero se ofrece', () => {
    const { state } = run(capped(1200, 600), createFit(SCREEN, false));
    expect(state.view.scale).toBe(1);
    expect(state.fitted).toBeGreaterThan(1.3);
  });
});

describe('ampliar no hace que nada deje de caber', () => {
  it('si al ampliar el documento se desborda, se rebaja hasta que cabe', () => {
    // La estimación es optimista: dice 600 px y en realidad necesita 900.
    const deck: Deck = (width, height) => ({ need: width, side: Math.floor((width - 1200) / 2), vfree: Math.max(0, height - 600), vover: Math.max(0, 900 - height) });
    const { state, changes } = fit(deck, SCREEN);
    expect(state.view.height).toBeGreaterThanOrEqual(900);
    expect(state.view.width).toBe(1600);
    expect(state.model.tall).toBe(900);
    expect(changes).toBe(2);
  });

  it('lo que ya no cabe a tamaño natural no se amplía', () => {
    const { state, changes } = fit(capped(1200, 1102), SCREEN);
    expect(state.view.scale).toBe(1);
    expect(state.model.tall).toBe(1102);
    expect(changes).toBe(0);
  });

  it('tampoco una página larga: ampliarla obligaría a desplazarse más', () => {
    const { state } = fit(capped(1200, 3400), SCREEN);
    expect(state.view.scale).toBe(1);
  });

  it('cuenta la lámina más alta, aunque no esté a la vista', () => {
    const { state } = fit(capped(1200, 500, { vmore: 300 }), SCREEN);
    expect(state.model.tall).toBe(800);
    expect(state.view.height).toBeGreaterThanOrEqual(800);
  });

  it('una lámina más alta rebaja la ampliación de toda la presentación', () => {
    let content = 500;
    const deck: Deck = (width, height) => ({ ...capped(1200, content)(width, height), slide: content === 500 ? 0 : 1 });
    const first = fit(deck, SCREEN);
    expect(first.state.view.width).toBe(DESIGN_WIDTH);
    content = 850;
    const second = run(deck, { ...first.state, settled: false });
    expect(second.state.view.height).toBeGreaterThanOrEqual(850);
    content = 500;
    // Al volver a la primera se conserva el tamaño: el mismo en todas.
    const third = run(deck, { ...second.state, settled: false });
    expect(third.state.view.width).toBe(second.state.view.width);
    expect(third.changes).toBe(0);
  });

  it('un panel que se desplaza por dentro, si depende de la ventana, también cuenta', () => {
    // El panel ocupa la ventana menos 100 px y su contenido mide 700.
    const deck: Deck = (width, height) => ({ need: width, side: Math.floor((width - 1200) / 2), vfree: Math.max(0, height - 500), vover: 0, vin: Math.max(0, 700 - (height - 100)) });
    const { state } = fit(deck, SCREEN);
    expect(state.view.height).toBeGreaterThanOrEqual(800);
    expect(state.model.inner).toBe(false);
  });

  it('un panel que se desplaza por diseño no limita (a tamaño natural, con altura libre)', () => {
    const deck: Deck = (width, height) => ({ ...capped(1200, 700)(width, height), vin: 120 });
    const { state, changes } = fit(deck, SCREEN);
    expect(state.model.inner).toBe(true);
    expect(state.view.scale).toBeGreaterThan(1.3);
    expect(changes).toBe(1);
  });

  it('ni si lo dice el puente (está en una caja de alto fijo)', () => {
    const deck: Deck = (width, height) => ({ ...capped(1200, 700)(width, height), vown: 120 });
    const { state } = fit(deck, SCREEN);
    expect(state.model.inner).toBe(true);
    expect(state.view.scale).toBeGreaterThan(1.3);
  });

  it('y si aparece ya ampliada, se comprueba una vez y se recuerda', () => {
    let inner = 0;
    const deck: Deck = (width, height) => ({ ...capped(1200, 700)(width, height), vin: inner, slide: inner ? 6 : 0 });
    const first = fit(deck, SCREEN);
    const zoomed = first.state.view.width;
    inner = 47;
    const second = run(deck, { ...first.state, settled: false });
    // Se le dio más alto, no sirvió, y se volvió al tamaño de antes.
    expect(second.views).toHaveLength(3);
    expect(second.state.view.width).toBe(zoomed);
    expect(second.state.model.inner).toBe(true);
    expect(second.state.model.tall).toBe(first.state.model.tall);
    // La próxima vez ya no se prueba.
    expect(run(deck, { ...second.state, settled: false }).changes).toBe(0);
  });

  it('una medida repetida no se toma por un intento fallido', () => {
    const deck: Deck = (width, height) => ({ need: width, side: Math.floor((width - 1200) / 2), vfree: Math.max(0, height - 500), vover: Math.max(0, 760 - height), slide: 0 });
    let state = createFit(SCREEN, true, { ...EMPTY_MODEL, col: 1232 });
    expect(state.view.width).toBe(DESIGN_WIDTH);
    const report = { width: state.view.width, height: state.view.height, ...deck(state.view.width, state.view.height) };
    state = reportFit(state, report);
    const again = reportFit({ ...state, view: { ...state.view } }, { ...report, width: state.view.width, height: state.view.height, vover: 0 });
    expect(again.model.tall).toBe(760);
    expect(again.scrolls).toEqual([]);
  });

  it('un desborde que no depende de la ventana deja de perseguirse', () => {
    // El documento mide siempre 40 px más que la ventana.
    let over = 0;
    const deck: Deck = (width, height) => ({ ...capped(1200, 600)(width, height), vover: over, slide: 3 });
    const first = fit(deck, SCREEN);
    over = 40;
    const second = run(deck, { ...first.state, settled: false });
    expect(second.state.view.width).toBe(first.state.view.width);
    expect(second.state.scrolls).toEqual([3]);
    expect(second.state.model.tall).toBe(first.state.model.tall);
  });
});

describe('lo aprendido', () => {
  it('sirve al cambiar el marco: el ajuste es inmediato', () => {
    const normal = fit(capped(1200, 700), { width: 1616, height: 864 });
    expect(normal.state.view.scale).toBeCloseTo(1616 / Math.ceil((700 * 1616) / 864), 5);
    const full = resizeFit(normal.state, SCREEN);
    expect(full.settled).toBe(false);
    expect(full.view.width).toBe(DESIGN_WIDTH);
    // Y de vuelta a un marco pequeño, a su tamaño natural.
    expect(resizeFit(full, LAPTOP).view.scale).toBe(1);
  });

  it('el mismo marco no cambia nada', () => {
    const state = createFit(SCREEN, true);
    expect(resizeFit(state, { width: 1920, height: 1080 })).toBe(state);
  });

  it('se puede partir de lo recordado', () => {
    const learned = fit(capped(1200, 800), SCREEN).state.model;
    const again = createFit(SCREEN, true, learned);
    expect(again.view.width).toBe(Math.ceil((800 * 1920) / 1080));
    expect(again.settled).toBe(false);
    expect(run(capped(1200, 800), again).changes).toBe(0);
  });

  it('el ancho que hizo falta para no cortar no obliga a reducir en otro marco', () => {
    const model: DeckModel = { ...EMPTY_MODEL, col: 1312, wide: 1419, tall: 891 };
    expect(targetView(model, SCREEN).width).toBe(1584);
    const small = createFit(LAPTOP, true, model);
    expect(small.model.wide).toBeNull();
    expect(small.view.scale).toBe(1);
  });

  it('se olvida al reiniciar', () => {
    const { state } = fit(capped(1200, 800), SCREEN);
    const fresh = resetFit(state);
    expect(fresh.model).toEqual(EMPTY_MODEL);
    expect(fresh.view.scale).toBe(1);
  });
});

describe('memoria entre visitas', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('guarda y recupera lo aprendido', () => {
    const model: DeckModel = { col: 1232, wide: null, tall: 822, fluid: null, inner: true };
    rememberModel('a', model);
    expect(recallModel('a')).toEqual(model);
    expect(recallModel('b')).toBeNull();
    expect(recallModel('')).toBeNull();
  });

  it('no guarda lo que está vacío y sabe olvidar', () => {
    rememberModel('a', EMPTY_MODEL);
    expect(recallModel('a')).toBeNull();
    rememberModel('a', { ...EMPTY_MODEL, fluid: 0.1 });
    expect(recallModel('a')?.fluid).toBeCloseTo(0.1, 5);
    forgetModel('a');
    expect(recallModel('a')).toBeNull();
  });

  it('las menos recientes se van olvidando', () => {
    for (let i = 0; i < 260; i++) rememberModel(`k${i}`, { ...EMPTY_MODEL, col: 1300 });
    expect(recallModel('k0')).toBeNull();
    expect(recallModel('k259')).not.toBeNull();
    expect(Object.keys(JSON.parse(store['sys.tamanos']))).toHaveLength(240);
  });

  it('lo recordado caduca, contando desde que se empezó a aprender', () => {
    const day = 86_400_000;
    const start = 20_000 * day;
    rememberModel('a', { ...EMPTY_MODEL, col: 1300 }, start);
    expect(recallModel('a', start + 20 * day)).not.toBeNull();
    // Actualizarlo no renueva el plazo.
    rememberModel('a', { ...EMPTY_MODEL, col: 1300, tall: 900 }, start + 20 * day);
    expect(recallModel('a', start + 21 * day)?.tall).toBe(900);
    expect(recallModel('a', start + 22 * day)).toBeNull();
    // Olvidado, se empieza de nuevo.
    forgetModel('a');
    rememberModel('a', { ...EMPTY_MODEL, col: 1300 }, start + 22 * day);
    expect(recallModel('a', start + 40 * day)).not.toBeNull();
  });

  it('tolera datos dañados y la falta de almacenamiento', () => {
    const today = Math.floor(Date.now() / 86_400_000);
    store['sys.tamanos'] = '{no es json';
    expect(recallModel('a')).toBeNull();
    store['sys.tamanos'] = JSON.stringify({ a: 'x', b: [1300, 'y', -4, 0, 1, today], c: [1300, 0, 0, 0, 0] });
    expect(recallModel('a')).toBeNull();
    expect(recallModel('b')).toEqual({ col: 1300, wide: null, tall: null, fluid: null, inner: true });
    // Sin fecha no se sabe de cuándo es: no se usa.
    expect(recallModel('c')).toBeNull();
    vi.stubGlobal('localStorage', undefined);
    expect(recallModel('a')).toBeNull();
    expect(() => rememberModel('a', { ...EMPTY_MODEL, col: 1300 })).not.toThrow();
  });
});
