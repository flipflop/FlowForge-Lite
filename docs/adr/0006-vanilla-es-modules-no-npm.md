# 0006. Replace React, ReactFlow, zustand and npm with vanilla ES modules

Status: Accepted
Date: 2026-10-06

## Context

The first frontend was a Create React App project using React 18, ReactFlow 11, zustand and TailwindCSS. It needed a build step and a large transitive npm dependency tree, and CRA is no longer maintained. Every dependency is code that runs in the page next to the user's API keys. The app needs a small feature set: pan and zoom, draggable cards, bezier wires, port-to-port connecting, a minimap, nine node types and a store.

## Decision

Rewrite the frontend as static ES modules under `web/`, with no npm, no build and no third-party runtime code (migration contracts in `docs/vanilla-migration.md`).

- Components are pure functions from props to DOM, written with an `html` tagged template (`web/js/util/html.js`) that builds elements and text nodes and attaches events with `addEventListener`.
- State is a standalone store (`web/js/services/store.js`) with selector subscriptions, replacing zustand.
- The canvas is a hand-written engine (`web/js/services/canvas.js`, with pure maths in `geometry.js`), replacing ReactFlow. Ports are real DOM elements and wires are measured from them.
- Node cards render once per id and are patched through returned handles (`setRun`, `setPorts`, `setWidth`), so typing never remounts a card.
- Layering is enforced by convention: `util`, then `services`, then `components` and `nodes`, then `main.js`. Components and node bodies never import the store.
- Tests use Node's built-in runner and two browser selftest pages, so CI installs no packages.

## Consequences

- The supply chain is this repository. There is nothing to `npm audit`, no lockfile churn and no build to break, and a page that holds API keys runs only our code.
- We own the canvas code. Bugs in hit-testing, touch handling, accessibility and edge cases are ours to fix, and ReactFlow plugins and community fixes are not available. The engine covers only what FlowForge uses.
- There is no JSX, type checker or hot reload. JSDoc headers and unit tests stand in for types.
- Contributors need to learn the render-once, patch-through-refs model rather than a familiar framework.
- Handle ids and the backend payload stayed identical to the React version, so the backend was unchanged.
