// node --test web/tests — pure geometry, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bezierPath, clampZoom, zoomAt, screenToCanvas, fitViewport, snap } from '../js/services/geometry.js';

test('bezierPath uses half the horizontal distance as tangent offset', () => {
  assert.equal(bezierPath(0, 0, 200, 50), 'M0,0 C100,0 100,50 200,50');
});

test('bezierPath enforces a 40px minimum offset, also for backwards wires', () => {
  assert.equal(bezierPath(100, 10, 110, 20), 'M100,10 C140,10 70,20 110,20');
  assert.equal(bezierPath(300, 0, 0, 0), 'M300,0 C450,0 -150,0 0,0');
});

test('clampZoom bounds to 0.2..2', () => {
  assert.equal(clampZoom(0.01), 0.2);
  assert.equal(clampZoom(9), 2);
  assert.equal(clampZoom(1.3), 1.3);
});

test('zoomAt keeps the cursor point fixed', () => {
  const vp = { x: 30, y: -20, zoom: 1 };
  const before = screenToCanvas(vp, 400, 300);
  const next = zoomAt(vp, 1.5, 400, 300);
  const after = screenToCanvas(next, 400, 300);
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
  assert.equal(next.zoom, 1.5);
});

test('zoomAt clamps and does not drift at the limit', () => {
  const vp = { x: 10, y: 10, zoom: 2 };
  assert.deepEqual(zoomAt(vp, 2, 100, 100), vp);
});

test('screenToCanvas inverts the viewport transform', () => {
  assert.deepEqual(screenToCanvas({ x: 100, y: 50, zoom: 2 }, 300, 150), { x: 100, y: 50 });
});

test('fitViewport centres the bounds and respects padding', () => {
  const vp = fitViewport([{ x: 0, y: 0, w: 400, h: 200 }], 800, 600, 0, 0.2, 2);
  assert.equal(vp.zoom, 2);
  assert.equal(vp.x, 0);
  assert.equal(vp.y, 100);
  const padded = fitViewport([{ x: 0, y: 0, w: 800, h: 100 }], 800, 600, 0.25);
  assert.equal(padded.zoom, 0.8);
  assert.equal(padded.x, 80);
});

test('fitViewport with no rects returns identity; zoom is clamped', () => {
  assert.deepEqual(fitViewport([], 800, 600), { x: 0, y: 0, zoom: 1 });
  assert.equal(fitViewport([{ x: 0, y: 0, w: 100000, h: 10 }], 800, 600).zoom, 0.2);
});

test('snap rounds to the grid and avoids -0', () => {
  assert.equal(snap(29, 20), 20);
  assert.equal(snap(31, 20), 40);
  assert.ok(Object.is(snap(-3, 20), 0));
  assert.equal(snap(13.7, 0), 13.7);
});
