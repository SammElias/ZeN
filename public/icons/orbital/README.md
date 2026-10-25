# ZEN orbital assets

Original artwork created for ZEN in Figma on 2026-10-24.

Source: https://www.figma.com/design/AErBIlpaqrvOMM8XNfdCxn?node-id=2-342

The SVGs are unchanged exports of the approved design. State geometry is 64 × 64; thinking uses the original front/back/core/satellite layers. `app.svg` is the static 256 × 256 executable icon. Native PNG/ICO sizes are generated locally by `node scripts/app-icons.mjs`.

The capsule animates wrappers, retains native asset dimensions and draws the bounded, observed trace from the component's layout. No runtime Figma requests or external assets.

Motion follows the authored keyframes: clockwise 360° / 3.2 s, core opacity 1 → .65 → 1 / 2.4 s, and an opacity .65 → 1 transition once per observed turn end / .7 s. This deliberately corrects the truncated angle, altered opacity and shared looping completion returned by Figma's code export. The approved static design is preserved; no Figma file write was made after the Starter MCP limit.
