# 0001. Server-sent events over WebSockets for run progress

Status: Accepted
Date: 2026-10-06

## Context

A pipeline run executes nodes one after another, and each LLM call can take seconds. The browser needs to show which node is running and its output as soon as it finishes, rather than waiting for the whole run. Traffic is one-way during a run: the browser sends the pipeline once, and the server sends progress events.

## Decision

`POST /pipelines/run` returns `text/event-stream`. The engine (`backend/engine.py`) is an async generator that yields events (`run_start`, `node_start`, `node_done`, `node_error`, `run_done`, `run_error`). `main.py` frames each as `data: <json>` followed by a blank line and sets `Cache-Control: no-cache` and `X-Accel-Buffering: no`.

The client (`web/js/services/api.js`) reads the stream with `fetch` and a `ReadableStream` reader, splitting frames with `splitFrames()`. It does not use `EventSource`, because `EventSource` can only issue GET requests and the run needs a JSON body. Stop is an `AbortController` passed to `fetch`.

## Consequences

- Simpler than WebSockets for a one-way stream: plain HTTP, no handshake or message protocol, and it passes through ordinary proxies.
- The README states that SSE "reconnects cleanly". Because the client uses `fetch` instead of `EventSource`, there is no automatic reconnect, and a dropped connection ends the run with an error. The README no longer claims reconnects.
- Any hop between the server and the browser must not buffer the response, or events arrive in a burst. `X-Accel-Buffering: no` covers nginx-style proxies; other intermediaries need response streaming enabled (see ADR 0007).
- The client cannot send anything mid-run. Cancelling works only by closing the connection. [TK: whether the server stops calling the provider after a client disconnect.]
