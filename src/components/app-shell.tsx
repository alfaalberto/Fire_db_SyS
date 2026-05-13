"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { produce } from 'immer';
import type { IndexItem } from '@/lib/types';
import { INDEX } from '@/lib/constants';
import { saveSlide, deleteSlide, loadAllSlidesCached, forceFlushAll } from '@/lib/services/slides';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { AppProvider } from './app-context';
import { IndexPanel } from './index-panel';
import { ViewerPanel } from './viewer-panel';
import { cn } from '@/lib/utils';

const LOCAL_INDEX_KEY = 'fire-db-sys.index.v1';

function flattenIndex(items: IndexItem[]): IndexItem[] {
  const result: IndexItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children && item.children.length > 0) {
      result.push(...flattenIndex(item.children));
    }
  }
  return result;
}

function findItemById(items: IndexItem[], id: string): IndexItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

function getBreadcrumbs(items: IndexItem[], targetId: string, path: IndexItem[] = []): IndexItem[] {
  for (const item of items) {
    if (item.id === targetId) return [...path, item];
    if (item.children) {
      const result = getBreadcrumbs(item.children, targetId, [...path, item]);
      if (result.length > 0) return result;
    }
  }
  return [];
}

function updateItemContent(items: IndexItem[], id: string, content: string[] | null): IndexItem[] {
  return produce(items, (draft) => {
    const item = findItemInDraft(draft, id);
    if (item) {
      item.content = content && content.length > 0 ? content : undefined;
    }
  });
}

function mergeLoadedContent(items: IndexItem[], docs: Array<{ id: string; content: string[] | null }>): IndexItem[] {
  return produce(items, (draft) => {
    for (const doc of docs) {
      const item = findItemInDraft(draft, doc.id);
      if (!item) continue;
      const hasLocalContent = !!item.content && item.content.length > 0;
      const hasLoadedContent = !!doc.content && doc.content.length > 0;
      if (!hasLocalContent && hasLoadedContent) {
        item.content = doc.content;
      }
    }
  });
}

function findItemInDraft(items: IndexItem[], id: string): IndexItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemInDraft(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

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

function collectImportedContent(items: IndexItem[]): Array<{ id: string; content: string[] | null }> {
  const docs: Array<{ id: string; content: string[] | null }> = [];
  for (const item of items) {
    if (Object.prototype.hasOwnProperty.call(item, 'content')) {
      docs.push({
        id: item.id,
        content: item.content && item.content.length > 0 ? item.content : null,
      });
    }
    if (item.children && item.children.length > 0) {
      docs.push(...collectImportedContent(item.children));
    }
  }
  return docs;
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

  useEffect(() => {
    const localIndex = readLocalIndex();
    if (localIndex) {
      setIndex(localIndex);
    }
    setLocalIndexReady(true);
    setMounted(true);
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

  // Bulk-load all slide content from Firestore on mount
  const bulkLoadedRef = useRef(false);
  useEffect(() => {
    if (!mounted || !localIndexReady) return;
    if (bulkLoadedRef.current) return;
    bulkLoadedRef.current = true;
    setIsLoading(true);
    loadAllSlidesCached()
      .then((docs) => {
        setIndex((prev) => mergeLoadedContent(prev, docs));
        for (const d of docs) {
          if (d.content && d.content.length > 0) {
            loadedSlidesRef.current.add(d.id);
          }
        }
      })
      .catch((err) => {
        console.error('[APP] Failed to bulk-load slides:', err);
        toast({
          title: "Error al cargar diapositivas",
          description: "No se pudieron cargar las diapositivas desde la base de datos. Verifica tu conexión a internet.",
          variant: "destructive",
        });
      })
      .finally(() => setIsLoading(false));
  }, [mounted, localIndexReady, toast]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const handleSave = useCallback((id: string, content: string[] | null) => {
    setIndex((prev) => updateItemContent(prev, id, content));
    const sync = !content || content.length === 0
      ? deleteSlide(id)
      : saveSlide(id, content);
    void sync.catch((err) => {
      console.error('[APP] Failed to save slide:', id, err);
    });
  }, []);

  const handleNavigate = useCallback((slideId: string | null) => {
    if (slideId) setSelectedId(slideId);
  }, []);

  const handleRelocate = useCallback((slideId: string) => {
    toast({ title: "Función de reubicación", description: "Próximamente disponible." });
  }, [toast]);

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
      const importedDocs = collectImportedContent(parsed);
      setIndex(parsed);
      writeLocalIndex(parsed);
      loadedSlidesRef.current.clear();
      void Promise.all(
        importedDocs.map((doc) => (
          doc.content && doc.content.length > 0
            ? saveSlide(doc.id, doc.content)
            : deleteSlide(doc.id)
        ))
      ).then(() => {
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
  }, [toast]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    try {
      // 1. Save index to localStorage
      writeLocalIndex(index);

      // 2. Collect all slides with content and queue saves
      const allDocs = collectImportedContent(index);
      for (const doc of allDocs) {
        if (doc.content && doc.content.length > 0) {
          void saveSlide(doc.id, doc.content);
        }
      }

      // 3. Force flush all pending writes to Firestore
      await forceFlushAll();

      toast({ title: "Guardado completo", description: "Todos los cambios se guardaron en Firebase y localmente." });
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
  }, [index, toast]);

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
            onRelocate={handleRelocate}
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
            onRelocate={handleRelocate}
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
