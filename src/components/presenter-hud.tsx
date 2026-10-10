"use client";

import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeckProgress } from './slide-frame';

interface PresenterHudProps {
  visible: boolean;
  topicTitle: string;
  deckTitle: string | null;
  deckIndex: number;
  deckCount: number;
  progress: DeckProgress | null;
  hasPrev: boolean;
  hasNext: boolean;
  isFullscreen: boolean;
  /** Aviso breve al cambiar de presentación ("2 de 5 · título"). */
  announcement: string | null;
  onReveal: () => void;
  onHide: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFullscreen: () => void;
  onExit: () => void;
}

/**
 * Controles del modo presentación. Permanecen ocultos para no tapar los
 * controles propios de cada presentación: aparecen al llevar el puntero al
 * borde superior (o al tocar la pestaña central en pantallas táctiles).
 */
export function PresenterHud({
  visible,
  topicTitle,
  deckTitle,
  deckIndex,
  deckCount,
  progress,
  hasPrev,
  hasNext,
  isFullscreen,
  announcement,
  onReveal,
  onHide,
  onPrev,
  onNext,
  onToggleFullscreen,
  onExit,
}: PresenterHudProps) {
  const iconButton =
    'flex h-9 w-9 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-35';

  return (
    <>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 z-20 h-1.5" onPointerEnter={onReveal} />
      <button
        type="button"
        onClick={visible ? onHide : onReveal}
        aria-label={visible ? 'Ocultar controles' : 'Mostrar controles'}
        aria-expanded={visible}
        className={cn(
          'absolute left-1/2 top-0 z-20 flex h-5 w-16 -translate-x-1/2 items-start justify-center pt-1 transition-opacity',
          visible ? 'opacity-0' : 'opacity-40 hover:opacity-100',
        )}
      >
        <span className="h-1 w-9 rounded-full bg-neutral-500" />
      </button>

      <div
        role="toolbar"
        aria-label="Controles de la presentación"
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') onHide();
        }}
        className={cn(
          'absolute inset-x-0 top-0 z-30 flex items-center gap-1 bg-neutral-950/90 px-2 py-1.5 text-white shadow-lg backdrop-blur transition-[transform,opacity] duration-200',
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0',
        )}
      >
        <button type="button" className={iconButton} onClick={onPrev} disabled={!hasPrev} title="Presentación anterior (Ctrl + ←)">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" className={iconButton} onClick={onNext} disabled={!hasNext} title="Presentación siguiente (Ctrl + →)">
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-sm font-bold leading-tight">{deckTitle ?? topicTitle}</p>
          <p className="truncate text-xs leading-tight text-white/65">
            {deckCount > 1 ? `Presentación ${deckIndex + 1} de ${deckCount} en ${topicTitle}` : topicTitle}
          </p>
        </div>
        {progress && (
          <span className="shrink-0 px-2 font-mono text-sm tabular-nums text-white/85" title="Lámina actual">
            {progress.index + 1} / {progress.total}
          </span>
        )}
        <button
          type="button"
          className={iconButton}
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isFullscreen ? <Minimize className="h-[18px] w-[18px]" /> : <Maximize className="h-[18px] w-[18px]" />}
        </button>
        <button type="button" className={iconButton} onClick={onExit} title="Terminar la presentación (Esc)">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4">
        {announcement && (
          <p className="max-w-full truncate rounded-full bg-neutral-950/85 px-4 py-2 text-sm font-semibold text-white shadow-lg animate-in fade-in-0 slide-in-from-bottom-2">
            {announcement}
          </p>
        )}
      </div>
    </>
  );
}
