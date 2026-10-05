/**
 * llm.js — LLM node body. Writes model, temperature (persisted at mount so the backend sees
 * defaults even if the controls are never touched). The temperature readout is patched via a
 * ref while dragging the slider; the card is never re-rendered.
 *   renderLlmNode(node, ctx) -> card handle
 */
import { html } from "../util/html.js";
import { NodeCard } from "../components/NodeCard.js";
import { Field } from "../components/primitives.js";
import { Select } from "../components/Select.js";
import { cardProps, persistDefaults, MODELS } from "./specs.js";

export function renderLlmNode(node, ctx) {
  const d = node.data || {};
  const model = d.model || MODELS[0];
  const temp = d.temperature ?? 0.7;
  persistDefaults(ctx, { model, temperature: temp });
  let readout;
  const slider = html`<div class="ff-field">
    <label class="ff-label">Temperature</label>
    <input type="range" min="0" max="1" step="0.1" class="nodrag" aria-label="Temperature"
           value=${String(temp)} style="width:100%"
           oninput=${(e) => { const t = parseFloat(e.target.value); readout.textContent = t.toFixed(1); ctx.onChange("temperature", t); }} />
    <div class="ff-dock__stat" style="display:flex;justify-content:space-between">
      <span>0.0</span><b ref=${(el) => (readout = el)}>${temp.toFixed(1)}</b><span>1.0</span>
    </div>
  </div>`;
  const body = html`<div style="display:contents">
    ${Field({ label: "Model", control: Select({ value: model, options: MODELS, onChange: (v) => ctx.onChange("model", v) }) })}
    ${slider}
  </div>`;
  return NodeCard(cardProps(node, ctx, { body }));
}
