"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Download, Upload, Save, Moon, Sun, X, Plus, ListOrdered } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { IndexItem } from '@/lib/types';
import type { DropPosition } from '@/lib/tree';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { IndexItemComponent } from './index-item';

interface IndexPanelProps {
  index: IndexItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onExport: () => void;
  onImport: (data: string) => void;
  onSaveAll: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onAddItem: (parentId: string | null) => void;
  onMove: (sourceId: string, targetId: string, position: DropPosition) => void;
  onRenumber: () => void;
}

export function IndexPanel({
  index,
  selectedId,
  onSelect,
  onExport,
  onImport,
  onSaveAll,
  isSaving = false,
  isDirty = false,
  onRename,
  onDelete,
  onAddItem,
  onMove,
  onRenumber,
}: IndexPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      try {
        onImport(data);
      } catch {
        toast({ title: "Error al importar.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  }, [onImport, toast]);

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="p-3 border-b border-sidebar-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold tracking-tight text-primary flex items-center gap-1.5">
            Señales y Sistemas
            {isDirty && (
              <span
                title="Cambios sin guardar"
                className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"
              />
            )}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRenumber}
              title="Renumerar secciones según su orden"
            >
              <ListOrdered size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Cambiar tema"
            >
              {mounted ? (theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />) : null}
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar tema o contenido..."
            className="h-8 pl-8 pr-8 text-xs bg-sidebar-accent/50 border-sidebar-border"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Index tree */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {index.map((item) => (
          <IndexItemComponent
            key={item.id}
            item={item}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
            searchQuery={searchQuery}
            onRename={onRename}
            onDelete={onDelete}
            onAddItem={onAddItem}
            onMove={onMove}
          />
        ))}
        <button
          type="button"
          onClick={() => onAddItem(null)}
          className="w-full mt-1 px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Plus size={13} className="shrink-0" /> Añadir sección
        </button>
      </div>

      {/* Footer actions */}
      <div className="p-2 border-t border-sidebar-border shrink-0 flex items-center justify-center gap-2">
        <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="hidden" />
        <Button variant="default" size="sm" className="text-xs h-7 bg-green-600 hover:bg-green-500 text-white" onClick={onSaveAll} disabled={isSaving}>
          <Save size={12} /> {isSaving ? 'Guardando...' : isDirty ? 'Guardar *' : 'Guardar'}
        </Button>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onExport}>
          <Download size={12} /> Exportar
        </Button>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => fileInputRef.current?.click()}>
          <Upload size={12} /> Importar
        </Button>
      </div>
    </div>
  );
}
