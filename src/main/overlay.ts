import type { OverlayLayout } from '../shared/contracts';
import { CAPSULE_WIDTH, CAPSULE_HEIGHT } from '../shared/island';
export type Area = { x: number; y: number; width: number; height: number };
// Electron screen/workArea uses device-independent pixels, including negative coordinates.
export function overlayBounds(area: Area, layout: Pick<OverlayLayout, 'mode' | 'height'>, horizontalRatio = .5): Area {
  const width = Math.max(1, Math.min({ capsule: CAPSULE_WIDTH, card: 1120, panel: 1120 }[layout.mode], area.width - 24));
  const availableHeight = Math.max(1, area.height - 24);
  const limit = layout.mode === 'capsule' ? CAPSULE_HEIGHT : Math.min(600, Math.max(48, Math.floor(area.height * .8)));
  const height = Math.max(1, Math.min(layout.height, limit, availableHeight));
  const center = area.x + area.width * Math.max(0, Math.min(1, horizontalRatio));
  const x = Math.round(Math.max(area.x, Math.min(area.x + area.width - width, center - width / 2)));
  return { x, y: area.y, width, height };
}

// Cursor height selects the destination display; the window stays at that display's top.
export function draggedRatio(area: Area, layout: Pick<OverlayLayout, 'mode' | 'height'>, cursorX: number, grabRatio: number): number {
  const width = overlayBounds(area, layout).width;
  const center = cursorX + (.5 - grabRatio) * width;
  const constrained = Math.max(area.x + width / 2, Math.min(area.x + area.width - width / 2, center));
  return Math.max(0, Math.min(1, (constrained - area.x) / Math.max(1, area.width)));
}
