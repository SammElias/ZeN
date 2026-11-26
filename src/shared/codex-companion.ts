import type {CalendarAction,CalendarSnapshot,CalendarEvent,CalendarOperation} from './companion-calendar';
import type {OuraAction,OuraGlance,OuraHomeSleep,OuraStatus} from './companion-oura';
import type {WeatherAction,WeatherStatus} from './companion-weather';
import type {DailyHomeAction,DailyHomePreferences,HomeBrief} from './companion-daily-home';
import type {TranslatorAction,TranslatorReply} from './companion-translator';
import type {OfficinaAction,OfficinaView} from './companion-officina';
import type {CodexRequestReceipt} from './companion-request';
import type {AppearanceOptions,AppearanceState} from './companion-appearance';
import type {ContextInput,ContextPreview,ContextFile} from './companion-context';
import type {CodexReferenceSelection} from './codex-result-document';
import type {CodexResultState} from './companion-codex-result';
import {z} from 'zod';
import type {MediaSession,MediaTrack,MediaCommand,MediaNowPlaying,MediaSnapshot,SystemVolumeAction,SystemVolumeState} from './companion-media';
import type {WorkspaceState,WorkspacePage,LauncherPage,CapsuleView,SectionActivation,SectionPage,CapsuleHoverInput} from './companion-workspace';
import type {CapsuleAlignment} from './overlay-position';
import type {CapsuleLocation,WorkspaceLayoutAction, WorkspaceLayoutPreferences} from './workspace-layout';
import type {HubAction, HubDraft, HubFileAction, HubFileResult, HubResult, HubSession, RecentHubNote} from './knowledge-hub';
import type {TemplateReply,TemplateRequest} from './knowledge-templates';
import type {QuickNotes,QuickNotesAction} from './quick-notes';
import type {WhiteboardAction,WhiteboardDocument} from './whiteboard';
import type {InterfaceEffect} from './companion-interface-audio';
import {OfficinaDesign} from './officina-design';
export const CompanionSettingsSchema=z.object({
 shortcut:z.string().min(3).max(80).default('Control+Alt+Z'),
 returnShortcut:z.string().min(3).max(80).default('Control+Alt+C'),
 motion:z.boolean().default(true),sounds:z.boolean().default(true),notifications:z.boolean().default(true),
 officinaDesign:OfficinaDesign.default('graphite'),
 interfaceSounds:z.boolean().optional(),interfaceVolume:z.number().int().min(0).max(100).default(18),
 paused:z.boolean().default(false),presentation:z.boolean().default(false),
 followPointerDisplay:z.boolean().default(true),respectFullscreen:z.boolean().default(true),
 windowLocked:z.boolean().default(false),alwaysOnTop:z.boolean().default(false),
 collapseOnBlur:z.boolean().default(false),keepExpanded:z.boolean().default(false),
 dismissCapsuleOnOutsideClick:z.boolean().default(false),hideCapsuleFromTaskbar:z.boolean().default(false),
 silencedUntil:z.number().int().nonnegative().max(8640000000000000).default(0),
}).strict();
export type CompanionSettings=z.infer<typeof CompanionSettingsSchema>;
export function migrateWindowPreferences(input:unknown) {
 if(!input||typeof input!=='object'||!('keepOnTop' in input)||typeof input.keepOnTop!=='boolean')return input;
 const {keepOnTop,...settings}=input;
 // The old setting was controlled by the lock. Only an explicit new setting can enable topmost.
 return {windowLocked:keepOnTop,...settings};
}
export const CompanionTargetSchema=z.object({session:z.string().min(1).max(160).regex(/^[a-zA-Z0-9._:-]+$/),cwd:z.string().min(3).max(4096).regex(/^(?:[a-zA-Z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/).refine(v=>!/[\0\r\n]/.test(v)),title:z.string().trim().min(1).max(200)}).strict();
export type CompanionTarget=z.infer<typeof CompanionTargetSchema>;
export const hookEvents=['SessionStart','UserPromptSubmit','PreToolUse','PermissionRequest','PostToolUse','Stop','SubagentStart','SubagentStop','Interrupt','SessionEnd'] as const;
export const COMPANION_REPLY_LIMIT=64000;
export const CompanionLastReplySchema=z.object({text:z.string().min(1).max(COMPANION_REPLY_LIMIT),at:z.number().int().nonnegative().max(8640000000000000),source:z.enum(['hook','local']),turn:z.string().min(1).max(160).optional(),truncated:z.boolean()}).strict();
export type CompanionLastReply=z.infer<typeof CompanionLastReplySchema>;
export const CompanionEventSchema=z.object({id:z.string().uuid(),event:z.enum(hookEvents),session:z.string().min(1).max(160),turn:z.string().max(160).optional(),cwd:z.string().max(4096),tool:z.string().max(300).optional(),preview:z.string().max(100000).optional(),truncated:z.boolean().default(false),failed:z.boolean().default(false),lastAssistantMessage:z.string().max(COMPANION_REPLY_LIMIT).optional(),lastAssistantMessageTruncated:z.boolean().default(false)}).strict().refine(e=>e.lastAssistantMessage===undefined||e.event==='Stop');
export type CompanionEvent=z.infer<typeof CompanionEventSchema>;
export type CompanionPhase='idle'|'thinking'|'working'|'approval'|'finished'|'error'|'interrupted'|'unknown';
export type CompanionSummary={state:'ready'|'unavailable';files:{path:string;change:'added'|'changed'|'removed'}[];omitted:number;startedAt?:number;endedAt:number};
export type CompanionSession={id:string;turn?:string;runKey?:string;summary?:CompanionSummary;lastReply?:CompanionLastReply;label:string;title?:string;cwd:string;state:CompanionPhase;tool?:string;at:number;observation?:{since:number;startedAt?:number;endedAt?:number;actions:number};steps:{id:string;label:string;tool?:string;preview?:string;kind?:'command'|'file';at:number}[]};
export type CompanionApproval={id:string;session:string;turn:string;label:string;tool:string;preview:string;expiresAt:number};
export type CompanionNotice={id:string;session:string;title:string;kind:'permission'|'finished'|'error';read:boolean;audible?:boolean;at:number};
export type CompanionConnection={state:'unchecked'|'missing'|'review'|'disabled'|'ready'|'unavailable';checkedAt?:number;total:number;trusted:number;enabled:number};
export type CompanionStatus={officinaGlance?:import('./companion-officina').OfficinaGlance;officinaQueueCount?:number;officinaGlanceItems?:import('./companion-officina').OfficinaGlanceItem[];officinaDecisions?:import('./companion-officina').OfficinaDecision[];oura?:OuraStatus;ouraGlance?:OuraGlance;ouraHomeSleep?:OuraHomeSleep;homeBrief?:HomeBrief;appearance?:AppearanceState;workspace?:WorkspaceState;revision?:number;desktop?:{available:boolean;name?:string;error?:string};settings:CompanionSettings;target?:CompanionTarget;ignoredEvents?:number;targetError?:string;account:'unchecked'|'chatgpt'|'missing'|'unsupported';checking:boolean;integration:'missing'|'waiting'|'receiving';connection?:CompanionConnection;sessions:CompanionSession[];activitySessions?:CompanionSession[];approvalCount?:number;approvals:CompanionApproval[];notices:CompanionNotice[];lastEventAt?:number;error?:string};
export type CompanionResult<T>={ok:true;value:T}|{ok:false;error:string};
export interface CompanionBridge{
 vault(action:import('./password-vault').VaultRequest):Promise<CompanionResult<import('./password-vault').VaultReply>>;
 onVaultSignal(callback:(signal:import('./password-vault').VaultSignal)=>void):()=>void;
 oura(action:OuraAction):Promise<CompanionResult<boolean>>;
 weather(action:WeatherAction):Promise<CompanionResult<WeatherStatus>>;
 dailyHome(action:DailyHomeAction):Promise<CompanionResult<DailyHomePreferences>>;
 translator(action:TranslatorAction):Promise<CompanionResult<TranslatorReply>>;
 officina(action:OfficinaAction):Promise<CompanionResult<OfficinaView>>;
 appearanceSave(options:AppearanceOptions):Promise<CompanionResult<AppearanceState>>;appearanceChoose():Promise<CompanionResult<AppearanceState>>;
 profileBackup(action:'export'|'import'):Promise<CompanionResult<'exported'|'imported'|'cancelled'>>;
 profileSync(action:import('./profile-sync').ProfileSyncAction):Promise<CompanionResult<import('./profile-sync').ProfileSyncStatus>>;
 openRequest(text:string):Promise<CompanionResult<CodexRequestReceipt>>;
 openSpotify():Promise<CompanionResult<boolean>>;
 contextStatus():Promise<CompanionResult<ContextFile|null>>;contextChoose():Promise<CompanionResult<ContextFile|null>>;contextPrepare(input:ContextInput):Promise<CompanionResult<ContextPreview>>;contextCancel(id:string):Promise<CompanionResult<boolean>>;contextHandoff(id:string):Promise<CompanionResult<{queued:true}>>;contextResult():Promise<CompanionResult<CodexResultState>>;
 contextSource(selection:CodexReferenceSelection):Promise<CompanionResult<string>>;
 mediaNowPlaying():Promise<CompanionResult<MediaNowPlaying|null>>;mediaObservationClose():Promise<CompanionResult<boolean>>;
 navigate(page:WorkspacePage):Promise<CompanionResult<boolean>>;
 notesRecent():Promise<CompanionResult<RecentHubNote[]>>;
 notesRead():Promise<CompanionResult<HubSession>>;
 notesChange(change:HubAction):Promise<CompanionResult<HubResult>>;
 notesDraft(draft:HubDraft|null):Promise<CompanionResult<true>>;
 quickNotes(action:QuickNotesAction):CompanionResult<QuickNotes>;
 whiteboard(action:WhiteboardAction):CompanionResult<WhiteboardDocument|null>;
 notesFile(action:HubFileAction):Promise<CompanionResult<HubFileResult>>;
 templates(action:TemplateRequest):Promise<CompanionResult<TemplateReply>>;
 togglePage(page:SectionPage):Promise<CompanionResult<SectionActivation>>;
 togglePanel():Promise<CompanionResult<SectionActivation>>;
 launcher(open:boolean):Promise<CompanionResult<boolean>>;
 island(compact:boolean):Promise<CompanionResult<boolean>>;
 capsuleLocation(location:CapsuleLocation):Promise<CompanionResult<boolean>>;
 capsuleLocationMenu(anchor?:import('./workspace-layout').CapsuleMenuAnchor):Promise<CompanionResult<boolean>>;
 islandFocusGuard(blocked:boolean):Promise<CompanionResult<boolean>>;
 capsuleHover(input:CapsuleHoverInput):Promise<CompanionResult<boolean>>;
 panelPainted(token:number):Promise<CompanionResult<boolean>>;
 keepExpanded(enabled:boolean):Promise<CompanionResult<boolean>>;
 launcherOrder(order:LauncherPage[]):Promise<CompanionResult<boolean>>;launcherContext(page:LauncherPage):Promise<CompanionResult<boolean>>;options():Promise<CompanionResult<boolean>>;compact(view:CapsuleView):Promise<CompanionResult<boolean>>;
 mediaCurrent():Promise<CompanionResult<MediaTrack|null>>;
 systemVolume(action:SystemVolumeAction):Promise<CompanionResult<SystemVolumeState>>;
 mediaSnapshot(followSystem?:true):Promise<CompanionResult<MediaSnapshot>>;
 mediaList():Promise<CompanionResult<MediaSession[]>>;mediaSelect(id:string):Promise<CompanionResult<MediaTrack>>;mediaRead(id:string):Promise<CompanionResult<MediaTrack>>;mediaCommand(value:MediaCommand):Promise<CompanionResult<{accepted:boolean}>>;mediaClose(surface?:'workspace'|'compact'):Promise<CompanionResult<boolean>>;
 calendar(action:CalendarAction):Promise<CompanionResult<CalendarSnapshot|{event?:CalendarEvent;local?:boolean;operation?:CalendarOperation}>>;
 status():Promise<CompanionResult<CompanionStatus>>;onStatus(cb:(v:CompanionStatus)=>void):()=>void;
 onInterfaceEffect(cb:(effect:InterfaceEffect)=>void):()=>void;
 openCodex(id?:string):Promise<CompanionResult<boolean>>;check():Promise<CompanionResult<boolean>>;
 install():Promise<CompanionResult<boolean>>;save(value:CompanionSettings):Promise<CompanionResult<boolean>>;
 decide(id:string,decision:'allow'|'deny'|'pass'):Promise<CompanionResult<boolean>>;clearNotices():Promise<CompanionResult<boolean>>;
 copy(text:string):Promise<CompanionResult<boolean>>;
 sound(enabled:boolean):Promise<CompanionResult<boolean>>;silence(minutes:0|30):Promise<CompanionResult<boolean>>;testNotice():Promise<CompanionResult<boolean>>;
 presentation(enabled:boolean):Promise<CompanionResult<boolean>>;returnApp():Promise<CompanionResult<boolean>>;
 hide():Promise<CompanionResult<boolean>>;drag(action:'start'|'end'):Promise<CompanionResult<boolean>>;
 pinWindow(enabled:boolean):Promise<CompanionResult<boolean>>;
 moveCapsule(alignment:CapsuleAlignment):Promise<CompanionResult<boolean>>;
 workspaceLayout(action:WorkspaceLayoutAction):Promise<CompanionResult<boolean>>;
 workspaceLayoutPreferences(preferences:WorkspaceLayoutPreferences):Promise<CompanionResult<boolean>>;
}
declare global{interface Window{companion:CompanionBridge;}}
