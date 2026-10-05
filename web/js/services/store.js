/**
 * store.js — the app's single state container. No DOM, no dependencies.
 *
 * Replaces zustand + ReactFlow's change helpers. State is a plain object; every
 * action produces a NEW top-level object (and new nodes/edges arrays when they
 * change), so subscribers can compare slices by identity.
 *
 *   createStore(initial, actions) -> { get, set, subscribe, ...actions }
 *   subscribe(selector, listener, equals = Object.is) -> unsubscribe
 *     listener(nextSlice, prevSlice) fires only when the selected slice changes.
 *
 *   store = createFlowStore()
 *     nodes:  [{ id, type, position: {x, y}, data: { id, nodeType, ...fields } }]
 *     edges:  [{ id, source, sourceHandle, target, targetHandle }]
 *     selection: null | { kind: 'node' | 'edge', id }
 *     runState: { [nodeId]: { status: 'running' | 'done' | 'error', output?, message? } }
 *     runStatus: 'idle' | 'running' | 'done' | 'error', runResults, runError
 *     apiKeys: { gemini?, anthropic? }
 *     layout: 'top' | 'side'
 *
 * Field edits (updateNodeField) replace the node object but keep its id, so the
 * canvas can tell "data changed" (ignore — the card owns its inputs) from
 * "node added/removed/moved" (re-render / re-position).
 */

export function createStore(initial, actions) {
  let state = initial;
  const listeners = new Set();

  const get = () => state;
  const set = (patch) => {
    const prev = state;
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    for (const l of [...listeners]) l(state, prev);
  };
  const subscribe = (selector, listener, equals = Object.is) => {
    const entry = (next, prev) => {
      const a = selector(next), b = selector(prev);
      if (!equals(a, b)) listener(a, b);
    };
    listeners.add(entry);
    return () => listeners.delete(entry);
  };

  const api = { get, set, subscribe };
  return Object.assign(api, actions(set, get));
}

/** Shallow array/object equality for multi-value selectors. */
export function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.is(a[k], b[k]));
}

const edgeId = (e) => `e-${e.sourceHandle}-${e.targetHandle}`;

export const EXAMPLE = {
  nodeIDs: { customInput: 1, text: 1, llm: 1, customOutput: 1 },
  nodes: [
    { id: 'customInput-1', type: 'customInput', position: { x: 0, y: 40 },
      data: { id: 'customInput-1', nodeType: 'customInput', inputName: 'topic', value: 'indoor mould after a wet winter' } },
    { id: 'text-1', type: 'text', position: { x: 340, y: 0 },
      data: { id: 'text-1', nodeType: 'text', text: 'Write three practical tips about {{topic}}.' } },
    { id: 'llm-1', type: 'llm', position: { x: 760, y: 20 }, data: { id: 'llm-1', nodeType: 'llm' } },
    { id: 'customOutput-1', type: 'customOutput', position: { x: 1100, y: 60 },
      data: { id: 'customOutput-1', nodeType: 'customOutput', outputName: 'tips' } },
  ],
  edges: [
    { source: 'customInput-1', sourceHandle: 'customInput-1-value', target: 'text-1', targetHandle: 'text-1-topic' },
    { source: 'text-1', sourceHandle: 'text-1-output', target: 'llm-1', targetHandle: 'llm-1-prompt' },
    { source: 'llm-1', sourceHandle: 'llm-1-response', target: 'customOutput-1', targetHandle: 'customOutput-1-value' },
  ].map(e => ({ ...e, id: edgeId(e) })),
};

export function createFlowStore(overrides = {}) {
  return createStore(
    {
      nodes: [], edges: [], nodeIDs: {}, selection: null,
      runState: {}, runStatus: 'idle', runResults: null, runError: null,
      apiKeys: {}, layout: 'top',
      ...overrides,
    },
    (set, get) => {
      const a = {
      /** Add a node of `type` at canvas position; returns its new id. */
      addNode(type, position, data = {}) {
        const nodeIDs = { ...get().nodeIDs, [type]: (get().nodeIDs[type] || 0) + 1 };
        const id = `${type}-${nodeIDs[type]}`;
        set({ nodeIDs, nodes: [...get().nodes, { id, type, position, data: { id, nodeType: type, ...data } }] });
        return id;
      },
      moveNode(id, position) {
        set({ nodes: get().nodes.map(n => (n.id === id ? { ...n, position } : n)) });
      },
      updateNodeField(id, field, value) {
        set({ nodes: get().nodes.map(n => (n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n)) });
      },
      removeNode(id) {
        const { nodes, edges, selection } = get();
        set({
          nodes: nodes.filter(n => n.id !== id),
          edges: edges.filter(e => e.source !== id && e.target !== id),
          selection: selection?.id === id ? null : selection,
        });
      },
      /** Connect source handle -> target handle. Ignores self-loops and duplicates; returns the edge or null. */
      connect({ source, sourceHandle, target, targetHandle }) {
        if (!source || !target || source === target) return null;
        const edge = { id: edgeId({ sourceHandle, targetHandle }), source, sourceHandle, target, targetHandle };
        if (get().edges.some(e => e.id === edge.id)) return null;
        set({ edges: [...get().edges, edge] });
        return edge;
      },
      removeEdge(id) {
        const { edges, selection } = get();
        set({ edges: edges.filter(e => e.id !== id), selection: selection?.id === id ? null : selection });
      },
      /** Drop edges whose handle no longer exists on a node (e.g. a {{var}} deleted from a Text node). */
      pruneHandles(nodeId, liveHandleIds) {
        const live = new Set(liveHandleIds);
        const edges = get().edges.filter(e =>
          !(e.target === nodeId && !live.has(e.targetHandle)) && !(e.source === nodeId && !live.has(e.sourceHandle)));
        if (edges.length !== get().edges.length) set({ edges });
      },
      select(selection) { set({ selection }); },
      removeSelected() {
        const s = get().selection;
        if (s?.kind === 'node') a.removeNode(s.id);
        else if (s?.kind === 'edge') a.removeEdge(s.id);
      },
      clearAll() { set({ nodes: [], edges: [], selection: null, runState: {} }); },
      loadExample() { set({ ...structuredClone(EXAMPLE), selection: null, runState: {} }); },

      setLayout(layout) { set({ layout }); },
      setApiKeys(apiKeys) { set({ apiKeys }); },
      startRun() { set({ runState: {}, runStatus: 'running', runResults: null, runError: null }); },
      setNodeRun(id, s) { set({ runState: { ...get().runState, [id]: s } }); },
      finishRun(runStatus, extra = {}) { set({ runStatus, ...extra }); },
      };
      return a;
    },
  );
}
