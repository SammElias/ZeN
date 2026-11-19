import { motion } from '../shared/companion-motion';
import { isLauncherPageSelected, type AppPage, type WorkspacePage } from '../shared/companion-navigation';

type Sample = {
  visible: boolean;
  expanded: boolean;
  page: WorkspacePage;
  overCapsule: boolean;
  overWorkspace: boolean;
  blocked: boolean;
  locked: boolean;
  animate: boolean;
};

type HoverWindow = {
  sample(): Sample;
  open(app: AppPage): void;
  close(): void;
  previewClose(closing: boolean): void;
};

const openDelay = 150;
const closeDelay = 450;
const cursorInterval = 25;

/** Mouse entry comes from the visible Electron surface. Screen coordinates bridge native gaps. */
export class CompanionHover {
  private timer?: ReturnType<typeof setTimeout>;
  private app?: AppPage;
  private selected = false;
  private tracking = false;
  private dwellSince?: number;
  private outsideSince?: number;
  private closing = false;

  constructor(private window: HoverWindow) {}

  pointer(app?: AppPage) {
    if (app !== this.app) {
      this.app = app;
      this.selected = false;
      this.dwellSince = undefined;
    }
    this.refresh();
  }

  selectExplicitly() {
    this.selected = true;
    this.dwellSince = undefined;
  }

  collapsed() {
    this.tracking = false;
    this.dwellSince = this.outsideSince = undefined;
    // Consume the app still under the cursor, while allowing another icon to arm.
    this.selected = !!this.app;
    this.refresh();
  }

  lockChanged() {
    this.dwellSince = this.outsideSince = undefined;
    this.selected = false;
    this.tracking = this.window.sample().expanded;
    this.refresh();
  }

  reset() {
    clearTimeout(this.timer);
    this.app = undefined;
    this.selected = this.tracking = false;
    this.dwellSince = this.outsideSince = undefined;
    this.setClosing(false);
  }

  refresh = () => {
    clearTimeout(this.timer);
    const sample = this.window.sample();
    if (!sample.visible) { this.reset(); return; }
    if (sample.locked) {
      this.dwellSince = this.outsideSince = undefined;
      this.setClosing(false);
      return;
    }

    const overSurface = sample.overCapsule || sample.overWorkspace;
    if (sample.expanded && overSurface) this.tracking = true;
    if (this.app && sample.overCapsule && sample.expanded && isLauncherPageSelected(sample.page, this.app)) this.selected = true;

    const now = performance.now();
    const app = !sample.blocked && sample.overCapsule && !this.selected ? this.app : undefined;
    if (!sample.blocked && sample.expanded && this.tracking && !overSurface) {
      this.dwellSince = undefined;
      this.outsideSince ??= now;
      this.tickClose(this.outsideSince + closeDelay - now, sample.animate);
      return;
    }

    this.outsideSince = undefined;
    this.setClosing(false);
    if (app) {
      this.dwellSince ??= now;
      const remaining = this.dwellSince + openDelay - now;
      if (remaining > 0) { this.wait(remaining); return; }
      this.selected = this.tracking = true;
      this.window.open(app);
    }
    this.dwellSince = undefined;
    if (this.tracking || (this.app && !this.selected)) this.wait(cursorInterval);
  };

  private tickClose(remaining: number, animate: boolean) {
    if (remaining > 0) {
      this.wait(remaining);
    } else if (animate && remaining > -motion.panelTransition) {
      this.setClosing(true);
      this.wait(remaining + motion.panelTransition);
    } else {
      this.outsideSince = undefined;
      this.tracking = false;
      this.closing = false;
      this.window.close();
    }
  }

  private wait(remaining: number) {
    this.timer = setTimeout(this.refresh, Math.min(cursorInterval, Math.ceil(remaining)));
  }

  private setClosing(closing: boolean) {
    if (this.closing === closing) return;
    this.closing = closing;
    this.window.previewClose(closing);
  }
}
