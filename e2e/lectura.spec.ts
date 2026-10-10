import { expect, test } from '@playwright/test';
import { deck, expectHeading, openApp, seedLegacy, seedV2 } from './support/app';
import { FakeFirestore } from './support/fake-firestore';

test.describe('lectura del curso (formato nuevo)', () => {
  test('la portada muestra el temario y abre un tema desde la gráfica', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await openApp(page, db);

    await expect(page.getByRole('heading', { level: 1, name: 'Señales y Sistemas' })).toBeVisible();
    await expect(page.getByText('11 presentaciones en 5 de 7 temas.')).toBeVisible();

    await page.getByRole('link', { name: '1.2 Señales continuas y discretas: 3 presentaciones' }).click();
    await expect(page).toHaveURL(/#\/t\/cap1-senales$/);
    await expectHeading(page, 'A1');

    // Solo se descargó el temario y el tema abierto, no el curso completo.
    expect(db.reads(/^slides\//)).toBe(1);
    expect(db.reads(/^meta\/fullIndex/)).toBe(0);
  });

  test('las pestañas llevan el título de cada presentación', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap1-senales');
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(1)).toContainText('Deck B · Convolución periódica');

    await tabs.nth(1).click();
    await expect(page).toHaveURL(/#\/t\/cap1-senales\/2$/);
    await expectHeading(page, 'B1');
  });

  test('un enlace directo abre el tema y la presentación indicados', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap1-senales/3');
    await expectHeading(page, 'C1');
    await expect(page.getByRole('tab', { selected: true })).toContainText('Deck C');
  });

  test('el atajo por número de sección también funciona', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/1.2/2');
    await expectHeading(page, 'B1');
  });

  test('buscar no rompe la página y encuentra presentaciones por título', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openApp(page, seedV2(new FakeFirestore()));

    const search = page.getByRole('searchbox', { name: 'Buscar tema o presentación' });
    await search.fill('fourier');
    await expect(page.getByRole('button', { name: /3 Series de Fourier/ })).toBeVisible();

    await search.fill('convolucion periodica');
    await page.getByRole('button', { name: /Deck B · Convolución periódica/ }).click();
    await expectHeading(page, 'B1');

    await search.fill('zzzz');
    await expect(page.getByText(/Nada coincide con «zzzz»/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('la presentación se muestra tal cual, sin estilos de la plataforma', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap1-intro');
    await expectHeading(page, 'A1');
    const frame = deck(page);
    // Documento en modo estándar y con su propio fondo y atributos.
    expect(await frame.locator('html').evaluate(() => document.compatMode)).toBe('CSS1Compat');
    expect(await frame.locator('html').getAttribute('data-theme')).toBe('light');
    expect(await frame.locator('body').getAttribute('data-view')).toBe('presentation');
    expect(await frame.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor)).toBe('rgb(255, 253, 248)');
    // Sin hojas de estilo ni envoltorios inyectados.
    expect(await frame.locator('link[rel="stylesheet"]').count()).toBe(0);
    expect(await frame.locator('#__slide_viewport').count()).toBe(0);
    // El encabezado propio sigue siendo sticky respecto al documento.
    expect(await frame.locator('header').evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
  });

  test('un ancla interna no saca a la presentación de su documento', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap1-intro');
    await expectHeading(page, 'A1');
    await deck(page).getByRole('button', { name: 'Sig ▶' }).click();
    await expectHeading(page, 'A2');
    await deck(page).getByRole('link', { name: 'Ir al contenido' }).click();
    await page.waitForTimeout(300);
    // Sigue siendo el mismo documento, en la misma lámina.
    await expectHeading(page, 'A2');
  });

  test('el indicador sigue la lámina de la presentación', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap1-intro');
    await expectHeading(page, 'A1');
    const indicator = page.getByTitle('Lámina actual de la presentación');
    await expect(indicator).toHaveText('1 / 3');
    await deck(page).getByRole('button', { name: 'Sig ▶' }).click();
    await expect(indicator).toHaveText('2 / 3');
  });

  test('un fragmento suelto recibe la plantilla de la app y KaTeX local', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap1-doc/2');
    const frame = deck(page);
    await expect(frame.getByRole('heading', { name: 'Fragmento suelto' })).toBeVisible();
    await expect(frame.locator('.katex').first()).toBeVisible();
  });

  test('el texto pegado fuera del HTML no se muestra', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap2-mal');
    await expectHeading(page, 'A1');
    const frame = deck(page);
    expect(await frame.locator('html').evaluate(() => document.compatMode)).toBe('CSS1Compat');
    await expect(frame.locator('body')).not.toContainText('pathlib');
    await expect(frame.locator('body')).not.toContainText('Archivo creado');
  });

  test('un tema sin presentaciones ofrece seguir al siguiente con contenido', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap1-vacio');
    await expect(page.getByRole('heading', { name: 'Este tema está en preparación' })).toBeVisible();
    await page.getByRole('button', { name: /Ir al siguiente tema con contenido/ }).click();
    await expectHeading(page, 'D');
  });

  test('los controles de edición no existen sin sesión de docente', async ({ page }) => {
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap1-senales');
    await expectHeading(page, 'A1');
    await expect(page.getByRole('button', { name: 'Acceso docente' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Añadir/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Eliminar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Publicar/ })).toHaveCount(0);
  });

  test('el tema claro y el oscuro son distintos', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openApp(page, seedV2(new FakeFirestore()));
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await expect(page.locator('html')).toHaveClass(/dark/);
    const dark = await background();
    await page.getByRole('button', { name: 'Cambiar entre tema claro y oscuro' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    expect(await background()).not.toBe(dark);
  });

  test('sin conexión se muestra la copia guardada', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await openApp(page, db, '#/t/cap1-intro');
    await expectHeading(page, 'A1');

    db.offline = true;
    await page.reload();
    await expectHeading(page, 'A1');
    await expect(page.getByText(/Sin conexión con el servidor/)).toBeVisible();
  });
});

test.describe('lectura del curso (formato anterior)', () => {
  test('descarga el paquete una sola vez y después usa la copia local', async ({ page }) => {
    const db = seedLegacy(new FakeFirestore());
    await openApp(page, db, '#/t/cap1-senales/2');
    await expectHeading(page, 'B1');
    const chunks = db.paths('meta/fullIndex/indexChunks/').length;
    expect(chunks).toBeGreaterThan(1);
    expect(db.reads(/^meta\/fullIndex\/indexChunks\//)).toBe(chunks);

    db.log.length = 0;
    await page.reload();
    await expectHeading(page, 'B1');
    // Segunda visita: solo se consulta el sello, no los trozos.
    expect(db.reads(/^meta\/fullIndex\/indexChunks\//)).toBe(0);
    expect(db.reads(/^meta\/fullIndex$/)).toBeGreaterThan(0);
  });

  test('si el servidor cambia, vuelve a descargar', async ({ page }) => {
    const db = seedLegacy(new FakeFirestore());
    await openApp(page, db, '#/t/cap1-intro');
    await expectHeading(page, 'A1');

    for (const path of db.paths('meta/fullIndex')) db.docs.delete(path);
    seedLegacy(db, [{ id: 'cap1', title: '1 Señales y Sistemas', topics: [{ id: 'cap1-intro', title: '1.1 Introducción', decks: ['<h1 data-testid="heading">Nuevo</h1>'] }] }], {
      revision: 'rev-bbbbbbbb',
    });
    db.set('meta/fullIndex', { ...db.get('meta/fullIndex')!, updatedAt: 1_800_000_000_000 });
    await page.reload();
    await expectHeading(page, 'Nuevo');
  });
});
