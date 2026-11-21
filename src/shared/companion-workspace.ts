import {z} from 'zod';
import {launcherPages, sectionPages, sectionTargets, workspacePages} from './companion-navigation';
import type {CapsuleLocation,WorkspaceLayoutPreferences} from './workspace-layout';
import type {IslandSide} from './island';
import type {Area} from './overlay-position';
export {isLauncherPageSelected} from './companion-navigation';
export const WorkspacePage=z.enum(workspacePages);
export type WorkspacePage=z.infer<typeof WorkspacePage>;
export const LauncherPage=z.enum(launcherPages);
export type LauncherPage=z.infer<typeof LauncherPage>;
export const SectionPage=z.enum(sectionTargets);
export type SectionPage=z.infer<typeof SectionPage>;
export type SectionActivation={expanded:boolean;page:WorkspacePage;revision:number};
export const HoverApp=z.enum(sectionPages);
export const CapsuleHoverInput=z.object({app:HoverApp.optional(),inside:z.boolean(),blocked:z.boolean(),reduced:z.boolean()}).strict();
export type CapsuleHoverInput=z.infer<typeof CapsuleHoverInput>;
export const LauncherOrder=z.preprocess(value=>{
 if(Array.isArray(value)&&value.length>=launcherPages.length-2){
  const order=value.filter(page=>page!=='passwords');
  return [...order,...(['calendar','metrics'] as const).filter(page=>!order.includes(page))];
 }
 return value;
},z.array(LauncherPage).length(launcherPages.length).refine(v=>new Set(v).size===launcherPages.length));
export const CapsuleView=z.enum(['status','spotify','codex']);
export type CapsuleView=z.infer<typeof CapsuleView>;
export type WorkspaceState={expanded:boolean;geometry?:{capsule:Area;panel?:Area};surfaceVisible?:boolean;hoverClosing?:boolean;panelOpening?:boolean;panelPaint?:number;fromApps?:boolean;island?:boolean;islandSizing?:boolean;islandControls?:boolean;islandStacked?:boolean;edge?:{side:IslandSide;railTop:number};location?:CapsuleLocation;page:WorkspacePage;context?:LauncherPage;order?:LauncherPage[];last?:LauncherPage;recentSection?:SectionPage;compact?:CapsuleView;nativeCaption?:boolean;layout?:WorkspaceLayoutPreferences;canRestorePosition?:boolean};
