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
  it('amplía un documento largo hasta que su columna llena el ancho', () => {
    const out = nextFit(createFit(), report(1920, 1080, { col: 1480, tall: 2400 }), desktop);
    expect(out.width).toBe(Math.round(1920 / ((0.96 * 1920) / 1480)));
    expect(scaleOf(out.width, desktop.w)).toBeCloseTo(1.245, 2);
  });

  it('respeta la ampliación máxima', () => {
    const out = nextFit(createFit(), report(1920, 1080, { col: 900, tall: 3000 }), desktop);
    expect(scaleOf(out.width, desktop.w)).toBeCloseTo(FIT.MAX_ZOOM, 2);
  });

  it('no amplía si la ganancia sería inapreciable', () => {
    expect(nextFit(createFit(), report(1616, 890, { col: 1496 }), { w: 1616, h: 890 }).width).toBeNull();
  });

  it('no amplía una página que ya rebasa la pantalla', () => {
    expect(nextFit(createFit(), report(1616, 890, { col: 1076, tall: 916 }), { w: 1616, h: 890 }).width).toBeNull();
    // Tampoco la que necesita pantalla y media: ya obliga a desplazarse.
    expect(nextFit(createFit(), report(1920, 1080, { col: 1280, tall: 1600 }), desktop).width).toBeNull();
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
    const first = nextFit(createFit(), report(1920, 1080, { col: 1280, tall: 2400 }), desktop);
    const second = nextFit(first.memory, report(first.width!, 750, { need: 1424, main: first.width!, tall: 2400 }), desktop);
    expect(second.width).toBe(Math.round(1920 / (1920 / 1424)));
  });

  it('mientras se recorre, la ampliación solo baja', () => {
    const first = nextFit(createFit(), report(1920, 1080, { col: 1480, tall: 2400 }), desktop);
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

  it('parte del techo que ya se conocía para la presentación', () => {
    const out = nextFit(createFit(1.2), report(1920, 1080, { col: 1070 }), desktop);
    expect(out.width).toBe(1600);
    // Si el techo conocido ya no deja ampliar, ni lo intenta.
    expect(nextFit(createFit(1), report(1920, 1080, { col: 1070 }), desktop).width).toBeNull();
  });
});

describe('la presentación entera', () => {
  /** Medida con las demás láminas previstas; la que está a la vista es la primera. */
  const deckReport = (width: number, height: number, talls: Array<number | null>, extra: Partial<Parameters<typeof nextFit>[1]> = {}) =>
    report(width, height, { tall: talls[0] ?? height, deck: talls, at: 0, ...extra });

  it('se amplía hasta donde cabe su lámina más alta, no solo la portada', () => {
    // La portada cabe holgada; la tercera lámina ocupa 900 px de los 1080.
    const first = nextFit(createFit(), deckReport(1920, 1080, [1080, 1080, 1080, 1080], { col: 1280 }), desktop);
    expect(first.width).toBe(1333);
    // Ampliada (1333 × 750), la tercera pediría 917 px.
    const second = nextFit(first.memory, deckReport(1333, 750, [750, 750, 917, 760]), desktop);
    const scale = scaleOf(second.width, desktop.w);
    expect(scale).toBeCloseTo((1080 / 917) * 0.995, 2);
    // Con ese tamaño caben todas: no se toca más.
    const third = nextFit(second.memory, deckReport(second.width!, Math.round(1080 / scale), [922, 922, 917, 922]), desktop);
    expect(third.width).toBe(second.width);
  });

  it('si la mayoría de las láminas ya llena la pantalla, no se amplía aunque la portada quepa', () => {
    const out = nextFit(createFit(), deckReport(1920, 1080, [1080, 1210, 1198, 1171, 1300, 1080], { col: 1466 }), desktop);
    expect(out.width).toBeNull();
  });

  it('unas pocas láminas largas no impiden ampliar ni limitan después', () => {
    // Siete de ocho caben; la cuarta ya necesitaba desplazarse 213 px.
    const talls = [1080, 1080, 1080, 1293, 1080, 1080, 1080, 1080];
    const first = nextFit(createFit(), deckReport(1920, 1080, talls, { col: 942 }), desktop);
    expect(first.width).toBe(1280);
    // Ampliada, la larga pide 1293 px (poco más que la pantalla): no manda.
    const second = nextFit(first.memory, deckReport(1280, 720, [720, 720, 720, 1293, 720, 720, 720, 720]), desktop);
    expect(second.width).toBe(1280);
    // Al llegar a ella tampoco se encoge.
    const there = nextFit(second.memory, report(1280, 720, { tall: 1293, deck: [720, 720, 720, 1293, 720, 720, 720, 720], at: 3 }), desktop);
    expect(there.width).toBe(1280);
  });

  it('si una lámina que cabía resulta más alta de lo previsto, baja al llegar a ella', () => {
    const first = nextFit(createFit(), deckReport(1920, 1080, [1080, 1080, 1080], { col: 1280 }), desktop);
    const second = nextFit(first.memory, deckReport(1333, 750, [750, 750, 750]), desktop);
    expect(second.width).toBe(1333);
    // La segunda dibuja una gráfica al activarse y pide 820 px.
    const there = nextFit(second.memory, report(1333, 750, { tall: 820, deck: [750, 820, 750], at: 1 }), desktop);
    expect(scaleOf(there.width, desktop.w)).toBeCloseTo((1080 / 820) * 0.995, 2);
  });

  it('si las láminas se conocen después de ampliar y la mayoría no cabía, vuelve a su tamaño', () => {
    // Al decidir solo se veía una portada que cabe.
    const first = nextFit(createFit(), report(1920, 1080, { col: 1280 }), desktop);
    expect(first.width).toBe(1333);
    const second = nextFit(first.memory, deckReport(1333, 750, [750, 1260, 1345, 1290]), desktop);
    expect(second.width).toBeNull();
  });

  it('y si casi todas cabían, sigue ampliada hasta donde cabe la más alta', () => {
    const first = nextFit(createFit(), report(1920, 1080, { col: 1280 }), desktop);
    const second = nextFit(first.memory, deckReport(1333, 750, [750, 900, 760, 1400]), desktop);
    expect(scaleOf(second.width, desktop.w)).toBeCloseTo((1080 / 900) * 0.995, 2);
  });

  it('lo que no se pudo prever se trata como hasta ahora', () => {
    // Solo se conoce la lámina a la vista: decide ella.
    const out = nextFit(createFit(), deckReport(1920, 1080, [1080, null, null], { col: 1280 }), desktop);
    expect(out.width).toBe(1333);
    expect(nextFit(createFit(), deckReport(1920, 1080, [1140, null, null], { col: 1280 }), desktop).width).toBeNull();
  });
});

describe('puntos de corte del diseño', () => {
  it('no amplía más allá del ancho en el que la presentación cambia de diseño', () => {
    // Con columna de 1070 px pediría 1280; el diseño cambia por debajo de 1537.
    const out = nextFit(createFit(), report(1920, 1080, { col: 1070, floor: 1537 }), desktop);
    expect(out.width).toBe(1537);
  });

  it('si el punto de corte no deja margen, no amplía', () => {
    // Ventana de 1062 px y diseño de tableta por debajo de 1025.
    expect(nextFit(createFit(), report(1062, 600, { col: 760, floor: 1025 }), { w: 1062, h: 600 }).width).toBeNull();
  });

  it('un punto de corte lejano no estorba', () => {
    const out = nextFit(createFit(), report(1920, 1080, { col: 1070, floor: 901 }), desktop);
    expect(out.width).toBe(1280);
  });
});

describe('escenarios de tamaño fijo y paneles con desplazamiento propio', () => {
  it('lo que sobra en un panel aún sin clasificar no impide probar', () => {
    // Rebasa 98 px, pero dentro de un panel que puede no depender de la ventana.
    const first = nextFit(createFit(), report(1920, 1080, { col: 1280, tall: 1178, soft: 98 }), desktop);
    expect(first.width).toBe(1333);
    // Ampliada, el puente ya sabe que es de tamaño fijo y no lo cuenta: se queda.
    const second = nextFit(first.memory, report(1333, 750, { tall: 750 }), desktop);
    expect(second.width).toBe(1333);
  });

  it('si resulta que sí dependía de la ventana, vuelve a su tamaño', () => {
    const first = nextFit(createFit(), report(1920, 1080, { col: 1280, tall: 1140, soft: 60 }), desktop);
    const second = nextFit(first.memory, report(first.width!, 750, { tall: 1160 }), desktop);
    expect(second.width).toBeNull();
  });

  it('lo que rebasa de verdad sí impide ampliar', () => {
    expect(nextFit(createFit(), report(1920, 1080, { col: 1280, tall: 1178, soft: 40 }), desktop).width).toBeNull();
  });

  it('en un solo paso atiende lo que se corta a lo ancho y lo que no cabe a lo alto', () => {
    const first = nextFit(createFit(), report(1920, 1080, { col: 1280 }), desktop);
    // A 1333 px se corta la cabecera (pide 1424) y la página necesita 891 px de alto.
    const second = nextFit(first.memory, report(1333, 750, { need: 1424, main: 1333, tall: 891 }), desktop);
    const scale = scaleOf(second.width, desktop.w);
    expect(scale).toBeCloseTo((1080 / 891) * 0.995, 2);
    expect(second.width!).toBeGreaterThanOrEqual(1424);
  });
});

describe('contenido que se recorta sin poder desplazarse', () => {
  it('lo que ya se recortaba antes de ampliar (un adorno) no cuenta', () => {
    const first = nextFit(createFit(), report(1920, 1080, { col: 1280, clip: 120 }), desktop);
    const second = nextFit(first.memory, report(first.width!, 750, { clip: 120 }), desktop);
    expect(second.width).toBe(first.width);
  });

  it('si al ampliar se recorta más, amplía menos', () => {
    const first = nextFit(createFit(), report(1920, 1080, { col: 1280 }), desktop);
    const second = nextFit(first.memory, report(first.width!, 750, { clip: 90 }), desktop);
    const scale = scaleOf(second.width, desktop.w);
    expect(scale).toBeLessThan(1.44);
    expect(1080 / scale).toBeGreaterThanOrEqual(750 + 90);
  });
});

describe('columnas que miden según la ventana', () => {
  it('si la columna encoge con la ventana, ampliar no sirve: vuelve a su tamaño y no insiste', () => {
    // 60vw: 1152 px con 1920 de ventana, 768 px con 1280.
    const first = nextFit(createFit(), report(1920, 1080, { col: 1152, tall: 2400 }), desktop);
    expect(first.width).toBe(1280);
    const second = nextFit(first.memory, report(1280, 720, { col: 768, tall: 2400 }), desktop);
    expect(second.width).toBeNull();
    expect(nextFit(second.memory, report(1920, 1080, { col: 1152, tall: 2400 }), desktop).width).toBeNull();
  });

  it('una columna de ancho fijo que sigue dejando algo de margen se queda ampliada', () => {
    const first = nextFit(createFit(), report(1920, 1080, { col: 1070, tall: 2400 }), desktop);
    const second = nextFit(first.memory, report(first.width!, 720, { col: 1070, tall: 2400 }), desktop);
    expect(second.width).toBe(first.width);
  });
});
