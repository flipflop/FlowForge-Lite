/**
 * EmptyState.js — the invitation shown while the bench is empty.
 *
 * Why: first-run users need one obvious next step. It disappears as soon as a node exists
 * (main.js mounts/unmounts it). The wrapper ignores pointer events so canvas drops still work;
 * only the CTA re-enables them (app.css).
 *
 *   EmptyState({ onExample }) -> div.ff-empty
 */
import { html } from "../util/html.js";
import { Button } from "./primitives.js";

export function EmptyState({ onExample }) {
  return html`
    <div class="ff-empty">
      <div class="ff-empty__card">
        <div class="ff-empty__ghost"><span></span><span></span><span></span></div>
        <div class="ff-empty__title">Build a pipeline</div>
        <p class="ff-empty__body">Drag an Input, an LLM and an Output from the palette, then wire them left to right.</p>
        <button type="button" class="ff-btn ff-btn--sm ff-empty__cta" onclick=${onExample}>Load an example</button>
      </div>
    </div>`;
}
