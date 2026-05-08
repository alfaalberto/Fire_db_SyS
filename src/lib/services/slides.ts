import { loadAllSlidesFromDB, saveSlideToDB, deleteSlideFromDB } from '@/lib/db';

export type SlideDoc = { id: string; content: string[] | null };

const cache = new Map<string, { value: SlideDoc[]; expires: number }>();
const CACHE_KEY = 'allSlides';
const TTL_MS = 30_000;

const pendingSaves = new Map<string, string[] | null>();
const pendingResolvers = new Map<string, Array<{ resolve: () => void; reject: (e: unknown) => void }>>();
let saveWorker: Promise<void> | null = null;

const FLUSH_DELAY_MS = 1_200;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void runSaveWorker();
  }, FLUSH_DELAY_MS);
}

function runSaveWorker(): Promise<void> {
  if (saveWorker) return saveWorker;
  saveWorker = (async () => {
    while (pendingSaves.size > 0) {
      const next = pendingSaves.entries().next().value as [string, string[] | null] | undefined;
      if (!next) return;
      const [id, content] = next;
      pendingSaves.delete(id);
      try {
        await retry(() => saveSlideToDB(id, content));
        cache.delete(CACHE_KEY);
        const resolvers = pendingResolvers.get(id);
        if (resolvers && resolvers.length > 0) {
          pendingResolvers.delete(id);
          for (const r of resolvers) r.resolve();
        }
      } catch (e) {
        const resolvers = pendingResolvers.get(id);
        if (resolvers && resolvers.length > 0) {
          pendingResolvers.delete(id);
          for (const r of resolvers) r.reject(e);
        }
      }
    }
  })().finally(() => {
    saveWorker = null;
  });
  return saveWorker;
}

async function retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 300): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const code = (e as { code?: string } | undefined)?.code;
      if (code === 'resource-exhausted') {
        console.error('Firestore write queue exhausted, not retrying further.', e);
        break;
      }
      if (i === attempts - 1) break;
      const jitter = Math.random() * 100;
      await new Promise(res => setTimeout(res, baseDelayMs * Math.pow(2, i) + jitter));
    }
  }
  throw lastErr;
}

export async function loadAllSlidesCached(): Promise<SlideDoc[]> {
  const now = Date.now();
  const cached = cache.get(CACHE_KEY);
  if (cached && cached.expires > now) return cached.value;
  const value = await retry(() => loadAllSlidesFromDB());
  cache.set(CACHE_KEY, { value, expires: now + TTL_MS });
  return value;
}

export async function saveSlide(id: string, content: string[] | null): Promise<void> {
  pendingSaves.set(id, content);
  const p = new Promise<void>((resolve, reject) => {
    const current = pendingResolvers.get(id) ?? [];
    current.push({ resolve, reject });
    pendingResolvers.set(id, current);
  });
  scheduleFlush();
  return p;
}

export async function deleteSlide(id: string): Promise<void> {
  await retry(() => deleteSlideFromDB(id));
  cache.delete(CACHE_KEY);
}
