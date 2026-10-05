/**
 * canvas-selftest.js — scripted pointer/wheel/key events against the harness canvas.
 * Prints "SELFTEST PASS n/n" or "SELFTEST FAIL: …" into document.title.
 */
const frame = () => new Promise(r => { let d = false; const f = () => { if (!d) { d = true; r(); } }; requestAnimationFrame(() => requestAnimationFrame(f)); setTimeout(f, 3000); });
const until = async (cond, tries = 80) => { for (let i = 0; i < tries && !cond(); i++) await new Promise(r => setTimeout(r, 25)); return cond(); };
const centre = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

function ptr(type, target, x, y, extra = {}) {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, pointerId: 1, isPrimary: true,
    button: 0, clientX: x, clientY: y, ...extra,
  }));
}
async function drag(target, from, to, steps = 4) {
  ptr('pointerdown', target, ...from);
  for (let i = 1; i <= steps; i++) {
    ptr('pointermove', target, from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps);
  }
  await frame();
  ptr('pointerup', target, ...to);
  await frame();
}

export async function runSelfTest({ store, canvas, root }) {
  const results = [];
  const check = (name, ok) => { results.push([name, !!ok]); };
  const card = (id) => canvas.cardFor(id).el;
  const port = (h) => root.querySelector(`[data-handle="${h}"]`);
  const wireCount = () => root.querySelectorAll('.ff-wire:not(.ff-wire--draft)').length;
  try {
    await frame(); await frame();

    // mount + wires
    check('4 cards mounted', root.querySelectorAll('.ff-node').length === 4);
    check('3 wires drawn', wireCount() === 3);
    check('cards in .ff-node-pos', card('llm-1').parentElement.className === 'ff-node-pos');
    // wire endpoint == measured port centre (canvas space)
    const wire = root.querySelector('[data-edge="e-llm-1-response-customOutput-1-value"] .ff-wire__path');
    const nums = wire.getAttribute('d').match(/-?\d+(\.\d+)?/g).map(Number);
    const sp = canvas.project(...centre(port('llm-1-response')));
    const tp = canvas.project(...centre(port('customOutput-1-value')));
    check('wire starts at source port', Math.abs(nums[0] - sp.x) < 1.5 && Math.abs(nums[1] - sp.y) < 1.5);
    check('wire ends at target port', Math.abs(nums[6] - tp.x) < 1.5 && Math.abs(nums[7] - tp.y) < 1.5);
    check('grid pattern follows viewport', root.querySelector('pattern').getAttribute('patternTransform').includes('scale('));

    // field edit must not re-mount
    const before = card('text-1');
    store.updateNodeField('text-1', 'text', 'changed');
    await frame();
    check('field edit keeps same element', canvas.cardFor('text-1').el === before && before.isConnected);

    // select + drag with snap
    const title = card('text-1').querySelector('.ff-node__title');
    const z = canvas.getViewport().zoom;
    const start = store.get().nodes.find(n => n.id === 'text-1').position;
    await drag(title, centre(title), [centre(title)[0] + 105 * z, centre(title)[1] + 47 * z]);
    const moved = store.get().nodes.find(n => n.id === 'text-1').position;
    check('node selected on press', store.get().selection?.id === 'text-1' && card('text-1').classList.contains('is-selected'));
    check('drag moved node, snapped to 20', moved.x !== start.x && moved.x % 20 === 0 && moved.y % 20 === 0
      && Math.abs(moved.x - (start.x + 105)) <= 10 && Math.abs(moved.y - (start.y + 47)) <= 10);
    check('is-dragging cleared', !card('text-1').classList.contains('is-dragging'));
    // is-dragging present mid-drag
    ptr('pointerdown', title, ...centre(title)); ptr('pointermove', title, centre(title)[0] + 30, centre(title)[1] + 30);
    check('is-dragging while moving', card('text-1').classList.contains('is-dragging'));
    ptr('pointerup', title, ...centre(title)); await frame();

    // connect out -> in
    const edgesBefore = store.get().edges.length;
    const src = port('customInput-1-value'), dst = port('llm-1-system');
    ptr('pointerdown', src, ...centre(src));
    ptr('pointermove', root, ...centre(dst));
    check('draft wire shown', !!root.querySelector('.ff-wire--draft'));
    check('.is-target on hovered input', dst.classList.contains('is-target'));
    ptr('pointerup', root, ...centre(dst)); await frame();
    check('edge connected', store.get().edges.length === edgesBefore + 1
      && store.get().edges.some(e => e.targetHandle === 'llm-1-system'));
    check('draft + target cleared', !root.querySelector('.ff-wire--draft') && !dst.classList.contains('is-target'));
    const okw = await until(() => wireCount() === edgesBefore + 1);
    check('new wire drawn', okw);
    // dropping on a same-node input / nothing connects nothing
    const own = port('llm-1-response'), ownIn = port('llm-1-prompt');
    ptr('pointerdown', own, ...centre(own)); ptr('pointermove', root, ...centre(ownIn)); ptr('pointerup', root, ...centre(ownIn)); await frame();
    check('self-loop rejected', store.get().edges.length === edgesBefore + 1);

    // wheel zoom around cursor
    const rr = root.getBoundingClientRect();
    const cx = rr.left + 500, cy = rr.top + 300;
    const pBefore = canvas.project(cx, cy), z0 = canvas.getViewport().zoom;
    root.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -120, clientX: cx, clientY: cy }));
    const pAfter = canvas.project(cx, cy);
    check('wheel zooms in', canvas.getViewport().zoom > z0);
    check('zoom keeps cursor point', Math.abs(pBefore.x - pAfter.x) < 0.01 && Math.abs(pBefore.y - pAfter.y) < 0.01);
    for (let i = 0; i < 40; i++) root.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 400, ctrlKey: true, clientX: cx, clientY: cy }));
    check('zoom clamped >= 0.2', Math.abs(canvas.getViewport().zoom - 0.2) < 1e-9);
    // .nowheel passthrough
    const nw = document.createElement('div'); nw.className = 'nowheel'; card('llm-1').append(nw);
    const wev = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -120 });
    nw.dispatchEvent(wev);
    check('.nowheel not prevented', !wev.defaultPrevented);
    nw.remove();
    canvas.fitView({ padding: 0.3 });

    // pan
    const v0 = canvas.getViewport();
    await drag(root.querySelector('.ff-flow__grid'), [rr.left + 700, rr.top + 700], [rr.left + 760, rr.top + 680]);
    const v1 = canvas.getViewport();
    check('pan moves viewport', Math.abs(v1.x - v0.x - 60) < 0.01 && Math.abs(v1.y - v0.y + 20) < 0.01);
    check('background press deselects', store.get().selection === null);
    check('is-panning cleared', !root.classList.contains('is-panning'));

    // keyboard
    const kv = canvas.getViewport();
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    check('arrow pans', canvas.getViewport().x !== kv.x);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    check('+ zooms', canvas.getViewport().zoom > kv.zoom);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));
    await new Promise(r => setTimeout(r, 400));

    // minimap
    check('minimap rects', document.querySelectorAll('.ff-minimap__node').length === store.get().nodes.length);
    check('minimap view rect', !!document.querySelector('.ff-minimap__view').getAttribute('width'));

    // select wire + delete
    let eId = 'e-llm-1-response-customOutput-1-value';
    ptr('pointerdown', root.querySelector(`[data-edge="${eId}"] .ff-wire__hit`), 100, 100);
    ptr('pointerup', root, 100, 100);
    check('wire selected', store.get().selection?.kind === 'edge' && root.querySelector(`[data-edge="${eId}"]`).classList.contains('is-selected'));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    check('Delete removes selected wire', !store.get().edges.some(e => e.id === eId) && await until(() => !root.querySelector(`[data-edge="${eId}"]`)));

    // hovered wire + Delete (nothing selected)
    store.select(null);
    eId = 'e-text-1-output-llm-1-prompt';
    ptr('pointerover', root.querySelector(`[data-edge="${eId}"] .ff-wire__hit`), 100, 100);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    await frame();
    check('hovered wire + Delete removes it', !store.get().edges.some(e => e.id === eId));

    // field guard
    const inp = document.createElement('input'); card('llm-1').append(inp);
    store.select({ kind: 'node', id: 'llm-1' });
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    check('Backspace in a field does not delete', !!store.get().nodes.find(n => n.id === 'llm-1'));
    inp.remove();
    // nodrag: pressing a button does not start a drag
    const btn = document.createElement('button'); btn.textContent = 'x'; card('llm-1').append(btn);
    const p0 = store.get().nodes.find(n => n.id === 'llm-1').position;
    await drag(btn, centre(btn), [centre(btn)[0] + 80, centre(btn)[1] + 80]);
    const p1 = store.get().nodes.find(n => n.id === 'llm-1').position;
    check('button press does not drag', p0.x === p1.x && p0.y === p1.y);
    btn.remove();

    // HTML5 drop
    const dt = new DataTransfer(); dt.setData('application/x-ff-node', 'llm');
    const nBefore = store.get().nodes.length;
    root.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: rr.left + 333, clientY: rr.top + 222 }));
    await frame();
    const added = store.get().nodes.at(-1);
    check('drop adds node snapped', store.get().nodes.length === nBefore + 1 && added.id === 'llm-2'
      && added.position.x % 20 === 0 && added.position.y % 20 === 0);
    check('new card has .is-entering', card('llm-2').classList.contains('is-entering'));
    check('new card mounted', !!root.querySelector('[data-node-id="llm-2"]'));
    check('initial cards had no .is-entering', !card('text-1').classList.contains('is-entering'));

    // delete node
    store.select({ kind: 'node', id: 'llm-2' });
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    await frame();
    check('Delete removes node and unmounts card', !canvas.cardFor('llm-2') && !root.querySelector('[data-node-id="llm-2"]'));

    // port added later (MutationObserver) — wire appears without a store change
    const e = { id: 'e-late', source: 'customInput-1', sourceHandle: 'customInput-1-value', target: 'customOutput-1', targetHandle: 'customOutput-1-late' };
    store.set({ edges: [...store.get().edges, e] });
    await frame();
    check('wire to missing port skipped', !root.querySelector('[data-edge="e-late"]'));
    const late = document.createElement('button'); late.className = 'ff-port ff-port--in';
    late.dataset.handle = 'customOutput-1-late'; late.dataset.node = 'customOutput-1'; late.style.top = '90px';
    card('customOutput-1').append(late);
    check('port added later draws wire (MutationObserver)', await until(() => !!root.querySelector('[data-edge="e-late"]')));
  } catch (err) {
    check(`exception: ${err.stack || err}`, false);
  }
  const failed = results.filter(r => !r[1]);
  document.title = failed.length
    ? `SELFTEST FAIL: ${failed.map(r => r[0]).join(' | ')}`
    : `SELFTEST PASS ${results.length}/${results.length}`;
}
