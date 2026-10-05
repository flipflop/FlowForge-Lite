# FlowForge design constitution — "Clay Workbench"

If code and this document disagree, this document wins. Tokens and component classes live in
`frontend/src/theme.css`; components never hardcode a colour, font or shadow.

## Idea
A pipeline is a set of physical cards on a lit workbench. Two registers in tension:
- **Warm / tactile** — paper-clay slabs with real thickness, stacked sheets, glossy bead handles,
  push-keys that depress when pressed. Carries "fun, touchable, approachable".
- **Precise / instrument** — navy ink, mono labels and ids, status pills, thin wires, exact counts.
  Carries "this is a serious tool for complex graphs".

Reference: the "AI agents need a workspace" hub illustration (stacked cards, coloured squares,
status pills, beads on wires) and `Reference/CSS-Push-Button` (layered inset shadows).

## Light
One lamp, top-left. Every element obeys it: rim highlight on top and left edges (`--rim`),
slab side at the bottom (`--slab`, `--edge`), cast shadow down-right. A soft light pool sits on the
canvas top-left (`.ff-flow`). Lifting an element = translateY up + longer, softer shadow.
Pressing = translateY down + inset shadow. Nothing else is allowed to "glow".

## Type (three voices, never crossed)
| Voice | Face | Use |
|---|---|---|
| Display | Archivo 800–900, uppercase, −0.03em | brand, sheet titles, metric numerals, empty-state title |
| UI | Manrope 500–800 | node titles, buttons, field text, prose |
| Instrument | JetBrains Mono, uppercase, +0.08–0.12em | labels, ids, pills, handle names, stats |

## Colour
Light = warm paper studio (`--ground #F2EFE8`, navy ink `#16233A`). Dark = night studio
(`--ground #11151D`, same lamp, lower light). No pure #000/#fff on surfaces.
**Coral is the one hot accent** (`--accent`): LLM category, focus ring, wire hover.
**Category hues are functionally coded**, one per node family; never decorative:

| `data-cat` | Hue | Nodes |
|---|---|---|
| `source` | slate blue | Input, Database, API |
| `model` | coral | LLM |
| `shape` | ochre | Text, Transform, Filter |
| `check` | sage | Validator |
| `sink` | navy (light) / pale (dark) | Output |

Status always pairs colour with a word: READY · WORKING · DONE · ERROR (`.ff-pill--*`).

## Components (classes in theme.css)
- **Node** `.ff-node[data-cat]` → `.ff-node__head` (`.ff-chip` icon square + `.ff-node__title` +
  `.ff-node__id` mono + `.ff-pill` + `.ff-node__close`) → `.ff-node__body` with `.ff-field`s.
  States: `.is-running`, `.is-error`; selection via ReactFlow's `.selected`.
- **Handles** `.ff-handle` (bead takes the node's `--cat`), labels `.ff-handle-label--in/out`.
- **Fields** `.ff-field > .ff-label + (.ff-input | .ff-textarea | .ff-select)`; inputs are wells.
- **Buttons** `.ff-btn` (clay key) + `--primary` (ink) `--go` (green, Run only) `--accent` (coral) `--ghost` `--icon` `--sm`.
- **Palette** `.ff-palette--top|--side` with `.ff-key[data-cat]` tiles.
- **Sheets** `.ff-scrim > .ff-sheet` (head/body/foot), `.ff-banner--ok|warn|error`, `.ff-metric`.
- **Glass instruments**: Controls, MiniMap, `.ff-dock`, `.ff-toast` use `.ff-glass`.

## Motion (each earns a sentence)
- Key press depress: confirms the click physically.
- Node lift on hover / tilt on drag: shows what is picked up.
- Pill pulse + dotted flowing wires while running: shows where execution is.
- Run button halo while running: the one place to stop a run.
- Sheet rise / menu pop: anchors new surfaces to where they came from.
- Empty-state floating cards: invites the first drag; disappears once a node exists.
All collapse under `prefers-reduced-motion`. Theme switch animates colour only.

## Theme switch
`<html data-theme="light|dark">`; initial value from `?theme=`, then `localStorage('ff-theme')`,
then `prefers-color-scheme`. Toggle in the header.

## Decisions log
- 2026-10-05 — Replaced the beige/khaki "paper" look and Inter with Clay Workbench, Archivo/Manrope/
  JetBrains Mono, tokenised light + dark themes, coded category hues. (Roz brief, Opus design.)
- 2026-10-05 — Run button moved from coral to green (`--go`, `.ff-btn--go`); green is reserved for Run. (Roz.)
