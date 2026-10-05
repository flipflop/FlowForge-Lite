/**
 * MiniMap.js — a small overview of the canvas: node rects, the visible
 * viewport, and click/drag to pan.
 *
 * Why: orientation on a large pipeline. It is a pure render of canvas geometry
 * (getNodeRect / getViewport / getSize) redrawn on viewport, layout and node
 * changes; the svg viewBox is the union of nodes + viewport, padded and
 * aspect-matched to the box so nothing is distorted.
 *
 *   MiniMap({ canvas, store }) -> .ff-minimap.ff-glass element (el.destroy() unsubscribes)
 *     canvas: { getNodeRect, getViewport, getSize, onViewport, onLayout, panTo }
 *     store:  { get, subscribe }
 */
import { html } from '../util/html.js';
import { categoryForNodeType } from '../nodes/categories.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BOX = { w: 200, h: 140 };   // matches .ff-minimap in app.css
const PAD = 0.15;

const svgEl = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

/** Union of rects, padded, then widened so its aspect equals the box's. */
function viewBoxFor(rects) {
  const x0 = Math.min(...rects.map(r => r.x)), y0 = Math.min(...rects.map(r => r.y));
  const x1 = Math.max(...rects.map(r => r.x + r.w)), y1 = Math.max(...rects.map(r => r.y + r.h));
  let w = (x1 - x0) * (1 + PAD * 2) || 1, h = (y1 - y0) * (1 + PAD * 2) || 1;
  const aspect = BOX.w / BOX.h;
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
}

export function MiniMap({ canvas, store }) {
  const svg = svgEl('svg', { role: 'img', 'aria-label': 'Canvas overview', preserveAspectRatio: 'xMidYMid meet' });
  const nodesG = svgEl('g');
  const mask = svgEl('path', { class: 'ff-minimap__mask', 'fill-rule': 'evenodd' });
  const view = svgEl('rect', { class: 'ff-minimap__view' });
  svg.append(nodesG, mask, view);
  const el = html`<div class="ff-minimap ff-glass">${svg}</div>`;

  function draw() {
    const { x, y, zoom } = canvas.getViewport();
    const { w, h } = canvas.getSize();
    const vr = { x: -x / zoom, y: -y / zoom, w: w / zoom, h: h / zoom };
    const nodes = store.get().nodes;
    const rects = nodes.map(n => ({ n, r: canvas.getNodeRect(n.id) })).filter(i => i.r);
    const vb = viewBoxFor([vr, ...rects.map(i => i.r)]);
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    nodesG.replaceChildren(...rects.map(({ n, r }) => {
      const rect = svgEl('rect', { class: 'ff-minimap__node', x: r.x, y: r.y, width: r.w, height: r.h, rx: 6 });
      rect.style.fill = `var(--cat-${categoryForNodeType(n.type)})`;
      return rect;
    }));
    mask.setAttribute('d',
      `M${vb.x},${vb.y}h${vb.w}v${vb.h}h${-vb.w}z M${vr.x},${vr.y}h${vr.w}v${vr.h}h${-vr.w}z`);
    for (const [k, v] of Object.entries({ x: vr.x, y: vr.y, width: vr.w, height: vr.h })) view.setAttribute(k, v);
  }

  function panToEvent(e) {
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    canvas.panTo(p.x, p.y);
  }
  svg.addEventListener('pointerdown', (e) => {
    try { svg.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    panToEvent(e);
    const move = (ev) => panToEvent(ev);
    const stop = () => { svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', stop); svg.removeEventListener('pointercancel', stop); };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', stop);
    svg.addEventListener('pointercancel', stop);
  });

  const offs = [canvas.onViewport(draw), canvas.onLayout(draw), store.subscribe(s => s.nodes, draw)];
  el.destroy = () => offs.forEach(off => off());
  draw();
  return el;
}
