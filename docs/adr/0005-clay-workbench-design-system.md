# 0005. Clay Workbench design system and design tokens

Status: Accepted
Date: 2026-10-05

## Context

The original look was a beige and khaki "paper" style with hard-coded colours and Inter. The product needs to feel approachable and tactile, and also read as a precise tool for complex graphs. Light and dark themes were both wanted, and colour had to carry meaning, not decoration.

## Decision

Adopt the "Clay Workbench" system specified in `docs/design.md` and implemented in `web/css/tokens.css`.

- Two registers in tension: warm and tactile (slab cards with thickness, bead handles, keys that depress) and precise (navy ink, mono labels, thin wires, status pills with words).
- One light source, top-left. Every shadow falls down and to the right.
- Three type voices that are never crossed: Archivo for display, Manrope for UI, JetBrains Mono for labels and ids. Fonts are self-hosted under `web/fonts/`.
- Every colour, font and shadow is a custom property on `:root` and is redefined under `:root[data-theme="dark"]`. Components never hard-code them, and a unit test fails on hex colours outside `tokens.css` in the component files.
- Five functional category hues (source, model, shape, check, sink). Coral is the single hot accent; green is reserved for Run. Status always pairs colour with a word (READY, WORKING, DONE, ERROR).
- Theme precedence: `?theme=`, then `localStorage ff-theme`, then `prefers-color-scheme`. Motion collapses under `prefers-reduced-motion`.

## Consequences

- Restyling or adding a theme is a token change.
- Colour and tone are constrained by rules, so new components have to fit the lamp and category rules, which costs some design freedom.
- Visual regressions are caught by review and by the selftests, not by screenshot diffing. [TK: whether visual regression testing is wanted.]
- If code and `docs/design.md` disagree, the design document wins.
