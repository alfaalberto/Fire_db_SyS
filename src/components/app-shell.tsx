"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import { IndexPanel } from '@/components/index-panel';
import { ViewerPanel } from '@/components/viewer-panel';
import { bookIndex } from '@/lib/constants';
import { initDB, loadAllSlidesFromDB, saveSlideToDB } from '@/lib/db';
import type { IndexItem } from '@/lib/types';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { useToast } from "@/hooks/use-toast";

const findSlideById = (nodes: IndexItem[], id: string): IndexItem | null => {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findSlideById(node.children, id);
            if (found) return found;
        }
    }
    return null;
};

const updateSlideContent = (nodes: IndexItem[], id: string, content: string | null): IndexItem[] => {
    return nodes.map(node => {
        if (node.id === id) return { ...node, content: content };
        if (node.children) return { ...node, children: updateSlideContent(node.children, id, content) };
        return node;
    });
};


export default function AppShell() {
    const [slidesData, setSlidesData] = useState<IndexItem[]>([]);
    const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPresentationMode, setIsPresentationMode] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const loadData = async () => {
            try {
                await initDB();
                const savedSlides = await loadAllSlidesFromDB();
                const savedSlidesMap = new Map(savedSlides.map(s => [s.id, s.content]));
                
                const mergeContent = (nodes: IndexItem[]): IndexItem[] => {
                    return nodes.map(node => ({
                        ...node,
                        content: savedSlidesMap.get(node.id) || null,
                        ...(node.children && { children: mergeContent(node.children) })
                    }));
                };

                setSlidesData(mergeContent(bookIndex));
            } catch (error) {
                console.error("No se pudo cargar la base de datos:", error);
                toast({
                    variant: "destructive",
                    title: "Error de Base de Datos",
                    description: "No se pudo cargar el contenido guardado. Se usará el índice por defecto.",
                })
                setSlidesData(bookIndex);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [toast]);

    const handleSaveSlide = useCallback(async (id: string, content: string | null) => {
        try {
            await saveSlideToDB(id, content);
            setSlidesData(prevData => updateSlideContent(prevData, id, content));
        } catch (error) {
            console.error("Error al guardar la diapositiva:", error);
            toast({
                variant: "destructive",
                title: "Error al Guardar",
                description: "Hubo un error al guardar. Revisa la consola.",
            })
        }
    }, [toast]);

    const handleClearSlide = useCallback((id: string) => {
        handleSaveSlide(id, null);
    }, [handleSaveSlide]);

    const activeSlide = useMemo(() => {
        if (!activeSlideId || !slidesData.length) return null;
        return findSlideById(slidesData, activeSlideId);
    }, [activeSlideId, slidesData]);

    if (isLoading) {
        return (
            <div className="bg-background text-foreground h-screen flex items-center justify-center">
                <div className="text-center">
                    <BookOpen size={48} className="animate-pulse mx-auto text-primary" />
                    <p className="mt-4 text-lg">Cargando visor de presentaciones...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex h-screen font-sans bg-background text-foreground ${isPresentationMode ? 'presentation-mode' : ''}`}>
             <SidebarProvider>
                {!isPresentationMode && (
                    <Sidebar>
                        <IndexPanel
                            data={slidesData}
                            activeSlideId={activeSlideId}
                            onSelect={setActiveSlideId}
                        />
                    </Sidebar>
                )}
                <SidebarInset>
                    <ViewerPanel
                        slide={activeSlide}
                        onSave={handleSaveSlide}
                        onClear={handleClearSlide}
                        isPresentationMode={isPresentationMode}
                        togglePresentationMode={() => setIsPresentationMode(p => !p)}
                    />
                </SidebarInset>
             </SidebarProvider>
        </div>
    );
}
