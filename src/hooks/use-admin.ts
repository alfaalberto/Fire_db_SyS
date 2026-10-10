"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminState } from '@/lib/admin/session';

export interface AdminControls {
  state: AdminState;
  /** `true` mientras se descarga el SDK o se abre la ventana de Google. */
  busy: boolean;
  signIn: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

/**
 * Sesión del docente. El SDK de Firebase se descarga solo si este navegador ya
 * había iniciado sesión antes o si se pulsa "Acceso docente".
 */
export function useAdmin(): AdminControls {
  const [state, setState] = useState<AdminState>({ status: 'signed-out' });
  const [busy, setBusy] = useState(false);
  const watching = useRef<Promise<unknown> | null>(null);

  const watch = useCallback(() => {
    if (!watching.current) {
      watching.current = import('@/lib/admin/session').then((session) => session.watchAdmin(setState));
    }
    return watching.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void import('@/lib/admin/session').then((session) => {
      if (!cancelled && session.hasAdminHint()) void watch();
    });
    return () => {
      cancelled = true;
    };
  }, [watch]);

  const signIn = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const session = await import('@/lib/admin/session');
      await watch();
      await session.signInWithGoogle();
      return null;
    } catch (error) {
      const silent = (error as { silent?: boolean } | null)?.silent === true;
      if (silent) return null;
      return error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
    } finally {
      setBusy(false);
    }
  }, [watch]);

  const signOut = useCallback(async () => {
    const session = await import('@/lib/admin/session');
    await session.signOutAdmin();
  }, []);

  return { state, busy, signIn, signOut };
}
