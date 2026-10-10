import type { SeedChapter } from './fixtures';

/**
 * Presentaciones de prueba para lo que la plataforma corrige al mostrarlas:
 * fórmulas que el archivo deja en crudo y contenido que no cabe a lo ancho.
 * Reproducen defectos encontrados en el curso real; ninguna es contenido suyo.
 */
const ORIGIN = 'http://localhost:9410';

const katexTags = `<link rel="stylesheet" href="${ORIGIN}/katex/katex.min.css">
<script defer src="${ORIGIN}/katex/katex.min.js"></script>
<script defer src="${ORIGIN}/katex/contrib/auto-render.min.js"></script>`;

const page = (title: string, head: string, body: string) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{margin:0;padding:24px;font-family:system-ui,sans-serif}</style>
${head}
</head>
<body>
${body}
</body>
</html>`;

// Cuenta los repasos de KaTeX, sean de la presentación o de la plataforma.
const spy = String.raw`<script>
  window.__calls = 0;
  document.addEventListener('DOMContentLoaded', function () {
    var original = window.renderMathInElement;
    window.renderMathInElement = function () { window.__calls += 1; return original.apply(this, arguments); };
  });
</script>`;

/** Como en el curso real: su configuración trae los delimitadores escapados de más. */
export const mathOverEscaped = page(
  'Fórmulas · delimitadores escapados de más',
  katexTags,
  String.raw`<h1 data-testid="heading">Submuestreo</h1>
<p id="inline">Logra un factor efectivo \(9/2\) sin traslape, con energía $E_\infty$ finita.</p>
<div id="display">$$ x[n] = \sum_{k} a_k e^{jk\omega_0 n} $$</div>
<pre id="pre">\(esto es código\)</pre>
<p>En línea: <code id="code">$x$</code></p>
<script>
  window.addEventListener('DOMContentLoaded', function () {
    renderMathInElement(document.body, {
      delimiters: [{ left: '\\\\(', right: '\\\\)', display: false }, { left: '\\\\[', right: '\\\\]', display: true }],
      throwOnError: false
    });
  });
</script>`,
);

/** No trae KaTeX: la plataforma pone el suyo. */
export const mathWithoutLibrary = page(
  'Fórmulas · sin biblioteca',
  '',
  String.raw`<h1 data-testid="heading">Pitágoras</h1><p id="inline">Se cumple \(a^2+b^2=c^2\) en todo triángulo rectángulo.</p>`,
);

/** Se convierte sola al cargar, pero después inserta texto con fórmulas y no lo repasa. */
export const mathInsertedLater = page(
  'Fórmulas · texto añadido después',
  katexTags + spy,
  String.raw`<h1 data-testid="heading">Energía</h1>
<p id="first">Al inicio: \(E = mc^2\).</p>
<button id="more">Mostrar el resultado</button>
<div id="result"></div>
<script>
  window.addEventListener('DOMContentLoaded', function () {
    renderMathInElement(document.body, { delimiters: [{ left: '\\(', right: '\\)', display: false }], throwOnError: false });
  });
  document.getElementById('more').onclick = function () {
    document.getElementById('result').innerHTML = '<p>Como la energía total es \\(E_\\infty = 1\\), la potencia es nula.</p>';
  };
</script>`,
);

/** Correcta: la plataforma no debe repasarla. */
export const mathCorrect = page(
  'Fórmulas · correcta',
  katexTags + spy,
  String.raw`<h1 data-testid="heading">Euler</h1>
<p id="inline">Identidad: \(e^{j\pi}+1=0\).</p>
<p>Un precio de $5 no es una fórmula.</p>
<script>
  window.addEventListener('DOMContentLoaded', function () {
    renderMathInElement(document.body, { delimiters: [{ left: '\\(', right: '\\)', display: false }], throwOnError: false });
  });
</script>`,
);

/** Un delimitador sin cerrar: KaTeX no puede con él y no hay que insistir. */
export const mathUnbalanced = page(
  'Fórmulas · sin cerrar',
  katexTags + spy,
  String.raw`<h1 data-testid="heading">Pendiente</h1>
<p id="open">Falta cerrar: \(\omega_M &lt; \omega_{co} y el texto sigue.</p>
<button id="more">Añadir una fórmula</button>
<div id="result"></div>
<script>
  document.getElementById('more').onclick = function () {
    var p = document.createElement('p');
    p.textContent = 'Otra: \\(x^2\\).';
    document.getElementById('result').appendChild(p);
  };
</script>`,
);

const toolbarCss = `<style>
  body{padding:0;overflow-x:hidden}
  .bar{display:flex;gap:10px;padding:10px;white-space:nowrap}
  .bar button{flex:0 0 100px;height:40px}
  main{padding:24px}
</style>`;

/** Una barra de cinco botones que no se pliega: necesita 560 px. */
export const wideToolbar = page(
  'Ancho · barra de botones',
  toolbarCss,
  `<div class="bar">
  <button id="b1">Anterior</button><button id="b2">Siguiente</button><button id="b3">Modo</button>
  <button id="b4">Tema</button><button id="b5">Último</button>
</div>
<main><h1 data-testid="heading">Barra ancha</h1><p>Texto de la lámina.</p></main>`,
);

/** Un adorno que sobresale a propósito: no es motivo para reducir. */
export const decoration = page(
  'Ancho · adorno fuera de pantalla',
  `<style>
  body{overflow-x:hidden;position:relative;min-height:100vh}
  .blob{position:absolute;top:40px;right:-260px;width:520px;height:520px;border-radius:50%;background:#c7d2fe}
  .drawer{position:fixed;top:0;left:100%;width:320px;height:100%;background:#eee}
</style>`,
  `<div class="blob"></div>
<aside class="drawer"><button>Opción del panel</button></aside>
<h1 data-testid="heading">Con adorno</h1><p>El círculo se sale de la pantalla y así debe quedarse.</p>`,
);

/** Láminas puestas una al lado de la otra: la siguiente no debe asomar. */
export const sideBySide = page(
  'Ancho · láminas en fila',
  `<style>
  body{padding:0;overflow:hidden}
  .track{display:flex;width:300vw;transition:none}
  .panel{flex:0 0 100vw;min-height:100vh;padding:24px;box-sizing:border-box}
</style>`,
  `<div class="track">
  <section class="panel"><h1 data-testid="heading">Fila 1</h1><button>Uno</button></section>
  <section class="panel"><h1>Fila 2</h1><button>Dos</button></section>
  <section class="panel"><h1>Fila 3</h1><button>Tres</button></section>
</div>`,
);

export const labCourse: SeedChapter[] = [
  {
    id: 'lab',
    title: '1 Laboratorio',
    topics: [
      { id: 'lab-formulas', title: '1.1 Fórmulas', decks: [mathOverEscaped, mathWithoutLibrary, mathInsertedLater, mathCorrect, mathUnbalanced] },
      { id: 'lab-ancho', title: '1.2 Ancho', decks: [wideToolbar, decoration, sideBySide] },
    ],
  },
];
