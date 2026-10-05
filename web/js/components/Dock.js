/**
 * Dock.js — bottom-centre status instrument and the Clear Canvas key.
 *
 * Why: the dock carries a polite live region so run progress (WORKING / DONE / ERROR) is
 * announced. A live region only announces changes to a PERSISTENT element, so Dock builds once and
 * main.js calls updateDock() to patch text in place instead of re-mounting.
 *
 *   Dock({ nodes, edges, runStatus }) -> div.ff-dock.ff-glass     (counts are numbers)
 *   updateDock(el, { nodes, edges, runStatus })
 *   ClearButton({ onClick }) -> button
 *   dockStatus(runStatus) -> null | { cls, text }                  pure (tested)
 */
import { html } from "../util/html.js";
import { Button } from "./primitives.js";

const STATUS = {
  running: { cls: "ff-pill--running", text: "WORKING" },
  done: { cls: "ff-pill--done", text: "DONE" },
  error: { cls: "ff-pill--error", text: "ERROR" },
};
export const dockStatus = (s) => STATUS[s] || null;

export function Dock({ nodes = 0, edges = 0, runStatus = "idle" }) {
  const el = html`
    <div class="ff-dock ff-glass">
      <span class="ff-dock__stat"><b data-k="nodes"></b> NODES</span>
      <span class="ff-dock__stat"><b data-k="edges"></b> EDGES</span>
      <span class="ff-dock__live" data-k="status" role="status" aria-live="polite"></span>
    </div>`;
  updateDock(el, { nodes, edges, runStatus });
  return el;
}

export function updateDock(el, { nodes, edges, runStatus }) {
  el.querySelector('[data-k="nodes"]').textContent = nodes;
  el.querySelector('[data-k="edges"]').textContent = edges;
  const host = el.querySelector('[data-k="status"]');
  const s = dockStatus(runStatus);
  if (!s) { host.replaceChildren(); return; }
  let pill = host.firstChild;
  if (!pill) { pill = document.createElement("span"); host.append(pill); }
  pill.className = `ff-pill ${s.cls}`;
  pill.textContent = s.text;
}

export function ClearButton({ onClick }) {
  return Button({ label: "Clear Canvas", icon: "trash", variant: "danger", size: "sm", onClick });
}
