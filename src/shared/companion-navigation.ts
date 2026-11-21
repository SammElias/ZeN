export const hubName = 'HUB';
export const primaryPages = ['home', 'notes', 'calendar', 'metrics', 'spotify'] as const;
export const launcherPages = [...primaryPages, 'codex', 'notices'] as const;
export const sectionPages = [...primaryPages, 'settings'] as const;
export const sectionTargets = [...sectionPages, 'codex'] as const;
export const workspacePages = [...launcherPages, 'settings', 'permissions', 'options', 'shortcuts'] as const;

export type AppPage = typeof sectionTargets[number];
export type LauncherPage = typeof launcherPages[number];
export type SectionPage = typeof sectionTargets[number];
export type WorkspacePage = typeof workspacePages[number];

export const visibleLauncherPages = (order: readonly LauncherPage[]) =>
  order.filter(page => page !== 'notices' && page !== 'codex');

export function capsulePages(order?: readonly LauncherPage[]) {
  return order ? [...visibleLauncherPages(order), 'settings'] as const : sectionPages;
}

export function isLauncherPageSelected(page: WorkspacePage, launcher: LauncherPage | 'settings') {
  return page === launcher || (launcher === 'codex' && page === 'permissions');
}

export function appCubeDirection(visibleApps: readonly AppPage[], from: WorkspacePage, to: WorkspacePage) {
  const before = visibleApps.findIndex(app => isLauncherPageSelected(from, app));
  const after = visibleApps.findIndex(app => isLauncherPageSelected(to, app));
  if (before < 0 || after < 0 || before === after) return undefined;
  return after > before ? 'bottom' : 'top';
}
