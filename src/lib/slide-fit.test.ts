import { describe, expect, it } from 'vitest';
import { createFit, FIT, nextFit, scaleOf } from './slide-fit';

const desktop = { w: 1920, h: 1080 };
const laptop = { w: 1062, h: 560 };
const phone = { w: 390, h: 760 };

/** Medida en la que todo cabe y no hay nada que ampliar. */
function report(width: number, height: number, extra: Partial<Parameters<typeof nextFit>[1]> = {}) {
  return { width, height, need: width, main: width, nav: false, tall: height, col: 0, ...extra };
}

describe('contenido cortado a lo ancho', () => {
  it('lo que cabe se queda a su tamaño', () => {
    const out = nextFit(createFit(), report(390, 760), phone);
    expect(out.width).toBeNull();
  });

  it('en el teléfono reduce hasta que quepa la barra de botones', () => {
    const first = nextFit(createFit(), report(390, 760, { need: 571 }), phone);
    expect(first.width).toBe(571);
    expect(scaleOf(first.width, phone.w)).toBeCloseTo(0.683, 3);
    // Con el ancho nuevo ya cabe: no cambia más.
    const second = nextFit(first.memory, report(571, 1113), phone);
    expect(second.width).toBe(571);
  });

  it('no reduce por debajo del mínimo', () => {
    const out = nextFit(createFit(), report(390, 760, { need: 1200, main: 1200 }), phone);
    expect(out.width).toBe(Math.floor(390 / FIT.MIN_SCALE));
  });

  it('un desborde mínimo no cuenta', () => {
    expect(nextFit(createFit(), report(1280, 720, { need: 1298, main: 1298 }), { w: 1280, h: 720 }).width).toBeNull();
  });

  it('si agrandar no acorta lo que sobresale, vuelve al tamaño natural y no insiste', () => {
    const box = { w: 480, h: 800 };
    const first = nextFit(createFit(), report(480, 800, { need: 510, main: 510 }), box);
    expect(first.width).toBe(510);
    const second = nextFit(first.memory, report(510, 850, { need: 539, main: 539 }), box);
    expect(second.width).toBeNull();
    expect(second.memory.gaveUp).toBe(true);
    expect(nextFit(second.memory, report(480, 800, { need: 510, main: 510 }), box).width).toBeNull();
  });

  it('ignora una medida tomada con otro ancho', () => {
    const memory = { ...createFit(), width: 571 };
    expect(nextFit(memory, report(390, 760, { need: 900 }), phone).width).toBe(571);
  });
});

describe('barra de botones que se sale en una ventana amplia', () => {
  const cut = { need: 1420, main: 1062 };

  it('no achica toda la presentación por botones secundarios', () => {
    expect(nextFit(createFit(), report(1062, 560, cut), laptop).width).toBeNull();
  });

  it('sí reduce cuando hace falta poco', () => {
    const out = nextFit(createFit(), report(1366, 768, { need: 1420, main: 1366 }), { w: 1366, h: 768 });
    expect(out.width).toBe(1420);
  });

  it('sí reduce cuando quedan fuera los botones de avanzar', () => {
    expect(nextFit(createFit(), report(1062, 560, { ...cut, nav: true }), laptop).width).toBe(1420);
  });

  it('si además se corta el contenido, reduce lo que el contenido necesita', () => {
    const out = nextFit(createFit(), report(1062, 560, { need: 1420, main: 1161 }), laptop);
    expect(out.width).toBe(1161);
  });
});

describe('ampliar lo que deja márgenes', () => {
  it('amplía una página larga hasta que su columna llena el ancho', () => {
    const out = nextFit(createFit(), report(1920, 1080, { col: 1480, tall: 1500 }), desktop);
    expect(out.width).toBe(Math.round(1920 / ((0.96 * 1920) / 1480)));
    expect(scaleOf(out.width, desktop.w)).toBeCloseTo(1.245, 2);
  });

  it('respeta la ampliación máxima', () => {
    const out = nextFit(createFit(), report(1920, 1080, { col: 900, tall: 3000 }), desktop);
    expect(scaleOf(out.width, desktop.w)).toBeCloseTo(FIT.MAX_ZOOM, 2);
  });

  it('no amplía si la ganancia sería inapreciable', () => {
    expect(nextFit(createFit(), report(1616, 890, { col: 1496, tall: 1300 }), { w: 1616, h: 890 }).width).toBeNull();
  });

  it('no amplía una lámina que ya rebasa un poco la pantalla', () => {
    expect(nextFit(createFit(), report(1616, 890, { col: 1076, tall: 916 }), { w: 1616, h: 890 }).width).toBeNull();
  });

  it('una lámina que cabía debe seguir cabiendo: amplía menos', () => {
    const first = nextFit(createFit(), report(1920, 1080, { col: 1280 }), desktop);
    expect(scaleOf(first.width, desktop.w)).toBeCloseTo(1.44, 2);
    // Ampliada, el contenido (917 px) ya no cabe en los 750 px de alto.
    const second = nextFit(first.memory, report(first.width!, 750, { tall: 917 }), desktop);
    const scale = scaleOf(second.width, desktop.w);
    expect(scale).toBeGreaterThan(1.15);
    expect(1080 / scale).toBeGreaterThanOrEqual(917);
    // Con ese tamaño cabe: se queda.
    const third = nextFit(second.memory, report(second.width!, Math.round(1080 / scale), { tall: 917 }), desktop);
    expect(third.width).toBe(second.width);
  });

  it('si ni un poco de ampliación cabe, vuelve al tamaño natural y no lo reintenta', () => {
    const first = nextFit(createFit(), report(1920, 1080, { col: 1280 }), desktop);
    const second = nextFit(first.memory, report(first.width!, 750, { tall: 1060 }), desktop);
    expect(second.width).toBeNull();
    expect(nextFit(second.memory, report(1920, 1080, { col: 1280 }), desktop).width).toBeNull();
  });

  it('si ampliada se corta algo a lo ancho, amplía solo lo que admite', () => {
    const first = nextFit(createFit(), report(1920, 1080, { col: 1280, tall: 2000 }), desktop);
    const second = nextFit(first.memory, report(first.width!, 750, { need: 1424, main: first.width!, tall: 2000 }), desktop);
    expect(second.width).toBe(Math.round(1920 / (1920 / 1424)));
  });

  it('dentro de una presentación la ampliación solo baja', () => {
    const first = nextFit(createFit(), report(1920, 1080, { col: 1480, tall: 1500 }), desktop);
    // Una lámina más justa obliga a bajar…
    const tight = nextFit(first.memory, report(first.width!, 867, { tall: 1000 }), desktop);
    expect(scaleOf(tight.width, desktop.w)).toBeLessThan(scaleOf(first.width, desktop.w));
    // …y una posterior, larga, no la vuelve a subir.
    const later = nextFit(tight.memory, report(tight.width!, Math.round(1080 / scaleOf(tight.width, desktop.w)), { col: 1300, tall: 2500 }), desktop);
    expect(later.width).toBe(tight.width);
  });

  it('una presentación reducida no se amplía', () => {
    const memory = { ...createFit(), width: 571, steps: 1, over: 181 };
    expect(nextFit(memory, report(571, 1113, { col: 300, tall: 3000 }), phone).width).toBe(571);
  });
});
