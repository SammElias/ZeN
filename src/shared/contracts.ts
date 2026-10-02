import type {HumanConfirmation} from './confirmation';
import type {Activity} from './activity';
import { z } from 'zod';
import type { Profile, ResponseMode } from './personal';
import type { WindowInfo, MediaInfo } from '../tools/windows/native';
import type { Approval, Prepare } from './approval';
import type { PublicMcpConnection } from './mcp';
import type { ScreenContextStatus, ScreenSnapshot } from '../main/screen-context';
import type { WorkContext, ProjectDraft, ProjectBundle } from './project';
import type {FolderAttachment} from '../main/folder-context';
export const SettingsSchema = z.object({
  reasoningModel: z.string().regex(/^gpt-[a-z0-9.-]+$/).default('gpt-6.1-sol'),
  voiceModel: z.string().regex(/^gpt-[a-z0-9.-]+$/).default('gpt-live-1'),
  shortcut: z.string().min(3).max(80).default('Control+Alt+Z'),
  maxToolCalls: z.number().int().min(1).max(10).default(4),
  maxConcurrentTasks: z.number().int().min(1).max(3).default(1),
  maxQueuedTasks: z.number().int().min(1).max(10).default(8),
  taskTimeoutMs: z.number().int().min(5000).max(90000).default(90000),
  computerMaxRounds:z.number().int().min(1).max(100).default(40),
  computerMaxActions:z.number().int().min(1).max(400).default(160),
  computerTimeoutMs:z.number().int().min(30000).max(1800000).default(600000),
  allowNotepad: z.boolean().default(true),
  voiceConsent: z.boolean().default(false),
  listenOnInvoke: z.boolean().default(false),
  autoHideSuccess: z.boolean().default(false),
  showResultsInMeeting: z.boolean().default(false),
  costControlsVersion: z.literal(1).default(1),
  monthlyBudgetEur: z.number().min(.1).max(1000).default(100),
  dailyTargetEur: z.number().min(.1).max(100).default(1),
  eurPerUsd: z.number().min(.1).max(3).default(1),
  maxContextChars: z.number().int().min(1000).max(12000).default(4000),
  interfaceSounds: z.boolean().default(true),
  interfaceAnimations: z.boolean().default(true),
  excludedWindows: z.array(z.string().min(1).max(120)).max(40).default([])
}).strict();
export type Settings = z.infer<typeof SettingsSchema>;
export type TaskState = 'idle' | 'queued' | 'listening' | 'thinking' | 'awaiting_approval' | 'awaiting_input' | 'executing' | 'completed' | 'failed' | 'cancelled';
export type Utterance = { speaker: 'user' | 'zen'; id: string; text: string; phase: 'start' | 'delta' | 'done'; sourceItemId?: string; timeline?: {startMs:number;endMs:number} };
export const ArtifactSchema = z.object({id:z.string().uuid(),title:z.string().max(160),kind:z.enum(['image','text'])}).strict();
export type Artifact = z.infer<typeof ArtifactSchema>;
export type TaskEvent = { id: string; state: TaskState; message: string; activity?:Activity; request?: string; streamText?: string; evidence?: Evidence; approval?: Approval; sessionId?: string; turnId?: string; utterance?: Utterance; contextConsumed?: boolean; artifacts?: Artifact[]; liveRequest?: {id:string;captionId:string;text:string}|null; screenContext?:ScreenContextStatus;workContext?:WorkContext };
export type Evidence = { application: 'notepad'; pid: number; windowHandle: string; alreadyOpen: boolean; verifiedAt: string };
export const RequestSchema = z.object({ text: z.string().trim().min(1).max(8000), requestId: z.string().uuid(), priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2), observationId: z.string().uuid().optional(), folderId: z.string().uuid().optional(), replyTaskId: z.string().uuid().optional() }).strict();
export type TaskResult = { id: string; state: 'completed' | 'awaiting_input' | 'failed' | 'cancelled'; message: string; evidence?: Evidence; sessionId?: string; turnId?: string; artifacts?: Artifact[];localOnly?:boolean;workContext?:WorkContext };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type SpendingSummary = { month: string; estimatedMonthEur: number; committedMonthEur: number; estimatedDayEur: number; pendingEur: number; inputTokens: number; outputTokens: number; cachedTokens: number; uncertainCalls: number; pricingDate: string };
export type PublicSettings = { spending?: SpendingSummary; settings: Settings; hasKey: boolean; shortcutRegistered: boolean; protectedStorage: boolean };
export const OverlayLayoutSchema = z.object({ mode: z.enum(['capsule', 'card', 'panel']), height: z.number().int().min(40).max(1000), reducedMotion: z.boolean().default(false) }).strict();
export type OverlayLayout = z.infer<typeof OverlayLayoutSchema>;
export const DockEdgeSchema = z.enum(['top', 'left', 'right']);
export type DockEdge = z.infer<typeof DockEdgeSchema>;
export const OverlayPositionSchema = z.object({ displayId: z.number().int(), horizontalRatio: z.number().min(0).max(1), edge: DockEdgeSchema.default('top'), verticalRatio: z.number().min(0).max(1).default(.5) }).strict();
export type OverlayPosition = z.infer<typeof OverlayPositionSchema>;
export const OverlayDragSchema = z.enum(['start', 'end']);
export interface ZenBridge {
  chooseContextFolder():Promise<Result<FolderAttachment|null>>;
  removeContextFolder(id:string):Promise<Result<boolean>>;
  projectPreview(id:string):Promise<Result<ProjectBundle>>;
  projectDestination(value:{id:string;grantId:string}):Promise<Result<ProjectDraft>>;
  projectApprove(value:{id:string;approvalId:string}):Promise<Result<{message:string;verified:true;destination:string}>>;
  projectDiscard(id:string):Promise<Result<boolean>>;
  chooseDirectory(): Promise<Result<{ grantId: string; label: string } | null>>;
  prepare(request: Prepare): Promise<Result<Approval>>;
  approve(id: string): Promise<Result<{ message: string; verified: true }>>;
  reject(id: string): Promise<Result<boolean>>;
  apps(): Promise<Result<{ id: string }[]>>;
  openApp(id: string): Promise<Result<{ id: string; pid: number; windowHandle: string; verified: true }>>;
  openPage(url: string): Promise<Result<{ url: string; title: string; verified: true }>>;
  openFile(): Promise<Result<{ selected: boolean; verified: boolean; name?: string }>>;
  openArtifact(id: string): Promise<Result<boolean>>;
  libraryRoots(): Promise<Result<string[]>>;
  saveLibraryRoots(paths:string[]): Promise<Result<string[]>>;
  mcpConnection(): Promise<Result<PublicMcpConnection|null>>;
  saveMcpConnection(value:{label:string;url:string;tools:string[];token?:string}):Promise<Result<PublicMcpConnection|null>>;
  deleteMcpConnection():Promise<Result<boolean>>;
  windows(): Promise<Result<WindowInfo[]>>;
  observe(request: { id: string; capture: boolean }): Promise<Result<{ observationId: string; text?: string; image?: string }>>;
  media(): Promise<Result<MediaInfo[]>>;
  pauseMedia(id: string): Promise<Result<{ id: string; verified: boolean; alreadyPaused: boolean }>>;
  profile(): Promise<Result<Profile>>;
  saveProfile(profile: Profile): Promise<Result<Profile>>;
  mode(): Promise<Result<ResponseMode>>;
  setMode(mode: ResponseMode): Promise<Result<ResponseMode>>;
  tasks(): Promise<Result<TaskEvent[]>>;
  settings(): Promise<Result<PublicSettings>>;
  saveSettings(settings: Settings): Promise<Result<PublicSettings>>;
  saveKey(key: string): Promise<Result<boolean>>;
  deleteKey(): Promise<Result<boolean>>;
  run(request: z.infer<typeof RequestSchema>): Promise<Result<TaskResult>>;
  stop(): Promise<Result<boolean>>;
  cancelTask(id: string): Promise<Result<boolean>>;
  hide(): Promise<Result<boolean>>;
  layout(layout: OverlayLayout): Promise<Result<boolean>>;
  drag(phase: z.infer<typeof OverlayDragSchema>): Promise<Result<boolean>>;
  dock(): Promise<Result<DockEdge>>;
  onDock(callback: (edge: DockEdge) => void): () => void;
  voiceInterrupt(): Promise<Result<boolean>>;
  voiceContext(observationId: string | null): Promise<Result<boolean>>;
  refreshScreen():Promise<Result<boolean>>;
  previewScreen():Promise<Result<ScreenSnapshot|null>>;
  attachImage(image:string):Promise<Result<{observationId:string}>>;
  voiceStart(sdp: string): Promise<Result<{ sessionId: string; sdp: string }>>;
  voiceEnd(sessionId: string): Promise<Result<boolean>>;
  liveReady(sessionId:string):Promise<Result<boolean>>;
  liveEnd(sessionId:string):Promise<Result<{finalized:boolean;reason?:string}>>;
  liveSubmit(requestId:string):Promise<Result<boolean>>;
  liveConfirm():Promise<Result<boolean>>;
  confirmations():Promise<Result<HumanConfirmation[]>>;
  onConfirmations(callback:(rows:HumanConfirmation[])=>void):()=>void;
  clearLogs(): Promise<Result<boolean>>;
  onTask(callback: (event: TaskEvent) => void): () => void;
  onInvoke(callback: (mode: 'configured' | 'voice' | 'focus' | 'capsule') => void): () => void;
  onVisibility(callback: (visible: boolean) => void): () => void;
  onMode(callback: (mode: ResponseMode) => void): () => void;
}
