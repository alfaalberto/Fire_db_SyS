import { loadAllSlidesFromDB, saveSlideToDB, deleteSlideFromDB } from '@/lib/db';

export type SlideDoc = { id: string; content: string[] | null };
type LocalBackupRecord = { content: string[] | null; updatedAt: number };

const cache = new Map<string, { value: SlideDoc[]; expires: number }>();
const CACHE_KEY = 'allSlides';
const TTL_MS = 30_000;
const LOCAL_BACKUP_KEY = 'fire-db-sys.unsynced-slides.v1';

const pendingSaves = new Map<string, string[] | null>();
const pendingResolvers = new Map<string, Array<{ resolve: () => void; reject: (e: unknown) => void }>>();
let saveWorker: Promise<void> | null = null;

const FLUSH_DELAY_MS = 1_200;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function readLocalBackups(): Record<string, LocalBackupRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_BACKUP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LocalBackupRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.warn('Unable to read local slide backups:', e);
    return {};
  }
}

function writeLocalBackups(records: Record<string, LocalBackupRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('Unable to write local slide backups:', e);
  }
}

function saveLocalBackup(id: string, content: string[] | null): void {
  const records = readLocalBackups();
  records[id] = { content, updatedAt: Date.now() };
  writeLocalBackups(records);
}

function clearLocalBackupIfMatches(id: string, content: string[] | null): void {
  const records = readLocalBackups();
  const current = records[id];
  if (!current) return;
  if (JSON.stringify(current.content) !== JSON.stringify(content)) return;
  delete records[id];
  writeLocalBackups(records);
}

function loadLocalBackups(): SlideDoc[] {
  return Object.entries(readLocalBackups()).map(([id, record]) => ({
    id,
    content: record.content,
  }));
}

function mergeSlideDocs(remoteDocs: SlideDoc[], localDocs: SlideDoc[]): SlideDoc[] {
  const merged = new Map<string, SlideDoc>();
  for (const doc of remoteDocs) merged.set(doc.id, doc);
  for (const doc of localDocs) merged.set(doc.id, doc);
  return Array.from(merged.values());
}

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
        clearLocalBackupIfMatches(id, content);
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
  const localBackups = loadLocalBackups();
  let value: SlideDoc[];
  try {
    value = mergeSlideDocs(await retry(() => loadAllSlidesFromDB()), localBackups);
  } catch (e) {
    if (localBackups.length === 0) throw e;
    console.warn('Loading unsynced local slide backups because Firestore failed:', e);
    value = localBackups;
  }
  cache.set(CACHE_KEY, { value, expires: now + TTL_MS });
  return value;
}

export async function saveSlide(id: string, content: string[] | null): Promise<void> {
  saveLocalBackup(id, content);
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
  saveLocalBackup(id, null);
  await retry(() => deleteSlideFromDB(id));
  clearLocalBackupIfMatches(id, null);
  cache.delete(CACHE_KEY);
}
