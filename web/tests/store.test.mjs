// node --test web/tests — store behaviour, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlowStore } from '../js/services/store.js';

test('addNode numbers ids per type', () => {
  const s = createFlowStore();
  assert.equal(s.addNode('llm', { x: 0, y: 0 }), 'llm-1');
  assert.equal(s.addNode('llm', { x: 0, y: 0 }), 'llm-2');
  assert.equal(s.get().nodes[1].data.nodeType, 'llm');
});

test('connect rejects self-loops and duplicates', () => {
  const s = createFlowStore();
  const c = { source: 'a', sourceHandle: 'a-out', target: 'b', targetHandle: 'b-in' };
  assert.ok(s.connect(c));
  assert.equal(s.connect(c), null);
  assert.equal(s.connect({ ...c, target: 'a' }), null);
  assert.equal(s.get().edges.length, 1);
});

test('removeNode drops its edges and selection; removeSelected works detached', () => {
  const s = createFlowStore();
  s.loadExample();
  s.select({ kind: 'node', id: 'text-1' });
  const { removeSelected } = s;
  removeSelected();
  assert.equal(s.get().nodes.length, 3);
  assert.equal(s.get().edges.length, 1);
  assert.equal(s.get().selection, null);
});

test('subscribe fires only when the slice changes', () => {
  const s = createFlowStore();
  let calls = 0;
  s.subscribe(st => st.edges, () => calls++);
  s.addNode('text', { x: 0, y: 0 });
  assert.equal(calls, 0);
  s.connect({ source: 'x', sourceHandle: 'x-o', target: 'y', targetHandle: 'y-i' });
  assert.equal(calls, 1);
});

test('pruneHandles removes edges to vanished handles', () => {
  const s = createFlowStore();
  s.loadExample();
  s.pruneHandles('text-1', ['text-1-output']);
  assert.ok(!s.get().edges.some(e => e.targetHandle === 'text-1-topic'));
});
