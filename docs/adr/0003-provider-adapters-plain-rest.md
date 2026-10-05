# 0003. Provider adapters over plain REST, no vendor SDKs

Status: Accepted
Date: 2026-10-06

## Context

LLM nodes call Gemini or Claude. Both vendors ship Python SDKs, but the app only needs one operation: send a prompt, optional system text and a temperature, and get text back.

## Decision

`backend/providers.py` calls each provider's REST endpoint with `httpx`:

- Gemini: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with the key in `x-goog-api-key`.
- Claude: `POST https://api.anthropic.com/v1/messages` with `x-api-key` and `anthropic-version: 2023-06-01`.

A table, `MODELS`, maps the UI label to `(provider, model id)`. `generate()` picks the adapter, uses a 60 s timeout and 1024 output tokens, and retries up to 3 attempts with exponential backoff (1.5 s base) only on HTTP 429 and 503. HTTP 401 or 403, 404 and other errors are mapped to short `ProviderError` messages. Adding a provider means adding one function and one table row.

## Consequences

- No SDK versions to pin or update, a smaller dependency set and a smaller deployment bundle.
- We own request shapes, error mapping and retry policy, and must follow API changes ourselves. The Anthropic API version header is pinned in code.
- Features SDKs provide, such as provider-side streaming of tokens, are not used. Nodes return whole responses, so the UI shows a node's output when it completes.
- Tests mock `providers.generate` or the HTTP layer and never call the network.
