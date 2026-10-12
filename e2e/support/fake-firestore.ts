import type { Page, Route } from '@playwright/test';

/**
 * Firestore de mentira para las pruebas: una base en memoria que entiende las
 * mismas peticiones REST que usa la app (lectura con `fetch`, escritura con el
 * SDK "lite"). Permite probar publicar/migrar sin tocar la base real.
 */
const PROJECT = 'senalesysistemas-266a1';
const DOCS = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${DOCS}`;

type Value = Record<string, unknown>;
export type Fields = Record<string, Value>;

export function encode(value: unknown): Value {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
}

export function encodeFields(data: Record<string, unknown>): Fields {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)]));
}

export function decode(value: Value | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (((value.arrayValue as { values?: Value[] }).values ?? []) as Value[]).map(decode);
  if ('mapValue' in value) return decodeFields(((value.mapValue as { fields?: Fields }).fields ?? {}) as Fields);
  return undefined;
}

export function decodeFields(fields: Fields): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

const MAX_DOCUMENT_BYTES = 1_048_576;
const MAX_COMMIT_BYTES = 10 * 1_048_576;

/** Tamaño aproximado de un documento: el de sus textos y nombres de campo. */
function sizeOf(value: unknown): number {
  if (typeof value === 'string') return Buffer.byteLength(value);
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + sizeOf(item), 0);
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<number>((sum, [key, item]) => sum + key.length + sizeOf(item), 0);
  }
  return 8;
}

export interface RequestLog {
  method: string;
  path: string;
}

export class FakeFirestore {
  readonly docs = new Map<string, Fields>();
  readonly log: RequestLog[] = [];
  /** Si se define, las escrituras fallan con este código de estado. */
  denyWrites: number | null = null;
  /** Si es `true`, todas las peticiones fallan como si no hubiera red. */
  offline = false;

  set(path: string, data: Record<string, unknown>): this {
    this.docs.set(path, encodeFields(data));
    return this;
  }

  get(path: string): Record<string, unknown> | null {
    const fields = this.docs.get(path);
    return fields ? decodeFields(fields) : null;
  }

  paths(prefix = ''): string[] {
    return [...this.docs.keys()].filter((path) => path.startsWith(prefix)).sort();
  }

  reads(pattern: RegExp): number {
    return this.log.filter((entry) => entry.method === 'GET' && pattern.test(entry.path)).length;
  }

  private doc(path: string) {
    return { name: `${DOCS}/${path}`, fields: this.docs.get(path), createTime: '2026-01-01T00:00:00Z', updateTime: '2026-01-01T00:00:00Z' };
  }

  async install(page: Page): Promise<void> {
    await page.route('https://firestore.googleapis.com/**', (route) => this.handle(route));
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (this.offline) return route.abort('internetdisconnected');

    const full = decodeURIComponent(url.pathname).replace(`/v1/${DOCS}`, '');
    const json = (status: number, body: unknown) => route.fulfill({ status, headers, body: JSON.stringify(body) });

    if (method === 'POST' && full === ':batchGet') {
      const body = request.postDataJSON() as { documents: string[] };
      this.log.push({ method: 'BATCHGET', path: body.documents.join(',') });
      return json(
        200,
        body.documents.map((name) => {
          const path = name.replace(`${DOCS}/`, '');
          return this.docs.has(path) ? { found: this.doc(path), readTime: '2026-01-01T00:00:00Z' } : { missing: name, readTime: '2026-01-01T00:00:00Z' };
        }),
      );
    }

    if (method === 'POST' && full === ':commit') {
      const body = request.postDataJSON() as { writes?: Array<{ update?: { name: string; fields?: Fields }; delete?: string }> };
      this.log.push({ method: 'COMMIT', path: (body.writes ?? []).map((w) => (w.update ? `set ${w.update.name}` : `del ${w.delete}`)).join(',') });
      if (this.denyWrites) {
        return json(this.denyWrites, { error: { code: this.denyWrites, status: 'PERMISSION_DENIED', message: 'Missing or insufficient permissions.' } });
      }
      // Los límites de Firestore: 1 MiB por documento y 10 MiB por escritura,
      // contando también el tamaño de los documentos que se borran.
      let total = 0;
      for (const write of body.writes ?? []) {
        if (write.update) {
          const bytes = sizeOf(write.update.fields ?? {});
          if (bytes > MAX_DOCUMENT_BYTES) {
            return json(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: `Document cannot be written because its size (${bytes} bytes) exceeds the maximum allowed size of 1,048,576 bytes.` } });
          }
          total += bytes;
        } else if (write.delete) {
          total += sizeOf(this.docs.get(write.delete.replace(`${DOCS}/`, '')) ?? {});
        }
      }
      if (total > MAX_COMMIT_BYTES) {
        return json(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Transaction too big. Decrease transaction size.' } });
      }
      for (const write of body.writes ?? []) {
        if (write.update) this.docs.set(write.update.name.replace(`${DOCS}/`, ''), write.update.fields ?? {});
        else if (write.delete) this.docs.delete(write.delete.replace(`${DOCS}/`, ''));
      }
      return json(200, { writeResults: (body.writes ?? []).map(() => ({ updateTime: '2026-01-02T00:00:00Z' })), commitTime: '2026-01-02T00:00:00Z' });
    }

    if (method === 'GET') {
      const path = full.replace(/^\//, '');
      this.log.push({ method: 'GET', path });
      const segments = path.split('/');
      if (segments.length % 2 === 0) {
        return this.docs.has(path) ? json(200, this.doc(path)) : json(404, { error: { code: 404, status: 'NOT_FOUND' } });
      }
      // Colección: hijos directos, con orden, máscara y paginación.
      const mask = url.searchParams.getAll('mask.fieldPaths');
      const orderBy = url.searchParams.get('orderBy');
      const pageSize = Number(url.searchParams.get('pageSize') ?? 300);
      const offset = Number(url.searchParams.get('pageToken') ?? 0);
      let children = this.paths(`${path}/`).filter((p) => p.split('/').length === segments.length + 1);
      if (orderBy) {
        children = children.sort((a, b) => Number(decode(this.docs.get(a)![orderBy]) ?? 0) - Number(decode(this.docs.get(b)![orderBy]) ?? 0));
      }
      const page = children.slice(offset, offset + pageSize);
      return json(200, {
        documents: page.map((p) => {
          const doc = this.doc(p);
          if (mask.length > 0) doc.fields = Object.fromEntries(Object.entries(doc.fields ?? {}).filter(([key]) => mask.includes(key)));
          return doc;
        }),
        ...(offset + pageSize < children.length ? { nextPageToken: String(offset + pageSize) } : {}),
      });
    }

    return json(400, { error: { code: 400, message: `Petición no simulada: ${method} ${full}` } });
  }
}

export const FIRESTORE_BASE = BASE;
