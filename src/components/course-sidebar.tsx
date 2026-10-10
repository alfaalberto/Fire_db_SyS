"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { searchOutline } from '@/lib/outline';
import { getBreadcrumbs } from '@/lib/tree';
import type { OutlineItem } from '@/lib/types';
import type { Selection } from '@/hooks/use-selection';
import { BrandMark } from './brand';
import { OutlineTree, type OutlineEditing } from './outline-tree';

interface CourseSidebarProps {
  outline: OutlineItem[];
  selection: Selection;
  onSelect: (topicId: string | null, deck?: number) => void;
  /** Presente solo en modo edición. */
  editing?: OutlineEditing;
  /** Aviso sobre el estado de los datos o de la edición (encima del pie). */
  notice?: ReactNode;
  footer: ReactNode;
}

export function CourseSidebar({ outline, selection, onSelect, editing, notice, footer }: CourseSidebarProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // El capítulo del tema abierto siempre queda desplegado.
  useEffect(() => {
    if (!selection.topicId) return;
    const path = getBreadcrumbs(outline, selection.topicId);
    if (path.length < 2) return;
    setExpanded((current) => {
      const missing = path.slice(0, -1).filter((item) => !current.has(item.id));
      if (missing.length === 0) return current;
      const next = new Set(current);
      for (const item of missing) next.add(item.id);
      return next;
    });
  }, [outline, selection.topicId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
      const shortcut = ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') || (!typing && event.key === '/');
      if (!shortcut) return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggle = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const hits = useMemo(() => searchOutline(outline, deferredQuery), [outline, deferredQuery]);
  const searching = deferredQuery.trim().length > 0;

  const pick = (topicId: string, deck: number | null) => {
    onSelect(topicId, deck ?? 0);
    setQuery('');
  };

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="shrink-0 px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left"
          title="Ir al temario"
        >
          <BrandMark />
          <span className="font-display text-[1.15rem] font-semibold leading-none tracking-tight">Señales y Sistemas</span>
        </button>

        <div className="relative mt-3">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('');
                event.currentTarget.blur();
              } else if (event.key === 'Enter' && hits.length > 0) {
                pick(hits[0].topicId, hits[0].deck);
              }
            }}
            placeholder="Buscar tema o presentación"
            aria-label="Buscar tema o presentación"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm outline-none placeholder:text-soft focus-visible:border-signal [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-soft hover:text-foreground"
              aria-label="Borrar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <nav className="scroll-slim min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Temario">
        {searching ? (
          hits.length > 0 ? (
            <ul className="space-y-px">
              {hits.map((hit) => (
                <li key={`${hit.topicId}:${hit.deck ?? 'tema'}`}>
                  <button
                    type="button"
                    onClick={() => pick(hit.topicId, hit.deck)}
                    className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="block truncate text-sm font-semibold" title={hit.label}>
                      {hit.label}
                    </span>
                    {hit.deck !== null && <span className="block truncate text-xs text-muted-foreground">{hit.topicTitle}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2.5 py-3 text-sm text-muted-foreground">
              Nada coincide con «{deferredQuery.trim()}». Prueba con el número de un ejemplo o una palabra del título.
            </p>
          )
        ) : (
          <>
            <OutlineTree
              outline={outline}
              selectedId={selection.topicId}
              expanded={expanded}
              onToggle={toggle}
              onSelect={onSelect}
              editing={editing}
            />
            {editing && (
              <button
                type="button"
                onClick={() => editing.onAdd(null)}
                className="mt-2 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-4 w-4" /> Añadir capítulo
              </button>
            )}
          </>
        )}
      </nav>

      {notice}
      <div className="shrink-0 border-t px-2 py-2">{footer}</div>
    </div>
  );
}
