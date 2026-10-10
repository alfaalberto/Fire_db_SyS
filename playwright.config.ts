import { defineConfig, devices } from '@playwright/test';

const PORT = 9410;

/**
 * Pruebas de extremo a extremo. Levantan la compilación de producción
 * (`npm run build` antes) y sustituyen Firestore por una base en memoria
 * (ver e2e/support/fake-firestore.ts): nunca tocan la base de datos real.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'es-MX',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 800 } }, testIgnore: /movil\.spec\.ts/ },
    { name: 'movil', use: { ...devices['Pixel 7'] }, testMatch: /movil\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
