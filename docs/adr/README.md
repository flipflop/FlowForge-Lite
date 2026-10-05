# Architecture decision records

Format: Title, Status, Date, Context, Decision, Consequences (after Michael Nygard). Open questions are written as `[TK: question]`. The visual overview is in [../architecture.html](../architecture.html).

| # | Decision | Status |
|---|---|---|
| [0001](0001-sse-over-websockets.md) | Server-sent events over WebSockets for run progress | Accepted |
| [0002](0002-kahn-topological-order.md) | Kahn's algorithm for ordering and cycle detection | Accepted |
| [0003](0003-provider-adapters-plain-rest.md) | Provider adapters over plain REST, no vendor SDKs | Accepted |
| [0004](0004-bring-your-own-keys.md) | Bring-your-own keys in sessionStorage, server fallback behind a per-IP rate limit | Accepted |
| [0005](0005-clay-workbench-design-system.md) | Clay Workbench design system and design tokens | Accepted |
| [0006](0006-vanilla-es-modules-no-npm.md) | Replace React, ReactFlow, zustand and npm with vanilla ES modules | Accepted |
| [0007](0007-static-hosting-s3-cloudfront.md) | Static site and API on one CloudFront distribution (S3 + Lambda), single SAM stack | Accepted |
