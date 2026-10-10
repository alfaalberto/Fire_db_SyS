import { firebaseConfig } from '../firebase-config';

/**
 * Lectura de Firestore por REST.
 *
 * El contenido del curso es público (las reglas permiten leer sin sesión), así
 * que para LEER no hace falta el SDK de Firebase: basta `fetch`. El SDK
 * (autenticación + escritura) solo se descarga cuando un docente inicia sesión.
 * Para los alumnos esto elimina ~100 kB de JavaScript y la conexión
 * permanente que mantenía el SDK completo.
 */
const ROOT = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

export class FirestoreReadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'FirestoreReadError';
  }
}

interface RawValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  timestampValue?: string;
  arrayValue?: { values?: RawValue[] };
  mapValue?: { fields?: Record<string, RawValue> };
}

interface RawDocument {
  name: string;
  fields?: Record<string, RawValue>;
}

export type DocumentData = Record<string, unknown>;

export function decodeValue(value: RawValue | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue?.values ?? []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields);
  return undefined;
}

export function decodeFields(fields: Record<string, RawValue> | undefined): DocumentData {
  const out: DocumentData = {};
  if (!fields) return out;
  for (const key of Object.keys(fields)) out[key] = decodeValue(fields[key]);
  return out;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

async function request(url: string, signal?: AbortSignal): Promise<unknown | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 350 * 3 ** (attempt - 1) + Math.random() * 150));
    }
    try {
      const response = await fetch(url, { signal, cache: 'no-store' });
      if (response.status === 404) return null;
      if (response.ok) return await response.json();
      if (!RETRYABLE.has(response.status)) {
        throw new FirestoreReadError(`Firestore respondió ${response.status}.`, response.status);
      }
      lastError = new FirestoreReadError(`Firestore respondió ${response.status}.`, response.status);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof FirestoreReadError && !RETRYABLE.has(error.status)) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new FirestoreReadError('No se pudo leer de Firestore.', 0);
}

/** Lee un documento. Devuelve `null` si no existe. */
export async function readDocument(path: string, signal?: AbortSignal): Promise<DocumentData | null> {
  const raw = (await request(`${ROOT}/${encodePath(path)}`, signal)) as RawDocument | null;
  return raw ? decodeFields(raw.fields) : null;
}

export interface ListedDocument {
  id: string;
  data: DocumentData;
}

/**
 * Lista una colección. Con `fields` solo se descargan esos campos, lo que
 * permite enumerar miles de documentos grandes sin traer su contenido.
 */
export async function listDocuments(
  collectionPath: string,
  options: { fields?: string[]; orderBy?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<ListedDocument[]> {
  const out: ListedDocument[] = [];
  let pageToken = '';
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  while (out.length < limit) {
    const params = new URLSearchParams();
    params.set('pageSize', String(Math.min(300, limit - out.length)));
    if (options.orderBy) params.set('orderBy', options.orderBy);
    for (const field of options.fields ?? []) params.append('mask.fieldPaths', field);
    if (pageToken) params.set('pageToken', pageToken);
    const page = (await request(`${ROOT}/${encodePath(collectionPath)}?${params}`, options.signal)) as
      | { documents?: RawDocument[]; nextPageToken?: string }
      | null;
    for (const doc of page?.documents ?? []) {
      out.push({ id: doc.name.slice(doc.name.lastIndexOf('/') + 1), data: decodeFields(doc.fields) });
    }
    pageToken = page?.nextPageToken ?? '';
    if (!pageToken) break;
  }
  return out;
}

/** Ejecuta tareas con un máximo de `limit` simultáneas, conservando el orden. */
export async function mapLimit<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
