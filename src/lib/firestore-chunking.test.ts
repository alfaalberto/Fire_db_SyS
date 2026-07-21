import { describe, expect, it } from 'vitest';
import {
  FIRESTORE_CHUNK_MAX_BYTES,
  encodeFirestoreChunkManifest,
  firestoreChunkDocumentId,
  parseFirestoreChunkManifest,
  publishVersionedChunks,
  splitUtf8IntoChunks,
  utf8ByteLength,
} from '@/lib/firestore-chunking';

describe('splitUtf8IntoChunks', () => {
  it('preserves large Unicode presentations without exceeding the byte limit', () => {
    const presentation = `${'A'.repeat(FIRESTORE_CHUNK_MAX_BYTES)}${'🎛️ Señal '.repeat(80_000)}`;
    const chunks = splitUtf8IntoChunks(presentation);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(presentation);
    expect(chunks.every((chunk) => utf8ByteLength(chunk) <= FIRESTORE_CHUNK_MAX_BYTES)).toBe(true);
  });

  it('round-trips a 33-slide presentation larger than one Firestore API request', () => {
    const presentation = JSON.stringify(Array.from({ length: 33 }, (_, index) => (
      `<section data-slide="${index + 1}">${`Señal 🎛️ ${index + 1} `.repeat(30_000)}</section>`
    )));
    const chunks = splitUtf8IntoChunks(presentation);

    expect(utf8ByteLength(presentation)).toBeGreaterThan(10_000_000);
    expect(chunks.length).toBeGreaterThan(11);
    expect(chunks.join('')).toBe(presentation);
    expect(chunks.every((chunk) => utf8ByteLength(chunk) <= FIRESTORE_CHUNK_MAX_BYTES)).toBe(true);
  });

  it('rejects invalid chunk sizes', () => {
    expect(() => splitUtf8IntoChunks('contenido', 0)).toThrow('positive integer');
  });
});

describe('Firestore chunk manifests', () => {
  const revision = '123e4567-e89b-12d3-a456-426614174000';

  it('round-trips versioned manifests and still accepts legacy numeric counts', () => {
    const manifest = encodeFirestoreChunkManifest(revision, 12);
    expect(parseFirestoreChunkManifest(manifest)).toEqual({ format: 'versioned', revision, count: 12 });
    expect(parseFirestoreChunkManifest(12)).toEqual({ format: 'legacy', count: 12 });
    expect(firestoreChunkDocumentId(revision, 3)).toBe(`${revision}-3`);
  });

  it('publishes the manifest only after every chunk succeeds', async () => {
    const events: string[] = [];
    await publishVersionedChunks(
      ['uno', 'dos'],
      revision,
      async (documentId, index) => { events.push(`chunk:${index}:${documentId}`); },
      async (manifest) => { events.push(`manifest:${manifest}`); },
    );

    expect(events).toEqual([
      `chunk:0:${revision}-0`,
      `chunk:1:${revision}-1`,
      `manifest:v2:${revision}:2`,
    ]);
  });

  it('does not publish a manifest after an interrupted upload', async () => {
    const events: string[] = [];
    await expect(publishVersionedChunks(
      ['uno', 'dos', 'tres'],
      revision,
      async (_documentId, index) => {
        events.push(`chunk:${index}`);
        if (index === 1) throw new Error('network interrupted');
      },
      async () => { events.push('manifest'); },
    )).rejects.toThrow('network interrupted');

    expect(events).toEqual(['chunk:0', 'chunk:1']);
  });
});
