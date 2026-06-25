"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FileText, Maximize, Minimize, Edit, ChevronLeft, ChevronRight, PlusCircle, Bold, Italic, List, Image as ImageIcon, Code, Type, Columns, Download } from 'lucide-react';
import type { IndexItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { SlideIframe } from './slide-iframe';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAppContext } from './app-context';
import { cn } from '@/lib/utils';
import { downloadPresentation } from '@/lib/download-presentation';

interface ViewerPanelProps {
  slide: IndexItem | null;
  index: IndexItem[];
  canPresent: boolean;
  onSave: (id: string, content: string[] | null) => void;
  isPresentationMode: boolean;
  onNavigate: (slideId: string | null) => void;
  prevSlideId: string | null;
  nextSlideId: string | null;
  breadcrumbs: IndexItem[];
}

export function ViewerPanel({ slide, index, canPresent, onSave, isPresentationMode, onNavigate, prevSlideId, nextSlideId, breadcrumbs }: ViewerPanelProps) {
  const [subSlideIndex, setSubSlideIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);
  const [htmlContent, setHtmlContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { togglePresentationMode } = useAppContext();
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const prevSlideIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentId = slide?.id ?? null;
    const prevId = prevSlideIdRef.current;
    if (prevId !== currentId && currentId !== null) {
      setSubSlideIndex(0);
    }
    if (prevId !== null && currentId !== null && prevId !== currentId) {
      setIsEditing(false);
    }
    if (!isEditing) {
      const initial =
        slide?.content && slide.content.length > 0
          ? (slide.content[0] || '')
          : slide
            ? buildSectionHtml(slide, breadcrumbs)
            : buildTocHtml(index);
      setHtmlContent(initial);
    }
    prevSlideIdRef.current = currentId;
  }, [slide?.id, isEditing, slide, breadcrumbs, index]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data as { __slideLog?: boolean; level?: string; args?: unknown | unknown[] };
      if (d && d.__slideLog) {
        const lvl = (d.level || 'log') as 'log' | 'warn' | 'error';
        const rawArgs = d.args;
        const args: unknown[] = Array.isArray(rawArgs) ? rawArgs : [rawArgs];
        if (args.length > 0 && typeof args[0] === 'string') {
          if (!(args[0] as string).startsWith('[SLIDE]')) args.unshift('[SLIDE]');
        } else {
          args.unshift('[SLIDE]');
        }
        (console[lvl] || console.log)(...args);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (!isEditing) {
      const current =
        slide?.content && slide.content.length > 0
          ? (slide.content[subSlideIndex] || '')
          : slide
            ? buildSectionHtml(slide, breadcrumbs)
            : buildTocHtml(index);
      setHtmlContent(current);
    }
  }, [slide, subSlideIndex, isEditing, breadcrumbs, index]);

  useEffect(() => {
    if (!isEditing || !slide) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const currentSavedContent = slide.content && slide.content.length > 0 ? (slide.content[subSlideIndex] || '') : '';
      if (htmlContent !== currentSavedContent) {
        const newContentArray = [...(slide.content || [])];
        if (newContentArray.length === 0) {
          newContentArray.push(htmlContent);
        } else {
          newContentArray[subSlideIndex] = htmlContent;
        }
        onSave(slide.id, newContentArray);
      }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [htmlContent, isEditing, slide, subSlideIndex, onSave]);

  const hasContent = !!slide;
  const hasStoredContent = !!slide?.content && slide.content.length > 0;
  const totalSubSlides = hasStoredContent ? slide!.content!.length : 1;
  const effectiveSubSlideIndex = hasStoredContent ? Math.min(subSlideIndex, totalSubSlides - 1) : 0;
  const currentSlideContent = hasStoredContent ? (slide!.content?.[effectiveSubSlideIndex] || '') : '';

  const generatedSlideHtml = useMemo(() => {
    if (!slide) return buildTocHtml(index);
    return buildSectionHtml(slide, breadcrumbs);
  }, [slide, index, breadcrumbs]);

  const displayedSlideHtml = hasStoredContent ? currentSlideContent : generatedSlideHtml;

  const handlePrev = useCallback(() => {
    if (!hasContent) return;
    if (isPresentationMode && subSlideIndex > 0) {
      setSubSlideIndex(i => Math.max(0, i - 1));
      return;
    }
    onNavigate(prevSlideId);
  }, [hasContent, isPresentationMode, subSlideIndex, onNavigate, prevSlideId]);

  const handleNext = useCallback(() => {
    if (!hasContent) return;
    if (isPresentationMode && subSlideIndex < totalSubSlides - 1) {
      setSubSlideIndex(i => Math.min(totalSubSlides - 1, i + 1));
      return;
    }
    onNavigate(nextSlideId);
  }, [hasContent, isPresentationMode, subSlideIndex, totalSubSlides, onNavigate, nextSlideId]);

  const deleteTitle = deleteConfirmStep === 1 ? '¿Estás seguro?' : deleteConfirmStep === 2 ? 'Confirmación adicional' : 'Confirmación final';
  const deleteDescription = deleteConfirmStep === 1
    ? 'Esta acción borrará la diapositiva actual.'
    : deleteConfirmStep === 2
    ? 'Si continúas, perderás el contenido. Asegúrate de tener un backup.'
    : 'Último aviso: la diapositiva se eliminará permanentemente.';
  const deleteActionLabel = deleteConfirmStep < 3 ? 'Continuar' : 'Eliminar definitivamente';

  const handleOverlayPrev = useCallback(() => {
    if (hasStoredContent && subSlideIndex > 0) { setSubSlideIndex((i) => i - 1); return; }
    onNavigate(prevSlideId);
  }, [hasStoredContent, subSlideIndex, onNavigate, prevSlideId]);

  const handleOverlayNext = useCallback(() => {
    if (hasStoredContent && subSlideIndex < totalSubSlides - 1) { setSubSlideIndex((i) => i + 1); return; }
    onNavigate(nextSlideId);
  }, [hasStoredContent, subSlideIndex, totalSubSlides, onNavigate, nextSlideId]);

  const overlayPrevDisabled = hasStoredContent ? (subSlideIndex === 0 && !prevSlideId) : !prevSlideId;
  const overlayNextDisabled = hasStoredContent ? (subSlideIndex >= totalSubSlides - 1 && !nextSlideId) : !nextSlideId;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isPresentationMode) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) return;
      if (activeEl && (activeEl as HTMLElement).isContentEditable) return;
      let handled = false;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        if (!overlayNextDisabled) { handleOverlayNext(); handled = true; }
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        if (!overlayPrevDisabled) { handleOverlayPrev(); handled = true; }
      }
      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresentationMode, overlayNextDisabled, overlayPrevDisabled, handleOverlayNext, handleOverlayPrev]);

  const handleSave = useCallback(() => {
    if (!slide) return;
    const newContentArray = [...(slide.content || [])];
    if (newContentArray.length === 0) newContentArray.push(htmlContent);
    else newContentArray[subSlideIndex] = htmlContent;
    onSave(slide.id, newContentArray);
    setIsEditing(false);
    toast({ title: "Cambios guardados." });
  }, [slide, htmlContent, subSlideIndex, onSave, toast]);

  const handleAddNewSlide = useCallback(() => {
    if (!slide) return;
    const newContentArray = [...(slide.content || []), '<h1>Nueva Diapositiva</h1><p>Haz clic en "Editar" para añadir contenido.</p>'];
    onSave(slide.id, newContentArray);
    setSubSlideIndex(newContentArray.length - 1);
    setIsEditing(false);
    toast({ title: "Nueva diapositiva añadida." });
  }, [slide, onSave, toast]);

  const handleDeleteCurrentSubSlide = useCallback(() => {
    if (!slide || !hasStoredContent) return;
    if (totalSubSlides <= 1) {
      onSave(slide.id, []);
      setSubSlideIndex(0);
      setIsEditing(false);
      toast({ title: "Diapositiva eliminada." });
      return;
    }
    const newContentArray = [...(slide.content || [])];
    newContentArray.splice(subSlideIndex, 1);
    setSubSlideIndex(Math.max(0, Math.min(subSlideIndex, newContentArray.length - 1)));
    setIsEditing(false);
    onSave(slide.id, newContentArray);
    toast({ title: "Diapositiva eliminada." });
  }, [slide, hasStoredContent, totalSubSlides, subSlideIndex, onSave, toast]);

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) setDeleteConfirmStep(1);
  }, []);

  const handleDeleteConfirmClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (deleteConfirmStep < 3) { event.preventDefault(); setDeleteConfirmStep((prev) => prev + 1); return; }
    handleDeleteCurrentSubSlide();
    setDeleteDialogOpen(false);
    setDeleteConfirmStep(1);
  }, [deleteConfirmStep, handleDeleteCurrentSubSlide]);

  const handleDownload = useCallback(() => {
    if (!slide) return;
    downloadPresentation(slide);
    toast({ title: "Descarga iniciada.", description: `${slide.title}.html` });
  }, [slide, toast]);

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
      toast({ title: "Selecciona un archivo HTML válido.", variant: "destructive" });
    }
    if (event.target) event.target.value = '';
  }, [slide, onSave, toast]);

  const handleHtmlContentChange = useCallback((value: string) => {
    setHtmlContent(value);
    if (!isEditing || !slide) return;
    const newContentArray = [...(slide.content || [])];
    if (newContentArray.length === 0) {
      newContentArray.push(value);
    } else {
      newContentArray[subSlideIndex] = value;
    }
    onSave(slide.id, newContentArray);
  }, [isEditing, slide, subSlideIndex, onSave]);

  const insertTag = (tag: string, wrapper = true) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = htmlContent;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);
    let newText = '';
    if (tag === 'img') {
      newText = `${before}<img src="URL" alt="Descripción" class="w-full rounded-lg my-4" />${after}`;
    } else if (wrapper) {
      newText = `${before}<${tag}>${selection || 'Texto'}</${tag}>${after}`;
    } else {
      newText = `${before}<${tag} />${after}`;
    }
    handleHtmlContentChange(newText);
    setTimeout(() => textarea.focus(), 0);
  };

  if (!slide) {
    const canNavigate = !!prevSlideId || !!nextSlideId;
    return (
      <div className="flex-1 w-full bg-background flex flex-col h-full relative min-w-0 overflow-x-hidden">
        {!isPresentationMode && (
          <header className="bg-card p-2 flex flex-wrap items-center justify-between gap-2 text-foreground border-b border-border shrink-0">
            <div className="flex flex-col min-w-0 px-2 overflow-hidden">
              <div className="text-xs text-muted-foreground truncate">Índice</div>
              <div className="text-sm font-medium truncate">Selecciona un tema para comenzar</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
              <Button onClick={togglePresentationMode} variant="ghost" size="icon" disabled={!canPresent} title="Modo presentación">
                <Maximize size={18} />
              </Button>
            </div>
          </header>
        )}
        <main className="flex-1 overflow-hidden">
          <SlideIframe ref={iframeRef} content={displayedSlideHtml} title="Índice" presentationMode={isPresentationMode} />
        </main>
        {isPresentationMode && (
          <Button onClick={togglePresentationMode} variant="ghost" size="icon" className="absolute top-4 right-4 z-20 bg-background/50 hover:bg-background/80 rounded-full" title="Salir del modo presentación">
            <Minimize size={24} />
          </Button>
        )}
        {(!isEditing || isPresentationMode) && canPresent && canNavigate && (
          <>
            <Button variant="outline" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full z-10" onClick={handleOverlayPrev} disabled={overlayPrevDisabled}><ChevronLeft /></Button>
            <Button variant="outline" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full z-10" onClick={handleOverlayNext} disabled={overlayNextDisabled}><ChevronRight /></Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-background flex flex-col h-full relative min-w-0 overflow-x-hidden">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".html" className="hidden" />
      {!isPresentationMode && (
        <header className="bg-card p-2 flex flex-wrap items-center justify-between gap-2 text-foreground border-b border-border shrink-0">
          <div className="flex flex-col min-w-0 px-2 overflow-hidden">
            {breadcrumbs.length > 0 && (
              <div className="flex items-center text-xs text-muted-foreground space-x-1 truncate">
                {breadcrumbs.map((b, i) => (
                  <React.Fragment key={b.id}>
                    {i > 0 && <span className="text-muted-foreground/40">/</span>}
                    <span className={i === breadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>{b.title}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm"><PlusCircle /> Añadir</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleAddNewSlide}>Añadir diapositiva en blanco</DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>Subir archivo (.html)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!isEditing && <Button onClick={() => setIsEditing(true)} size="sm"><Edit /> Editar</Button>}
            <Button onClick={handleDownload} variant="outline" size="icon" title="Descargar presentación como HTML"><Download size={18} /></Button>
            <Button onClick={togglePresentationMode} variant="ghost" size="icon" disabled={!canPresent} title="Modo presentación"><Maximize size={18} /></Button>
          </div>
        </header>
      )}

      <main className={cn("flex-1 min-h-0", isEditing ? "overflow-y-auto" : "overflow-hidden relative")}>
        {isEditing ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-2 bg-muted border-b border-border flex flex-wrap gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => insertTag('b')} title="Negrita"><Bold size={16} /></Button>
              <Button variant="ghost" size="sm" onClick={() => insertTag('i')} title="Cursiva"><Italic size={16} /></Button>
              <Button variant="ghost" size="sm" onClick={() => insertTag('h2')} title="Subtítulo"><Type size={16} /></Button>
              <Button variant="ghost" size="sm" onClick={() => insertTag('p')} title="Párrafo"><FileText size={16} /></Button>
              <Button variant="ghost" size="sm" onClick={() => insertTag('ul')} title="Lista"><List size={16} /></Button>
              <Button variant="ghost" size="sm" onClick={() => insertTag('pre')} title="Código"><Code size={16} /></Button>
              <Button variant="ghost" size="sm" onClick={() => insertTag('img', false)} title="Imagen"><ImageIcon size={16} /></Button>
              <div className="w-px h-6 bg-border mx-1" />
              <Button variant={isSplitView ? "secondary" : "ghost"} size="sm" onClick={() => setIsSplitView(!isSplitView)} title="Vista dividida"><Columns size={16} /></Button>
            </div>
            <div className="flex-1 flex min-h-0">
              <div className={cn("flex flex-col gap-4 p-4 h-full overflow-y-auto", isSplitView ? "w-1/2 border-r" : "w-full")}>
                <Textarea ref={textareaRef} value={htmlContent} onChange={(e) => handleHtmlContentChange(e.target.value)} placeholder="Pega aquí el código HTML..." className="w-full flex-1 font-code text-sm min-h-[200px]" />
                <div className="flex justify-end items-center shrink-0 pt-2">
                  <div className="flex gap-2">
                    <Button onClick={() => setIsEditing(false)} variant="secondary">Cancelar</Button>
                    <Button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white">Guardar</Button>
                  </div>
                </div>
              </div>
              {isSplitView && (
                <div className="w-1/2 h-full overflow-y-auto bg-background p-6">
                  <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <SlideIframe
            key={`${slide.id}-${effectiveSubSlideIndex}`}
            ref={iframeRef}
            content={hasStoredContent ? (slide.content![effectiveSubSlideIndex] || '') : displayedSlideHtml}
            title={hasStoredContent ? `${slide.title} (${effectiveSubSlideIndex + 1}/${totalSubSlides})` : slide.title}
            presentationMode={isPresentationMode}
          />
        )}
      </main>

      {!isEditing && !isPresentationMode && hasStoredContent && totalSubSlides > 0 && (
        <footer className="bg-card p-2 flex flex-wrap items-center justify-center gap-4 text-foreground border-t min-w-0 overflow-x-hidden">
          <Button onClick={() => setSubSlideIndex(i => i - 1)} disabled={subSlideIndex === 0} variant="outline" size="sm">Anterior</Button>
          <div className="flex items-center gap-2">
            <span className="text-sm">{subSlideIndex + 1} / {totalSubSlides}</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSubSlides }).map((_, i) => (
                <button key={i} type="button" aria-label={`Ir a la diapositiva ${i + 1}`} onClick={() => setSubSlideIndex(i)}
                  className={cn("h-2 w-2 rounded-full transition-colors", i === subSlideIndex ? "bg-primary" : "bg-muted-foreground/40 hover:bg-muted-foreground/70")} />
              ))}
            </div>
          </div>
          <Button onClick={() => setSubSlideIndex(i => i + 1)} disabled={subSlideIndex >= totalSubSlides - 1} size="sm">Siguiente</Button>
          <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
            <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Eliminar diapositiva actual</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
                <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirmClick} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleteActionLabel}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </footer>
      )}

      {isPresentationMode && (
        <Button onClick={togglePresentationMode} variant="ghost" size="icon" className="absolute top-4 right-4 z-20 bg-background/50 hover:bg-background/80 rounded-full" title="Salir del modo presentación">
          <Minimize size={24} />
        </Button>
      )}

      {(!isEditing || isPresentationMode) && canPresent && ((hasStoredContent && totalSubSlides > 1) || prevSlideId || nextSlideId) && (
        <>
          <Button variant="outline" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full z-10" onClick={handleOverlayPrev} disabled={overlayPrevDisabled}><ChevronLeft /></Button>
          <Button variant="outline" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full z-10" onClick={handleOverlayNext} disabled={overlayNextDisabled}><ChevronRight /></Button>
        </>
      )}
    </div>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderIndexList(items: IndexItem[], depth: number, maxDepth: number): string {
  if (items.length === 0) return '';
  const listItems = items.map((item) => {
    const childrenHtml = item.children && item.children.length > 0 && depth < maxDepth ? renderIndexList(item.children, depth + 1, maxDepth) : '';
    return `<li><span>${escapeHtml(item.title)}</span>${childrenHtml}</li>`;
  }).join('');
  return `<ul>${listItems}</ul>`;
}

function buildTocHtml(index: IndexItem[]): string {
  const listHtml = renderIndexList(index, 0, 2);
  return `<main class="container"><h1>Señales y Sistemas — Temario</h1><p class="muted">Navega con las flechas del teclado en modo presentación, o selecciona un tema en el índice lateral.</p><hr />${listHtml || '<p class="muted">No hay temas cargados.</p>'}</main>`;
}

function buildSectionHtml(slide: IndexItem, breadcrumbs: IndexItem[]): string {
  const crumbs = breadcrumbs.length > 0 ? `<p class="muted">${breadcrumbs.map((b) => escapeHtml(b.title)).join(' / ')}</p>` : '';
  const hasChildren = !!slide.children && slide.children.length > 0;
  const childrenHtml = hasChildren ? `<hr /><h2>Secciones</h2>${renderIndexList(slide.children!, 0, 2)}` : '';
  const emptyHint = !hasChildren
    ? `<p class="muted">Sin contenido HTML para este tema. Usa "Editar" para crear diapositivas o importa un archivo .html.</p>`
    : `<p class="muted">Este tema contiene subsecciones. Usa el índice lateral para elegir una, o navega con flechas en modo presentación.</p>`;
  return `<main class="container">${crumbs}<h1>${escapeHtml(slide.title)}</h1>${emptyHint}${childrenHtml}</main>`;
}
