import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';
import { firebaseConfig } from '../firebase-config';

/**
 * El SDK de Firebase solo se necesita para iniciar sesión y escribir. Se
 * importa de forma diferida: quien solo consulta el curso nunca lo descarga.
 */
let appPromise: Promise<FirebaseApp> | null = null;

export function getFirebaseApp(): Promise<FirebaseApp> {
  if (!appPromise) {
    appPromise = import('firebase/app').then(({ getApps, initializeApp }) => getApps()[0] ?? initializeApp(firebaseConfig));
  }
  return appPromise;
}

export async function getAdminAuth(): Promise<{ auth: Auth; mod: typeof import('firebase/auth') }> {
  const [mod, app] = await Promise.all([import('firebase/auth'), getFirebaseApp()]);
  return { auth: mod.getAuth(app), mod };
}

export async function getAdminDb(): Promise<{ db: Firestore; mod: typeof import('firebase/firestore/lite') }> {
  const [mod, app] = await Promise.all([import('firebase/firestore/lite'), getFirebaseApp()]);
  return { db: mod.getFirestore(app), mod };
}
