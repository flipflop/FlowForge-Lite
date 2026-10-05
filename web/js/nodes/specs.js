/**
 * specs.js — pure, DOM-free description of every node type.
 *
 * Why: handle ids are a contract with the backend (and with saved edges), so they are defined
 * once, here, as data you can unit-test without a browser. Node renderers read titles, icons
 * and ports from NODE_SPECS; registry.handleIds() derives the full id list from the same source.
 *
 *   NODE_SPECS[type] -> { title, icon, minWidth, inputs(id, data), outputs(id, data) }
 *   parseVariables(text) -> string[]          unique {{ var }} names in order of appearance
 *   textNodeWidth(text)  -> number            260..480 depending on the longest line
 *   variablePorts(id, vars) -> port specs     first at 62px, then every 26px, always labelled
 *   defaultName(id) -> string                 'customInput-3' -> 'input_3', 'customOutput-1' -> 'output_1'
 *   persistDefaults(ctx, fields)              write defaults to the store AFTER the card is mounted
 *   Option lists copied verbatim from the React nodes.
 */

export const VAR_REGEX = /\{\{\s*(\w+)\s*\}\}/g;
export const VAR_HANDLE_START = 62;   // below the taller header
export const VAR_HANDLE_STEP = 26;

export const MODELS = ["Gemini 3.5 Flash", "Claude Sonnet 5.5", "Claude Haiku 4.5"];
export const INPUT_TYPES = ["Text", "File", "Number"];
export const OUTPUT_TYPES = ["Text", "Image", "File"];
export const DB_ENGINES = ["PostgreSQL", "MySQL", "SQLite", "MongoDB"];
export const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
export const FILTER_CONDITIONS = ["equals", "not equals", "contains", "not contains", "starts with", "ends with", "greater than", "less than", "is empty", "is not empty"];
export const TRANSFORMS = [
  { label: "To Uppercase", value: "uppercase" },
  { label: "To Lowercase", value: "lowercase" },
  { label: "Trim Whitespace", value: "trim" },
  { label: "Parse JSON", value: "parse-json" },
  { label: "Stringify JSON", value: "stringify" },
  { label: "Base64 Encode", value: "b64-encode" },
  { label: "Base64 Decode", value: "b64-decode" },
  { label: "Custom Script", value: "custom" },
];
export const VALIDATION_TYPES = [
  { label: "Email", value: "email" },
  { label: "URL", value: "url" },
  { label: "Phone", value: "phone" },
  { label: "Number", value: "number" },
  { label: "Date", value: "date" },
  { label: "JSON", value: "json" },
  { label: "Non-empty", value: "non-empty" },
  { label: "Custom Regex", value: "regex" },
];

export function parseVariables(text) {
  const names = [...String(text || "").matchAll(VAR_REGEX)].map((m) => m[1]);
  return [...new Set(names)];
}

export function textNodeWidth(text) {
  const longest = Math.max(...String(text || "").split("\n").map((l) => l.length), 20);
  return Math.min(480, Math.max(260, longest * 7 + 60));
}

export function variablePorts(id, vars) {
  return vars.map((v, i) => ({
    id: `${id}-${v}`, label: v, top: `${VAR_HANDLE_START + i * VAR_HANDLE_STEP}px`, alwaysLabel: true,
  }));
}

export function defaultName(id) {
  return id.replace("customInput-", "input_").replace("customOutput-", "output_");
}

export function persistDefaults(ctx, fields) {
  // Deferred: the canvas is mid-render when a card is built; a store write now would re-enter it.
  queueMicrotask(() => { for (const [k, v] of Object.entries(fields)) ctx.onChange(k, v); });
}

const one = (suffix, label) => (id) => [{ id: `${id}-${suffix}`, label }];

export const NODE_SPECS = {
  customInput: { title: "Input", icon: "input", minWidth: 240,
    inputs: () => [], outputs: one("value", "value") },
  llm: { title: "LLM Engine", icon: "llm", minWidth: 260,
    inputs: (id) => [{ id: `${id}-system`, label: "system" }, { id: `${id}-prompt`, label: "prompt" }],
    outputs: one("response", "response") },
  customOutput: { title: "Output", icon: "output", minWidth: 240,
    inputs: one("value", "value"), outputs: () => [] },
  text: { title: "Text Template", icon: "text", minWidth: 260,
    inputs: (id, data) => variablePorts(id, parseVariables(data && data.text)),
    outputs: one("output", "output") },
  database: { title: "Database Query", icon: "database", minWidth: 250,
    inputs: one("in", "params"), outputs: one("out", "rows") },
  api: { title: "API Request", icon: "api", minWidth: 250,
    inputs: one("in", "payload"),
    outputs: (id) => [{ id: `${id}-response`, label: "response" }, { id: `${id}-error`, label: "error" }] },
  filter: { title: "Condition Filter", icon: "filter", minWidth: 250,
    inputs: one("in", "input"),
    outputs: (id) => [{ id: `${id}-pass`, label: "pass" }, { id: `${id}-fail`, label: "fail" }] },
  validator: { title: "Schema Validator", icon: "validator", minWidth: 250,
    inputs: one("in", "input"),
    outputs: (id) => [{ id: `${id}-valid`, label: "valid" }, { id: `${id}-invalid`, label: "invalid" }] },
  transform: { title: "Data Transform", icon: "transform", minWidth: 250,
    inputs: one("in", "raw"), outputs: one("out", "transformed") },
};

/** Common NodeCard props for a node, from its spec. */
export function cardProps(node, ctx, extra = {}) {
  const spec = NODE_SPECS[node.type];
  return {
    id: node.id, title: spec.title, icon: spec.icon, minWidth: spec.minWidth,
    inputs: spec.inputs(node.id, node.data), outputs: spec.outputs(node.id, node.data),
    onDelete: ctx.onDelete, ...extra,
  };
}

/** Show/hide a conditional row. (`hidden` can't be used: the rows are display:contents, which beats the UA [hidden] rule.) */
export function toggleRow(el, show) { el.style.display = show ? "contents" : "none"; }
