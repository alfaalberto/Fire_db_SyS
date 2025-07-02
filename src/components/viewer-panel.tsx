"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { Upload, FileText, Maximize, Minimize, Sparkles, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { IndexItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ConfirmationModal } from './confirmation-modal';
import { SlideIframe } from './slide-iframe';
import { improveHtmlWithAI } from '@/ai/flows/improve-html-with-ai';
import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';

interface ViewerPanelProps {
  slide: IndexItem | null;
  onSave: (id: string, content: string | null) => void;
  onClear: (id: string) => void;
  isPresentationMode: boolean;
  togglePresentationMode: () => void;
  onNavigate: (slideId: string | null) => void;
  prevSlideId: string | null;
  nextSlideId: string | null;
}

export function ViewerPanel({ slide, onSave, onClear, isPresentationMode, togglePresentationMode, onNavigate, prevSlideId, nextSlideId }: ViewerPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isImproving, startImproving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setHtmlContent(slide?.content || '');
    setIsEditing(false);
  }, [slide]);

  const handleSave = useCallback(() => {
    if (slide) {
      onSave(slide.id, htmlContent);
      setIsEditing(false);
      toast({ title: "Cambios guardados." });
    }
  }, [slide, htmlContent, onSave, toast]);

  const handleConfirmClear = useCallback(() => {
    if (slide) {
      onClear(slide.id);
      toast({ title: "Contenido eliminado." });
    }
    setIsClearModalOpen(false);
  }, [slide, onClear, toast]);

  const handleImproveWithAI = useCallback(() => {
    if (!htmlContent) {
      toast({ title: "No hay código para mejorar.", variant: "destructive" });
      return;
    }
    startImproving(async () => {
      try {
        const result = await improveHtmlWithAI({ htmlContent });
        if (result && result.improvedHtml) {
          setHtmlContent(result.improvedHtml);
          toast({ title: "Contenido mejorado con IA.", description: "Revisa los cambios y guarda." });
        } else {
          throw new Error("La respuesta de la IA no contiene HTML.");
        }
      } catch (error) {
        console.error("Error al mejorar con IA:", error);
        toast({ title: "Error de IA", description: (error as Error).message, variant: "destructive" });
      }
    });
  }, [htmlContent, toast]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/html") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setHtmlContent(content);
        if (slide) {
            onSave(slide.id, content);
        }
        setIsEditing(false);
      };
      reader.readAsText(file);
    } else {
      toast({ title: "Por favor, selecciona un archivo HTML válido.", variant: "destructive" });
    }
    if(event.target) event.target.value = ''; // Reset file input
  }, [slide, onSave, toast]);

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

  const hasContent = slide.content && slide.content.trim() !== '';

  return (
    <div className="flex-1 bg-background flex flex-col h-screen relative">
      <header className="bg-card p-2 flex items-center justify-between text-foreground border-b border-border shrink-0">
        <h2 className="font-bold text-lg truncate px-2">{slide.title}</h2>
        <div className="flex items-center gap-2">
          {hasContent && !isEditing && <Button onClick={() => setIsEditing(true)} size="sm"><Edit /> Editar</Button>}
          {hasContent && <Button onClick={() => setIsClearModalOpen(true)} variant="destructive" size="sm"><Trash2 /> Limpiar</Button>}
          <Button onClick={togglePresentationMode} variant="ghost" size="icon" disabled={!hasContent} title={isPresentationMode ? "Salir del modo presentación" : "Modo presentación"}>
            {isPresentationMode ? <Minimize size={18} /> : <Maximize size={18} />}
          </Button>
        </div>
      </header>

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
          <SlideIframe content={slide.content!} title={slide.title} />
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
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".html" className="hidden" />
                  </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {!isEditing && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full h-12 w-12 z-10 bg-background/50 hover:bg-background/80 disabled:opacity-30"
            onClick={() => onNavigate(prevSlideId)}
            disabled={!prevSlideId}
            title="Diapositiva anterior (←)"
          >
            <ChevronLeft size={24} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full h-12 w-12 z-10 bg-background/50 hover:bg-background/80 disabled:opacity-30"
            onClick={() => onNavigate(nextSlideId)}
            disabled={!nextSlideId}
            title="Siguiente diapositiva (→)"
          >
            <ChevronRight size={24} />
          </Button>
        </>
      )}


      <ConfirmationModal isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)} onConfirm={handleConfirmClear} title="Confirmar Limpieza">
        <p>¿Estás seguro de que quieres eliminar el contenido de esta diapositiva? Esta acción no se puede deshacer.</p>
      </ConfirmationModal>
    </div>
  );
}
