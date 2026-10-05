/**
 * database.js — Database node body. React kept dbType/query in local state only; here they are
 * also written to the store (dbType, query) so they reach the backend.
 *   renderDatabaseNode(node, ctx) -> card handle
 */
import { html } from "../util/html.js";
import { NodeCard } from "../components/NodeCard.js";
import { Field, Textarea } from "../components/primitives.js";
import { Select } from "../components/Select.js";
import { cardProps, DB_ENGINES } from "./specs.js";

export function renderDatabaseNode(node, ctx) {
  const d = node.data || {};
  const body = html`<div style="display:contents">
    ${Field({ label: "Engine", control: Select({ value: d.dbType || "PostgreSQL", options: DB_ENGINES, onChange: (v) => ctx.onChange("dbType", v) }) })}
    ${Field({ label: "SQL Query", control: Textarea({ value: d.query || "", rows: 3, code: true, placeholder: "SELECT * FROM users WHERE active = true;", onInput: (v) => ctx.onChange("query", v) }) })}
  </div>`;
  return NodeCard(cardProps(node, ctx, { body }));
}
