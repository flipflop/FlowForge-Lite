/**
 * api.js (node) — API Request node body. method/url were local-only state in React; now also
 * written to the store (method, url).
 *   renderApiNode(node, ctx) -> card handle
 */
import { html } from "../util/html.js";
import { NodeCard } from "../components/NodeCard.js";
import { Field, Input } from "../components/primitives.js";
import { Select } from "../components/Select.js";
import { cardProps, HTTP_METHODS } from "./specs.js";

export function renderApiNode(node, ctx) {
  const d = node.data || {};
  const body = html`<div style="display:contents">
    ${Field({ label: "Method", control: Select({ value: d.method || "GET", options: HTTP_METHODS, onChange: (v) => ctx.onChange("method", v) }) })}
    ${Field({ label: "Endpoint URL", control: Input({ value: d.url || "", code: true, placeholder: "https://api.example.com/v1/run", onInput: (v) => ctx.onChange("url", v) }) })}
  </div>`;
  return NodeCard(cardProps(node, ctx, { body }));
}
