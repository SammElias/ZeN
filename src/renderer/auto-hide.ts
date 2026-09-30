import type { TaskState } from '../shared/contracts';
export type HideConditions = { enabled: boolean; visible: boolean; state: TaskState; voiceActive: boolean; interacting: boolean; hasCopyableResult: boolean; panelOpen: boolean };
export function canAutoHide(c: HideConditions) {
  return c.enabled && c.visible && c.state === 'completed' && !c.voiceActive && !c.interacting && !c.hasCopyableResult && !c.panelOpen;
}
export class SuccessTimer {
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private hide: () => void) {}
  update(conditions: HideConditions) { this.dispose(); if (canAutoHide(conditions)) this.timer = setTimeout(this.hide, 6000); }
  dispose() { clearTimeout(this.timer); this.timer = undefined; }
}
