/**
 * Palette.js — the keys you drag onto the bench.
 *
 * Why: drag-and-drop is the primary way to add nodes, but it is mouse-only, so each key is also a
 * focusable button-like element: Enter/Space calls onAdd(type) and main.js drops the node at the
 * canvas centre. Drag sets dataTransfer 'application/x-ff-node' = node type (canvas contract).
 *
 *   Palette({ layout, onAdd }) -> div.ff-palette--top|--side
 *   NODE_GROUPS -> [{ label, nodes:[{ type, label, iconKey }] }]   (verbatim from toolbar.js)
 */
import { html } from "../util/html.js";
import { Chip } from "./primitives.js";
import { categoryForNodeType } from "../nodes/categories.js";

export const DRAG_TYPE = "application/x-ff-node";

export const NODE_GROUPS = [
  { label: "Core", nodes: [
    { type: "customInput", label: "Input", iconKey: "input" },
    { type: "llm", label: "LLM", iconKey: "llm" },
    { type: "customOutput", label: "Output", iconKey: "output" },
    { type: "text", label: "Text", iconKey: "text" },
  ] },
  { label: "Utilities", nodes: [
    { type: "database", label: "Database", iconKey: "database" },
    { type: "api", label: "API Call", iconKey: "api" },
    { type: "filter", label: "Filter", iconKey: "filter" },
    { type: "validator", label: "Validator", iconKey: "validator" },
    { type: "transform", label: "Transform", iconKey: "transform" },
  ] },
];

function Key({ type, label, iconKey, onAdd }) {
  const cat = categoryForNodeType(type);
  return html`
    <div id=${`draggable-${type}`} class="ff-key" data-cat=${cat} draggable="true" role="button" tabindex="0"
         aria-label=${`Add ${label} node`} title=${`Drag to add ${label}`}
         ondragstart=${(e) => { e.dataTransfer.setData(DRAG_TYPE, type); e.dataTransfer.effectAllowed = "move"; }}
         onkeydown=${(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (onAdd) onAdd(type); } }}>
      ${Chip({ cat, icon: iconKey, size: "lg" })}
      <span class="ff-key__label">${label}</span>
    </div>`;
}

export function Palette({ layout = "top", onAdd }) {
  return html`
    <div class=${`ff-palette ff-palette--${layout === "side" ? "side" : "top"}`} role="toolbar" aria-label="Node palette">
      <div class="ff-palette__scroll">
        ${NODE_GROUPS.map((g) => html`
          <div class="ff-palette__group">
            <span class="ff-eyebrow ff-palette__label">${g.label}</span>
            <div class="ff-palette__keys">${g.nodes.map((n) => Key({ ...n, onAdd }))}</div>
          </div>`)}
      </div>
    </div>`;
}
