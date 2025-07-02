"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { Upload, FileText, Maximize, Minimize, Sparkles, Edit, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, PlusCircle } from 'lucide-react';
import type { IndexItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ConfirmationModal } from './confirmation-modal';
import { SlideIframe } from './slide-iframe';
import { improveHtmlWithAI } from '@/ai/flows/improve-html-with-ai';
import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ViewerPanelProps {
  slide: IndexItem | null;
  onSave: (id: string, content: string[] | null) => void;
  onClear: (id: string) => void;
  isPresentationMode: boolean;
  togglePresentationMode: () => void;
  onNavigate: (slideId: string | null) => void;
  prevSlideId: string | null;
  nextSlideId: string | null;
}

export function ViewerPanel({ slide, onSave, onClear, isPresentationMode, togglePresentationMode, onNavigate, prevSlideId, nextSlideId }: ViewerPanelProps) {
  const [subSlideIndex, setSubSlideIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isDeleteSubSlideModalOpen, setIsDeleteSubSlideModalOpen] = useState(false);
  const [isImproving, startImproving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setSubSlideIndex(0);
  }, [slide?.id]);

  useEffect(() => {
    if (slide?.content && slide.content.length > 0) {
      setHtmlContent(slide.content[subSlideIndex] || '');
    } else {
      setHtmlContent('');
    }
    setIsEditing(false);
  }, [slide, subSlideIndex]);

  const hasContent = slide?.content && slide.content.length > 0;
  const currentSlideContent = hasContent ? (slide.content?.[subSlideIndex] || '') : '';
  const totalSubSlides = hasContent ? slide.content!.length : 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (!hasContent) return;

        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        const activeEl = document.activeElement;
        if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) {
            return;
        }
        if (activeEl && (activeEl as HTMLElement).isContentEditable) {
            return;
        }

        let handled = false;
        if (event.key === 'ArrowRight') {
            if (isPresentationMode && subSlideIndex < totalSubSlides - 1) {
                setSubSlideIndex(i => i + 1);
                handled = true;
            }
        } else if (event.key === 'ArrowLeft') {
            if (isPresentationMode && subSlideIndex > 0) {
                setSubSlideIndex(i => i - 1);
                handled = true;
            }
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPresentationMode, hasContent, subSlideIndex, totalSubSlides]);

  const handleSave = useCallback(() => {
    if (!slide) return;
    const newContentArray = [...(slide.content || [])];
    
    if (newContentArray.length === 0) {
        newContentArray.push(htmlContent);
    } else {
        newContentArray[subSlideIndex] = htmlContent;
    }

    onSave(slide.id, newContentArray);
    setIsEditing(false);
    toast({ title: "Cambios guardados." });
  }, [slide, htmlContent, subSlideIndex, onSave, toast]);
  
  const handleAddNewSlide = useCallback(() => {
      if (!slide) return;
      const newContentArray = [...(slide.content || []), '<h1>Nueva Diapositiva</h1><p>Haz clic en "Editar" para empezar a añadir contenido.</p>'];
      onSave(slide.id, newContentArray);
      setSubSlideIndex(newContentArray.length - 1);
      setIsEditing(false);
      toast({ title: "Nueva diapositiva añadida." });
  }, [slide, onSave, toast]);
  
  const handleConfirmDeleteSubSlide = useCallback(() => {
    if (!slide || !slide.content) return;
    const newContentArray = slide.content.filter((_, i) => i !== subSlideIndex);
    onSave(slide.id, newContentArray.length > 0 ? newContentArray : null);
    setSubSlideIndex(prev => Math.max(0, prev - 1));
    setIsDeleteSubSlideModalOpen(false);
    toast({ title: "Diapositiva eliminada." });
  }, [slide, subSlideIndex, onSave, toast]);

  const handleConfirmClear = useCallback(() => {
    if (slide) {
      onClear(slide.id);
      toast({ title: "Contenido de la sección eliminado." });
    }
    setIsClearModalOpen(false);
  }, [slide, onClear, toast]);

  const handleImproveWithAI = useCallback(() => {
    const contentToImprove = isEditing ? htmlContent : currentSlideContent;
    if (!contentToImprove) {
      toast({ title: "No hay código para mejorar.", variant: "destructive" });
      return;
    }
    startImproving(async () => {
      try {
        const result = await improveHtmlWithAI({ htmlContent: contentToImprove });
        if (result && result.improvedHtml) {
          setHtmlContent(result.improvedHtml);
          setIsEditing(true);
          toast({ title: "Contenido mejorado con IA.", description: "Revisa los cambios y guarda." });
        } else {
          throw new Error("La respuesta de la IA no contiene HTML.");
        }
      } catch (error) {
        console.error("Error al mejorar con IA:", error);
        toast({ title: "Error de IA", description: (error as Error).message, variant: "destructive" });
      }
    });
  }, [htmlContent, currentSlideContent, isEditing, toast]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/html") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target?.result as string;
        if (slide) {
          const newContentArray = [...(slide.content || []), fileContent];
          onSave(slide.id, newContentArray);
          setSubSlideIndex(newContentArray.length - 1);
          setIsEditing(false);
          toast({ title: "Diapositiva importada con éxito." });
        }
      };
      reader.readAsText(file);
    } else {
      toast({ title: "Por favor, selecciona un archivo HTML válido.", variant: "destructive" });
    }
    if(event.target) event.target.value = '';
  }, [slide, onSave, toast]);

  const handleScroll = useCallback((direction: 'up' | 'down') => {
    if (iframeRef.current?.contentWindow) {
      const scrollAmount = iframeRef.current.clientHeight * 0.8;
      iframeRef.current.contentWindow.scrollBy({
        top: direction === 'up' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  }, []);

  if (!slide) {
    return (
      <div className="flex-1 bg-background flex items-center justify-center p-8">
        <div className="text-center">
          <FileText size={64} className="mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground">Bienvenido al Visor de Presentaciones</h2>
          <p className="mt-2 text-muted-foreground">Selecciona un tema del índice de la izquierda para comenzar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background flex flex-col h-screen relative">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".html" className="hidden" />
      {!isPresentationMode && (
          <header className="bg-card p-2 flex items-center justify-between text-foreground border-b border-border shrink-0">
            <h2 className="font-bold text-lg truncate px-2">{slide.title}</h2>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm"><PlusCircle /> Añadir</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleAddNewSlide}>
                    Añadir diapositiva en blanco
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    Subir archivo (.html)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {hasContent && !isEditing && <Button onClick={() => setIsEditing(true)} size="sm"><Edit /> Editar</Button>}
              {hasContent && <Button onClick={() => setIsDeleteSubSlideModalOpen(true)} variant="outline" size="sm"><Trash2 /> Borrar Diapositiva</Button>}
              {hasContent && <Button onClick={() => setIsClearModalOpen(true)} variant="destructive" size="sm">Limpiar Todo</Button>}
              <Button onClick={togglePresentationMode} variant="ghost" size="icon" disabled={!hasContent} title="Modo presentación">
                <Maximize size={18} />
              </Button>
            </div>
          </header>
      )}

      <main className="flex-1 overflow-y-auto">
        {isEditing ? (
          <div className="p-4 h-full flex flex-col gap-4">
            <Textarea value={htmlContent} onChange={(e) => setHtmlContent(e.target.value)} placeholder="Pega aquí el código HTML de tu diapositiva..." className="w-full flex-1 bg-background/50 text-foreground p-4 rounded-md border-border focus:ring-2 focus:ring-primary focus:outline-none font-code text-sm resize-none" />
            <div className="flex justify-between items-center">
               <Button onClick={handleImproveWithAI} className="bg-purple-600 hover:bg-purple-500 text-white" disabled={isImproving}>
                 {isImproving ? <><Skeleton className="h-4 w-4 mr-2 rounded-full animate-spin" /> Mejorando...</> : <><Sparkles size={16} /> Mejorar con IA</>}
               </Button>
              <div className="flex gap-2">
                <Button onClick={() => setIsEditing(false)} variant="secondary">Cancelar</Button>
                <Button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white">Guardar Cambios</Button>
              </div>
            </div>
          </div>
        ) : hasContent ? (
          <SlideIframe ref={iframeRef} content={currentSlideContent} title={slide.title} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <Card className="max-w-lg w-full">
              <CardContent className="pt-6 text-center">
                  <Upload size={48} className="mb-4 text-muted-foreground mx-auto" />
                  <h3 className="text-xl font-semibold text-foreground">Sin contenido para esta sección</h3>
                  <p className="mt-2 mb-6 max-w-md text-center mx-auto">Puedes añadir el contenido de la diapositiva de dos maneras:</p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button onClick={() => setIsEditing(true)} size="lg">Pegar Código HTML</Button>
                    <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="lg">Subir Archivo (.html)</Button>
                  </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {!isEditing && !isPresentationMode && hasContent && totalSubSlides > 1 && (
        <footer className="bg-card p-2 flex items-center justify-center gap-4 text-foreground border-t border-border shrink-0">
          <Button
            onClick={() => setSubSlideIndex(i => i - 1)}
            disabled={subSlideIndex === 0}
            variant="outline"
            size="sm"
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Diapositiva {subSlideIndex + 1} de {totalSubSlides}
          </span>
          <Button
            onClick={() => setSubSlideIndex(i => i + 1)}
            disabled={subSlideIndex >= totalSubSlides - 1}
            size="sm"
          >
            Siguiente
          </Button>
        </footer>
      )}
      
      {isPresentationMode && (
         <Button
            onClick={togglePresentationMode}
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-20 bg-background/50 hover:bg-background/80 rounded-full h-12 w-12"
            title="Salir del modo presentación"
        >
            <Minimize size={24} />
        </Button>
      )}

      {isPresentationMode && hasContent && totalSubSlides > 1 && (
        <div className="absolute right-4 bottom-4 z-10 flex flex-col gap-2">
            <Button
                variant="outline"
                size="icon"
                className="rounded-full h-12 w-12 bg-background/50 hover:bg-background/80 disabled:opacity-30"
                onClick={() => setSubSlideIndex(i => i - 1)}
                disabled={subSlideIndex === 0}
                title="Diapositiva anterior (↑)"
            >
                <ChevronUp size={24} />
            </Button>
            <Button
                variant="outline"
                size="icon"
                className="rounded-full h-12 w-12 bg-background/50 hover:bg-background/80 disabled:opacity-30"
                onClick={() => setSubSlideIndex(i => i + 1)}
                disabled={subSlideIndex >= totalSubSlides - 1}
                title="Siguiente diapositiva (↓)"
            >
                <ChevronDown size={24} />
            </Button>
        </div>
      )}

      {!isEditing && hasContent && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full h-12 w-12 z-10 bg-background/50 hover:bg-background/80 disabled:opacity-30"
            onClick={() => onNavigate(prevSlideId)}
            disabled={!prevSlideId}
            title="Sección anterior (←)"
          >
            <ChevronLeft size={24} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full h-12 w-12 z-10 bg-background/50 hover:bg-background/80 disabled:opacity-30"
            onClick={() => onNavigate(nextSlideId)}
            disabled={!nextSlideId}
            title="Sección siguiente (→)"
          >
            <ChevronRight size={24} />
          </Button>
        </>
      )}

      <ConfirmationModal isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)} onConfirm={handleConfirmClear} title="Confirmar Limpieza Total">
        ¿Estás seguro de que quieres eliminar <strong>todas las diapositivas</strong> de esta sección? Esta acción no se puede deshacer.
      </ConfirmationModal>

       <ConfirmationModal isOpen={isDeleteSubSlideModalOpen} onClose={() => setIsDeleteSubSlideModalOpen(false)} onConfirm={handleConfirmDeleteSubSlide} title="Confirmar Eliminación">
        ¿Estás seguro de que quieres eliminar la diapositiva actual ({subSlideIndex + 1} de {totalSubSlides})? Esta acción no se puede deshacer.
      </ConfirmationModal>
    </div>
  );
}
