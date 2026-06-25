"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { IndexItem } from '@/lib/types';
import { INDEX } from '@/lib/constants';
import { saveSlide, deleteSlide, loadAllSlidesCached, forceFlushAll } from '@/lib/services/slides';
import { saveFullIndexToDB, loadFullIndexFromDB, subscribeFullIndex } from '@/lib/db';
import {
  flattenIndex,
  findItemById,
  getBreadcrumbs,
  updateItemContent,
  mergeLoadedContent,
  collectAllIds,
  collectContentIds,
  generateUniqueId,
  renameItem,
  deleteItem,
  addChildItem,
  moveItem,
  renumberIndex,
  serializeIndex,
  type DropPosition,
} from '@/lib/tree';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { AppProvider } from './app-context';
import { IndexPanel } from './index-panel';
import { ViewerPanel } from './viewer-panel';
import { cn } from '@/lib/utils';

const LOCAL_INDEX_KEY = 'fire-db-sys.index.v1';

function readLocalIndex(): IndexItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IndexItem[];
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    console.warn('[APP] Failed to read local index backup:', e);
    return null;
  }
}

function writeLocalIndex(index: IndexItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.warn('[APP] Failed to write local index backup:', e);
  }
}

function ignorePermissionError(action: () => Promise<unknown> | void): void {
  try {
    void Promise.resolve(action()).catch(() => {});
  } catch {}
}

export function AppShell() {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState<IndexItem[]>(INDEX);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const loadedSlidesRef = useRef<Set<string>>(new Set());
  const [localIndexReady, setLocalIndexReady] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);
  const lastServerSerializedRef = useRef<string | null>(null);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setIsDirty(true);
  }, []);

  const clearDirty = useCallback(() => {
    dirtyRef.current = false;
    setIsDirty(false);
  }, []);

  useEffect(() => {
    const localIndex = readLocalIndex();
    if (localIndex) {
      setIndex(localIndex);
    }
    setLocalIndexReady(true);
    setMounted(true);
  }, []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    if (!localIndexReady) return;
    writeLocalIndex(index);
  }, [index, localIndexReady]);

  const flat = useMemo(() => flattenIndex(index), [index]);
  const selectedSlide = useMemo(() => (selectedId ? findItemById(index, selectedId) : null), [index, selectedId]);
  const breadcrumbs = useMemo(() => (selectedId ? getBreadcrumbs(index, selectedId) : []), [index, selectedId]);

  const currentFlatIndex = useMemo(() => {
    if (!selectedId) return -1;
    return flat.findIndex((item) => item.id === selectedId);
  }, [flat, selectedId]);

  const prevSlideId = useMemo(() => {
    if (currentFlatIndex <= 0) return null;
    return flat[currentFlatIndex - 1]?.id ?? null;
  }, [flat, currentFlatIndex]);

  const nextSlideId = useMemo(() => {
    if (currentFlatIndex < 0 || currentFlatIndex >= flat.length - 1) return null;
    return flat[currentFlatIndex + 1]?.id ?? null;
  }, [flat, currentFlatIndex]);

  const canPresent = flat.length > 0;

  // Load slides from Firestore on mount — try full index first, then individual slides
  const bulkLoadedRef = useRef(false);
  useEffect(() => {
    if (!mounted || !localIndexReady) return;
    if (bulkLoadedRef.current) return;
    bulkLoadedRef.current = true;
    setIsLoading(true);

    (async () => {
      // Strategy 1: Try to load the complete index from Firestore (fastest, most reliable)
      try {
        const fullIndex = await loadFullIndexFromDB();
        if (fullIndex && Array.isArray(fullIndex) && fullIndex.length > 0) {
          console.log('[APP] Full index loaded from Firestore:', fullIndex.length, 'items');
          setIndex(fullIndex as IndexItem[]);
          writeLocalIndex(fullIndex as IndexItem[]);
          return;
        }
      } catch (err) {
        console.warn('[APP] Could not load full index from Firestore, trying individual slides:', err);
      }

      // Strategy 2: Fall back to loading individual slide docs and merging with default/local index
      try {
        const docs = await loadAllSlidesCached();
        console.log('[APP] Loaded', docs.length, 'individual slide docs from Firestore');
        setIndex((prev) => mergeLoadedContent(prev, docs));
        for (const d of docs) {
          if (d.content && d.content.length > 0) {
            loadedSlidesRef.current.add(d.id);
          }
        }
      } catch (err) {
        console.error('[APP] Failed to load slides from Firestore:', err);
        toast({
          title: "Error al cargar diapositivas",
          description: "No se pudieron cargar desde la base de datos. Verifica tu conexión a internet e intenta recargar.",
          variant: "destructive",
        });
      }
    })().finally(() => setIsLoading(false));
  }, [mounted, localIndexReady, toast]);

  // Real-time cross-device sync: apply remote full-index updates, but never
  // clobber unsaved local edits (guarded by dirtyRef).
  useEffect(() => {
    if (!mounted || !localIndexReady) return;
    const unsub = subscribeFullIndex(
      (remote) => {
        if (!remote || !Array.isArray(remote) || remote.length === 0) return;
        if (dirtyRef.current) return;
        const serialized = serializeIndex(remote as IndexItem[]);
        if (serialized === lastServerSerializedRef.current) return;
        lastServerSerializedRef.current = serialized;
        setIndex((prev) => {
          if (serializeIndex(prev) === serialized) return prev;
          writeLocalIndex(remote as IndexItem[]);
          return remote as IndexItem[];
        });
      },
      (err) => console.warn('[APP] Realtime index sync error:', err)
    );
    return () => unsub();
  }, [mounted, localIndexReady]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const handleSave = useCallback((id: string, content: string[] | null) => {
    setIndex((prev) => updateItemContent(prev, id, content));
    markDirty();
    const sync = !content || content.length === 0
      ? deleteSlide(id)
      : saveSlide(id, content);
    void sync.catch((err) => {
      console.error('[APP] Failed to save slide:', id, err);
    });
  }, [markDirty]);

  const handleNavigate = useCallback((slideId: string | null) => {
    if (slideId) setSelectedId(slideId);
  }, []);

  const handleRename = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setIndex((prev) => renameItem(prev, id, trimmed));
    markDirty();
  }, [markDirty]);

  const handleAddItem = useCallback((parentId: string | null) => {
    markDirty();
    setIndex((prev) => {
      const newItem: IndexItem = {
        id: generateUniqueId(prev, 'Nueva subseccion'),
        title: 'Nueva subsección',
      };
      const next = addChildItem(prev, parentId, newItem);
      setSelectedId(newItem.id);
      return next;
    });
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    const target = findItemById(index, id);
    if (!target) return;
    const contentIds = collectContentIds([target]);
    setIndex((prev) => deleteItem(prev, id));
    markDirty();
    setSelectedId((prevSelected) => {
      if (!prevSelected) return prevSelected;
      const deletedIds = new Set(collectAllIds([target]));
      return deletedIds.has(prevSelected) ? null : prevSelected;
    });
    for (const cid of contentIds) {
      loadedSlidesRef.current.delete(cid);
      void deleteSlide(cid).catch((err) => console.error('[APP] Failed to delete slide content:', cid, err));
    }
    toast({ title: "Subsección eliminada." });
  }, [index, toast, markDirty]);

  const handleMove = useCallback((sourceId: string, targetId: string, position: DropPosition) => {
    setIndex((prev) => {
      const next = moveItem(prev, sourceId, targetId, position);
      if (next === prev) return prev;
      markDirty();
      return next;
    });
  }, [markDirty]);

  const handleRenumber = useCallback(() => {
    setIndex((prev) => {
      const next = renumberIndex(prev);
      if (serializeIndex(next) === serializeIndex(prev)) {
        toast({ title: "La numeración ya está actualizada." });
        return prev;
      }
      markDirty();
      toast({ title: "Secciones renumeradas." });
      return next;
    });
  }, [markDirty, toast]);

  const togglePresentationMode = useCallback(() => {
    setIsPresentationMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('presentation-mode');
        ignorePermissionError(() => document.documentElement.requestFullscreen?.());
      } else {
        document.documentElement.classList.remove('presentation-mode');
        ignorePermissionError(() => {
          if (document.fullscreenElement) return document.exitFullscreen?.();
        });
      }
      return next;
    });
  }, []);

  // Escape key exits presentation mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPresentationMode) {
        togglePresentationMode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPresentationMode, togglePresentationMode]);

  // Fullscreen change detection
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement && isPresentationMode) {
        setIsPresentationMode(false);
        document.documentElement.classList.remove('presentation-mode');
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [isPresentationMode]);

  const handleExport = useCallback(() => {
    const data = JSON.stringify(index, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `senales-sistemas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Backup exportado." });
  }, [index, toast]);

  const handleImport = useCallback((data: string) => {
    try {
      const parsed = JSON.parse(data) as IndexItem[];
      if (!Array.isArray(parsed)) throw new Error('Formato inválido');
      setIndex(parsed);
      writeLocalIndex(parsed);
      loadedSlidesRef.current.clear();
      markDirty();
      // Persist the imported tree as the authoritative full index instead of
      // firing one write per slide in parallel (which floods Firestore's write
      // stream and triggers "resource-exhausted").
      void saveFullIndexToDB(parsed).then(() => {
        clearDirty();
        toast({ title: "Backup sincronizado con la base de datos." });
      }).catch((err) => {
        console.error('[APP] Failed to sync imported backup:', err);
        toast({
          title: "Backup importado localmente",
          description: "No se pudo sincronizar todo con Firestore. El respaldo local se conservará.",
          variant: "destructive",
        });
      });
      toast({ title: "Backup importado con éxito.", description: "Sincronizando cambios..." });
    } catch (err) {
      toast({ title: "Error al importar", description: "El archivo no tiene un formato válido.", variant: "destructive" });
    }
  }, [toast, markDirty, clearDirty]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    try {
      // 1. Save index to localStorage
      writeLocalIndex(index);

      // 2. Flush any pending per-slide writes BEFORE the bulk index write so we
      //    don't flood the Firestore write stream with simultaneous queued writes.
      await forceFlushAll();

      // 3. Save the FULL index (with content) to Firestore for cross-device sync.
      //    This document is authoritative and contains every slide's content, so
      //    there is no need to also re-write each individual slide here (doing so
      //    previously doubled the write volume and exhausted the write stream).
      await saveFullIndexToDB(index);

      // Remember what we just pushed so the realtime listener treats the echo as a no-op.
      lastServerSerializedRef.current = serializeIndex(index);
      clearDirty();
      toast({ title: "Guardado completo", description: "Todos los cambios se guardaron en Firebase. Estarán disponibles en todos tus dispositivos." });
    } catch (err) {
      console.error('[APP] Error saving all:', err);
      toast({
        title: "Error al guardar",
        description: "Se guardó localmente pero hubo un problema con Firebase. Los cambios se sincronizarán después.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [index, toast, clearDirty]);

  const appContextValue = useMemo(() => ({ togglePresentationMode }), [togglePresentationMode]);

  if (!mounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isPresentationMode) {
    return (
      <AppProvider value={appContextValue}>
        <div className="fixed inset-0 z-50 bg-background">
          <ViewerPanel
            slide={selectedSlide}
            index={index}
            canPresent={canPresent}
            onSave={handleSave}
            isPresentationMode={true}
            onNavigate={handleNavigate}
            prevSlideId={prevSlideId}
            nextSlideId={nextSlideId}
            breadcrumbs={breadcrumbs}
          />
        </div>
      </AppProvider>
    );
  }

  return (
    <AppProvider value={appContextValue}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Sidebar */}
        <div
          className={cn(
            "shrink-0 border-r border-border transition-all duration-200 overflow-hidden",
            sidebarOpen ? (isMobile ? "fixed inset-0 z-40 w-full" : "w-72 xl:w-80") : "w-0"
          )}
        >
          <IndexPanel
            index={index}
            selectedId={selectedId}
            onSelect={handleSelect}
            onExport={handleExport}
            onImport={handleImport}
            onSaveAll={handleSaveAll}
            isSaving={isSaving}
            isDirty={isDirty}
            onRename={handleRename}
            onDelete={handleDeleteItem}
            onAddItem={handleAddItem}
            onMove={handleMove}
            onRenumber={handleRenumber}
          />
        </div>

        {/* Mobile overlay backdrop */}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile toggle bar */}
          {isMobile && !sidebarOpen && (
            <div className="p-2 border-b border-border bg-card shrink-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ☰ Índice
              </button>
            </div>
          )}

          {/* Desktop toggle */}
          {!isMobile && (
            <div className="absolute top-2 left-2 z-20">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground transition-colors text-xs"
                title={sidebarOpen ? "Ocultar índice" : "Mostrar índice"}
              >
                {sidebarOpen ? '◀' : '▶'}
              </button>
            </div>
          )}

          {isLoading && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/20 z-30">
              <div className="h-full bg-primary animate-pulse w-1/3" />
            </div>
          )}

          <ViewerPanel
            slide={selectedSlide}
            index={index}
            canPresent={canPresent}
            onSave={handleSave}
            isPresentationMode={false}
            onNavigate={handleNavigate}
            prevSlideId={prevSlideId}
            nextSlideId={nextSlideId}
            breadcrumbs={breadcrumbs}
          />
        </div>
      </div>
    </AppProvider>
  );
}
