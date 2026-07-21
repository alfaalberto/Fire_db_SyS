export const FIRESTORE_CHUNK_MAX_BYTES = 900_000;
export const FIRESTORE_VERSIONED_CHUNK_INDEX_OFFSET = 1_000_000;
const FIRESTORE_CHUNK_MANIFEST_PREFIX = 'v2';
const FIRESTORE_MAX_CHUNK_COUNT = 100_000;
const FIRESTORE_REVISION_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export type FirestoreChunkManifest =
  | { format: 'legacy'; count: number }
  | { format: 'versioned'; revision: string; count: number };

function assertValidRevision(revision: string): void {
  if (!FIRESTORE_REVISION_PATTERN.test(revision)) {
    throw new Error('Invalid Firestore chunk revision.');
  }
}

function assertValidChunkCount(count: number): void {
  if (!Number.isInteger(count) || count <= 0 || count > FIRESTORE_MAX_CHUNK_COUNT) {
    throw new Error('Invalid Firestore chunk count.');
  }
}

export function createFirestoreChunkRevision(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function firestoreChunkDocumentId(revision: string, index: number): string {
  assertValidRevision(revision);
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('Invalid Firestore chunk index.');
  }
  return `${revision}-${index}`;
}

export function encodeFirestoreChunkManifest(revision: string, count: number): string {
  assertValidRevision(revision);
  assertValidChunkCount(count);
  return `${FIRESTORE_CHUNK_MANIFEST_PREFIX}:${revision}:${count}`;
}

export function parseFirestoreChunkManifest(value: unknown): FirestoreChunkManifest {
  if (typeof value === 'number') {
    assertValidChunkCount(value);
    return { format: 'legacy', count: value };
  }
  if (typeof value !== 'string') {
    throw new Error('Invalid Firestore chunk manifest.');
  }

  const parts = value.split(':');
  if (parts.length !== 3 || parts[0] !== FIRESTORE_CHUNK_MANIFEST_PREFIX) {
    throw new Error('Invalid Firestore chunk manifest.');
  }
  const revision = parts[1];
  const count = Number(parts[2]);
  assertValidRevision(revision);
  assertValidChunkCount(count);
  return { format: 'versioned', revision, count };
}

export async function publishVersionedChunks(
  chunks: string[],
  revision: string,
  writeChunk: (documentId: string, index: number, data: string) => Promise<void>,
  publishManifest: (manifest: string) => Promise<void>,
): Promise<void> {
  assertValidRevision(revision);
  assertValidChunkCount(chunks.length);

  for (let index = 0; index < chunks.length; index++) {
    await writeChunk(firestoreChunkDocumentId(revision, index), index, chunks[index]);
  }
  await publishManifest(encodeFirestoreChunkManifest(revision, chunks.length));
}

export function utf8ByteLength(input: string): number {
  return new TextEncoder().encode(input).byteLength;
}

export function splitUtf8IntoChunks(input: string, maxBytes = FIRESTORE_CHUNK_MAX_BYTES): string[] {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('Chunk size must be a positive integer.');
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunks: string[] = [];

  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + maxBytes, bytes.length);
    while (end > start) {
      try {
        chunks.push(decoder.decode(bytes.slice(start, end)));
        break;
      } catch {
        end -= 1;
      }
    }
    if (end <= start) {
      throw new Error('Failed to split UTF-8 string into chunks.');
    }
    start = end;
  }

  return chunks;
}
