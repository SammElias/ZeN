export const codexTabs = ['activity', 'summary'] as const;
const primaryPages = ['home', 'codex', 'spotify', 'notes'] as const;
export const launcherPages = [...primaryPages, 'notices'] as const;
export const sectionPages = [...primaryPages, 'settings'] as const;
export const workspacePages = [...launcherPages, 'settings', 'permissions', 'options', 'shortcuts'] as const;

export type CodexTab = typeof codexTabs[number];
export type LauncherPage = typeof launcherPages[number];
export type SectionPage = typeof sectionPages[number];
export type WorkspacePage = typeof workspacePages[number];

export function isLauncherPageSelected(page: WorkspacePage, launcher: LauncherPage | 'settings') {
  return page === launcher || (launcher === 'codex' && page === 'permissions');
}
