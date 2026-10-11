import type { SeedChapter } from './fixtures';

/**
 * Presentaciones de prueba para el ajuste de tamaño en pantallas grandes.
 * Reproducen las formas de maquetar que hay en el curso real (ninguna es
 * contenido suyo): una lámina 16:9 de medidas fijas, tarjetas de alto variable
 * en una columna, un panel que ocupa la ventana, márgenes que dependen de ella…
 */
const doc = (title: string, css: string, body: string) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0}
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
  h1{margin:0 0 16px;font-size:32px}
  p{margin:0 0 12px;font-size:16px;line-height:1.5}
  button{font:inherit;padding:6px 12px}
  ${css}
</style>
</head>
<body>
${body}
</body>
</html>`;

/** Navegación mínima: botones y flechas, con contador «1 / n». */
const nav = (selector: string, shown: string) => `<script>
  (function () {
    var slides = [].slice.call(document.querySelectorAll('${selector}'));
    var at = 0;
    function go(i) {
      if (i < 0 || i >= slides.length) return;
      at = i;
      slides.forEach(function (s, k) { ${shown} });
      var counter = document.getElementById('counter');
      if (counter) counter.textContent = (i + 1) + ' / ' + slides.length;
    }
    document.getElementById('next').onclick = function () { go(at + 1); };
    document.getElementById('prev').onclick = function () { go(at - 1); };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
    });
  })();
</script>`;

const bar = `<header><strong>Señales y Sistemas</strong><span><span id="counter">1 / 2</span> <button id="prev">Anterior</button> <button id="next">Siguiente</button></span></header>`;

const stageCss = `
  body{min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden}
  header{flex:none;height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:#111827;border-bottom:1px solid #334155}
  main{flex:1;width:100%;max-width:1320px;margin:0 auto;padding:20px 60px}
  .stage{position:relative;max-width:1200px;aspect-ratio:16/9;margin:0 auto;background:#1e293b;border:1px solid #475569;border-radius:16px;overflow:hidden}
  .slide{position:absolute;inset:0;padding:48px;display:none}
  .slide.active{display:block}
  footer{flex:none;height:36px;display:flex;align-items:center;justify-content:center;font-size:13px}
`;

/** Lámina 16:9 de medidas fijas (1200 × 675) bajo una barra de lado a lado. */
export const fixedStage = doc(
  'Tamaño · lámina 16:9',
  stageCss,
  `${bar}
<main><div class="stage" id="stage">
  <section class="slide active"><h1 data-testid="heading">Lámina fija 1</h1><p>La lámina mide 1200 por 675 píxeles en cualquier pantalla.</p></section>
  <section class="slide"><h1 data-testid="heading">Lámina fija 2</h1><p>Segunda lámina.</p></section>
</div></main>
<footer>Unidad 1</footer>
${nav('.slide', "s.classList.toggle('active', k === i);")}`,
);

/** La misma lámina fija, con un panel que se desplaza por dentro por diseño. */
export const fixedStageScrolling = doc(
  'Tamaño · lámina con panel desplazable',
  `${stageCss}
  .notes{height:380px;overflow:auto;background:#0b1220;border-radius:12px;padding:16px}
  .notes div{height:900px}`,
  `${bar}
<main><div class="stage" id="stage">
  <section class="slide active"><h1 data-testid="heading">Con panel</h1><div class="notes" id="notes"><div>Un desarrollo largo que se lee desplazando el panel.</div></div></section>
  <section class="slide"><h1 data-testid="heading">Con panel 2</h1></section>
</div></main>
<footer>Unidad 1</footer>
${nav('.slide', "s.classList.toggle('active', k === i);")}`,
);

/** Tarjetas de alto variable en una columna de 1152 px; la segunda es la más alta. */
export const flowCards = doc(
  'Tamaño · tarjetas en columna',
  `
  body{background:#f1f5f9;color:#0f172a;min-height:100vh}
  header{position:sticky;top:0;height:53px;display:flex;align-items:center;justify-content:space-between;padding:0 28px;background:#fff;border-bottom:1px solid #cbd5e1}
  #wrap{max-width:1152px;margin:28px auto 0}
  .slide-card{background:#fff;border:1px solid #cbd5e1;border-radius:18px;padding:40px}
  .slide-card.hidden{display:none}
  .block{background:#e2e8f0;border-radius:12px;padding:16px}
`,
  `${bar.replace('1 / 2', '1 / 3')}
<div id="wrap">
  <section class="slide-card"><h1 data-testid="heading">Tarjeta 1</h1><div class="block" style="height:200px">Bloque corto</div></section>
  <section class="slide-card hidden" id="tall"><h1 data-testid="heading">Tarjeta 2</h1><div class="block" style="height:560px">Bloque alto</div></section>
  <section class="slide-card hidden"><h1 data-testid="heading">Tarjeta 3</h1><div class="block" style="height:300px">Bloque mediano</div></section>
</div>
${nav('.slide-card', "s.classList.toggle('hidden', k !== i);")}`,
);

/** Los márgenes dependen de la ventana: ampliarla no los aprovecha. */
export const fluidMargins = doc(
  'Tamaño · márgenes relativos',
  `
  main{width:76vw;margin:5vh auto}
  .card{background:#1e293b;border:1px solid #475569;border-radius:16px;padding:32px}
`,
  `<main><div class="card"><h1 data-testid="heading">Margen relativo</h1><p>Esta columna mide siempre el 76 % de la ventana.</p></div></main>`,
);

/** Ocupa todo el ancho: no hay nada que aprovechar. */
export const fullWidth = doc(
  'Tamaño · a todo lo ancho',
  `
  main{padding:24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
  .card{background:#1e293b;border:1px solid #475569;border-radius:16px;padding:24px;min-height:300px}
`,
  `<main><div class="card"><h1 data-testid="heading">Tres columnas</h1></div><div class="card"><p>Dos</p></div><div class="card"><p>Tres</p></div></main>`,
);

/** Una página larga en columna estrecha: se lee desplazándola, a su tamaño. */
export const longPage = doc(
  'Tamaño · página larga',
  `
  main{max-width:1000px;margin:0 auto;padding:32px}
  .part{height:900px;background:#1e293b;border:1px solid #475569;border-radius:16px;padding:24px;margin-bottom:24px}
`,
  `<main><div class="part"><h1 data-testid="heading">Página larga</h1></div><div class="part"><p>Segunda parte</p></div><div class="part"><p>Tercera parte</p></div></main>`,
);

/** El panel ocupa la ventana y se desplaza por dentro si su contenido no cabe. */
export const viewportPanel = doc(
  'Tamaño · panel que ocupa la ventana',
  `
  body{height:100vh;overflow:hidden;display:flex;flex-direction:column}
  header{flex:none;height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:#111827}
  #panel{flex:1;min-height:0;width:100%;max-width:1100px;margin:0 auto;padding:24px 0;overflow:auto}
  .card{background:#1e293b;border:1px solid #475569;border-radius:16px;padding:24px;margin-bottom:16px}
`,
  `<header><strong>Laboratorio</strong><button id="more">Añadir un resultado</button></header>
<div id="panel">
  <div class="card" style="height:420px"><h1 data-testid="heading">Panel</h1><p>Contenido inicial.</p></div>
  <div id="extra"></div>
</div>
<script>
  document.getElementById('more').onclick = function () {
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'added';
    card.style.height = '300px';
    card.textContent = 'Resultado añadido después';
    document.getElementById('extra').appendChild(card);
  };
</script>`,
);

/** Flechas fijadas a los bordes de la ventana: la lámina no debe taparlas. */
export const edgeArrows = doc(
  'Tamaño · flechas en los bordes',
  `
  body{min-height:100vh}
  main{max-width:1100px;margin:40px auto 0}
  .card{background:#1e293b;border:1px solid #475569;border-radius:16px;padding:40px;height:480px}
  .arrow{position:fixed;top:300px;width:52px;height:52px;border-radius:50%}
  #prev{left:18px}
  #next{right:18px}
`,
  `<button class="arrow" id="prev" aria-label="Anterior">‹</button><button class="arrow" id="next" aria-label="Siguiente">›</button>
<main><div class="card" id="card"><h1 data-testid="heading">Con flechas</h1><p>Las flechas viven en el margen.</p></div></main>`,
);

/** Una franja ancha, de medidas fijas, que aparece con retraso (entrada animada). */
export const lateBanner = doc(
  'Tamaño · contenido que aparece después',
  `
  body{min-height:100vh;overflow-x:hidden}
  main{max-width:1100px;margin:40px auto 0}
  .card{background:#1e293b;border:1px solid #475569;border-radius:16px;padding:40px;height:380px}
  #banner{width:1440px;margin:24px 0 0 calc(50% - 720px);background:#334155;border-radius:12px;padding:20px;animation:appear .3s 3.6s both}
  @keyframes appear{from{opacity:0}to{opacity:1}}
`,
  `<main><div class="card"><h1 data-testid="heading">Con retraso</h1><p>La franja de abajo tarda en aparecer.</p></div></main>
<div id="banner">Una tabla ancha que entra al final</div>`,
);

/** Una lámina que se acomoda sola al alto de la ventana: la llena siempre. */
export const selfFitting = doc(
  'Tamaño · se acomoda a la ventana',
  `
  body{height:100vh;overflow:hidden;display:flex;flex-direction:column}
  header{flex:none;height:60px;display:flex;align-items:center;padding:0 22px;background:#111827}
  #fit{height:calc(100vh - 84px);aspect-ratio:4/3;margin:12px auto;background:#1e293b;border:1px solid #475569;border-radius:16px;padding:32px;overflow:hidden}
`,
  `<header><strong>Laboratorio</strong></header>
<div id="fit"><h1 data-testid="heading">A la medida</h1><p>Esta lámina ocupa siempre todo el alto de la ventana.</p></div>`,
);

/** Una lámina 16:9 cuyo ancho sigue al de la ventana: su tamaño ya lo decide ella. */
export const fluidStage = doc(
  'Tamaño · lámina que crece con la ventana',
  `
  body{min-height:100vh}
  #wide{width:84%;aspect-ratio:16/9;margin:24px auto 0;background:#1e293b;border:1px solid #475569;border-radius:16px;padding:32px;overflow:hidden}
`,
  `<div id="wide"><h1 data-testid="heading">Con la ventana</h1><p>Mide siempre el 84 % del ancho de la ventana.</p></div>`,
);

export const sizeCourse: SeedChapter[] = [
  {
    id: 'tam',
    title: '1 Tamaño',
    topics: [
      { id: 'tam-fija', title: '1.1 Lámina fija', decks: [fixedStage, fixedStageScrolling] },
      { id: 'tam-columna', title: '1.2 Columna', decks: [flowCards, edgeArrows] },
      { id: 'tam-natural', title: '1.3 A su tamaño', decks: [fluidMargins, fullWidth, longPage] },
      { id: 'tam-panel', title: '1.4 Panel', decks: [viewportPanel] },
      { id: 'tam-tarde', title: '1.5 Con retraso', decks: [lateBanner] },
      { id: 'tam-sola', title: '1.6 Se acomoda sola', decks: [selfFitting, fluidStage] },
    ],
  },
];
