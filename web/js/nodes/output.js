/**
 * output.js — Output node body. Writes outputName (result key; defaults to output_<n> and is
 * persisted at mount so the backend labels results with it) and outputType.
 *   renderOutputNode(node, ctx) -> card handle
 */
import { html } from "../util/html.js";
import { NodeCard } from "../components/NodeCard.js";
import { Field, Input } from "../components/primitives.js";
import { Select } from "../components/Select.js";
import { cardProps, defaultName, persistDefaults, OUTPUT_TYPES } from "./specs.js";

export function renderOutputNode(node, ctx) {
  const d = node.data || {};
  const name = d.outputName || defaultName(node.id);
  if (!d.outputName) persistDefaults(ctx, { outputName: name });
  const body = html`<div style="display:contents">
    ${Field({ label: "Result Key", control: Input({ value: name, placeholder: "summary_result", onInput: (v) => ctx.onChange("outputName", v) }) })}
    ${Field({ label: "Format", control: Select({ value: d.outputType || "Text", options: OUTPUT_TYPES, onChange: (v) => ctx.onChange("outputType", v) }) })}
  </div>`;
  return NodeCard(cardProps(node, ctx, { body }));
}
