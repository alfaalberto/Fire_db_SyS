import { sanitizeHtml } from './sanitize';
import { SLIDE_BRIDGE_SOURCE } from './slide-bridge';
import { FIT } from './slide-fit';

/**
 * Cómo se muestra una presentación.
 *
 * Casi todo el contenido del curso son archivos HTML completos (con su propio
 * `<head>`, estilos, KaTeX, navegación y tema). Esos documentos se muestran
 * TAL CUAL: lo único que se les añade es el puente (`slide-bridge`). Así, lo
 * que el autor validó abriendo el archivo en el navegador es exactamente lo que
 * ve el alumno dentro de la plataforma.
 *
 * Solo los fragmentos sueltos (`<h1>…</h1><p>…</p>`) reciben una plantilla de
 * la app con estilos base y KaTeX local.
 */
export type SlideKind = 'document' | 'fragment' | 'empty';

const DOCUMENT_MARK = /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i;
const POLYFILL_IO = /<script\b[^>]*src=["'][^"']*polyfill\.io[^"']*["'][^>]*>\s*<\/script>/gi;
const PLACEHOLDER = /^<h1>Nueva Diapositiva<\/h1>/i;

export function classifySlide(html: string): SlideKind {
  if (!html || html.trim() === '') return 'empty';
  return DOCUMENT_MARK.test(html) ? 'document' : 'fragment';
}

export interface NormalizedDocument {
  html: string;
  /** Caracteres de texto ajeno recortados antes de `<!DOCTYPE>` / `<html>`. */
  trimmedBefore: number;
  /** Caracteres de texto ajeno recortados después de `</html>`. */
  trimmedAfter: number;
}

function onlyCommentsOrSpace(text: string): boolean {
  return text.replace(/<!--[\s\S]*?-->/g, '').trim() === '';
}

/**
 * Recorta lo que quede fuera del documento. Ocurre cuando se pega el guion que
 * generó el archivo (por ejemplo `html = r'''<!DOCTYPE html>…'''`) en lugar del
 * archivo mismo: ese texto se pintaría sobre la lámina y además pone el
 * navegador en modo de compatibilidad (quirks).
 */
export function normalizeDocument(input: string): NormalizedDocument {
  let html = input.replace(/^﻿/, '');
  let trimmedBefore = 0;
  let trimmedAfter = 0;

  const start = html.search(/<!doctype\s+html|<html[\s>]/i);
  if (start > 0) {
    const prefix = html.slice(0, start);
    if (!onlyCommentsOrSpace(prefix)) trimmedBefore = prefix.trim().length;
    html = html.slice(start);
  }

  const closing = /<\/html\s*>/gi;
  let end = -1;
  let match: RegExpExecArray | null;
  while ((match = closing.exec(html)) !== null) end = match.index + match[0].length;
  if (end !== -1 && end < html.length) {
    const suffix = html.slice(end);
    if (!onlyCommentsOrSpace(suffix)) {
      trimmedAfter = suffix.trim().length;
      html = html.slice(0, end);
    }
  }

  return { html, trimmedBefore, trimmedAfter };
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return ENTITIES[body] ?? whole;
  });
}

/** Título del `<title>` del documento, o `null` si no tiene. */
export function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const title = decodeEntities(match[1].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
  return title ? title.slice(0, 200) : null;
}

export type SlideIssueCode = 'empty' | 'placeholder' | 'outside-html' | 'no-title' | 'polyfill-io' | 'insecure-resource';

export interface SlideIssue {
  code: SlideIssueCode;
  message: string;
  /** `true` si "Reparar" puede corregirlo sin intervención. */
  fixable: boolean;
}

export interface SlideReport {
  kind: SlideKind;
  title: string | null;
  issues: SlideIssue[];
}

/** Revisión estática de un archivo; alimenta los avisos del modo edición. */
export function inspectSlide(html: string): SlideReport {
  const kind = classifySlide(html);
  const issues: SlideIssue[] = [];
  if (kind === 'empty') {
    issues.push({ code: 'empty', message: 'La presentación está vacía.', fixable: false });
    return { kind, title: null, issues };
  }
  if (PLACEHOLDER.test(html.trim())) {
    issues.push({ code: 'placeholder', message: 'Es la plantilla de ejemplo, sin contenido propio.', fixable: false });
  }
  const title = extractTitle(html);
  if (kind === 'document') {
    const { trimmedBefore, trimmedAfter } = normalizeDocument(html);
    if (trimmedBefore > 0 || trimmedAfter > 0) {
      issues.push({
        code: 'outside-html',
        message: 'Hay texto fuera del documento HTML (por ejemplo, el guion que lo generó). Se recorta al mostrarlo.',
        fixable: true,
      });
    }
    if (!title) {
      issues.push({ code: 'no-title', message: 'No tiene <title>; se mostrará como “Presentación n”.', fixable: false });
    }
  }
  POLYFILL_IO.lastIndex = 0;
  if (POLYFILL_IO.test(html)) {
    issues.push({ code: 'polyfill-io', message: 'Carga polyfill.io, un dominio comprometido. Se bloquea al mostrarla.', fixable: true });
  }
  if (/<(?:script|link|img|iframe|source|video|audio)\b[^>]*\s(?:src|href)=["']http:\/\//i.test(html)) {
    issues.push({ code: 'insecure-resource', message: 'Usa recursos http:// que el navegador bloquea en un sitio https.', fixable: false });
  }
  return { kind, title, issues };
}

/** Aplica las correcciones automáticas (`fixable`) y devuelve el HTML limpio. */
export function repairSlide(html: string): string {
  if (classifySlide(html) !== 'document') return html;
  return normalizeDocument(html).html.replace(POLYFILL_IO, '');
}

export interface SrcDocOptions {
  /** Identificador de sesión del iframe; valida los mensajes del puente. */
  token: string;
  /** Origen de la app (`https://…`), para KaTeX local y el destino de los mensajes. */
  origin: string;
  theme: 'light' | 'dark';
  presenting?: boolean;
  /** `false` para exportar un archivo independiente, sin puente. */
  bridge?: boolean;
  /** `false` quita los scripts del contenido (modo sin confianza). */
  trusted?: boolean;
  title?: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function bridgeTag(options: SrcDocOptions, fragment: boolean): string {
  if (options.bridge === false) return '';
  const config = JSON.stringify({
    token: options.token,
    origin: /^https?:\/\//.test(options.origin) ? options.origin : '',
    presenting: !!options.presenting,
    fragment,
    mostly: FIT.MOSTLY,
  }).replace(/</g, '\\u003c');
  return `<script data-sys-bridge>window.__SYS_BRIDGE__=${config};${SLIDE_BRIDGE_SOURCE}</script>`;
}

function buildDocument(html: string, options: SrcDocOptions): string {
  let doc = normalizeDocument(html).html.replace(POLYFILL_IO, '');
  if (options.trusted === false) doc = sanitizeHtml(doc);
  const inject = bridgeTag(options, false);
  if (!inject) return doc;

  const head = /<head(?:\s[^>]*)?>/i.exec(doc);
  if (head) {
    const at = head.index + head[0].length;
    return doc.slice(0, at) + inject + doc.slice(at);
  }
  const root = /<html(?:\s[^>]*)?>/i.exec(doc);
  if (root) {
    const at = root.index + root[0].length;
    return doc.slice(0, at) + inject + doc.slice(at);
  }
  const doctype = /<!doctype[^>]*>/i.exec(doc);
  if (doctype) {
    const at = doctype.index + doctype[0].length;
    return doc.slice(0, at) + inject + doc.slice(at);
  }
  return inject + doc;
}

/** Estilos de la plantilla para fragmentos. Mismos colores que la app. */
export const FRAGMENT_CSS = `
:root{color-scheme:light;--bg:#FFF9F2;--surface:#FFFFFF;--line:#E2D7C8;--text:#172033;--muted:#4B586E;--blue:#2563EB;--teal:#0F766E;--code:#F6EFE6}
[data-theme="dark"]{color-scheme:dark;--bg:#0B1020;--surface:#141B2E;--line:#2A3654;--text:#F8FAFC;--muted:#B7C0D8;--blue:#60A5FA;--teal:#2DD4BF;--code:#1D263E}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text)}
body{font-family:"Nunito Sans",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:1.0625rem;line-height:1.65}
.sys-fragment,.container{max-width:60rem;margin:0 auto;padding:clamp(1.25rem,4vw,3rem)}
.sys-fragment>.container{padding:0}
h1,h2,h3{font-family:"Fredoka","Nunito Sans",system-ui,sans-serif;line-height:1.2;margin:0 0 .6em}
h1{font-size:clamp(1.75rem,3.2vw,2.5rem);font-weight:600;color:var(--blue)}
h2{font-size:1.5rem;font-weight:600;margin-top:1.6em}
h3{font-size:1.2rem;font-weight:600;margin-top:1.4em}
p{margin:0 0 .9em}
.muted{color:var(--muted);font-size:.95rem}
a{color:var(--blue)}
ul,ol{padding-left:1.4rem;margin:0 0 1em}
li{margin-bottom:.35em}
hr{border:0;border-top:1px solid var(--line);margin:1.5rem 0}
pre,code{font-family:"DM Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
code{font-size:.9em;background:var(--code);padding:.1em .35em;border-radius:.3em}
pre{background:var(--code);border:1px solid var(--line);border-radius:.6rem;padding:1rem;overflow-x:auto;font-size:.9em}
pre code{background:none;padding:0}
table{width:100%;border-collapse:collapse;margin:1rem 0}
th,td{border:1px solid var(--line);padding:.5rem .75rem;text-align:left}
th{background:var(--code);font-weight:700}
img,svg,video,canvas{max-width:100%;height:auto}
blockquote{border-left:3px solid var(--teal);margin:1rem 0;padding-left:1rem;color:var(--muted)}
.katex-display{overflow-x:auto;overflow-y:hidden;padding:.4rem 0}
`;

const MATH_BOOT = String.raw`document.addEventListener('DOMContentLoaded',function(){if(typeof renderMathInElement!=='function')return;try{renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false,strict:'ignore'});}catch(e){}});`;

function buildFragment(html: string, options: SrcDocOptions): string {
  const body = options.trusted === false ? sanitizeHtml(html) : html;
  const origin = options.origin.replace(/\/$/, '');
  const hasMath = /\\\(|\\\[|\$\$/.test(body);
  const math = hasMath
    ? `<link rel="stylesheet" href="${origin}/katex/katex.min.css">
<script defer src="${origin}/katex/katex.min.js"></script>
<script defer src="${origin}/katex/contrib/auto-render.min.js"></script>
<script>${MATH_BOOT}</script>`
    : '';
  return `<!DOCTYPE html>
<html lang="es" data-theme="${options.theme === 'light' ? 'light' : 'dark'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title ?? 'Presentación')}</title>
<style>${FRAGMENT_CSS}</style>
${bridgeTag(options, true)}
${math}
</head>
<body><main class="sys-fragment">${body}</main></body>
</html>`;
}

/** Documento final que se entrega al iframe mediante `srcdoc`. */
export function buildSlideSrcDoc(html: string, options: SrcDocOptions): string {
  const kind = classifySlide(html);
  if (kind === 'document') return buildDocument(html, options);
  if (kind === 'empty') {
    return buildFragment('<p class="muted">Esta presentación está vacía.</p>', options);
  }
  return buildFragment(html, options);
}
