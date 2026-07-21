"use client";

import { db } from './firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import type { CollectionReference, DocumentData } from 'firebase/firestore';
import {
  FIRESTORE_CHUNK_MAX_BYTES,
  FIRESTORE_VERSIONED_CHUNK_INDEX_OFFSET,
  createFirestoreChunkRevision,
  firestoreChunkDocumentId,
  parseFirestoreChunkManifest,
  publishVersionedChunks,
  splitUtf8IntoChunks,
  utf8ByteLength,
} from './firestore-chunking';

const SLIDES_COLLECTION = 'slides';
const CONTENT_CHUNKS_SUBCOLLECTION = 'contentChunks';
const META_COLLECTION = 'meta';
const FULL_INDEX_DOC = 'fullIndex';
const INDEX_CHUNKS_SUBCOLLECTION = 'indexChunks';

const RETRYABLE_WRITE_CODES = new Set([
  'aborted',
  'deadline-exceeded',
  'internal',
  'resource-exhausted',
  'unavailable',
]);

function firestoreErrorCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

async function writeWithBackoff(action: () => Promise<void>, attempts = 6): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await action();
      return;
    } catch (error) {
      lastError = error;
      const code = firestoreErrorCode(error);
      if (!code || !RETRYABLE_WRITE_CODES.has(code) || attempt === attempts - 1) {
        throw error;
      }
      const delayMs = Math.min(8_000, 600 * (2 ** attempt)) + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function readVersionedChunks(
  chunksRef: CollectionReference<DocumentData, DocumentData>,
  revision: string,
  count: number,
): Promise<string> {
  const parts: string[] = [];
  for (let index = 0; index < count; index++) {
    const chunkSnap = await getDoc(doc(chunksRef, firestoreChunkDocumentId(revision, index)));
    if (!chunkSnap.exists()) {
      throw new Error(`Missing Firestore chunk ${index + 1} of ${count}.`);
    }
    const data = (chunkSnap.data() as { data?: unknown }).data;
    if (typeof data !== 'string') {
      throw new Error(`Invalid Firestore chunk ${index + 1} of ${count}.`);
    }
    parts.push(data);
  }
  return parts.join('');
}

async function readSerializedChunks(
  chunksRef: CollectionReference<DocumentData, DocumentData>,
  encodedManifest: unknown,
): Promise<string> {
  const manifest = parseFirestoreChunkManifest(encodedManifest);
  if (manifest.format === 'versioned') {
    return readVersionedChunks(chunksRef, manifest.revision, manifest.count);
  }

  const legacyQuery = query(chunksRef, orderBy('index'), limit(manifest.count));
  const legacySnapshot = await getDocs(legacyQuery);
  if (legacySnapshot.docs.length !== manifest.count) {
    throw new Error(`Missing legacy Firestore chunks: expected ${manifest.count}, received ${legacySnapshot.docs.length}.`);
  }
  return legacySnapshot.docs.map((chunk, index) => {
    const data = (chunk.data() as { data?: unknown }).data;
    if (typeof data !== 'string') {
      throw new Error(`Invalid legacy Firestore chunk ${index + 1} of ${manifest.count}.`);
    }
    return data;
  }).join('');
}

export const saveSlideToDB = async (id: string, content: string[] | null): Promise<void> => {
  try {
    const slideRef = doc(db, SLIDES_COLLECTION, id);
    const serialized = JSON.stringify(content ?? null);

    if (utf8ByteLength(serialized) <= FIRESTORE_CHUNK_MAX_BYTES) {
      await writeWithBackoff(() => setDoc(slideRef, { id, content, contentChunked: false }));
      return;
    }

    const chunks = splitUtf8IntoChunks(serialized);
    const revision = createFirestoreChunkRevision();
    const chunksRef = collection(db, SLIDES_COLLECTION, id, CONTENT_CHUNKS_SUBCOLLECTION);

    // Each upload gets unique document IDs, so concurrent tabs cannot mix their
    // chunks. The parent manifest is published only after every acknowledgement.
    await publishVersionedChunks(
      chunks,
      revision,
      async (documentId, index, data) => {
        await writeWithBackoff(() => setDoc(doc(chunksRef, documentId), {
          index: FIRESTORE_VERSIONED_CHUNK_INDEX_OFFSET + index,
          data,
        }));
      },
      async (manifest) => {
        await writeWithBackoff(() => setDoc(slideRef, {
          id,
          content: null,
          contentChunked: true,
          contentChunkCount: manifest,
        }));
      },
    );
  } catch (error) {
    console.error("Error saving slide to Firestore:", error);
    throw error;
  }
};

export const deleteSlideFromDB = async (id: string): Promise<void> => {
  try {
    const slideRef = doc(db, SLIDES_COLLECTION, id);

    try {
      const chunksRef = collection(db, SLIDES_COLLECTION, id, CONTENT_CHUNKS_SUBCOLLECTION);
      const chunksSnap = await getDocs(chunksRef);

      for (const c of chunksSnap.docs) {
        await writeWithBackoff(() => deleteDoc(c.ref));
      }
    } catch (e) {
      console.warn('Error deleting slide chunks (continuing):', e);
    }

    await writeWithBackoff(() => deleteDoc(slideRef));
  } catch (error) {
    console.error("Error deleting slide from Firestore:", error);
    throw error;
  }
};

export const loadAllSlidesFromDB = async (): Promise<{id: string, content: string[] | null}[]> => {
  try {
    const slidesCollectionRef = collection(db, SLIDES_COLLECTION);
    const querySnapshot = await getDocs(slidesCollectionRef);
    const slides: {id: string, content: string[] | null}[] = [];

    for (const d of querySnapshot.docs) {
      const data = d.data() as {
        content?: string[] | null;
        contentChunked?: boolean;
        contentChunkCount?: unknown;
      };

      if (!data.contentChunked) {
        slides.push({ id: d.id, content: (data.content ?? null) as string[] | null });
        continue;
      }

      const chunksRef = collection(db, SLIDES_COLLECTION, d.id, CONTENT_CHUNKS_SUBCOLLECTION);
      const serialized = await readSerializedChunks(chunksRef, data.contentChunkCount);

      let parsed: string[] | null = null;
      try {
        parsed = JSON.parse(serialized) as string[] | null;
      } catch (e) {
        console.error('Error parsing chunked slide content:', e, { id: d.id });
      }

      slides.push({ id: d.id, content: parsed });
    }
    return slides;
  } catch (error) {
    console.error("Error loading slides from Firestore:", error);
    throw error;
  }
};

/**
 * Save the full application index (with content) to Firestore.
 * This enables true cross-device sync without relying on localStorage.
 */
export const saveFullIndexToDB = async (index: unknown[]): Promise<void> => {
  try {
    const indexRef = doc(db, META_COLLECTION, FULL_INDEX_DOC);
    const serialized = JSON.stringify(index);

    if (utf8ByteLength(serialized) <= FIRESTORE_CHUNK_MAX_BYTES) {
      await writeWithBackoff(() => setDoc(indexRef, { data: serialized, chunked: false, updatedAt: Date.now() }));
      return;
    }

    const chunks = splitUtf8IntoChunks(serialized);
    const revision = createFirestoreChunkRevision();
    const chunksRef = collection(db, META_COLLECTION, FULL_INDEX_DOC, INDEX_CHUNKS_SUBCOLLECTION);

    await publishVersionedChunks(
      chunks,
      revision,
      async (documentId, index, data) => {
        await writeWithBackoff(() => setDoc(doc(chunksRef, documentId), {
          index: FIRESTORE_VERSIONED_CHUNK_INDEX_OFFSET + index,
          data,
        }));
      },
      async (manifest) => {
        await writeWithBackoff(() => setDoc(indexRef, {
          data: null,
          chunked: true,
          chunkCount: manifest,
          updatedAt: Date.now(),
        }));
      },
    );
    console.log('[DB] Full index saved to Firestore successfully.');
  } catch (error) {
    console.error("[DB] Error saving full index to Firestore:", error);
    throw error;
  }
};

/**
 * Load the full application index from Firestore.
 * Returns the parsed index array, or null if not found.
 */
export const loadFullIndexFromDB = async (): Promise<unknown[] | null> => {
  try {
    const indexRef = doc(db, META_COLLECTION, FULL_INDEX_DOC);
    const snap = await getDoc(indexRef);

    if (!snap.exists()) {
      console.log('[DB] No full index found in Firestore.');
      return null;
    }

    const data = snap.data() as {
      data?: string | null;
      chunked?: boolean;
      chunkCount?: unknown;
    };

    if (!data.chunked && data.data) {
      return JSON.parse(data.data) as unknown[];
    }

    if (!data.chunked) {
      return null;
    }

    const chunksRef = collection(db, META_COLLECTION, FULL_INDEX_DOC, INDEX_CHUNKS_SUBCOLLECTION);
    const serialized = await readSerializedChunks(chunksRef, data.chunkCount);

    return JSON.parse(serialized) as unknown[];
  } catch (error) {
    console.error("[DB] Error loading full index from Firestore:", error);
    throw error;
  }
};

/**
 * Subscribe to real-time updates of the full index document.
 * Ignores snapshots that originate from this client's own pending writes so we
 * don't react to our own echoes. Returns an unsubscribe function.
 */
export const subscribeFullIndex = (
  onData: (index: unknown[] | null) => void,
  onError?: (error: unknown) => void
): (() => void) => {
  const indexRef = doc(db, META_COLLECTION, FULL_INDEX_DOC);
  return onSnapshot(
    indexRef,
    (snap) => {
      // Skip our own un-acknowledged local writes to avoid feedback loops.
      if (snap.metadata.hasPendingWrites) return;
      (async () => {
        try {
          if (!snap.exists()) { onData(null); return; }
          const data = snap.data() as { data?: string | null; chunked?: boolean };
          if (!data.chunked && data.data) {
            onData(JSON.parse(data.data) as unknown[]);
            return;
          }
          if (!data.chunked) { onData(null); return; }
          // Chunked payload: reassemble using the existing loader.
          onData(await loadFullIndexFromDB());
        } catch (e) {
          onError?.(e);
        }
      })();
    },
    (err) => onError?.(err)
  );
};
