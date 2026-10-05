/**
 * api.js — backend client (no DOM). Port of frontend/src/api.js plus parsePipeline, which the
 * React app inlined in submit.js.
 *
 * Why: keeps network code out of components so main.js can swap or mock it. The URL comes from
 * config.js (query string / window.FF_CONFIG / localhost default).
 *
 *   runPipeline({ nodes, edges, apiKeys, signal, onEvent }) -> Promise<void>
 *     POST /pipelines/run and parse the SSE stream from fetch (EventSource is GET-only);
 *     onEvent(ev) per `data: {...}` frame.
 *   parsePipeline({ nodes, edges }) -> Promise<{ is_dag, num_nodes, num_edges }>
 *     POST /pipelines/parse. Throws Error("HTTP <status> — <text>") on non-2xx.
 *   splitFrames(buffer) -> { frames, rest }   pure SSE framing helper (tested)
 */
import { API_URL } from "../../config.js";

export { API_URL };

const JSON_HEADERS = { "Content-Type": "application/json" };

export function splitFrames(buffer) {
  const parts = buffer.split("\n\n");
  return { frames: parts.slice(0, -1), rest: parts[parts.length - 1] };
}

export async function runPipeline({ nodes, edges, apiKeys, signal, onEvent }) {
  const res = await fetch(`${API_URL}/pipelines/run`, {
    method: "POST",
    headers: JSON_HEADERS,
    signal,
    body: JSON.stringify({
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      edges: edges.map((e) => ({
        source: e.source, target: e.target,
        sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
      })),
      api_keys: apiKeys,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = splitFrames(buffer);
    buffer = rest;
    for (const frame of frames) {
      if (frame.startsWith("data: ")) onEvent(JSON.parse(frame.slice(6)));
    }
  }
}

export async function parsePipeline({ nodes, edges }) {
  const res = await fetch(`${API_URL}/pipelines/parse`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      nodes: nodes.map((n) => ({ id: n.id })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
  return res.json();
}
