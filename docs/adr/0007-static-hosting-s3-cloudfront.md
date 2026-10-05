# 0007. Static site and API on one CloudFront distribution (S3 + Lambda), single SAM stack

Status: Accepted
Date: 2026-10-06

## Context

The original fork was hosted on a static host for the frontend and a free-tier web service for the backend. That left two public origins, so the browser made cross-origin requests and the backend needed CORS. The free tier slept when idle, and the frontend could not state a tight Content-Security-Policy without naming the other origin. We wanted one place to deploy, one origin for the browser, and a backend that streams SSE (ADR 0001).

## Decision

Run both on AWS behind a single CloudFront distribution, defined in one SAM template (`deploy/template.yaml`) and released by `deploy/deploy.sh`.

- Static files live in a private S3 bucket that CloudFront reads through Origin Access Control. This is the default behaviour, with caching on.
- The FastAPI backend runs on AWS Lambda (Python 3.12, arm64). The AWS Lambda Web Adapter layer runs uvicorn inside the function. A Lambda Function URL with invoke mode `RESPONSE_STREAM` lets SSE frames stream to the client.
- CloudFront routes `/pipelines/*`, `/models` and `/health` to the Function URL origin with caching disabled. Everything else goes to S3.
- CloudFront adds a secret `x-origin-verify` header to API requests, and the backend rejects requests without it, so the Function URL cannot be called directly.
- The browser uses same-origin relative URLs. There is no CORS in production, and the CSP can use `connect-src 'self'`.
- Optional server demo keys are SSM Parameter Store SecureStrings under a prefix, read lazily by the function. They are never in environment variables or git. User keys still travel with each run (ADR 0004).
- The per-IP rate limit keys on the `CloudFront-Viewer-Address` header. Reserved concurrency caps total spend.
- `deploy.sh` checks the caller identity, builds the arm64 bundle, runs `sam deploy`, syncs `web/` to S3 and invalidates CloudFront. `deploy/set-secrets.sh` writes the demo keys and `deploy/teardown.sh` removes the stack. Local development is unchanged.

### Alternatives considered

- **Keep the original split (static host plus free-tier web service).** Two origins, CORS, idle sleep. Rejected for the reasons above.
- **API Gateway HTTP API in front of Lambda.** It does not stream responses and has a 30 second integration limit, which breaks SSE and long multi-node runs.
- **Lambda Function URL called directly from the browser, with CORS.** Streams, but adds a second origin, needs CORS, forces a wider CSP and exposes the function URL to anyone.
- **ECS or App Runner.** Handle streaming and keep a warm process, but cost a baseline fee and more infrastructure for a service that is idle most of the time. [TK: cost comparison if this is revisited.]

## Consequences

- Cold starts: the first request after idle pays a container start. [TK: measured cold-start time.]
- The rate limit is per Lambda container, in memory. It resets when a container recycles and each concurrent container counts separately, so it is a brake, not a quota. A shared store would be needed for a strict limit.
- Reserved concurrency bounds spend and also caps simultaneous runs, so heavy use returns errors instead of cost. Defaults: 5 concurrent executions, 300 s function timeout, 512 MB. CloudFront's 60 s origin read timeout applies between bytes of the stream.
- Cost is pay-per-use for Lambda and CloudFront and storage cents for S3; there is no idle compute bill. [TK: expected monthly figure.]
- One stack and one script mean a single deploy path and a single teardown. The cost is that the SAM template must stay in step with the application (header names, paths).
- The origin-verify secret is a shared secret and needs a rotation process. To rotate, delete `ORIGIN_VERIFY_SECRET` from the local `deploy/deploy.env` and run `deploy/deploy.sh`; it generates a new value and updates CloudFront and the function in the same stack update.
- The frontend and backend deploy together, so a frontend-only change still goes through the same script (`s3 sync` plus invalidation, optionally skipping the stack step).
