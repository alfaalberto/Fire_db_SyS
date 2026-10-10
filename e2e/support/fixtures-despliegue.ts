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

/** Hace su repaso tarde (como varias del curso real): no hay que adelantársele. */
export const mathLate = page(
  'Fórmulas · repaso tardío',
  katexTags + spy,
  String.raw`<h1 data-testid="heading">Tardía</h1>
<p id="inline">Suma: $a+b$ y \(c\).</p>
<script>
  function renderMath() {
    if (typeof renderMathInElement !== 'function') return setTimeout(renderMath, 150);
    renderMathInElement(document.body, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }],
      throwOnError: false
    });
  }
  window.addEventListener('load', function () { setTimeout(renderMath, 400); });
</script>`,
);

/** Define abreviaturas propias: lo que la plataforma convierta debe respetarlas. */
export const mathMacros = page(
  'Fórmulas · abreviaturas propias',
  katexTags,
  String.raw`<h1 data-testid="heading">Vectores</h1>
<p id="first">Sea \(\vect{x}\).</p>
<button id="more">Añadir</button>
<div id="result"></div>
<script>
  var OPTIONS = { delimiters: [{ left: '\\(', right: '\\)', display: false }], macros: { '\\vect': '\\mathbf{#1}' }, throwOnError: false };
  window.addEventListener('DOMContentLoaded', function () { renderMathInElement(document.body, OPTIONS); });
  document.getElementById('more').onclick = function () {
    document.getElementById('result').innerHTML = '<p>Luego \\(\\vect{y}\\) y también $z$.</p>';
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

/** Mide según la ventana (97vw más relleno): agrandarla no lo arregla. */
export const viewportRelative = page(
  'Ancho · relativo a la ventana',
  `<style>
  body{padding:0;overflow-x:hidden}
  main{width:97vw;padding:0 22px;box-sizing:content-box}
</style>`,
  `<main><h1 data-testid="heading">Casi cabe</h1><p>Siempre sobra el mismo margen.</p></main>`,
);

/** Una franja de 100vw con barra de desplazamiento vertical: no es contenido cortado. */
export const fullWidthBand = page(
  'Ancho · franja de 100vw',
  `<style>
  body{padding:0}
  .band{width:100vw;background:#dbeafe;padding:12px 0}
  .tall{height:1800px}
</style>`,
  `<div class="band"><h1 data-testid="heading">Franja completa</h1></div><div class="tall"></div>`,
);

/** Dos o más `.slide`, una activa, con botones Anterior y Siguiente. */
const toggleScript = `<script>
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  var at = 0;
  function go(i) { if (i < 0 || i >= slides.length) return; at = i; slides.forEach(function (s, k) { s.classList.toggle('active', k === at); }); }
  document.getElementById('btn-next').onclick = function () { go(at + 1); };
  document.getElementById('btn-prev').onclick = function () { go(at - 1); };
</script>`;

const columnCss = `<style>
  body{padding:0}
  main{max-width:760px;margin:0 auto;padding:24px 0}
  .block{height:380px;background:#e0e7ff;border-radius:12px}
  .slide{display:none;min-height:220px}.slide.active{display:block}
</style>`;

const paragraphs = (count: number) =>
  Array.from({ length: count }, (_, i) => `<p>Párrafo ${i + 1} de una columna centrada que deja márgenes a los lados.</p>`).join('\n');

/** Página larga en una columna estrecha: se amplía hasta llenar el ancho. */
export const narrowPage = page(
  'Tamaño · columna estrecha',
  columnCss,
  `<main><h1 data-testid="heading">Columna estrecha</h1>
${paragraphs(60)}
</main>`,
);

/** Lámina corta en una columna estrecha: ampliada sigue cabiendo. */
export const narrowSlide = page(
  'Tamaño · lámina corta',
  columnCss,
  `<main><h1 data-testid="heading">Lámina corta</h1>
${paragraphs(3)}
</main>`,
);

/** Lámina que casi llena el alto: solo admite ampliarse un poco. */
export const tightSlide = page(
  'Tamaño · lámina justa',
  columnCss,
  `<main><h1 data-testid="heading">Lámina justa</h1><p>Una figura ocupa casi todo el alto.</p><div class="block"></div><p>Pie de la lámina.</p></main>`,
);

/** Dos láminas: una corta y una justa. El tamaño es uno para las dos: manda la justa. */
export const twoSizes = page(
  'Tamaño · láminas distintas',
  columnCss,
  `<main>
  <section class="slide active"><h1 data-testid="heading">Corta</h1>${paragraphs(2)}</section>
  <section class="slide"><h1 data-testid="heading">Justa</h1><div class="block"></div><p>Pie de la lámina.</p></section>
  <p><button id="btn-prev">Anterior</button> <button id="btn-next">Siguiente</button></p>
</main>
${toggleScript}`,
);

const navRow = `<p><button id="btn-prev">Anterior</button> <button id="btn-next">Siguiente</button></p>`;
const shortSlide = (title: string, active = false) =>
  `<section class="slide${active ? ' active' : ''}"><h1 data-testid="heading">${title}</h1>${paragraphs(2)}</section>`;
const tallSlide = (title: string, height: number) =>
  `<section class="slide"><h1 data-testid="heading">${title}</h1><p>Una figura alta. <input id="campo" aria-label="Valor"></p><div class="block" style="height:${height}px"></div><p>Pie de la lámina.</p></section>`;

/** Portada corta y láminas que ya llenan la pantalla: ampliar solo la portada sería un vaivén. */
export const coverThenFull = page(
  'Tamaño · portada y láminas llenas',
  columnCss,
  `<main>
  ${shortSlide('Portada', true)}
  ${tallSlide('Llena uno', 640)}
  ${tallSlide('Llena dos', 700)}
  ${navRow}
</main>
${toggleScript}`,
);

/** Casi todas caben; una es larga y ya se desplazaba. Se amplía y la larga no lo impide. */
export const mostlyShort = page(
  'Tamaño · una lámina larga',
  columnCss,
  `<main>
  ${shortSlide('Primera', true)}
  ${tallSlide('La larga', 900)}
  ${shortSlide('Tercera')}
  ${shortSlide('Cuarta')}
  ${navRow}
</main>
${toggleScript}`,
);

/** La segunda lámina dibuja su figura al llegar a ella: no se puede prever desde la portada. */
export const lateSlide = page(
  'Tamaño · lámina que se completa al llegar',
  columnCss,
  `<main>
  ${shortSlide('Corta', true)}
  <section class="slide" id="late"><h1 data-testid="heading">Tardía</h1><p>Su figura se dibuja al llegar.</p><p>Pie de la lámina.</p></section>
  ${navRow}
</main>
${toggleScript}
<script>
  document.getElementById('btn-next').addEventListener('click', function () {
    var slide = document.getElementById('late');
    if (slide.querySelector('.block')) return;
    var figure = document.createElement('div');
    figure.className = 'block';
    slide.insertBefore(figure, slide.lastElementChild);
  });
</script>`,
);

const headerCss = `<style>
  body{padding:0;overflow-x:hidden}
  header{display:flex;gap:10px;padding:10px;white-space:nowrap}
  header button{flex:0 0 120px;height:36px}
  main{padding:24px}
</style>`;

const options = Array.from({ length: 11 }, (_, i) => `<button>Opción ${i + 1}</button>`).join('');

/** Cabecera con muchos botones secundarios: en el escritorio no justifica achicar todo. */
export const wideHeader = page(
  'Tamaño · cabecera larga',
  headerCss,
  `<header>${options}<button>Auditar</button></header>
<main><h1 data-testid="heading">Cabecera larga</h1><p>El contenido cabe; solo la barra se sale.</p></main>`,
);

/** La misma cabecera, pero lo que queda fuera es el botón de avanzar. */
export const wideHeaderNav = page(
  'Tamaño · cabecera con avance',
  headerCss,
  `<header>${options}<button id="btn-next">Siguiente</button></header>
<main><h1 data-testid="heading">Avance cortado</h1><p>Sin reducirla no se podría avanzar.</p></main>`,
);

const stageCss = `<style>
  html,body{height:100%}
  body{padding:0;display:flex;flex-direction:column;align-items:center}
  header,footer{flex:0 0 40px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px}
  .stage{position:relative;width:100%;max-width:760px;height:420px;margin:auto;overflow:hidden;background:#eef2ff}
  .slide{position:absolute;inset:0;padding:16px;overflow-y:auto;visibility:hidden;opacity:0}
  .slide.active{visibility:visible;opacity:1}
  .slide h1{margin:0;height:40px;font-size:28px}
  .slide p{margin:0;height:24px}
</style>`;

const stageSlide = (title: string, filler: number) =>
  `<h1 data-testid="heading">${title}</h1><p>Primera línea de la lámina.</p><p>Segunda línea de la lámina.</p><div style="height:${filler}px"></div>`;

const stageDeck = (title: string, first: string, second: string) =>
  page(
    title,
    stageCss,
    `<header>Escenario de tamaño fijo</header>
<div class="stage">
  <section class="slide active">${first}</section>
  <section class="slide">${second}</section>
</div>
<footer><button id="btn-prev">Anterior</button><button id="btn-next">Siguiente</button></footer>
${toggleScript}`,
  );

/**
 * Escenario de 760 × 420 centrado, como las presentaciones de tamaño fijo del
 * curso: se amplía hasta donde cabe a lo alto. Su segunda lámina se desplaza
 * por dentro, igual ampliada que sin ampliar; eso no debe quitarle la ampliación.
 */
export const fixedStage = stageDeck('Tamaño · escenario fijo', stageSlide('Portada', 100), stageSlide('Lámina larga', 700));

/** El mismo escenario, pero ya la primera lámina se desplaza un poco por dentro. */
export const fixedStageTight = stageDeck('Tamaño · escenario fijo y justo', stageSlide('Casi cabe', 340), stageSlide('Otra', 100));

/** Columna estrecha con un diseño de tableta por debajo de 900 px: no debe cruzarlo. */
export const withBreakpoint = page(
  'Tamaño · punto de corte',
  `<style>
  body{padding:0}
  main{max-width:760px;margin:0 auto;padding:24px 0}
  #mode::after{content:"escritorio"}
  @media (max-width: 900px){ #mode::after{content:"tableta"} main{max-width:none;padding:24px} }
</style>`,
  `<main><h1 data-testid="heading">Con punto de corte</h1><p>Diseño: <span id="mode"></span></p>
${paragraphs(60)}
</main>`,
);

/** Lo mismo, pero el punto de corte lo consulta su código con matchMedia. */
export const withScriptBreakpoint = page(
  'Tamaño · punto de corte en el código',
  columnCss,
  `<main><h1 data-testid="heading">Corte en el código</h1><p>Diseño: <span id="mode"></span></p>
${paragraphs(60)}
</main>
<script>
  var compact = window.matchMedia('(max-width: 960px)');
  function apply() { document.getElementById('mode').textContent = compact.matches ? 'tableta' : 'escritorio'; }
  apply();
  window.addEventListener('resize', apply);
</script>`,
);

/** Escenario del alto de la ventana que recorta lo que no cabe: ampliada no debe perder la última línea. */
export const clippedStage = page(
  'Tamaño · escenario que recorta',
  `<style>
  html,body{height:100%}
  body{padding:0;overflow:hidden}
  .stage{height:100vh;overflow:hidden;display:flex;flex-direction:column;align-items:center}
  .content{width:100%;max-width:760px}
  .block{height:400px;background:#e0e7ff;border-radius:12px}
</style>`,
  `<div class="stage"><div class="content"><h1 data-testid="heading">Escenario que recorta</h1><p>Una figura ocupa casi todo el alto.</p><div class="block"></div><p id="last">Última línea.</p></div></div>`,
);

/** Columna que mide según la ventana: ampliar no la acerca a los bordes. */
export const viewportColumn = page(
  'Tamaño · columna en vw',
  `<style>body{padding:0} main{width:60vw;margin:0 auto;padding:24px 0}</style>`,
  `<main><h1 data-testid="heading">Columna en vw</h1>
${paragraphs(60)}
</main>`,
);

/** Laboratorio de una sola página: su botón «siguiente» avanza la muestra, no una lámina. */
export const labPage = page(
  'Laboratorio · una sola página',
  '',
  `<h1 data-testid="heading">Laboratorio</h1>
<p>Muestra <span id="n">0</span></p>
<button id="btn-prev" aria-label="Muestra anterior">◀</button>
<button id="btn-next" aria-label="Muestra siguiente">▶</button>
<script>
  var n = 0;
  document.getElementById('btn-next').onclick = function () { n += 1; document.getElementById('n').textContent = String(n); };
  document.getElementById('btn-prev').onclick = function () { n -= 1; document.getElementById('n').textContent = String(n); };
</script>`,
);

/** Usa las flechas para mover una figura en un lienzo; el documento no cambia. */
export const labKeys = page(
  'Laboratorio · teclado propio',
  '',
  `<h1 data-testid="heading">Lienzo</h1>
<canvas id="c" width="200" height="100"></canvas>
<script>
  var x = 10;
  var ctx = document.getElementById('c').getContext('2d');
  function draw() { ctx.clearRect(0, 0, 200, 100); ctx.fillRect(x, 40, 20, 20); }
  draw();
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') x += 10;
    if (e.key === 'ArrowLeft') x -= 10;
    draw();
  });
</script>`,
);

/** Láminas que se redibujan en un único contenedor: no hay grupo que detectar. */
export const rerendered = page(
  'Láminas redibujadas',
  '',
  `<div id="root"></div>
<script>
  var pages = ['Página 1', 'Página 2'];
  var at = 0;
  function show() { document.getElementById('root').innerHTML = '<h1 data-testid="heading">' + pages[at] + '</h1>'; }
  show();
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' && at < pages.length - 1) { at += 1; show(); }
    if (e.key === 'ArrowLeft' && at > 0) { at -= 1; show(); }
  });
</script>`,
);

const closing = page('Cierre', '', '<h1 data-testid="heading">Cierre</h1>');

export const labCourse: SeedChapter[] = [
  {
    id: 'lab',
    title: '1 Laboratorio',
    topics: [
      { id: 'lab-formulas', title: '1.1 Fórmulas', decks: [mathOverEscaped, mathWithoutLibrary, mathInsertedLater, mathCorrect, mathUnbalanced, mathLate, mathMacros] },
      { id: 'lab-ancho', title: '1.2 Ancho', decks: [wideToolbar, decoration, sideBySide, viewportRelative, fullWidthBand] },
      { id: 'lab-tamano', title: '1.4 Tamaño', decks: [narrowPage, narrowSlide, tightSlide, twoSizes, wideHeader, wideHeaderNav] },
      { id: 'lab-escenario', title: '1.5 Escenarios y cortes', decks: [fixedStage, fixedStageTight, withBreakpoint, withScriptBreakpoint, clippedStage, viewportColumn] },
      { id: 'lab-conjunto', title: '1.6 La presentación entera', decks: [coverThenFull, mostlyShort, lateSlide] },
      { id: 'lab-unica', title: '1.3 Páginas únicas', decks: [labPage, labKeys, rerendered, closing] },
    ],
  },
];
