# 0004. Bring-your-own keys in sessionStorage, server fallback behind a per-IP rate limit

Status: Accepted
Date: 2026-10-06

## Context

A public demo should work without sign-up, but unlimited use of the maintainer's provider keys would be an open bill. Visitors who bring their own keys should not be limited, and their keys must not end up in logs, in the repository or on the server.

## Decision

- The API Keys sheet stores `{gemini?, anthropic?}` in the store and in `sessionStorage` under `ff-keys` (per tab, cleared with the tab session; `main.js` falls back to it when the sheet opens).
- Keys are sent only in the `api_keys` field of the `POST /pipelines/run` body. The backend uses them for that request and does not log or store them. `/pipelines/parse` does not receive them.
- For each LLM node, `resolve_key(provider)` in `main.py` uses the request key if present. Otherwise it reads `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` from the server environment and applies `_allow(ip)`: a sliding one-hour window per client IP, `RUNS_PER_HOUR` calls (default 10). The limit counts server-key LLM calls, not whole runs, and requests that carry a user key are not counted.
- `?api=` can redirect the frontend to another backend only when the page itself is served from localhost, so a crafted link cannot send a visitor's keys to another host.

## Consequences

- Visitors with their own keys are unlimited and never expose them to persistent storage on the server.
- The rate limit lives in process memory. It resets on restart and is per instance or container, so scaling out multiplies the allowance. A shared store such as Redis is the documented fix. See ADR 0007 for how the deployed function changes this.
- The client IP is only as trustworthy as the proxy chain in front of the app. Behind CloudFront the backend keys the limit on the `CloudFront-Viewer-Address` header, falling back to the first `X-Forwarded-For` entry, and only trusts these when the request carries the origin-verify secret, i.e. it came through the distribution. Locally it uses the socket peer. The limiter is in memory per Lambda container, so it is a soft limit; reserved concurrency is the hard cap.
- `sessionStorage` is readable by any script on the origin. This is why the frontend carries no third-party code (ADR 0006).
