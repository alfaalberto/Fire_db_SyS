"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText, Pencil, Plus, Trash2, Check, X, GripVertical } from 'lucide-react';
import type { IndexItem as IndexItemType } from '@/lib/types';
import type { DropPosition } from '@/lib/tree';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Module-level handle on the node currently being dragged. Lets any row know
// whether it is the drag source without threading state through the whole tree.
let currentDragId: string | null = null;

const DRAG_MIME = 'application/x-index-item';

interface IndexItemProps {
  item: IndexItemType;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onAddItem: (parentId: string | null) => void;
  onMove: (sourceId: string, targetId: string, position: DropPosition) => void;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ');
}

function matchesSearch(item: IndexItemType, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (item.title.toLowerCase().includes(q)) return true;
  if (item.content && item.content.some((c) => stripHtml(c).toLowerCase().includes(q))) return true;
  if (item.children) return item.children.some((c) => matchesSearch(c, q));
  return false;
}

interface ItemActionsProps {
  onEdit: () => void;
  onAdd: () => void;
  onDelete: () => void;
}

function ItemActions({ onEdit, onAdd, onDelete }: ItemActionsProps) {
  const stop = (e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };
  return (
    <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
      <button
        type="button"
        onClick={(e) => stop(e, onEdit)}
        title="Renombrar"
        className="p-1 rounded text-sidebar-foreground/60 hover:text-primary hover:bg-sidebar-accent"
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        onClick={(e) => stop(e, onAdd)}
        title="Añadir subsección"
        className="p-1 rounded text-sidebar-foreground/60 hover:text-green-500 hover:bg-sidebar-accent"
      >
        <Plus size={13} />
      </button>
      <button
        type="button"
        onClick={(e) => stop(e, onDelete)}
        title="Eliminar"
        className="p-1 rounded text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

interface RenameFieldProps {
  initialValue: string;
  paddingLeft: number;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function RenameField({ initialValue, paddingLeft, onCommit, onCancel }: RenameFieldProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => onCommit(value);

  return (
    <div className="flex items-center gap-1 py-0.5 pr-1" style={{ paddingLeft: `${paddingLeft}px` }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 min-w-0 h-7 px-2 text-sm rounded-md bg-background border border-primary/50 text-foreground outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); commit(); }}
        title="Guardar"
        className="p-1 rounded text-green-500 hover:bg-sidebar-accent shrink-0"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        title="Cancelar"
        className="p-1 rounded text-muted-foreground hover:bg-sidebar-accent shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function IndexItemComponent({ item, depth, selectedId, onSelect, searchQuery, onRename, onDelete, onAddItem, onMove }: IndexItemProps) {
  const hasChildren = !!item.children && item.children.length > 0;
  const isActive = item.id === selectedId;
  const [isOpen, setIsOpen] = useState(depth < 1);
  const [isEditing, setIsEditing] = useState(false);
  const [dropPos, setDropPos] = useState<DropPosition | null>(null);
  const hasContent = !!item.content && item.content.length > 0;

  if (searchQuery && !matchesSearch(item, searchQuery)) return null;

  const handleClick = useCallback(() => {
    onSelect(item.id);
  }, [item.id, onSelect]);

  const handleDelete = useCallback(() => {
    if (window.confirm(`¿Eliminar "${item.title}"${hasChildren ? ' y todas sus subsecciones' : ''}? Esta acción no se puede deshacer.`)) {
      onDelete(item.id);
    }
  }, [item.id, item.title, hasChildren, onDelete]);

  const handleAdd = useCallback(() => {
    setIsOpen(true);
    onAddItem(item.id);
  }, [item.id, onAddItem]);

  const commitRename = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== item.title) onRename(item.id, trimmed);
    setIsEditing(false);
  }, [item.id, item.title, onRename]);

  // --- Drag & drop ---
  const handleDragStart = useCallback((e: React.DragEvent) => {
    currentDragId = item.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_MIME, item.id);
    e.dataTransfer.setData('text/plain', item.id);
  }, [item.id]);

  const handleDragEnd = useCallback(() => {
    currentDragId = null;
    setDropPos(null);
  }, []);

  const computePosition = (e: React.DragEvent): DropPosition => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height || 1;
    if (y < h * 0.3) return 'before';
    if (y > h * 0.7) return 'after';
    return 'inside';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!currentDragId || currentDragId === item.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropPos(computePosition(e));
  }, [item.id]);

  const handleDragLeave = useCallback(() => {
    setDropPos(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain') || currentDragId;
    const pos = dropPos ?? computePosition(e);
    setDropPos(null);
    currentDragId = null;
    if (sourceId && sourceId !== item.id) {
      if (pos === 'inside') setIsOpen(true);
      onMove(sourceId, item.id, pos);
    }
  }, [dropPos, item.id, onMove]);

  const dropClasses = cn(
    dropPos === 'before' && 'border-t-2 border-t-primary',
    dropPos === 'after' && 'border-b-2 border-b-primary',
    dropPos === 'inside' && 'ring-2 ring-inset ring-primary bg-primary/10'
  );

  if (isEditing) {
    return (
      <RenameField
        initialValue={item.title}
        paddingLeft={depth * 12 + 8}
        onCommit={commitRename}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  const rowDragProps = {
    draggable: true,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  if (!hasChildren) {
    return (
      <div
        {...rowDragProps}
        className={cn(
          "group flex items-center rounded-md transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          !isActive && "text-sidebar-foreground/80",
          dropClasses
        )}
      >
        <GripVertical size={12} className="shrink-0 ml-1 text-sidebar-foreground/25 group-hover:text-sidebar-foreground/50 cursor-grab" />
        <button
          type="button"
          onClick={handleClick}
          className="flex-1 min-w-0 text-left px-2 py-1.5 text-sm flex items-center gap-2"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {hasContent && <FileText size={12} className="shrink-0 text-primary/60" />}
          <span className="truncate">{item.title}</span>
        </button>
        <ItemActions onEdit={() => setIsEditing(true)} onAdd={handleAdd} onDelete={handleDelete} />
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        {...rowDragProps}
        className={cn(
          "group flex items-center rounded-md transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          depth === 0 && "font-semibold text-sidebar-foreground",
          depth > 0 && !isActive && "text-sidebar-foreground/80",
          dropClasses
        )}
      >
        <GripVertical size={12} className="shrink-0 ml-1 text-sidebar-foreground/25 group-hover:text-sidebar-foreground/50 cursor-grab" />
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex-1 min-w-0 text-left px-1 py-1.5 text-sm flex items-center gap-1"
            style={{ paddingLeft: `${depth * 12}px` }}
            onClick={handleClick}
          >
            {isOpen ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            <span className="truncate">{item.title}</span>
          </button>
        </CollapsibleTrigger>
        <ItemActions onEdit={() => setIsEditing(true)} onAdd={handleAdd} onDelete={handleDelete} />
      </div>
      <CollapsibleContent>
        {item.children!.map((child) => (
          <IndexItemComponent
            key={child.id}
            item={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            searchQuery={searchQuery}
            onRename={onRename}
            onDelete={onDelete}
            onAddItem={onAddItem}
            onMove={onMove}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
