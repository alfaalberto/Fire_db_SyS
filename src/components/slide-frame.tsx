"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
  /** `false` la deja a su tamaño natural aunque no quepa a lo ancho. */
  fit?: boolean;
  onFit?: (state: FitState) => void;
}

export interface FitState {
  /** Escala con la que se muestra (1 = tamaño natural). */
  scale: number;
  /** El contenido se sale a lo ancho: tiene sentido ofrecer el ajuste. */
  needed: boolean;
}

const TRUSTED = process.env.NEXT_PUBLIC_TRUST_SLIDES !== 'false';

// Sin `allow-same-origin`: la presentación corre en un origen opaco y no puede
// leer la sesión, el almacenamiento ni el DOM de la plataforma.
const SANDBOX =
  'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-pointer-lock allow-downloads';

/** Reducción máxima; por debajo el texto deja de leerse. Igual a MIN_FIT en el puente. */
const MIN_SCALE = 0.6;
/** Un desborde mínimo (una barra de desplazamiento, un borde) no justifica reducir. */
const FIT_TOLERANCE = 1.03;
/** Ajustes seguidos permitidos mientras la presentación se reacomoda. */
const MAX_FIT_STEPS = 3;
/** Si agrandar no acorta lo que sobresale al menos esto, no tiene arreglo. */
const FIT_PROGRESS = 0.85;

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
 * Si el contenido no cabe a lo ancho (una barra de botones que se sale en un
 * teléfono, por ejemplo), el iframe se dibuja con el ancho que necesita y se
 * reduce hasta caber: se ve entera, como una página de escritorio en el móvil,
 * en lugar de recortada.
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
  const fitState = useRef({ box: 0, width: null as number | null, steps: 0, over: 0, gaveUp: false, enabled: fit });
  fitState.current.enabled = fit;

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
    const state = fitState.current;
    state.width = null;
    state.steps = 0;
    state.over = 0;
    state.gaveUp = false;
    setFitWidth(null);
    setFitNeeded(false);
  }, []);

  useEffect(() => {
    setLoaded(false);
    readyRef.current = false;
    resetFit();
  }, [srcDoc, resetFit]);

  // Con otro ancho disponible la medida anterior ya no vale: se vuelve al
  // tamaño natural y el puente, al notar el cambio, mide de nuevo.
  useEffect(() => {
    const element = boxRef.current;
    if (!element || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0].contentRect.width);
      if (width === fitState.current.box) return;
      fitState.current.box = width;
      setBoxWidth(width);
      resetFit();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [resetFit]);

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
          const need = Number(data.need);
          const width = Number(data.width);
          const state = fitState.current;
          if (!(need > 0) || !(width > 0) || state.box <= 0 || state.gaveUp) break;
          const current = state.width ?? state.box;
          // Medida tomada con otro ancho: llegó tarde, tras un cambio de tamaño.
          if (Math.abs(width - current) > 2) break;
          if (need <= width * FIT_TOLERANCE) break;
          setFitNeeded(true);
          if (!state.enabled) break;
          const over = need - width;
          if (state.width !== null && over >= state.over * FIT_PROGRESS) {
            // Agrandar no acortó lo que sobresale: mide según la ventana (un
            // `97vw` más relleno) y nunca cabrá. Se deja a su tamaño natural.
            state.gaveUp = true;
            state.width = null;
            setFitWidth(null);
            setFitNeeded(false);
            break;
          }
          if (state.steps >= MAX_FIT_STEPS) break;
          const next = Math.min(Math.ceil(need), Math.floor(state.box / MIN_SCALE));
          if (next <= current + 4) break;
          state.width = next;
          state.steps += 1;
          state.over = over;
          setFitWidth(next);
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
  }, [bridge, resetFit, send]);

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
    if (readyRef.current) send({ t: 'measure' });
  }, [fit, resetFit, send]);

  const scaled = fit && fitWidth !== null && boxWidth > 0 && fitWidth > boxWidth + 1;
  const scale = scaled ? boxWidth / fitWidth : 1;

  useEffect(() => {
    handlers.current.onFit?.({ scale, needed: fitNeeded });
  }, [scale, fitNeeded]);

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
        style={scaled ? { width: fitWidth, height: `${100 / scale}%`, transform: `scale(${scale})` } : undefined}
        className={cn(
          'border-0 transition-opacity duration-200',
          scaled ? 'absolute left-0 top-0 max-w-none origin-top-left' : 'h-full w-full',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
      {!loaded && (
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
