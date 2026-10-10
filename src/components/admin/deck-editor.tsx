"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Wrench } from 'lucide-react';
import { inspectSlide, repairSlide } from '@/lib/slide-document';
import { utf8Bytes } from '@/lib/outline';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SlideFrame } from '../slide-frame';

interface DeckEditorProps {
  open: boolean;
  /** Texto de la cabecera: "Editar presentación 2" / "Nueva presentación". */
  heading: string;
  initialHtml: string;
  theme: 'light' | 'dark';
  onClose: () => void;
  onSave: (html: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Editor de HTML con vista previa. La vista previa usa el mismo motor que el
 * visor (iframe aislado), así que el HTML pegado nunca se ejecuta dentro de la
 * propia plataforma.
 */
export function DeckEditor({ open, heading, initialHtml, theme, onClose, onSave }: DeckEditorProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(initialHtml);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) setPreview(initialHtml);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, initialHtml]);

  const report = useMemo(() => inspectSlide(preview), [preview]);
  const size = useMemo(() => utf8Bytes(preview), [preview]);
  const fixable = report.issues.some((issue) => issue.fixable);

  const schedule = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPreview(textRef.current?.value ?? ''), 450);
  };

  const repair = () => {
    if (!textRef.current) return;
    const fixed = repairSlide(textRef.current.value);
    textRef.current.value = fixed;
    setPreview(fixed);
  };

  const save = () => {
    const html = textRef.current?.value ?? '';
    if (html.trim() === '') return;
    onSave(html);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="h-[min(92dvh,60rem)] max-w-[min(96vw,90rem)] gap-3 overflow-hidden p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            {report.title ? `«${report.title}»` : 'Sin título'}, {formatSize(size)}. Los cambios quedan en el borrador hasta que publiques.
          </DialogDescription>
        </DialogHeader>

        {report.issues.length > 0 && (
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-md border border-control/40 bg-control-bg px-3 py-2 text-sm">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-control" />
            <ul className="min-w-0 flex-1 space-y-0.5">
              {report.issues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
            {fixable && (
              <Button size="sm" variant="outline" onClick={repair}>
                <Wrench /> Reparar
              </Button>
            )}
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
          <textarea
            key={open ? 'abierto' : 'cerrado'}
            ref={textRef}
            defaultValue={initialHtml}
            onInput={schedule}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Código HTML de la presentación"
            placeholder="Pega aquí el archivo HTML completo de la presentación"
            className="scroll-slim min-h-[12rem] w-full resize-none rounded-md border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus-visible:border-signal"
          />
          <div className="hidden min-h-0 overflow-hidden rounded-md border lg:block">
            {preview.trim() ? (
              <SlideFrame html={preview} title="Vista previa" theme={theme} bridge={false} />
            ) : (
              <p className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                La vista previa aparece aquí en cuanto haya contenido.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={preview.trim() === ''}>
            Guardar en el borrador
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
