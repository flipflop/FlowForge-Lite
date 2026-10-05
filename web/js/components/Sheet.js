/**
 * Sheet.js — modal sheets: the generic Sheet plus ValidationReport, ErrorSheet, ApiKeysSheet.
 *
 * Why: the three React modals (validation report, error, API keys) shared one scrim/sheet shell
 * and one set of behaviours; here the shell is one component and the behaviours one helper.
 *   - Sheet(...)      pure node builder (scrim > sheet with head/body/foot)
 *   - openSheet(make) lifecycle: mounts into document.body, Escape and scrim-click close,
 *                     Tab is trapped inside, focus moves in on open and RETURNS to the opener on close.
 *   - ValidationReport / ErrorSheet / ApiKeysSheet: `(props) => sheetProps` factories for openSheet.
 *     They never touch the store; ApiKeysSheet hands the cleaned keys to onSave(keys).
 *
 *   Sheet({ title, body, foot, onClose, label }) -> div.ff-scrim
 *   openSheet((close) => sheetProps) -> { close, el }
 *   ValidationReport({ result, close }) / ErrorSheet({ error, close }) /
 *   ApiKeysSheet({ keys, onSave, close }) -> { title, body, foot }
 *   cleanKeys(draft) -> object        drop blank values (pure, tested)
 */
import { html } from "../util/html.js";
import { Icon } from "./icons.js";
import { Button, Field, Input } from "./primitives.js";

export function Sheet({ title, body, foot, onClose, label }) {
  return html`
    <div class="ff-scrim" onclick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="ff-sheet" role="dialog" aria-modal="true" aria-label=${label || title}>
        <div class="ff-sheet__head">
          <h2 class="ff-sheet__title">${title}</h2>
          ${Button({ icon: "close", variant: "ghost", ariaLabel: "Close", onClick: onClose })}
        </div>
        <div class="ff-sheet__body">${body}</div>
        <div class="ff-sheet__foot">${foot}</div>
      </div>
    </div>`;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';

export function openSheet(make) {
  const opener = document.activeElement;
  let el;
  const close = () => {
    if (!el) return;
    document.removeEventListener("keydown", onKey, true);
    el.remove(); el = null;
    if (opener && opener.isConnected && opener.focus) opener.focus();
  };
  function onKey(e) {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key !== "Tab" || !el) return;
    const items = [...el.querySelectorAll(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
  el = Sheet({ ...make(close), onClose: close });
  document.body.append(el);
  document.addEventListener("keydown", onKey, true);
  const first = el.querySelector(".ff-sheet__body input") || el.querySelector(".ff-sheet__foot button") || el.querySelector("button");
  if (first) first.focus();
  return { close, el };
}

export function ValidationReport({ result, close }) {
  const ok = result.is_dag;
  return {
    title: "Pipeline Validation Report",
    body: html`<div style="display:contents">
      <div class=${`ff-banner ${ok ? "ff-banner--ok" : "ff-banner--warn"}`}>
        ${Icon(ok ? "check" : "warning", 18)}
        <div>
          <p class="ff-banner__title">${ok ? "Valid Directed Acyclic Graph (DAG)" : "Invalid DAG — Cycle Detected"}</p>
          <p class="ff-banner__text">${ok
            ? "Your pipeline flows linearly without infinite loops."
            : "The pipeline contains cyclic dependencies. Remove the loop to proceed."}</p>
        </div>
      </div>
      <div class="ff-metrics">
        ${[["NODES COUNT", result.num_nodes], ["EDGES COUNT", result.num_edges]].map(([label, value]) => html`
          <div class="ff-metric"><div class="ff-eyebrow">${label}</div><div class="ff-metric__value">${value}</div></div>`)}
      </div>
    </div>`,
    foot: Button({ label: "Close Report", variant: "primary", onClick: close }),
  };
}

export function ErrorSheet({ error, close }) {
  return {
    title: error.title,
    body: html`<div class="ff-banner ff-banner--error">
      ${Icon("warning", 18)}
      <div><p class="ff-banner__text" style="white-space:pre-line">${error.message}</p></div>
    </div>`,
    foot: Button({ label: "Dismiss", variant: "primary", onClick: close }),
  };
}

export function cleanKeys(draft) {
  return Object.fromEntries(Object.entries(draft).filter(([, v]) => v && String(v).trim()));
}

export function ApiKeysSheet({ keys = {}, onSave, close }) {
  const draft = { ...keys };
  const field = (provider, label) => Field({ label, control: Input({
    id: `ff-key-${provider}`, type: "password", autocomplete: "off", value: draft[provider] || "",
    placeholder: "Optional — leave empty to use the demo key",
    onInput: (v) => { draft[provider] = v; } }) });
  return {
    title: "Bring your own API keys",
    body: html`<div style="display:contents">
      <p class="ff-sheet__text">Without keys, runs use a rate-limited demo key. Your keys are sent only with your run requests, kept in this tab's session storage, and never stored on the server.</p>
      ${field("gemini", "Gemini API key")}
      ${field("anthropic", "Anthropic API key")}
    </div>`,
    foot: Button({ label: "Save", variant: "primary", onClick: () => { onSave(cleanKeys(draft)); close(); } }),
  };
}
