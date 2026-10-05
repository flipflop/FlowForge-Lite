/**
 * validator.js — Schema Validator node body. Writes validationType and customRegex (React kept
 * them local-only). The Pattern row is toggled in place when the type is "regex".
 *   renderValidatorNode(node, ctx) -> card handle
 */
import { html } from "../util/html.js";
import { NodeCard } from "../components/NodeCard.js";
import { Field, Input } from "../components/primitives.js";
import { Select } from "../components/Select.js";
import { cardProps, toggleRow, VALIDATION_TYPES } from "./specs.js";

export function renderValidatorNode(node, ctx) {
  const d = node.data || {};
  let patternRow;
  const body = html`<div style="display:contents">
    ${Field({ label: "Validation Type", control: Select({ value: d.validationType || "email", options: VALIDATION_TYPES,
      onChange: (v) => { ctx.onChange("validationType", v); toggleRow(patternRow, v === "regex"); } }) })}
    <div style="display:contents" ref=${(el) => (patternRow = el)}>
      ${Field({ label: "Pattern", control: Input({ value: d.customRegex || "", code: true, placeholder: "^[a-zA-Z0-9]+$", onInput: (v) => ctx.onChange("customRegex", v) }) })}
    </div>
  </div>`;
  toggleRow(patternRow, (d.validationType || "email") === "regex");
  return NodeCard(cardProps(node, ctx, { body }));
}
