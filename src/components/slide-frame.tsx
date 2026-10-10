"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { buildSlideSrcDoc } from '@/lib/slide-document';
import { createFit, nextFit, scaleOf, type FitMemory, type LayoutReport } from '@/lib/slide-fit';
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
  /** `false` la deja siempre a su tamaño natural. */
  fit?: boolean;
  onFit?: (state: FitState) => void;
}

export interface FitState {
  /** Escala con la que se muestra (1 = tamaño natural). */
  scale: number;
  /** A su tamaño natural no cabe o deja márgenes: tiene sentido ofrecer el ajuste. */
  needed: boolean;
}

const TRUSTED = process.env.NEXT_PUBLIC_TRUST_SLIDES !== 'false';

// Sin `allow-same-origin`: la presentación corre en un origen opaco y no puede
// leer la sesión, el almacenamiento ni el DOM de la plataforma.
const SANDBOX =
  'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-pointer-lock allow-downloads';

/**
 * Espera máxima, desde que el documento está listo, a que termine de cargar y
 * se decida su tamaño antes de mostrarla. Si tarda más se muestra tal cual.
 */
const SETTLE_MS = 1200;
/** Lo que se oculta, como mucho, mientras se recoloca con un tamaño nuevo y se vuelve a medir. */
const RESETTLE_MS = 700;
/** Cambio de sitio (pantalla completa, panel lateral) que merece ocultarla un instante. */
const BIG_CHANGE = 0.2;

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
 * El iframe puede dibujarse con un ancho distinto del disponible y escalarse
 * para ocupar su sitio: más ancho y reducido si el contenido no cabe (una
 * barra de botones en el teléfono), más estrecho y ampliado si la presentación
 * deja márgenes vacíos (un proyector). Mide el puente; decide `slide-fit`.
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
  },
  ref,
) {
  const boxRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef<string>('');
  if (!tokenRef.current) tokenRef.current = newToken();
  const [loaded, setLoaded] = useState(false);
  const readyRef = useRef(false);
  // Ancho disponible y ancho con el que se dibuja el iframe (null = el natural).
  const [boxWidth, setBoxWidth] = useState(0);
  const [fitWidth, setFitWidth] = useState<number | null>(null);
  const [fitNeeded, setFitNeeded] = useState(false);
  const fitState = useRef<{ box: { w: number; h: number }; memory: FitMemory; enabled: boolean }>({
    box: { w: 0, h: 0 },
    memory: createFit(),
    enabled: fit,
  });
  fitState.current.enabled = fit;
  // Mientras se decide el tamaño no se muestra: así no se ve el salto.
  const [settling, setSettling] = useState(bridge);
  // Ya se mostró alguna vez: los ajustes posteriores no enseñan el indicador de carga.
  const [shown, setShown] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /** Vuelve al tamaño natural y olvida lo medido. */
  const resetFit = useCallback(() => {
    fitState.current.memory = createFit();
    setFitWidth(null);
    setFitNeeded(false);
  }, []);

  /** Oculta la presentación hasta `ms` como mucho, mientras se recoloca. */
  const hold = useCallback((ms: number) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setSettling(true);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      setSettling(false);
    }, ms);
  }, []);

  const release = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    setSettling(false);
  }, []);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  useEffect(() => {
    setLoaded(false);
    readyRef.current = false;
    resetFit();
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    setSettling(bridge);
    setShown(false);
  }, [srcDoc, bridge, resetFit]);

  useEffect(() => {
    if (loaded && !settling) setShown(true);
  }, [loaded, settling]);

  // Con otro sitio disponible lo medido ya no vale: se vuelve al tamaño
  // natural y el puente, al notar el cambio, mide de nuevo.
  useEffect(() => {
    const element = boxRef.current;
    if (!element || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      const h = Math.round(entries[0].contentRect.height);
      const before = fitState.current.box;
      if (w === before.w && h === before.h) return;
      const big = before.w > 0 && (Math.abs(w - before.w) > before.w * BIG_CHANGE || Math.abs(h - before.h) > before.h * BIG_CHANGE);
      const adjusted = fitState.current.memory.width !== null;
      fitState.current.box = { w, h };
      setBoxWidth(w);
      resetFit();
      // Pantalla completa, panel lateral: se oculta un instante para que no se
      // vea a un tamaño y luego a otro. Arrastrar el borde de la ventana no.
      if (readyRef.current && big && (adjusted || fitState.current.enabled)) hold(RESETTLE_MS);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hold, resetFit]);

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
        height?: number;
        main?: number;
        nav?: boolean;
        tall?: number;
        soft?: number;
        clip?: number;
        col?: number;
        floor?: number;
        deck?: unknown;
        at?: number;
        count?: number;
      } | null;
      if (!data || data.__sys !== tokenRef.current) return;
      const h = handlers.current;
      switch (data.t) {
        case 'ready':
          readyRef.current = true;
          setLoaded(true);
          // Se muestra en cuanto el puente mida; si tarda, sin esperar más.
          hold(SETTLE_MS);
          send({ t: 'mode', presenting: live.current.presenting });
          send({ t: 'theme', theme: live.current.theme });
          send({ t: 'fit', scale: 1 });
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
          const width = Number(data.width);
          const need = Number(data.need);
          const state = fitState.current;
          if (!(width > 0) || !(need > 0) || state.box.w <= 0) break;
          // Medida tomada con otro ancho: llegó tarde, tras un cambio de tamaño.
          if (Math.abs(width - (state.memory.width ?? state.box.w)) > 2) break;
          const report: LayoutReport = {
            width,
            height: Number(data.height) || 0,
            need,
            main: Number(data.main) || need,
            nav: data.nav === true,
            tall: Number(data.tall) || 0,
            soft: Number(data.soft) || 0,
            clip: Number(data.clip) || 0,
            col: Number(data.col) || 0,
            floor: Number(data.floor) || 0,
            deck: Array.isArray(data.deck) ? data.deck.slice(0, 60).map((tall) => (typeof tall === 'number' && tall > 0 ? tall : null)) : null,
            at: typeof data.at === 'number' ? data.at : -1,
          };
          if (!state.enabled) {
            // Ajuste desactivado: solo se anota si haría falta.
            setFitNeeded(nextFit(createFit(), report, state.box).width !== null);
            release();
            break;
          }
          const out = nextFit(state.memory, report, state.box);
          const changed = out.width !== state.memory.width;
          state.memory = out.memory;
          setFitNeeded(out.width !== null);
          if (changed) {
            setFitWidth(out.width);
            hold(RESETTLE_MS);
          } else {
            release();
          }
          break;
        }
        case 'relayout':
          // Las tipografías llegaron después de medir: se mide otra vez desde cero.
          resetFit();
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [bridge, hold, release, resetFit, send]);

  useEffect(() => {
    if (readyRef.current) send({ t: 'mode', presenting });
  }, [presenting, send]);

  // Al activar o desactivar el ajuste se parte del tamaño natural y se pide
  // al puente que mida otra vez.
  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    resetFit();
    if (readyRef.current) {
      hold(RESETTLE_MS);
      send({ t: 'measure' });
    }
  }, [fit, hold, resetFit, send]);

  const scaled = fit && fitWidth !== null && boxWidth > 0 && Math.abs(fitWidth - boxWidth) > 1;
  const scale = scaled ? scaleOf(fitWidth, boxWidth) : 1;

  useEffect(() => {
    handlers.current.onFit?.({ scale, needed: fitNeeded });
  }, [scale, fitNeeded]);

  // El puente necesita saber si está ampliada para decidir qué medir.
  useEffect(() => {
    if (readyRef.current) send({ t: 'fit', scale });
  }, [scale, send]);

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
        onLoad={() => {
          setLoaded(true);
          // Sin noticia del puente (no debería pasar) se muestra tal cual.
          if (!readyRef.current) release();
        }}
        style={scaled ? { width: fitWidth, height: `${100 / scale}%`, transform: `scale(${scale})` } : undefined}
        className={cn(
          'border-0 transition-opacity duration-150',
          scaled ? 'absolute left-0 top-0 max-w-none origin-top-left' : 'h-full w-full',
          loaded && !settling ? 'opacity-100' : 'opacity-0',
        )}
      />
      {!shown && (
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
