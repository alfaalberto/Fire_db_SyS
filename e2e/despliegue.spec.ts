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
    await page.getByRole('menuitem', { name: 'Ajustar al ancho de la pantalla' }).click();
    await expect(frame(page)).toHaveCSS('transform', /^matrix\(0\.87/);
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
