// Pure-logic tests for Agent B's modules (no DOM). Run: node --test web/tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseVariables, textNodeWidth, variablePorts, defaultName, NODE_SPECS } from "../js/nodes/specs.js";
import { handleIds } from "../js/nodes/registry.js";
import { portTop, trayContent } from "../js/components/NodeCard.js";
import { toastModel } from "../js/components/Toast.js";
import { normaliseOptions } from "../js/components/Select.js";
import { cleanKeys } from "../js/components/Sheet.js";
import { dockStatus } from "../js/components/Dock.js";
import { iconMarkup, ICON_NAMES } from "../js/components/icons.js";
import { resolveInitialTheme } from "../js/services/theme.js";
import { resolveApiUrl } from "../config.js";
import { splitFrames } from "../js/services/api.js";
import { readFileSync } from "node:fs";

test("parseVariables: unique, ordered, tolerant of spaces, word chars only", () => {
  assert.deepEqual(parseVariables("Hi {{name}} and {{ topic }} and {{name}}"), ["name", "topic"]);
  assert.deepEqual(parseVariables("{{a-b}} {{ }} {x}"), []);
  assert.deepEqual(parseVariables(undefined), []);
});

test("textNodeWidth clamps 260..480", () => {
  assert.equal(textNodeWidth(""), 260);
  assert.equal(textNodeWidth("x".repeat(200)), 480);
  assert.equal(textNodeWidth("x".repeat(40)), 340);
});

test("variablePorts: first at 62px, then 26px steps, always labelled", () => {
  const p = variablePorts("text-1", ["a", "b"]);
  assert.deepEqual(p.map((x) => x.top), ["62px", "88px"]);
  assert.deepEqual(p.map((x) => x.id), ["text-1-a", "text-1-b"]);
  assert.ok(p.every((x) => x.alwaysLabel));
});

test("handle ids match the React app for every node type", () => {
  const cases = {
    customInput: ["customInput-1-value"],
    llm: ["llm-1-system", "llm-1-prompt", "llm-1-response"],
    customOutput: ["customOutput-1-value"],
    database: ["database-1-in", "database-1-out"],
    api: ["api-1-in", "api-1-response", "api-1-error"],
    filter: ["filter-1-in", "filter-1-pass", "filter-1-fail"],
    validator: ["validator-1-in", "validator-1-valid", "validator-1-invalid"],
    transform: ["transform-1-in", "transform-1-out"],
  };
  for (const [type, ids] of Object.entries(cases)) {
    assert.deepEqual(handleIds(type, `${type}-1`), ids, type);
  }
  assert.deepEqual(handleIds("text", "text-1", { text: "{{x}} {{y}}" }), ["text-1-x", "text-1-y", "text-1-output"]);
  assert.deepEqual(handleIds("nope", "n-1"), []);
  assert.equal(Object.keys(NODE_SPECS).length, 9);
});

test("defaultName", () => {
  assert.equal(defaultName("customInput-3"), "input_3");
  assert.equal(defaultName("customOutput-1"), "output_1");
});

test("portTop spreads evenly", () => {
  assert.equal(portTop(0, 1), "50%");
  assert.equal(parseFloat(portTop(0, 2)).toFixed(2), "33.33");
  assert.equal(portTop(1, 3), "50%");
});

test("trayContent", () => {
  assert.equal(trayContent(undefined), null);
  assert.deepEqual(trayContent({ status: "running" }), { kind: "running", text: "Running…" });
  assert.deepEqual(trayContent({ status: "error", message: "boom" }), { kind: "error", text: "boom" });
  assert.equal(trayContent({ status: "done", output: "" }), null);
  assert.equal(trayContent({ status: "done", output: "hi" }, false), null);
  assert.equal(trayContent({ status: "done", output: "x".repeat(700) }).text.length, 601);
});

test("toastModel: silent on success with results, hidden, or idle", () => {
  assert.equal(toastModel({ status: "idle" }), null);
  assert.equal(toastModel({ status: "done", results: { a: 1 } }), null);
  assert.equal(toastModel({ status: "error", error: "x", hidden: true }), null);
  assert.equal(toastModel({ status: "error", error: "x" }).pill, "Run failed");
  assert.equal(toastModel({ status: "done", results: {} }).kind, "done");
});

test("misc pure helpers", () => {
  assert.deepEqual(normaliseOptions(["a", { label: "B", value: "b" }]), [{ label: "a", value: "a" }, { label: "B", value: "b" }]);
  assert.deepEqual(cleanKeys({ gemini: " ", anthropic: "k", x: "" }), { anthropic: "k" });
  assert.equal(dockStatus("idle"), null);
  assert.equal(dockStatus("running").text, "WORKING");
  assert.deepEqual(splitFrames("data: 1\n\ndata: 2\n\nda"), { frames: ["data: 1", "data: 2"], rest: "da" });
});

test("theme and api url resolution", () => {
  assert.equal(resolveInitialTheme({ search: "?theme=dark", stored: "light" }), "dark");
  assert.equal(resolveInitialTheme({ stored: "light", prefersDark: true }), "light");
  assert.equal(resolveInitialTheme({ prefersDark: true }), "dark");
  assert.equal(resolveInitialTheme({ search: "?theme=bogus" }), "light");
  assert.equal(resolveApiUrl("", {}), "http://localhost:8000");
  assert.equal(resolveApiUrl("?api=https://x.io/", {}), "https://x.io");
  // a public page must ignore ?api= (it would leak saved keys to the named host)
  assert.equal(resolveApiUrl("?api=https://evil.example", {}, "flowforge.example.com"), "");
  // public host, no override: same origin, so fetches are relative
  assert.equal(resolveApiUrl("", {}, "d111111abcdef8.cloudfront.net"), "");
  assert.equal(resolveApiUrl("", { FF_CONFIG: { API_URL: "http://a" } }), "http://a");
});

test("icons are static svg using currentColor", () => {
  for (const n of ICON_NAMES) {
    const s = iconMarkup(n, 20);
    assert.match(s, /^<svg width="20"/);
    assert.match(s, /stroke="currentColor"/);
  }
});

test("no hex colours outside tokens.css in Agent B files", () => {
  const files = ["js/main.js", "js/components/icons.js", "js/components/NodeCard.js", "js/components/Sheet.js", "index.html"];
  for (const f of files) {
    const src = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, f);
  }
});
