/**
 * Presentaciones de prueba. Reproducen las familias de navegación que hay en
 * el curso real (ninguna es contenido del curso):
 *
 *  A  `.slide.active`, teclado propio con preventDefault, se detiene al final.
 *  B  `.slide.active`, da la vuelta al llegar al final, entiende AvPág.
 *  C  solo botones (#btnNext / #btnPrev), láminas `.slide-card` con `.hidden`.
 *  D  documento continuo, sin láminas ni teclado.
 *  G  última lámina con pasos por revelar.
 */
const head = (title: string, extra = '') => `<!DOCTYPE html>
<html lang="es" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#fffdf8;color:#172033}
  header{position:sticky;top:0;display:flex;gap:8px;align-items:center;padding:8px 16px;background:#fff;border-bottom:1px solid #ddd}
  .slide,.slide-card{min-height:70vh;padding:32px}
  .slide{display:none}.slide.active{display:block}
  .hidden{display:none}
  ${extra}
</style>
</head>`;

export const deckA = `${head('Deck A · Señales continuas')}
<body data-view="presentation">
<header><strong>Deck A</strong><span id="slideCounter">1 / 3</span><button id="btn-prev">◀ Ant</button><button id="btn-next">Sig ▶</button><a href="#deck">Ir al contenido</a></header>
<main id="deck">
  <section class="slide active"><h1 data-testid="heading">A1</h1></section>
  <section class="slide"><h1 data-testid="heading">A2</h1></section>
  <section class="slide"><h1 data-testid="heading">A3</h1></section>
</main>
<script>
  var App = { slide: 0 };
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  function goToSlide(i) {
    if (i < 0 || i >= slides.length) return;
    App.slide = i;
    slides.forEach(function (s, k) { s.classList.toggle('active', k === i); });
    document.getElementById('slideCounter').textContent = (i + 1) + ' / ' + slides.length;
  }
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goToSlide(App.slide + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goToSlide(App.slide - 1); }
  });
  document.getElementById('btn-next').onclick = function () { goToSlide(App.slide + 1); };
  document.getElementById('btn-prev').onclick = function () { goToSlide(App.slide - 1); };
</script>
</body>
</html>`;

export const deckB = `${head('Deck B · Convolución periódica')}
<body>
<main class="deck">
  <section class="slide active"><h1 data-testid="heading">B1</h1></section>
  <section class="slide"><h1 data-testid="heading">B2</h1></section>
</main>
<nav><button id="prevBtn">← Anterior</button><span id="slideCount">1 / 2</span><button id="nextBtn">Siguiente →</button></nav>
<script>
  var slideIndex = 0;
  function showSlide(i) {
    var slides = [].slice.call(document.querySelectorAll('.slide'));
    slideIndex = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) { s.classList.toggle('active', k === slideIndex); });
    document.getElementById('slideCount').textContent = (slideIndex + 1) + ' / ' + slides.length;
  }
  document.getElementById('prevBtn').onclick = function () { showSlide(slideIndex - 1); };
  document.getElementById('nextBtn').onclick = function () { showSlide(slideIndex + 1); };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') showSlide(slideIndex + 1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') showSlide(slideIndex - 1);
  });
</script>
</body>
</html>`;

export const deckC = `${head('Deck C · Solo botones')}
<body class="p-2">
<section class="slide-card"><h1 data-testid="heading">C1</h1></section>
<section class="slide-card hidden"><h1 data-testid="heading">C2</h1></section>
<section class="slide-card hidden"><h1 data-testid="heading">C3</h1></section>
<footer><button id="btnPrev" disabled>Anterior</button><button id="btnNext">Siguiente</button></footer>
<script>
  var cur = 0;
  var cards = [].slice.call(document.querySelectorAll('.slide-card'));
  function render() {
    cards.forEach(function (c, k) { c.classList.toggle('hidden', k !== cur); });
    document.getElementById('btnPrev').disabled = cur === 0;
    document.getElementById('btnNext').disabled = cur === cards.length - 1;
  }
  document.getElementById('btnNext').addEventListener('click', function () { if (cur < cards.length - 1) { cur++; render(); } });
  document.getElementById('btnPrev').addEventListener('click', function () { if (cur > 0) { cur--; render(); } });
</script>
</body>
</html>`;

export const deckD = `${head('Deck D · Documento continuo')}
<body>
<article style="padding:32px;max-width:60ch">
  <h1 data-testid="heading">D</h1>
  ${Array.from({ length: 40 }, (_, i) => `<p>Párrafo ${i + 1} de un documento que se lee desplazando la página.</p>`).join('\n  ')}
</article>
</body>
</html>`;

export const deckG = `${head('Deck G · Pasos por revelar')}
<body>
<main>
  <section class="slide active"><h1 data-testid="heading">G1</h1></section>
  <section class="slide">
    <h1 data-testid="heading">G2</h1>
    <p class="step" style="display:none" data-testid="step">Paso oculto</p>
  </section>
</main>
<script>
  var at = 0;
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight') return;
    e.preventDefault();
    var pending = slides[at].querySelector('.step[style*="none"]');
    if (pending) { pending.style.display = 'block'; return; }
    if (at < slides.length - 1) { slides[at].classList.remove('active'); at++; slides[at].classList.add('active'); }
  });
</script>
</body>
</html>`;

export const fragment = '<h1>Fragmento suelto</h1><p class="muted">Identidad de Euler: \\(e^{j\\pi}+1=0\\)</p>';

/** Lo que pasa al pegar el guion generador en lugar del archivo HTML. */
export const wrappedDeck = `from pathlib import Path\n\nhtml = r'''${deckA}'''\n\nout = Path('/mnt/data/deck.html')\nout.write_text(html, encoding='utf-8')\nprint('Archivo creado')\n`;

export const brokenDeck = `${head('Deck con error')}
<body><h1 data-testid="heading">Roto</h1><script>noExiste.algo();</script></body>
</html>`;

export interface SeedTopic {
  id: string;
  title: string;
  decks?: string[];
}

export interface SeedChapter {
  id: string;
  title: string;
  topics: SeedTopic[];
}

export const course: SeedChapter[] = [
  {
    id: 'cap1',
    title: '1 Señales y Sistemas',
    topics: [
      { id: 'cap1-intro', title: '1.1 Introducción', decks: [deckA] },
      { id: 'cap1-senales', title: '1.2 Señales continuas y discretas', decks: [deckA, deckB, deckC] },
      { id: 'cap1-vacio', title: '1.3 Señales de energía y de potencia' },
      { id: 'cap1-doc', title: '1.4 Transformaciones de la variable independiente', decks: [deckD, fragment] },
    ],
  },
  {
    id: 'cap2',
    title: '2 Sistemas Lineales Invariantes en el Tiempo',
    topics: [
      { id: 'cap2-pasos', title: '2.1 Introducción', decks: [deckG, deckA] },
      { id: 'cap2-mal', title: '2.2 Suma de convolución', decks: [wrappedDeck, brokenDeck, ''] },
    ],
  },
  { id: 'cap3', title: '3 Series de Fourier', topics: [{ id: 'cap3-a', title: '3.1 Introducción y perspectiva histórica' }] },
];

function titleOf(html: string, fallback: string): string {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1] : fallback;
}

const bytes = (text: string) => new TextEncoder().encode(text).byteLength;

/** Temario ligero (formato nuevo) para `meta/outline`. */
export function outlineOf(chapters: SeedChapter[], rev: number) {
  return chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    children: chapter.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      ...(topic.decks && topic.decks.length > 0
        ? { decks: topic.decks.map((html, i) => ({ title: titleOf(html, `Presentación ${i + 1}`), bytes: bytes(html) })), rev }
        : {}),
    })),
  }));
}

/** Árbol con HTML incrustado (formato anterior y respaldos). */
export function indexOf(chapters: SeedChapter[]) {
  return chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    children: chapter.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      ...(topic.decks && topic.decks.length > 0 ? { content: topic.decks } : {}),
    })),
  }));
}
