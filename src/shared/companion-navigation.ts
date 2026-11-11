export const codexTabs = ['activity', 'summary'] as const;
export const launcherPages = ['home', 'codex', 'spotify', 'notes', 'notices'] as const;
export const workspacePages = [...launcherPages, 'settings', 'permissions', 'options', 'shortcuts'] as const;

export type CodexTab = typeof codexTabs[number];
export type LauncherPage = typeof launcherPages[number];
export type WorkspacePage = typeof workspacePages[number];

export function isLauncherPageSelected(page: WorkspacePage, launcher: LauncherPage) {
  return page === launcher ||
    (launcher === 'codex' && page === 'permissions') ||
    (launcher === 'home' && page === 'settings');
}
