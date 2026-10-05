/**
 * html.js — a tiny tagged-template component engine (no dependencies).
 *
 * The whole point: write UI as PURE FUNCTIONS that take props and return real
 * DOM nodes, using JavaScript template-literal strings of HTML — an idiomatic,
 * React-flavoured methodology, but vanilla and build-free. Each interpolation
 * is replaced by a private-use marker in the static text; a tiny HTML-subset
 * parser walks the string and builds nodes via createElement/append/
 * addEventListener — NOT innerHTML parsing — so a value can never inject markup
 * and the same code runs identically under a Node test shim.
 *
 * Ported from the Mould Assessment project's dom-util.js (window.DomUtil.html),
 * re-shaped as an ES module so it drops cleanly into any project.
 *
 *   import { h, html, mount, $ } from "./util/html.js";
 *
 *   h(tag, attrs?, ...children) -> Element
 *     attrs: { class, html, dataset, on<Event>: fn, <attr>: value }
 *
 *   html`<tag attr=${v} onclick=${fn} ref=${el=>…}>${children}</tag>` -> Element | Element[]
 *     Bindings (React-flavoured, adapted to vanilla):
 *       onclick=${fn} / @click=${fn}  -> addEventListener("click", fn)
 *       ref=${el => …}                -> invoked with the element after build
 *       .prop=${v}                    -> element[prop] = v   (e.g. .innerHTML, .value)
 *       ?attr=${bool}                 -> attribute present only when truthy
 *       name=${v} / name="a ${v}"     -> setAttribute (null/false -> omitted)
 *       ${node | node[] | string | null | false}  in body -> children
 *
 *   mount(parent, node) -> node      clear parent, append node(s), return them
 *   $(selector)         -> Element | null
 */

export function h(tag, attrs, ...children) {
  const e = document.createElement(tag);
  attrs = attrs || {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k === "dataset") Object.assign(e.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
}

// ======================================================================== //
//  html`` — tagged-template component engine                               //
// ======================================================================== //
const MARK_OPEN = String.fromCharCode(0xe000), MARK_CLOSE = String.fromCharCode(0xe001);
const MARK_ALL = MARK_OPEN + "(\\d+)" + MARK_CLOSE;   // marker body for global regexes
const MARK_SOLE = new RegExp("^" + MARK_ALL + "$");   // value is exactly one interpolation
const VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1,
  link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1 };

export function html(strings, ...values) {
  let s = "";
  for (let i = 0; i < strings.length; i++) {
    s += strings[i];
    if (i < values.length) s += MARK_OPEN + i + MARK_CLOSE;
  }
  const refs = [];
  const roots = parseTemplate(s, values, refs);
  refs.forEach((fn) => fn());                          // wire refs after the tree exists
  return roots.length === 1 ? roots[0] : roots;
}

function isWS(ch) { return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f"; }
function soleMark(raw) { const m = MARK_SOLE.exec(raw || ""); return m ? +m[1] : -1; }

// Replace every marker in a (possibly mixed static+dynamic) string with its value.
function resolveStr(raw, values) {
  return String(raw).replace(new RegExp(MARK_ALL, "g"), (_, d) => {
    const v = values[+d]; return (v == null || v === false) ? "" : String(v);
  });
}

function parseTemplate(input, values, refs) {
  const roots = [], stack = [], n = input.length;
  let pos = 0;
  const cur = () => (stack.length ? stack[stack.length - 1] : null);
  const addChild = (node) => { if (node == null) return; const p = cur(); if (p) p.append(node); else roots.push(node); };

  while (pos < n) {
    if (input[pos] === "<") {
      if (input.substr(pos, 4) === "<!--") { const e = input.indexOf("-->", pos); pos = e < 0 ? n : e + 3; continue; }
      if (input[pos + 1] === "/") { const gt = input.indexOf(">", pos); stack.pop(); pos = gt < 0 ? n : gt + 1; continue; }
      const nm = /^<([a-zA-Z][\w-]*)/.exec(input.slice(pos));
      if (!nm) { addChild(document.createTextNode("<")); pos++; continue; }
      const tag = nm[1]; pos += nm[0].length;
      const el = document.createElement(tag);
      let selfClose = false;
      for (;;) {
        while (pos < n && isWS(input[pos])) pos++;
        if (pos >= n) break;
        if (input[pos] === ">") { pos++; break; }
        if (input[pos] === "/" && input[pos + 1] === ">") { selfClose = true; pos += 2; break; }
        const am = /^([.?@]?[A-Za-z_][\w:-]*)/.exec(input.slice(pos));
        if (!am) { pos++; continue; }
        const name = am[1]; pos += am[0].length;
        while (pos < n && isWS(input[pos])) pos++;
        if (input[pos] === "=") {
          pos++;
          while (pos < n && isWS(input[pos])) pos++;
          const qc = input[pos]; let raw;
          if (qc === '"' || qc === "'") { pos++; const eq = input.indexOf(qc, pos); raw = input.slice(pos, eq < 0 ? n : eq); pos = eq < 0 ? n : eq + 1; }
          else { const um = /^[^\s>\/]*/.exec(input.slice(pos)); raw = um[0]; pos += raw.length; }
          applyAttr(el, name, raw, values, refs);
        } else {
          applyAttr(el, name, null, values, refs);
        }
      }
      addChild(el);
      if (!selfClose && !VOID[tag.toLowerCase()]) stack.push(el);
    } else {
      const lt = input.indexOf("<", pos);
      const chunk = input.slice(pos, lt < 0 ? n : lt);
      pos = lt < 0 ? n : lt;
      emitChildren(chunk, values, addChild);
    }
  }
  return roots;
}

function applyAttr(el, name, raw, values, refs) {
  if (/^on./.test(name)) {                              // onclick=${fn}
    const i = soleMark(raw); const fn = i >= 0 ? values[i] : null;
    if (typeof fn === "function") el.addEventListener(name.slice(2).toLowerCase(), fn);
    return;
  }
  if (name[0] === "@") {                                // @click=${fn}
    const i = soleMark(raw); const fn = i >= 0 ? values[i] : null;
    if (typeof fn === "function") el.addEventListener(name.slice(1).toLowerCase(), fn);
    return;
  }
  if (name === "ref") {                                 // ref=${el => …}
    const i = soleMark(raw); const fn = i >= 0 ? values[i] : null;
    if (typeof fn === "function") refs.push(() => fn(el));
    return;
  }
  if (name[0] === ".") {                                // .prop=${v}
    const i = soleMark(raw);
    el[name.slice(1)] = i >= 0 ? values[i] : resolveStr(raw, values);
    return;
  }
  if (name[0] === "?") {                                // ?attr=${bool}
    const i = soleMark(raw); const v = i >= 0 ? values[i] : raw;
    if (v) el.setAttribute(name.slice(1), "");
    return;
  }
  if (raw === null) { el.setAttribute(name, ""); return; }   // boolean attr, no '='
  const i = soleMark(raw);
  if (i >= 0) {
    const v = values[i];
    if (v == null || v === false) return;               // omit (mirrors h)
    el.setAttribute(name, v === true ? "" : String(v));
  } else {
    el.setAttribute(name, resolveStr(raw, values));
  }
}

function emitChildren(chunk, values, addChild) {
  if (chunk === "") return;
  const re = new RegExp(MARK_ALL, "g");
  let last = 0, m;
  while ((m = re.exec(chunk))) {
    if (m.index > last) addText(chunk.slice(last, m.index), addChild);
    appendValue(values[+m[1]], addChild);
    last = m.index + m[0].length;
  }
  if (last < chunk.length) addText(chunk.slice(last), addChild);
}

function addText(text, addChild) {
  if (text === "") return;
  if (text.trim() === "" && /\n/.test(text)) return;    // drop formatting-only whitespace
  addChild(document.createTextNode(text));
}

function appendValue(v, addChild) {
  if (v == null || v === false || v === true) return;
  if (Array.isArray(v)) { v.forEach((x) => appendValue(x, addChild)); return; }
  if (v.nodeType) { addChild(v); return; }
  addChild(document.createTextNode(String(v)));
}

export function $(sel, root = document) { return root.querySelector(sel); }

// Clear `parent` and append node(s). Returns what was mounted.
export function mount(parent, node) {
  if (!parent) return node;
  parent.replaceChildren();
  (Array.isArray(node) ? node : [node]).forEach((nd) => { if (nd) parent.append(nd); });
  return node;
}
