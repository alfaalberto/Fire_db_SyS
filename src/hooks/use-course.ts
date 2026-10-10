"use client";

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { CourseSnapshot } from '@/lib/data/course-repo';
import { CourseStore, type CourseState } from '@/lib/data/course-store';

/**
 * Crea el almacén del curso para este árbol de React y lo mantiene al día:
 * arranca desde la caché local, consulta el servidor y vuelve a consultar al
 * regresar a la pestaña o recuperar la conexión.
 */
export function useCourse(initial: CourseSnapshot | null): { store: CourseStore; state: CourseState } {
  const ref = useRef<CourseStore | null>(null);
  if (!ref.current) ref.current = new CourseStore(initial);
  const store = ref.current;

  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  useEffect(() => {
    void store.start();
    const onVisible = () => {
      if (document.visibilityState === 'visible') store.refreshIfStale();
    };
    const onOnline = () => void store.refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [store]);

  return { store, state };
}
