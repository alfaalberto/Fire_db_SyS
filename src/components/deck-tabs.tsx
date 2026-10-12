"use client";

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Code2, Download, FileUp, GripVertical, MoreHorizontal, Plus, Trash2, Upload } from 'lucide-react';
import { slotToIndex } from '@/lib/reorder';
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
  /** Lleva la presentación `from` a la posición `to`. */
  onReorder: (from: number, to: number) => void;
  onDownload: (index: number) => void;
  onDelete: (index: number) => void;
}

interface DeckTabsProps {
  decks: DeckMeta[];
  active: number;
  onSelect: (index: number) => void;
  editing?: DeckEditing;
}

const DRAG_MIME = 'application/x-sys-deck';

/**
 * Pestañas con el título de cada presentación del tema. En modo edición se
 * reordenan arrastrándolas (o con «Mover antes / después» de su menú).
 */
export function DeckTabs({ decks, active, onSelect, editing }: DeckTabsProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  // Pestaña que se arrastra y hueco donde caería (0…n, entre pestañas).
  const [dragging, setDragging] = useState<number | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const sortable = !!editing && decks.length > 1;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const slotFor = (event: React.DragEvent, index: number): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX < rect.left + rect.width / 2 ? index : index + 1;
  };

  const endDrag = () => {
    setDragging(null);
    setSlot(null);
  };

  // El hueco solo se marca si soltar ahí cambia el orden.
  const target = dragging !== null && slot !== null && slotToIndex(dragging, slot) !== dragging ? slot : null;

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
          const dragProps = sortable
            ? {
                draggable: true,
                onDragStart: (event: React.DragEvent) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData(DRAG_MIME, String(i));
                  event.dataTransfer.setData('text/plain', deck.title);
                  setDragging(i);
                },
                onDragEnd: endDrag,
                onDragOver: (event: React.DragEvent) => {
                  if (dragging === null) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setSlot(slotFor(event, i));
                },
                onDrop: (event: React.DragEvent) => {
                  if (dragging === null) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const from = dragging;
                  const to = slotToIndex(from, slotFor(event, i));
                  endDrag();
                  if (to !== from) editing!.onReorder(from, to);
                },
              }
            : {};
          return (
            <div key={i} {...dragProps} className={cn('group relative flex shrink-0 items-center', dragging === i && 'opacity-40')}>
              {target === i && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 z-10 w-0.5 rounded-full bg-signal" />}
              {target === i + 1 && i === decks.length - 1 && (
                <span aria-hidden="true" className="absolute inset-y-1.5 right-0 z-10 w-0.5 rounded-full bg-signal" />
              )}
              {sortable && (
                <span title="Arrastra para cambiar el orden" className="ml-0.5 flex shrink-0 cursor-grab items-center self-stretch text-soft">
                  <GripVertical aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
              )}
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
                  sortable && 'pl-1',
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
                    <DropdownMenuItem disabled={i === 0} onSelect={() => editing.onReorder(i, i - 1)}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Mover antes
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={i === decks.length - 1} onSelect={() => editing.onReorder(i, i + 1)}>
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
