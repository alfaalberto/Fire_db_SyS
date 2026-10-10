import { buildSlideSrcDoc, repairSlide } from './slide-document';

function fileName(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .toLowerCase()
      .slice(0, 80) || 'presentacion'
  );
}

function save(html: string, name: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName(name)}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function embedJson(data: unknown): string {
  // Dentro de <script>: evita cerrar la etiqueta o abrir un comentario HTML.
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Descarga una presentación: el mismo archivo que se subió, ya reparado. */
export function downloadDeck(html: string, title: string): void {
  save(repairSlide(html), title);
}

export interface TopicDeck {
  title: string;
  html: string;
}

/**
 * Un solo archivo con todas las presentaciones del tema y un selector para
 * pasar de una a otra. Cada una se muestra íntegra, igual que en la plataforma.
 */
export function buildTopicFile(topicTitle: string, decks: TopicDeck[]): string {
  const entries = decks.map((deck) => ({
    title: deck.title,
    srcdoc: buildSlideSrcDoc(deck.html, { token: '', origin: '', theme: 'light', bridge: false, title: deck.title }),
  }));

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(topicTitle)}</title>
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;height:100%;background:#0B1020;color:#F8FAFC;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#app{display:flex;flex-direction:column;height:100vh;height:100dvh}
#bar{display:flex;align-items:center;gap:8px;padding:6px 10px;background:#141B2E;border-bottom:1px solid #2A3654;min-height:44px}
#bar button{font:inherit;font-size:14px;color:inherit;background:#1D263E;border:1px solid #2A3654;border-radius:8px;padding:6px 12px;cursor:pointer}
#bar button:hover:not(:disabled){border-color:#60A5FA}
#bar button:disabled{opacity:.4;cursor:default}
#title{flex:1;min-width:0;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#count{font-variant-numeric:tabular-nums;font-size:13px;color:#B7C0D8;white-space:nowrap}
#frame{flex:1;min-height:0;width:100%;border:0;background:#fff}
</style>
</head>
<body>
<div id="app">
  <div id="bar">
    <button id="prev" type="button" aria-label="Presentación anterior">Anterior</button>
    <span id="count"></span>
    <button id="next" type="button" aria-label="Presentación siguiente">Siguiente</button>
    <span id="title"></span>
  </div>
  <iframe id="frame" title="Presentación" allow="fullscreen" allowfullscreen sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-pointer-lock allow-downloads"></iframe>
</div>
<script>
(function(){
  var DECKS=${embedJson(entries)};
  var current=0;
  var frame=document.getElementById('frame');
  var prev=document.getElementById('prev');
  var next=document.getElementById('next');
  function show(i){
    current=Math.max(0,Math.min(DECKS.length-1,i));
    frame.srcdoc=DECKS[current].srcdoc;
    document.getElementById('title').textContent=DECKS[current].title;
    document.getElementById('count').textContent=(current+1)+' de '+DECKS.length;
    prev.disabled=current===0;
    next.disabled=current===DECKS.length-1;
    try{history.replaceState(null,'','#'+(current+1));}catch(e){}
  }
  prev.addEventListener('click',function(){show(current-1);});
  next.addEventListener('click',function(){show(current+1);});
  var start=parseInt(location.hash.slice(1),10);
  show(isNaN(start)?0:start-1);
})();
</script>
</body>
</html>`;
}

export function downloadTopic(topicTitle: string, decks: TopicDeck[]): void {
  if (decks.length === 1) {
    downloadDeck(decks[0].html, decks[0].title || topicTitle);
    return;
  }
  save(buildTopicFile(topicTitle, decks), topicTitle);
}

/** Descarga un respaldo completo (árbol con HTML) como JSON. */
export function downloadBackup(index: unknown): void {
  const blob = new Blob([JSON.stringify(index)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `senales-sistemas-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
