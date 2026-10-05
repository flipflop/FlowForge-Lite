/**
 * theme.js — light/dark theme service (no components). Port of frontend/src/theme.js.
 *
 * Why: theme lives on <html data-theme> so tokens.css can switch every colour at once. Initial
 * value precedence: ?theme= > localStorage 'ff-theme' > prefers-color-scheme. The toggle adds
 * `ff-theme-anim` for 300 ms so only colour properties animate (docs/design.md).
 *
 *   resolveInitialTheme({ search, stored, prefersDark }) -> 'light' | 'dark'   (pure, tested)
 *   initTheme() -> theme              apply the initial theme to <html>
 *   getTheme() -> theme
 *   toggleTheme() -> theme            flip, persist (try/catch), animate, notify
 *   onThemeChange(fn) -> unsubscribe  fn(theme)
 */
const KEY = "ff-theme";
const valid = (t) => t === "light" || t === "dark";
const listeners = new Set();
let current = "light";

export function resolveInitialTheme({ search = "", stored = null, prefersDark = false } = {}) {
  let q = null;
  try { q = new URLSearchParams(search).get("theme"); } catch { /* ignore */ }
  if (valid(q)) return q;
  if (valid(stored)) return stored;
  return prefersDark ? "dark" : "light";
}

export function initTheme() {
  let stored = null, prefersDark = false;
  try { stored = localStorage.getItem(KEY); } catch { /* ignore */ }
  try { prefersDark = matchMedia("(prefers-color-scheme: dark)").matches; } catch { /* ignore */ }
  current = resolveInitialTheme({ search: location.search, stored, prefersDark });
  document.documentElement.dataset.theme = current;
  return current;
}

export const getTheme = () => current;

export function toggleTheme() {
  const root = document.documentElement;
  root.classList.add("ff-theme-anim");
  setTimeout(() => root.classList.remove("ff-theme-anim"), 300);
  current = current === "dark" ? "light" : "dark";
  root.dataset.theme = current;
  try { localStorage.setItem(KEY, current); } catch { /* ignore */ }
  listeners.forEach((fn) => fn(current));
  return current;
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
