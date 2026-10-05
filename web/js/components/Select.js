/**
 * Select.js — the custom `.ff-select` dropdown (port of common/CustomSelect.js).
 *
 * Why: native <select> menus can't be styled to the clay look. This keeps native semantics where
 * it matters: a real <button> trigger (aria-haspopup/expanded), role=listbox options, keyboard
 * (ArrowUp/Down, Home/End, Enter/Space select, Escape closes and returns focus, Tab closes),
 * and click-outside to close. State is local to the control — the owning node gets onChange only.
 *
 *   Select({ value, options, onChange, ariaLabel }) -> div.ff-select
 *     options: string[] | { label, value }[]
 *   normaliseOptions(options) -> { label, value }[]   (pure, tested)
 */
import { html } from "../util/html.js";
import { Icon } from "./icons.js";

export function normaliseOptions(options) {
  return options.map((o) => (typeof o === "string" ? { label: o, value: o } : o));
}

export function Select({ value, options, onChange, ariaLabel }) {
  const opts = normaliseOptions(options);
  let current = value;
  let root, trigger, labelEl, menu = null;

  const labelFor = (v) => (opts.find((o) => o.value === v) || {}).label ?? v;

  const onDocDown = (e) => { if (!root.contains(e.target)) close(false); };

  function close(refocus) {
    if (!menu) return;
    menu.remove(); menu = null;
    trigger.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", onDocDown, true);
    if (refocus) trigger.focus();
  }

  function pick(v) {
    current = v;
    labelEl.textContent = labelFor(v);
    close(true);
    if (onChange) onChange(v);
  }

  function open() {
    if (menu) return;
    menu = html`<div class="ff-select__menu nodrag nowheel" role="listbox">
      ${opts.map((o) => html`<div role="option" tabindex="-1" aria-selected=${o.value === current ? "true" : "false"}
                                  class="ff-select__option" data-value=${o.value}
                                  onclick=${() => pick(o.value)}>${o.label}</div>`)}
    </div>`;
    root.append(menu);
    trigger.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("mousedown", onDocDown, true);
    const items = [...menu.children];
    (items.find((el) => el.getAttribute("aria-selected") === "true") || items[0])?.focus();
  }

  function onKey(e) {
    if (e.key === "Escape" && menu) { e.stopPropagation(); close(true); return; }
    if (!menu) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); }
      return;
    }
    const items = [...menu.children];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[Math.min(items.length - 1, i + 1)]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[Math.max(0, i - 1)]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (i >= 0) pick(items[i].dataset.value); }
    else if (e.key === "Tab") close(false);
  }

  root = html`
    <div class="ff-select" onkeydown=${onKey}>
      <button type="button" class="ff-select__trigger" aria-haspopup="listbox" aria-expanded="false"
              aria-label=${ariaLabel} ref=${(el) => (trigger = el)} onclick=${() => (menu ? close(true) : open())}>
        <span ref=${(el) => (labelEl = el)}>${labelFor(current)}</span>
        ${Icon("chevron", 12)}
      </button>
    </div>`;
  return root;
}
