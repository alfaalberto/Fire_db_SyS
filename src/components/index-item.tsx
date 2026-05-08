"use client";

import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, GripVertical, FileText } from 'lucide-react';
import type { IndexItem as IndexItemType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface IndexItemProps {
  item: IndexItemType;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
}

function matchesSearch(item: IndexItemType, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (item.title.toLowerCase().includes(q)) return true;
  if (item.children) return item.children.some((c) => matchesSearch(c, q));
  return false;
}

export function IndexItemComponent({ item, depth, selectedId, onSelect, searchQuery }: IndexItemProps) {
  const hasChildren = !!item.children && item.children.length > 0;
  const isActive = item.id === selectedId;
  const [isOpen, setIsOpen] = useState(depth < 1);
  const hasContent = !!item.content && item.content.length > 0;

  if (searchQuery && !matchesSearch(item, searchQuery)) return null;

  const handleClick = useCallback(() => {
    onSelect(item.id);
  }, [item.id, onSelect]);

  if (!hasChildren) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 group",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          !isActive && "text-sidebar-foreground/80"
        )}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        {hasContent && <FileText size={12} className="shrink-0 text-primary/60" />}
        <span className="truncate">{item.title}</span>
      </button>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex-1 text-left px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1 group",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              depth === 0 && "font-semibold text-sidebar-foreground",
              depth > 0 && !isActive && "text-sidebar-foreground/80"
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={handleClick}
          >
            {isOpen ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            <span className="truncate">{item.title}</span>
          </button>
        </CollapsibleTrigger>
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
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
