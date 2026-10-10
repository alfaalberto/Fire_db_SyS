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
    targetView: () => targetView
  });
  var MIN_SCALE = 0.6;
  var MAX_SCALE = 3;
  var DESIGN_WIDTH = 1280;
  var MIN_GAIN = 0.04;
  var FIT_TOLERANCE = 1.03;
  var FIT_PROGRESS = 0.85;
  var GUTTER = 16;
  var EDGE_GAP = 8;
  var MIN_MARGIN = 24;
  var MIN_MARGIN_RATIO = 0.03;
  var SCROLL_LIMIT = 1.2;
  var TRIAL_SHARE = 0.5;
  var MAX_TRIES = 3;
  var MAX_CHANGES = 12;
  var EMPTY_MODEL = { col: null, wide: null, tall: null, fluid: null };
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
  function canZoom(box) {
    return box.width >= DESIGN_WIDTH * (1 + MIN_GAIN) && box.height > 0;
  }
  function targetView(model, box, rough = null) {
    var _a;
    const W = box.width;
    const H = box.height;
    if (!(W > 0) || !(H > 0)) return natural(box);
    let width = W;
    if (model.col !== null && canZoom(box)) {
      const tall = Math.max((_a = model.tall) != null ? _a : 0, rough != null ? rough : 0);
      width = Math.max(model.col, DESIGN_WIDTH, W / MAX_SCALE, tall * W / H);
      if (width > W / (1 + MIN_GAIN)) width = W;
    }
    if (model.wide !== null && model.wide > width) width = Math.min(model.wide, W / MIN_SCALE);
    if (width <= W && width > W / (1 + MIN_GAIN)) width = W;
    if (width > W && width <= W + 4) width = W;
    if (width === W) return natural(box);
    width = width < W ? Math.ceil(width) : Math.min(Math.ceil(width), Math.floor(W / MIN_SCALE));
    const scale = W / width;
    return { width, height: H / scale, scale };
  }
  function settle(state) {
    const fitted = state.gaveUp ? natural(state.box) : targetView(state.model, state.box, state.rough);
    const view = state.enabled ? fitted : natural(state.box);
    return { ...state, view, needed: fitted.scale !== 1 };
  }
  function createFit(box, enabled, model = null) {
    return settle({
      box,
      enabled,
      model: model ? { ...model } : { ...EMPTY_MODEL },
      view: natural(box),
      settled: false,
      needed: false,
      gaveUp: false,
      over: 0,
      widened: false,
      trial: null,
      tries: 0,
      rough: null,
      changes: 0
    });
  }
  function resizeFit(state, box) {
    if (Math.abs(box.width - state.box.width) < 1 && Math.abs(box.height - state.box.height) < 1) return state;
    return settle({ ...state, box, gaveUp: false, over: 0, widened: false, trial: null, tries: 0, changes: 0, settled: false });
  }
  function enableFit(state, enabled) {
    if (state.enabled === enabled) return state;
    return settle({ ...state, enabled, gaveUp: false, over: 0, widened: false, trial: null, tries: 0, changes: 0, settled: false });
  }
  function resetFit(state) {
    return createFit(state.box, state.enabled, null);
  }
  function reportFit(state, report) {
    var _a, _b;
    const { box } = state;
    const need = Number(report.need);
    const width = Number(report.width);
    const measuredHeight = Number(report.height);
    const height = measuredHeight > 0 ? measuredHeight : state.view.height;
    if (!(need > 0) || !(width > 0) || !(box.width > 0) || state.gaveUp) return state;
    if (Math.abs(width - state.view.width) > 2) return state;
    if (measuredHeight > 0 && Math.abs(measuredHeight - state.view.height) > 2) return state;
    const model = { ...state.model };
    let { over, widened, trial, rough } = state;
    const { tries } = state;
    const side = typeof report.side === "number" && report.side >= 0 ? report.side : null;
    if (trial) {
      const expected = trial.width / width;
      const before = trial.col / trial.width;
      const now = side === null ? 0 : (width - 2 * side) / width;
      if (now < before * (1 + TRIAL_SHARE * (expected - 1))) {
        model.fluid = (trial.width - trial.col) / 2 / trial.width;
        model.col = null;
      }
      trial = null;
    }
    if (need > width * FIT_TOLERANCE) {
      const excess = need - width;
      if (widened && excess >= over * FIT_PROGRESS) {
        const stuck = { ...state, model: { ...model, wide: null }, gaveUp: true, over: 0, widened: false, trial: null };
        return { ...settle(stuck), settled: true };
      }
      over = excess;
      model.wide = grow(model.wide, Math.ceil(need));
    } else {
      over = 0;
      widened = false;
    }
    const spill = Math.max((_a = report.vover) != null ? _a : 0, (_b = report.vcut) != null ? _b : 0);
    if (spill > 2) {
      const wanted = height + spill;
      if (wanted <= box.height * SCROLL_LIMIT) model.tall = grow(model.tall, Math.ceil(wanted));
    }
    if (side !== null && side >= Math.max(MIN_MARGIN, width * MIN_MARGIN_RATIO) && !isFluid(model, side / width)) {
      const edge = typeof report.edge === "number" && report.edge > 0 ? report.edge : 0;
      model.col = grow(model.col, Math.ceil(width - 2 * side + 2 * Math.max(GUTTER, edge + EDGE_GAP)));
      if (spill <= 2 && typeof report.vfree === "number") rough = grow(rough, Math.max(0, Math.floor(height - report.vfree)));
    }
    let next = settle({ ...state, model, over, widened, trial, tries, rough });
    if (sameView(next.view, state.view)) {
      return { ...next, view: state.view, settled: true };
    }
    if (state.changes >= MAX_CHANGES) {
      return { ...next, view: state.view, settled: true };
    }
    if (next.view.width < state.view.width) {
      if (tries >= MAX_TRIES || side === null) {
        next = settle({ ...next, model: { ...model, col: state.model.col } });
        if (sameView(next.view, state.view)) return { ...next, view: state.view, settled: true };
      } else {
        next = { ...next, trial: { width, col: width - 2 * side }, tries: tries + 1 };
      }
    } else if (need > width * FIT_TOLERANCE) {
      next = { ...next, widened: true };
    }
    return { ...next, settled: false, changes: state.changes + 1 };
  }
  var MEMORY_KEY = "sys.tamanos";
  var MEMORY_LIMIT = 240;
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
  function recallModel(key) {
    if (!key) return null;
    const entry = readMemory()[key];
    if (!Array.isArray(entry)) return null;
    const model = { col: unpack(entry[0]), wide: unpack(entry[1]), tall: unpack(entry[2]), fluid: unpack(entry[3]) };
    return model.col === null && model.wide === null && model.tall === null && model.fluid === null ? null : model;
  }
  function rememberModel(key, model) {
    if (!key) return;
    try {
      const memory = readMemory();
      delete memory[key];
      if (model.col !== null || model.wide !== null || model.tall !== null || model.fluid !== null) {
        memory[key] = [pack(model.col), pack(model.wide), pack(model.tall), pack(model.fluid)];
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
  return __toCommonJS(deck_fit_exports);
})();
