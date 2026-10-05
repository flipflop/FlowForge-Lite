/**
 * main.js — the ONLY orchestrator: builds the tree, owns store <-> UI wiring.
 *
 * Why: components and node bodies are pure (props/callbacks in, DOM out); services never touch
 * the DOM. Everything that connects them lives here, in four groups:
 *   1. shell     — header / palette / canvas panels / empty state / dock / toast
 *   2. re-render — header+palette re-mount on state change (cheap, stateless); the dock patches in
 *                  place (live region); node cards are NEVER re-mounted — run state is pushed to
 *                  them with card.setRun, field edits go straight to the store
 *   3. flows     — run (SSE, AbortController stop), validate, API-key settings (sessionStorage 'ff-keys')
 *   4. review switches — ?theme=light|dark (theme.js), ?example=1 (loads the sample pipeline)
 */
import { html, mount } from "./util/html.js";
import { createFlowStore } from "./services/store.js";
import { initTheme, getTheme, toggleTheme, onThemeChange } from "./services/theme.js";
import { runPipeline, parsePipeline } from "./services/api.js";
import { createCanvas } from "./services/canvas.js";
import { renderNode } from "./nodes/registry.js";
import { Header } from "./components/Header.js";
import { Palette } from "./components/Palette.js";
import { EmptyState } from "./components/EmptyState.js";
import { Dock, updateDock, ClearButton } from "./components/Dock.js";
import { Toast, toastModel } from "./components/Toast.js";
import { openSheet, ValidationReport, ErrorSheet, ApiKeysSheet } from "./components/Sheet.js";
import { ZoomControls } from "./components/ZoomControls.js";
import { MiniMap } from "./components/MiniMap.js";

const SNAP = 20;
const snapTo = (v) => Math.round(v / SNAP) * SNAP;

function readSessionKeys() {
  try { return JSON.parse(sessionStorage.getItem("ff-keys") || "{}"); } catch { return {}; }
}

function boot() {
  initTheme();
  const store = createFlowStore();
  const ui = { validating: false, toastHidden: false };
  let abort = null;
  const sel = (fn) => (cb) => store.subscribe(fn, cb);

  // ── Skeleton (static; only the slots below are re-mounted) ─────────────
  const app = html`
    <div class="ff-app">
      <div style="display:contents" data-slot="header"></div>
      <div class="ff-main ff-main--top" data-slot="main">
        <div style="display:contents" data-slot="palette"></div>
        <div class="ff-canvas">
          <div class="ff-flow" data-slot="flow"></div>
          <div class="ff-panel ff-panel--bl" data-slot="zoom"></div>
          <div class="ff-panel ff-panel--br" data-slot="minimap"></div>
          <div class="ff-panel ff-panel--bc" data-slot="dock"></div>
          <div class="ff-panel ff-panel--tr" data-slot="clear"></div>
          <div data-slot="empty" style="display:contents"></div>
          <div data-slot="toast" role="status" aria-live="polite"></div>
        </div>
      </div>
    </div>`;
  const slot = (name) => app.querySelector(`[data-slot="${name}"]`);
  const slots = Object.fromEntries(
    ["header", "main", "palette", "flow", "zoom", "minimap", "dock", "clear", "empty", "toast"].map((n) => [n, slot(n)]));
  mount(document.getElementById("app"), app);

  // ── Canvas ─────────────────────────────────────────────────────────────
  const ctxFor = (node) => ({
    onChange: (field, value) => store.updateNodeField(node.id, field, value),
    onDelete: () => store.removeNode(node.id),
    onPortsChange: (ids) => store.pruneHandles(node.id, ids),
  });
  const canvas = createCanvas(slots.flow, {
    store, snap: SNAP,
    renderNode: (node) => {
      const card = renderNode(node, ctxFor(node));
      const run = store.get().runState[node.id];
      if (run) card.setRun(run);
      return card;
    },
  });

  // ── Re-mounted shell pieces ────────────────────────────────────────────
  const swapKeepingFocus = (host, build) => {
    const focusId = host.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
    mount(host, build());
    if (focusId) host.querySelector(`[data-focus="${focusId}"]`)?.focus();
  };

  const addAtCentre = (type) => {
    const r = slots.flow.getBoundingClientRect();
    const p = canvas.project(r.left + r.width / 2, r.top + r.height / 2);
    store.addNode(type, { x: snapTo(p.x - 120), y: snapTo(p.y - 60) });
  };

  const renderHeader = () => swapKeepingFocus(slots.header, () => {
    const s = store.get();
    return Header({
      theme: getTheme(), layout: s.layout, onLayout: store.setLayout, onToggleTheme: toggleTheme,
      hasKeys: Object.keys(s.apiKeys).length > 0, onSettings: openSettings,
      validating: ui.validating, onValidate: validate,
      running: s.runStatus === "running", onRun: run,
    });
  });
  const renderPalette = () => {
    const { layout } = store.get();
    slots.main.classList.toggle("ff-main--top", layout !== "side");
    mount(slots.palette, Palette({ layout, onAdd: addAtCentre }));
  };
  const renderClear = () => mount(slots.clear,
    store.get().nodes.length ? ClearButton({ onClick: () => store.clearAll() }) : null);
  const showExample = () => { store.loadExample(); setTimeout(() => canvas.fitView({ padding: 0.2, duration: 400 }), 60); };
  const renderEmpty = () => mount(slots.empty,
    store.get().nodes.length ? null : EmptyState({ onExample: showExample }));
  const renderToast = () => {
    const s = store.get();
    const model = toastModel({ status: s.runStatus, results: s.runResults, error: s.runError, hidden: ui.toastHidden });
    mount(slots.toast, model ? Toast({ model, onDismiss: () => { ui.toastHidden = true; renderToast(); } }) : null);
  };

  mount(slots.zoom, ZoomControls({ canvas }));
  mount(slots.minimap, MiniMap({ canvas, store }));
  const dock = Dock({ nodes: 0, edges: 0, runStatus: "idle" });
  mount(slots.dock, dock);
  const patchDock = () => { const s = store.get(); updateDock(dock, { nodes: s.nodes.length, edges: s.edges.length, runStatus: s.runStatus }); };

  // ── Store -> UI ────────────────────────────────────────────────────────
  store.subscribe((s) => s.layout, () => { renderPalette(); renderHeader(); });
  store.subscribe((s) => s.apiKeys, renderHeader);
  store.subscribe((s) => s.nodes.length, () => { renderClear(); renderEmpty(); patchDock(); });
  store.subscribe((s) => s.edges.length, patchDock);
  store.subscribe((s) => s.runStatus, (status) => {
    slots.flow.classList.toggle("ff-live", status === "running");
    ui.toastHidden = false;
    patchDock(); renderHeader(); renderToast();
  });
  store.subscribe((s) => s.runResults, renderToast);
  store.subscribe((s) => s.runError, renderToast);
  store.subscribe((s) => s.runState, (next, prev) => {
    for (const id of new Set([...Object.keys(prev), ...Object.keys(next)])) {
      if (next[id] !== prev[id]) canvas.cardFor(id)?.setRun(next[id]);
    }
  });
  onThemeChange(renderHeader);

  // ── Flows ──────────────────────────────────────────────────────────────
  async function run() {
    const s = store.get();
    if (s.runStatus === "running") { abort?.abort(); return; }
    if (s.nodes.length === 0) { store.finishRun("error", { runError: "Drag some nodes onto the canvas first." }); return; }
    store.startRun();
    abort = new AbortController();
    try {
      await runPipeline({
        nodes: s.nodes, edges: s.edges, apiKeys: s.apiKeys, signal: abort.signal,
        onEvent: (ev) => {
          if (ev.type === "node_start") store.setNodeRun(ev.id, { status: "running" });
          else if (ev.type === "node_done") store.setNodeRun(ev.id, { status: "done", output: ev.output });
          else if (ev.type === "node_error") store.setNodeRun(ev.id, { status: "error", message: ev.message });
          else if (ev.type === "run_done") store.finishRun("done", { runResults: ev.results });
          else if (ev.type === "run_error") store.finishRun("error", { runError: ev.message });
        },
      });
    } catch (err) {
      store.finishRun("error", {
        runError: err.name === "AbortError" ? "Run cancelled." : `Could not reach the backend: ${err.message}`,
      });
    }
  }

  async function validate() {
    const { nodes, edges } = store.get();
    if (nodes.length === 0) {
      openSheet((close) => ErrorSheet({ close, error: { title: "Empty Canvas", message: "Drag some nodes onto the canvas before submitting." } }));
      return;
    }
    ui.validating = true; renderHeader();
    try {
      const result = await parsePipeline({ nodes, edges });
      ui.validating = false; renderHeader();
      openSheet((close) => ValidationReport({ result, close }));
    } catch (err) {
      ui.validating = false; renderHeader();
      openSheet((close) => ErrorSheet({ close, error: {
        title: "Backend Connection Error",
        message: `${err.message}\n\nMake sure the FastAPI server is running:\n  cd backend && uvicorn main:app --reload`,
      } }));
    }
  }

  function openSettings() {
    const current = store.get().apiKeys;
    const keys = Object.keys(current).length ? current : readSessionKeys();
    openSheet((close) => ApiKeysSheet({
      keys, close,
      onSave: (clean) => {
        store.setApiKeys(clean);
        try { sessionStorage.setItem("ff-keys", JSON.stringify(clean)); } catch { /* ignore */ }
      },
    }));
  }

  // ── Initial paint ──────────────────────────────────────────────────────
  renderHeader(); renderPalette(); renderClear(); renderEmpty(); patchDock(); renderToast();
  if (new URLSearchParams(location.search).has("example")) {
    store.loadExample();
    setTimeout(() => canvas.fitView({ padding: 0.2 }), 60);
  }
}

boot();
