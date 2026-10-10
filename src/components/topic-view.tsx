"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  Bug,
  ChevronLeft,
  ChevronRight,
  Download,
  Link2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelLeft,
  Play,
  RotateCw,
  Upload,
  Wrench,
} from 'lucide-react';
import { topicContent, type CourseState, type CourseStore } from '@/lib/data/course-store';
import { downloadDeck, downloadTopic } from '@/lib/download-presentation';
import { hasDecks, neighbourPositions } from '@/lib/outline';
import { inspectSlide, repairSlide } from '@/lib/slide-document';
import { findItemById, getBreadcrumbs } from '@/lib/tree';
import type { CoursePosition, OutlineItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DeckTabs, type DeckEditing } from './deck-tabs';
import { PresenterHud } from './presenter-hud';
import { SlideFrame, type DeckProgress, type FitState, type SlideFrameHandle } from './slide-frame';

interface TopicViewProps {
  store: CourseStore;
  state: CourseState;
  outline: OutlineItem[];
  topicId: string;
  deck: number;
  select: (topicId: string | null, deck?: number, options?: { replace?: boolean }) => void;
  theme: 'light' | 'dark';
  editMode: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  presenting: boolean;
  onPresentingChange: (value: boolean) => void;
}

// El editor solo existe en modo edición; se descarga cuando se abre.
const DeckEditor = dynamic(() => import('./admin/deck-editor').then((mod) => mod.DeckEditor), { ssr: false });

const LAST_KEY = 'sys.ultimo';
/** "0" si el lector prefiere ver las presentaciones siempre a su tamaño natural. */
const FIT_KEY = 'sys.ajuste';
const NO_FIT: FitState = { scale: 1, needed: false };
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Huella barata del HTML: cambia la clave del iframe cuando cambia el contenido. */
function fingerprint(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}.${(hash >>> 0).toString(36)}`;
}

export function readLastVisited(): CoursePosition | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CoursePosition>;
    return typeof parsed.topicId === 'string' ? { topicId: parsed.topicId, deck: Number(parsed.deck) || 0 } : null;
  } catch {
    return null;
  }
}

export function TopicView({
  store,
  state,
  outline,
  topicId,
  deck,
  select,
  theme,
  editMode,
  sidebarOpen,
  onToggleSidebar,
  presenting,
  onPresentingChange,
}: TopicViewProps) {
  const { toast } = useToast();
  const item = useMemo(() => findItemById(outline, topicId), [outline, topicId]);
  const crumbs = useMemo(() => getBreadcrumbs(outline, topicId), [outline, topicId]);
  const content = item ? topicContent(state, item.id) : undefined;
  const decks = content?.status === 'ready' ? content.decks : null;
  const knownMetas = item?.decks;
  const deckCount = decks ? decks.length : (knownMetas?.length ?? 0);
  // El temario puede ir un paso por detrás del contenido recién descargado.
  const metas = useMemo(
    () => Array.from({ length: deckCount }, (_, i) => knownMetas?.[i] ?? { title: `Presentación ${i + 1}`, bytes: 0 }),
    [deckCount, knownMetas],
  );
  const deckIndex = Math.min(Math.max(0, deck), Math.max(0, deckCount - 1));
  const html = decks ? (decks[deckIndex] ?? null) : null;
  const deckTitle = metas[deckIndex]?.title ?? null;
  const topicHasDecks = !!item && hasDecks(item);
  const itemRev = item?.rev;

  const neighbours = useMemo(
    () => neighbourPositions(outline, { topicId, deck: deckIndex }),
    [outline, topicId, deckIndex],
  );

  const frameRef = useRef<SlideFrameHandle>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileTarget = useRef<number | 'append'>('append');
  const [progress, setProgress] = useState<DeckProgress | null>(null);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const [mathRescued, setMathRescued] = useState(0);
  const [fitState, setFitState] = useState<FitState>(NO_FIT);
  const [fitOn, setFitOn] = useState(true);
  const [hud, setHud] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ index: number | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepPresenting = useRef(false);
  const presentingRef = useRef(presenting);
  presentingRef.current = presenting;

  const frameKey = useMemo(() => (html === null ? '' : `${topicId}:${deckIndex}:${fingerprint(html)}`), [html, topicId, deckIndex]);

  /* ------------------------------ datos ------------------------------ */

  useEffect(() => {
    if (topicHasDecks) void store.ensureTopic(topicId);
  }, [store, topicId, topicHasDecks, itemRev]);

  useEffect(() => {
    if (!decks) return;
    const next = neighbours.next;
    if (next && next.topicId !== topicId) store.prefetch(next.topicId);
  }, [store, decks, neighbours.next, topicId]);

  useEffect(() => {
    if (!topicHasDecks) return;
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ topicId, deck: deckIndex }));
    } catch {
      // Solo sirve para "Continuar donde te quedaste".
    }
  }, [topicId, deckIndex, topicHasDecks]);

  useEffect(() => {
    setProgress(null);
    setRuntimeErrors([]);
    setMathRescued(0);
    setFitState(NO_FIT);
  }, [frameKey]);

  useEffect(() => {
    try {
      if (localStorage.getItem(FIT_KEY) === '0') setFitOn(false);
    } catch {
      // Sin almacenamiento se usa el ajuste automático.
    }
  }, []);

  const toggleFit = useCallback(() => {
    setFitOn((on) => {
      try {
        localStorage.setItem(FIT_KEY, on ? '0' : '1');
      } catch {
        // La preferencia vale solo para esta visita.
      }
      return !on;
    });
  }, []);

  /* --------------------------- presentación --------------------------- */

  const revealHud = useCallback((duration = 3500) => {
    setHud(true);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHud(false), duration);
  }, []);

  const hideHud = useCallback(() => {
    if (hudTimer.current) clearTimeout(hudTimer.current);
    setHud(false);
  }, []);

  const announce = useCallback((text: string) => {
    setAnnouncement(text);
    if (announceTimer.current) clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => setAnnouncement(null), 2600);
  }, []);

  useEffect(
    () => () => {
      if (hudTimer.current) clearTimeout(hudTimer.current);
      if (announceTimer.current) clearTimeout(announceTimer.current);
      if (dragTimer.current) clearTimeout(dragTimer.current);
    },
    [],
  );

  const startPresenting = useCallback(() => {
    onPresentingChange(true);
    revealHud(4500);
    announce('Avanza con ← y →. Ctrl + flecha cambia de presentación y Esc termina.');
    const element = wrapperRef.current;
    if (element?.requestFullscreen) void element.requestFullscreen().catch(() => {});
  }, [announce, onPresentingChange, revealHud]);

  const stopPresenting = useCallback(() => {
    onPresentingChange(false);
    hideHud();
    setAnnouncement(null);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [hideHud, onPresentingChange]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      keepPresenting.current = true;
      void document.exitFullscreen().catch(() => {});
    } else {
      void wrapperRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active && presentingRef.current && !keepPresenting.current) onPresentingChange(false);
      keepPresenting.current = false;
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [onPresentingChange]);

  const goTo = useCallback(
    (position: CoursePosition | null, replace: boolean) => {
      if (position) select(position.topicId, position.deck, { replace });
    },
    [select],
  );

  /** Cambia de presentación mientras se presenta (final de una, Ctrl + flecha). */
  const jump = useCallback(
    (dir: 1 | -1) => {
      const target = dir > 0 ? neighbours.next : neighbours.prev;
      if (!target) {
        announce(dir > 0 ? 'Fin del curso' : 'Inicio del curso');
        return;
      }
      goTo(target, true);
    },
    [announce, goTo, neighbours.next, neighbours.prev],
  );

  // Aviso al cambiar de presentación durante la proyección.
  const announced = useRef('');
  useEffect(() => {
    if (!presenting) {
      announced.current = `${topicId}:${deckIndex}`;
      return;
    }
    const here = `${topicId}:${deckIndex}`;
    if (announced.current === here || !item) return;
    announced.current = here;
    announce(deckCount > 1 ? `Presentación ${deckIndex + 1} de ${deckCount}: ${deckTitle ?? item.title}` : item.title);
  }, [announce, deckCount, deckIndex, deckTitle, item, presenting, topicId]);

  useEffect(() => {
    if (!presenting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key === 'Escape') {
        stopPresenting();
        return;
      }
      if ((event.key === 'f' || event.key === 'F') && !event.ctrlKey && !event.metaKey && !event.altKey) {
        toggleFullscreen();
        return;
      }
      const right = event.key === 'ArrowRight' || event.key === 'PageDown';
      const left = event.key === 'ArrowLeft' || event.key === 'PageUp';
      if ((!right && !left) || event.altKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      const dir = right ? 1 : -1;
      if (event.ctrlKey || !frameRef.current?.nav(dir)) jump(dir);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [jump, presenting, stopPresenting, toggleFullscreen]);

  // Al proyectar, el teclado debe llegar directo a la presentación.
  useEffect(() => {
    if (!presenting || !frameKey) return;
    const timer = setTimeout(() => frameRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [presenting, frameKey]);

  /* ------------------------------ edición ------------------------------ */

  const canEdit = editMode && !!item && (!topicHasDecks || !!decks);
  const currentDecks = useMemo(() => decks ?? [], [decks]);
  const issueCounts = useMemo(() => (editMode ? currentDecks.map((d) => inspectSlide(d).issues.length) : []), [editMode, currentDecks]);
  const activeReport = useMemo(() => (editMode && html !== null ? inspectSlide(html) : null), [editMode, html]);
  // Avisos para quien edita: lo que se ve al revisar el archivo y lo que la
  // presentación reveló al ejecutarse.
  const notes = useMemo(() => {
    if (!editMode || !activeReport) return [];
    const list = activeReport.issues.map((issue) => ({ key: issue.code as string, message: issue.message }));
    if (mathRescued > 0) {
      list.push({
        key: 'math',
        message:
          mathRescued === 1
            ? 'Una fórmula queda en crudo al abrir el archivo por separado; la plataforma la convierte. Revisa los delimitadores que reconoce su KaTeX.'
            : `${mathRescued} fórmulas quedan en crudo al abrir el archivo por separado; la plataforma las convierte. Revisa los delimitadores que reconoce su KaTeX.`,
      });
    }
    if (fitState.scale < 0.995) {
      list.push({ key: 'scale', message: `No cabe a lo ancho en esta ventana: se muestra reducida al ${Math.round(fitState.scale * 100)} %.` });
    } else if (fitState.scale > 1.005) {
      list.push({ key: 'scale', message: `Deja márgenes vacíos en esta ventana: se muestra ampliada al ${Math.round(fitState.scale * 100)} %.` });
    }
    return list;
  }, [activeReport, editMode, fitState, mathRescued]);

  const commitDecks = useCallback(
    (next: string[], focusIndex?: number) => {
      store.setTopicDecks(topicId, next);
      if (focusIndex !== undefined) select(topicId, Math.max(0, Math.min(focusIndex, next.length - 1)), { replace: true });
    },
    [select, store, topicId],
  );

  const addFiles = useCallback(
    async (files: File[], target: number | 'append') => {
      const accepted = files.filter((file) => /\.html?$/i.test(file.name) || file.type === 'text/html');
      if (accepted.length === 0) {
        toast({ title: 'Solo se aceptan archivos .html', variant: 'destructive' });
        return;
      }
      const tooBig = accepted.find((file) => file.size > MAX_FILE_BYTES);
      if (tooBig) {
        toast({ title: `«${tooBig.name}» pesa más de 8 MB`, description: 'Reduce las imágenes incrustadas e inténtalo de nuevo.', variant: 'destructive' });
        return;
      }
      const texts = await Promise.all(accepted.map((file) => file.text()));
      if (typeof target === 'number') {
        const next = [...currentDecks];
        next[target] = texts[0];
        commitDecks(next, target);
        toast({ title: 'Presentación reemplazada en el borrador' });
        return;
      }
      commitDecks([...currentDecks, ...texts], currentDecks.length);
      toast({ title: texts.length === 1 ? 'Presentación añadida al borrador' : `${texts.length} presentaciones añadidas al borrador` });
    },
    [commitDecks, currentDecks, toast],
  );

  // Arrastre sobre el iframe: lo avisa el puente, que no puede decir cuándo termina.
  const flagDrag = useCallback(() => {
    setDragOver(true);
    if (dragTimer.current) clearTimeout(dragTimer.current);
    dragTimer.current = setTimeout(() => setDragOver(false), 450);
  }, []);

  const openFilePicker = (target: number | 'append') => {
    fileTarget.current = target;
    fileRef.current?.click();
  };

  const deckEditing: DeckEditing | undefined = canEdit
    ? {
        issues: issueCounts,
        onUpload: () => openFilePicker('append'),
        onWrite: () => setEditor({ index: null }),
        onEdit: (index) => setEditor({ index }),
        onReplace: (index) => openFilePicker(index),
        onMove: (index, dir) => {
          const to = index + dir;
          if (to < 0 || to >= currentDecks.length) return;
          const next = [...currentDecks];
          [next[index], next[to]] = [next[to], next[index]];
          commitDecks(next, to);
        },
        onDownload: (index) => downloadDeck(currentDecks[index], metas[index]?.title ?? item!.title),
        onDelete: (index) => setPendingDelete(index),
      }
    : undefined;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Enlace copiado' });
    } catch {
      toast({ title: 'No se pudo copiar el enlace', description: window.location.href, variant: 'destructive' });
    }
  };

  /* ------------------------------ vistas ------------------------------ */

  let body: React.ReactNode;
  if (!item) {
    body = (
      <Message title="Este tema ya no existe" detail="Puede que se haya movido o eliminado del temario.">
        <Button onClick={() => select(null)}>Ver el temario</Button>
      </Message>
    );
  } else if (!topicHasDecks && item.children && item.children.length > 0) {
    body = <ChapterOverview chapter={item} onSelect={(id) => select(id)} />;
  } else if (!topicHasDecks) {
    body = canEdit ? (
      <Message title="Este tema aún no tiene presentaciones" detail="Sube uno o varios archivos .html, arrástralos aquí o pega el código.">
        <Button onClick={() => openFilePicker('append')}>
          <Upload /> Subir archivos .html
        </Button>
        <Button variant="outline" onClick={() => setEditor({ index: null })}>
          Pegar HTML
        </Button>
      </Message>
    ) : (
      <Message title="Este tema está en preparación" detail="Todavía no tiene presentaciones publicadas.">
        {neighbours.next && (
          <Button onClick={() => goTo(neighbours.next, false)}>
            Ir al siguiente tema con contenido <ChevronRight />
          </Button>
        )}
      </Message>
    );
  } else if (content?.status === 'error') {
    body = (
      <Message title="No se pudo abrir este tema" detail={content.message}>
        <Button onClick={() => void store.ensureTopic(topicId)}>
          <RotateCw /> Reintentar
        </Button>
      </Message>
    );
  } else if (html === null) {
    body = <Loading progress={state.bundleProgress} />;
  } else {
    body = (
      <SlideFrame
        key={frameKey}
        ref={frameRef}
        html={html}
        title={deckTitle ?? item.title}
        theme={theme}
        presenting={presenting}
        onProgress={setProgress}
        onEdge={jump}
        onJump={jump}
        onEscape={stopPresenting}
        onFileDrag={canEdit ? flagDrag : undefined}
        onFiles={canEdit ? (files) => void addFiles(files, 'append') : undefined}
        onRuntimeError={(message) => setRuntimeErrors((list) => (list.length >= 8 || list.includes(message) ? list : [...list, message]))}
        onMathRescue={setMathRescued}
        fit={fitOn}
        onFit={setFitState}
      />
    );
  }

  const canPresent = html !== null;

  return (
    <div
      ref={wrapperRef}
      className={cn('flex min-w-0 flex-col bg-background', presenting ? 'fixed inset-0 z-50' : 'h-full flex-1')}
      onDragOver={
        canEdit
          ? (event) => {
              if (!event.dataTransfer.types.includes('Files')) return;
              event.preventDefault();
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={
        canEdit
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
            }
          : undefined
      }
      onDrop={
        canEdit
          ? (event) => {
              if (!event.dataTransfer.types.includes('Files')) return;
              event.preventDefault();
              setDragOver(false);
              void addFiles(Array.from(event.dataTransfer.files), 'append');
            }
          : undefined
      }
    >
      {!presenting && (
        <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-card px-2">
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} title={sidebarOpen ? 'Ocultar el temario' : 'Mostrar el temario'} aria-pressed={sidebarOpen}>
            <PanelLeft />
          </Button>
          <nav aria-label="Ubicación" className="min-w-0 flex-1 px-1">
            <ol className="flex min-w-0 items-baseline gap-1.5 text-sm">
              {crumbs.map((crumb, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <li key={crumb.id} className={cn('flex min-w-0 items-baseline gap-1.5', last ? 'shrink' : 'hidden shrink-[3] md:flex')}>
                    {i > 0 && <span aria-hidden="true" className="hidden text-soft md:inline">/</span>}
                    <span className={cn('truncate', last ? 'font-bold' : 'text-muted-foreground')} title={crumb.title}>
                      {crumb.title}
                    </span>
                  </li>
                );
              })}
            </ol>
          </nav>

          {editMode && runtimeErrors.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-destructive hover:bg-accent">
                <Bug className="h-4 w-4" /> {runtimeErrors.length}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-md">
                <DropdownMenuLabel>Errores de ejecución de esta presentación</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {runtimeErrors.map((message) => (
                  <p key={message} className="break-words px-2 py-1 font-mono text-xs">
                    {message}
                  </p>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {progress && (
            <span className="hidden shrink-0 px-2 font-mono text-xs tabular-nums text-muted-foreground sm:inline" title="Lámina actual de la presentación">
              {progress.index + 1} / {progress.total}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={() => goTo(neighbours.prev, false)} disabled={!neighbours.prev} title="Presentación anterior">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => goTo(neighbours.next, false)} disabled={!neighbours.next} title="Presentación siguiente">
            <ChevronRight />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Más opciones" disabled={!item}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void copyLink()}>
                <Link2 className="mr-2 h-4 w-4" /> Copiar enlace a este tema
              </DropdownMenuItem>
              {fitState.needed && (
                <DropdownMenuItem onSelect={toggleFit}>
                  {fitOn ? <Maximize2 className="mr-2 h-4 w-4" /> : <Minimize2 className="mr-2 h-4 w-4" />}
                  {fitOn ? `Ver a tamaño real (ahora al ${Math.round(fitState.scale * 100)} %)` : 'Ajustar a la pantalla'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={html === null} onSelect={() => html !== null && downloadDeck(html, deckTitle ?? item!.title)}>
                <Download className="mr-2 h-4 w-4" /> Descargar esta presentación
              </DropdownMenuItem>
              {deckCount > 1 && (
                <DropdownMenuItem
                  disabled={!decks}
                  onSelect={() =>
                    decks &&
                    downloadTopic(
                      item!.title,
                      decks.map((d, i) => ({ html: d, title: metas[i]?.title ?? `Presentación ${i + 1}` })),
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" /> Descargar el tema completo
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={startPresenting} disabled={!canPresent} size="sm" className="ml-1">
            <Play /> Presentar
          </Button>
        </header>
      )}

      {!presenting && item && (deckCount > 1 || (canEdit && topicHasDecks)) && (
        <DeckTabs decks={metas} active={deckIndex} onSelect={(i) => select(topicId, i, { replace: true })} editing={deckEditing} />
      )}

      {!presenting && notes.length > 0 && activeReport && (
        <div className="flex shrink-0 flex-wrap items-start gap-x-3 gap-y-2 border-b border-control/40 bg-control-bg px-3 py-2 text-sm">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-control" />
          <ul className="min-w-0 flex-1 space-y-0.5">
            {notes.map((note) => (
              <li key={note.key}>{note.message}</li>
            ))}
          </ul>
          {canEdit && activeReport.issues.some((issue) => issue.fixable) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const next = [...currentDecks];
                next[deckIndex] = repairSlide(next[deckIndex]);
                commitDecks(next);
                toast({ title: 'Presentación reparada en el borrador' });
              }}
            >
              <Wrench /> Reparar
            </Button>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {body}
        {presenting && item && (
          <PresenterHud
            visible={hud}
            topicTitle={item.title}
            deckTitle={deckTitle}
            deckIndex={deckIndex}
            deckCount={deckCount}
            progress={progress}
            hasPrev={!!neighbours.prev}
            hasNext={!!neighbours.next}
            isFullscreen={isFullscreen}
            announcement={announcement}
            onReveal={() => revealHud(6000)}
            onHide={hideHud}
            onPrev={() => {
              jump(-1);
              frameRef.current?.focus();
            }}
            onNext={() => {
              jump(1);
              frameRef.current?.focus();
            }}
            onToggleFullscreen={toggleFullscreen}
            onExit={stopPresenting}
          />
        )}
        {dragOver && (
          <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-control bg-control-bg/90 text-lg font-bold text-control">
            Suelta los archivos .html para añadirlos a este tema
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".html,.htm,text/html"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) void addFiles(files, fileTarget.current);
        }}
      />

      {editor && item && (
        <DeckEditor
          open
          heading={editor.index === null ? `Nueva presentación en ${item.title}` : `Editar presentación ${editor.index + 1} de ${item.title}`}
          initialHtml={editor.index === null ? '' : (currentDecks[editor.index] ?? '')}
          theme={theme}
          onClose={() => setEditor(null)}
          onSave={(value) => {
            const next = [...currentDecks];
            const at = editor.index ?? next.length;
            next[at] = value;
            commitDecks(next, at);
            setEditor(null);
            toast({ title: 'Guardado en el borrador', description: 'Publica los cambios para que los vean los alumnos.' });
          }}
        />
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta presentación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará «{pendingDelete !== null ? (metas[pendingDelete]?.title ?? `Presentación ${pendingDelete + 1}`) : ''}» del borrador. Dejará de
              verse cuando publiques; hasta entonces puedes descartar los cambios para recuperarla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete === null) return;
                const next = currentDecks.filter((_, i) => i !== pendingDelete);
                commitDecks(next, Math.min(pendingDelete, next.length - 1));
                setPendingDelete(null);
              }}
            >
              Eliminar presentación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Message({ title, detail, children }: { title: string; detail?: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {detail && <p className="mt-2 text-muted-foreground">{detail}</p>}
        {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
      </div>
    </div>
  );
}

function Loading({ progress }: { progress: { done: number; total: number } | null }) {
  const ratio = progress && progress.total > 0 ? progress.done / progress.total : null;
  return (
    <div className="flex h-full items-center justify-center p-6" role="status" aria-live="polite">
      <div className="w-64 text-center">
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          {ratio === null ? (
            <div className="load-sweep h-full w-1/3 rounded-full bg-signal" />
          ) : (
            <div className="h-full rounded-full bg-signal transition-[width] duration-300" style={{ width: `${Math.max(4, ratio * 100)}%` }} />
          )}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {progress ? `Descargando el curso: parte ${progress.done} de ${progress.total}` : 'Descargando la presentación'}
        </p>
      </div>
    </div>
  );
}

function ChapterOverview({ chapter, onSelect }: { chapter: OutlineItem; onSelect: (id: string) => void }) {
  return (
    <div className="scroll-slim h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">{chapter.title}</h1>
        <ul className="mt-6 border-t">
          {(chapter.children ?? []).map((child) => {
            const count = child.decks?.length ?? 0;
            return (
              <li key={child.id} className="border-b">
                <button type="button" onClick={() => onSelect(child.id)} className="flex w-full items-baseline gap-4 py-3 text-left hover:text-signal">
                  <span className={cn('min-w-0 flex-1 text-lg font-semibold', count === 0 && 'text-muted-foreground')}>{child.title}</span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {count === 0 ? 'En preparación' : count === 1 ? '1 presentación' : `${count} presentaciones`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
