import type { IndexItem } from './types';

interface SlideEntry {
  title: string;
  srcdoc: string;
}

function extractHeadAndBody(rawHtml: string): { head: string; body: string } {
  let head = '';
  let body = rawHtml;

  const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  if (headMatch) head = headMatch[1];
  if (bodyMatch) {
    body = bodyMatch[1];
  } else {
    body = rawHtml
      .replace(/<!doctype[^>]*>/gi, '')
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<\/?head[^>]*>([\s\S]*?)<\/head>/gi, '')
      .replace(/<\/?body[^>]*>/gi, '');
  }

  head = head.replace(/<script\b[^>]*src=["'][^"']*polyfill\.io[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');
  body = body.replace(/<script\b[^>]*src=["'][^"']*polyfill\.io[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');

  return { head, body };
}

function wrapSlideForSrcdoc(rawHtml: string): string {
  const { head, body } = extractHeadAndBody(rawHtml);

  const hasMathJax = /(?:window\.)?MathJax\s*=|mathjax@|tex-mml-chtml|MathJax-script/i.test(rawHtml);
  const hasKatex = /katex/i.test(rawHtml);

  const katexBundle = (!hasKatex)
    ? `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/contrib/auto-render.min.js"
    onload="renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\\\(',right:'\\\\)',display:false},{left:'\\\\[',right:'\\\\]',display:true},{left:'$',right:'$',display:false}],throwOnError:false})">
  </script>`
    : '';

  const mathJaxBundle = (!hasMathJax)
    ? `<script>
  window.MathJax = {
    tex: { inlineMath: [['\\\\(','\\\\)'],['$','$']], displayMath: [['$$','$$'],['\\\\[','\\\\]']], processEscapes: true },
    options: { skipHtmlTags: ['script','noscript','style','textarea','pre','code'] },
    startup: { typeset: false }
  };
</script>
<script async id="MathJax-script-offline" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${katexBundle}
  ${mathJaxBundle}
  ${head}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; width: 100%; min-height: 100%;
      background-color: #0d1b2a; color: #E5E7EB;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
    }
    a { color: #2dd4bf; }
    a:visited { color: #a78bfa; }
    .katex { font-size: 1.1em; color: inherit; }
    .katex-display { overflow-x: auto; padding: 0.5rem 0; margin: 0.75rem 0; text-align: center; }
    .katex .mord, .katex .mbin, .katex .mrel, .katex .mopen,
    .katex .mclose, .katex .mpunct, .katex .minner { color: inherit; }
    .katex-html { color: inherit; }
    #__dl_body { padding: 1.5rem; width: 100%; min-height: 100%; }
  </style>
</head>
<body>
<div id="__dl_body">${body}</div>
</body>
</html>`;
}

function collectSlides(item: IndexItem, slides: SlideEntry[]): void {
  if (item.content && item.content.length > 0) {
    item.content.forEach((html, i) => {
      const label = item.content!.length > 1
        ? `${item.title} (${i + 1}/${item.content!.length})`
        : item.title;
      slides.push({ title: label, srcdoc: wrapSlideForSrcdoc(html || '') });
    });
  }

  if (item.children && item.children.length > 0) {
    for (const child of item.children) {
      collectSlides(child, slides);
    }
  }
}

function safeJsonEmbed(data: unknown): string {
  return JSON.stringify(data)
    .replace(/<\/script>/gi, '<\\/script>')
    .replace(/<!--/g, '<\\!--');
}

export function buildStandalonePresentationHtml(item: IndexItem): string {
  const slides: SlideEntry[] = [];
  collectSlides(item, slides);

  if (slides.length === 0) {
    slides.push({
      title: item.title,
      srcdoc: wrapSlideForSrcdoc(`<h1>${item.title}</h1><p>Sin contenido HTML para este tema.</p>`),
    });
  }

  const slidesJson = safeJsonEmbed(slides);
  const presentationTitle = item.title;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${presentationTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #0d1b2a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; }
    #app { display: flex; flex-direction: column; height: 100vh; }
    #toolbar {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; background: #1a2332;
      border-bottom: 1px solid #2d3f52; flex-shrink: 0;
      min-height: 44px; flex-wrap: wrap;
    }
    #toolbar button {
      background: #2d3f52; border: 1px solid #3d5268; color: #e2e8f0;
      border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 14px;
      display: flex; align-items: center; gap: 4px; line-height: 1;
      transition: background 0.15s;
    }
    #toolbar button:hover:not(:disabled) { background: #3d5268; }
    #toolbar button:disabled { opacity: 0.4; cursor: default; }
    #toolbar button.icon { padding: 4px 8px; font-size: 16px; }
    #counter { font-size: 13px; color: #94a3b8; white-space: nowrap; min-width: 54px; text-align: center; }
    #slide-title { flex: 1; font-size: 13px; font-weight: 500; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; padding: 0 8px; min-width: 0; }
    #dots { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; max-width: 240px; overflow: hidden; }
    .dot { width: 8px; height: 8px; border-radius: 50%; border: none; padding: 0; background: #3d5268; cursor: pointer; transition: background 0.15s, transform 0.15s; flex-shrink: 0; }
    .dot:hover { background: #94a3b8; }
    .dot.active { background: #2dd4bf; transform: scale(1.3); }
    #slide-frame { flex: 1; width: 100%; border: none; display: block; min-height: 0; }
    #progress { height: 3px; background: #2dd4bf; transition: width 0.2s ease; flex-shrink: 0; }
  </style>
</head>
<body>
<div id="app">
  <div id="toolbar">
    <button id="btn-prev" class="icon" title="Anterior">&#8592;</button>
    <span id="counter">1 / 1</span>
    <button id="btn-next" class="icon" title="Siguiente">&#8594;</button>
    <span id="slide-title"></span>
    <div id="dots"></div>
    <button id="btn-fullscreen" class="icon" title="Pantalla completa">&#x26F6;</button>
  </div>
  <div id="progress"></div>
  <iframe id="slide-frame" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-downloads"></iframe>
</div>
<script>
(function(){
  var SLIDES = ${slidesJson};
  var current = 0;
  var frame = document.getElementById('slide-frame');
  var counter = document.getElementById('counter');
  var titleEl = document.getElementById('slide-title');
  var btnPrev = document.getElementById('btn-prev');
  var btnNext = document.getElementById('btn-next');
  var dotsEl = document.getElementById('dots');
  var progress = document.getElementById('progress');
  var btnFS = document.getElementById('btn-fullscreen');
  var SHOW_DOTS = SLIDES.length <= 25;

  function buildDots() {
    if (!SHOW_DOTS) { dotsEl.style.display = 'none'; return; }
    dotsEl.innerHTML = '';
    SLIDES.forEach(function(_, i) {
      var d = document.createElement('button');
      d.className = 'dot' + (i === current ? ' active' : '');
      d.title = SLIDES[i].title;
      d.addEventListener('click', function(){ show(i); });
      dotsEl.appendChild(d);
    });
  }

  function show(index) {
    current = Math.max(0, Math.min(SLIDES.length - 1, index));
    var s = SLIDES[current];
    frame.srcdoc = s.srcdoc;
    counter.textContent = (current + 1) + ' / ' + SLIDES.length;
    titleEl.textContent = s.title;
    btnPrev.disabled = current === 0;
    btnNext.disabled = current === SLIDES.length - 1;
    var pct = SLIDES.length > 1 ? Math.round((current / (SLIDES.length - 1)) * 100) : 100;
    progress.style.width = pct + '%';
    if (SHOW_DOTS) {
      var dots = dotsEl.querySelectorAll('.dot');
      dots.forEach(function(d, i){ d.className = 'dot' + (i === current ? ' active' : ''); });
    }
    try { window.history.replaceState(null, '', '#' + (current + 1)); } catch(e){}
  }

  function navigate(dir) { show(current + dir); }
  btnPrev.addEventListener('click', function(){ navigate(-1); });
  btnNext.addEventListener('click', function(){ navigate(1); });

  document.addEventListener('keydown', function(e) {
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); navigate(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); navigate(-1); }
    else if (e.key === 'Home') { e.preventDefault(); show(0); }
    else if (e.key === 'End') { e.preventDefault(); show(SLIDES.length - 1); }
    else if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
  });

  btnFS.addEventListener('click', toggleFullscreen);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function(){});
    } else {
      document.exitFullscreen().catch(function(){});
    }
  }

  document.addEventListener('fullscreenchange', function() {
    btnFS.textContent = document.fullscreenElement ? '\\u2715' : '\\u26F6';
    btnFS.title = document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa';
  });

  try {
    var hash = parseInt(window.location.hash.replace('#',''), 10);
    if (!isNaN(hash) && hash >= 1 && hash <= SLIDES.length) current = hash - 1;
  } catch(e) {}

  buildDots();
  show(current);
})();
</script>
</body>
</html>`;
}

export function downloadPresentation(item: IndexItem): void {
  const html = buildStandalonePresentationHtml(item);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const filename = item.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase()
    .slice(0, 80) || 'presentacion';

  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
