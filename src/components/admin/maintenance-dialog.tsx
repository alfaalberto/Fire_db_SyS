"use client";

import { useMemo, useState } from 'react';
import { effectiveOutline, type CourseState, type CourseStore } from '@/lib/data/course-store';
import { courseStats, topicsWithDecks } from '@/lib/outline';
import { inspectSlide, repairSlide, type SlideIssue } from '@/lib/slide-document';
import { findItemById } from '@/lib/tree';
import type { LegacyUsage } from '@/lib/admin/writer';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface MaintenanceDialogProps {
  open: boolean;
  onClose: () => void;
  store: CourseStore;
  state: CourseState;
  /** Publica (y, si hace falta, migra). Devuelve `true` si terminó bien. */
  onPublish: () => Promise<boolean>;
  publishing: boolean;
  onOpenTopic: (topicId: string, deck: number) => void;
}

interface Finding {
  topicId: string;
  topicTitle: string;
  deck: number;
  issues: SlideIssue[];
}

function megabytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function describeError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') return 'Firestore rechazó la operación: la cuenta no tiene permiso de docente o las reglas no están publicadas.';
  return error instanceof Error ? error.message : 'Error desconocido.';
}

export function MaintenanceDialog({ open, onClose, store, state, onPublish, publishing, onOpenTopic }: MaintenanceDialogProps) {
  const { toast } = useToast();
  const outline = effectiveOutline(state);
  const stats = useMemo(() => courseStats(outline), [outline]);

  const [usage, setUsage] = useState<LegacyUsage | null>(null);
  const [usageBusy, setUsageBusy] = useState(false);
  const [confirmScope, setConfirmScope] = useState<'stale' | 'all' | null>(null);
  const [cleaning, setCleaning] = useState<{ done: number; total: number } | null>(null);

  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [auditing, setAuditing] = useState<{ done: number; total: number } | null>(null);

  const analyse = async () => {
    setUsageBusy(true);
    try {
      const { legacyUsage } = await import('@/lib/admin/writer');
      setUsage(await legacyUsage());
    } catch (error) {
      toast({ title: 'No se pudo analizar el almacenamiento', description: describeError(error), variant: 'destructive' });
    } finally {
      setUsageBusy(false);
    }
  };

  const clean = async (scope: 'stale' | 'all') => {
    setConfirmScope(null);
    setCleaning({ done: 0, total: 1 });
    try {
      const { cleanLegacyStorage, legacyUsage } = await import('@/lib/admin/writer');
      const removed = await cleanLegacyStorage(scope, (done, total) => setCleaning({ done, total }));
      setUsage(await legacyUsage());
      toast({ title: 'Espacio liberado', description: `Se borraron ${removed} partes del formato anterior.` });
    } catch (error) {
      toast({ title: 'No se pudo completar la limpieza', description: describeError(error), variant: 'destructive' });
    } finally {
      setCleaning(null);
    }
  };

  const audit = async () => {
    const ids = topicsWithDecks(outline);
    setAuditing({ done: 0, total: ids.length });
    const found: Finding[] = [];
    try {
      let done = 0;
      for (const id of ids) {
        const decks = await store.readDecks(id);
        const title = findItemById(outline, id)?.title ?? id;
        decks.forEach((html, deck) => {
          const { issues } = inspectSlide(html);
          if (issues.length > 0) found.push({ topicId: id, topicTitle: title, deck, issues });
        });
        done += 1;
        setAuditing({ done, total: ids.length });
      }
      setFindings(found);
    } catch (error) {
      toast({ title: 'La revisión se interrumpió', description: describeError(error), variant: 'destructive' });
    } finally {
      setAuditing(null);
    }
  };

  const fixableTopics = useMemo(
    () => Array.from(new Set((findings ?? []).filter((f) => f.issues.some((issue) => issue.fixable)).map((f) => f.topicId))),
    [findings],
  );

  const repairAll = async () => {
    try {
      for (const id of fixableTopics) {
        const decks = await store.readDecks(id);
        store.setTopicDecks(id, decks.map(repairSlide));
      }
      toast({ title: 'Reparaciones en el borrador', description: 'Revisa el resultado y publica cuando esté listo.' });
      setFindings(null);
    } catch (error) {
      toast({ title: 'No se pudieron aplicar las reparaciones', description: describeError(error), variant: 'destructive' });
    }
  };

  const staleCount = usage ? usage.chunkDocs - usage.liveChunks : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mantenimiento</DialogTitle>
          <DialogDescription>
            {stats.decks} presentaciones en {stats.topicsWithDecks} temas, {megabytes(stats.bytes)} de HTML.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2 border-t pt-4">
          <h3 className="font-display text-lg font-semibold">Formato de la base de datos</h3>
          {state.format === 'v2' ? (
            <p className="text-sm text-muted-foreground">
              Formato nuevo: al abrir la plataforma solo se descarga el temario y cada tema se baja cuando se abre.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {state.format === 'legacy'
                  ? 'Formato anterior: el curso completo viaja en un solo paquete, así que la primera visita de cada alumno descarga todo el contenido. Migrar no borra nada: copia cada tema a su propio documento y crea el temario ligero.'
                  : 'La base de datos está vacía. Al publicar se creará con el formato nuevo.'}
              </p>
              {state.format === 'legacy' && (
                <Button onClick={() => void onPublish()} disabled={publishing}>
                  {publishing ? 'Migrando…' : 'Migrar al formato nuevo'}
                </Button>
              )}
            </>
          )}
        </section>

        <section className="space-y-2 border-t pt-4">
          <h3 className="font-display text-lg font-semibold">Espacio del formato anterior</h3>
          <p className="text-sm text-muted-foreground">
            La versión anterior guardaba una copia completa del curso en cada «Guardar» y nunca borraba las previas.
          </p>
          {usage ? (
            usage.chunkDocs === 0 ? (
              <p className="text-sm font-semibold text-check">No queda nada del formato anterior.</p>
            ) : (
              <p className="text-sm">
                Hay <strong>{usage.chunkDocs}</strong> partes guardadas y solo <strong>{usage.liveChunks}</strong> están en uso. Las{' '}
                {staleCount} sobrantes ocupan hasta {megabytes(usage.staleBytesEstimate)}.
              </p>
            )
          ) : null}
          {cleaning ? (
            <p className="text-sm text-muted-foreground" role="status">
              Borrando {cleaning.done} de {cleaning.total}…
            </p>
          ) : confirmScope ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 p-3">
              <p className="min-w-0 flex-1 text-sm">
                {confirmScope === 'stale'
                  ? `Se borrarán ${staleCount} partes que ninguna versión de la plataforma usa. No se puede deshacer.`
                  : 'Se borrará todo el formato anterior, incluida su versión vigente. Hazlo solo después de migrar y de exportar un respaldo. No se puede deshacer.'}
              </p>
              <Button variant="outline" size="sm" onClick={() => setConfirmScope(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={() => void clean(confirmScope)}>
                Borrar
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void analyse()} disabled={usageBusy}>
                {usageBusy ? 'Analizando…' : usage ? 'Volver a analizar' : 'Analizar'}
              </Button>
              {usage && staleCount > 0 && (
                <Button variant="outline" onClick={() => setConfirmScope('stale')}>
                  Borrar las partes sobrantes
                </Button>
              )}
              {usage && state.format === 'v2' && usage.hasLegacyIndex && (
                <Button variant="outline" onClick={() => setConfirmScope('all')}>
                  Borrar todo el formato anterior
                </Button>
              )}
            </div>
          )}
        </section>

        <section className="space-y-2 border-t pt-4">
          <h3 className="font-display text-lg font-semibold">Revisión de las presentaciones</h3>
          <p className="text-sm text-muted-foreground">
            Busca presentaciones vacías, plantillas sin contenido, texto fuera del documento HTML y recursos bloqueados.
          </p>
          {auditing ? (
            <p className="text-sm text-muted-foreground" role="status">
              Revisando {auditing.done} de {auditing.total} temas…
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void audit()}>
                {findings ? 'Volver a revisar' : 'Revisar todo el curso'}
              </Button>
              {fixableTopics.length > 0 && <Button onClick={() => void repairAll()}>Reparar lo que se corrige solo</Button>}
            </div>
          )}
          {findings &&
            (findings.length === 0 ? (
              <p className="text-sm font-semibold text-check">Ninguna presentación tiene avisos.</p>
            ) : (
              <ul className="scroll-slim max-h-64 divide-y overflow-y-auto rounded-md border">
                {findings.map((finding) => (
                  <li key={`${finding.topicId}:${finding.deck}`} className="flex items-start gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold">
                        {finding.topicTitle}, presentación {finding.deck + 1}
                      </p>
                      {finding.issues.map((issue) => (
                        <p key={issue.code} className="text-muted-foreground">
                          {issue.message}
                        </p>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onOpenTopic(finding.topicId, finding.deck);
                        onClose();
                      }}
                    >
                      Abrir
                    </Button>
                  </li>
                ))}
              </ul>
            ))}
        </section>
      </DialogContent>
    </Dialog>
  );
}
