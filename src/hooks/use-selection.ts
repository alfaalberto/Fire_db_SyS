"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { findTopicByNumber } from '@/lib/outline';
import { findItemById } from '@/lib/tree';
import type { OutlineItem } from '@/lib/types';

export interface Selection {
  topicId: string | null;
  /** Índice (base 0) de la presentación dentro del tema. */
  deck: number;
}

const HOME: Selection = { topicId: null, deck: 0 };

/**
 * La posición vive en el fragmento de la URL, así cada tema tiene un enlace
 * que se puede compartir y el botón "atrás" del navegador funciona:
 *
 *   #/t/<id-del-tema>/<n>   enlace estable (el id no cambia al renumerar)
 *   #/1.2  o  #/1.2/3       atajo por número de sección
 */
export function parseHash(hash: string): { ref: string; byNumber: boolean; deck: number } | null {
  const path = decodeURIComponent(hash.replace(/^#\/?/, ''));
  if (!path) return null;
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 't' && parts[1]) {
    return { ref: parts[1], byNumber: false, deck: Math.max(0, (parseInt(parts[2] ?? '1', 10) || 1) - 1) };
  }
  if (/^\d+(\.\d+)*$/.test(parts[0] ?? '')) {
    return { ref: parts[0], byNumber: true, deck: Math.max(0, (parseInt(parts[1] ?? '1', 10) || 1) - 1) };
  }
  return null;
}

export function formatHash(selection: Selection): string {
  if (!selection.topicId) return '';
  const base = `#/t/${encodeURIComponent(selection.topicId)}`;
  return selection.deck > 0 ? `${base}/${selection.deck + 1}` : base;
}

function resolve(outline: OutlineItem[], hash: string): Selection {
  const parsed = parseHash(hash);
  if (!parsed) return HOME;
  const item = parsed.byNumber ? findTopicByNumber(outline, parsed.ref) : findItemById(outline, parsed.ref);
  if (!item) return parsed.byNumber ? HOME : { topicId: parsed.ref, deck: parsed.deck };
  return { topicId: item.id, deck: parsed.deck };
}

export function useSelection(outline: OutlineItem[]): {
  selection: Selection;
  select: (topicId: string | null, deck?: number, options?: { replace?: boolean }) => void;
} {
  const [hash, setHash] = useState('');

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  // Se vuelve a resolver cuando llega el temario real: un atajo por número
  // (#/1.2) puede no existir todavía en el temario provisional.
  const selection = useMemo(() => resolve(outline, hash), [outline, hash]);

  const select = useCallback((topicId: string | null, deck = 0, options?: { replace?: boolean }) => {
    const next = formatHash({ topicId, deck: topicId ? Math.max(0, deck) : 0 });
    if (window.location.hash === next || (!next && !window.location.hash)) {
      setHash(next);
      return;
    }
    const url = `${window.location.pathname}${window.location.search}${next}`;
    if (options?.replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    setHash(next);
  }, []);

  return { selection, select };
}
