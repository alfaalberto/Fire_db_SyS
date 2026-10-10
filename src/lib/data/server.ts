import { COLLECTIONS, firebaseConfig } from '../firebase-config';
import { snapshotFromOutlineDoc, type CourseSnapshot } from './course-repo';
import { decodeFields } from './rest';

const OUTLINE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${COLLECTIONS.meta}/${COLLECTIONS.outlineDoc}`;

/**
 * Temario publicado, leído en el servidor para que la página llegue ya con los
 * capítulos reales (sin esperar a que el navegador los pida). Devuelve `null`
 * si la base de datos aún usa el formato anterior o si Firestore no responde:
 * en ese caso el navegador hace la carga completa por su cuenta.
 */
export async function loadPublishedOutline(revalidateSeconds: number): Promise<CourseSnapshot | null> {
  try {
    const response = await fetch(OUTLINE_URL, {
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const raw = (await response.json()) as { fields?: Parameters<typeof decodeFields>[0] };
    return snapshotFromOutlineDoc(decodeFields(raw.fields));
  } catch {
    return null;
  }
}
