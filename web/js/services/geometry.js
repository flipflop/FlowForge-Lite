/**
 * geometry.js — pure canvas maths. No DOM, no state, unit tested in Node.
 *
 * Why: the canvas engine (canvas.js) needs viewport transforms, snapping and the
 * ReactFlow "default" wire curve. Keeping them here as plain functions of numbers
 * means they can be tested without a browser and reused by the minimap.
 *
 *   A viewport is { x, y, zoom }: canvas point (cx, cy) appears on screen at
 *   (x + cx * zoom, y + cy * zoom), relative to the canvas root's top-left.
 *
 *   MIN_ZOOM, MAX_ZOOM                         0.2 / 2
 *   bezierPath(sx, sy, tx, ty) -> "M … C …"    horizontal tangents, offset = max(|dx|/2, 40)
 *   clampZoom(z, min?, max?) -> number
 *   zoomAt(viewport, factor, px, py, min?, max?) -> viewport   keeps screen point (px, py) fixed
 *   screenToCanvas(viewport, px, py) -> { x, y }
 *   fitViewport(rects, width, height, padding?, min?, max?) -> viewport   rects: [{x,y,w,h}]
 *   snap(v, grid) -> number                    nearest multiple of grid (grid <= 0 = off)
 */

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2;
const MIN_CURVE_OFFSET = 40;

export function bezierPath(sx, sy, tx, ty) {
  const o = Math.max(Math.abs(tx - sx) / 2, MIN_CURVE_OFFSET);
  return `M${sx},${sy} C${sx + o},${sy} ${tx - o},${ty} ${tx},${ty}`;
}

export function clampZoom(z, min = MIN_ZOOM, max = MAX_ZOOM) {
  return Math.min(max, Math.max(min, z));
}

export function zoomAt(vp, factor, px, py, min = MIN_ZOOM, max = MAX_ZOOM) {
  const zoom = clampZoom(vp.zoom * factor, min, max);
  const ratio = zoom / vp.zoom;
  return { x: px - (px - vp.x) * ratio, y: py - (py - vp.y) * ratio, zoom };
}

export function screenToCanvas(vp, px, py) {
  return { x: (px - vp.x) / vp.zoom, y: (py - vp.y) / vp.zoom };
}

function boundsOf(rects) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function fitViewport(rects, width, height, padding = 0.2, min = MIN_ZOOM, max = MAX_ZOOM) {
  if (!rects.length || width <= 0 || height <= 0) return { x: 0, y: 0, zoom: 1 };
  const b = boundsOf(rects);
  const pad = 1 + padding;
  const zoom = clampZoom(Math.min(width / (Math.max(b.w, 1) * pad), height / (Math.max(b.h, 1) * pad)), min, max);
  return {
    x: width / 2 - (b.x + b.w / 2) * zoom,
    y: height / 2 - (b.y + b.h / 2) * zoom,
    zoom,
  };
}

export function snap(v, grid) {
  return grid > 0 ? Math.round(v / grid) * grid + 0 : v;
}
