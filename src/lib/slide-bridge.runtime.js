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
 *  - mide cuánto sitio necesita, para que la app la muestre reducida si no
 *    cabe a lo ancho o ampliada si deja márgenes vacíos;
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

  // Anota las consultas `matchMedia` de la presentación: sus anchos son puntos
  // en los que cambia de diseño (ver «Puntos de corte» más abajo).
  var askedMedia = [];
  try {
    var nativeMatchMedia = window.matchMedia;
    if (typeof nativeMatchMedia === 'function') {
      window.matchMedia = function (query) {
        var text = String(query);
        if (askedMedia.length < 60 && askedMedia.indexOf(text) === -1) askedMedia.push(text);
        return nativeMatchMedia.apply(window, arguments);
      };
    }
  } catch (e) {}

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
    // Otra lámina: puede necesitar otro tamaño.
    if (pageLoaded && text !== lastSent) layoutSoon(90);
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
  /* Cuánto sitio necesita la presentación                               */
  /* ------------------------------------------------------------------ */

  // La app dibuja el iframe con otro ancho y lo escala cuando conviene:
  // reducida si el contenido no cabe a lo ancho, ampliada si deja márgenes
  // vacíos. Aquí solo se mide; qué hacer lo decide slide-fit.js. Se mide:
  //  - hasta dónde llega lo que la ventana corta por los lados, separando las
  //    cabeceras y pies (barras de botones) del contenido;
  //  - si los botones de avanzar quedan cortados;
  //  - cuánto alto ocuparía el contenido sin desplazarse y cuánto recortan,
  //    sin poder desplazarse, los contenedores a la vista;
  //  - el ancho de la columna de contenido, cuando está centrada;
  //  - el ancho por debajo del cual la presentación cambiaría de diseño.
  // No cuenta lo que la presentación dejó fuera de la pantalla a propósito:
  // adornos y paneles con posición absoluta o fija que sobresalen, lo que ya
  // recorta uno de sus contenedores (carruseles) ni lo que no cabría ni
  // reduciéndola.
  var MIN_FIT = 0.6;
  var lastLayout = '';
  var layoutTimer = 0;
  var SPAN_SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION|BR|HR)$/;
  var SPAN_WHOLE = /^(IMG|CANVAS|VIDEO|INPUT|SELECT|TEXTAREA|BUTTON|IFRAME|svg|math)$/i;

  /* ---- Puntos de corte ---- */

  // Ampliar equivale a estrechar la ventana. Si con eso se cruza un punto de
  // corte de la presentación (@media, matchMedia o una comparación con
  // innerWidth) pasaría a su diseño de tableta o de teléfono, que no es lo
  // que se quiere al ampliarla. Se anotan para no bajar de ahí.
  var breaksKey = '';
  var breaks = { w: [], h: [] };

  // Cada valor anotado es el tamaño más pequeño que conserva el diseño actual
  // viniendo desde arriba: `max-width: 900px` deja de cumplirse en 901.
  function noteBreaks(text, into) {
    var t = String(text || '').toLowerCase();
    if (t.indexOf('width') === -1 && t.indexOf('height') === -1) return;
    var m;
    var px;
    var named = /(max|min)-(width|height)\s*:\s*([\d.]+)(px|r?em)/g;
    while ((m = named.exec(t))) {
      px = parseFloat(m[3]) * (m[4] === 'px' ? 1 : 16);
      into[m[2] === 'width' ? 'w' : 'h'].push(m[1] === 'max' ? px + 1 : px);
    }
    var range = /(width|height)\s*(<=|>=|<|>)\s*([\d.]+)(px|r?em)/g;
    while ((m = range.exec(t))) {
      px = parseFloat(m[3]) * (m[4] === 'px' ? 1 : 16);
      into[m[1] === 'width' ? 'w' : 'h'].push(m[2] === '<=' || m[2] === '>' ? px + 1 : px);
    }
    var reversed = /([\d.]+)(px|r?em)\s*(<=|>=|<|>)\s*(width|height)/g;
    while ((m = reversed.exec(t))) {
      px = parseFloat(m[1]) * (m[2] === 'px' ? 1 : 16);
      into[m[4] === 'width' ? 'w' : 'h'].push(m[3] === '>=' || m[3] === '<' ? px + 1 : px);
    }
  }

  function walkRules(rules, into, depth) {
    for (var i = 0; i < rules.length && i < 6000; i++) {
      var rule = rules[i];
      if (rule.media && rule.media.mediaText) noteBreaks(rule.conditionText || rule.media.mediaText, into);
      if (depth < 4 && rule.cssRules && rule.cssRules.length) walkRules(rule.cssRules, into, depth + 1);
    }
  }

  function findBreaks() {
    var sheets = document.styleSheets;
    var scripts = document.scripts;
    var rules = 0;
    var s;
    for (s = 0; s < sheets.length && s < 40; s++) {
      // Una hoja de otro origen no se puede leer; tampoco trae el diseño de la presentación.
      try { rules += sheets[s].cssRules.length; } catch (e) {}
    }
    var key = sheets.length + '/' + rules + '/' + scripts.length + '/' + askedMedia.length;
    if (key === breaksKey) return breaks;
    breaksKey = key;
    var out = { w: [], h: [] };
    for (s = 0; s < sheets.length && s < 40; s++) {
      try {
        if (sheets[s].media && sheets[s].media.mediaText) noteBreaks(sheets[s].media.mediaText, out);
        walkRules(sheets[s].cssRules, out, 0);
      } catch (e2) {}
    }
    for (var q = 0; q < askedMedia.length; q++) noteBreaks(askedMedia[q], out);
    var compare = /\binner(Width|Height)\s*(<=|>=|<|>)\s*(\d{3,4})\b/g;
    for (var k = 0; k < scripts.length && k < 40; k++) {
      var node = scripts[k];
      if (node.src || node.hasAttribute('data-sys-bridge')) continue;
      var code = node.textContent || '';
      if (code.length > 600000 || code.indexOf('inner') === -1) continue;
      var m;
      compare.lastIndex = 0;
      while ((m = compare.exec(code))) {
        var size = parseFloat(m[3]);
        out[m[1] === 'Width' ? 'w' : 'h'].push(m[2] === '<=' || m[2] === '>' ? size + 1 : size);
      }
    }
    breaks = out;
    return out;
  }

  /** Ancho mínimo de ventana (con su misma proporción) que conserva el diseño actual. */
  function layoutFloor(width, height) {
    var list = findBreaks();
    var floor = 0;
    var floorTall = 0;
    var i;
    for (i = 0; i < list.w.length; i++) if (list.w[i] <= width && list.w[i] > floor) floor = list.w[i];
    for (i = 0; i < list.h.length; i++) if (list.h[i] <= height && list.h[i] > floorTall) floorTall = list.h[i];
    if (floorTall) floor = Math.max(floor, (floorTall * width) / height);
    return Math.ceil(floor);
  }

  /* ---- Paneles de tamaño fijo ---- */

  // Un escenario de tamaño fijo (1280 × 720, por ejemplo) no cambia con la
  // ventana: lo que le sobra por dentro es igual se amplíe o no, así que no
  // cuenta para decidir el tamaño. Se reconoce porque ya midió lo mismo con
  // otro alto de ventana; lo que contiene hereda esa condición. Si con esta
  // ventana mide distinto (un escenario 16:9 al que ya no le alcanza el
  // ancho), ahora sí depende de ella.
  var panelMemo = typeof WeakMap === 'function' ? new WeakMap() : null;

  /**
   * 'fixed', 'bound' (depende de la ventana) o '' (aún no se sabe).
   * Con `keep` se anota la medida; sin él solo se consulta.
   */
  function panelKind(panel, room, height, keep) {
    if (!panelMemo) return '';
    var seen = panelMemo.get(panel);
    if (!seen) {
      if (keep) panelMemo.set(panel, [[height, room]]);
      return '';
    }
    var near = Math.max(16, height * 0.03);
    var kind = '';
    var own = -1;
    for (var i = 0; i < seen.length; i++) {
      var entry = seen[i];
      if (Math.abs(entry[0] - height) <= near) { own = i; continue; }
      if (Math.abs(entry[1] - room) <= 2) kind = 'fixed';
      else if (!kind) kind = 'bound';
    }
    if (keep) {
      if (own === -1) {
        seen.push([height, room]);
        if (seen.length > 4) seen.shift();
      } else {
        seen[own][0] = height;
        seen[own][1] = room;
      }
    }
    return kind;
  }

  function insideFixed(panel, height) {
    if (!panelMemo) return false;
    for (var node = panel.parentElement; node && node !== document.body; node = node.parentElement) {
      if (panelMemo.has(node) && panelKind(node, node.clientHeight, height, false) === 'fixed') return true;
    }
    return false;
  }

  function boxInfo(node, memo, edge, tall) {
    var known = memo ? memo.get(node) : null;
    if (known) return known;
    var cs = getComputedStyle(node);
    var box = node.getBoundingClientRect();
    var position = cs.position;
    var placed = position === 'absolute' || position === 'fixed';
    // Franja: cabecera o pie. Ancha, baja y pegada arriba o abajo; o fija o
    // pegajosa sin ser el armazón de toda la página.
    var strip = box.width >= edge * 0.9 && box.height <= tall * 0.2 && (box.top <= tall * 0.12 || box.bottom >= tall * 0.88);
    var pinned = (position === 'fixed' || position === 'sticky') && !(box.width >= edge * 0.6 && box.height >= tall * 0.6);
    known = {
      hidden: cs.visibility === 'hidden',
      // Transparente, o colocado a mano y sobresaliendo: adorno o panel oculto.
      gone: parseFloat(cs.opacity) < 0.05 || (placed && (box.right > edge + 2 || box.left < -2)),
      clips: cs.overflowX !== 'visible',
      flowY: cs.overflowY,
      bar: strip || pinned,
      left: box.left,
      right: box.right
    };
    if (memo) memo.set(node, known);
    return known;
  }

  /**
   * Tramo horizontal de `el` que se vería con una ventana sin límite: su caja
   * recortada por los contenedores que recortan. `null` si no se ve. `bar`
   * indica que está en una cabecera o un pie.
   */
  function visibleSpan(el, memo, edge, tall) {
    var own = boxInfo(el, memo, edge, tall);
    if (own.hidden || own.gone) return null;
    var left = own.left;
    var right = own.right;
    var bar = own.bar;
    for (var node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      var info = boxInfo(node, memo, edge, tall);
      if (info.gone) return null;
      if (info.bar) bar = true;
      if (info.clips) {
        if (info.right < right) right = info.right;
        if (info.left > left) left = info.left;
      }
    }
    if (right - left < 2) return null;
    return { left: left, right: right, bar: bar };
  }

  function navCut(width) {
    for (var dir = -1; dir <= 1; dir += 2) {
      var button = findNavButton(dir);
      if (!button) continue;
      var rect = button.getBoundingClientRect();
      if (rect.right > width + 2 || rect.left < -2) return true;
    }
    return false;
  }

  function hasOwnText(el) {
    for (var node = el.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === 3 && /\S/.test(node.nodeValue)) return true;
    }
    return false;
  }

  /**
   * Ancho de la columna que ocupa el contenido a la vista (textos, imágenes,
   * gráficas, controles; sin cabeceras ni pies) cuando está centrada y deja
   * margen a ambos lados. 0 si llena la ventana o no está centrada.
   */
  function contentColumn(all, count, memo, width, height, client) {
    var left = Infinity;
    var right = -Infinity;
    var found = 0;
    var skip = null;
    for (var i = 0; i < count && found < 3000; i++) {
      var el = all[i];
      if (skip) {
        if (skip.contains(el)) continue;
        skip = null;
      }
      var tag = el.tagName;
      if (SPAN_SKIP.test(tag)) { skip = el; continue; }
      // Imágenes, gráficas, controles y fórmulas cuentan enteros.
      if (SPAN_WHOLE.test(tag) || /(^|\s)katex(\s|$)/.test(className(el))) skip = el;
      else if (!hasOwnText(el)) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) continue;
      var span = visibleSpan(el, memo, width, height);
      if (!span || span.bar) continue;
      // Casi todo recortado: es la lámina vecina asomando, no contenido a la vista.
      if (span.right - span.left < rect.width * 0.5) continue;
      found += 1;
      if (span.left < left) left = span.left;
      if (span.right > right) right = span.right;
    }
    if (found < 3) return 0;
    left = Math.max(0, left);
    right = Math.min(client, right);
    var gapLeft = left;
    var gapRight = client - right;
    var column = right - left;
    if (column < client * 0.25 || gapLeft < client * 0.04 || gapRight < client * 0.04) return 0;
    if (Math.abs(gapLeft - gapRight) > Math.max(24, client * 0.04)) return 0;
    return Math.round(column);
  }

  /**
   * Alto que le falta a la ventana para mostrar el contenido sin desplazarse:
   * lo que sobresale de la página más lo que guardan los paneles a la vista
   * con desplazamiento propio (`soft`: la parte de los que aún no se sabe si
   * dependen de la ventana). Lo que recorta un contenedor sin desplazamiento
   * va aparte (`clip`): puede ser un adorno, y solo importa si crece al ampliar.
   */
  function needTall(all, count, memo, width, height, keep) {
    var root = document.documentElement;
    var extra = Math.max(0, Math.max(root.scrollHeight, document.body.scrollHeight) - height);
    var soft = 0;
    var clip = 0;
    var panels = 0;
    for (var i = 0; i < count && panels < 12; i++) {
      var panel = all[i];
      var room = panel.clientHeight;
      if (room < height * 0.3) continue;
      var flow = boxInfo(panel, memo, width, height).flowY;
      if (flow === 'visible') continue;
      var kind = panelKind(panel, room, height, keep);
      var spare = panel.scrollHeight - room;
      if (spare <= 8 || kind === 'fixed') continue;
      var place = panel.getBoundingClientRect();
      if (place.bottom <= 0 || place.top >= height || !visibleSpan(panel, memo, width, height)) continue;
      if (!kind && insideFixed(panel, height)) continue;
      panels += 1;
      if (flow === 'auto' || flow === 'scroll') {
        extra += spare;
        if (!kind) soft += spare;
      } else {
        clip += spare;
      }
    }
    return { extra: extra, soft: soft, clip: clip };
  }

  /* ---- Las demás láminas ---- */

  // El tamaño se decide para la presentación entera, no para la lámina a la
  // vista: si la portada cabe holgada pero la segunda lámina llena la
  // pantalla, ampliar la portada obligaría a encoger en cuanto se avanzara.
  // Para saberlo sin navegar, cada lámina oculta con `display: none` se pone
  // un instante en el lugar de la activa, con sus mismas marcas de estado, y
  // se mide el alto que ocuparía la página. Todo ocurre dentro de una sola
  // tarea: el navegador no llega a pintar nada, y al terminar el documento
  // queda exactamente como estaba (atributos, foco y desplazamiento).
  var shownScale = 1;
  var deckMostly = typeof cfg.mostly === 'number' ? cfg.mostly : 0.75;
  var deckCache = [];
  var DECK_BUDGET = 250;

  function restoreAttribute(el, name, value) {
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }

  /** Clases que distinguen a la lámina activa de las demás. */
  function activeTokens(nodes, at) {
    var own = className(nodes[at]).split(/\s+/);
    var named = [];
    var unique = [];
    for (var i = 0; i < own.length; i++) {
      var token = own[i];
      if (!token) continue;
      var shared = false;
      for (var j = 0; j < nodes.length && !shared; j++) if (j !== at && nodes[j].classList.contains(token)) shared = true;
      if (shared) continue;
      unique.push(token);
      if (STATE_TOKEN.test(token)) named.push(token);
    }
    // «active» antes que una clase que solo lleva la portada.
    return named.length ? named : unique;
  }

  function lookAhead(nodes, at, width, height, natural, liveTall) {
    var active = nodes[at];
    var shownAs = getComputedStyle(active).display;
    var hidden = [];
    var some = false;
    var i;
    for (i = 0; i < nodes.length; i++) {
      hidden[i] = i !== at && getComputedStyle(nodes[i]).display === 'none';
      if (hidden[i]) some = true;
    }
    if (!some) return null;

    var tokens = activeTokens(nodes, at);
    var all = document.body.getElementsByTagName('*');
    var talls = [];
    var started = Date.now();
    // Sin ampliar, con más de esta cantidad de láminas que no caben la
    // presentación ya no se ampliará: no hace falta medir el resto.
    var allowed = natural ? Math.floor(nodes.length * (1 - deckMostly)) : nodes.length;
    var misses = liveTall > height + 6 ? 1 : 0;
    var scrollLeft = window.pageXOffset;
    var scrollTop = window.pageYOffset;
    var activeStyle = active.getAttribute('style');
    try {
      // La activa sale del flujo, con su tamaño, para dejar su sitio. Arriba y
      // lejos no alarga la página; y sigue dibujada, así que conserva el foco,
      // sus animaciones y el desplazamiento de lo que contiene.
      active.setAttribute('style', (activeStyle ? activeStyle + ';' : '') +
        'box-sizing:border-box!important;width:' + active.offsetWidth + 'px!important;height:' + active.offsetHeight +
        'px!important;position:absolute!important;top:-100000px!important;transition:none!important');
      for (i = 0; i < nodes.length; i++) {
        if (!hidden[i] || misses > allowed || Date.now() - started > DECK_BUDGET) { talls.push(null); continue; }
        var slide = nodes[i];
        var slideClass = slide.getAttribute('class');
        var slideStyle = slide.getAttribute('style');
        var quiet = (slideStyle ? slideStyle + ';' : '') + 'transition:none!important;animation:none!important';
        try {
          slide.setAttribute('style', quiet);
          if (tokens.length) slide.setAttribute('class', (slideClass ? slideClass + ' ' : '') + tokens.join(' '));
          // Las que se muestran cambiando `style.display` o el atributo `hidden`.
          if (getComputedStyle(slide).display === 'none') slide.setAttribute('style', quiet + ';display:' + shownAs + '!important');
          var tall = Math.round(height + needTall(all, Math.min(all.length, 9000), null, width, height, false).extra);
          talls.push(tall);
          if (tall > height + 6) misses += 1;
        } finally {
          restoreAttribute(slide, 'class', slideClass);
          restoreAttribute(slide, 'style', slideStyle);
        }
      }
    } finally {
      restoreAttribute(active, 'style', activeStyle);
      if (window.pageXOffset !== scrollLeft || window.pageYOffset !== scrollTop) window.scrollTo(scrollLeft, scrollTop);
      // Lo que se movió aquí no es texto nuevo de la presentación.
      if (mathObserver) mathObserver.takeRecords();
    }
    return talls;
  }

  /** Alto que pediría la página con cada lámina activa; `null` donde no se sabe. */
  function deckTalls(width, height, liveTall) {
    var p = detectFromGroup();
    if (!p || !group || !p.el) return null;
    var nodes = group.nodes;
    if (nodes.length < 2 || nodes.length > 60) return null;
    var key = width + 'x' + height + '/' + nodes.length;
    var entry = null;
    for (var i = 0; i < deckCache.length; i++) if (deckCache[i].key === key) entry = deckCache[i];
    if (!entry) {
      var talls = null;
      try { talls = lookAhead(nodes, p.index, width, height, shownScale === 1, liveTall); } catch (e) { talls = null; }
      entry = { key: key, talls: talls };
      deckCache.push(entry);
      if (deckCache.length > 3) deckCache.shift();
    }
    if (!entry.talls) return null;
    // Lo medido con la lámina a la vista vale más que lo previsto.
    entry.talls[p.index] = liveTall;
    return { talls: entry.talls.slice(), at: p.index };
  }

  function measureLayout() {
    // El borde es el de la ventana completa, no el del área sin la barra de
    // desplazamiento: un elemento de `100vw` siempre queda bajo esa barra y
    // agrandar la ventana no lo arregla.
    var width = window.innerWidth;
    var height = window.innerHeight;
    var root = document.documentElement;
    var body = document.body;
    var out = { width: width, height: height, need: width, main: width, nav: false, tall: height, soft: 0, clip: 0, col: 0, floor: 0, deck: null, at: -1 };
    if (!body || width < 40 || height < 40) return out;

    var client = root.clientWidth || width;
    var memo = typeof WeakMap === 'function' ? new WeakMap() : null;
    var all = body.getElementsByTagName('*');
    var count = Math.min(all.length, 9000);
    var i;

    // 1) Lo que la ventana corta por los lados.
    if (Math.max(root.scrollWidth, body.scrollWidth) > width + 8) {
      var limit = width / MIN_FIT;
      var need = width;
      var main = width;
      var checked = 0;
      for (i = 0; i < count && checked < 400; i++) {
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
        var span = visibleSpan(el, memo, width, height);
        if (!span) continue;
        var over = Math.max(0, span.right - width) + Math.max(0, -span.left);
        if (over <= 2 || width + over > limit) continue;
        if (width + over > need) need = width + over;
        if (!span.bar && width + over > main) main = width + over;
      }
      if (need > width + 2) {
        // Para que quepa junto a la barra de desplazamiento vertical.
        var gutter = Math.max(0, width - client);
        out.need = Math.ceil(need + gutter);
        if (main > width + 2) out.main = Math.ceil(main + gutter);
        out.nav = navCut(width);
      }
    }

    // 2) Alto que ocuparía el contenido sin desplazarse.
    var tall = needTall(all, count, memo, width, height, true);
    out.tall = Math.round(height + tall.extra);
    out.soft = Math.round(tall.soft);
    out.clip = Math.round(tall.clip);

    // 3) Columna de contenido: solo interesa si nada se corta.
    if (out.need <= width + 2) out.col = contentColumn(all, count, memo, width, height, client);
    out.floor = layoutFloor(width, height);

    // 4) Las demás láminas: solo cuando de ellas depende ampliar o seguir ampliada.
    if (shownScale > 1 || (shownScale === 1 && out.col > 0)) {
      var deck = deckTalls(width, height, out.tall);
      if (deck) { out.deck = deck.talls; out.at = deck.at; }
    }
    return out;
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
    var m = measureLayout();
    var text = [m.width, m.height, m.need, m.main, m.nav ? 1 : 0, m.tall, m.soft, m.clip, m.col, m.floor, m.at, m.deck ? m.deck.join(',') : ''].join('/');
    if (text === lastLayout) return;
    lastLayout = text;
    post({ t: 'layout', width: m.width, height: m.height, need: m.need, main: m.main, nav: m.nav, tall: m.tall, soft: m.soft, clip: m.clip, col: m.col, floor: m.floor, deck: m.deck, at: m.at });
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
    else if (data.t === 'fit') { shownScale = data.scale > 0 ? Number(data.scale) : 1; }
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
