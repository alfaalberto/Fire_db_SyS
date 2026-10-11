/* Banco de pruebas: corre dentro de la página del sitio (panel del navegador).
   Carga el puente y el controlador de tamaño desde la rama de trabajo y pasa
   por ellos las presentaciones reales guardadas en IndexedDB. No forma parte
   de la app. */
(function () {
  var H = (window.__H = { jobs: {} });

  // Temporizador que no se frena con la página en segundo plano.
  var worker = new Worker(URL.createObjectURL(new Blob(['onmessage=function(e){setTimeout(function(){postMessage(e.data[0])},e.data[1])}'], { type: 'text/javascript' })));
  var seq = 0;
  var waiting = new Map();
  worker.onmessage = function (e) { var f = waiting.get(e.data); waiting.delete(e.data); if (f) f(); };
  H.sleep = function (ms) { return new Promise(function (res) { var id = ++seq; waiting.set(id, res); worker.postMessage([id, ms]); }); };

  function open(name) { return new Promise(function (res, rej) { var r = indexedDB.open(name); r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function get(db, store, key) { return new Promise(function (res, rej) { var r = db.transaction(store, 'readonly').objectStore(store).get(key); r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }

  H.loadDecks = async function () {
    var db = await open('sys-course');
    var snap = await get(db, 'kv', 'snapshot');
    var list = [];
    async function walk(items) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var m = /^(\d+(?:\.\d+)*)/.exec(it.title || '');
        var c = await get(db, 'content', it.id);
        if (c && Array.isArray(c.decks)) c.decks.forEach(function (html, k) { list.push({ label: (m ? m[1] : it.id) + ' #' + (k + 1), topicId: it.id, idx: k, title: it.title, html: html }); });
        if (it.children) await walk(it.children);
      }
    }
    await walk(snap.outline);
    db.close();
    H.decks = list;
    return list.length;
  };

  H.setup = async function (base) {
    var texts = await Promise.all([
      fetch(base + '/src/lib/slide-bridge.runtime.js', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('bridge ' + r.status); return r.text(); }),
      fetch(base + '/harness/deck-fit.js', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('fit ' + r.status); return r.text(); }),
    ]);
    var at = texts[0].indexOf('export function slideBridgeRuntime');
    var fn = texts[0].slice(at).replace('export function', 'function').replace(/\s+$/, '');
    fn = fn.replace('function unsettled()', 'window.__sysSpare = spareScan; function unsettled()');
    var tail = '      out.vfree = Math.floor(free);\n    }\n    return out;';
    if (fn.indexOf(tail) !== -1) fn = fn.replace(tail, '      out.vfree = Math.floor(free);\n    }\n    window.__sysSpareLast = {items: items, marginAt: marginAt, used: used, typical: typical, first: first, last: last, reach: reach};\n    return out;');
    H.bridge = "(function(){'use strict';(" + fn + ')();})();';
    (0, eval)(texts[1] + '\n;window.DeckFit = DeckFit;');
    H.fit = window.DeckFit;
    H.base = base;
    return { bridge: H.bridge.length, fit: Object.keys(H.fit).join(',') };
  };

  // Ayudante solo de pruebas: en el panel la página no se dibuja, así que las
  // animaciones no avanzan ni llegan los avisos de `resize`. Se adelantan.
  function helper(token) {
    var parentWin = window.parent;
    function post(m) { m.__helper = token; try { parentWin.postMessage(m, '*'); } catch (e) {} }
    function ff() {
      try {
        var list = document.getAnimations();
        for (var i = 0; i < list.length; i++) {
          var a = list[i];
          try { var end = a.effect && a.effect.getComputedTiming().endTime; if (typeof end === 'number' && isFinite(end) && a.playState !== 'finished') a.finish(); } catch (e) {}
        }
      } catch (e2) {}
    }
    setInterval(ff, 100);
    function desc(el) {
      var s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      var c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      if (c) s += '.' + c;
      return s.slice(0, 60);
    }
    // Comprobación independiente del puente: qué se ve y qué se corta.
    function check() {
      var vw = window.innerWidth, vh = window.innerHeight;
      var de = document.documentElement, body = document.body;
      if (!body) return { vw: vw, vh: vh, empty: true };
      var out = { vw: vw, vh: vh, sw: Math.max(de.scrollWidth, body.scrollWidth), sh: Math.max(de.scrollHeight, body.scrollHeight) };
      var clipMemo = new Map();
      function clipOf(el) {
        if (!el || el === de) return [-1e9, -1e9, 1e9, 1e9, 0];
        var known = clipMemo.get(el); if (known) return known;
        var base = clipOf(el.parentElement);
        var c = base;
        if (el !== body) {
          var cs = getComputedStyle(el);
          var cx = cs.overflowX !== 'visible', cy = cs.overflowY !== 'visible';
          if (cx || cy) {
            var r = el.getBoundingClientRect();
            var hardY = cy && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll';
            c = [cx ? Math.max(base[0], r.left) : base[0], cy ? Math.max(base[1], r.top) : base[1], cx ? Math.min(base[2], r.right) : base[2], cy ? Math.min(base[3], r.bottom) : base[3], hardY ? 1 : (cy ? 0 : base[4])];
          }
        }
        clipMemo.set(el, c);
        return c;
      }
      function vis(el) { try { return el.checkVisibility({ opacityProperty: true, visibilityProperty: true }); } catch (e) { return true; } }
      var ink = [1e9, 1e9, -1e9, -1e9], n = 0, cutText = 0, cutMax = 0, cutWho = '';
      var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      var node, count = 0, range = document.createRange(), fonts = {}, chars = 0;
      while ((node = walker.nextNode()) && count < 9000) {
        var text = node.nodeValue;
        if (!text || !/\S/.test(text)) continue;
        var p = node.parentElement;
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TITLE|OPTION|TEXTAREA)$/.test(p.tagName)) continue;
        if (p.closest('.katex-mathml')) continue;
        count++;
        if (!vis(p)) continue;
        range.selectNodeContents(node);
        var rect = range.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        var c = clipOf(p);
        var l = Math.max(rect.left, c[0], 0), t = Math.max(rect.top, c[1], 0), r = Math.min(rect.right, c[2], vw), b = Math.min(rect.bottom, c[3], vh);
        if (r - l < 1 || b - t < 1) continue;
        n++;
        if (l < ink[0]) ink[0] = l; if (t < ink[1]) ink[1] = t; if (r > ink[2]) ink[2] = r; if (b > ink[3]) ink[3] = b;
        // Texto que empieza a la vista y un contenedor que no se desplaza corta por abajo.
        if (c[4] && rect.bottom > c[3] + 3 && c[3] <= vh + 1) { cutText++; if (rect.bottom - c[3] > cutMax) { cutMax = rect.bottom - c[3]; cutWho = desc(p); } }
        var fs = Math.round(parseFloat(getComputedStyle(p).fontSize));
        var k = text.replace(/\s+/g, ' ').trim().length; fonts[fs] = (fonts[fs] || 0) + k; chars += k;
      }
      out.ink = n ? ink.map(Math.round) : null;
      out.cutText = cutText; out.cutMax = Math.round(cutMax); out.cutWho = cutWho;
      var sizes = Object.keys(fonts).map(Number).sort(function (a, b2) { return a - b2; });
      var acc = 0, med = 0;
      for (var i = 0; i < sizes.length; i++) { acc += fonts[sizes[i]]; if (acc >= chars / 2) { med = sizes[i]; break; } }
      out.fs = med; out.chars = chars;
      // Cajas visibles más grandes y paneles con desplazamiento propio.
      var all = body.getElementsByTagName('*');
      var best = null, scrollers = [];
      for (i = 0; i < all.length && i < 7000; i++) {
        var el = all[i];
        var r2 = el.getBoundingClientRect();
        if (r2.width < 40 || r2.height < 40) continue;
        var w = Math.min(r2.right, vw) - Math.max(r2.left, 0), h = Math.min(r2.bottom, vh) - Math.max(r2.top, 0);
        if (w < 20 || h < 20) continue;
        if (!vis(el)) continue;
        var cs2 = getComputedStyle(el);
        if ((cs2.overflowY === 'auto' || cs2.overflowY === 'scroll') && el.scrollHeight - el.clientHeight > 2) scrollers.push({ d: desc(el), over: el.scrollHeight - el.clientHeight, a: +(w * h / (vw * vh)).toFixed(2) });
        if (r2.width >= vw * 0.97) continue;
        var bg = cs2.backgroundColor, has = (bg && bg !== 'transparent' && !/, 0\)$/.test(bg)) || cs2.backgroundImage !== 'none' || cs2.boxShadow !== 'none' || parseFloat(cs2.borderTopWidth) > 0;
        if (!has) continue;
        if (!best || w * h > best.a) best = { d: desc(el), x: [Math.round(r2.left), Math.round(r2.right)], y: [Math.round(r2.top), Math.round(r2.bottom)], a: w * h };
      }
      if (best) best.a = +(best.a / (vw * vh)).toFixed(2);
      out.box = best;
      scrollers.sort(function (a, b3) { return b3.a - a.a; });
      out.scrollers = scrollers.slice(0, 3);
      return out;
    }
    window.addEventListener('message', function (ev) {
      var d = ev.data;
      if (!d || d.__helper !== token) return;
      if (d.t === 'resize') { ff(); window.dispatchEvent(new Event('resize')); }
      else if (d.t === 'check') { ff(); var m; try { m = check(); } catch (e) { m = { fail: String(e && e.stack || e).slice(0, 300) }; } post({ t: 'r', id: d.id, m: m }); }
      else if (d.t === 'eval') { var v; try { v = (0, eval)(d.code); } catch (e2) { v = 'ERR ' + e2; } post({ t: 'r', id: d.id, m: v }); }
    });
  }
  H.helperSrc = '(' + helper.toString() + ')';

  H.isDoc = function (html) { return /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(html || ''); };

  H.srcdoc = function (html, token) {
    var doc = html.replace(/^﻿/, '');
    var start = doc.search(/<!doctype\s+html|<html[\s>]/i);
    if (start > 0) doc = doc.slice(start);
    var closing = /<\/html\s*>/gi, end = -1, m;
    while ((m = closing.exec(doc)) !== null) end = m.index + m[0].length;
    if (end !== -1 && end < doc.length && doc.slice(end).replace(/<!--[\s\S]*?-->/g, '').trim() !== '') doc = doc.slice(0, end);
    doc = doc.replace(/<script\b[^>]*src=["'][^"']*polyfill\.io[^"']*["'][^>]*>\s*<\/script>/gi, '');
    var config = JSON.stringify({ token: token, origin: location.origin, presenting: false, fragment: false }).replace(/</g, '\\u003c');
    var inject = '<script data-sys-bridge>' + H.helperSrc + '(' + JSON.stringify(token) + ');window.__SYS_BRIDGE__=' + config + ';' + H.bridge + '<\/script>';
    var head = /<head(?:\s[^>]*)?>/i.exec(doc);
    if (head) { var at = head.index + head[0].length; return doc.slice(0, at) + inject + doc.slice(at); }
    var root = /<html(?:\s[^>]*)?>/i.exec(doc);
    if (root) { var at2 = root.index + root[0].length; return doc.slice(0, at2) + inject + doc.slice(at2); }
    return inject + doc;
  };

  var SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-pointer-lock allow-downloads';
  H.host = function () {
    var host = document.getElementById('__h_host');
    if (!host) { host = document.createElement('div'); host.id = '__h_host'; host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#fff;overflow:hidden;'; document.body.appendChild(host); }
    return host;
  };
  H.unhost = function () { var h = document.getElementById('__h_host'); if (h) h.remove(); };

  /**
   * Abre una presentación en un marco de W×Hh y la pasa por el controlador de
   * tamaño, como hace SlideFrame. Devuelve un manejador para seguir probando.
   */
  H.openDeck = function (deck, W, Hh, opts) {
    opts = opts || {};
    var fit = H.fit;
    var token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    var frame = document.createElement('iframe');
    frame.setAttribute('sandbox', SANDBOX);
    frame.setAttribute('allow', 'fullscreen; clipboard-write; autoplay');
    frame.style.cssText = 'position:absolute;left:0;top:0;border:0;transform-origin:0 0;';
    var box = { width: W, height: Hh };
    var state = fit.createFit(box, opts.enabled !== false, opts.model || null);
    var log = [];
    var pending = new Map();
    var hseq = 0;
    var ready = false;
    var lastMsg = performance.now();
    var progress = null;
    var edges = 0;
    var errors = [];
    function apply() {
      var v = state.view;
      frame.style.width = v.width + 'px';
      frame.style.height = v.height + 'px';
      frame.style.transform = 'scale(' + (0.3 * v.scale) + ')';
      frame.getBoundingClientRect();
    }
    function send(msg) { msg.__sys = token; frame.contentWindow.postMessage(msg, '*'); }
    function sendHelper(msg) { msg.__helper = token; frame.contentWindow.postMessage(msg, '*'); }
    function measure() { send({ t: 'measure', spare: opts.spare !== undefined ? opts.spare : fit.canZoom(state.box), width: state.view.width }); }
    function onMsg(ev) {
      if (ev.source !== frame.contentWindow) return;
      var d = ev.data;
      if (!d) return;
      if (d.__helper === token) { if (d.t === 'r') { var f = pending.get(d.id); pending.delete(d.id); if (f) f(d.m); } return; }
      if (d.__sys !== token) return;
      lastMsg = performance.now();
      if (d.t === 'ready') { ready = true; send({ t: 'mode', presenting: !!opts.presenting }); measure(); }
      else if (d.t === 'progress') { progress = typeof d.index === 'number' ? { index: d.index, total: d.total } : null; }
      else if (d.t === 'edge') { edges += d.dir; }
      else if (d.t === 'error') { errors.push(d.message); }
      else if (d.t === 'relayout') { state = fit.resetFit(state); apply(); sendHelper({ t: 'resize' }); measure(); log.push({ relayout: 1 }); }
      else if (d.t === 'layout') {
        var before = state;
        state = fit.reportFit(state, d);
        var changed = Math.abs(state.view.width - before.view.width) >= 1 || Math.abs(state.view.height - before.view.height) >= 1;
        log.push({ at: Math.round(performance.now() - t0), r: [d.width, d.height, d.need, d.side, d.edge, d.vfree, d.vover, d.vcut, d.slide], stale: state === before ? 1 : 0, view: changed ? [state.view.width, Math.round(state.view.height), +state.view.scale.toFixed(3)] : null });
        if (changed) { apply(); sendHelper({ t: 'resize' }); measure(); }
      }
    }
    window.addEventListener('message', onMsg);
    var t0 = performance.now();
    apply();
    frame.srcdoc = H.srcdoc(deck.html, token);
    H.host().appendChild(frame);
    frame.getBoundingClientRect();
    var api = {
      frame: frame,
      get state() { return state; },
      get log() { return log; },
      get progress() { return progress; },
      get edges() { return edges; },
      get errors() { return errors; },
      get ready() { return ready; },
      helper: function (msg, timeout) { return new Promise(function (res) { var id = ++hseq; pending.set(id, res); sendHelper(Object.assign({ id: id }, msg)); H.sleep(timeout || 6000).then(function () { if (pending.has(id)) { pending.delete(id); res({ timeout: true }); } }); }); },
      check: function () { frame.getBoundingClientRect(); return api.helper({ t: 'check' }); },
      eval: function (code) { return api.helper({ t: 'eval', code: code }); },
      nav: function (dir) { send({ t: 'nav', dir: dir }); },
      resize: function (w, h) { box = { width: w, height: h }; state = fit.resizeFit(state, box); apply(); sendHelper({ t: 'resize' }); measure(); },
      remeasure: measure,
      // Espera a que el tamaño quede confirmado y no lleguen más medidas.
      settle: async function (max, quiet) {
        var start = performance.now();
        max = max || 9000; quiet = quiet || 650;
        while (performance.now() - start < max) {
          if (ready && state.settled && performance.now() - lastMsg > quiet) return { ok: true, ms: Math.round(performance.now() - start) };
          await H.sleep(60);
        }
        return { ok: false, ms: Math.round(performance.now() - start), ready: ready, settled: state.settled };
      },
      close: function () { window.removeEventListener('message', onMsg); frame.remove(); },
    };
    return api;
  };

  /** Pasa todas las presentaciones por un marco y resume el resultado. */
  H.sweep = async function (name, W, Hh, opts) {
    opts = opts || {};
    var job = (H.jobs[name] = { done: 0, total: 0, running: true, started: Date.now(), results: {}, errors: [] });
    var list = (opts.which ? opts.which.map(function (i) { return typeof i === 'number' ? H.decks[i] : H.decks.find(function (d) { return d.label === i; }); }) : H.decks).filter(function (d) { return d && H.isDoc(d.html); });
    job.total = list.length;
    var next = 0;
    async function work() {
      while (next < list.length) {
        var deck = list[next++];
        try {
          var h = H.openDeck(deck, W, Hh, opts);
          var s = await h.settle(opts.max || 10000);
          var chk = await h.check();
          var st = h.state;
          job.results[deck.label] = { settle: s, view: [st.view.width, Math.round(st.view.height), +st.view.scale.toFixed(3)], model: st.model, scrolls: st.scrolls, gaveUp: st.gaveUp, needed: st.needed, log: h.log.slice(0, 12), check: chk, progress: h.progress, errors: h.errors.slice(0, 3) };
          if (opts.keep) job.results[deck.label].handle = h; else h.close();
        } catch (e) { job.errors.push(deck.label + ': ' + (e && e.stack || e)); }
        job.done++;
      }
    }
    var workers = [];
    for (var i = 0; i < (opts.conc || 4); i++) workers.push(work());
    await Promise.all(workers);
    job.running = false; job.ms = Date.now() - job.started;
    if (!opts.keep) H.unhost();
  };

  H.wait = async function (name, ms) {
    var j = H.jobs[name];
    var t = performance.now();
    while (j && j.running && performance.now() - t < (ms || 20000)) await H.sleep(400);
    return j ? { done: j.done, total: j.total, running: j.running, ms: j.ms, errors: j.errors.slice(0, 4) } : null;
  };
})();
