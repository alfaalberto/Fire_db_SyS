import { expect, type FrameLocator, type Page } from '@playwright/test';
import { FakeFirestore } from './fake-firestore';
import { course, indexOf, outlineOf, type SeedChapter } from './fixtures';

export const REV = 1_700_000_000_000;
export const ADMIN_EMAIL = 'docente@example.com';
const API_KEY = 'AIzaSyAMDFm8XgH5YyK-4FWu8ohq26BnELij1tY';

/** Base en formato nuevo: temario en `meta/outline`, contenido en `slides/{id}`. */
export function seedV2(db: FakeFirestore, chapters: SeedChapter[] = course): FakeFirestore {
  db.set('meta/outline', { v: 2, data: JSON.stringify(outlineOf(chapters, REV)), updatedAt: REV });
  for (const chapter of chapters) {
    for (const topic of chapter.topics) {
      if (topic.decks?.length) db.set(`slides/${topic.id}`, { id: topic.id, content: topic.decks, contentChunked: false });
    }
  }
  return db;
}

/** Base en formato anterior: todo el curso troceado en `meta/fullIndex`. */
export function seedLegacy(db: FakeFirestore, chapters: SeedChapter[] = course, options: { chunkSize?: number; revision?: string } = {}): FakeFirestore {
  const serialized = JSON.stringify(indexOf(chapters));
  const size = options.chunkSize ?? 6000;
  const revision = options.revision ?? 'rev-aaaaaaaa';
  const parts: string[] = [];
  for (let i = 0; i < serialized.length; i += size) parts.push(serialized.slice(i, i + size));
  parts.forEach((data, i) => db.set(`meta/fullIndex/indexChunks/${revision}-${i}`, { index: 1_000_000 + i, data }));
  db.set('meta/fullIndex', { data: null, chunked: true, chunkCount: `v2:${revision}:${parts.length}`, updatedAt: REV });
  return db;
}

/**
 * Deja una sesión de docente ya iniciada: escribe en IndexedDB el usuario que
 * Firebase Auth guarda tras entrar con Google y simula sus servicios.
 */
export async function signInAsTeacher(page: Page, db: FakeFirestore, options: { listed?: boolean } = {}): Promise<void> {
  if (options.listed !== false) db.set(`admins/${ADMIN_EMAIL}`, { nombre: 'Docente de prueba' });
  const user = {
    uid: 'uid-docente',
    email: ADMIN_EMAIL,
    emailVerified: true,
    displayName: 'Docente de Prueba',
    isAnonymous: false,
    photoURL: null,
    providerData: [{ providerId: 'google.com', uid: '1', displayName: 'Docente de Prueba', email: ADMIN_EMAIL, phoneNumber: null, photoURL: null }],
    stsTokenManager: { refreshToken: 'refresh', accessToken: 'token-de-prueba', expirationTime: Date.now() + 3_600_000 },
    createdAt: '1700000000000',
    lastLoginAt: '1700000000000',
    apiKey: API_KEY,
    appName: '[DEFAULT]',
  };
  await page.route('https://identitytoolkit.googleapis.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ users: [{ localId: user.uid, email: user.email, emailVerified: true, displayName: user.displayName, providerUserInfo: [], validSince: '0', lastLoginAt: user.lastLoginAt, createdAt: user.createdAt }] }),
    }),
  );
  await page.route('https://securetoken.googleapis.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ access_token: 'token-de-prueba', expires_in: '3600', token_type: 'Bearer', refresh_token: 'refresh', id_token: 'token-de-prueba', user_id: user.uid, project_id: '305300859054' }),
    }),
  );
  await page.addInitScript(
    ({ value, key }) => {
      // El guion corre en todos los marcos; la sesión solo va en la página.
      if (window.top !== window) return;
      localStorage.setItem('sys.docente', '1');
      const open = indexedDB.open('firebaseLocalStorageDb', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
      open.onsuccess = () => {
        const tx = open.result.transaction('firebaseLocalStorage', 'readwrite');
        tx.objectStore('firebaseLocalStorage').put({ fbase_key: key, value });
      };
    },
    { value: user, key: `firebase:authUser:${API_KEY}:[DEFAULT]` },
  );
}

/** Todo lo que no sea la app ni un servicio simulado se corta: sin red real. */
export async function isolate(page: Page): Promise<void> {
  await page.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname) && !/(^|\.)googleapis\.com$/.test(url.hostname),
    (route) => route.abort('blockedbyclient'),
  );
}

export async function openApp(page: Page, db: FakeFirestore, hash = ''): Promise<void> {
  await isolate(page);
  await db.install(page);
  await page.goto(`/${hash}`);
}

/** Documento de la presentación visible. */
export function deck(page: Page): FrameLocator {
  return page.frameLocator('main iframe');
}

export async function expectHeading(page: Page, text: string): Promise<void> {
  await expect(deck(page).locator('[data-testid="heading"]:visible')).toHaveText(text);
}
