"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  canZoom,
  createFit,
  enableFit,
  forecastLimit,
  forecastNeed,
  forgetModel,
  recallModel,
  rememberModel,
  reportFit,
  resetFit,
  resizeFit,
  sameModel,
  type DeckModel,
  type FitState as Fit,
  type LayoutReport,
} from '@/lib/deck-fit';
import { buildSlideSrcDoc } from '@/lib/slide-document';
import { cn } from '@/lib/utils';

export interface DeckProgress {
  index: number;
  total: number;
}

export interface SlideFrameHandle {
  /** Avanza o retrocede una lámina. Devuelve `false` si el puente no está listo. */
  nav: (dir: 1 | -1) => boolean;
  focus: () => void;
}

interface SlideFrameProps {
  html: string;
  title: string;
  theme: 'light' | 'dark';
  presenting?: boolean;
  /** `false` para la vista previa del editor: sin puente ni mensajes. */
  bridge?: boolean;
  className?: string;
  onProgress?: (progress: DeckProgress | null) => void;
  /** La presentación llegó a su primera/última lámina y se pidió seguir. */
  onEdge?: (dir: 1 | -1) => void;
  /** Ctrl + flecha dentro de la presentación. */
  onJump?: (dir: 1 | -1) => void;
  onEscape?: () => void;
  /** Se están arrastrando archivos sobre la presentación. */
  onFileDrag?: () => void;
  /** Se soltaron archivos sobre la presentación. */
  onFiles?: (files: File[]) => void;
  onRuntimeError?: (message: string) => void;
  /** Fórmulas que la presentación dejó en crudo y convirtió la plataforma. */
  onMathRescue?: (count: number) => void;
  /** `false` la deja a su tamaño natural, sin reducirla ni ampliarla. */
  fit?: boolean;
  onFit?: (state: FitState) => void;
  /** Identifica el contenido: lo aprendido de su tamaño se recuerda entre visitas. */
  memoKey?: string;
}

export interface FitState {
  /** Escala con la que se muestra (1 = tamaño natural). */
  scale: number;
  /**
   * Escala que le corresponde con el ajuste activado: menor que 1 si no cabe
   * a lo ancho, mayor si queda pequeña. Si no es 1, tiene sentido ofrecerlo.
   */
  fitted: number;
}

const TRUSTED = process.env.NEXT_PUBLIC_TRUST_SLIDES !== 'false';

// Sin `allow-same-origin`: la presentación corre en un origen opaco y no puede
// leer la sesión, el almacenamiento ni el DOM de la plataforma.
const SANDBOX =
  'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-pointer-lock allow-downloads';

/** Si la primera medida tarda más que esto, la presentación se muestra ya. */
const REVEAL_TIMEOUT = 900;

/** El marco más grande que cabe esperar: la pantalla completa. */
function screenBox(): { width: number; height: number } | null {
  if (typeof window === 'undefined' || !window.screen) return null;
  return { width: window.screen.width, height: window.screen.height };
}

function newToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Muestra una presentación en un iframe aislado. El documento se entrega con
 * `srcdoc` y solo se reconstruye cuando cambia el HTML: entrar o salir del
 * modo presentación, o cambiar el tema de la app, se comunica por mensajes
 * para que la presentación no se reinicie ni pierda la lámina en la que va.
 *
 * El iframe se dibuja con el tamaño que le conviene a la presentación y se
 * escala hasta ocupar el marco (ver `deck-fit`): si no cabe a lo ancho se
 * reduce, en lugar de recortarla, y si en una pantalla grande queda pequeña
 * se amplía hasta aprovecharla.
 */
export const SlideFrame = forwardRef<SlideFrameHandle, SlideFrameProps>(function SlideFrame(
  {
    html,
    title,
    theme,
    presenting = false,
    bridge = true,
    fit = true,
    className,
    onProgress,
    onEdge,
    onJump,
    onEscape,
    onFileDrag,
    onFiles,
    onRuntimeError,
    onMathRescue,
    onFit,
    memoKey = '',
  },
  ref,
) {
  const boxRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef<string>('');
  if (!tokenRef.current) tokenRef.current = newToken();
  const [loaded, setLoaded] = useState(false);
  // Se muestra cuando ya tiene su tamaño, para que no se la vea cambiar.
  const [revealed, setRevealed] = useState(false);
  const readyRef = useRef(false);
  // Tamaño con el que se dibuja (ver `deck-fit`). La referencia es la verdad;
  // el estado solo guarda lo que afecta a lo que se pinta.
  const fitRef = useRef<Fit | null>(null);
  if (!fitRef.current) fitRef.current = createFit({ width: 0, height: 0 }, fit, null);
  const [view, setView] = useState({ width: 0, scale: 1 });
  const [fitted, setFitted] = useState(1);
  // Lo último que se le dijo al puente sobre medir las láminas ocultas.
  const aheadRef = useRef<0 | 1 | 2>(0);
  const memoRef = useRef({ key: memoKey, saved: null as DeckModel | null, timer: null as ReturnType<typeof setTimeout> | null });
  memoRef.current.key = memoKey;

  // Valores con los que se construye el documento; los cambios posteriores
  // viajan por mensaje (ver efectos de abajo).
  const initial = useRef({ theme, presenting });

  const srcDoc = useMemo(
    () =>
      buildSlideSrcDoc(html, {
        token: tokenRef.current,
        origin: typeof window === 'undefined' ? '' : window.location.origin,
        theme: initial.current.theme,
        presenting: initial.current.presenting,
        bridge,
        trusted: TRUSTED,
        title,
      }),
    // `title` solo rotula los fragmentos; no justifica recargar el documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [html, bridge],
  );

  const handlers = useRef({ onProgress, onEdge, onJump, onEscape, onFileDrag, onFiles, onRuntimeError, onMathRescue, onFit });
  handlers.current = { onProgress, onEdge, onJump, onEscape, onFileDrag, onFiles, onRuntimeError, onMathRescue, onFit };
  const live = useRef({ theme, presenting });
  live.current = { theme, presenting };

  const send = useCallback((message: Record<string, unknown>) => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return false;
    // El iframe tiene origen opaco: no hay un origen concreto al que dirigirse.
    target.postMessage({ ...message, __sys: tokenRef.current }, '*');
    return true;
  }, []);

  /** Pide al puente que mida con el tamaño actual. */
  const measure = useCallback(() => {
    const state = fitRef.current;
    if (!state || !readyRef.current) return;
    // (El espacio libre se mide aunque el ajuste esté desactivado: así se sabe
    // si hay algo que ofrecer. Las láminas que no están a la vista, solo
    // cuando esa medida puede cambiar el tamaño.)
    const screen = screenBox();
    aheadRef.current = forecastNeed(state, screen);
    send({ t: 'measure', spare: canZoom(state.box), width: Math.round(state.view.width), ahead: aheadRef.current, limit: forecastLimit(state.box, screen) });
  }, [send]);

  /** Adopta un nuevo estado del ajuste y refleja en pantalla lo que cambió. */
  const adopt = useCallback((next: Fit) => {
    const before = fitRef.current;
    fitRef.current = next;
    setView((current) => (current.width === next.view.width && current.scale === next.view.scale ? current : { width: next.view.width, scale: next.view.scale }));
    setFitted(next.fitted);
    if (next.settled) setRevealed(true);
    // Lo aprendido puede cambiar si hace falta o no medir las láminas ocultas.
    const ahead = forecastNeed(next, screenBox());
    if (ahead !== aheadRef.current && readyRef.current) {
      aheadRef.current = ahead;
      send({ t: 'ahead', ahead });
    }
    // Lo aprendido se guarda para la próxima visita (sin escribir a cada paso).
    const memo = memoRef.current;
    if (memo.key && before && !sameModel(before.model, next.model)) {
      if (memo.timer) clearTimeout(memo.timer);
      memo.timer = setTimeout(() => {
        memo.timer = null;
        const model = fitRef.current?.model;
        if (model && memo.key && !(memo.saved && sameModel(memo.saved, model))) {
          rememberModel(memo.key, model);
          memo.saved = model;
        }
      }, 600);
    }
  }, [send]);

  useEffect(() => {
    setLoaded(false);
    setRevealed(false);
    readyRef.current = false;
    // Presentación nueva: se parte de lo que se recuerde de ella.
    const current = fitRef.current!;
    const recalled = recallModel(memoRef.current.key);
    memoRef.current.saved = recalled;
    adopt(createFit(current.box, current.enabled, recalled));
    // `adopt` y `memoKey` no cambian lo que hay que hacer al cambiar el documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcDoc]);

  useEffect(() => {
    const memo = memoRef.current;
    return () => {
      // Lo pendiente de guardar se guarda al salir.
      if (!memo.timer) return;
      clearTimeout(memo.timer);
      memo.timer = null;
      const model = fitRef.current?.model;
      if (model && memo.key) rememberModel(memo.key, model);
    };
  }, []);

  // El marco cambió de tamaño (otra ventana, el temario plegado, pantalla
  // completa): lo aprendido sigue valiendo y el ajuste es inmediato.
  useEffect(() => {
    const element = boxRef.current;
    if (!element || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      const state = fitRef.current!;
      const next = resizeFit(state, { width: Math.round(rect.width), height: Math.round(rect.height) });
      if (next !== state) adopt(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [adopt]);

  useEffect(() => {
    if (!bridge) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as {
        __sys?: string;
        t?: string;
        index?: number | null;
        total?: number | null;
        dir?: number;
        key?: string;
        message?: string;
        files?: unknown;
        need?: number;
        width?: number;
        count?: number;
      } | null;
      if (!data || data.__sys !== tokenRef.current) return;
      const h = handlers.current;
      switch (data.t) {
        case 'ready':
          readyRef.current = true;
          setLoaded(true);
          send({ t: 'mode', presenting: live.current.presenting });
          send({ t: 'theme', theme: live.current.theme });
          measure();
          break;
        case 'progress':
          h.onProgress?.(typeof data.index === 'number' && typeof data.total === 'number' ? { index: data.index, total: data.total } : null);
          break;
        case 'edge':
          h.onEdge?.(data.dir === -1 ? -1 : 1);
          break;
        case 'jump':
          h.onJump?.(data.dir === -1 ? -1 : 1);
          break;
        case 'key':
          if (data.key === 'Escape') h.onEscape?.();
          break;
        case 'dragfiles':
          h.onFileDrag?.();
          break;
        case 'files':
          if (Array.isArray(data.files)) h.onFiles?.(data.files.filter((file): file is File => file instanceof File));
          break;
        case 'error':
          if (data.message) h.onRuntimeError?.(data.message);
          break;
        case 'math':
          h.onMathRescue?.(Number(data.count) || 0);
          break;
        case 'layout': {
          const state = fitRef.current!;
          const next = reportFit(state, data as LayoutReport);
          if (next !== state) adopt(next);
          break;
        }
        case 'relayout':
          // Las tipografías llegaron después de medir: lo medido no vale. Se
          // olvida y se mide otra vez desde el tamaño natural.
          forgetModel(memoRef.current.key);
          memoRef.current.saved = null;
          adopt(resetFit(fitRef.current!));
          measure();
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [adopt, bridge, measure, send]);

  useEffect(() => {
    if (readyRef.current) send({ t: 'mode', presenting });
  }, [presenting, send]);

  // Activar o desactivar el ajuste no borra lo aprendido: el cambio es
  // inmediato y la siguiente medida lo confirma.
  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    adopt(enableFit(fitRef.current!, fit));
    measure();
  }, [adopt, fit, measure]);

  // Con el tamaño nuevo ya aplicado al marco, se pide la medida: el puente la
  // toma en cuanto le llega el cambio. (Si solo cambia el alto, lo nota solo.)
  useEffect(() => {
    measure();
  }, [measure, view]);

  // Sin puente no hay medida que esperar; con él, se espera un momento.
  useEffect(() => {
    if (!loaded || revealed) return;
    if (!bridge) {
      setRevealed(true);
      return;
    }
    const timer = setTimeout(() => setRevealed(true), REVEAL_TIMEOUT);
    return () => clearTimeout(timer);
  }, [bridge, loaded, revealed]);

  const scale = view.scale;
  const scaled = scale !== 1 && view.width > 0;

  useEffect(() => {
    handlers.current.onFit?.({ scale, fitted });
  }, [scale, fitted]);

  useEffect(() => {
    if (readyRef.current) send({ t: 'theme', theme });
  }, [theme, send]);

  useImperativeHandle(
    ref,
    () => ({
      nav: (dir) => (readyRef.current ? send({ t: 'nav', dir }) : false),
      focus: () => {
        iframeRef.current?.focus();
        send({ t: 'focus' });
      },
    }),
    [send],
  );

  return (
    // Fondo `Canvas`: el mismo que tendría el archivo abierto en el navegador
    // cuando la presentación no define uno propio.
    <div ref={boxRef} className={cn('relative h-full w-full overflow-hidden bg-[Canvas]', className)}>
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={srcDoc}
        sandbox={SANDBOX}
        allow="fullscreen; clipboard-write; autoplay"
        onLoad={() => setLoaded(true)}
        style={scaled ? { width: view.width, height: `${100 / scale}%`, transform: `scale(${scale})` } : undefined}
        className={cn(
          'border-0 transition-opacity duration-200',
          scaled ? 'absolute left-0 top-0 max-w-none origin-top-left' : 'h-full w-full',
          revealed ? 'opacity-100' : 'opacity-0',
        )}
      />
      {!revealed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status" aria-live="polite">
          <div className="w-48">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="load-sweep h-full w-1/3 rounded-full bg-signal" />
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">Abriendo la presentación</p>
          </div>
        </div>
      )}
    </div>
  );
});
