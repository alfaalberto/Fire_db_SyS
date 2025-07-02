"use client";

import { BookOpen } from 'lucide-react';
import type { IndexItem as IndexItemType } from '@/lib/types';
import { IndexItem } from './index-item';
import { SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';

interface IndexPanelProps {
  data: IndexItemType[];
  activeSlideId: string | null;
  onSelect: (id: string) => void;
}

export function IndexPanel({ data, activeSlideId, onSelect }: IndexPanelProps) {
  return (
    <>
      <SidebarHeader>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="text-primary" />
          <span>Señales y Sistemas</span>
        </h1>
      </SidebarHeader>
      <SidebarContent>
        <div className="p-2">
          {data.map(item => (
            <IndexItem
              key={item.id}
              item={item}
              level={0}
              activeSlideId={activeSlideId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <div className="text-xs text-muted-foreground p-2 border-t border-sidebar-border">
          <p>Visor de Presentaciones v1.13</p>
          <p>Desarrollado para el libro de Oppenheim.</p>
        </div>
      </SidebarFooter>
    </>
  );
}
