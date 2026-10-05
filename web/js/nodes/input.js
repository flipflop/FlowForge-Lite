/**
 * input.js — Input node body. Writes inputName, value, inputType (same fields as React).
 * Why: `value` is what the backend feeds downstream; inputName defaults to input_<n> and is
 * persisted at mount even if the user never edits it.
 *   renderInputNode(node, ctx) -> { el, setRun, setPorts, setWidth }
 */
import { html } from "../util/html.js";
import { NodeCard } from "../components/NodeCard.js";
import { Field, Input, Textarea } from "../components/primitives.js";
import { Select } from "../components/Select.js";
import { cardProps, defaultName, persistDefaults, INPUT_TYPES } from "./specs.js";

export function renderInputNode(node, ctx) {
  const d = node.data || {};
  const name = d.inputName || defaultName(node.id);
  if (!d.inputName) persistDefaults(ctx, { inputName: name });
  const body = html`<div style="display:contents">
    ${Field({ label: "Variable Name", control: Input({ value: name, placeholder: "user_query", onInput: (v) => ctx.onChange("inputName", v) }) })}
    ${Field({ label: "Value (runtime input)", control: Textarea({ value: d.value || "", rows: 2, placeholder: "Text passed into the pipeline", onInput: (v) => ctx.onChange("value", v) }) })}
    ${Field({ label: "Type", control: Select({ value: d.inputType || "Text", options: INPUT_TYPES, onChange: (v) => ctx.onChange("inputType", v) }) })}
  </div>`;
  return NodeCard(cardProps(node, ctx, { body, showOutput: false }));
}
