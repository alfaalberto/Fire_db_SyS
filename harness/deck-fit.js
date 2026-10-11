"use strict";
var DeckFit = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/lib/deck-fit.ts
  var deck_fit_exports = {};
  __export(deck_fit_exports, {
    DESIGN_WIDTH: () => DESIGN_WIDTH,
    EMPTY_MODEL: () => EMPTY_MODEL,
    MAX_SCALE: () => MAX_SCALE,
    MIN_GAIN: () => MIN_GAIN,
    MIN_SCALE: () => MIN_SCALE,
    canZoom: () => canZoom,
    createFit: () => createFit,
    enableFit: () => enableFit,
    forgetModel: () => forgetModel,
    recallModel: () => recallModel,
    rememberModel: () => rememberModel,
    reportFit: () => reportFit,
    resetFit: () => resetFit,
    resizeFit: () => resizeFit,
    sameModel: () => sameModel,
    targetView: () => targetView
  });
  var MIN_SCALE = 0.6;
  var MAX_SCALE = 3;
  var DESIGN_WIDTH = 1280;
  var MIN_GAIN = 0.08;
  var FIT_TOLERANCE = 1.03;
  var FIT_PROGRESS = 0.85;
  var GUTTER = 16;
  var EDGE_GAP = 8;
  var MIN_MARGIN = 24;
  var MIN_MARGIN_RATIO = 0.05;
  var TRIAL_GAIN = 0.03;
  var TRIAL_SHARE = 0.25;
  var INNER_FREE = 0.08;
  var MAX_TRIES = 3;
  var MAX_CHANGES = 12;
  var EMPTY_MODEL = { col: null, wide: null, tall: null, ahead: null, fluid: null, inner: false, slack: 0 };
  function natural(box) {
    return { width: box.width, height: box.height, scale: 1 };
  }
  function grow(current, value) {
    return current === null || value > current ? value : current;
  }
  function sameView(a, b) {
    return Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
  }
  function isFluid(model, ratio) {
    return model.fluid !== null && Math.abs(ratio - model.fluid) <= model.fluid * 0.25 + 0.01;
  }
  function isEmpty(model) {
    return model.col === null && model.wide === null && model.tall === null && model.ahead === null && model.fluid === null && !model.inner && !(model.slack > 0);
  }
  function canZoom(box) {
    return box.width >= DESIGN_WIDTH * (1 + MIN_GAIN) && box.height > 0;
  }
  function targetView(model, box) {
    var _a, _b;
    const W = box.width;
    const H = box.height;
    if (!(W > 0) || !(H > 0)) return natural(box);
    let width = W;
    if (model.col !== null && canZoom(box)) {
      const tall = Math.max((_a = model.tall) != null ? _a : 0, (_b = model.ahead) != null ? _b : 0);
      width = Math.min(W, Math.max(model.col, DESIGN_WIDTH, W / MAX_SCALE, tall * W / H));
    }
    if (model.wide !== null && model.wide > width) width = Math.min(model.wide, W / MIN_SCALE);
    if (width <= W && width > W / (1 + MIN_GAIN)) width = W;
    if (width > W && width <= W + 4) width = W;
    if (width === W) return natural(box);
    width = width < W ? Math.ceil(width) : Math.min(Math.ceil(width), Math.floor(W / MIN_SCALE));
    const scale = W / width;
    return { width, height: H / scale, scale };
  }
  function needOf(measure, model, height, box) {
    var _a, _b, _c, _d, _e, _f;
    const free = (_a = measure.vfree) != null ? _a : 0;
    const content = (_b = measure.vover) != null ? _b : 0;
    const pushed = content > 2 || free <= 0;
    const outer = pushed ? Math.max(content, ((_c = measure.vdoc) != null ? _c : 0) - model.slack) : content;
    let inner = model.inner || ((_d = measure.vown) != null ? _d : 0) > 2 ? 0 : Math.max((_e = measure.vin) != null ? _e : 0, (_f = measure.vcut) != null ? _f : 0);
    if (inner > 2 && free >= box.height * INNER_FREE) inner = 0;
    const spill = Math.max(outer, inner);
    return spill > 2 ? Math.ceil(height + spill) : Math.max(0, Math.floor(height - free));
  }
  function settle(state) {
    const fitted = state.gaveUp ? natural(state.box) : targetView(state.model, state.box);
    const view = state.enabled ? fitted : natural(state.box);
    return { ...state, view, fitted: fitted.scale };
  }
  var FRESH = { gaveUp: false, over: 0, widened: false, trial: null, tries: 0, chase: null, changes: 0, settled: false };
  function modelFor(model, box) {
    if (!model) return { ...EMPTY_MODEL };
    return { ...model, wide: model.wide !== null && model.wide > box.width ? null : model.wide };
  }
  function createFit(box, enabled, model = null) {
    return settle({ ...FRESH, scrolls: [], box, enabled, model: modelFor(model, box), view: natural(box), fitted: 1 });
  }
  function resizeFit(state, box) {
    if (Math.abs(box.width - state.box.width) < 1 && Math.abs(box.height - state.box.height) < 1) return state;
    return settle({ ...state, ...FRESH, scrolls: [], box, model: modelFor(state.model, box) });
  }
  function enableFit(state, enabled) {
    if (state.enabled === enabled) return state;
    return settle({ ...state, ...FRESH, scrolls: [], enabled });
  }
  function resetFit(state) {
    return createFit(state.box, state.enabled, null);
  }
  function reportFit(state, report) {
    var _a, _b, _c, _d, _e, _f;
    const { box } = state;
    const need = Number(report.need);
    const width = Number(report.width);
    const measuredHeight = Number(report.height);
    const height = measuredHeight > 0 ? measuredHeight : state.view.height;
    if (!(need > 0) || !(width > 0) || !(box.width > 0) || state.gaveUp) return state;
    if (Math.abs(width - state.view.width) > 2) return state;
    if (measuredHeight > 0 && Math.abs(measuredHeight - state.view.height) > 2) return state;
    const model = { ...state.model };
    let { over, widened, trial, scrolls, chase } = state;
    const { tries } = state;
    const side = typeof report.side === "number" && report.side >= 0 ? report.side : null;
    const zoomed = state.view.scale > 1;
    if (trial) {
      const expected = trial.width / width;
      const before = trial.col / trial.width;
      const now = side === null ? 0 : (width - 2 * side) / width;
      if (now < before * (1 + Math.max(TRIAL_GAIN, TRIAL_SHARE * (expected - 1)))) {
        const fluid = (trial.width - trial.col) / 2 / trial.width;
        const back = settle({ ...state, model: { ...model, col: null, fluid }, trial: null, chase: null });
        return { ...back, settled: false, changes: state.changes + 1 };
      }
      trial = null;
    }
    if (need > width * FIT_TOLERANCE) {
      const excess = need - width;
      if (widened && excess >= over * FIT_PROGRESS) {
        const stuck = { ...state, model: { ...model, wide: null }, gaveUp: true, over: 0, widened: false, trial: null, chase: null };
        return { ...settle(stuck), settled: true };
      }
      model.wide = grow(model.wide, Math.ceil(need));
    } else {
      over = 0;
      widened = false;
    }
    const slide = typeof report.slide === "number" ? report.slide : -1;
    if (((_a = report.vown) != null ? _a : 0) > 2) model.inner = true;
    const content = (_b = report.vover) != null ? _b : 0;
    const whole = (_c = report.vdoc) != null ? _c : 0;
    const filled = side !== null && typeof report.vfree === "number" && report.vfree <= 0;
    const pushed = zoomed || content > 2 || filled;
    const outer = scrolls.includes(slide) ? 0 : pushed ? Math.max(content, whole - model.slack) : content;
    const inner = model.inner ? 0 : Math.max((_d = report.vin) != null ? _d : 0, (_e = report.vcut) != null ? _e : 0);
    let spill = Math.max(outer, inner);
    if (!zoomed) {
      if (inner > 2 && ((_f = report.vfree) != null ? _f : 0) >= box.height * INNER_FREE) {
        model.inner = true;
        if (chase) model.tall = chase.base;
        spill = outer;
      }
      if (spill > 2) {
        model.tall = grow(model.tall, Math.ceil(height + spill));
      } else if (side !== null && typeof report.vfree === "number") {
        model.tall = grow(model.tall, Math.max(0, Math.floor(height - report.vfree)));
      }
      if (side !== null) model.ahead = report.tallest ? needOf(report.tallest, model, height, box) : null;
      chase = null;
    } else if (spill <= 2) {
      chase = null;
    } else if (chase && chase.slide === slide && height > chase.height + 1 && spill >= chase.spill * FIT_PROGRESS) {
      model.tall = chase.base;
      if (inner >= outer) model.inner = true;
      else if (content <= 2) model.slack = Math.max(model.slack, whole);
      else scrolls = [...scrolls, slide];
      chase = null;
      spill = 0;
    } else {
      const same = chase !== null && chase.slide === slide;
      if (!same || height > chase.height + 1) chase = { slide, spill, height, base: same ? chase.base : state.model.tall };
      model.tall = grow(model.tall, Math.ceil(Math.min(height + spill, box.height)));
    }
    const kept = model.col;
    if (side !== null && side >= Math.max(MIN_MARGIN, width * MIN_MARGIN_RATIO) && !isFluid(model, side / width)) {
      const edge = typeof report.edge === "number" && report.edge > 0 ? report.edge : 0;
      model.col = grow(model.col, Math.ceil(width - 2 * side + 2 * Math.max(GUTTER, edge + EDGE_GAP)));
    }
    let next = settle({ ...state, model, over, widened, trial, tries, scrolls, chase });
    if (kept === null && model.col !== null && side !== null && next.view.width < state.view.width && !sameView(next.view, state.view)) {
      if (tries < MAX_TRIES && state.changes < MAX_CHANGES) {
        return { ...next, trial: { width, col: width - 2 * side }, tries: tries + 1, settled: false, changes: state.changes + 1 };
      }
      next = settle({ ...next, model: { ...model, col: null } });
    }
    if (sameView(next.view, state.view) || state.changes >= MAX_CHANGES) {
      return { ...next, view: state.view, settled: true };
    }
    if (need > width * FIT_TOLERANCE && next.view.width > state.view.width) next = { ...next, widened: true, over: need - width };
    return { ...next, settled: false, changes: state.changes + 1 };
  }
  var MEMORY_KEY = "sys.tamanos";
  var MEMORY_LIMIT = 240;
  var MEMORY_DAYS = 21;
  var DAY = 864e5;
  function readMemory() {
    try {
      const raw = localStorage.getItem(MEMORY_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  function pack(value) {
    return value === null ? 0 : Math.round(value * 1e3) / 1e3;
  }
  function unpack(value) {
    return typeof value === "number" && value > 0 && Number.isFinite(value) ? value : null;
  }
  function recallModel(key, now = Date.now()) {
    var _a;
    if (!key) return null;
    const entry = readMemory()[key];
    if (!Array.isArray(entry)) return null;
    const day = unpack(entry[5]);
    if (day === null || Math.floor(now / DAY) - day > MEMORY_DAYS) return null;
    const model = { col: unpack(entry[0]), wide: unpack(entry[1]), tall: unpack(entry[2]), ahead: unpack(entry[7]), fluid: unpack(entry[3]), inner: entry[4] === 1, slack: (_a = unpack(entry[6])) != null ? _a : 0 };
    return isEmpty(model) ? null : model;
  }
  function rememberModel(key, model, now = Date.now()) {
    if (!key) return;
    try {
      const memory = readMemory();
      const since = Array.isArray(memory[key]) ? unpack(memory[key][5]) : null;
      delete memory[key];
      if (!isEmpty(model)) {
        memory[key] = [pack(model.col), pack(model.wide), pack(model.tall), pack(model.fluid), model.inner ? 1 : 0, since != null ? since : Math.floor(now / DAY), pack(model.slack), pack(model.ahead)];
      }
      const keys = Object.keys(memory);
      for (let i = 0; i < keys.length - MEMORY_LIMIT; i++) delete memory[keys[i]];
      localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
    } catch {
    }
  }
  function forgetModel(key) {
    rememberModel(key, EMPTY_MODEL);
  }
  function sameModel(a, b) {
    return a.col === b.col && a.wide === b.wide && a.tall === b.tall && a.ahead === b.ahead && a.fluid === b.fluid && a.inner === b.inner && a.slack === b.slack;
  }
  return __toCommonJS(deck_fit_exports);
})();
