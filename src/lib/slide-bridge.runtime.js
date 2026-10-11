/**
 * Puente entre la app y cada presentación.
 *
 * Las presentaciones son archivos HTML completos que se muestran, sin tocar, en
 * un iframe aislado (sandbox sin same-origin). Este código es lo único que la
 * app les inyecta. No cambia su aspecto ni su comportamiento (cuando para
 * medir necesita mover algo, lo devuelve a su sitio antes de que llegue a
 * pintarse); solo:
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
 *    en lugar de recortada, y cuánto espacio deja libre —la lámina a la vista
 *    y la más alta de las demás—, para ampliarla cuando en una pantalla
 *    grande queda pequeña;
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
      forgetSlides();
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
      forgetSlides();
      layoutSoon(80);
    };
    fonts.ready.then(done, done);
  }

  /* ------------------------------------------------------------------ */
  /* Espacio que la presentación deja sin usar                           */
  /* ------------------------------------------------------------------ */

  // Muchas presentaciones limitan su tamaño (una columna de 1200 px, una
  // lámina 16:9 de medidas fijas) y en una pantalla grande quedan pequeñas,
  // rodeadas de margen vacío. Aquí se mide ese margen —y si algo llega a
  // cortarse por abajo— para que la app pueda ampliarlas hasta aprovechar la
  // pantalla sin que nada deje de caber. Solo se hace cuando la app lo pide
  // (pantallas en las que hay sitio para ampliar) y solo recorre lo que está
  // a la vista.
  var SPARE_ROW = 6;
  var SPARE_BUDGET = 9000;
  var SPARE_SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|HEAD|TITLE|META|LINK|BASE|BR|WBR|OPTION|OPTGROUP|DATALIST|SOURCE|TRACK|PARAM|MAP|AREA)$/i;
  var SPARE_LEAF = /^(IMG|SVG|CANVAS|VIDEO|IFRAME|OBJECT|EMBED|INPUT|BUTTON|SELECT|TEXTAREA|PROGRESS|METER|MATH|HR)$/i;
  var SPARE_MEDIA = /^(IMG|SVG|CANVAS|VIDEO|IFRAME|OBJECT|EMBED)$/i;
  var SPARE_KATEX = /(^|\s)katex(\s|$)/;
  var wantSpare = !!cfg.spare;
  // Si a la app le sirve además la medida de las láminas que no están a la
  // vista: 0 no; 1 solo si la visible deja margen a los lados; 2 sí.
  var wantAhead = 0;
  // Alto a partir del cual esa medida ya no sirve: si la lámina a la vista lo
  // alcanza, la presentación no cabría ampliada en ningún marco.
  var aheadLimit = 0;
  // Ancho con el que la app espera la próxima medida (tras cambiar el tamaño).
  var awaited = 0;
  var layoutWaits = 0;
  // Alto de las cajas principales en la medida anterior, y las que lo
  // conservaron al cambiar el alto de la ventana: no dependen de ella.
  var boxHeights = typeof WeakMap === 'function' ? new WeakMap() : null;
  var rigidBoxes = typeof WeakSet === 'function' ? new WeakSet() : null;
  // Cajas con proporción: si su alto sale de su ancho y si ese ancho es libre.
  var ratioBoxes = typeof WeakMap === 'function' ? new WeakMap() : null;
  // Alto natural de las láminas que no están a la vista, y con qué ancho de
  // lámina y de ventana se midió.
  var slideHeights = typeof WeakMap === 'function' ? new WeakMap() : null;
  var slideHeightsAt = -1;
  var slideHeightsView = -1;
  // Lámina que la medida pasa por alto: se está midiendo otra puesta en su lugar.
  var scanSkip = null;
  // Última medida de la lámina más alta de las ocultas, y con qué se tomó.
  var tallestMemo = null;

  function noteHeight(el, vh) {
    if (!boxHeights || !rigidBoxes) return;
    var height = el.clientHeight;
    var known = boxHeights.get(el);
    if (!known) { boxHeights.set(el, [vh, height]); return; }
    if (Math.abs(known[0] - vh) <= 24) return;
    if (Math.abs(known[1] - height) <= 1) rigidBoxes.add(el);
    else rigidBoxes.delete(el);
    boxHeights.set(el, [vh, height]);
  }

  // Qué clase de caja con proporción es `el`:
  //   0  ninguna (o no se puede saber);
  //   1  su alto sale de su ancho, y ese ancho es fijo;
  //   2  ídem, y su ancho sigue al de la ventana (hasta un tope, si lo tiene).
  function ratioKind(el) {
    if (!ratioBoxes) return 0;
    var known = ratioBoxes.get(el);
    if (known === undefined) {
      known = 0;
      var cs = getComputedStyle(el);
      var ratio = cs.aspectRatio;
      // Tiene una proporción (una lámina 16:9), no se le ha dado un alto propio
      // (entonces sería el ancho el que saldría de él) y recorta o desplaza lo
      // que no le cabe, en lugar de crecer con ello.
      if (ratio && ratio !== 'auto' && cs.overflowY !== 'visible' && cs.maxHeight === 'none' && typeof el.computedStyleMap === 'function') {
        try {
          var map = el.computedStyleMap();
          var height = map.get('height');
          if (height && height.value === 'auto') {
            var width = map.get('width');
            known = width && (width.value === 'auto' || width.unit === 'percent') ? 2 : 1;
          }
        } catch (e) { known = 0; }
      }
      ratioBoxes.set(el, known);
    }
    return known;
  }

  /** El alto de `el` lo fija su ancho, no la ventana. */
  function ratioBound(el) {
    return ratioKind(el) !== 0;
  }

  /**
   * `el` es una caja con proporción que crece con el ancho de la ventana (no
   * ha llegado a su tope): su tamaño en pantalla ya lo decide la ventana, y
   * ampliar la presentación no la haría más grande.
   */
  function ratioFluid(el) {
    if (ratioKind(el) !== 2) return false;
    var cap = parseFloat(getComputedStyle(el).maxWidth);
    return !(cap > 0) || /%$/.test(getComputedStyle(el).maxWidth) || el.offsetWidth < cap - 1;
  }

  /**
   * `el` está dentro de una caja cuyo alto no depende de la ventana: lo
   * conservó al cambiar el alto de esta, o se lo da una proporción.
   */
  function inRigidBox(el) {
    if (!rigidBoxes) return false;
    for (var node = el; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      if (rigidBoxes.has(node) || ratioBound(node)) return true;
    }
    return false;
  }

  function restoreStyle(el, style, hold) {
    if (style === null) el.removeAttribute('style');
    else el.setAttribute('style', style);
    if (hold) el.style.setProperty('transition', 'none', 'important');
  }

  /** Lo medido de las láminas ocultas deja de valer: cambió lo que llevan dentro. */
  function forgetSlides() {
    if (slideHeights) slideHeights = new WeakMap();
    tallestMemo = null;
  }

  /**
   * Alto natural de unas láminas que no están a la vista: el que tendrían con
   * solo su contenido, sin el mínimo ni el alto fijo que las estire. Se miden
   * de una vez, fuera del flujo (no mueven nada de lo demás) y con el ancho
   * de la visible, sin que llegue a pintarse nada.
   */
  function measureSlides(list, display, width) {
    var saved = [];
    var gone = [];
    var laid = false;
    var i;
    for (i = 0; i < list.length; i++) {
      saved.push(list[i].getAttribute('style'));
      gone.push(getComputedStyle(list[i]).display === 'none');
    }
    for (i = 0; i < list.length; i++) {
      var st = list[i].style;
      if (gone[i]) {
        st.setProperty('display', display, 'important');
        st.setProperty('visibility', 'hidden', 'important');
      } else {
        // Ya ocupa su sitio (transparente, invisible): que el cambio no
        // arranque una transición.
        laid = true;
        st.setProperty('transition', 'none', 'important');
      }
      st.setProperty('position', 'fixed', 'important');
      st.setProperty('top', '0', 'important');
      st.setProperty('left', '0', 'important');
      st.setProperty('right', 'auto', 'important');
      st.setProperty('bottom', 'auto', 'important');
      st.setProperty('margin', '0', 'important');
      st.setProperty('width', width, 'important');
      st.setProperty('min-height', '0', 'important');
      st.setProperty('height', 'auto', 'important');
      st.setProperty('max-height', 'none', 'important');
    }
    for (i = 0; i < list.length; i++) {
      var el = list[i];
      // Con rellenos y bordes, y con lo que sobresalga de ella.
      var edges = el.offsetHeight - el.clientHeight;
      slideHeights.set(el, Math.max(el.offsetHeight, el.scrollHeight + (edges > 0 ? edges : 0)));
    }
    for (i = 0; i < list.length; i++) restoreStyle(list[i], saved[i], laid);
    if (laid) {
      // Con los valores de antes ya aplicados (y aún sin transiciones), se
      // quita el freno.
      void document.body.offsetHeight;
      for (i = 0; i < list.length; i++) restoreStyle(list[i], saved[i], false);
    }
  }

  /**
   * Mide la lámina más alta de las que no están a la vista igual que se mide
   * la visible: se la pone un instante en su lugar, sin que llegue a
   * pintarse, y se repite la medida. Así el tamaño se elige de una vez para
   * toda la presentación y no hay que corregirlo al llegar a una lámina más
   * larga. Devuelve `null` si ninguna pide más alto que la visible, o si la
   * presentación no deja saberlo.
   */
  function tallestSlide(vh) {
    if (!slideHeights) return null;
    var g = findGroup();
    var shown = detectFromGroup();
    if (!g || !shown || !shown.el || g.nodes.length > 80) return null;
    var active = shown.el;
    var parent = active.parentElement;
    if (!parent) return null;
    var activeStyle = getComputedStyle(active);
    if (activeStyle.display === 'none') return null;
    var stacked = activeStyle.position === 'absolute' || activeStyle.position === 'fixed';
    if (!stacked) {
      // Puestas una tras otra solo se miden si su contenedor las apila en
      // vertical: una ocupa entonces el sitio de la otra.
      var parentStyle = getComputedStyle(parent);
      var column = (parentStyle.display === 'flex' || parentStyle.display === 'inline-flex') && parentStyle.flexDirection.indexOf('column') === 0;
      if (!column && parentStyle.display !== 'block' && parentStyle.display !== 'flow-root') return null;
    }
    // El marco que las contiene: el que las recorta o desplaza, o aquel sobre
    // el que se apilan. Si su alto es fijo, o no llega al pie de la ventana ni
    // crece con ellas, lo que no quepa en él se desplaza o se recorta por
    // diseño con cualquier ventana: no es la ventana lo que limita a las
    // láminas.
    if (ratioBound(active)) return null;
    var host = stacked ? active.offsetParent : null;
    for (var up = parent; up && up !== document.body && up !== document.documentElement; up = up.parentElement) {
      if (getComputedStyle(up).overflowY !== 'visible') { host = up; break; }
    }
    if (host === document.body || host === document.documentElement) host = null;
    var short = false;
    if (host) {
      if (inRigidBox(host)) return null;
      short = host.getBoundingClientRect().bottom < vh * 0.9;
      // (Apiladas, el marco no crece con ninguna.)
      if (short && stacked) return null;
    }
    var hostHeight = host ? host.offsetHeight : 0;

    // Los altos ya medidos valen mientras la ventana no cambie el ancho de las
    // láminas (una columna de ancho fijo lo conserva). De una lámina a otra no
    // se vuelven a medir, aunque no todas midan lo mismo de ancho.
    if (window.innerWidth !== slideHeightsView) {
      slideHeightsView = window.innerWidth;
      if (active.offsetWidth !== slideHeightsAt) { slideHeights = new WeakMap(); slideHeightsAt = active.offsetWidth; tallestMemo = null; }
    }
    var pending = [];
    var i;
    var el;
    for (i = 0; i < g.nodes.length; i++) {
      el = g.nodes[i];
      if (el !== active && el.parentElement === parent && !slideHeights.has(el)) pending.push(el);
    }
    if (pending.length) measureSlides(pending, activeStyle.display, activeStyle.width);
    var tallest = null;
    var need = 0;
    for (i = 0; i < g.nodes.length; i++) {
      el = g.nodes[i];
      if (el === active || el.parentElement !== parent) continue;
      var height = slideHeights.get(el) || 0;
      if (height > need) { need = height; tallest = el; }
    }
    // Lo que ocupa la visible, con lo que sobresalga de su caja.
    var edges = active.offsetHeight - active.clientHeight;
    var own = Math.max(active.offsetHeight, active.scrollHeight + (edges > 0 ? edges : 0));
    if (!tallest || need <= own + 2) return null;
    // La más alta pide lo mismo esté a la vista una lámina u otra: su medida
    // vale mientras no cambie la ventana.
    if (tallestMemo && tallestMemo.el === tallest && tallestMemo.vh === vh && tallestMemo.vw === window.innerWidth) return tallestMemo.result;

    var savedActive = active.getAttribute('style');
    var savedTallest = tallest.getAttribute('style');
    var gone = getComputedStyle(tallest).display === 'none';
    // La visible deja su sitio (sin ocultarse: sus animaciones no se
    // reinician) y la otra lo ocupa, a la vista para la medida. Lo que ya
    // ocupaba sitio se cambia sin transiciones.
    if (!stacked) {
      active.style.setProperty('transition', 'none', 'important');
      active.style.setProperty('position', 'fixed', 'important');
    }
    var st = tallest.style;
    if (gone) {
      st.setProperty('display', activeStyle.display, 'important');
    } else {
      st.setProperty('transition', 'none', 'important');
      // Apartada con un desplazamiento o una escala que la visible no tiene.
      var hidden = getComputedStyle(tallest);
      if (activeStyle.transform === 'none' && hidden.transform !== 'none') st.setProperty('transform', 'none', 'important');
      if (activeStyle.translate === 'none' && hidden.translate && hidden.translate !== 'none') st.setProperty('translate', 'none', 'important');
      if (activeStyle.scale === 'none' && hidden.scale && hidden.scale !== 'none') st.setProperty('scale', 'none', 'important');
    }
    st.setProperty('visibility', 'visible', 'important');
    st.setProperty('opacity', '1', 'important');
    var result = null;
    scanSkip = active;
    try { result = spareScan(); } catch (e) { result = null; }
    scanSkip = null;
    // Un marco que no llega al pie de la ventana y tampoco creció con ella.
    if (short && host.offsetHeight <= hostHeight + 1) result = null;
    restoreStyle(tallest, savedTallest, !gone);
    if (!stacked) restoreStyle(active, savedActive, true);
    if (!stacked || !gone) {
      // Con los valores de antes ya aplicados, se quita el freno.
      void document.body.offsetHeight;
      restoreStyle(tallest, savedTallest, false);
      if (!stacked) restoreStyle(active, savedActive, false);
    }
    if (result && result.side < 0) result = null;
    tallestMemo = { el: tallest, vh: vh, vw: window.innerWidth, result: result };
    return result;
  }

  function alphaOf(color) {
    if (!color || color === 'transparent') return 0;
    var slash = color.lastIndexOf('/');
    if (slash !== -1) {
      var tail = color.slice(slash + 1);
      var value = parseFloat(tail);
      if (!(value >= 0)) return 1;
      return tail.indexOf('%') !== -1 ? value / 100 : value;
    }
    var m = /^rgba?\(([^)]*)\)/.exec(color);
    if (!m) return 1;
    var parts = m[1].split(',');
    return parts.length >= 4 ? parseFloat(parts[3]) || 0 : 1;
  }

  function edgeDrawn(width, style, color) {
    return parseFloat(width) > 0 && style !== 'none' && style !== 'hidden' && alphaOf(color) > 0.1;
  }

  /** Tiene fondo, borde o sombra propios: se ve como una caja. */
  function decorated(cs) {
    if (alphaOf(cs.backgroundColor) >= 0.06 || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none') return true;
    return edgeDrawn(cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor) ||
      edgeDrawn(cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor) ||
      edgeDrawn(cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor) ||
      edgeDrawn(cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor);
  }

  /**
   * Recorre lo que está a la vista y devuelve:
   *   side   margen libre a cada lado de la columna de contenido (-1: no se sabe);
   *   edge   cuánto se adentran en ese margen los controles pegados al borde;
   *   vfree  altura que queda vacía (franjas grandes sin nada dibujado);
   *   vover  lo que hay que desplazar el documento para ver su contenido;
   *   vdoc   lo que el documento mide de más, haya o no algo ahí abajo;
   *   vin    lo mismo para su panel principal, si se desplaza por dentro;
   *   vown   ídem, cuando ese panel está en una caja de alto fijo: se
   *          desplaza por diseño, sea cual sea el tamaño de la ventana;
   *   vcut   lo que la ventana o el contenedor principal recortan por abajo.
   */
  function spareScan() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var root = document.documentElement;
    var body = document.body;
    if (!body || vw < 320 || vh < 200) return null;

    var rowsN = Math.ceil(vh / SPARE_ROW);
    var minL = [];
    var maxR = [];
    var used = [];
    var y;
    for (y = 0; y < rowsN; y++) { minL.push(vw); maxR.push(0); used.push(0); }
    var items = [];
    var visited = 0;
    var aborted = false;
    var vover = 0;
    var vdoc = 0;
    var vin = 0;
    var vown = 0;
    var vcut = 0;
    var fluidFrame = false;
    var area = vw * vh;
    var range = document.createRange();

    // El desborde de <html> —o el de <body> si <html> no fija ninguno— es el
    // de la ventana: dice si el documento se puede desplazar.
    var rootStyle = getComputedStyle(root);
    var bodyStyle = getComputedStyle(body);
    var bodyIsViewport = rootStyle.overflowX === 'visible' && rootStyle.overflowY === 'visible';
    var viewportOverflow = bodyIsViewport ? bodyStyle.overflowY : rootStyle.overflowY;
    var docScrolls = viewportOverflow !== 'hidden' && viewportOverflow !== 'clip';
    // Hasta dónde llega, bajo la ventana, lo que se alcanza desplazando el
    // documento. Un documento más alto que la ventana sin nada ahí abajo (un
    // `min-height:100vh` más un margen) no obliga a desplazarse.
    var beneath = 0;

    // Anota lo que se ve de [l,t,r,b] dentro de la zona visible [x0,y0,x1,y1].
    // `hard` es el borde bajo el cual la ventana o el contenedor principal
    // recortan sin dejar desplazar. `flow`: va en el documento, sin nada que
    // lo recorte ni lo desplace por su cuenta. `band`: una franja de lado a
    // lado, que ocupa altura pero no define la columna.
    function leaf(l, t, r, b, x0, y0, x1, y1, hard, flow, counts, band) {
      if (counts && r > x0 + 1 && l < x1 - 1) {
        if (hard <= vh + 1 && b > hard + 2 && t < hard + vh && b - hard > vcut) vcut = b - hard;
        if (flow && b > vh + 2 && b - vh > beneath) beneath = b - vh;
      }
      if (l < x0) l = x0;
      if (t < y0) t = y0;
      if (r > x1) r = x1;
      if (b > y1) b = y1;
      if (r - l < 1 || b - t < 1) return 0;
      var from = Math.floor(t / SPARE_ROW);
      var to = Math.floor((b - 0.5) / SPARE_ROW);
      if (from < 0) from = 0;
      if (to >= rowsN) to = rowsN - 1;
      var i;
      if (band) {
        for (i = from; i <= to; i++) used[i] = 1;
        return 1;
      }
      items.push(l, t, r, b);
      for (i = from; i <= to; i++) {
        used[i] = 1;
        if (l < minL[i]) minL[i] = l;
        if (r > maxR[i]) maxR[i] = r;
      }
      return 1;
    }

    function visit(parent, x0, y0, x1, y1, hard, flow, fade, veiled) {
      var found = 0;
      for (var node = parent.firstChild; node && !aborted; node = node.nextSibling) {
        var type = node.nodeType;
        if (type === 3) {
          if (veiled) continue;
          var value = node.nodeValue;
          if (!value || !/\S/.test(value)) continue;
          range.selectNodeContents(node);
          var tr = range.getBoundingClientRect();
          if (tr.width < 1 || tr.height < 1) continue;
          found += leaf(tr.left, tr.top, tr.right, tr.bottom, x0, y0, x1, y1, hard, flow, true, false);
          continue;
        }
        if (type !== 1) continue;
        var tag = node.tagName;
        if (SPARE_SKIP.test(tag) || node === scanSkip) continue;
        visited += 1;
        if (visited > SPARE_BUDGET) { aborted = true; break; }
        var cs = getComputedStyle(node);
        if (cs.display === 'none') continue;
        var opacity = parseFloat(cs.opacity);
        var shade = fade * (opacity >= 0 ? opacity : 1);
        // Transparente con todo lo suyo: otra lámina apilada, un panel cerrado.
        if (shade < 0.05) continue;
        var box = node.getBoundingClientRect();
        var w = box.width;
        var h = box.height;
        var position = cs.position;
        var fixed = position === 'fixed';
        // Lejos de lo visible con todo lo suyo: otra lámina de la fila, o lo
        // que queda más abajo en un documento largo.
        if (w > 0 && h > 0 && !fixed && (box.top >= y1 + vh * 0.75 || box.bottom <= y0 - vh * 0.75 || box.left >= x1 + 4 || box.right <= x0 - 4)) continue;
        var hidden = cs.visibility !== 'visible';
        // Lo fijado a la ventana no lo recorta ningún contenedor; y si asoma
        // por abajo es a propósito (un cajón recogido), no contenido cortado.
        var zx0 = fixed ? 0 : x0;
        var zy0 = fixed ? 0 : y0;
        var zx1 = fixed ? vw : x1;
        var zy1 = fixed ? vh : y1;
        var zhard = fixed ? Infinity : hard;
        var zflow = flow && !fixed;

        if (SPARE_LEAF.test(tag) || (tag === 'SPAN' && SPARE_KATEX.test(className(node)))) {
          if (hidden || w < 1 || h < 1) continue;
          var media = SPARE_MEDIA.test(tag);
          var placed = fixed || position === 'absolute';
          // Adorno: una imagen o un dibujo casi transparente, o colocado a
          // mano como fondo o sin recibir el ratón.
          if (media && (shade < 0.3 || (placed && (cs.pointerEvents === 'none' || w >= vw * 0.97)))) continue;
          found += leaf(box.left, box.top, box.right, box.bottom, zx0, zy0, zx1, zy1, zhard, zflow, !(media && placed), false);
          continue;
        }

        var nx0 = zx0;
        var ny0 = zy0;
        var nx1 = zx1;
        var ny1 = zy1;
        var nhard = zhard;
        var nflow = zflow;
        var scroller = false;
        // Parte de la caja que cae dentro de la ventana.
        var seenW = Math.min(box.right, vw) - Math.max(box.left, 0);
        var seenH = Math.min(box.bottom, vh) - Math.max(box.top, 0);
        var main = seenW > 0 && seenH > 0 && seenW * seenH >= area * 0.25;
        if (main) {
          if (!scanSkip) noteHeight(node, vh);
          if (ratioFluid(node)) fluidFrame = true;
        }
        if (!(node === body && bodyIsViewport)) {
          if (cs.overflowX !== 'visible') {
            if (box.left > nx0) nx0 = box.left;
            if (box.right < nx1) nx1 = box.right;
          }
          var oy = cs.overflowY;
          if (oy !== 'visible') {
            nflow = false;
            if (box.top > ny0) ny0 = box.top;
            if (box.bottom < ny1) ny1 = box.bottom;
            if (oy === 'auto' || oy === 'scroll') {
              // Lo que quede más abajo se alcanza desplazando el panel.
              scroller = true;
              nhard = Infinity;
            } else if (!main || inRigidBox(node)) {
              // Un recorte pequeño (un acordeón plegado, un texto abreviado)
              // o de alto fijo esconde a propósito, con cualquier ventana:
              // lo de dentro no es contenido que la ampliación haya cortado.
              nhard = Infinity;
            } else if (box.bottom < nhard) {
              nhard = box.bottom;
            }
          }
        }
        // Nada de lo suyo queda a la vista.
        if (nx1 - nx0 < 1 || ny1 - ny0 < 1) continue;

        var inside = visit(node, nx0, ny0, nx1, ny1, nhard, nflow, shade, hidden);
        found += inside;
        if (!inside || hidden || w < 8 || h < 8) continue;

        if (scroller && main) {
          // El panel principal (no un bloque de código ni una lista lateral).
          var inner = node.scrollHeight - node.clientHeight;
          if (inner > 2) {
            if (inRigidBox(node)) { if (inner > vown) vown = inner; }
            else if (inner > vin) vin = inner;
          }
        }
        // Una caja con algo dentro: una tarjeta, la propia lámina. De lado a
        // lado es una barra o un fondo: la columna la define lo que lleva
        // dentro, y solo si es baja (una barra) ocupa altura.
        if (w * h >= area * 0.004 && decorated(cs)) {
          if (w < vw * 0.97) leaf(box.left, box.top, box.right, box.bottom, zx0, zy0, zx1, zy1, zhard, zflow, true, false);
          else if (h < vh * 0.6) leaf(box.left, box.top, box.right, box.bottom, zx0, zy0, zx1, zy1, Infinity, false, false, true);
        }
      }
      return found;
    }

    visit(root, 0, 0, vw, vh, docScrolls ? Infinity : vh, docScrolls, 1, false);
    if (aborted) return null;
    if (docScrolls) {
      var docOver = Math.max(root.scrollHeight, body.scrollHeight) - vh;
      if (docOver > 2) {
        vdoc = docOver;
        if (beneath > 2) vover = Math.min(docOver, beneath);
      }
    }

    // Margen de cada franja ocupada.
    var margins = [];
    var marginAt = [];
    var firstUsed = -1;
    var lastUsed = -1;
    for (y = 0; y < rowsN; y++) {
      if (maxR[y] <= minL[y]) { marginAt.push(-1); continue; }
      var m = Math.min(minL[y], vw - maxR[y]);
      if (m < 0) m = 0;
      marginAt.push(m);
      margins.push(m);
      if (firstUsed === -1) firstUsed = y;
      lastUsed = y;
    }
    var out = { side: -1, edge: 0, vfree: 0, vover: Math.ceil(vover), vdoc: Math.ceil(vdoc), vin: Math.ceil(vin), vown: Math.ceil(vown), vcut: Math.ceil(vcut) };
    if (margins.length < 4) return out;

    // La columna es lo que ocupa la mayor parte de la altura; las barras de
    // arriba y de abajo, que van de lado a lado, no la definen.
    var sorted = margins.slice().sort(function (a, b) { return a - b; });
    var typical = sorted[Math.floor(sorted.length * 0.35)];
    var first = -1;
    var last = -1;
    for (y = 0; y < rowsN; y++) {
      if (marginAt[y] >= typical - 1) { if (first === -1) first = y; last = y; }
    }
    // Lo que queda por encima y por debajo son barras si son bajas; si ocupan
    // más de un quinto de la altura forman parte del contenido.
    var barLimit = (vh * 0.2) / SPARE_ROW;
    var above = 0;
    var below = 0;
    for (y = 0; y < rowsN; y++) {
      if (marginAt[y] === -1) continue;
      if (y < first) above += 1;
      else if (y > last) below += 1;
    }
    if (above > barLimit) first = firstUsed;
    if (below > barLimit) last = lastUsed;

    var top = first * SPARE_ROW;
    var bottom = (last + 1) * SPARE_ROW;
    var reach = Math.min(typical, Math.max(72, vw * 0.05));
    var side = vw / 2;
    var edge = 0;
    for (var k = 0; k < items.length; k += 4) {
      if (items[k + 3] <= top || items[k + 1] >= bottom) continue;
      var il = items[k];
      var ir = items[k + 2];
      // Pegado a un borde y estrecho: una flecha, un índice de puntos.
      if (ir <= reach) { if (ir > edge) edge = ir; continue; }
      if (il >= vw - reach) { if (vw - il > edge) edge = vw - il; continue; }
      if (il < side) side = il;
      if (vw - ir < side) side = vw - ir;
    }
    if (side < 0) side = 0;
    if (edge > side) edge = side;
    // (Con un marco que crece con la ventana no hay margen que aprovechar.)
    out.side = fluidFrame ? -1 : Math.floor(side);
    out.edge = fluidFrame ? 0 : Math.ceil(edge);

    // Franjas vacías grandes: altura que la presentación no usa. Las pequeñas
    // son la separación entre sus bloques, y de las grandes se respeta un poco.
    var bandMin = Math.max(48, vh * 0.05);
    var run = 0;
    var free = 0;
    for (y = 0; y <= rowsN; y++) {
      if (y < rowsN && !used[y]) run += SPARE_ROW;
      else { if (run >= bandMin) free += run - 24; run = 0; }
    }
    out.vfree = Math.floor(free);
    return out;
  }

  /** Milisegundos que les quedan a las animaciones de entrada en curso. */
  function unsettled() {
    if (typeof document.getAnimations !== 'function') return 0;
    var list;
    try { list = document.getAnimations(); } catch (e) { return 0; }
    var wait = 0;
    for (var i = 0; i < list.length && i < 400; i++) {
      var animation = list[i];
      if (animation.playState !== 'running' || !animation.effect || !animation.effect.getComputedTiming) continue;
      var end = animation.effect.getComputedTiming().endTime;
      var now = animation.currentTime;
      // Las que no terminan nunca (un indicador que gira) no se esperan.
      if (typeof end !== 'number' || !isFinite(end) || typeof now !== 'number') continue;
      var left = (end - now) / (animation.playbackRate || 1);
      if (left > 0 && left <= 2000 && left > wait) wait = left;
    }
    return wait;
  }

  function reportLayout() {
    layoutTimer = 0;
    var spare = null;
    if (wantSpare && !document.hidden) {
      // A media animación de entrada las medidas no valen: se espera a que
      // termine, sin quedarse esperando para siempre.
      var pending = layoutWaits < 4 ? unsettled() : 0;
      if (pending > 0) {
        layoutWaits += 1;
        layoutTimer = setTimeout(reportLayout, Math.min(pending, 800) + 40);
        return;
      }
      try { spare = spareScan(); } catch (e) { spare = null; }
    }
    layoutWaits = 0;
    var width = window.innerWidth;
    var height = window.innerHeight;
    var need = neededWidth();
    var msg = { t: 'layout', need: need, width: width, height: height };
    var text = need + '/' + width + '/' + height;
    if (spare) {
      // La lámina a la vista: lo que cabe o no cabe se anota por lámina.
      var shown = detect();
      msg.slide = shown ? shown.index : -1;
      msg.side = spare.side;
      msg.edge = spare.edge;
      msg.vfree = spare.vfree;
      msg.vover = spare.vover;
      msg.vdoc = spare.vdoc;
      msg.vin = spare.vin;
      msg.vown = spare.vown;
      msg.vcut = spare.vcut;
      text += '/' + msg.slide + '/' + spare.side + '/' + spare.edge + '/' + spare.vfree + '/' + spare.vover + '/' + spare.vdoc + '/' + spare.vin + '/' + spare.vown + '/' + spare.vcut;
      // Y lo mismo para la lámina más alta de las que no están a la vista, si
      // puede servir de algo: con poco margen a los lados no hay qué ampliar
      // (mismo criterio que en `deck-fit`).
      var own = spare.vover > 2 ? height + spare.vover : height - spare.vfree;
      var worth = !(aheadLimit > 0) || own < aheadLimit;
      if (worth && (wantAhead === 2 || (wantAhead === 1 && spare.side >= Math.max(24, width * 0.05)))) {
        var other = null;
        try { other = tallestSlide(height); } catch (e2) { other = null; }
        // `null`: se midió y ninguna pide más alto que la visible.
        msg.tallest = other ? { vfree: other.vfree, vover: other.vover, vdoc: other.vdoc, vin: other.vin, vown: other.vown, vcut: other.vcut } : null;
        text += other ? '/' + other.vfree + '/' + other.vover + '/' + other.vdoc + '/' + other.vin + '/' + other.vown + '/' + other.vcut : '/-';
      }
    }
    if (text === lastLayout) return;
    lastLayout = text;
    post(msg);
  }

  function layoutSoon(delay) {
    clearTimeout(layoutTimer);
    layoutWaits = 0;
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
  on(window, 'resize', function () {
    group = null;
    reportSoon(300);
    // La app cambió el tamaño y espera la medida: se le da enseguida, y se
    // repite después por si la presentación se reacomoda con retraso.
    if (awaited && Math.abs(window.innerWidth - awaited) <= 1) {
      awaited = 0;
      layoutSoon(40);
      setTimeout(function () { if (!layoutTimer) layoutSoon(0); }, 420);
    } else {
      layoutSoon(220);
    }
  });

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
    else if (data.t === 'measure') {
      // `spare`: si a la app le sirve saber cuánto espacio queda libre.
      // `width`: el ancho que acaba de darle al marco; se mide cuando llega.
      if (typeof data.spare === 'boolean') wantSpare = data.spare;
      wantAhead = data.ahead === 2 ? 2 : data.ahead === 1 ? 1 : 0;
      aheadLimit = typeof data.limit === 'number' && data.limit > 0 ? data.limit : 0;
      lastLayout = '';
      awaited = typeof data.width === 'number' && data.width > 0 ? data.width : 0;
      if (!pageLoaded) return;
      if (!awaited || Math.abs(window.innerWidth - awaited) <= 1) { awaited = 0; layoutSoon(30); }
      else layoutSoon(700);
    }
    else if (data.t === 'ahead') { wantAhead = data.ahead === 2 ? 2 : data.ahead === 1 ? 1 : 0; }
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
  // Lo que cambia de tamaño después de cargar (una imagen que llega, fórmulas
  // que se convierten tarde) cambia también lo que cabe: se vuelve a medir.
  function watchSize() {
    if (typeof ResizeObserver !== 'function' || !document.body) return;
    var first = true;
    try {
      new ResizeObserver(function () {
        if (first) { first = false; return; }
        if (!layoutTimer) layoutSoon(300);
      }).observe(document.body);
    } catch (e) {}
  }

  // Lo que termina de aparecer o de moverse (una entrada animada con retraso,
  // un panel que se despliega) cambia lo que hay a la vista: se mide de nuevo.
  // Las transiciones menudas (el color de un botón al pasar el ratón) no.
  var MOVES = /^(opacity|visibility|transform|height|max-height|min-height|width|max-width|top|bottom|left|right|margin|padding|flex|grid|inset|translate|scale)/;
  function shownLater(ev) {
    if (!wantSpare || !pageLoaded || layoutTimer) return;
    var el = ev.target;
    if (!el || el.nodeType !== 1) return;
    if (ev.type === 'transitionend' && !MOVES.test(ev.propertyName || '')) return;
    var box = el.getBoundingClientRect();
    if (box.width * box.height < window.innerWidth * window.innerHeight * 0.02) return;
    layoutSoon(320);
  }
  on(document, 'animationend', shownLater, true);
  on(document, 'transitionend', shownLater, true);

  function loaded() {
    if (pageLoaded) return;
    pageLoaded = true;
    scheduleMath(150);
    // Plazo para que la presentación haga su propio repaso antes de suplirlo.
    setTimeout(function () { graceOver = true; scheduleMath(0); }, 1200);
    settleLayout();
    watchSize();
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

  // Con la pestaña en segundo plano las animaciones no corren y las medidas
  // no valen: se toman al volver.
  on(document, 'visibilitychange', function () {
    if (!document.hidden && pageLoaded && wantSpare) layoutSoon(300);
  });

  // Las presentaciones que avanzan solas (o con sus propios botones) también
  // actualizan el indicador.
  setInterval(function () {
    if (document.hidden) return;
    report(false);
  }, 1800);
}
