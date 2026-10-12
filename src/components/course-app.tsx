"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { PanelLeft, RotateCw } from 'lucide-react';
import type { PublishProgress } from '@/lib/admin/writer';
import type { CourseSnapshot } from '@/lib/data/course-repo';
import { effectiveOutline } from '@/lib/data/course-store';
import { downloadBackup } from '@/lib/download-presentation';
import { isOutlineError, parseIndexBackup } from '@/lib/outline';
import { addChildItem, flattenIndex, moveItem, renameItem, renumberIndex, type DropPosition } from '@/lib/tree';
import type { CoursePosition, OutlineItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAdmin } from '@/hooks/use-admin';
import { useCourse } from '@/hooks/use-course';
import { useSelection } from '@/hooks/use-selection';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AdminMenu } from './admin/admin-menu';
import { CourseSidebar } from './course-sidebar';
import { HomeView } from './home-view';
import type { OutlineEditing } from './outline-tree';
import { readLastVisited, TopicView } from './topic-view';

// Solo lo usa el docente: no forma parte de lo que descargan los alumnos.
const MaintenanceDialog = dynamic(() => import('./admin/maintenance-dialog').then((mod) => mod.MaintenanceDialog), { ssr: false });

const PANEL_KEY = 'sys.panel';
/** "0" si el docente prefiere ver el curso como lo ven los alumnos. */
const EDIT_KEY = 'sys.edicion';

const PHASE_TEXT: Record<PublishProgress['phase'], string> = {
  checking: 'Comprobando el servidor',
  comparing: 'Comparando temas',
  writing: 'Subiendo temas',
  deleting: 'Quitando temas eliminados',
  outline: 'Publicando el temario',
};

function describeError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') {
    return 'Firestore rechazó la escritura: la cuenta no tiene permiso de docente o las reglas no están publicadas.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Error desconocido.';
}

export function CourseApp({ initial }: { initial: CourseSnapshot | null }) {
  const { store, state } = useCourse(initial);
  const admin = useAdmin();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const theme: 'light' | 'dark' = resolvedTheme === 'light' ? 'light' : 'dark';

  const isAdmin = admin.state.status === 'admin';
  const outline = effectiveOutline(state);
  const { selection, select } = useSelection(outline);

  const [collapsed, setCollapsed] = useState(false);
  // En pantallas angostas el temario es un panel deslizable.
  const [isDesktop, setIsDesktop] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  // Con sesión de docente las herramientas de edición están a la vista, salvo
  // que él mismo las haya ocultado (la preferencia se recuerda).
  const [editWanted, setEditWanted] = useState(true);
  const [lastVisited, setLastVisited] = useState<CoursePosition | null>(null);
  const [publishing, setPublishing] = useState<PublishProgress | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pendingTopicDelete, setPendingTopicDelete] = useState<OutlineItem | null>(null);
  const [maintenance, setMaintenance] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);

  const editMode = isAdmin && editWanted;
  const hasDraft = isAdmin && state.draft !== null;

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(PANEL_KEY) === '0');
      if (localStorage.getItem(EDIT_KEY) === '0') setEditWanted(false);
    } catch {
      // Preferencias opcionales.
    }
    setLastVisited(readLastVisited());
    const query = window.matchMedia('(min-width: 768px)');
    const sync = () => {
      setIsDesktop(query.matches);
      if (query.matches) setDrawerOpen(false);
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // El borrador solo existe para el docente con sesión iniciada.
  useEffect(() => {
    if (isAdmin) {
      void store.loadDraft().then((found) => {
        if (found) setEditWanted(true);
      });
    } else {
      store.suspendDraft();
    }
  }, [isAdmin, store]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') store.flushDraft();
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [store]);

  useEffect(() => {
    if (!selection.topicId) setLastVisited(readLastVisited());
    // Cualquier cambio de tema (también con atrás/adelante) cierra el panel móvil.
    setDrawerOpen(false);
  }, [selection.topicId, selection.deck]);

  const changeEditMode = useCallback((value: boolean) => {
    setEditWanted(value);
    try {
      localStorage.setItem(EDIT_KEY, value ? '1' : '0');
    } catch {
      // La preferencia vale solo para esta visita.
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isDesktop) {
      setCollapsed((value) => {
        try {
          localStorage.setItem(PANEL_KEY, value ? '1' : '0');
        } catch {
          // Preferencia opcional.
        }
        return !value;
      });
    } else {
      setDrawerOpen((value) => !value);
    }
  }, [isDesktop]);

  const pick = useCallback(
    (topicId: string | null, deck = 0) => {
      select(topicId, deck);
      setDrawerOpen(false);
    },
    [select],
  );

  /* ------------------------------ edición ------------------------------ */

  const editing: OutlineEditing | undefined = useMemo(() => {
    if (!editMode) return undefined;
    return {
      renameId,
      onRenameEnd: () => setRenameId(null),
      onRename: (id: string, title: string) => store.editOutline((current) => renameItem(current, id, title)),
      onAdd: (parentId: string | null) => {
        const id = `nuevo-${Date.now().toString(36)}`;
        store.editOutline((current) => addChildItem(current, parentId, { id, title: parentId ? 'Nuevo tema' : 'Nuevo capítulo' }));
        setRenameId(id);
      },
      onDelete: (item: OutlineItem) => setPendingTopicDelete(item),
      onMove: (sourceId: string, targetId: string, position: DropPosition) =>
        store.editOutline((current) => moveItem(current, sourceId, targetId, position)),
    };
  }, [editMode, renameId, store]);

  const renumber = useCallback(() => {
    const before = effectiveOutline(store.getState());
    const after = renumberIndex(before);
    if (after === before) {
      toast({ title: 'La numeración ya está al día' });
      return;
    }
    store.editOutline(() => after);
    toast({ title: 'Temario renumerado en el borrador' });
  }, [store, toast]);

  const publish = useCallback(
    async (force = false): Promise<boolean> => {
      setPublishing({ phase: 'checking', done: 0, total: 1 });
      try {
        const { publishCourse } = await import('@/lib/admin/writer');
        const current = store.getState();
        const result = await publishCourse({
          server: { format: current.format, outline: current.outline, stamp: current.stamp },
          draft: current.draft,
          readDecks: (id) => store.readDecks(id),
          force,
          onProgress: setPublishing,
        });
        await store.applyPublished(result.snapshot, result.written, result.deleted);
        toast({
          title: 'Cambios publicados',
          description:
            result.written.size + result.deleted.length === 0
              ? 'El temario quedó actualizado.'
              : `${result.written.size} temas actualizados${result.deleted.length ? ` y ${result.deleted.length} retirados` : ''}.`,
        });
        return true;
      } catch (error) {
        if ((error as { name?: string } | null)?.name === 'PublishConflictError') {
          setConflict(true);
        } else {
          toast({ title: 'No se pudo publicar', description: `${describeError(error)} El borrador sigue intacto; puedes reintentar.`, variant: 'destructive' });
        }
        return false;
      } finally {
        setPublishing(null);
      }
    },
    [store, toast],
  );

  const exportBackup = useCallback(async () => {
    const working = toast({ title: 'Preparando el respaldo…', description: 'Se descargan todos los temas.' });
    try {
      const index = await store.exportIndex();
      downloadBackup(index);
      working.update({ id: working.id, title: 'Respaldo descargado', description: 'Guárdalo en un lugar seguro.' });
    } catch (error) {
      working.update({ id: working.id, title: 'No se pudo crear el respaldo', description: describeError(error), variant: 'destructive' });
    }
  }, [store, toast]);

  const importBackup = useCallback(
    async (file: File) => {
      try {
        const index = parseIndexBackup(JSON.parse(await file.text()));
        store.importIndex(index);
        setEditWanted(true);
        select(null);
        toast({
          title: 'Respaldo cargado como borrador',
          description: `${flattenIndex(index).length} elementos. Revísalo y publica para sustituir el curso actual.`,
        });
      } catch (error) {
        toast({
          title: 'El archivo no es un respaldo válido',
          description: isOutlineError(error) ? error.message : 'No es un JSON con el formato de respaldo de la plataforma.',
          variant: 'destructive',
        });
      }
    },
    [select, store, toast],
  );

  const confirmTopicDelete = () => {
    const target = pendingTopicDelete;
    setPendingTopicDelete(null);
    if (!target) return;
    const removed = new Set(flattenIndex([target]).map((item) => item.id));
    store.deleteTopic(target.id);
    if (selection.topicId && removed.has(selection.topicId)) select(null);
    toast({ title: `«${target.title}» se quitó del borrador` });
  };

  /* ------------------------------ avisos ------------------------------ */

  const pendingDeleteStats = useMemo(() => {
    if (!pendingTopicDelete) return null;
    const nodes = flattenIndex([pendingTopicDelete]);
    return { topics: nodes.length - 1, decks: nodes.reduce((sum, node) => sum + (node.decks?.length ?? 0), 0) };
  }, [pendingTopicDelete]);

  const notice = (
    <>
      {state.offline && (
        <p className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground" role="status">
          Sin conexión con el servidor. Se muestra la copia guardada en este equipo.
        </p>
      )}
      {isAdmin && !hasDraft && state.format === 'legacy' && !publishing && (
        <div className="shrink-0 border-t bg-control-bg px-3 py-2.5">
          <p className="text-xs leading-snug">La base de datos usa el formato anterior: la primera visita de cada alumno descarga el curso completo.</p>
          <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setMaintenance(true)}>
            Ver mantenimiento
          </Button>
        </div>
      )}
      {(hasDraft || publishing) && isAdmin && (
        <div className="shrink-0 border-t bg-control-bg px-3 py-2.5" role="status">
          {publishing ? (
            <>
              <p className="text-sm font-bold">{PHASE_TEXT[publishing.phase]}</p>
              <p className="font-mono text-xs tabular-nums text-muted-foreground">
                {publishing.total > 1 ? `${publishing.done} de ${publishing.total}` : 'Un momento…'}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold">Hay cambios sin publicar</p>
              <p className="text-xs text-muted-foreground">Solo tú los ves hasta que publiques.</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirmDiscard(true)}>
                  Descartar
                </Button>
                <Button size="sm" className="flex-1" onClick={() => void publish()}>
                  Publicar
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );

  const footer = (
    <AdminMenu
      admin={admin}
      editMode={editMode}
      onEditModeChange={changeEditMode}
      onRenumber={renumber}
      onExport={() => void exportBackup()}
      onImport={(file) => void importBackup(file)}
      onMaintenance={() => setMaintenance(true)}
    />
  );

  const sidebarVisible = isDesktop ? !collapsed : drawerOpen;

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {drawerOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      <aside
        aria-label="Temario del curso"
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-[19rem] max-w-[86vw] shrink-0 border-r shadow-xl transition-[transform,visibility] duration-200',
          'md:static md:z-auto md:translate-x-0 md:shadow-none md:transition-none',
          drawerOpen ? 'visible translate-x-0' : 'invisible -translate-x-full md:visible',
          collapsed && 'md:hidden',
        )}
      >
        <CourseSidebar outline={outline} selection={selection} onSelect={pick} editing={editing} notice={notice} footer={footer} />
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        {state.status === 'loading' && (
          <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-muted" role="status" aria-label="Cargando el temario">
            <div className="load-sweep h-full w-1/3 bg-signal" />
          </div>
        )}

        {selection.topicId ? (
          <TopicView
            store={store}
            state={state}
            outline={outline}
            topicId={selection.topicId}
            deck={selection.deck}
            select={select}
            theme={theme}
            editMode={editMode}
            sidebarOpen={sidebarVisible}
            onToggleSidebar={toggleSidebar}
            presenting={presenting}
            onPresentingChange={setPresenting}
          />
        ) : state.status === 'error' ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md text-center">
              <h1 className="font-display text-2xl font-semibold">No se pudo cargar el curso</h1>
              <p className="mt-2 text-muted-foreground">{state.error ?? 'Revisa tu conexión a internet.'}</p>
              <Button className="mt-5" onClick={() => void store.refresh()}>
                <RotateCw /> Reintentar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleSidebar}
              title={sidebarVisible ? 'Ocultar el temario' : 'Mostrar el temario'}
              className={cn('absolute left-3 top-3 z-10 bg-card', !collapsed && 'md:hidden')}
            >
              <PanelLeft />
            </Button>
            {state.bundleProgress && (
              <p className="absolute right-4 top-4 z-10 rounded-full border bg-card px-3 py-1 font-mono text-xs tabular-nums text-muted-foreground" role="status">
                Descargando el curso: {state.bundleProgress.done} de {state.bundleProgress.total}
              </p>
            )}
            <HomeView outline={outline} pending={state.status !== 'ready'} lastVisited={lastVisited} onSelect={pick} />
          </>
        )}
      </main>

      <AlertDialog open={pendingTopicDelete !== null} onOpenChange={(open) => !open && setPendingTopicDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{pendingTopicDelete?.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteStats && (pendingDeleteStats.topics > 0 || pendingDeleteStats.decks > 0)
                ? `Se quitarán también ${pendingDeleteStats.topics} subtemas y ${pendingDeleteStats.decks} presentaciones. `
                : ''}
              El cambio queda en el borrador: puedes descartarlo antes de publicar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmTopicDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios sin publicar?</AlertDialogTitle>
            <AlertDialogDescription>El curso volverá a quedar como está publicado. No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void store.discardDraft().then(() => toast({ title: 'Cambios descartados' }));
              }}
            >
              Descartar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={conflict} onOpenChange={setConflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>El curso cambió en otro dispositivo</AlertDialogTitle>
            <AlertDialogDescription>
              Alguien publicó mientras editabas. Si publicas ahora, el temario de tu borrador sustituirá al que está en el servidor. Si prefieres
              revisar primero, exporta un respaldo de tu borrador y descarta los cambios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void publish(true)}>Publicar de todos modos</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isAdmin && maintenance && (
        <MaintenanceDialog
          open
          onClose={() => setMaintenance(false)}
          store={store}
          state={state}
          onPublish={() => publish()}
          publishing={publishing !== null}
          onOpenTopic={(topicId, deck) => select(topicId, deck)}
        />
      )}
    </div>
  );
}
