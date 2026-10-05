/**
 * Header.js — the top bar: brand, palette-position switch, theme toggle, API Keys, Validate, Run.
 *
 * Why: pure view of app state. main.js re-mounts it whenever theme/layout/keys/run/validate state
 * changes; every action is a callback. Run turns into Stop (with the breathing halo) while running.
 *
 *   Header({ theme, layout, onLayout, onToggleTheme, hasKeys, onSettings,
 *            validating, onValidate, running, onRun }) -> header.ff-header
 */
import { html } from "../util/html.js";
import { Button, Segmented } from "./primitives.js";

export function Header({ theme, layout, onLayout, onToggleTheme, hasKeys, onSettings,
                         validating, onValidate, running, onRun }) {
  const next = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return html`
    <header class="ff-header">
      <div class="ff-brand">
        <span class="ff-brand__mark"></span>
        <h1 class="ff-brand__name" style="margin:0">Flow<em>Forge</em></h1>
        <span class="ff-eyebrow ff-brand__tag">Pipeline workbench</span>
      </div>
      <div class="ff-header__actions">
        ${Segmented({
          ariaLabel: "Palette position", value: layout, onChange: onLayout,
          options: [
            { value: "top", icon: "paletteTop", ariaLabel: "Palette on top" },
            { value: "side", icon: "paletteLeft", ariaLabel: "Palette on left" },
          ],
        })}
        ${Button({ id: "theme-toggle", variant: "ghost", icon: theme === "dark" ? "sun" : "moon", iconSize: 16,
                   ariaLabel: next, title: next, onClick: onToggleTheme })}
        <span class="ff-header__sep"></span>
        ${Button({ id: "open-settings", label: "API Keys", badge: hasKeys ? "SET" : null, onClick: onSettings })}
        ${Button({ id: "submit-pipeline", label: validating ? "Validating…" : "Validate", variant: "primary",
                   icon: validating ? null : "play", iconSize: 12, disabled: validating, onClick: onValidate })}
        ${Button({ id: "run-pipeline", label: running ? "Stop" : "Run", variant: "go", icon: running ? "stop" : "play",
                   iconSize: 12, running, onClick: onRun })}
      </div>
    </header>`;
}
