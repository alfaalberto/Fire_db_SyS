"use client";

import { db } from './firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, limit, writeBatch } from "firebase/firestore";

const SLIDES_COLLECTION = 'slides';
const CONTENT_CHUNKS_SUBCOLLECTION = 'contentChunks';
const META_COLLECTION = 'meta';
const FULL_INDEX_DOC = 'fullIndex';
const INDEX_CHUNKS_SUBCOLLECTION = 'indexChunks';

function utf8ByteLength(input: string): number {
  return new TextEncoder().encode(input).byteLength;
}

function splitUtf8IntoChunks(input: string, maxBytes: number): string[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunks: string[] = [];

  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + maxBytes, bytes.length);
    while (end > start) {
      try {
        const part = decoder.decode(bytes.slice(start, end));
        chunks.push(part);
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

export const saveSlideToDB = async (id: string, content: string[] | null): Promise<void> => {
  try {
    const slideRef = doc(db, SLIDES_COLLECTION, id);
    const serialized = JSON.stringify(content ?? null);
    const maxBytes = 900_000;

    if (utf8ByteLength(serialized) <= maxBytes) {
      await setDoc(slideRef, { id, content, contentChunked: false });
      return;
    }

    const chunks = splitUtf8IntoChunks(serialized, maxBytes);

    let batch = writeBatch(db);
    let ops = 0;

    batch.set(slideRef, { id, content: null, contentChunked: true, contentChunkCount: chunks.length });
    ops += 1;

    for (let i = 0; i < chunks.length; i++) {
      const chunkRef = doc(db, SLIDES_COLLECTION, id, CONTENT_CHUNKS_SUBCOLLECTION, String(i));
      batch.set(chunkRef, { index: i, data: chunks[i] });
      ops += 1;

      if (ops >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }

    if (ops > 0) {
      await batch.commit();
    }
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

      let batch = writeBatch(db);
      let ops = 0;
      for (const c of chunksSnap.docs) {
        batch.delete(c.ref);
        ops += 1;
        if (ops >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }
      if (ops > 0) {
        await batch.commit();
      }
    } catch (e) {
      console.warn('Error deleting slide chunks (continuing):', e);
    }

    await deleteDoc(slideRef);
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
        contentChunkCount?: number;
      };

      if (!data.contentChunked) {
        slides.push({ id: d.id, content: (data.content ?? null) as string[] | null });
        continue;
      }

      const chunksRef = collection(db, SLIDES_COLLECTION, d.id, CONTENT_CHUNKS_SUBCOLLECTION);
      const chunkCount = typeof data.contentChunkCount === 'number' ? data.contentChunkCount : undefined;
      const chunksQuery = chunkCount
        ? query(chunksRef, orderBy('index'), limit(chunkCount))
        : query(chunksRef, orderBy('index'));
      const chunksSnap = await getDocs(chunksQuery);
      const serialized = chunksSnap.docs.map(c => (c.data() as { data?: string }).data || '').join('');

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
    const maxBytes = 900_000;

    if (utf8ByteLength(serialized) <= maxBytes) {
      await setDoc(indexRef, { data: serialized, chunked: false, updatedAt: Date.now() });
      return;
    }

    const chunks = splitUtf8IntoChunks(serialized, maxBytes);

    let batch = writeBatch(db);
    let ops = 0;

    batch.set(indexRef, { data: null, chunked: true, chunkCount: chunks.length, updatedAt: Date.now() });
    ops += 1;

    for (let i = 0; i < chunks.length; i++) {
      const chunkRef = doc(db, META_COLLECTION, FULL_INDEX_DOC, INDEX_CHUNKS_SUBCOLLECTION, String(i));
      batch.set(chunkRef, { index: i, data: chunks[i] });
      ops += 1;

      if (ops >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }

    if (ops > 0) {
      await batch.commit();
    }
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
      chunkCount?: number;
    };

    if (!data.chunked && data.data) {
      return JSON.parse(data.data) as unknown[];
    }

    if (!data.chunked) {
      return null;
    }

    const chunksRef = collection(db, META_COLLECTION, FULL_INDEX_DOC, INDEX_CHUNKS_SUBCOLLECTION);
    const chunkCount = typeof data.chunkCount === 'number' ? data.chunkCount : undefined;
    const chunksQuery = chunkCount
      ? query(chunksRef, orderBy('index'), limit(chunkCount))
      : query(chunksRef, orderBy('index'));
    const chunksSnap = await getDocs(chunksQuery);
    const serialized = chunksSnap.docs.map(c => (c.data() as { data?: string }).data || '').join('');

    return JSON.parse(serialized) as unknown[];
  } catch (error) {
    console.error("[DB] Error loading full index from Firestore:", error);
    throw error;
  }
};
