import { z } from 'zod';
import type { Profile, ResponseMode } from './personal';
import type { WindowInfo, MediaInfo } from '../tools/windows/native';
import type { Approval, Prepare } from './approval';
export const SettingsSchema = z.object({
  reasoningModel: z.string().regex(/^gpt-[a-z0-9.-]+$/).default('gpt-6.1-sol'),
  voiceModel: z.string().regex(/^gpt-[a-z0-9.-]+$/).default('gpt-realtime-2.1'),
  shortcut: z.string().min(3).max(80).default('Control+Alt+Z'),
  maxToolCalls: z.number().int().min(1).max(10).default(10),
  maxConcurrentTasks: z.number().int().min(1).max(3).default(2),
  maxQueuedTasks: z.number().int().min(1).max(10).default(8),
  taskTimeoutMs: z.number().int().min(5000).max(90000).default(90000),
  allowNotepad: z.boolean().default(true),
  voiceConsent: z.boolean().default(false),
  listenOnInvoke: z.boolean().default(false),
  autoHideSuccess: z.boolean().default(false),
  showResultsInMeeting: z.boolean().default(false),
  excludedWindows: z.array(z.string().min(1).max(120)).max(40).default([])
}).strict();
export type Settings = z.infer<typeof SettingsSchema>;
export type TaskState = 'idle' | 'queued' | 'listening' | 'thinking' | 'awaiting_approval' | 'awaiting_input' | 'executing' | 'completed' | 'failed' | 'cancelled';
export type TaskEvent = { id: string; state: TaskState; message: string; request?: string; streamText?: string; evidence?: Evidence; approval?: Approval; sessionId?: string; turnId?: string };
export type Evidence = { application: 'notepad'; pid: number; windowHandle: string; alreadyOpen: boolean; verifiedAt: string };
export const RequestSchema = z.object({ text: z.string().trim().min(1).max(8000), requestId: z.string().uuid(), priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2), observationId: z.string().uuid().optional(), replyTaskId: z.string().uuid().optional() }).strict();
export type TaskResult = { id: string; state: 'completed' | 'awaiting_input' | 'failed' | 'cancelled'; message: string; evidence?: Evidence; sessionId?: string; turnId?: string };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type PublicSettings = { settings: Settings; hasKey: boolean; shortcutRegistered: boolean; protectedStorage: boolean };
export const OverlayLayoutSchema = z.object({ mode: z.enum(['capsule', 'card', 'panel']), height: z.number().int().min(48).max(1000), reducedMotion: z.boolean().default(false) }).strict();
export type OverlayLayout = z.infer<typeof OverlayLayoutSchema>;
export interface ZenBridge {
  chooseDirectory(): Promise<Result<{ grantId: string; label: string } | null>>;
  prepare(request: Prepare): Promise<Result<Approval>>;
  approve(id: string): Promise<Result<{ message: string; verified: true }>>;
  reject(id: string): Promise<Result<boolean>>;
  apps(): Promise<Result<{ id: string }[]>>;
  openApp(id: string): Promise<Result<{ id: string; pid: number; windowHandle: string; verified: true }>>;
  openPage(url: string): Promise<Result<{ url: string; title: string; verified: true }>>;
  openFile(): Promise<Result<{ selected: boolean; verified: boolean; name?: string }>>;
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
  voiceInterrupt(): Promise<Result<boolean>>;
  voiceStart(sdp: string): Promise<Result<{ sessionId: string; sdp: string }>>;
  voiceEnd(sessionId: string): Promise<Result<boolean>>;
  clearLogs(): Promise<Result<boolean>>;
  onTask(callback: (event: TaskEvent) => void): () => void;
  onInvoke(callback: (mode: 'configured' | 'voice' | 'focus') => void): () => void;
  onVisibility(callback: (visible: boolean) => void): () => void;
  onMode(callback: (mode: ResponseMode) => void): () => void;
}
