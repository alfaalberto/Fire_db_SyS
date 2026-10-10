/**
 * Puente entre la app y cada presentación.
 *
 * Las presentaciones son archivos HTML completos que se muestran, sin tocar, en
 * un iframe aislado (sandbox sin same-origin). Este código es lo único que la
 * app les inyecta. No cambia su aspecto ni su comportamiento; solo:
 *
 *  - detecta en qué lámina va la presentación (grupo de `.slide`, contador
 *    "3 / 11") y lo informa a la app;
 *  - en modo presentación, hace que ←/→ y RePág/AvPág (lo que envía un
 *    presentador inalámbrico) avancen la presentación con el mecanismo que
 *    ella misma tenga (teclado propio o sus botones Anterior/Siguiente) y, al
 *    llegar al final, pide a la app pasar a la siguiente;
 *  - resuelve dentro del documento los enlaces "#ancla", que en un `srcdoc`
 *    cargarían la plataforma dentro del iframe;
 *  - convierte con KaTeX las fórmulas que la presentación dejó en crudo;
 *  - avisa cuando el contenido no cabe a lo ancho, para mostrarla reducida
 *    en lugar de recortada;
 *  - reenvía Escape, los archivos soltados y los errores de ejecución.
 *
 * IMPORTANTE: esta función se convierte a texto con `toString()` y se ejecuta
 * dentro del iframe (ver slide-bridge.ts). Por eso:
 *  - no puede usar nada definido fuera de ella (ni imports ni constantes);
 *  - se escribe en JavaScript llano (var/function), sin sintaxis que el
 *    compilador resuelva con funciones auxiliares externas.
 */
export function slideBridgeRuntime() {
  'use strict';
  var cfg = window.__SYS_BRIDGE__ || {};
  var token = cfg.token;
  var parentWin = window.parent;
  if (!token || window.__sysBridge || !parentWin || parentWin === window) return;
  window.__sysBridge = true;

  var targetOrigin = cfg.origin || '*';
  var presenting = !!cfg.presenting;
  var nativeAdd = EventTarget.prototype.addEventListener;
  var keyListeners = 0;
  var synthesizing = false;
  var errorBudget = 8;
  var lastSent = '';
  var group = null;
  var groupAt = 0;
  var scriptScan = null;
  var scriptCount = -1;

  function post(msg) {
    msg.__sys = token;
    try { parentWin.postMessage(msg, targetOrigin); } catch (e) {}
  }

  // Cuenta los oyentes de teclado que registra la presentación, para saber si
  // tiene navegación propia aunque su código no se pueda leer (bibliotecas).
  try {
    EventTarget.prototype.addEventListener = function (type) {
      if (type === 'keydown' || type === 'keyup' || type === 'keypress') keyListeners += 1;
      return nativeAdd.apply(this == null ? window : this, arguments);
    };
  } catch (e) {}

  function on(target, type, fn, options) { nativeAdd.call(target, type, fn, options); }

  // KaTeX de la presentación (auto-render). Se anota cuándo hace su repaso y
  // con qué opciones: así la plataforma no se le adelanta y, si después tiene
  // que convertir lo que dejó en crudo, lo hace con su misma configuración.
  var deckRender = null;
  var deckProxy = null;
  var deckOptions = null;
  var deckCalls = 0;

  function makeRenderProxy(fn) {
    return function (el, options) {
      if (!mathBusy) {
        deckCalls += 1;
        if (options && typeof options === 'object') deckOptions = options;
        if (deckCalls === 1) scheduleMath(350);
      }
      return fn.apply(this, arguments);
    };
  }

  try {
    Object.defineProperty(window, 'renderMathInElement', {
      configurable: true,
      enumerable: true,
      get: function () { return deckProxy || undefined; },
      set: function (value) {
        var usable = typeof value === 'function';
        deckRender = usable ? value : null;
        deckProxy = usable ? makeRenderProxy(value) : null;
      }
    });
  } catch (e) {}

  /* ------------------------------------------------------------------ */
  /* Detección de láminas                                                */
  /* ------------------------------------------------------------------ */

  var SLIDE_SELECTOR = 'section[class*="slide"],div[class*="slide"],article[class*="slide"],li[class*="slide"],[data-slide]';
  var STATE_TOKEN = /^(active|is-active|current|is-current|present|selected|show|shown|is-visible|visible|on|active-slide|current-slide|slide-active|slide-current)$/i;
  var IGNORED_TOKEN = /^(active-slide|current-slide|slide-active|slide-current|slide-enter|slide-leave|slide-in|slide-out|slide-up|slide-down|slide-left|slide-right|cover-slide|slideshow|slider|slides)$/i;
  var COUNTER_SELECTOR = '[id*="ounter"],[id*="ndicator"],[id*="slideCount"],[id*="slide-count"],[id*="slideNum"],[id*="slide-num"],[id*="nav-progress"],[class*="counter"],[class*="slide-indicator"],[class*="slide-count"],[class*="pager"]';

  function className(el) {
    var c = el.className;
    if (c && typeof c === 'object' && 'baseVal' in c) c = c.baseVal;
    return typeof c === 'string' ? c : '';
  }

  function findGroup() {
    var now = Date.now();
    if (group && now - groupAt < 1500 && group.nodes[0].isConnected) return group;
    group = null;
    groupAt = now;
    var nodes;
    try { nodes = document.querySelectorAll(SLIDE_SELECTOR); } catch (e) { return null; }
    if (!nodes.length || nodes.length > 4000) return null;

    var parents = [];
    var buckets = {};
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var parent = el.parentElement;
      if (!parent) continue;
      var pi = parents.indexOf(parent);
      if (pi === -1) { pi = parents.length; parents.push(parent); }
      var tokens = className(el).split(/\s+/);
      var used = {};
      for (var t = 0; t < tokens.length; t++) {
        var tok = tokens[t];
        if (!tok || !/slide/i.test(tok) || IGNORED_TOKEN.test(tok) || used[tok]) continue;
        used[tok] = true;
        var key = pi + '|' + el.tagName + '|' + tok.toLowerCase();
        (buckets[key] = buckets[key] || []).push(el);
      }
      if (el.hasAttribute('data-slide')) {
        var dkey = pi + '|' + el.tagName + '|[data-slide]';
        (buckets[dkey] = buckets[dkey] || []).push(el);
      }
    }

    var viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    var best = null;
    for (var k in buckets) {
      var list = buckets[k];
      if (list.length < 2) continue;
      var maxArea = 0;
      for (var j = 0; j < list.length; j++) {
        var r = list[j].getBoundingClientRect();
        var area = r.width * r.height;
        if (area > maxArea) maxArea = area;
      }
      // Las miniaturas y los puntos de navegación son pequeños; una lámina
      // visible ocupa una parte importante de la ventana.
      if (maxArea < viewportArea * 0.12) continue;
      if (!best || list.length > best.nodes.length || (list.length === best.nodes.length && maxArea > best.area)) {
        best = { nodes: list, area: maxArea };
      }
    }
    group = best;
    return group;
  }

  function isShown(el) {
    if (el.hidden) return false;
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) < 0.05) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    var mid = window.innerWidth / 2;
    return r.left <= mid && r.right >= mid;
  }

  function hasStateToken(el) {
    var tokens = className(el).split(/\s+/);
    for (var i = 0; i < tokens.length; i++) if (STATE_TOKEN.test(tokens[i])) return true;
    return el.getAttribute('aria-current') === 'true' || el.getAttribute('data-active') === 'true';
  }

  function detectFromGroup() {
    var g = findGroup();
    if (!g) return null;
    var shown = [];
    var marked = [];
    for (var i = 0; i < g.nodes.length; i++) {
      if (isShown(g.nodes[i])) shown.push(i);
      if (hasStateToken(g.nodes[i])) marked.push(i);
    }
    var index = -1;
    if (shown.length === 1) index = shown[0];
    else if (marked.length === 1 && (shown.length === 0 || shown.indexOf(marked[0]) !== -1) && shown.length < g.nodes.length) index = marked[0];
    if (index === -1) return null;
    return { index: index, total: g.nodes.length, el: g.nodes[index] };
  }

  function detectFromCounter() {
    var nodes;
    try { nodes = document.querySelectorAll(COUNTER_SELECTOR); } catch (e) { return null; }
    for (var i = 0; i < nodes.length && i < 60; i++) {
      var el = nodes[i];
      if (el.children.length > 6) continue;
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 40) continue;
      var m = text.match(/(\d{1,3})\s*(?:\/|de|of)\s*(\d{1,3})/i);
      if (!m) continue;
      var a = parseInt(m[1], 10);
      var b = parseInt(m[2], 10);
      if (b >= 2 && a >= 1 && a <= b) return { index: a - 1, total: b, el: null };
    }
    return null;
  }

  function detect() {
    return detectFromGroup() || detectFromCounter();
  }

  function report(force) {
    var p = detect();
    var text = p ? p.index + '/' + p.total : '';
    if (!force && text === lastSent) return p;
    lastSent = text;
    post({ t: 'progress', index: p ? p.index : null, total: p ? p.total : null });
    return p;
  }

  var reportTimer = 0;
  function reportSoon(delay) {
    clearTimeout(reportTimer);
    reportTimer = setTimeout(function () { report(false); }, delay || 220);
  }

  /* ------------------------------------------------------------------ */
  /* Cómo avanza esta presentación                                       */
  /* ------------------------------------------------------------------ */

  function scanScripts() {
    var scripts = document.scripts;
    if (scriptScan && scripts.length === scriptCount) return scriptScan;
    scriptCount = scripts.length;
    var text = '';
    for (var i = 0; i < scripts.length && text.length < 3000000; i++) {
      if (scripts[i].src || scripts[i].hasAttribute('data-sys-bridge')) continue;
      text += scripts[i].textContent || '';
    }
    scriptScan = {
      arrows: /Arrow(Right|Left)|keyCode\s*={2,3}\s*3[79]\b|which\s*={2,3}\s*3[79]\b/.test(text),
      pages: /Page(Down|Up)|keyCode\s*={2,3}\s*3[34]\b/.test(text)
    };
    return scriptScan;
  }

  function hasKeyHandlers() {
    return keyListeners > 0 || !!document.onkeydown || !!window.onkeydown || !!(document.body && document.body.onkeydown);
  }

  var NEXT_ID = /^(btn[-_]?next|next[-_]?btn|next|btn[-_]?next[-_]?slide|next[-_]?slide|siguiente|btn[-_]?siguiente|btn[-_]?sig)$/i;
  var PREV_ID = /^(btn[-_]?prev|prev[-_]?btn|prev|previous|btn[-_]?prev[-_]?slide|prev[-_]?slide|anterior|btn[-_]?anterior|btn[-_]?ant)$/i;
  var NEXT_LABEL = /^\s*(siguiente|next|avanzar|adelante)/i;
  var PREV_LABEL = /^\s*(anterior|previous|prev|atr[aá]s|retroceder)/i;
  var NEXT_TEXT = /^\s*(siguiente|next|sig\.?)(\s|$|[^a-zñ])|^\s*[→›»▶⟩>]+\s*$|[→›»▶]\s*$/i;
  var PREV_TEXT = /^\s*(anterior|previous|prev|ant\.?)(\s|$|[^a-zñ])|^\s*[←‹«◀⟨<]+\s*$|^\s*[←‹«◀]/i;

  function isRendered(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }

  function findNavButton(dir) {
    var list;
    try { list = document.querySelectorAll('button,[role="button"],a.btn,a.button'); } catch (e) { return null; }
    var idRe = dir > 0 ? NEXT_ID : PREV_ID;
    var labelRe = dir > 0 ? NEXT_LABEL : PREV_LABEL;
    var textRe = dir > 0 ? NEXT_TEXT : PREV_TEXT;
    var byLabel = null;
    var byText = null;
    for (var i = 0; i < list.length && i < 400; i++) {
      var el = list[i];
      if (!isRendered(el)) continue;
      if (el.id && idRe.test(el.id)) return el;
      if (!byLabel) {
        var label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
        if (label && labelRe.test(label)) byLabel = el;
      }
      if (!byText) {
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text && text.length <= 24 && textRe.test(text)) byText = el;
      }
    }
    return byLabel || byText;
  }

  function isDisabled(el) {
    return !!el && (el.disabled === true || el.getAttribute('aria-disabled') === 'true');
  }

  /** 'native': la tecla ya la entiende; 'synth': hay que traducirla a flecha;
   *  'click': solo tiene botones; 'none': no tiene forma de avanzar. */
  function strategyFor(key, dir) {
    var scan = scanScripts();
    var arrow = key === 'ArrowRight' || key === 'ArrowLeft';
    if (arrow && scan.arrows) return 'native';
    if (!arrow && scan.pages) return 'native';
    if (!arrow && scan.arrows) return 'synth';
    if (findNavButton(dir)) return 'click';
    // Tiene teclado propio pero no se pudo leer (biblioteca externa).
    if (hasKeyHandlers()) return arrow ? 'native' : 'synth';
    return 'none';
  }

  function synthKey(dir) {
    var key = dir > 0 ? 'ArrowRight' : 'ArrowLeft';
    var code = dir > 0 ? 39 : 37;
    var ev;
    try {
      ev = new KeyboardEvent('keydown', { key: key, code: key, bubbles: true, cancelable: true, view: window });
    } catch (e) { return; }
    try {
      Object.defineProperty(ev, 'keyCode', { get: function () { return code; } });
      Object.defineProperty(ev, 'which', { get: function () { return code; } });
    } catch (e2) {}
    // Se despacha sobre <body>: si el foco quedó en un control deslizante, la
    // presentación ignoraría la tecla creyendo que el usuario lo está moviendo.
    var active = document.activeElement;
    if (isEditable(active)) { try { active.blur(); } catch (e3) {} }
    synthesizing = true;
    try { (document.body || document.documentElement).dispatchEvent(ev); }
    finally { synthesizing = false; }
  }

  function swallow(ev) {
    if (!ev) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }

  function deliver(strategy, dir, ev) {
    if (strategy === 'native') {
      if (!ev) synthKey(dir);
      return;
    }
    if (strategy === 'synth') {
      swallow(ev);
      synthKey(dir);
      return;
    }
    if (strategy === 'click') {
      swallow(ev);
      var button = findNavButton(dir);
      if (button && !isDisabled(button)) button.click();
    }
  }

  var REVEAL_SELECTOR = '[class*="step"],[class*="fragment"],[class*="reveal"],[data-step],[data-fragment]';

  function hasPendingReveals(root) {
    if (!root) return false;
    var list;
    try { list = root.querySelectorAll(REVEAL_SELECTOR); } catch (e) { return false; }
    for (var i = 0; i < list.length && i < 300; i++) {
      var el = list[i];
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return true;
    }
    return false;
  }

  /**
   * Observa si la lámina reacciona a la tecla. Para no confundir una
   * animación continua con una respuesta, compara contra una segunda ventana
   * de control: lo que cambia en ambas es animación; lo que cambia solo en la
   * primera es la respuesta a la tecla.
   */
  function watch(root, act, done) {
    if (!root || typeof MutationObserver !== 'function') { act(); setTimeout(function () { done(false); }, 140); return; }
    var first = [];
    var second = [];
    var bucket = first;
    var observer = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var target = records[i].target;
        if (target.nodeType === 3) target = target.parentNode;
        if (target && bucket.indexOf(target) === -1 && bucket.length < 400) bucket.push(target);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden'] });
    // Primero se observa y después se actúa: una tecla sintética o un clic
    // cambian la página en el acto.
    act();
    setTimeout(function () {
      if (first.length === 0) { observer.disconnect(); done(false); return; }
      bucket = second;
      setTimeout(function () {
        observer.disconnect();
        var changed = false;
        for (var i = 0; i < first.length; i++) {
          if (second.indexOf(first[i]) === -1) { changed = true; break; }
        }
        done(changed);
      }, 150);
    }, 150);
  }

  function atEdge(p, dir) {
    return dir > 0 ? p.index >= p.total - 1 : p.index <= 0;
  }

  function step(dir, ev) {
    var key = ev ? ev.key : (dir > 0 ? 'ArrowRight' : 'ArrowLeft');
    var p = detect();
    var strategy = strategyFor(key, dir);

    if (p && atEdge(p, dir)) {
      if (!p.el || !hasPendingReveals(p.el)) {
        swallow(ev);
        post({ t: 'edge', dir: dir });
        return;
      }
      // Puede quedar un paso por revelar en la última lámina: se deja actuar
      // a la presentación y después se decide.
      watch(p.el, function () { deliver(strategy, dir, ev); }, function (changed) {
        var q = detect();
        if (q && q.index !== p.index) { post({ t: 'edge', dir: dir }); return; }
        if (changed) { report(false); return; }
        post({ t: 'edge', dir: dir });
      });
      return;
    }

    if (!p) {
      // Sin láminas a la vista es una página única (un laboratorio, un
      // documento continuo): la tecla lleva a la presentación vecina. No se
      // pulsan sus botones «siguiente», que ahí mueven otra cosa (la muestra
      // de una simulación). Solo si la página maneja el teclado por su cuenta
      // se le entrega la tecla, y se sigue de largo cuando no reacciona.
      var button = findNavButton(dir);
      if (strategy === 'click') strategy = hasKeyHandlers() ? (key === 'ArrowRight' || key === 'ArrowLeft' ? 'native' : 'synth') : 'none';
      if (strategy === 'none' || (button && isDisabled(button))) {
        swallow(ev);
        post({ t: 'edge', dir: dir });
        return;
      }
      watch(document.body, function () { deliver(strategy, dir, ev); }, function (changed) {
        if (changed) { report(false); layoutSoon(300); return; }
        post({ t: 'edge', dir: dir });
      });
      return;
    }

    if (strategy !== 'none') deliver(strategy, dir, ev);
    reportSoon(160);
    // Las transiciones largas terminan después: se vuelve a mirar.
    setTimeout(function () { report(false); }, 520);
    setTimeout(function () { report(false); }, 1100);
    layoutSoon(560);
  }

  /* ------------------------------------------------------------------ */
  /* Fórmulas que la presentación dejó sin convertir                     */
  /* ------------------------------------------------------------------ */

  // La plataforma anterior repasaba todas las presentaciones con KaTeX, y
  // algunas dependen de ello sin saberlo: su configuración no reconoce los
  // delimitadores que usan, o insertan texto con fórmulas después de su único
  // repaso. Abiertas por separado muestran el TeX en crudo. Aquí se conserva
  // esa red de seguridad, pero solo actúa si, ya cargada la página, quedó TeX
  // a la vista: una presentación que se convierte sola no se toca.
  var MATH_HINT = /\\\(|\\\[|\$\$|\$[^$\n]{1,200}\$/;
  var MATH_SKIP_TAG = /^(script|style|noscript|textarea|pre|code|option|select|template|svg|canvas|math|iframe)$/i;
  var MATH_SKIP_CLASS = /(^|\s)(katex|katex-display|katex-error|MathJax|no-math)(\s|$)/;
  var MATH_SKIP_TAGS = ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'select', 'template', 'svg', 'canvas', 'math', 'iframe'];
  var MATH_SKIP_CLASSES = ['katex', 'katex-error', 'no-math'];
  var MATH_DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true },
    { left: '$', right: '$', display: false }
  ];
  // Las mismas abreviaturas que ofrecía la plataforma anterior.
  var MATH_MACROS = {
    '\\R': '\\mathbb{R}', '\\N': '\\mathbb{N}', '\\Z': '\\mathbb{Z}', '\\C': '\\mathbb{C}',
    '\\F': '\\mathcal{F}', '\\Laplace': '\\mathcal{L}', '\\fourier': '\\mathfrak{F}',
    '\\Re': '\\operatorname{Re}', '\\Im': '\\operatorname{Im}'
  };
  var mathTimer = 0;
  var mathDue = 0;
  var mathBusy = false;
  var mathObserver = null;
  var mathLoading = false;
  var mathRescued = 0;
  var pageLoaded = false;
  // Venció el plazo que se da a la presentación para hacer su propio repaso.
  var graceOver = false;

  // 1 = aceptar, 2 = descartar con todo su contenido, 3 = seguir hacia dentro.
  function mathFilter(node) {
    if (node.nodeType === 3) return MATH_HINT.test(node.nodeValue || '') ? 1 : 2;
    if (MATH_SKIP_TAG.test(node.nodeName)) return 2;
    var cls = className(node);
    if (cls && MATH_SKIP_CLASS.test(cls)) return 2;
    // Lo que la propia presentación pidió a KaTeX dejar como está.
    var own = deckOptions;
    if (own && own.ignoredTags && own.ignoredTags.indexOf && own.ignoredTags.indexOf(node.nodeName.toLowerCase()) !== -1) return 2;
    if (cls && own && own.ignoredClasses && own.ignoredClasses.indexOf) {
      var tokens = cls.split(/\s+/);
      for (var i = 0; i < tokens.length; i++) if (tokens[i] && own.ignoredClasses.indexOf(tokens[i]) !== -1) return 2;
    }
    return 3;
  }

  function rawMath(limit) {
    var found = [];
    if (!document.body) return found;
    var walker;
    var node;
    try { walker = document.createTreeWalker(document.body, 5, { acceptNode: mathFilter }); } catch (e) { return found; }
    while (found.length < limit && (node = walker.nextNode())) found.push(node);
    return found;
  }

  function mergeNames(base, extra) {
    var out = base.slice();
    for (var i = 0; extra && i < extra.length; i++) {
      if (typeof extra[i] === 'string' && out.indexOf(extra[i]) === -1) out.push(extra[i]);
    }
    return out;
  }

  /** Opciones del repaso: las de la presentación, más los delimitadores habituales. */
  function mathOptions() {
    var own = deckOptions || {};
    var options = { strict: 'ignore', trust: true };
    var key;
    for (key in own) if (Object.prototype.hasOwnProperty.call(own, key)) options[key] = own[key];
    options.throwOnError = false;

    var delimiters = [];
    var seen = {};
    var lists = [own.delimiters, MATH_DELIMITERS];
    for (var l = 0; l < lists.length; l++) {
      for (var i = 0; lists[l] && i < lists[l].length; i++) {
        var item = lists[l][i];
        if (!item || typeof item.left !== 'string' || typeof item.right !== 'string' || seen[item.left]) continue;
        seen[item.left] = true;
        delimiters.push(item);
      }
    }
    // KaTeX exige que `$` vaya después de `$$`.
    delimiters.sort(function (a, b) { return (a.left === '$' ? 1 : 0) - (b.left === '$' ? 1 : 0); });
    options.delimiters = delimiters;
    options.ignoredTags = mergeNames(MATH_SKIP_TAGS, own.ignoredTags);
    options.ignoredClasses = mergeNames(MATH_SKIP_CLASSES, own.ignoredClasses);

    var macros = {};
    for (key in MATH_MACROS) macros[key] = MATH_MACROS[key];
    if (own.macros && typeof own.macros === 'object') for (key in own.macros) macros[key] = own.macros[key];
    options.macros = macros;
    return options;
  }

  function addScript(src, done) {
    var el = document.createElement('script');
    el.src = src;
    el.onload = function () { done(true); };
    el.onerror = function () { done(false); };
    (document.head || document.documentElement).appendChild(el);
  }

  // La presentación no trae KaTeX, o el CDN del que lo carga no respondió:
  // se usa la copia que sirve la propia plataforma.
  function loadMath() {
    var base = cfg.origin;
    if (mathLoading || !base) return;
    mathLoading = true;
    var autoRender = function () {
      addScript(base + '/katex/contrib/auto-render.min.js', function (ok) {
        if (!ok) return;
        graceOver = true;
        scheduleMath(0);
      });
    };
    if (window.katex) { autoRender(); return; }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = base + '/katex/katex.min.css';
    (document.head || document.documentElement).appendChild(link);
    addScript(base + '/katex/katex.min.js', function (ok) { if (ok) autoRender(); });
  }

  function sweepMath() {
    mathTimer = 0;
    if (mathBusy || window.MathJax) return;
    var render = deckRender;
    if (!render) {
      // Pudo definirla de un modo que esquiva el seguimiento de arriba.
      var plain = window.renderMathInElement;
      if (typeof plain === 'function') render = plain;
    }
    if (!render) {
      if (pageLoaded && rawMath(1).length) loadMath();
      return;
    }
    // Trae su KaTeX y todavía no ha hecho su repaso: se le espera.
    if (deckCalls === 0 && !graceOver) return;
    var nodes = rawMath(400);
    if (!nodes.length) return;

    var parents = [];
    var texts = [];
    for (var i = 0; i < nodes.length; i++) {
      var parent = nodes[i].parentNode;
      if (!parent || parent.nodeType !== 1) continue;
      var at = parents.indexOf(parent);
      if (at === -1) { parents.push(parent); texts.push(nodes[i].nodeValue); }
      else texts[at] += '\n' + nodes[i].nodeValue;
    }

    var before = document.querySelectorAll('.katex').length;
    var options = mathOptions();
    var tried = 0;
    mathBusy = true;
    for (var j = 0; j < parents.length; j++) {
      // Mismo texto que la vez anterior: KaTeX no pudo con él. No se insiste,
      // o la presentación quedaría repasándose sin fin.
      if (parents[j].__sysMath === texts[j]) continue;
      parents[j].__sysMath = texts[j];
      tried += 1;
      try { render(parents[j], options); } catch (e) {}
    }
    mathBusy = false;
    if (mathObserver) mathObserver.takeRecords();

    var gained = document.querySelectorAll('.katex').length - before;
    if (gained > 0) {
      mathRescued += gained;
      post({ t: 'math', count: mathRescued });
      layoutSoon(120);
    }
    // Quedaron más de las que se revisan de una vez: se sigue enseguida.
    if (nodes.length >= 400 && tried > 0) scheduleMath(40);
  }

  // Si ya hay un repaso pendiente se conserva el más próximo.
  function scheduleMath(delay) {
    var due = Date.now() + delay;
    if (mathTimer && mathDue <= due) return;
    clearTimeout(mathTimer);
    mathDue = due;
    mathTimer = setTimeout(sweepMath, delay);
  }

  function mayHoldMath(records) {
    for (var i = 0; i < records.length && i < 40; i++) {
      var record = records[i];
      if (record.type === 'characterData') {
        if (MATH_HINT.test(record.target.nodeValue || '')) return true;
        continue;
      }
      var added = record.addedNodes;
      for (var j = 0; j < added.length && j < 12; j++) {
        var node = added[j];
        var text = node.nodeType === 3 ? node.nodeValue : (node.nodeType === 1 && !MATH_SKIP_TAG.test(node.nodeName) ? node.textContent : '');
        if (text && MATH_HINT.test(text.length > 8000 ? text.slice(0, 8000) : text)) return true;
      }
    }
    return false;
  }

  function watchMath() {
    if (mathObserver || typeof MutationObserver !== 'function' || !document.body) return;
    mathObserver = new MutationObserver(function (records) {
      if (mayHoldMath(records)) scheduleMath(260);
    });
    mathObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  /* ------------------------------------------------------------------ */
  /* Ancho que necesita la presentación                                  */
  /* ------------------------------------------------------------------ */

  // Mide hasta dónde llega el contenido que la ventana corta por los lados:
  // una barra de botones que no cabe, una tabla ancha. La app usa el dato para
  // mostrar la presentación reducida en lugar de recortada. No cuenta lo que
  // la presentación dejó fuera de la pantalla a propósito: adornos y paneles
  // con posición absoluta o fija que sobresalen, lo que ya recorta uno de sus
  // contenedores (carruseles) ni lo que no cabría ni reduciéndola.
  var MIN_FIT = 0.6;
  var lastLayout = '';
  var layoutTimer = 0;

  function boxInfo(node, memo, edge) {
    var known = memo ? memo.get(node) : null;
    if (known) return known;
    var cs = getComputedStyle(node);
    var box = node.getBoundingClientRect();
    var placed = cs.position === 'absolute' || cs.position === 'fixed';
    known = {
      hidden: cs.visibility === 'hidden',
      // Transparente, o colocado a mano y sobresaliendo: adorno o panel oculto.
      gone: parseFloat(cs.opacity) < 0.05 || (placed && (box.right > edge + 2 || box.left < -2)),
      clips: cs.overflowX !== 'visible',
      left: box.left,
      right: box.right
    };
    if (memo) memo.set(node, known);
    return known;
  }

  /** Ancho con el que `el` dejaría de estar cortado por la ventana; 0 si no lo está. */
  function cutExtent(el, memo, edge) {
    var own = boxInfo(el, memo, edge);
    if (own.hidden || own.gone) return 0;
    var left = own.left;
    var right = own.right;
    for (var node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      var info = boxInfo(node, memo, edge);
      if (info.gone) return 0;
      if (info.clips) {
        if (info.right < right) right = info.right;
        if (info.left > left) left = info.left;
      }
    }
    var over = Math.max(0, right - edge) + Math.max(0, -left);
    return over > 2 ? edge + over : 0;
  }

  function neededWidth() {
    // El borde es el de la ventana completa, no el del área sin la barra de
    // desplazamiento: un elemento de `100vw` siempre queda bajo esa barra y
    // agrandar la ventana no lo arregla.
    var width = window.innerWidth;
    var root = document.documentElement;
    var body = document.body;
    if (!body || width < 40) return width;
    if (Math.max(root.scrollWidth, body.scrollWidth) <= width + 8) return width;

    var memo = typeof WeakMap === 'function' ? new WeakMap() : null;
    var limit = width / MIN_FIT;
    var need = width;
    var all = body.getElementsByTagName('*');
    var checked = 0;
    for (var i = 0; i < all.length && i < 8000 && checked < 400; i++) {
      var el = all[i];
      var rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.right <= width + 2 && rect.left >= -2) continue;
      // Enteramente fuera: solo cuenta si su contenedor empieza dentro (el
      // resto de una fila de botones); si no, es un panel fuera de pantalla.
      if (rect.left >= width - 2 || rect.right <= 2) {
        var holder = el.parentElement;
        if (!holder || holder === body) continue;
        var around = holder.getBoundingClientRect();
        if (around.left >= width - 2 || around.right <= 2) continue;
      }
      checked += 1;
      var extent = cutExtent(el, memo, width);
      if (extent > need && extent <= limit) need = extent;
    }
    if (need <= width + 2) return width;
    // Para que el contenido quepa junto a la barra de desplazamiento vertical.
    return Math.ceil(need + Math.max(0, width - (root.clientWidth || width)));
  }

  // El ancho se mide con las tipografías ya cargadas: con las de reserva el
  // texto ocupa otro espacio y la medida no sirve.
  function settleLayout() {
    var fonts = document.fonts;
    if (!fonts || !fonts.ready || typeof fonts.ready.then !== 'function') { layoutSoon(80); return; }
    var late = false;
    var timer = setTimeout(function () { late = true; layoutSoon(0); }, 2500);
    var done = function () {
      clearTimeout(timer);
      // Llegaron tarde: lo que se midió con las de reserva se descarta.
      if (late) { lastLayout = ''; post({ t: 'relayout' }); }
      layoutSoon(80);
    };
    fonts.ready.then(done, done);
  }

  function reportLayout() {
    layoutTimer = 0;
    var width = window.innerWidth;
    var need = neededWidth();
    var text = need + '/' + width;
    if (text === lastLayout) return;
    lastLayout = text;
    post({ t: 'layout', need: need, width: width });
  }

  function layoutSoon(delay) {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(reportLayout, delay);
  }

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
  }

  on(window, 'keydown', function (ev) {
    if (synthesizing) return;
    if (!presenting) { reportSoon(240); return; }
    if (ev.key === 'Escape') { post({ t: 'key', key: 'Escape' }); return; }
    if (isEditable(ev.target)) return;
    var right = ev.key === 'ArrowRight' || ev.key === 'PageDown';
    var left = ev.key === 'ArrowLeft' || ev.key === 'PageUp';
    if (!right && !left) return;
    if (ev.altKey || ev.metaKey || ev.shiftKey) return;
    if (ev.ctrlKey) {
      // Ctrl + flecha: saltar de presentación sin recorrer las láminas.
      swallow(ev);
      post({ t: 'jump', dir: right ? 1 : -1 });
      return;
    }
    step(right ? 1 : -1, ev);
  }, true);

  on(window, 'click', function () { reportSoon(200); setTimeout(function () { report(false); }, 600); layoutSoon(640); }, true);
  on(window, 'resize', function () { group = null; reportSoon(300); layoutSoon(220); });

  // En un documento srcdoc la URL base es la de la app: un enlace "#seccion"
  // o un formulario sin destino cargarían la plataforma DENTRO del iframe.
  // Aquí se resuelven como lo haría el archivo abierto por separado.
  on(document, 'click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    var link = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (href.charAt(0) !== '#') return;
    ev.preventDefault();
    var id = '';
    try { id = decodeURIComponent(href.slice(1)); } catch (e) { id = href.slice(1); }
    if (!id) return;
    var target = document.getElementById(id) || document.getElementsByName(id)[0];
    if (!target) return;
    if (target.scrollIntoView) target.scrollIntoView();
    try { target.focus({ preventScroll: true }); } catch (e2) {}
  });
  on(document, 'submit', function (ev) {
    if (ev.defaultPrevented) return;
    var form = ev.target;
    var action = form && form.getAttribute ? form.getAttribute('action') : null;
    if (!action || action.charAt(0) === '#') ev.preventDefault();
  });

  // Soltar un archivo sobre la presentación haría que el navegador abandonara
  // la página para abrirlo. Se evita y el archivo se entrega a la app.
  function carriesFiles(ev) {
    var types = ev.dataTransfer && ev.dataTransfer.types;
    if (!types) return false;
    for (var i = 0; i < types.length; i++) if (types[i] === 'Files') return true;
    return false;
  }
  var lastDrag = 0;
  on(window, 'dragover', function (ev) {
    if (!carriesFiles(ev)) return;
    ev.preventDefault();
    var now = Date.now();
    if (now - lastDrag > 150) { lastDrag = now; post({ t: 'dragfiles' }); }
  }, true);
  on(window, 'drop', function (ev) {
    if (!carriesFiles(ev)) return;
    ev.preventDefault();
    var files = [];
    var list = ev.dataTransfer.files || [];
    for (var i = 0; i < list.length && i < 20; i++) files.push(list[i]);
    post({ t: 'files', files: files });
  }, true);

  on(window, 'message', function (ev) {
    if (ev.source !== parentWin) return;
    var data = ev.data;
    if (!data || data.__sys !== token) return;
    if (data.t === 'mode') { presenting = !!data.presenting; report(true); }
    else if (data.t === 'measure') { lastLayout = ''; layoutSoon(0); }
    else if (data.t === 'nav') { step(data.dir > 0 ? 1 : -1, null); }
    else if (data.t === 'focus') { try { window.focus(); } catch (e) {} }
    else if (data.t === 'theme' && cfg.fragment) { document.documentElement.setAttribute('data-theme', data.theme === 'light' ? 'light' : 'dark'); }
    else if (data.t === 'ping') { report(true); }
  });

  on(window, 'error', function (ev) {
    var message = ev && ev.message ? String(ev.message) : '';
    if (!message || message.indexOf('ResizeObserver loop') !== -1) return;
    if (message === 'Script error.' && !ev.filename) return;
    if (errorBudget-- <= 0) return;
    post({ t: 'error', message: message.slice(0, 300), line: ev.lineno || 0 });
  });
  on(window, 'unhandledrejection', function (ev) {
    if (errorBudget-- <= 0) return;
    var reason = ev && ev.reason;
    var message = reason && (reason.message || String(reason));
    post({ t: 'error', message: ('Promesa rechazada: ' + (message || 'sin detalle')).slice(0, 300), line: 0 });
  });

  // La página terminó de cargar sus recursos: la presentación ya tuvo ocasión
  // de convertir sus fórmulas y de acomodarse.
  function loaded() {
    if (pageLoaded) return;
    pageLoaded = true;
    scheduleMath(150);
    // Plazo para que la presentación haga su propio repaso antes de suplirlo.
    setTimeout(function () { graceOver = true; scheduleMath(0); }, 1200);
    settleLayout();
  }

  function ready() {
    post({ t: 'ready', title: document.title || '' });
    report(true);
    watchMath();
    // Por si `load` no llega (un recurso que nunca termina de descargar).
    if (document.readyState === 'complete') loaded();
    else setTimeout(loaded, 6000);
    setTimeout(function () { group = null; report(false); }, 700);
    setTimeout(function () { group = null; report(false); }, 2000);
  }
  if (document.readyState === 'loading') on(document, 'DOMContentLoaded', ready);
  else ready();
  on(window, 'load', function () {
    group = null;
    reportSoon(120);
    loaded();
  });

  // Las presentaciones que avanzan solas (o con sus propios botones) también
  // actualizan el indicador.
  setInterval(function () {
    if (document.hidden) return;
    report(false);
  }, 1800);
}
