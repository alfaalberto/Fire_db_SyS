"use client";

import { useEffect, useRef } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Code2, Download, FileUp, MoreHorizontal, Plus, Trash2, Upload } from 'lucide-react';
import type { DeckMeta } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export interface DeckEditing {
  /** Número de avisos por presentación (texto fuera del HTML, vacía, etc.). */
  issues: number[];
  onUpload: () => void;
  onWrite: () => void;
  onEdit: (index: number) => void;
  onReplace: (index: number) => void;
  onMove: (index: number, dir: 1 | -1) => void;
  onDownload: (index: number) => void;
  onDelete: (index: number) => void;
}

interface DeckTabsProps {
  decks: DeckMeta[];
  active: number;
  onSelect: (index: number) => void;
  editing?: DeckEditing;
}

/** Pestañas con el título de cada presentación del tema. */
export function DeckTabs({ decks, active, onSelect, editing }: DeckTabsProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return (
    <div className="flex shrink-0 items-stretch border-b bg-card">
      <div
        role="tablist"
        aria-label="Presentaciones del tema"
        className="scroll-none flex min-w-0 flex-1 items-stretch overflow-x-auto px-2 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]"
      >
        {decks.map((deck, i) => {
          const selected = i === active;
          const warnings = editing?.issues[i] ?? 0;
          return (
            <div key={i} className="group relative flex shrink-0 items-center">
              <button
                ref={selected ? activeRef : undefined}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelect(i)}
                title={deck.title}
                className={cn(
                  'flex h-10 max-w-[17rem] items-center gap-2 border-b-2 px-2.5 text-sm',
                  selected ? 'border-signal font-bold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
                  editing && 'pr-1',
                )}
              >
                <span className={cn('font-mono text-xs tabular-nums', selected ? 'text-signal' : 'text-soft')}>{i + 1}</span>
                <span className="truncate">{deck.title}</span>
                {warnings > 0 && <AlertTriangle aria-label={`${warnings} avisos`} className="h-3.5 w-3.5 shrink-0 text-control" />}
              </button>
              {editing && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="rounded p-1 text-soft hover:bg-accent hover:text-foreground data-[state=open]:bg-accent"
                    aria-label={`Opciones de la presentación ${i + 1}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => editing.onEdit(i)}>
                      <Code2 className="mr-2 h-4 w-4" /> Editar HTML
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => editing.onReplace(i)}>
                      <FileUp className="mr-2 h-4 w-4" /> Reemplazar con un archivo
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => editing.onDownload(i)}>
                      <Download className="mr-2 h-4 w-4" /> Descargar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={i === 0} onSelect={() => editing.onMove(i, -1)}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Mover antes
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={i === decks.length - 1} onSelect={() => editing.onMove(i, 1)}>
                      <ArrowRight className="mr-2 h-4 w-4" /> Mover después
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => editing.onDelete(i)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
        <span aria-hidden="true" className="w-8 shrink-0" />
      </div>
      {editing && (
        <DropdownMenu>
          <DropdownMenuTrigger className="m-1.5 flex shrink-0 items-center gap-1.5 rounded-md border border-dashed border-control px-2.5 text-sm font-semibold text-control hover:bg-control-bg">
            <Plus className="h-4 w-4" /> Añadir
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={editing.onUpload}>
              <Upload className="mr-2 h-4 w-4" /> Subir archivos .html
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={editing.onWrite}>
              <Code2 className="mr-2 h-4 w-4" /> Pegar o escribir HTML
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
