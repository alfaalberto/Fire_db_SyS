"use client";

import { memo, useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, GripVertical, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { hasDecks } from '@/lib/outline';
import { splitNumberPrefix, type DropPosition } from '@/lib/tree';
import type { OutlineItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export interface OutlineEditing {
  /** Tema recién creado: su fila se abre directamente en modo renombrar. */
  renameId?: string | null;
  onRenameEnd?: () => void;
  onRename: (id: string, title: string) => void;
  onAdd: (parentId: string | null) => void;
  onDelete: (item: OutlineItem) => void;
  onMove: (sourceId: string, targetId: string, position: DropPosition) => void;
}

interface OutlineTreeProps {
  outline: OutlineItem[];
  selectedId: string | null;
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  /** Presente solo en modo edición. */
  editing?: OutlineEditing;
}

const DRAG_MIME = 'application/x-sys-topic';
// Nodo que se está arrastrando: permite que cualquier fila sepa si es el
// origen sin propagar estado por todo el árbol.
let draggingId: string | null = null;

export function OutlineTree({ outline, selectedId, expanded, onToggle, onSelect, editing }: OutlineTreeProps) {
  return (
    <ul role="tree" aria-label="Temario" className="space-y-px">
      {outline.map((item) => (
        <TreeNode
          key={item.id}
          item={item}
          depth={0}
          selectedId={selectedId}
          expanded={expanded}
          onToggle={onToggle}
          onSelect={onSelect}
          editing={editing}
        />
      ))}
    </ul>
  );
}

interface TreeNodeProps extends Omit<OutlineTreeProps, 'outline'> {
  item: OutlineItem;
  depth: number;
}

const TreeNode = memo(function TreeNode({ item, depth, selectedId, expanded, onToggle, onSelect, editing }: TreeNodeProps) {
  const [renaming, setRenaming] = useState(false);
  const [drop, setDrop] = useState<DropPosition | null>(null);

  const children = item.children ?? [];
  const isBranch = children.length > 0;
  const isOpen = isBranch && expanded.has(item.id);
  const isActive = item.id === selectedId;
  const deckCount = item.decks?.length ?? 0;
  const { number, text } = splitNumberPrefix(item.title);

  const activate = () => {
    if (isBranch) onToggle(item.id);
    // Un capítulo solo se "abre" como tema si él mismo tiene presentaciones.
    if (!isBranch || hasDecks(item)) onSelect(item.id);
  };

  const positionFor = (event: React.DragEvent): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
    if (ratio < 0.3) return 'before';
    if (ratio > 0.7) return 'after';
    return 'inside';
  };

  const dragProps = editing
    ? {
        draggable: !renaming,
        onDragStart: (event: React.DragEvent) => {
          draggingId = item.id;
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData(DRAG_MIME, item.id);
          event.dataTransfer.setData('text/plain', item.title);
        },
        onDragEnd: () => {
          draggingId = null;
          setDrop(null);
        },
        onDragOver: (event: React.DragEvent) => {
          if (!draggingId || draggingId === item.id) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDrop(positionFor(event));
        },
        onDragLeave: () => setDrop(null),
        onDrop: (event: React.DragEvent) => {
          event.preventDefault();
          event.stopPropagation();
          const sourceId = event.dataTransfer.getData(DRAG_MIME) || draggingId;
          const position = drop ?? positionFor(event);
          setDrop(null);
          draggingId = null;
          if (!sourceId || sourceId === item.id) return;
          if (position === 'inside' && !isOpen && isBranch) onToggle(item.id);
          editing.onMove(sourceId, item.id, position);
        },
      }
    : {};

  return (
    <li role="treeitem" aria-expanded={isBranch ? isOpen : undefined} aria-selected={isActive}>
      {editing && (renaming || editing.renameId === item.id) ? (
        <RenameField
          initial={item.title}
          indent={depth}
          onCancel={() => {
            setRenaming(false);
            editing.onRenameEnd?.();
          }}
          onCommit={(value) => {
            const trimmed = value.trim();
            if (trimmed && trimmed !== item.title) editing.onRename(item.id, trimmed);
            setRenaming(false);
            editing.onRenameEnd?.();
          }}
        />
      ) : (
        <div
          {...dragProps}
          className={cn(
            'group relative flex items-center rounded-md',
            isActive ? 'bg-signal/10 text-foreground' : 'hover:bg-accent',
            drop === 'inside' && 'bg-signal/15 ring-1 ring-inset ring-signal',
            drop === 'before' && 'shadow-[0_-2px_0_0_hsl(var(--signal))]',
            drop === 'after' && 'shadow-[0_2px_0_0_hsl(var(--signal))]',
          )}
        >
          {isActive && <span aria-hidden="true" className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-signal" />}
          {editing && <GripVertical aria-hidden="true" className="ml-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-soft" />}
          <button
            type="button"
            onClick={activate}
            aria-current={isActive ? 'page' : undefined}
            style={{ paddingLeft: `${depth * 14 + (editing ? 4 : 10)}px` }}
            className={cn(
              'flex min-w-0 flex-1 items-baseline gap-2 rounded-md py-1.5 pr-2 text-left text-sm leading-snug',
              depth === 0 ? 'font-bold' : 'font-medium',
              depth > 0 && deckCount === 0 && !isBranch && !isActive && 'text-muted-foreground',
            )}
          >
            {number && (
              <span className={cn('shrink-0 font-mono text-xs tabular-nums', isActive ? 'text-signal' : 'text-soft')}>{number}</span>
            )}
            <span className="min-w-0 flex-1 truncate" title={text}>
              {text}
            </span>
            {deckCount > 0 && (
              <span
                className="shrink-0 font-mono text-[11px] tabular-nums text-result"
                title={deckCount === 1 ? '1 presentación' : `${deckCount} presentaciones`}
              >
                {deckCount}
              </span>
            )}
            {isBranch && (
              <ChevronRight
                aria-hidden="true"
                className={cn('h-3.5 w-3.5 shrink-0 self-center text-soft transition-transform', isOpen && 'rotate-90')}
              />
            )}
          </button>
          {editing && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="mr-1 shrink-0 rounded p-1 text-soft opacity-0 hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label={`Opciones de ${item.title}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenaming(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Renombrar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    if (isBranch && !isOpen) onToggle(item.id);
                    editing.onAdd(item.id);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Añadir subtema
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => editing.onDelete(item)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {isOpen && (
        <ul role="group" className="space-y-px">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              editing={editing}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

function RenameField({ initial, indent, onCommit, onCancel }: { initial: string; indent: number; onCommit: (value: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <form
      className="flex items-center gap-1 py-0.5 pr-1"
      style={{ paddingLeft: `${indent * 14 + 6}px` }}
      onSubmit={(event) => {
        event.preventDefault();
        onCommit(value);
      }}
    >
      <input
        ref={inputRef}
        value={value}
        aria-label="Título"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        className="h-8 min-w-0 flex-1 rounded-md border border-signal bg-background px-2 text-sm outline-none"
      />
      <button type="submit" title="Guardar título" className="rounded p-1 text-check hover:bg-accent">
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={onCancel} title="Cancelar" className="rounded p-1 text-muted-foreground hover:bg-accent">
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}
