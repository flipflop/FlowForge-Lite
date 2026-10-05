/**
 * text.js — Text Template node. Writes `text`. The only node whose ports change after mount:
 * on each keystroke we recompute {{variables}}, and ONLY if the list changed we patch the
 * variable chips + input ports through the card handle, widen the card, and call
 * ctx.onPortsChange(all handle ids) so main can prune edges to deleted variables.
 * The textarea itself is never re-rendered (focus/caret).
 *   renderTextNode(node, ctx) -> card handle
 */
import { html } from "../util/html.js";
import { NodeCard } from "../components/NodeCard.js";
import { Field, Textarea, VarTag } from "../components/primitives.js";
import { cardProps, parseVariables, textNodeWidth, variablePorts } from "./specs.js";

export function renderTextNode(node, ctx) {
  const text0 = (node.data && node.data.text) || "";
  let vars = parseVariables(text0);
  let chipHost;

  const chips = () => (vars.length
    ? html`<div class="ff-field"><span class="ff-label">Variables</span>
        <div class="ff-vars">${vars.map((v) => VarTag({ name: v }))}</div></div>`
    : null);

  const body = html`<div style="display:contents">
    ${Field({ label: "Template Prompt", control: Textarea({
      value: text0, code: true, autosize: true, placeholder: "Summarize this: {{user_query}}",
      onInput: (v) => onText(v) }) })}
    <div style="display:contents" ref=${(el) => (chipHost = el)}>${chips()}</div>
  </div>`;

  const card = NodeCard(cardProps(node, ctx, { body, width: textNodeWidth(text0), minWidth: textNodeWidth(text0) }));

  function onText(value) {
    ctx.onChange("text", value);
    card.setWidth(textNodeWidth(value));
    const next = parseVariables(value);
    if (next.join("\u0000") === vars.join("\u0000")) return;
    vars = next;
    chipHost.replaceChildren(...[chips()].flat().filter(Boolean));
    card.setPorts({ inputs: variablePorts(node.id, vars) });
    ctx.onPortsChange([`${node.id}-output`, ...vars.map((v) => `${node.id}-${v}`)]);
  }

  return card;
}
