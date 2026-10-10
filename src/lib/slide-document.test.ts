import { describe, expect, it } from 'vitest';
import { SLIDE_BRIDGE_SOURCE } from './slide-bridge';
import { buildSlideSrcDoc, classifySlide, extractTitle, inspectSlide, normalizeDocument, repairSlide } from './slide-document';

const options = { token: 'abc123', origin: 'https://curso.example', theme: 'dark' as const };

const deck = `<!DOCTYPE html>
<html lang="es" data-theme="light">
<head>
<meta charset="utf-8">
<title>Ejemplo 5.15 &middot; Convoluci&oacute;n peri&#243;dica</title>
<style>body{margin:0}</style>
</head>
<body class="h-full flex"><main>Hola</main><script>window.listo = true;</script></body>
</html>`;

const wrapped = `from pathlib import Path\n\nhtml = r'''${deck}'''\n\nout = Path('/mnt/data/x.html')\nprint('Archivo creado')\n`;

describe('classifySlide', () => {
  it('distingue documentos completos, fragmentos y vacíos', () => {
    expect(classifySlide(deck)).toBe('document');
    expect(classifySlide('<body><p>x</p></body>')).toBe('document');
    expect(classifySlide('<h1>Título</h1><p>Texto</p>')).toBe('fragment');
    expect(classifySlide('   \n')).toBe('empty');
  });
});

describe('normalizeDocument', () => {
  it('deja intacto un documento limpio', () => {
    expect(normalizeDocument(deck)).toEqual({ html: deck, trimmedBefore: 0, trimmedAfter: 0 });
  });

  it('recorta el guion que envuelve al documento', () => {
    const result = normalizeDocument(wrapped);
    expect(result.html).toBe(deck);
    expect(result.trimmedBefore).toBeGreaterThan(0);
    expect(result.trimmedAfter).toBeGreaterThan(0);
  });

  it('no cuenta como basura los comentarios ni el BOM', () => {
    const result = normalizeDocument(`﻿<!-- saved from url=(0014)about:internet -->\n${deck}\n<!-- fin -->`);
    expect(result.trimmedBefore).toBe(0);
    expect(result.trimmedAfter).toBe(0);
    expect(result.html.startsWith('<!DOCTYPE html>')).toBe(true);
  });
});

describe('extractTitle', () => {
  it('decodifica entidades y compacta espacios', () => {
    expect(extractTitle(deck)).toBe('Ejemplo 5.15 · Convolución periódica');
    expect(extractTitle('<title>\n  Dos   líneas\n</title>')).toBe('Dos líneas');
  });

  it('devuelve null si no hay título', () => {
    expect(extractTitle('<h1>Sin title</h1>')).toBeNull();
    expect(extractTitle('<title>   </title>')).toBeNull();
  });
});

describe('inspectSlide / repairSlide', () => {
  it('no reporta nada en un documento sano', () => {
    expect(inspectSlide(deck).issues).toEqual([]);
  });

  it('detecta y repara el texto fuera del documento', () => {
    const report = inspectSlide(wrapped);
    expect(report.issues.map((issue) => issue.code)).toEqual(['outside-html']);
    expect(report.issues[0].fixable).toBe(true);
    expect(repairSlide(wrapped)).toBe(deck);
    expect(inspectSlide(repairSlide(wrapped)).issues).toEqual([]);
  });

  it('detecta presentaciones vacías, la plantilla de ejemplo y polyfill.io', () => {
    expect(inspectSlide('').issues.map((issue) => issue.code)).toEqual(['empty']);
    expect(inspectSlide('<h1>Nueva Diapositiva</h1><p>Haz clic en "Editar" para añadir contenido.</p>').issues.map((issue) => issue.code)).toEqual(['placeholder']);
    const withPolyfill = deck.replace('</head>', '<script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script></head>');
    expect(inspectSlide(withPolyfill).issues.map((issue) => issue.code)).toEqual(['polyfill-io']);
    expect(repairSlide(withPolyfill)).toBe(deck);
  });
});

describe('buildSlideSrcDoc', () => {
  it('entrega el documento tal cual y solo añade el puente al inicio de <head>', () => {
    const out = buildSlideSrcDoc(deck, options);
    const withoutBridge = out.replace(/<script data-sys-bridge>[\s\S]*?<\/script>/, '');
    expect(withoutBridge).toBe(deck);
    expect(out.indexOf('<script data-sys-bridge>')).toBe(out.indexOf('<head>') + '<head>'.length);
    // Sin envoltorios, hojas de estilo ni <base> de la app.
    expect(out).not.toContain('__slide_viewport');
    expect(out).not.toContain('<base');
    expect(out).not.toContain('/_next/static/css');
    expect(out).toContain('"token":"abc123"');
    expect(out).toContain('"origin":"https://curso.example"');
  });

  it('sin puente devuelve el archivo original (para descargar)', () => {
    expect(buildSlideSrcDoc(deck, { ...options, bridge: false })).toBe(deck);
    expect(buildSlideSrcDoc(wrapped, { ...options, bridge: false })).toBe(deck);
  });

  it('inserta el puente aunque falte <head> o el doctype', () => {
    expect(buildSlideSrcDoc('<html><body>x</body></html>', options)).toMatch(/^<html><script data-sys-bridge>/);
    expect(buildSlideSrcDoc('<body>x</body>', options)).toMatch(/^<script data-sys-bridge>/);
  });

  it('envuelve los fragmentos en la plantilla de la app', () => {
    const out = buildSlideSrcDoc('<h1>Hola</h1><p>\\(x[n]\\)</p>', { ...options, title: 'Tema <1>' });
    expect(out).toContain('<html lang="es" data-theme="dark">');
    expect(out).toContain('<title>Tema &lt;1&gt;</title>');
    expect(out).toContain('<main class="sys-fragment"><h1>Hola</h1>');
    expect(out).toContain('<script defer src="https://curso.example/katex/katex.min.js">');
    expect(out).toContain('"fragment":true');
  });

  it('un fragmento sin fórmulas no carga KaTeX', () => {
    // El puente lo pide por su cuenta solo si aparece TeX en crudo.
    expect(buildSlideSrcDoc('<p>Solo texto</p>', options)).not.toContain('<script defer src="https://curso.example/katex/katex.min.js">');
  });

  it('en modo sin confianza quita los scripts del contenido pero conserva el puente', () => {
    const out = buildSlideSrcDoc(deck, { ...options, trusted: false });
    expect(out).not.toContain('window.listo');
    expect(out).toContain('<script data-sys-bridge>');
  });

  it('una presentación vacía muestra un aviso en vez de una página en blanco', () => {
    expect(buildSlideSrcDoc('', options)).toContain('Esta presentación está vacía.');
  });
});

describe('puente', () => {
  it('es JavaScript válido y autocontenido', () => {
    expect(() => new Function(SLIDE_BRIDGE_SOURCE)).not.toThrow();
    // Viaja dentro de un <script>: no puede cerrar la etiqueta.
    expect(SLIDE_BRIDGE_SOURCE.toLowerCase()).not.toContain('</script');
    expect(SLIDE_BRIDGE_SOURCE).not.toMatch(/\b(require|__vite|_interop|import)\s*\(/);
  });

  it('no hace nada fuera de un iframe de la app', () => {
    const fakeWindow = { parent: null as unknown, __SYS_BRIDGE__: { token: 't' } };
    fakeWindow.parent = fakeWindow;
    expect(() => new Function('window', SLIDE_BRIDGE_SOURCE)(fakeWindow)).not.toThrow();
    expect('__sysBridge' in fakeWindow).toBe(false);
  });
});
