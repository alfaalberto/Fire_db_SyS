import { expect, test, type Page } from '@playwright/test';
import { deck, expectHeading, openApp, seedV2, signInAsTeacher } from './support/app';
import { FakeFirestore } from './support/fake-firestore';
import { labCourse } from './support/fixtures-despliegue';

const lab = () => seedV2(new FakeFirestore(), labCourse);

/** Repasos de KaTeX hechos dentro de la presentación (ver `spy` en los datos de prueba). */
function calls(page: Page): Promise<number> {
  return deck(page).locator('body').evaluate(() => (window as unknown as { __calls: number }).__calls);
}

test.describe('fórmulas que el archivo deja en crudo', () => {
  test('convierte lo que la configuración de la presentación no reconoce', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-formulas/1');
    await expectHeading(page, 'Submuestreo');
    const doc = deck(page);
    await expect(doc.locator('#inline .katex')).toHaveCount(2);
    await expect(doc.locator('#display .katex-display')).toHaveCount(1);
    // El código de ejemplo se deja como está.
    await expect(doc.locator('#pre')).toHaveText('\\(esto es código\\)');
    await expect(doc.locator('#code')).toHaveText('$x$');
  });

  test('usa el KaTeX de la plataforma si la presentación no trae el suyo', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-formulas/2');
    await expectHeading(page, 'Pitágoras');
    await expect(deck(page).locator('#inline .katex')).toHaveCount(1);
  });

  test('convierte el texto que la presentación añade después', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-formulas/3');
    const doc = deck(page);
    await expect(doc.locator('#first .katex')).toHaveCount(1);
    await doc.getByRole('button', { name: 'Mostrar el resultado' }).click();
    await expect(doc.locator('#result .katex')).toHaveCount(1);
  });

  test('no toca una presentación que se convierte sola', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-formulas/4');
    const doc = deck(page);
    await expect(doc.locator('#inline .katex')).toHaveCount(1);
    await page.waitForTimeout(2200);
    expect(await calls(page)).toBe(1);
    await expect(doc.getByText('Un precio de $5 no es una fórmula.')).toBeVisible();
  });

  test('no insiste con una fórmula que KaTeX no puede convertir', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-formulas/5');
    const doc = deck(page);
    await expectHeading(page, 'Pendiente');
    await expect.poll(() => calls(page)).toBeGreaterThanOrEqual(1);
    const add = async (expected: number) => {
      await doc.getByRole('button', { name: 'Añadir una fórmula' }).click();
      await expect(doc.locator('#result .katex')).toHaveCount(expected);
    };
    await add(1);
    await add(2);
    const settled = await calls(page);
    await add(3);
    await add(4);
    await add(5);
    // Un repaso por cada fórmula nueva; con la que no cierra ya no se insiste.
    expect(await calls(page)).toBe(settled + 3);
    await expect(doc.locator('#open .katex')).toHaveCount(0);
  });

  test('no se adelanta a una presentación que hace su repaso tarde', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-formulas/6');
    const doc = deck(page);
    await expect(doc.locator('#inline .katex')).toHaveCount(2);
    await page.waitForTimeout(1800);
    // Un solo repaso: el de la propia presentación.
    expect(await calls(page)).toBe(1);
  });

  test('lo que convierte respeta las abreviaturas de la presentación', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-formulas/7');
    const doc = deck(page);
    await expect(doc.locator('#first .katex')).toHaveCount(1);
    await doc.getByRole('button', { name: 'Añadir' }).click();
    await expect(doc.locator('#result .katex')).toHaveCount(2);
    await expect(doc.locator('.katex-error')).toHaveCount(0);
  });

  test('avisa a quien edita de que el archivo depende de la plataforma', async ({ page }) => {
    const db = lab();
    await signInAsTeacher(page, db);
    await openApp(page, db, '#/t/lab-formulas/1');
    await page.getByRole('button', { name: 'Docente', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Modo edición' }).click();
    await expect(page.getByText(/3 fórmulas quedan en crudo al abrir el archivo por separado/)).toBeVisible();
    // A los alumnos no se les muestra.
    await page.getByRole('button', { name: 'Editando' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Modo edición' }).click();
    await expect(page.getByText(/quedan en crudo/)).toHaveCount(0);
  });
});

test.describe('presentaciones que no caben a lo ancho', () => {
  const frame = (page: Page) => page.locator('main iframe');

  test('se reduce hasta caber y vuelve a su tamaño cuando hay sitio', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-ancho/1');
    await expectHeading(page, 'Barra ancha');
    // Con la ventana de escritorio cabe: se muestra tal cual.
    await expect(frame(page)).toHaveCSS('transform', 'none');

    await page.setViewportSize({ width: 480, height: 800 });
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(0\.87/);
    const last = await deck(page).locator('#b5').boundingBox();
    expect(last!.x + last!.width).toBeLessThanOrEqual(480);

    await page.setViewportSize({ width: 1366, height: 800 });
    await expect(frame(page)).toHaveCSS('transform', 'none');
  });

  test('un adorno que sobresale no es motivo para reducir', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await openApp(page, lab(), '#/t/lab-ancho/2');
    await expectHeading(page, 'Con adorno');
    await page.waitForTimeout(1500);
    await expect(frame(page)).toHaveCSS('transform', 'none');
  });

  test('las láminas puestas en fila no asoman', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await openApp(page, lab(), '#/t/lab-ancho/3');
    await expectHeading(page, 'Fila 1');
    await page.waitForTimeout(1500);
    await expect(frame(page)).toHaveCSS('transform', 'none');
  });

  test('lo que mide según la ventana no se persigue: queda a su tamaño', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await openApp(page, lab(), '#/t/lab-ancho/4');
    await expectHeading(page, 'Casi cabe');
    await page.waitForTimeout(1800);
    await expect(frame(page)).toHaveCSS('transform', 'none');
  });

  test('una franja de 100vw bajo la barra de desplazamiento no cuenta', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await openApp(page, lab(), '#/t/lab-ancho/5');
    await expectHeading(page, 'Franja completa');
    await page.waitForTimeout(1500);
    await expect(frame(page)).toHaveCSS('transform', 'none');
  });

  test('el lector puede verla a tamaño real y la preferencia se recuerda', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await openApp(page, lab(), '#/t/lab-ancho/1');
    await expectHeading(page, 'Barra ancha');
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(0\.87/);

    await page.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByRole('menuitem', { name: /Ver a tamaño real \(ahora al 87 %\)/ }).click();
    await expect(frame(page)).toHaveCSS('transform', 'none');

    await page.reload();
    await expectHeading(page, 'Barra ancha');
    await page.waitForTimeout(1200);
    await expect(frame(page)).toHaveCSS('transform', 'none');

    await page.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByRole('menuitem', { name: 'Ajustar a la pantalla' }).click();
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(0\.87/);
  });
});

test.describe('presentaciones que dejan márgenes vacíos', () => {
  const frame = (page: Page) => page.locator('main iframe');
  /** Escala aplicada al iframe (1 = tamaño natural). */
  const scaleOf = (page: Page) =>
    frame(page).evaluate((el) => {
      const value = getComputedStyle(el).transform;
      return value === 'none' ? 1 : Number(value.slice(7).split(',')[0]);
    });
  /** La presentación no necesita desplazarse en vertical. */
  const fitsInHeight = (page: Page) =>
    deck(page)
      .locator('body')
      .evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 6);

  test('una página larga en columna estrecha se amplía hasta llenar el ancho', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-tamano/1');
    await expectHeading(page, 'Columna estrecha');
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.3[34]/);
    // La columna queda dentro de la ventana.
    const box = await deck(page).locator('main').boundingBox();
    const outer = await frame(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(outer!.x - 1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(outer!.x + outer!.width + 1);
  });

  test('una lámina corta se amplía y sigue cabiendo', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-tamano/2');
    await expectHeading(page, 'Lámina corta');
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.3[34]/);
    expect(await fitsInHeight(page)).toBe(true);
  });

  test('una lámina que casi llena el alto solo se amplía hasta donde cabe', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-tamano/3');
    await expectHeading(page, 'Lámina justa');
    await expect.poll(() => scaleOf(page)).toBeGreaterThan(1.05);
    await page.waitForTimeout(900);
    const scale = await scaleOf(page);
    expect(scale).toBeGreaterThan(1.05);
    expect(scale).toBeLessThan(1.3);
    expect(await fitsInHeight(page)).toBe(true);
  });

  test('el tamaño es uno para toda la presentación: manda su lámina más alta', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-tamano/4');
    await expectHeading(page, 'Corta');
    // La portada sola admitiría 134 %; la segunda lámina, más alta, no.
    await expect.poll(() => scaleOf(page)).toBeGreaterThan(1.05);
    await page.waitForTimeout(900);
    const opened = await scaleOf(page);
    expect(opened).toBeLessThan(1.3);

    await deck(page).getByRole('button', { name: 'Siguiente' }).click();
    await expectHeading(page, 'Justa');
    await page.waitForTimeout(900);
    expect(await scaleOf(page)).toBeCloseTo(opened, 2);
    expect(await fitsInHeight(page)).toBe(true);

    await deck(page).getByRole('button', { name: 'Anterior' }).click();
    await expectHeading(page, 'Corta');
    await page.waitForTimeout(900);
    expect(await scaleOf(page)).toBeCloseTo(opened, 2);
  });

  test('el lector puede volver al tamaño real', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-tamano/1');
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.3[34]/);
    await page.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByRole('menuitem', { name: /Ver a tamaño real \(ahora al 134 %\)/ }).click();
    await expect(frame(page)).toHaveCSS('transform', 'none');
  });

  test('en el escritorio, una cabecera que se sale no achica toda la presentación', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-tamano/5');
    await expectHeading(page, 'Cabecera larga');
    await page.waitForTimeout(1500);
    await expect(frame(page)).toHaveCSS('transform', 'none');
  });

  test('pero sí la reduce si lo que queda fuera es el botón de avanzar', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-tamano/6');
    await expectHeading(page, 'Avance cortado');
    await expect.poll(() => scaleOf(page)).toBeLessThan(0.75);
    const next = await deck(page).getByRole('button', { name: 'Siguiente' }).boundingBox();
    const outer = await frame(page).boundingBox();
    expect(next!.x + next!.width).toBeLessThanOrEqual(outer!.x + outer!.width + 1);
  });
});

test.describe('ampliar sin estropear la presentación', () => {
  const frame = (page: Page) => page.locator('main iframe');
  const scaleOf = (page: Page) =>
    frame(page).evaluate((el) => {
      const value = getComputedStyle(el).transform;
      return value === 'none' ? 1 : Number(value.slice(7).split(',')[0]);
    });
  /** Dentro de la presentación: ¿cabe `selector` entero en la ventana? */
  const insideWindow = (page: Page, selector: string) =>
    deck(page)
      .locator(selector)
      .evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= window.innerHeight + 1 && box.left >= 0 && box.right <= window.innerWidth + 1;
      });

  test('un escenario de tamaño fijo se amplía y sus láminas largas no le quitan la ampliación', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-escenario/1');
    await expectHeading(page, 'Portada');
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.4/);
    // Escenario, cabecera y pie siguen a la vista.
    expect(await insideWindow(page, '.stage')).toBe(true);
    expect(await insideWindow(page, '#btn-next')).toBe(true);

    // La segunda lámina se desplaza por dentro del escenario, ampliada o no.
    await deck(page).getByRole('button', { name: 'Siguiente' }).click();
    await expectHeading(page, 'Lámina larga');
    await page.waitForTimeout(1200);
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.4/);
  });

  test('también cuando ya la primera lámina se desplaza por dentro', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-escenario/2');
    await expectHeading(page, 'Casi cabe');
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.4/);
    expect(await insideWindow(page, '.stage')).toBe(true);
  });

  test('no cruza el punto de corte en el que la presentación pasa a su diseño de tableta', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-escenario/3');
    await expectHeading(page, 'Con punto de corte');
    // Llenar el ancho pediría 134 %; el diseño cambia por debajo de 901 px.
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.1[78]/);
    const mode = await deck(page)
      .locator('#mode')
      .evaluate((el) => getComputedStyle(el, '::after').content);
    expect(mode).toBe('"escritorio"');
  });

  test('ni el que consulta su código con matchMedia', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-escenario/4');
    await expectHeading(page, 'Corte en el código');
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.1[01]/);
    await expect(deck(page).locator('#mode')).toHaveText('escritorio');
  });

  test('si el escenario recorta lo que no cabe, amplía solo hasta donde no se pierde nada', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-escenario/5');
    await expectHeading(page, 'Escenario que recorta');
    await expect.poll(() => scaleOf(page)).toBeGreaterThan(1.05);
    await page.waitForTimeout(900);
    const scale = await scaleOf(page);
    expect(scale).toBeGreaterThan(1.05);
    expect(scale).toBeLessThan(1.3);
    expect(await insideWindow(page, '#last')).toBe(true);
  });

  test('una columna que mide según la ventana se queda a su tamaño', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-escenario/6');
    await expectHeading(page, 'Columna en vw');
    await page.waitForTimeout(1800);
    await expect(frame(page)).toHaveCSS('transform', 'none');
  });
});

test.describe('el tamaño se decide para la presentación entera', () => {
  const frame = (page: Page) => page.locator('main iframe');
  const scaleOf = (page: Page) =>
    frame(page).evaluate((el) => {
      const value = getComputedStyle(el).transform;
      return value === 'none' ? 1 : Number(value.slice(7).split(',')[0]);
    });

  test('no amplía la portada si las demás láminas ya llenan la pantalla', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-conjunto/1');
    await expectHeading(page, 'Portada');
    await page.waitForTimeout(1800);
    await expect(frame(page)).toHaveCSS('transform', 'none');
    // Y prever las demás láminas no las dejó a la vista ni movió la activa.
    await expect(deck(page).locator('.slide:visible')).toHaveCount(1);
    await expect(deck(page).locator('.slide').first()).not.toHaveAttribute('style');
  });

  test('una lámina larga entre varias que caben no impide ampliar ni encoge al llegar a ella', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-conjunto/2');
    await expectHeading(page, 'Primera');
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.3[34]/);
    await deck(page).getByRole('button', { name: 'Siguiente' }).click();
    await expectHeading(page, 'La larga');
    await page.waitForTimeout(1200);
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.3[34]/);
  });

  test('prever las demás láminas no mueve la página, no quita el foco ni deja rastro', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-conjunto/2');
    await expectHeading(page, 'Primera');
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.3[34]/);
    await deck(page).getByRole('button', { name: 'Siguiente' }).click();
    await expectHeading(page, 'La larga');
    await deck(page).locator('#campo').focus();
    await deck(page).locator('body').evaluate(() => window.scrollTo(0, 300));

    // Con otro sitio disponible el tamaño se decide de nuevo, y con él se
    // vuelven a prever las demás láminas, ahora desde una lámina desplazada.
    await page.setViewportSize({ width: 1330, height: 800 });
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.[23]/);
    await page.waitForTimeout(900);
    const state = await deck(page)
      .locator('body')
      .evaluate(() => ({
        scrolled: window.scrollY > 150,
        focus: document.activeElement ? document.activeElement.id : '',
        classes: [].slice.call(document.querySelectorAll('.slide')).map((el: Element) => el.className),
        styled: document.querySelectorAll('.slide[style]').length,
      }));
    expect(state).toEqual({ scrolled: true, focus: 'campo', classes: ['slide', 'slide active', 'slide', 'slide'], styled: 0 });
  });

  test('si una lámina resulta más alta de lo previsto, la ampliación baja al llegar y ya no sube', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-conjunto/3');
    await expectHeading(page, 'Corta');
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(1\.3[34]/);

    await deck(page).getByRole('button', { name: 'Siguiente' }).click();
    await expectHeading(page, 'Tardía');
    await expect.poll(() => scaleOf(page)).toBeLessThan(1.3);
    await page.waitForTimeout(900);
    const tight = await scaleOf(page);
    expect(tight).toBeGreaterThan(1.05);
    const fits = await deck(page)
      .locator('body')
      .evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 6);
    expect(fits).toBe(true);

    await deck(page).getByRole('button', { name: 'Anterior' }).click();
    await expectHeading(page, 'Corta');
    await page.waitForTimeout(900);
    expect(await scaleOf(page)).toBeCloseTo(tight, 2);
  });
});

test.describe('páginas sin láminas en modo presentación', () => {
  test('la flecha lleva a la siguiente presentación, o a la siguiente lámina si la página responde', async ({ page }) => {
    await openApp(page, lab(), '#/t/lab-unica/1');
    await expectHeading(page, 'Laboratorio');
    await page.getByRole('button', { name: 'Presentar' }).click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('IFRAME');

    // Laboratorio con botón «siguiente»: no se pulsa, se pasa de presentación.
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'Lienzo');
    // Teclado propio que solo mueve un lienzo: tampoco retiene la flecha.
    await page.keyboard.press('PageDown');
    await expectHeading(page, 'Página 1');
    // Láminas redibujadas: la página responde y se queda en ella…
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'Página 2');
    // …hasta que deja de responder.
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'Cierre');
  });
});
