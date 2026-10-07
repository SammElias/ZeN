import type { OverlayLayout, DockEdge } from '../shared/contracts';
import { CAPSULE_WIDTH, CAPSULE_HEIGHT, CHAT_WIDTH } from '../shared/island';
export type Area = { x: number; y: number; width: number; height: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
// All geometry is in Electron DIP, including monitors at negative coordinates.
export function overlayBounds(area: Area, layout: Pick<OverlayLayout, 'mode' | 'height'>, horizontalRatio = .5, edge: DockEdge = 'top', verticalRatio = .5): Area {
  const side = edge !== 'top'; const compact = layout.mode === 'capsule';
  const width = Math.max(1, Math.min(compact ? side ? CAPSULE_HEIGHT : CAPSULE_WIDTH : CHAT_WIDTH, Math.max(1, area.width - (compact && side ? 0 : 24))));
  const limit = compact ? side ? CAPSULE_WIDTH : CAPSULE_HEIGHT : Math.min(600, Math.max(48, Math.floor(area.height * .8)));
  const height = Math.max(1, Math.min(compact && side ? CAPSULE_WIDTH : layout.height, limit, Math.max(1, area.height - 24)));
  const center = area.x + area.width * clamp(horizontalRatio, 0, 1);
  const x = edge === 'left' ? area.x : edge === 'right' ? area.x + area.width - width : clamp(center - width / 2, area.x, area.x + area.width - width);
  // The expanded panel grows inward/downward from the same rail, then clamps.
  const y = side ? clamp(area.y + area.height * clamp(verticalRatio, 0, 1) - CAPSULE_WIDTH / 2, area.y, area.y + area.height - height) : area.y;
  return { x: Math.round(x), y: Math.round(y), width, height };
}
export function nearestEdge(area: Area, point: {x:number;y:number}, current: DockEdge = 'top'): DockEdge {
  const distances = { top: Math.abs(point.y - area.y), left: Math.abs(point.x - area.x), right: Math.abs(point.x - area.x - area.width) };
  const next = (Object.keys(distances) as DockEdge[]).sort((a,b) => distances[a] - distances[b])[0];
  // A small corner deadband prevents orientation flicker while dragging.
  return distances[current] <= distances[next] + 24 ? current : next;
}
export function draggedRatio(area: Area, layout: Pick<OverlayLayout, 'mode' | 'height'>, cursorX: number, grabRatio: number): number {
  const width = overlayBounds(area, layout).width;
  const center = cursorX + (.5 - grabRatio) * width;
  const constrained = clamp(center, area.x + width / 2, area.x + area.width - width / 2);
  return clamp((constrained - area.x) / Math.max(1, area.width), 0, 1);
}
export function draggedVerticalRatio(area: Area, cursorY: number, grabRatio: number): number {
  const length = Math.min(CAPSULE_WIDTH, Math.max(1, area.height - 24));
  const center = clamp(cursorY + (.5 - grabRatio) * length, area.y + length / 2, area.y + area.height - length / 2);
  return clamp((center - area.y) / Math.max(1, area.height), 0, 1);
}
