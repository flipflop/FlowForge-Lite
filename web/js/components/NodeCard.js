/**
 * NodeCard.js — the clay slab shared by all nine node types (port of common/BaseNode.jsx).
 *
 * Why: header, status pill, run-output tray and ports are identical across nodes, so they live
 * once here. The card renders ONCE per node id — typing must never rebuild it (focus/caret loss) —
 * so everything that changes later is patched through the returned handle:
 *   setRun(run)        status pill, .is-running/.is-error, output tray ("Running…", error, output)
 *   setPorts({inputs}) replace the input ports + labels (Text node variables)
 *   setWidth(px)       Text node grows with its longest line
 *
 *   NodeCard({ id, title, icon, cat, inputs, outputs, body, onDelete, minWidth, width, showOutput })
 *     -> { el, setRun, setPorts, setWidth }
 *     inputs/outputs: [{ id, label, top?, alwaysLabel? }]  (top: css length; default spread evenly)
 *   portTop(index, total) -> '50%' | 'NN%'     pure (tested)
 *   trayContent(run, showOutput) -> null | { kind, text }   pure (tested)
 *
 * Ports are real <button.ff-port data-handle data-node> elements (the canvas contract); labels
 * show only when several ports could be confused, or when `alwaysLabel` (variable ports).
 */
import { html } from "../util/html.js";
import { Icon } from "./icons.js";
import { Chip, Pill, setPill } from "./primitives.js";
import { categoryForIcon } from "../nodes/categories.js";

export function portTop(index, total) {
  return total <= 1 ? "50%" : `${((index + 1) / (total + 1)) * 100}%`;
}

const OUTPUT_LIMIT = 600;

export function trayContent(run, showOutput = true) {
  if (!run) return null;
  if (run.status === "running") return { kind: "running", text: "Running…" };
  if (run.status === "error") return { kind: "error", text: String(run.message ?? "") };
  if (run.status === "done" && showOutput && run.output != null && run.output !== "") {
    const s = String(run.output);
    return { kind: "done", text: s.length > OUTPUT_LIMIT ? `${s.slice(0, OUTPUT_LIMIT)}…` : s };
  }
  return null;
}

const portEl = (side, nodeId, spec, top) => html`
  <button type="button" class=${`ff-port ff-port--${side}`} data-handle=${spec.id} data-node=${nodeId}
          tabindex="-1" aria-label=${`${spec.label || spec.id} ${side === "in" ? "input" : "output"}`}
          title=${spec.label || spec.id} style=${`top:${top}`}></button>`;

const labelEl = (side, spec, top) =>
  html`<span class=${`ff-handle-label ff-handle-label--${side}`} data-port-label=${spec.id} style=${`top:${top}`}>${spec.label}</span>`;

function portNodes(side, nodeId, specs) {
  const out = [];
  specs.forEach((spec, i) => {
    const top = spec.top || portTop(i, specs.length);
    out.push(portEl(side, nodeId, spec, top));
    if ((specs.length > 1 || spec.alwaysLabel) && spec.label) out.push(labelEl(side, spec, top));
  });
  return out;
}

export function NodeCard({ id, title, icon, cat, inputs = [], outputs = [], body, onDelete,
                           minWidth = 240, width, showOutput = true }) {
  const category = cat || categoryForIcon(icon);
  let pillEl, bodyEl, tray = null, inHost, outHost;

  const sizing = (w) => `min-width:${w}px;max-width:${Math.max(w, 420)}px` + (width ? `;width:${w}px` : "");

  const el = html`
    <div class="ff-node" data-cat=${category} role="group" aria-label=${`${title} ${id}`} style=${sizing(width || minWidth)}>
      <div class="ff-node__head">
        ${Chip({ cat: category, icon })}
        <div class="ff-node__titles">
          <span class="ff-node__title">${title}</span>
          <span class="ff-node__id">${id}</span>
        </div>
        ${Pill({ status: "idle" })}
        <button type="button" class="ff-node__close nodrag" aria-label="Delete node" onclick=${onDelete}>${Icon("close", 14)}</button>
      </div>
      <div class="ff-node__body">${body}</div>
      <div class="ff-ports ff-ports--in" style="display:contents">${portNodes("in", id, inputs)}</div>
      <div class="ff-ports ff-ports--out" style="display:contents">${portNodes("out", id, outputs)}</div>
    </div>`;

  pillEl = el.querySelector(".ff-pill");
  bodyEl = el.querySelector(".ff-node__body");
  inHost = el.querySelector(".ff-ports--in");
  outHost = el.querySelector(".ff-ports--out");

  function setRun(run) {
    const status = (run && run.status) || "idle";
    setPill(pillEl, status);
    el.classList.toggle("is-running", status === "running");
    el.classList.toggle("is-error", status === "error");
    const t = trayContent(run, showOutput);
    if (!t) { if (tray) { tray.remove(); tray = null; } return; }
    if (!tray) { tray = document.createElement("div"); bodyEl.append(tray); }
    tray.className = "ff-output" + (t.kind === "error" ? " ff-output--error" : "") + (t.kind === "done" ? " nodrag nowheel" : "");
    tray.textContent = t.text;
  }

  function setPorts({ inputs: ins, outputs: outs } = {}) {
    if (ins) inHost.replaceChildren(...portNodes("in", id, ins));
    if (outs) outHost.replaceChildren(...portNodes("out", id, outs));
  }

  function setWidth(w) { el.setAttribute("style", sizing(w)); }

  return { el, setRun, setPorts, setWidth };
}
