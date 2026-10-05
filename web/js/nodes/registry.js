/**
 * registry.js — node type -> renderer, plus the pure handle-id list.
 *
 * Why: the canvas only knows `renderNode(node, ctx)`; this is the one place that maps a node
 * type to its body renderer. handleIds() derives every port id from specs.js so the same data
 * drives rendering, edge pruning and tests.
 *
 *   renderNode(node, ctx) -> { el, setRun, setPorts, setWidth }
 *     ctx = { onChange(field, value), onDelete(), onPortsChange(handleIds) }
 *   handleIds(type, id, data) -> string[]   all input + output handle ids for a node
 */
import { NODE_SPECS } from "./specs.js";
import { renderInputNode } from "./input.js";
import { renderLlmNode } from "./llm.js";
import { renderOutputNode } from "./output.js";
import { renderTextNode } from "./text.js";
import { renderDatabaseNode } from "./database.js";
import { renderApiNode } from "./api.js";
import { renderFilterNode } from "./filter.js";
import { renderValidatorNode } from "./validator.js";
import { renderTransformNode } from "./transform.js";

const RENDERERS = {
  customInput: renderInputNode,
  llm: renderLlmNode,
  customOutput: renderOutputNode,
  text: renderTextNode,
  database: renderDatabaseNode,
  api: renderApiNode,
  filter: renderFilterNode,
  validator: renderValidatorNode,
  transform: renderTransformNode,
};

export function renderNode(node, ctx) {
  const render = RENDERERS[node.type];
  if (!render) throw new Error(`Unknown node type: ${node.type}`);
  return render(node, ctx);
}

export function handleIds(type, id, data = {}) {
  const spec = NODE_SPECS[type];
  if (!spec) return [];
  return [...spec.inputs(id, data), ...spec.outputs(id, data)].map((p) => p.id);
}
