/**
 * Toast.js — post-run notice (port of ResultsPanel in run.js).
 *
 * Why: on success the Output node already shows the result, so the toast is only for failures and
 * for pipelines with no Output node. toastModel() holds that decision as a pure function; Toast()
 * only draws it. main.js mounts the result into a persistent role=status/aria-live host so it is
 * announced.
 *
 *   toastModel({ status, results, error, hidden }) -> null | { kind: 'done'|'error', pill, message }
 *   Toast({ model, onDismiss }) -> div.ff-toast.ff-glass
 */
import { html } from "../util/html.js";
import { Button } from "./primitives.js";

export function toastModel({ status, results, error, hidden = false }) {
  const hasResults = Object.keys(results || {}).length > 0;
  if (hidden || (status !== "done" && status !== "error") || (status === "done" && hasResults)) return null;
  return status === "error"
    ? { kind: "error", pill: "Run failed", message: error }
    : { kind: "done", pill: "Run finished", message: "Run finished. Add an Output node to capture a result." };
}

export function Toast({ model, onDismiss }) {
  return html`
    <div class="ff-toast ff-glass" style="left:72px">
      <div class="ff-toast__head">
        <span class=${`ff-pill ${model.kind === "done" ? "ff-pill--done" : "ff-pill--error"}`}>${model.pill}</span>
        ${Button({ icon: "close", variant: "ghost", size: "sm", ariaLabel: "Dismiss", onClick: onDismiss })}
      </div>
      <div class="ff-toast__body"><p style="margin:0">${model.message}</p></div>
    </div>`;
}
