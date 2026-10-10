import { expect, test } from '@playwright/test';
import { deck, expectHeading, openApp, seedV2 } from './support/app';
import { FakeFirestore } from './support/fake-firestore';
import { labCourse } from './support/fixtures-despliegue';

test.describe('en el teléfono', () => {
  test('el temario es un panel deslizable que se cierra al elegir un tema', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()));
    const sidebar = page.getByRole('complementary', { name: 'Temario del curso' });
    await expect(page.getByRole('heading', { level: 1, name: 'Señales y Sistemas' })).toBeVisible();
    await expect(sidebar).toBeHidden();

    await page.getByRole('button', { name: 'Mostrar el temario' }).click();
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole('button', { name: /^1 Señales y Sistemas/ }).click();
    await sidebar.getByRole('button', { name: /1\.2 Señales continuas y discretas/ }).click();

    await expect(sidebar).toBeHidden();
    await expectHeading(page, 'A1');
  });

  test('la portada no se desborda a lo ancho', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()));
    await expect(page.getByText('11 presentaciones en 5 de 7 temas.')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('la barra del tema cabe en la pantalla', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap1-senales');
    await expectHeading(page, 'A1');
    const present = page.getByRole('button', { name: 'Presentar' });
    await expect(present).toBeVisible();
    const box = await present.boundingBox();
    const width = page.viewportSize()!.width;
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  });

  test('una presentación con barra ancha se reduce para que sus botones queden a la vista', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore(), labCourse), '#/t/lab-ancho/1');
    await expectHeading(page, 'Barra ancha');
    const width = page.viewportSize()!.width;
    await expect(page.locator('main iframe')).toHaveCSS('transform', /^matrix\(0\.7/);
    const last = await deck(page).locator('#b5').boundingBox();
    expect(last!.x + last!.width).toBeLessThanOrEqual(width);
    // Los botones siguen respondiendo con la escala aplicada.
    await deck(page).locator('#b5').click();
  });
});
