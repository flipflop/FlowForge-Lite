# Vanilla JS migration — contracts

Goal: replace `frontend/` (React 18, ReactFlow 11, zustand, CRA) with `web/`: ES modules, no build, no npm,
no third-party runtime code. Served as static files (`python3 -m http.server -d web 8080`).
Method: `~/.claude/skills/vanilla-js-idiomatic-react` (pure prop→node components via `js/util/html.js`).
Visual source of truth: `docs/design.md` + `web/css/*`. The React build is the behavioural reference.

## Layout
```
web/
  index.html            fonts.css → tokens.css → base.css → app.css; pre-paint theme script; <div id="app">; main.js
  config.js             API_URL (default http://localhost:8000; override with ?api= or window.FF_CONFIG)
  css/                  fonts, tokens, base, app (DONE — class names are the contract)
  fonts/                self-hosted woff2 (DONE)
  js/util/html.js dom.js   engine (DONE, do not modify)
  js/services/store.js  (DONE) createFlowStore — read its header
  js/services/api.js    runPipeline (SSE over fetch), parsePipeline
  js/services/theme.js  initTheme(), toggleTheme(), getTheme()
  js/services/canvas.js     ← Agent A
  js/services/geometry.js   ← Agent A (pure maths, unit tested)
  js/components/MiniMap.js ZoomControls.js   ← Agent A
  js/components/*.js    ← Agent B (primitives, icons, NodeCard, header, palette, overlays, empty state, dock)
  js/nodes/*.js         ← Agent B (9 node bodies + registry)
  js/main.js            ← Agent B (orchestrator)
  tests/*.test.mjs      node --test web/tests/*.test.mjs   (no npm)
```

## Rules
- No JSX, no npm, no CDN. Only `html`/`h`/`mount` from `js/util/html.js`.
- Components are pure: props in, node out. No store imports inside `components/` or `nodes/` — they get
  callbacks (`onChange`, `onDelete`). `main.js` is the only file that wires store ↔ UI (plus canvas.js,
  which receives the store as a parameter).
- SVG: the html engine creates HTML elements, not SVG. Icons are trusted static strings set via
  `.innerHTML=${ICONS.x}` on a `<span class="ff-icon">`. Canvas SVG uses `document.createElementNS`.
- Colours only via classes/tokens. No hex outside `css/tokens.css`.
- Every file opens with a JSDoc "why + signatures" block.

## Re-render model (important)
Node cards render **once** per node id. Typing into a field calls `onChange(field, value)` → `store.updateNodeField`
and does NOT re-render the card (re-rendering would drop focus/caret). Things that change after mount are patched
through refs returned by the card:
- run status → `card.setRun({ status, output, message })` (pill class/text, output tray, `.is-running/.is-error`)
- Text node variables → the node re-renders only its own port list + var chips, then calls `onPortsChange(ids)`
  (main wires that to `store.pruneHandles`).
Whole-view re-render (`mount`) is fine for header, palette, overlays, dock, empty state.

## Node card contract (Agent B produces, Agent A consumes)
`renderNode(node, ctx) -> { el, setRun(run), destroy?() }` where `el` is the `.ff-node[data-cat]` element.
Ports are real elements inside `el`:
```html
<button class="ff-port ff-port--in"  data-handle="llm-1-prompt"   data-node="llm-1" aria-label="prompt input"  style="top:62px"></button>
<button class="ff-port ff-port--out" data-handle="llm-1-response" data-node="llm-1" aria-label="response output" style="top:50%"></button>
```
Handle ids must stay identical to the React app (`${id}-value`, `${id}-system`, `${id}-prompt`, `${id}-response`,
`${id}-output`, `${id}-${var}`, `${id}-in`, `${id}-valid`, `${id}-invalid`, …) — the backend relies on them.
Elements that must not start a node drag carry `nodrag` (inputs, textareas, selects, buttons are implicit).
Elements that scroll internally carry `nowheel`.

## Canvas engine contract (Agent A)
```js
const canvas = createCanvas(rootEl, { store, renderNode, snap: 20 });
// rootEl gets class ff-flow. Engine builds: svg.ff-flow__grid, .ff-viewport > svg.ff-wires + .ff-nodes
canvas.fitView({ padding = 0.2, duration = 0 })
canvas.zoomBy(factor)            // zoom about the centre
canvas.project(clientX, clientY) // screen → canvas coords
canvas.onViewport(fn)            // fn({ x, y, zoom }) on every change; returns unsubscribe
canvas.getViewport()
canvas.getNodeRect(id)           // canvas-space { x, y, w, h } for minimap
canvas.cardFor(id)               // the { el, setRun } returned by renderNode
canvas.destroy()
```
Behaviour (parity with ReactFlow as used today):
- Subscribes to `store.nodes` (diff by id: mount new via `renderNode`, remove gone, update `transform` of moved)
  and `store.edges`/`selection` (redraw wires). Field-only changes must not re-mount.
- Wires: SVG cubic bezier between port centres (ReactFlow "default" curve: horizontal tangents,
  offset = max(|dx|/2, 40)). Each wire is `<g class="ff-wire [is-selected]" data-edge>` with
  `path.ff-wire__hit` + `path.ff-wire__path`. Port positions measured from the DOM
  (`getBoundingClientRect` → canvas space ÷ zoom); recompute on node move, ResizeObserver on cards, and a
  MutationObserver for port add/remove (Text node). rAF-throttled.
- Pan: drag on empty background. Zoom: wheel/trackpad (pinch = ctrl+wheel) around cursor, clamp 0.2–2.
  Wheel over a `.nowheel` element scrolls it instead.
- Node drag: pointerdown on card (not on nodrag/input/textarea/select/button/.ff-port), move with pointer ÷ zoom,
  snap to `snap` on release, `store.moveNode`. Card gets `.is-dragging` while moving; raised z-index.
- Connect: pointerdown on `.ff-port--out` → draft wire `g.ff-wire--draft` follows pointer → release over a
  `.ff-port--in` of another node → `store.connect(...)`. Hovered valid target gets `.is-target`.
- Select: click card → `store.select({kind:'node', id})`; click wire → `{kind:'edge', id}`; click background → null.
  `.is-selected` on the `.ff-node` / wire. Delete/Backspace (when focus is not in a field) → `store.removeSelected()`.
  Hovering a wire + Delete also removes it (existing behaviour).
- Drop from palette: HTML5 drag with dataTransfer type `application/x-ff-node` = node type →
  `store.addNode(type, snapped(project(x,y)))`; new card gets `.is-entering` once.
- Grid: dot pattern (gap 22, r 0.8 at zoom 1) that pans/zooms with the viewport.
- Keyboard a11y: canvas root is focusable; arrow keys pan; +/− zoom; `0` fit view.

`MiniMap({ canvas, store }) -> el` (`.ff-minimap.ff-glass`): svg of node rects coloured `var(--cat-<cat>)`
(category from `js/nodes/categories.js`), viewport rectangle `.ff-minimap__view`, click/drag to pan.
`ZoomControls({ canvas }) -> el` (`.ff-zoom.ff-glass`): + / − / fit buttons with aria-labels.

## Component library (Agent B)
Primitives: `Icon(name)`, `Button({label, icon, variant, size, onClick, badge, running, ariaLabel})`,
`Segmented({options, value, onChange})`, `Chip({cat, icon, size})`, `Pill({status})`, `Field({label, control})`,
`Input`, `Textarea({code, autosize})`, `Select({value, options, onChange})` (`.ff-select` menu, keyboard + Escape),
`VarTag`. Node kit: `NodeCard({id, title, icon, cat, inputs, outputs, body, onDelete})` → `{el, setRun, setPorts}`.
Shell: `Header`, `Palette({layout})` (keys set dataTransfer `application/x-ff-node`), `EmptyState({onExample})`,
`Dock({nodes, edges, runStatus})`, `ClearButton`. Overlays: `Sheet({title, icon, body, foot, onClose})` (Escape,
scrim click, focus trap-lite, returns focus), `ValidationReport`, `ErrorSheet`, `ApiKeysSheet`, `Toast`.
Services: `api.js`, `theme.js`. Review switches preserved: `?theme=light|dark`, `?example=1`.

## Engine notes (Agent A)
- `renderNode(node, ctx)`: `ctx` is `{ canvas }`. If `store.runState[id]` exists at mount, the engine calls `card.setRun` once.
- Extra canvas methods beyond the contract (used by MiniMap): `setViewport(vp)`, `panTo(cx, cy)`, `getSize()`, `onLayout(fn)`. MiniMap/ZoomControls also work only through these.
- Wire endpoints are measured relative to the card's own rect, so hover lift / drag tilt do not shift wires.
- Pointerdown on a card (even on an input or button) selects it; drag starts only outside `nodrag`/fields/buttons/ports. Pointerdown inside any `.ff-panel` is ignored by the canvas.
- Wheel zoom: `exp(-deltaY * 0.002)` (0.01 for pinch/ctrl); drag threshold 3px; connect only starts from `.ff-port--out` and only lands on `.ff-port--in` of a different node; duplicates are rejected by the store.
- Delete/Backspace is handled on `document` but only when the target is `<body>` or inside the canvas and not in a field; a hovered wire wins over the current selection. Arrow/+/-/0 need the canvas itself focused.
- `.is-entering` is added to every card mounted after `createCanvas` returns (including `loadExample()`), removed on `animationend`.
- A wire whose port handle is not (yet) in the DOM is skipped, and appears once the port exists (MutationObserver).
- Dev: `web/dev/canvas-harness.html` (add `?selftest=1` for the scripted 40-check run; the title reports PASS/FAIL). Headless Chrome stops delivering rAF when idle, so selftest mode shims rAF with setTimeout.
