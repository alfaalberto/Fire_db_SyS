import { expect, test, type Page } from '@playwright/test';
import { deck, expectHeading, openApp, seedV2 } from './support/app';
import { FakeFirestore } from './support/fake-firestore';
import { sizeCourse } from './support/fixtures-tamano';

// Una pantalla de 1920 × 1080: con el temario abierto, el marco de la
// presentación mide 1616 px de ancho.
test.use({ viewport: { width: 1920, height: 1080 } });

const sizes = () => seedV2(new FakeFirestore(), sizeCourse);
const frame = (page: Page) => page.locator('main iframe');

/** Escala con la que se dibuja la presentación (1 = tamaño natural). */
function scaleOf(page: Page): Promise<number> {
  return frame(page).evaluate((el) => {
    const transform = getComputedStyle(el).transform;
    return transform === 'none' ? 1 : new DOMMatrix(transform).a;
  });
}

/** Espera a que la presentación quede ampliada y devuelve la escala. */
async function zoomed(page: Page, atLeast = 1.1): Promise<number> {
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(atLeast);
  // El tamaño se confirma con una segunda medida; se le da tiempo.
  await page.waitForTimeout(500);
  return scaleOf(page);
}

/** Marco que la app le deja a la presentación, en coordenadas de la página. */
async function frameBox(page: Page) {
  const box = await frame(page).locator('xpath=..').boundingBox();
  return box!;
}

/** Lo que al documento de la presentación le falta por mostrar a lo alto. */
function scrollable(page: Page): Promise<number> {
  return deck(page).locator('html').evaluate((el) => el.scrollHeight - window.innerHeight);
}

test.describe('presentaciones que quedan pequeñas en una pantalla grande', () => {
  test('una lámina de medidas fijas se amplía hasta aprovechar el marco, sin que nada deje de caber', async ({ page }) => {
    await openApp(page, sizes(), '#/t/tam-fija/1');
    await expectHeading(page, 'Lámina fija 1');
    const scale = await zoomed(page, 1.15);
    const box = await frameBox(page);

    // La lámina conserva sus 1200 px propios; lo que crece es cómo se dibuja.
    const stage = (await deck(page).locator('#stage').boundingBox())!;
    expect(Math.abs(stage.width - 1200 * scale)).toBeLessThan(6);
    expect(stage.x).toBeGreaterThanOrEqual(box.x);
    expect(stage.x + stage.width).toBeLessThanOrEqual(box.x + box.width + 1);
    // Ahora ocupa bastante más del marco que los 1200 px de antes.
    expect(stage.width / box.width).toBeGreaterThan(0.85);

    // El pie sigue a la vista y no hay que desplazarse.
    const footer = (await deck(page).locator('footer').boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(box.y + box.height + 1);
    expect(await scrollable(page)).toBeLessThanOrEqual(1);

    // Sus botones siguen respondiendo con la escala aplicada.
    await deck(page).getByRole('button', { name: 'Siguiente' }).click();
    await expectHeading(page, 'Lámina fija 2');
  });

  test('al presentar se ajusta al instante al nuevo marco, sin recargar la presentación', async ({ page }) => {
    await openApp(page, sizes(), '#/t/tam-fija/1');
    await expectHeading(page, 'Lámina fija 1');
    const normal = await zoomed(page, 1.15);
    await deck(page).getByRole('button', { name: 'Siguiente' }).click();
    await expectHeading(page, 'Lámina fija 2');

    await page.getByRole('button', { name: 'Presentar' }).click();
    await expect.poll(() => scaleOf(page)).toBeGreaterThan(normal + 0.05);
    await page.waitForTimeout(500);
    const presenting = await scaleOf(page);
    // Sigue en la lámina en la que iba.
    await expectHeading(page, 'Lámina fija 2');
    const stage = (await deck(page).locator('#stage').boundingBox())!;
    expect(stage.y + stage.height).toBeLessThanOrEqual(1080);
    expect(stage.width).toBeGreaterThan(1500);

    await page.keyboard.press('Escape');
    await expect.poll(() => scaleOf(page)).toBeLessThan(presenting - 0.05);
    await expectHeading(page, 'Lámina fija 2');
  });

  test('cuenta con las láminas más altas: el tamaño no cambia al llegar a ellas', async ({ page }) => {
    await openApp(page, sizes(), '#/t/tam-columna/1');
    await expectHeading(page, 'Tarjeta 1');
    const scale = await zoomed(page);

    await deck(page).getByRole('button', { name: 'Siguiente' }).click();
    await expectHeading(page, 'Tarjeta 2');
    await page.waitForTimeout(1500);
    expect(await scaleOf(page)).toBeCloseTo(scale, 3);
    // La más alta cabe entera.
    const box = await frameBox(page);
    const tall = (await deck(page).locator('#tall').boundingBox())!;
    expect(tall.y + tall.height).toBeLessThanOrEqual(box.y + box.height + 1);
    expect(await scrollable(page)).toBeLessThanOrEqual(1);
  });

  test('si algo añadido después deja de caber, la ampliación se rebaja', async ({ page }) => {
    await openApp(page, sizes(), '#/t/tam-panel/1');
    await expectHeading(page, 'Panel');
    const scale = await zoomed(page, 1.15);
    const panel = deck(page).locator('#panel');
    const inner = () => panel.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(await inner()).toBeLessThanOrEqual(1);

    await deck(page).getByRole('button', { name: 'Añadir un resultado' }).click();
    await expect(deck(page).locator('#added')).toBeVisible();
    await expect.poll(() => scaleOf(page)).toBeLessThan(scale - 0.02);
    // Sigue ampliada, y el panel no necesita desplazarse.
    await expect.poll(inner).toBeLessThanOrEqual(1);
    expect(await scaleOf(page)).toBeGreaterThan(1.05);
  });

  test('lo que aparece más tarde también se mide, y la ampliación se rebaja para que quepa', async ({ page }) => {
    await openApp(page, sizes(), '#/t/tam-tarde/1');
    await expectHeading(page, 'Con retraso');
    // Al principio solo se ve la tarjeta de 1100 px.
    await zoomed(page, 1.2);
    // Al terminar su entrada, la franja de 1440 px tiene que caber.
    await expect.poll(() => scaleOf(page), { timeout: 12_000 }).toBeLessThan(1.15);
    await page.waitForTimeout(500);
    expect(await scaleOf(page)).toBeGreaterThan(1.09);
    const box = await frameBox(page);
    const banner = (await deck(page).locator('#banner').boundingBox())!;
    expect(banner.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(banner.x + banner.width).toBeLessThanOrEqual(box.x + box.width + 1);
  });

  test('un panel que se desplaza por diseño no impide ampliar', async ({ page }) => {
    await openApp(page, sizes(), '#/t/tam-fija/2');
    await expectHeading(page, 'Con panel');
    await zoomed(page, 1.15);
    const notes = deck(page).locator('#notes');
    expect(await notes.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(300);
  });

  test('los controles pegados al borde no quedan tapados', async ({ page }) => {
    await openApp(page, sizes(), '#/t/tam-columna/2');
    await expectHeading(page, 'Con flechas');
    await zoomed(page);
    const card = (await deck(page).locator('#card').boundingBox())!;
    const prev = (await deck(page).locator('#prev').boundingBox())!;
    const next = (await deck(page).locator('#next').boundingBox())!;
    expect(prev.x + prev.width).toBeLessThan(card.x);
    expect(next.x).toBeGreaterThan(card.x + card.width);
  });

  test('las que ya aprovechan la pantalla, o dependen de ella, se dejan como están', async ({ page }) => {
    const db = sizes();
    // Márgenes relativos a la ventana: se prueba, no sirve y se deshace.
    await openApp(page, db, '#/t/tam-natural/1');
    await expectHeading(page, 'Margen relativo');
    await page.waitForTimeout(2200);
    await expect(frame(page)).toHaveCSS('transform', 'none');
    // Y no se ofrece un ajuste que no existe.
    await page.getByRole('button', { name: 'Más opciones' }).click();
    await expect(page.getByRole('menuitem', { name: 'Copiar enlace a este tema' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /tamaño/ })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.goto('/#/t/tam-natural/2');
    await expectHeading(page, 'Tres columnas');
    await page.waitForTimeout(1800);
    await expect(frame(page)).toHaveCSS('transform', 'none');

    // Una página larga se lee desplazándola: ampliarla solo lo alargaría.
    await page.goto('/#/t/tam-natural/3');
    await expectHeading(page, 'Página larga');
    await page.waitForTimeout(1800);
    await expect(frame(page)).toHaveCSS('transform', 'none');
  });

  test('la que se acomoda sola a la ventana no se amplía, tampoco al agrandarla', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await openApp(page, sizes(), '#/t/tam-sola/1');
    await expectHeading(page, 'A la medida');
    await page.waitForTimeout(1800);
    await expect(frame(page)).toHaveCSS('transform', 'none');
    // Una ventana bastante más alta: llenó la anterior, pero eso no dice que
    // mida eso. Se ve a su tamaño, vuelve a llenarla y así se queda.
    await page.setViewportSize({ width: 1920, height: 1200 });
    await page.waitForTimeout(1500);
    await expect(frame(page)).toHaveCSS('transform', 'none');
    const box = await frameBox(page);
    const fit = (await deck(page).locator('#fit').boundingBox())!;
    expect(fit.height).toBeGreaterThan(box.height - 100);

    // Y la que crece con el ancho de la ventana, igual: ya la aprovecha ella.
    await page.goto('/#/t/tam-sola/2');
    await expectHeading(page, 'Con la ventana');
    await page.waitForTimeout(1800);
    await expect(frame(page)).toHaveCSS('transform', 'none');
  });

  test('en una ventana de portátil no hay sitio para ampliar', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await openApp(page, sizes(), '#/t/tam-fija/1');
    await expectHeading(page, 'Lámina fija 1');
    await page.waitForTimeout(1800);
    await expect(frame(page)).toHaveCSS('transform', 'none');
  });

  test('se recuerda entre visitas y el lector puede verla a su tamaño real', async ({ page }) => {
    await openApp(page, sizes(), '#/t/tam-fija/1');
    await expectHeading(page, 'Lámina fija 1');
    const scale = await zoomed(page, 1.15);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('sys.tamanos'))).not.toBeNull();

    // En la siguiente visita aparece ya ampliada, al mismo tamaño.
    await page.reload();
    await expectHeading(page, 'Lámina fija 1');
    expect(await zoomed(page, 1.15)).toBeCloseTo(scale, 2);

    const percent = Math.round(scale * 100);
    await page.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByRole('menuitem', { name: `Ver a tamaño real (ahora al ${percent} %)` }).click();
    await expect(frame(page)).toHaveCSS('transform', 'none');
    const stage = (await deck(page).locator('#stage').boundingBox())!;
    expect(Math.abs(stage.width - 1200)).toBeLessThan(2);

    await page.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByRole('menuitem', { name: 'Ajustar al tamaño de la pantalla' }).click();
    expect(await zoomed(page, 1.15)).toBeCloseTo(scale, 2);
  });
});
