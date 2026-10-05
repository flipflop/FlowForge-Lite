/**
 * config.js — single source of truth for deploy-time tunables.
 *
 * Why: with no build step the backend URL is resolved at load time. In production the API is
 * served from the same CloudFront distribution as the page, so requests are same-origin and
 * relative. Precedence (first wins):
 *   1. `window.FF_CONFIG.API_URL` — set by the host page (inline script) for custom deploys
 *   2. `?api=https://host`        — ONLY when the page itself is served from localhost. On a public
 *                                   host this is ignored: a crafted link must never be able to send
 *                                   a user's saved API keys to someone else's server.
 *   3. local page  → http://localhost:8000 (the `uvicorn main:app` default)
 *      public page → "" (same origin: fetches are relative, e.g. "/pipelines/run")
 *
 *   export const API_URL: string
 *   export function resolveApiUrl(search, win, hostname) -> string   (pure; exported for tests)
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", ""]);

export function resolveApiUrl(search = "", win = {}, hostname = "localhost") {
  const local = LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost");
  let fromQuery = null;
  if (local) {
    try { fromQuery = new URLSearchParams(search).get("api"); } catch { /* ignore */ }
  }
  const raw = (win.FF_CONFIG && win.FF_CONFIG.API_URL) || fromQuery
    || (local ? "http://localhost:8000" : "");
  return String(raw).replace(/\/+$/, "");
}

export const API_URL = resolveApiUrl(
  typeof location !== "undefined" ? location.search : "",
  typeof window !== "undefined" ? window : {},
  typeof location !== "undefined" ? location.hostname : "localhost",
);
