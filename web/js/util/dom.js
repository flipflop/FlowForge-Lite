/**
 * dom.js — small, shared DOM utilities (no dependencies).
 * Companion to html.js (the component engine). Kept separate so services and
 * non-view code can import these without pulling in the template parser.
 */

export const byId = (id) => document.getElementById(id);

// Null-safe text update — no-op if the element is absent.
export const setText = (el, text) => { if (el) el.textContent = text ?? ""; };

// Toggle a class, null-safe.
export const toggleClass = (el, name, on) => { if (el) el.classList.toggle(name, !!on); };

// Escape a string destined for innerHTML interpolation. (The html`` engine builds
// text nodes and never needs this, but raw innerHTML sinks — e.g. an SVG string — do.)
export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// requestAnimationFrame-throttled callback: coalesces bursty calls into one paint.
export function rafThrottle(fn) {
  let scheduled = false, lastArgs;
  return (...args) => {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; fn(...lastArgs); });
  };
}
