import { COLLECTIONS } from '../firebase-config';
import { getAdminAuth, getAdminDb } from './firebase';

export interface AdminUser {
  email: string;
  name: string | null;
  photoUrl: string | null;
}

export type AdminDenial =
  /** El correo no está en la colección `admins`. */
  | 'not-listed'
  /** Las reglas publicadas todavía son las antiguas (no conocen `admins`). */
  | 'rules-pending'
  /** No se pudo consultar (sin conexión, etc.). */
  | 'unknown';

export type AdminState =
  | { status: 'signed-out' }
  | { status: 'checking'; user: AdminUser }
  | { status: 'admin'; user: AdminUser }
  | { status: 'denied'; user: AdminUser; reason: AdminDenial };

const HINT_KEY = 'sys.docente';

/** ¿Este navegador ya inició sesión como docente? Evita cargar el SDK a todos. */
export function hasAdminHint(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function setHint(on: boolean): void {
  try {
    if (on) localStorage.setItem(HINT_KEY, '1');
    else localStorage.removeItem(HINT_KEY);
  } catch {
    // Solo es una optimización de arranque.
  }
}

async function verify(email: string): Promise<'admin' | AdminDenial> {
  try {
    const { db, mod } = await getAdminDb();
    const snap = await mod.getDoc(mod.doc(db, COLLECTIONS.admins, email.toLowerCase()));
    return snap.exists() ? 'admin' : 'not-listed';
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    return code === 'permission-denied' ? 'rules-pending' : 'unknown';
  }
}

/** Observa la sesión. Devuelve la función para dejar de observar. */
export async function watchAdmin(onChange: (state: AdminState) => void): Promise<() => void> {
  const { auth, mod } = await getAdminAuth();
  let generation = 0;
  return mod.onAuthStateChanged(auth, (firebaseUser) => {
    const current = ++generation;
    if (!firebaseUser || !firebaseUser.email) {
      setHint(false);
      onChange({ status: 'signed-out' });
      return;
    }
    const user: AdminUser = {
      email: firebaseUser.email,
      name: firebaseUser.displayName,
      photoUrl: firebaseUser.photoURL,
    };
    onChange({ status: 'checking', user });
    void verify(user.email).then((verdict) => {
      if (current !== generation) return;
      if (verdict === 'admin') {
        setHint(true);
        onChange({ status: 'admin', user });
      } else {
        onChange({ status: 'denied', user, reason: verdict });
      }
    });
  });
}

export class SignInError extends Error {
  constructor(message: string, readonly silent = false) {
    super(message);
    this.name = 'SignInError';
  }
}

const SIGN_IN_MESSAGES: Record<string, string> = {
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.',
  'auth/operation-not-allowed': 'El acceso con Google no está activado en este proyecto de Firebase (Authentication → Sign-in method → Google).',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication (Settings → Authorized domains).',
  'auth/network-request-failed': 'No hay conexión con Google. Revisa tu red e inténtalo de nuevo.',
};

export async function signInWithGoogle(): Promise<void> {
  const { auth, mod } = await getAdminAuth();
  const provider = new mod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await mod.signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new SignInError('Inicio de sesión cancelado.', true);
    }
    throw new SignInError(SIGN_IN_MESSAGES[code] ?? `No se pudo iniciar sesión (${code || 'error desconocido'}).`);
  }
}

export async function signOutAdmin(): Promise<void> {
  const { auth, mod } = await getAdminAuth();
  setHint(false);
  await mod.signOut(auth);
}
