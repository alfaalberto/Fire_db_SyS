/**
 * Configuración pública del proyecto de Firebase. Estas claves identifican el
 * proyecto ante Google; no conceden permisos (eso lo deciden las reglas de
 * Firestore y la lista de administradores).
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAMDFm8XgH5YyK-4FWu8ohq26BnELij1tY',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'senalesysistemas-266a1.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'senalesysistemas-266a1',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'senalesysistemas-266a1.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '305300859054',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:305300859054:web:f2caf7bc6620d59ee2e53f',
};

export const COLLECTIONS = {
  slides: 'slides',
  slideChunks: 'contentChunks',
  meta: 'meta',
  outlineDoc: 'outline',
  legacyIndexDoc: 'fullIndex',
  legacyIndexChunks: 'indexChunks',
  admins: 'admins',
} as const;
