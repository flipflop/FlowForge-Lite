/**
 * primitives.js — the small, stateless building blocks (props in, DOM node out).
 *
 * Why: every screen is composed from the same few clay parts (docs/design.md). Keeping them in
 * one file makes the vocabulary visible and keeps class names (fixed by app.css) in one place.
 * None of these touch the store; callers pass callbacks.
 *
 *   Button({ label, icon, iconSize, variant, size, onClick, badge, running, ariaLabel, title, id, disabled })
 *   Segmented({ options:[{value,icon,ariaLabel}], value, onChange, ariaLabel })
 *   Chip({ cat, icon, size })            Pill({ status })      setPill(el, status)
 *   Field({ label, control })            Input({...})          Textarea({...})
 *   VarTag({ name })                     uid(prefix)
 *   PILL -> { idle|running|done|error: { cls, text } }
 */
import { html } from "../util/html.js";
import { Icon } from "./icons.js";
import { categoryForIcon } from "../nodes/categories.js";

let seq = 0;
export const uid = (prefix = "ff") => `${prefix}-${++seq}`;

export const PILL = {
  idle:    { cls: "",                 text: "READY" },
  running: { cls: "ff-pill--running", text: "WORKING" },
  done:    { cls: "ff-pill--done",    text: "DONE" },
  error:   { cls: "ff-pill--error",   text: "ERROR" },
};

export function Button({ label, icon, iconSize = 14, variant, size, onClick, badge, running = false,
                         ariaLabel, title, id, disabled = false, ariaPressed, type = "button" }) {
  const cls = ["ff-btn",
    variant ? `ff-btn--${variant}` : "",
    size ? `ff-btn--${size}` : "",
    label ? "" : "ff-btn--icon",
    running ? "is-running" : ""].filter(Boolean).join(" ");
  return html`
    <button type=${type} id=${id} class=${cls} ?disabled=${disabled} aria-label=${ariaLabel} title=${title}
            data-focus=${id} aria-pressed=${ariaPressed} onclick=${onClick}>
      ${icon ? Icon(icon, iconSize) : null}
      ${label ? label : null}
      ${badge ? html`<span class="ff-btn__badge">${badge}</span>` : null}
    </button>`;
}

export function Segmented({ options, value, onChange, ariaLabel }) {
  return html`
    <div class="ff-seg" role="group" aria-label=${ariaLabel}>
      ${options.map((o) => html`
        <button type="button" aria-pressed=${o.value === value ? "true" : "false"}
                aria-label=${o.ariaLabel} title=${o.ariaLabel} onclick=${() => onChange(o.value)}>
          ${Icon(o.icon, 16)}
        </button>`)}
    </div>`;
}

export function Chip({ cat, icon, size = "sm" }) {
  const c = cat || categoryForIcon(icon);
  return html`<span class=${"ff-chip" + (size === "sm" ? " ff-chip--sm" : "")} data-cat=${c}>${Icon(icon, size === "sm" ? 16 : 18)}</span>`;
}

export function Pill({ status = "idle" }) {
  const p = PILL[status] || PILL.idle;
  return html`<span class=${("ff-pill " + p.cls).trim()}>${p.text}</span>`;
}

/** Patch an existing pill element in place (used by node cards on every run event). */
export function setPill(el, status) {
  const p = PILL[status] || PILL.idle;
  el.className = ("ff-pill " + p.cls).trim();
  el.textContent = p.text;
}

/** Label + control. Wires the label to the control for screen readers (for=, or aria-labelledby for .ff-select). */
export function Field({ label, control }) {
  const labelId = uid("ff-lbl");
  const lbl = html`<label class="ff-label" id=${labelId}>${label}</label>`;
  if (control && /^(INPUT|TEXTAREA)$/.test(control.tagName)) {
    if (!control.id) control.id = uid("ff-ctl");
    lbl.htmlFor = control.id;
  } else if (control && control.querySelector) {
    const trigger = control.querySelector(".ff-select__trigger");
    if (trigger) trigger.setAttribute("aria-labelledby", labelId);
  }
  return html`<div class="ff-field">${lbl}${control}</div>`;
}

export function Input({ value = "", placeholder, code = false, type = "text", onInput, id, ariaLabel, autocomplete, extraClass = "" }) {
  return html`
    <input type=${type} id=${id} class=${("ff-input" + (code ? " ff-input--code" : "") + " " + extraClass).trim()}
           .value=${value} placeholder=${placeholder} aria-label=${ariaLabel} autocomplete=${autocomplete}
           oninput=${onInput ? (e) => onInput(e.target.value, e) : null} />`;
}

export function Textarea({ value = "", placeholder, code = false, rows, autosize = false, minHeight = 72, onInput, ariaLabel }) {
  const fit = (el) => { el.style.height = "auto"; el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`; };
  return html`
    <textarea class=${"ff-textarea" + (code ? " ff-textarea--code" : "") + " nodrag nowheel"}
              rows=${rows} placeholder=${placeholder} aria-label=${ariaLabel}
              style=${autosize ? `resize:none;min-height:${minHeight}px` : null}
              .value=${value}
              ref=${autosize ? (el) => requestAnimationFrame(() => fit(el)) : null}
              oninput=${(e) => { if (autosize) fit(e.target); if (onInput) onInput(e.target.value, e); }}></textarea>`;
}

export function VarTag({ name }) {
  return html`<span class="ff-var">{{ ${name} }}</span>`;
}
