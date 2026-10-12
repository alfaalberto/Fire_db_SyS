import { expect, test, type Page } from '@playwright/test';
import { ADMIN_EMAIL, expectHeading, openApp, REV, seedLegacy, seedV2, signInAsTeacher } from './support/app';
import { FakeFirestore } from './support/fake-firestore';
import { course, deckA, deckB, deckC, indexOf, wrappedDeck } from './support/fixtures';

const newDeck = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Ejemplo nuevo · Muestreo</title></head><body><h1 data-testid="heading">Nuevo</h1></body></html>`;

/** Abre la app con sesión de docente: las herramientas de edición ya están a la vista. */
async function teacher(page: Page, db: FakeFirestore, hash = ''): Promise<void> {
  await signInAsTeacher(page, db);
  await openApp(page, db, hash);
  await expect(page.getByRole('button', { name: 'Editando' })).toBeVisible();
}

async function upload(page: Page, name: string, html: string): Promise<void> {
  await page.locator('input[type="file"][accept=".html,.htm,text/html"]').setInputFiles({ name, mimeType: 'text/html', buffer: Buffer.from(html) });
}

/** Aviso emergente (Radix lo repite en una región aria-live; basta el primero). */
function toast(page: Page, text: string | RegExp) {
  return page.getByText(text, { exact: true }).first();
}

async function publish(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(toast(page, 'Cambios publicados')).toBeVisible();
}

function outline(db: FakeFirestore): Array<{ id: string; title: string; children?: Array<{ id: string; title: string; decks?: Array<{ title: string }>; rev?: number }> }> {
  return JSON.parse(String(db.get('meta/outline')!.data));
}

test.describe('acceso del docente', () => {
  test('una cuenta que no está en la lista no puede editar', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await signInAsTeacher(page, db, { listed: false });
    await openApp(page, db);
    await page.getByRole('button', { name: 'Sin permiso' }).click();
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
    await expect(page.getByText('Esta cuenta no está en la lista de docentes.')).toBeVisible();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Modo edición' })).toHaveCount(0);
  });

  test('quien solo consulta no descarga el SDK de Firebase', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });
    await openApp(page, seedV2(new FakeFirestore()), '#/t/cap1-intro');
    await expectHeading(page, 'A1');
    const bodies = await Promise.all(scripts.map((url) => page.request.get(url).then((response) => response.text())));
    expect(bodies.some((body) => body.includes('identitytoolkit'))).toBe(false);
    expect(bodies.some((body) => body.includes('firestore.googleapis.com/google.firestore'))).toBe(false);
  });
});

test.describe('edición y publicación', () => {
  test('subir una presentación, publicarla y verla en la base de datos', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db, '#/t/cap1-intro');

    await upload(page, 'nuevo.html', newDeck);
    await expect(toast(page, 'Presentación añadida al borrador')).toBeVisible();
    await expectHeading(page, 'Nuevo');
    await expect(page.getByRole('tab', { selected: true })).toContainText('Ejemplo nuevo · Muestreo');
    await expect(page.getByText('Hay cambios sin publicar')).toBeVisible();
    // Nada se escribió todavía.
    expect(db.get('slides/cap1-intro')!.content).toEqual([deckA]);

    await publish(page);
    expect(db.get('slides/cap1-intro')!.content).toEqual([deckA, newDeck]);
    const topic = outline(db)[0].children![0];
    expect(topic.decks!.map((d) => d.title)).toEqual(['Deck A · Señales continuas', 'Ejemplo nuevo · Muestreo']);
    expect(topic.rev).toBeGreaterThan(REV);
    // Los temas que no cambiaron conservan su revisión (y la caché de los alumnos).
    expect(outline(db)[0].children![1].rev).toBe(REV);
    await expect(page.getByText('Hay cambios sin publicar')).toHaveCount(0);

    // Solo se escribieron el tema modificado y el temario.
    const commits = db.log.filter((entry) => entry.method === 'COMMIT').map((entry) => entry.path);
    expect(commits.filter((path) => path.includes('slides/'))).toHaveLength(1);
    expect(commits.filter((path) => path.includes('meta/outline'))).toHaveLength(1);
    expect(commits.some((path) => path.includes('fullIndex'))).toBe(false);
  });

  test('el borrador sobrevive a recargar la página y se puede descartar', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db, '#/t/cap1-intro');
    await upload(page, 'nuevo.html', newDeck);
    await expect(page.getByText('Hay cambios sin publicar')).toBeVisible();
    await page.waitForTimeout(700);

    await page.reload();
    await expect(page.getByText('Hay cambios sin publicar')).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(2);

    await page.getByRole('button', { name: 'Descartar', exact: true }).click();
    await page.getByRole('button', { name: 'Descartar cambios' }).click();
    await expect(page.getByText('Hay cambios sin publicar')).toHaveCount(0);
    await expectHeading(page, 'A1');
    expect(db.get('slides/cap1-intro')!.content).toEqual([deckA]);
  });

  test('eliminar, reordenar y editar presentaciones de un tema', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db, '#/t/cap1-senales');

    // Mover la primera (A) después de la segunda (B).
    await page.getByRole('button', { name: 'Opciones de la presentación 1' }).click();
    await page.getByRole('menuitem', { name: 'Mover después' }).click();
    await expect(page.getByRole('tab').first()).toContainText('Deck B');

    // Eliminar la tercera (C).
    await page.getByRole('button', { name: 'Opciones de la presentación 3' }).click();
    await page.getByRole('menuitem', { name: 'Eliminar' }).click();
    await page.getByRole('button', { name: 'Eliminar presentación' }).click();
    await expect(page.getByRole('tab')).toHaveCount(2);

    // Editar el HTML de la que quedó segunda.
    await page.getByRole('button', { name: 'Opciones de la presentación 2' }).click();
    await page.getByRole('menuitem', { name: 'Editar HTML' }).click();
    await page.getByRole('textbox', { name: 'Código HTML de la presentación' }).fill(newDeck);
    await page.getByRole('button', { name: 'Guardar en el borrador' }).click();
    await expectHeading(page, 'Nuevo');

    await publish(page);
    expect(db.get('slides/cap1-senales')!.content).toEqual([deckB, newDeck]);
  });

  test('al entrar como docente las herramientas están a la vista, y ocultarlas se recuerda', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db, '#/t/cap1-senales');
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Opciones de la presentación 1' })).toBeVisible();

    // Ver el curso como lo ven los alumnos.
    await page.getByRole('button', { name: 'Editando' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Modo edición' }).click();
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Opciones de la presentación 1' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Docente', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Docente', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Modo edición' }).click();
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
  });

  test('el botón «Editar» abre la presentación que se está viendo', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db, '#/t/cap1-senales/2');
    await expectHeading(page, 'B1');

    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /Editar presentación 2 de/ })).toBeVisible();
    await page.getByRole('textbox', { name: 'Código HTML de la presentación' }).fill(newDeck);
    await page.getByRole('button', { name: 'Guardar en el borrador' }).click();
    await expectHeading(page, 'Nuevo');

    // Y el de la papelera, la misma: pide confirmación antes de quitarla.
    await page.getByRole('button', { name: 'Eliminar esta presentación' }).click();
    await expect(page.getByRole('alertdialog', { name: '¿Eliminar esta presentación?' })).toContainText('Ejemplo nuevo · Muestreo');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('tab')).toHaveCount(3);

    await publish(page);
    expect(db.get('slides/cap1-senales')!.content).toEqual([deckA, newDeck, deckC]);
  });

  test('las presentaciones se reordenan arrastrando su pestaña', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db, '#/t/cap1-senales');
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(3);
    await expectHeading(page, 'A1');

    // La primera (A) al final: se suelta sobre la mitad derecha de la última.
    const last = await tabs.nth(2).boundingBox();
    await tabs.nth(0).dragTo(tabs.nth(2), { targetPosition: { x: last!.width - 4, y: last!.height / 2 } });
    await expect(tabs.nth(0)).toContainText('Deck B');
    await expect(tabs.nth(2)).toContainText('Deck A');
    // La que se estaba viendo sigue a la vista, ahora en tercer lugar.
    await expect(page.getByRole('tab', { selected: true })).toContainText('Deck A');
    await expectHeading(page, 'A1');

    // Y la última (A) de vuelta al principio: sobre la mitad izquierda de la primera.
    await tabs.nth(2).dragTo(tabs.nth(0), { targetPosition: { x: 4, y: last!.height / 2 } });
    await expect(tabs.nth(0)).toContainText('Deck A');

    // Soltarla donde ya está no cambia nada.
    await tabs.nth(1).dragTo(tabs.nth(0), { targetPosition: { x: (await tabs.nth(0).boundingBox())!.width - 4, y: last!.height / 2 } });
    await expect(tabs.nth(1)).toContainText('Deck B');

    await tabs.nth(1).dragTo(tabs.nth(2), { targetPosition: { x: last!.width - 4, y: last!.height / 2 } });
    await publish(page);
    expect(db.get('slides/cap1-senales')!.content).toEqual([deckA, deckC, deckB]);
  });

  test('los temas se mueven arrastrándolos en el temario', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db);
    await page.getByRole('button', { name: /^1 Señales y Sistemas/ }).click();

    const row = (name: RegExp) => page.getByRole('treeitem').filter({ has: page.getByRole('button', { name }) }).last().locator('> div[draggable]');
    const intro = row(/^1\.1 Introducción/);
    const energy = row(/^1\.3 Señales de energía/);
    const box = await energy.boundingBox();
    // Se suelta en el borde inferior de 1.3: queda justo después.
    await intro.dragTo(energy, { targetPosition: { x: box!.width / 2, y: box!.height - 2 } });

    await expect(page.getByText('Hay cambios sin publicar')).toBeVisible();
    await publish(page);
    expect(outline(db)[0].children!.map((topic) => topic.id)).toEqual(['cap1-senales', 'cap1-vacio', 'cap1-intro', 'cap1-doc']);
  });

  test('pegar el guion generador avisa y se repara con un clic', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db, '#/t/cap1-vacio');
    await page.getByRole('button', { name: 'Pegar HTML' }).click();
    await page.getByRole('textbox', { name: 'Código HTML de la presentación' }).fill(wrappedDeck);
    await expect(page.getByText(/Hay texto fuera del documento HTML/)).toBeVisible();
    await page.getByRole('button', { name: 'Reparar' }).click();
    await expect(page.getByText(/Hay texto fuera del documento HTML/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Guardar en el borrador' }).click();
    await publish(page);
    expect(db.get('slides/cap1-vacio')!.content).toEqual([deckA]);
  });

  test('renombrar, añadir y eliminar temas', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db);
    await page.getByRole('button', { name: /^1 Señales y Sistemas/ }).click();

    await page.getByRole('button', { name: 'Opciones de 1.1 Introducción' }).click();
    await page.getByRole('menuitem', { name: 'Renombrar' }).click();
    await page.getByRole('textbox', { name: 'Título' }).fill('1.1 Panorama');
    await page.keyboard.press('Enter');

    await page.getByRole('button', { name: 'Añadir capítulo' }).click();
    await page.getByRole('textbox', { name: 'Título' }).fill('4 Transformada de Fourier');
    await page.keyboard.press('Enter');

    await page.getByRole('button', { name: 'Opciones de 1.2 Señales continuas y discretas' }).click();
    await page.getByRole('menuitem', { name: 'Eliminar' }).click();
    await expect(page.getByText(/Se quitarán también 0 subtemas y 3 presentaciones/)).toBeVisible();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();

    await publish(page);
    const saved = outline(db);
    expect(saved[0].children!.map((t) => t.title)).toEqual(['1.1 Panorama', '1.3 Señales de energía y de potencia', '1.4 Transformaciones de la variable independiente']);
    expect(saved.at(-1)!.title).toBe('4 Transformada de Fourier');
    // El contenido del tema eliminado se borró; el renombrado conserva el suyo.
    expect(db.get('slides/cap1-senales')).toBeNull();
    expect(db.get('slides/cap1-intro')!.content).toEqual([deckA]);
  });

  test('si Firestore rechaza la escritura, el borrador queda intacto', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db, '#/t/cap1-intro');
    await upload(page, 'nuevo.html', newDeck);
    db.denyWrites = 403;
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(toast(page, 'No se pudo publicar')).toBeVisible();
    await expect(page.getByText('Hay cambios sin publicar')).toBeVisible();
    expect(db.get('slides/cap1-intro')!.content).toEqual([deckA]);
  });

  test('si el curso cambió en otro dispositivo, pide confirmación antes de sobrescribir', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db, '#/t/cap1-intro');
    await upload(page, 'nuevo.html', newDeck);
    // Otro dispositivo publica mientras tanto.
    db.set('meta/outline', { ...db.get('meta/outline')!, updatedAt: REV + 5 });

    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(page.getByRole('alertdialog', { name: 'El curso cambió en otro dispositivo' })).toBeVisible();
    expect(db.get('slides/cap1-intro')!.content).toEqual([deckA]);
    await page.getByRole('button', { name: 'Publicar de todos modos' }).click();
    await expect(toast(page, 'Cambios publicados')).toBeVisible();
    expect(db.get('slides/cap1-intro')!.content).toEqual([deckA, newDeck]);
  });

  test('un respaldo mal formado se rechaza; uno válido entra como borrador', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db);
    const input = page.locator('input[type="file"][accept=".json,application/json"]');

    await input.setInputFiles({ name: 'malo.json', mimeType: 'application/json', buffer: Buffer.from('{"no":"es un respaldo"}') });
    await expect(toast(page, 'El archivo no es un respaldo válido')).toBeVisible();
    await expect(page.getByText('Hay cambios sin publicar')).toHaveCount(0);

    const backup = indexOf([{ id: 'cap9', title: '9 Laplace', topics: [{ id: 'cap9-a', title: '9.1 Introducción', decks: [newDeck] }] }]);
    await input.setInputFiles({ name: 'respaldo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await expect(toast(page, 'Respaldo cargado como borrador')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Laplace' })).toBeVisible();

    await publish(page);
    expect(outline(db).map((chapter) => chapter.title)).toEqual(['9 Laplace']);
    expect(db.get('slides/cap9-a')!.content).toEqual([newDeck]);
    // Los temas que ya no están en el curso se retiran.
    expect(db.paths('slides/')).toEqual(['slides/cap9-a']);
  });
});

test.describe('migración desde el formato anterior', () => {
  test('migrar escribe solo los temas que difieren y crea el temario ligero', async ({ page }) => {
    const db = seedLegacy(new FakeFirestore());
    // Estado como el de la base real: casi todos los `slides/{id}` al día,
    // uno desactualizado y uno que sobra.
    for (const chapter of course) {
      for (const topic of chapter.topics) {
        if (topic.decks?.length) db.set(`slides/${topic.id}`, { id: topic.id, content: topic.decks, contentChunked: false });
      }
    }
    db.set('slides/cap1-senales', { id: 'cap1-senales', content: ['<p>versión vieja</p>'], contentChunked: false });
    db.set('slides/huerfano', { id: 'huerfano', content: ['<p>sobra</p>'], contentChunked: false });

    await teacher(page, db);
    await page.getByRole('button', { name: 'Ver mantenimiento' }).click();
    await page.getByRole('button', { name: 'Migrar al formato nuevo' }).click();
    await expect(toast(page, 'Cambios publicados')).toBeVisible();

    const commits = db.log.filter((entry) => entry.method === 'COMMIT').map((entry) => entry.path);
    expect(commits.filter((path) => path.startsWith('set') && path.includes('/slides/'))).toHaveLength(1);
    expect(db.get('slides/cap1-senales')!.content).toEqual(course[0].topics[1].decks);
    expect(db.get('slides/huerfano')).toBeNull();
    expect(outline(db)).toHaveLength(3);
    // El formato anterior no se toca: sigue ahí como respaldo.
    expect(db.get('meta/fullIndex')).not.toBeNull();

    await expect(page.getByText(/Formato nuevo: al abrir la plataforma solo se descarga el temario/)).toBeVisible();

    // Un alumno que llega después ya no descarga el paquete completo.
    db.log.length = 0;
    await page.reload();
    await expect(page.getByText('11 presentaciones en 5 de 7 temas.')).toBeVisible();
    expect(db.reads(/^meta\/fullIndex/)).toBe(0);
  });

  test('mantenimiento mide y libera las copias sobrantes del formato anterior', async ({ page }) => {
    const db = seedLegacy(new FakeFirestore());
    const live = db.paths('meta/fullIndex/indexChunks/').length;
    // Copias de tamaño real (900 kB cada parte): juntas pasan de los 10 MiB
    // que Firestore admite en una sola escritura.
    const part = 'x'.repeat(900_000);
    for (let revision = 0; revision < 3; revision++) {
      for (let i = 0; i < 4; i++) db.set(`meta/fullIndex/indexChunks/vieja-${revision}aaaa-${i}`, { index: 1_000_000 + i, data: part });
    }
    db.set('meta/fullIndex/indexChunks/0', { index: 0, data: 'x' });

    await teacher(page, db);
    await page.getByRole('button', { name: 'Editando' }).click();
    await page.getByRole('menuitem', { name: 'Mantenimiento' }).click();
    await page.getByRole('button', { name: 'Analizar' }).click();
    await expect(page.getByText(new RegExp(`Hay ${live + 13} partes guardadas y solo ${live} están en uso`))).toBeVisible();

    await page.getByRole('button', { name: 'Borrar las partes sobrantes' }).click();
    await page.getByRole('button', { name: 'Borrar', exact: true }).click();
    await expect(toast(page, 'Espacio liberado')).toBeVisible();
    expect(db.paths('meta/fullIndex/indexChunks/')).toHaveLength(live);
    // Lo vigente sigue completo y legible.
    await page.reload();
    await page.goto('/#/t/cap1-intro');
    await expectHeading(page, 'A1');
  });

  test('la revisión del curso lista los problemas de contenido', async ({ page }) => {
    const db = seedV2(new FakeFirestore());
    await teacher(page, db);
    await page.getByRole('button', { name: 'Editando' }).click();
    await page.getByRole('menuitem', { name: 'Mantenimiento' }).click();
    await page.getByRole('button', { name: 'Revisar todo el curso' }).click();
    await expect(page.getByText('2.2 Suma de convolución, presentación 1')).toBeVisible();
    await expect(page.getByText(/Hay texto fuera del documento HTML/)).toBeVisible();
    await expect(page.getByText('La presentación está vacía.')).toBeVisible();

    await page.getByRole('button', { name: 'Reparar lo que se corrige solo' }).click();
    await expect(toast(page, 'Reparaciones en el borrador')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await publish(page);
    expect((db.get('slides/cap2-mal')!.content as string[])[0]).toBe(deckA);
  });
});
