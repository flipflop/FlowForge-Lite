/**
 * canvas.js — the hand-written node-canvas engine that replaces ReactFlow.
 *
 * Why: FlowForge needs pan/zoom, draggable cards, bezier wires and port-to-port
 * connecting, and nothing else. ~400 lines of DOM beat a 200 kB dependency.
 * The engine owns ONLY geometry and interaction; card content comes from the
 * injected `renderNode`, state lives in the injected store. Cards mount once per
 * node id (field edits never re-mount, so typing keeps focus); wires are measured
 * from the real port elements, so cards may change height or ports freely.
 *
 *   createCanvas(rootEl, { store, renderNode, snap = 20 }) -> canvas
 *     renderNode(node, { canvas }) -> { el, setRun(run), destroy?() }
 *
 *   canvas.fitView({ padding = 0.2, duration = 0 })   canvas.zoomBy(factor)
 *   canvas.project(clientX, clientY) -> { x, y }      canvas.getViewport() -> { x, y, zoom }
 *   canvas.onViewport(fn) -> unsubscribe              canvas.getNodeRect(id) -> { x, y, w, h }
 *   canvas.cardFor(id)                                canvas.destroy()
 *   Extras (used by MiniMap): setViewport(vp), panTo(cx, cy), getSize() -> { w, h },
 *   onLayout(fn) -> unsubscribe  (fires after cards move/resize/wires redraw).
 *
 * DOM: root.ff-flow > svg.ff-flow__grid + .ff-viewport > (svg.ff-wires + .ff-nodes > .ff-node-pos > card.el)
 */

import { bezierPath, zoomAt, screenToCanvas, fitViewport, snap as snapTo } from './geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DROP_TYPE = 'application/x-ff-node';
const GRID_GAP = 22;
const DRAG_THRESHOLD = 3;
const KEY_PAN = 60;
const KEY_ZOOM = 1.2;
const NO_DRAG = '.nodrag, input, textarea, select, button, .ff-port, [contenteditable]';
const FIELD = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
let gridSeq = 0;

const svgEl = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
const divEl = (cls) => Object.assign(document.createElement('div'), { className: cls });

function buildGrid() {
  const id = `ff-grid-${++gridSeq}`;
  const svg = svgEl('svg', { class: 'ff-flow__grid', 'aria-hidden': 'true' });
  const pattern = svgEl('pattern', { id, width: GRID_GAP, height: GRID_GAP, patternUnits: 'userSpaceOnUse' });
  pattern.append(svgEl('circle', { cx: GRID_GAP / 2, cy: GRID_GAP / 2, r: 0.8 }));
  const defs = svgEl('defs');
  defs.append(pattern);
  svg.append(defs, svgEl('rect', { width: '100%', height: '100%', fill: `url(#${id})` }));
  return { svg, pattern };
}

export function createCanvas(root, { store, renderNode, snap = 20 }) {
  root.classList.add('ff-flow');
  root.tabIndex = 0;
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'Pipeline canvas');

  const grid = buildGrid();
  const viewportEl = divEl('ff-viewport');
  const wiresSvg = svgEl('svg', { class: 'ff-wires' });
  const nodesEl = divEl('ff-nodes');
  viewportEl.append(wiresSvg, nodesEl);
  root.replaceChildren(grid.svg, viewportEl);

  let viewport = { x: 0, y: 0, zoom: 1 };
  const viewportListeners = new Set();
  const layoutListeners = new Set();
  const cards = new Map();   // id -> { node, wrap, card, pos, ro }
  const wires = new Map();   // edge id -> <g>
  let hoveredEdge = null;
  let raf = 0;
  let topZ = 1;
  let mounted = false;       // false during the first sync, so initial cards don't animate in
  let tween = 0;
  let gesture = null;        // the single active pointer gesture: pan | drag | connect

  // ── viewport ────────────────────────────────────────────────────────────
  function applyViewport() {
    const { x, y, zoom } = viewport;
    viewportEl.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    grid.pattern.setAttribute('patternTransform', `translate(${x} ${y}) scale(${zoom})`);
    for (const fn of [...viewportListeners]) fn({ ...viewport });
  }
  function setViewport(next) {
    viewport = { x: next.x, y: next.y, zoom: next.zoom };
    applyViewport();
  }
  const size = () => ({ w: root.clientWidth, h: root.clientHeight });
  const rootPoint = (cx, cy) => {
    const r = root.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  };
  function project(clientX, clientY) {
    const p = rootPoint(clientX, clientY);
    return screenToCanvas(viewport, p.x, p.y);
  }
  function zoomBy(factor, px = size().w / 2, py = size().h / 2) {
    setViewport(zoomAt(viewport, factor, px, py));
  }
  function panTo(cx, cy) {
    const { w, h } = size();
    setViewport({ x: w / 2 - cx * viewport.zoom, y: h / 2 - cy * viewport.zoom, zoom: viewport.zoom });
  }
  function fitView({ padding = 0.2, duration = 0 } = {}) {
    const { w, h } = size();
    const rects = [...cards.keys()].map(getNodeRect);
    const target = fitViewport(rects, w, h, padding);
    cancelAnimationFrame(tween);
    if (!duration) return setViewport(target);
    const from = viewport, t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration), e = 1 - (1 - t) ** 3;
      setViewport({
        x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e,
        zoom: from.zoom + (target.zoom - from.zoom) * e,
      });
      if (t < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  }

  // ── cards ───────────────────────────────────────────────────────────────
  const setPos = (entry, pos) => {
    entry.pos = { x: pos.x, y: pos.y };
    entry.wrap.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  };
  function mountCard(node) {
    const card = renderNode(node, { canvas });
    const wrap = divEl('ff-node-pos');
    wrap.dataset.nodeId = node.id;
    wrap.append(card.el);
    nodesEl.append(wrap);
    const entry = { node, wrap, card, pos: node.position, ro: null };
    entry.ro = new ResizeObserver(schedule);
    entry.ro.observe(card.el);
    setPos(entry, node.position);
    cards.set(node.id, entry);
    const run = store.get().runState?.[node.id];
    if (run) card.setRun?.(run);
    if (mounted) {
      card.el.classList.add('is-entering');
      card.el.addEventListener('animationend', (e) => {
        if (e.target === card.el) card.el.classList.remove('is-entering');
      });
    }
  }
  function unmountCard(id) {
    const entry = cards.get(id);
    entry.ro.disconnect();
    entry.card.destroy?.();
    entry.wrap.remove();
    cards.delete(id);
  }
  function syncNodes() {
    const nodes = store.get().nodes;
    const live = new Set(nodes.map(n => n.id));
    for (const id of [...cards.keys()]) if (!live.has(id)) unmountCard(id);
    for (const node of nodes) {
      const entry = cards.get(node.id);
      if (!entry) { mountCard(node); continue; }
      entry.node = node;
      const moved = entry.pos.x !== node.position.x || entry.pos.y !== node.position.y;
      if (moved && gesture?.id !== node.id) setPos(entry, node.position);
    }
    applySelection();
    schedule();
  }
  function applySelection() {
    const sel = store.get().selection;
    for (const [id, entry] of cards) {
      entry.card.el.classList.toggle('is-selected', sel?.kind === 'node' && sel.id === id);
    }
    for (const [id, g] of wires) g.classList.toggle('is-selected', sel?.kind === 'edge' && sel.id === id);
  }
  function getNodeRect(id) {
    const e = cards.get(id);
    return e ? { x: e.pos.x, y: e.pos.y, w: e.wrap.offsetWidth, h: e.wrap.offsetHeight } : null;
  }

  // ── wires ───────────────────────────────────────────────────────────────
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      drawWires();
      for (const fn of [...layoutListeners]) fn();
    });
  }
  /** Port centre in canvas space, measured relative to its card so hover lifts/tilts cancel out. */
  function portPoint(nodeId, handle, frame) {
    const entry = cards.get(nodeId);
    if (!entry) return null;
    let info = frame.get(nodeId);
    if (!info) {
      info = { rect: entry.card.el.getBoundingClientRect(), ports: new Map() };
      for (const p of entry.card.el.querySelectorAll('.ff-port')) info.ports.set(p.dataset.handle, p);
      frame.set(nodeId, info);
    }
    const port = info.ports.get(handle);
    if (!port || !info.rect.width) return null;
    const pr = port.getBoundingClientRect();
    return {
      x: entry.pos.x + (pr.left + pr.width / 2 - info.rect.left) / viewport.zoom,
      y: entry.pos.y + (pr.top + pr.height / 2 - info.rect.top) / viewport.zoom,
    };
  }
  function makeWire(edge) {
    const g = svgEl('g', { class: 'ff-wire' });
    g.dataset.edge = edge.id;
    g.append(svgEl('path', { class: 'ff-wire__hit' }), svgEl('path', { class: 'ff-wire__path' }));
    wiresSvg.append(g);
    return g;
  }
  function drawWires() {
    const { edges } = store.get();
    const frame = new Map();
    const live = new Set();
    for (const edge of edges) {
      const a = portPoint(edge.source, edge.sourceHandle, frame);
      const b = portPoint(edge.target, edge.targetHandle, frame);
      if (!a || !b) continue;
      live.add(edge.id);
      const g = wires.get(edge.id) || (wires.set(edge.id, makeWire(edge)), wires.get(edge.id));
      const d = bezierPath(a.x, a.y, b.x, b.y);
      for (const p of g.children) if (p.getAttribute('d') !== d) p.setAttribute('d', d);
    }
    for (const [id, g] of [...wires]) {
      if (live.has(id)) continue;
      g.remove();
      wires.delete(id);
      if (hoveredEdge === id) hoveredEdge = null;
    }
    applySelection();
  }

  // ── pointer gestures ────────────────────────────────────────────────────
  function capture(e) {
    try { root.setPointerCapture(e.pointerId); } catch { /* synthetic or already released */ }
  }
  function select(sel) {
    const cur = store.get().selection;
    if ((cur?.kind ?? null) === (sel?.kind ?? null) && cur?.id === sel?.id) return;
    store.select(sel);
  }
  function onPointerDown(e) {
    if (e.button !== 0 || gesture) return;
    const t = e.target;
    if (t.closest?.('.ff-panel')) return;   // floating instruments handle their own pointers
    const port = t.closest?.('.ff-port--out');
    const wire = t.closest?.('.ff-wire');
    const wrap = t.closest?.('.ff-node-pos');
    if (port) return startConnect(e, port);
    if (wire) { select({ kind: 'edge', id: wire.dataset.edge }); return; }
    if (wrap) {
      const id = wrap.dataset.nodeId;
      wrap.style.zIndex = ++topZ;
      select({ kind: 'node', id });
      if (!t.closest(NO_DRAG)) startDrag(e, id);
      return;
    }
    select(null);
    root.focus({ preventScroll: true });
    e.preventDefault();
    capture(e);
    gesture = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: viewport.x, vy: viewport.y };
    root.classList.add('is-panning');
  }
  function startDrag(e, id) {
    capture(e);
    const entry = cards.get(id);
    gesture = { kind: 'drag', id, sx: e.clientX, sy: e.clientY, ox: entry.pos.x, oy: entry.pos.y, moved: false };
  }
  function startConnect(e, port) {
    e.preventDefault();
    capture(e);
    const draft = svgEl('g', { class: 'ff-wire ff-wire--draft', 'pointer-events': 'none' });
    const path = svgEl('path', { class: 'ff-wire__path' });
    draft.append(path);
    wiresSvg.append(draft);
    const from = portPoint(port.dataset.node, port.dataset.handle, new Map());
    gesture = { kind: 'connect', port, from, draft, path, target: null };
    moveConnect(e);
  }
  function moveConnect(e) {
    const g = gesture;
    const to = project(e.clientX, e.clientY);
    g.path.setAttribute('d', bezierPath(g.from.x, g.from.y, to.x, to.y));
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.ff-port--in');
    const target = hit && hit.dataset.node !== g.port.dataset.node ? hit : null;
    if (target !== g.target) {
      g.target?.classList.remove('is-target');
      target?.classList.add('is-target');
      g.target = target;
    }
  }
  function onPointerMove(e) {
    const g = gesture;
    if (!g) return;
    if (g.kind === 'pan') {
      setViewport({ x: g.vx + e.clientX - g.sx, y: g.vy + e.clientY - g.sy, zoom: viewport.zoom });
    } else if (g.kind === 'drag') {
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
      const entry = cards.get(g.id);
      if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!g.moved) { g.moved = true; entry.card.el.classList.add('is-dragging'); }
      setPos(entry, { x: g.ox + dx / viewport.zoom, y: g.oy + dy / viewport.zoom });
      schedule();
    } else moveConnect(e);
  }
  function endGesture(e, cancelled) {
    const g = gesture;
    if (!g) return;
    gesture = null;
    try { root.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    if (g.kind === 'pan') root.classList.remove('is-panning');
    else if (g.kind === 'drag') {
      const entry = cards.get(g.id);
      entry?.card.el.classList.remove('is-dragging');
      if (entry && g.moved) {
        const next = cancelled ? { x: g.ox, y: g.oy } : { x: snapTo(entry.pos.x, snap), y: snapTo(entry.pos.y, snap) };
        setPos(entry, next);
        store.moveNode(g.id, next);
        schedule();
      }
    } else {
      g.draft.remove();
      g.target?.classList.remove('is-target');
      if (g.target && !cancelled) {
        store.connect({
          source: g.port.dataset.node, sourceHandle: g.port.dataset.handle,
          target: g.target.dataset.node, targetHandle: g.target.dataset.handle,
        });
      }
    }
  }

  // ── wheel, hover, drop, keyboard ────────────────────────────────────────
  function onWheel(e) {
    if (e.target.closest?.('.nowheel')) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : 1;
    const speed = e.ctrlKey ? 0.01 : 0.002;   // pinch arrives as ctrl+wheel with small deltas
    const p = rootPoint(e.clientX, e.clientY);
    zoomBy(Math.exp(-e.deltaY * unit * speed), p.x, p.y);
  }
  const onOver = (e) => { hoveredEdge = e.target.closest?.('.ff-wire')?.dataset.edge ?? null; };
  const onLeave = () => { hoveredEdge = null; };
  function onDragOver(e) {
    if (![...(e.dataTransfer?.types || [])].includes(DROP_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function onDrop(e) {
    const type = e.dataTransfer?.getData(DROP_TYPE);
    if (!type) return;
    e.preventDefault();
    const p = project(e.clientX, e.clientY);
    store.addNode(type, { x: snapTo(p.x, snap), y: snapTo(p.y, snap) });
  }
  function onKeyDown(e) {
    const t = e.target;
    if (t.closest?.(FIELD) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (t !== document.body && !root.contains(t)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (hoveredEdge) store.removeEdge(hoveredEdge); else store.removeSelected();
      e.preventDefault();
      return;
    }
    if (t !== root) return;   // navigation keys only when the canvas itself has focus
    const pan = { ArrowLeft: [KEY_PAN, 0], ArrowRight: [-KEY_PAN, 0], ArrowUp: [0, KEY_PAN], ArrowDown: [0, -KEY_PAN] }[e.key];
    if (pan) setViewport({ x: viewport.x + pan[0], y: viewport.y + pan[1], zoom: viewport.zoom });
    else if (e.key === '+' || e.key === '=') zoomBy(KEY_ZOOM);
    else if (e.key === '-' || e.key === '_') zoomBy(1 / KEY_ZOOM);
    else if (e.key === '0') fitView({ duration: 200 });
    else return;
    e.preventDefault();
  }

  // ── wiring up ───────────────────────────────────────────────────────────
  const offs = [
    store.subscribe(s => s.nodes, syncNodes),
    store.subscribe(s => s.edges, schedule),
    store.subscribe(s => s.selection, applySelection),
  ];
  const mo = new MutationObserver(schedule);                 // ports added/removed (Text node variables)
  mo.observe(nodesEl, { childList: true, subtree: true });
  const rootRO = new ResizeObserver(() => { applyViewport(); schedule(); });
  rootRO.observe(root);

  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    return () => target.removeEventListener(type, fn, opts);
  };
  offs.push(
    on(root, 'pointerdown', onPointerDown),
    on(root, 'pointermove', onPointerMove),
    on(root, 'pointerup', (e) => endGesture(e, false)),
    on(root, 'pointercancel', (e) => endGesture(e, true)),
    on(root, 'wheel', onWheel, { passive: false }),
    on(root, 'pointerover', onOver),
    on(root, 'pointerleave', onLeave),
    on(root, 'dragover', onDragOver),
    on(root, 'drop', onDrop),
    on(document, 'keydown', onKeyDown),
  );

  const canvas = {
    fitView, zoomBy, project, getNodeRect, setViewport, panTo,
    getViewport: () => ({ ...viewport }),
    getSize: () => { const { w, h } = size(); return { w, h }; },
    cardFor: (id) => cards.get(id)?.card ?? null,
    onViewport(fn) { viewportListeners.add(fn); return () => viewportListeners.delete(fn); },
    onLayout(fn) { layoutListeners.add(fn); return () => layoutListeners.delete(fn); },
    destroy() {
      offs.forEach(off => off());
      mo.disconnect();
      rootRO.disconnect();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tween);
      for (const id of [...cards.keys()]) unmountCard(id);
      viewportListeners.clear();
      layoutListeners.clear();
      root.replaceChildren();
      root.classList.remove('ff-flow', 'is-panning');
    },
  };

  syncNodes();
  mounted = true;
  applyViewport();
  return canvas;
}
