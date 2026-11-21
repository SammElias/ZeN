import {motion} from '../shared/companion-motion';

type PanelSurface = {
  visible(): boolean;
  expanded(): boolean;
  quitting(): boolean;
  motionEnabled(): boolean;
  updateShape(): void;
  broadcast(): void;
};

export class CompanionPanelTransition {
  private sequence = 0;
  private pendingPaint?: number;
  private paintTimer?: ReturnType<typeof setTimeout>;
  private animation?: ReturnType<typeof setInterval>;
  private progress = 0;
  private opening = false;
  private closing = false;
  private closeFrame?: Promise<boolean>;

  constructor(private readonly surface: PanelSurface) {}

  get paintToken() { return this.pendingPaint; }
  get hoverClosing() { return this.closing; }
  get retraction() { return this.progress; }

  status() {
    return {panelPaint: this.pendingPaint, panelOpening: this.opening, hoverClosing: this.closing};
  }

  prepareHoverOpen() {
    this.cancelPaint();
    const token = this.pendingPaint = ++this.sequence;
    // Occluded renderers can suspend frame callbacks. Do not leave the panel clipped indefinitely.
    this.paintTimer = setTimeout(() => this.finishPaint(token), 250);
  }

  async confirmPaint(token: number, captureFrame: () => Promise<boolean>) {
    if (token !== this.pendingPaint || !this.surface.visible() || !(await captureFrame())) return false;
    return this.finishPaint(token);
  }

  previewClose(closing: boolean, scrubbed?: Promise<boolean>) {
    this.closing = closing;
    this.closeFrame = scrubbed;
    if (this.surface.quitting() || !this.surface.visible()) return;
    if (scrubbed) {
      void scrubbed.then(ready => {
        if (ready && this.closeFrame === scrubbed && !this.surface.quitting() && this.surface.visible()) {
          this.animateRetraction(true);
        }
      });
    } else {
      this.animateRetraction(closing);
    }
    this.surface.broadcast();
  }

  reset() {
    this.cancelPaint();
    this.resetAnimation();
    this.closing = false;
    this.closeFrame = undefined;
  }

  private cancelPaint() {
    clearTimeout(this.paintTimer);
    this.pendingPaint = undefined;
  }

  private finishPaint(token: number) {
    if (token !== this.pendingPaint || !this.surface.expanded() || !this.surface.visible()) return false;
    this.cancelPaint();
    if (!this.closing && this.surface.motionEnabled()) {
      this.progress = 1;
      this.animateRetraction(false);
    }
    this.surface.updateShape();
    this.surface.broadcast();
    return true;
  }

  private resetAnimation() {
    clearInterval(this.animation);
    this.progress = 0;
    this.opening = false;
  }

  private animateRetraction(closing: boolean) {
    clearInterval(this.animation);
    const from = this.progress, to = closing ? 1 : 0;
    this.opening = !closing && from !== to;
    if (from === to) return;
    const start = performance.now();
    this.animation = setInterval(() => {
      if (this.surface.quitting() || !this.surface.expanded() || !this.surface.visible()) {
        this.resetAnimation();
        return;
      }
      const t = this.surface.motionEnabled() ? Math.min(1, (performance.now() - start) / motion.panelTransition) : 1;
      this.progress = from + (to - from) * t * t * (3 - 2 * t);
      this.surface.updateShape();
      if (t === 1) {
        clearInterval(this.animation);
        if (this.opening) {
          this.opening = false;
          this.surface.broadcast();
        }
      }
    }, 16);
  }
}
