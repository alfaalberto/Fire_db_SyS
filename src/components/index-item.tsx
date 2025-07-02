"use client";

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { IndexItem as IndexItemType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface IndexItemProps {
  item: IndexItemType;
  level: number;
  activeSlideId: string | null;
  onSelect: (id: string) => void;
}

export function IndexItem({ item, level, activeSlideId, onSelect }: IndexItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isActive = activeSlideId === item.id;
  const isParentOfActive = activeSlideId ? activeSlideId.startsWith(`${item.id}.`) || activeSlideId.startsWith(`${item.id}p`) : false;
  
  const [isOpen, setIsOpen] = useState(isParentOfActive);

  useEffect(() => {
    if (isParentOfActive) {
      setIsOpen(true);
    }
  }, [isParentOfActive]);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item.id);
  };
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <div
        className={cn(
          "flex items-center justify-between group rounded-md cursor-pointer transition-colors duration-200",
          isActive ? 'bg-primary/20 text-primary' : 'hover:bg-sidebar-accent',
          `pl-${level * 2}`
        )}
        style={{ paddingLeft: `${level * 0.75}rem` }}
        onClick={handleSelect}
      >
        <span className="flex-1 truncate p-2 pr-1">{item.title}</span>
        {hasChildren && (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="sr-only">Toggle</span>
            </Button>
          </CollapsibleTrigger>
        )}
      </div>

      {hasChildren && (
        <CollapsibleContent>
          <div className="flex flex-col">
            {item.children.map(child => (
              <IndexItem
                key={child.id}
                item={child}
                level={level + 1}
                activeSlideId={activeSlideId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
