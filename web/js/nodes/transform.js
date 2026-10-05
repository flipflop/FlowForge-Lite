/**
 * transform.js — Data Transform node body. Writes transform and script (React kept them local-only).
 * The Script Body row is toggled in place when the operation is "custom".
 *   renderTransformNode(node, ctx) -> card handle
 */
import { html } from "../util/html.js";
import { NodeCard } from "../components/NodeCard.js";
import { Field, Textarea } from "../components/primitives.js";
import { Select } from "../components/Select.js";
import { cardProps, toggleRow, TRANSFORMS } from "./specs.js";

export function renderTransformNode(node, ctx) {
  const d = node.data || {};
  let scriptRow;
  const body = html`<div style="display:contents">
    ${Field({ label: "Operation", control: Select({ value: d.transform || "uppercase", options: TRANSFORMS,
      onChange: (v) => { ctx.onChange("transform", v); toggleRow(scriptRow, v === "custom"); } }) })}
    <div style="display:contents" ref=${(el) => (scriptRow = el)}>
      ${Field({ label: "Script Body", control: Textarea({ value: d.script || "", rows: 3, code: true,
        placeholder: "// input -> output\nreturn input.trim();", onInput: (v) => ctx.onChange("script", v) }) })}
    </div>
  </div>`;
  toggleRow(scriptRow, (d.transform || "uppercase") === "custom");
  return NodeCard(cardProps(node, ctx, { body }));
}
