# FlowForge architecture

The architecture reference is [architecture.html](architecture.html): a self-contained page with diagrams of the system context, frontend layering, component tree, canvas engine, state, persistence and payloads, run lifecycle, backend, design system, testing, deployment and security. It prints to PDF.

Decision records are in [adr/](adr/README.md):

1. [0001 Server-sent events over WebSockets](adr/0001-sse-over-websockets.md)
2. [0002 Kahn's algorithm for ordering and cycle detection](adr/0002-kahn-topological-order.md)
3. [0003 Provider adapters over plain REST](adr/0003-provider-adapters-plain-rest.md)
4. [0004 Bring-your-own keys, rate-limited server fallback](adr/0004-bring-your-own-keys.md)
5. [0005 Clay Workbench design system](adr/0005-clay-workbench-design-system.md)
6. [0006 Vanilla ES modules, no npm](adr/0006-vanilla-es-modules-no-npm.md)
7. [0007 Static site and API on one CloudFront distribution](adr/0007-static-hosting-s3-cloudfront.md)

Related: [design.md](design.md) (design constitution) and [vanilla-migration.md](vanilla-migration.md) (frontend contracts).
