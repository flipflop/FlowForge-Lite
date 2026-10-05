/**
 * icons.js — the icon set as TRUSTED static SVG strings (port of frontend/src/common/nodeIcons.js).
 *
 * Why: the html`` engine builds HTML elements, not SVG, so icons are set once via .innerHTML on a
 * span. That is safe only because every string here is a literal in this file — never put user
 * data into these. Colour is always `currentColor`, so the surrounding CSS decides it.
 *
 *   Icon(name, size = 16) -> span.ff-icon         (aria-hidden; wrap in a labelled button)
 *   iconMarkup(name, size) -> string              (for tests / non-DOM callers)
 *   ICON_NAMES -> string[]
 */

const wrap = (size, body, { fill = "none", sw = 1.5 } = {}) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" ` +
  `stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const DEFS = {
  input: ['<path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/><polyline points="8 11 12 15 16 11"/><line x1="12" y1="15" x2="12" y2="3"/>'],
  output: ['<path d="M21 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4"/><polyline points="16 13 12 9 8 13"/><line x1="12" y1="9" x2="12" y2="21"/>'],
  llm: ['<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/>'],
  text: ['<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="13" y1="17" x2="8" y2="17"/>'],
  database: ['<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>'],
  api: ['<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'],
  filter: ['<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'],
  validator: ['<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>'],
  transform: ['<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'],
  bolt: ['<polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'],
  check: ['<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'],
  warning: ['<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'],
  close: ['<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'],
  play: ['<polygon points="5 3 19 12 5 21 5 3"/>', { fill: "currentColor" }],
  stop: ['<rect x="6" y="6" width="12" height="12" rx="2"/>', { fill: "currentColor" }],
  sun: ['<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>', { sw: 1.75 }],
  moon: ['<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>', { sw: 1.75 }],
  trash: ['<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>', { sw: 1.75 }],
  chevron: ['<polyline points="6 9 12 15 18 9"/>', { sw: 2 }],
  paletteTop: ['<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>', { sw: 1.75 }],
  paletteLeft: ['<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/>', { sw: 1.75 }],
};

export const ICON_NAMES = Object.keys(DEFS);

export function iconMarkup(name, size = 16) {
  const [body, opts] = DEFS[name] || DEFS.input;
  return wrap(size, body, opts);
}

export function Icon(name, size = 16) {
  const el = document.createElement("span");
  el.className = "ff-icon";
  el.style.display = "inline-flex";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = iconMarkup(name, size); // trusted static strings only
  return el;
}
