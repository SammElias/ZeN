import type { OverlayLayout } from '../shared/contracts';
export type Area = { x: number; y: number; width: number; height: number };
// Electron screen/workArea uses device-independent pixels, including negative coordinates.
export function overlayBounds(area: Area, layout: Pick<OverlayLayout, 'mode' | 'height'>): Area {
  const width = Math.max(1, Math.min({ capsule: 320, card: 560, panel: 600 }[layout.mode], area.width - 24));
  const availableHeight = Math.max(1, area.height - 24);
  const limit = layout.mode === 'capsule' ? 48 : Math.min(600, Math.max(48, Math.floor(area.height * .8)));
  const height = Math.max(1, Math.min(layout.height, limit, availableHeight));
  return { x: Math.round(area.x + (area.width - width) / 2), y: area.y, width, height };
}
