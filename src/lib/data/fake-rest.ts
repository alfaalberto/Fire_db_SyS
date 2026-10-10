/**
 * Firestore REST en memoria para las pruebas unitarias: sustituye a `fetch`
 * con las mismas rutas de lectura que usa `rest.ts`.
 */
type Value = Record<string, unknown>;

function encode(value: unknown): Value {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
}

function encodeFields(data: Record<string, unknown>): Record<string, Value> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)]));
}

export class FakeRest {
  readonly docs = new Map<string, Record<string, unknown>>();
  readonly requests: string[] = [];
  offline = false;

  set(path: string, data: Record<string, unknown>): this {
    this.docs.set(path, data);
    return this;
  }

  count(pattern: RegExp): number {
    return this.requests.filter((path) => pattern.test(path)).length;
  }

  readonly fetch = async (input: RequestInfo | URL): Promise<Response> => {
    if (this.offline) throw new TypeError('Failed to fetch');
    const url = new URL(String(input));
    const path = decodeURIComponent(url.pathname).replace(/^.*\/documents\/?/, '');
    this.requests.push(path);
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const segments = path.split('/');
    const named = (docPath: string) => ({ name: `projects/p/databases/(default)/documents/${docPath}`, fields: encodeFields(this.docs.get(docPath)!) });

    if (segments.length % 2 === 0) {
      return this.docs.has(path) ? json(200, named(path)) : json(404, { error: { code: 404 } });
    }
    const mask = url.searchParams.getAll('mask.fieldPaths');
    const orderBy = url.searchParams.get('orderBy');
    const pageSize = Number(url.searchParams.get('pageSize') ?? 300);
    const offset = Number(url.searchParams.get('pageToken') ?? 0);
    let children = [...this.docs.keys()].filter((key) => key.startsWith(`${path}/`) && key.split('/').length === segments.length + 1).sort();
    if (orderBy) children = children.sort((a, b) => Number(this.docs.get(a)![orderBy] ?? 0) - Number(this.docs.get(b)![orderBy] ?? 0));
    const page = children.slice(offset, offset + pageSize).map((key) => {
      const doc = named(key);
      if (mask.length > 0) doc.fields = Object.fromEntries(Object.entries(doc.fields).filter(([field]) => mask.includes(field)));
      return doc;
    });
    return json(200, { documents: page, ...(offset + pageSize < children.length ? { nextPageToken: String(offset + pageSize) } : {}) });
  };
}
