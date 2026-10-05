/**
 * filter.js — Condition Filter node body. field/condition/value were local-only in React; now
 * written to the store (field, condition, value). The Value row is hidden for "is empty" /
 * "is not empty": only that row is toggled (hidden attr), the card is not re-rendered.
 *   renderFilterNode(node, ctx) -> card handle
 */
import { html } from "../util/html.js";
import { NodeCard } from "../components/NodeCard.js";
import { Field, Input } from "../components/primitives.js";
import { Select } from "../components/Select.js";
import { cardProps, toggleRow, FILTER_CONDITIONS } from "./specs.js";

export const needsValue = (condition) => condition !== "is empty" && condition !== "is not empty";

export function renderFilterNode(node, ctx) {
  const d = node.data || {};
  let valueRow;
  const body = html`<div style="display:contents">
    ${Field({ label: "Field", control: Input({ value: d.field || "", placeholder: "status", onInput: (v) => ctx.onChange("field", v) }) })}
    ${Field({ label: "Operator", control: Select({ value: d.condition || "equals", options: FILTER_CONDITIONS,
      onChange: (v) => { ctx.onChange("condition", v); toggleRow(valueRow, needsValue(v)); } }) })}
    <div style="display:contents" ref=${(el) => (valueRow = el)}>
      ${Field({ label: "Value", control: Input({ value: d.value || "", placeholder: "active", onInput: (v) => ctx.onChange("value", v) }) })}
    </div>
  </div>`;
  toggleRow(valueRow, needsValue(d.condition || "equals"));
  return NodeCard(cardProps(node, ctx, { body }));
}
