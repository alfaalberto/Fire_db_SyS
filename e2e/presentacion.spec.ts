import { expect, test, type Page } from '@playwright/test';
import { deck, expectHeading, openApp, seedV2 } from './support/app';
import { FakeFirestore } from './support/fake-firestore';

async function present(page: Page, hash: string, first: string): Promise<void> {
  await openApp(page, seedV2(new FakeFirestore()), hash);
  await expectHeading(page, first);
  await page.getByRole('button', { name: 'Presentar' }).click();
  await expect(page.getByRole('toolbar', { name: 'Controles de la presentación' })).toBeAttached();
  // El teclado debe llegar a la presentación sin tener que hacer clic en ella.
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('IFRAME');
}

test.describe('modo presentación', () => {
  test('las flechas recorren las láminas y al terminar pasan a la siguiente presentación', async ({ page }) => {
    await present(page, '#/t/cap1-senales', 'A1');
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'A2');
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'A3');
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'B1');
    await expect(page).toHaveURL(/#\/t\/cap1-senales\/2$/);
    await expect(page.getByText('Presentación 2 de 3: Deck B · Convolución periódica')).toBeVisible();
  });

  test('una presentación que da la vuelta no regresa al inicio: sigue con la próxima', async ({ page }) => {
    await present(page, '#/t/cap1-senales/2', 'B1');
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'B2');
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'C1');
  });

  test('si solo tiene botones, las flechas los pulsan; al final salta al siguiente tema con contenido', async ({ page }) => {
    await present(page, '#/t/cap1-senales/3', 'C1');
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'C2');
    await page.keyboard.press('ArrowLeft');
    await expectHeading(page, 'C1');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'C3');
    await page.keyboard.press('ArrowRight');
    // 1.3 no tiene presentaciones: se omite y se abre 1.4.
    await expectHeading(page, 'D');
    await expect(page).toHaveURL(/#\/t\/cap1-doc$/);
  });

  test('un documento sin láminas avanza directo a la siguiente presentación', async ({ page }) => {
    await present(page, '#/t/cap1-doc', 'D');
    await page.keyboard.press('ArrowRight');
    await expect(deck(page).getByRole('heading', { name: 'Fragmento suelto' })).toBeVisible();
  });

  test('RePág/AvPág (presentador inalámbrico) funcionan aunque la presentación solo entienda flechas', async ({ page }) => {
    await present(page, '#/t/cap1-intro', 'A1');
    await page.keyboard.press('PageDown');
    await expectHeading(page, 'A2');
    await page.keyboard.press('PageUp');
    await expectHeading(page, 'A1');
  });

  test('retroceder en la primera lámina vuelve a la presentación anterior', async ({ page }) => {
    await present(page, '#/t/cap1-senales/2', 'B1');
    await page.keyboard.press('ArrowLeft');
    await expectHeading(page, 'A1');
    await expect(page).toHaveURL(/#\/t\/cap1-senales$/);
  });

  test('en la última lámina primero se revelan los pasos pendientes', async ({ page }) => {
    await present(page, '#/t/cap2-pasos', 'G1');
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'G2');
    await expect(deck(page).getByTestId('step')).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(deck(page).getByTestId('step')).toBeVisible();
    await expectHeading(page, 'G2');
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'A1');
  });

  test('Ctrl + flecha cambia de presentación sin recorrer las láminas', async ({ page }) => {
    await present(page, '#/t/cap1-senales', 'A1');
    await page.keyboard.press('Control+ArrowRight');
    await expectHeading(page, 'B1');
    await page.keyboard.press('Control+ArrowLeft');
    await expectHeading(page, 'A1');
  });

  test('entrar y salir no reinicia la presentación', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap1-intro');
    await expectHeading(page, 'A1');
    await deck(page).getByRole('button', { name: 'Sig ▶' }).click();
    await expectHeading(page, 'A2');

    await page.getByRole('button', { name: 'Presentar' }).click();
    await expect(page.getByRole('toolbar', { name: 'Controles de la presentación' })).toBeAttached();
    await expectHeading(page, 'A2');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Presentar' })).toBeVisible();
    await expectHeading(page, 'A2');
  });

  test('las teclas también funcionan con el foco fuera de la presentación', async ({ page }) => {
    await present(page, '#/t/cap1-intro', 'A1');
    await page.getByRole('button', { name: 'Mostrar controles' }).click();
    await page.getByRole('button', { name: /pantalla completa/i }).focus();
    await page.keyboard.press('ArrowRight');
    await expectHeading(page, 'A2');
    await page.keyboard.press('PageDown');
    await expectHeading(page, 'A3');
  });

  test('los controles permiten cambiar de presentación y terminar', async ({ page }) => {
    await present(page, '#/t/cap1-senales', 'A1');
    await page.getByRole('button', { name: 'Mostrar controles' }).click();
    const bar = page.getByRole('toolbar', { name: 'Controles de la presentación' });
    await expect(bar).toContainText('Presentación 1 de 3 en 1.2 Señales continuas y discretas');
    await expect(bar).toContainText('1 / 3');
    await bar.getByTitle(/Presentación siguiente/).click();
    await expectHeading(page, 'B1');
    await bar.getByTitle(/Terminar la presentación/).click();
    await expect(page.getByRole('button', { name: 'Presentar' })).toBeVisible();
  });

  test('al final del curso avisa en lugar de dar la vuelta', async ({ page }) => {
    await present(page, '#/t/cap2-mal/2', 'Roto');
    await page.keyboard.press('Control+ArrowRight');
    await expect(deck(page).getByText('Esta presentación está vacía.')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Fin del curso')).toBeVisible();
  });
});
