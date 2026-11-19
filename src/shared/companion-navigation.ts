export const codexTabs = ['activity', 'summary'] as const;
export const hubName = 'HUB';
export const primaryPages = ['home', 'codex', 'spotify', 'notes', 'calendar'] as const;
export const launcherPages = [...primaryPages, 'notices'] as const;
export const sectionPages = [...primaryPages, 'settings'] as const;
export const workspacePages = [...launcherPages, 'settings', 'permissions', 'options', 'shortcuts'] as const;

export type CodexTab = typeof codexTabs[number];
export type AppPage = typeof primaryPages[number];
export type LauncherPage = typeof launcherPages[number];
export type SectionPage = typeof sectionPages[number];
export type WorkspacePage = typeof workspacePages[number];

export function isLauncherPageSelected(page: WorkspacePage, launcher: LauncherPage | 'settings') {
  return page === launcher || (launcher === 'codex' && page === 'permissions');
}

export function appCubeDirection(visibleApps: readonly AppPage[], from: WorkspacePage, to: WorkspacePage) {
  const before = visibleApps.findIndex(app => isLauncherPageSelected(from, app));
  const after = visibleApps.findIndex(app => isLauncherPageSelected(to, app));
  if (before < 0 || after < 0 || before === after) return undefined;
  return after > before ? 'bottom' : 'top';
}
