import { z } from 'zod';
export const SettingsSchema = z.object({
  reasoningModel: z.string().regex(/^gpt-[a-z0-9.-]+$/).default('gpt-6-astra'),
  voiceModel: z.string().regex(/^gpt-[a-z0-9.-]+$/).default('gpt-realtime-2.1'),
  shortcut: z.string().min(3).max(80).default('Control+Alt+Z'),
  maxToolCalls: z.number().int().min(1).max(10).default(10),
  taskTimeoutMs: z.number().int().min(5000).max(90000).default(90000),
  allowNotepad: z.boolean().default(true),
  voiceConsent: z.boolean().default(false)
}).strict();
export type Settings = z.infer<typeof SettingsSchema>;
export type TaskState = 'idle' | 'listening' | 'thinking' | 'awaiting_approval' | 'executing' | 'completed' | 'failed' | 'cancelled';
export type TaskEvent = { id: string; state: TaskState; message: string; evidence?: Evidence };
export type Evidence = { application: 'notepad'; pid: number; windowHandle: string; alreadyOpen: boolean; verifiedAt: string };
export const RequestSchema = z.object({ text: z.string().trim().min(1).max(8000), requestId: z.string().uuid() }).strict();
export type TaskResult = { id: string; state: 'completed' | 'failed' | 'cancelled'; message: string; evidence?: Evidence };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type PublicSettings = { settings: Settings; hasKey: boolean; shortcutRegistered: boolean; protectedStorage: boolean };
export interface ZenBridge {
  settings(): Promise<Result<PublicSettings>>;
  saveSettings(settings: Settings): Promise<Result<PublicSettings>>;
  saveKey(key: string): Promise<Result<boolean>>;
  deleteKey(): Promise<Result<boolean>>;
  run(request: z.infer<typeof RequestSchema>): Promise<Result<TaskResult>>;
  stop(): Promise<Result<boolean>>;
  voiceStart(sdp: string): Promise<Result<{ sessionId: string; sdp: string }>>;
  voiceEnd(sessionId: string): Promise<Result<boolean>>;
  clearLogs(): Promise<Result<boolean>>;
  onTask(callback: (event: TaskEvent) => void): () => void;
  onInvoke(callback: () => void): () => void;
}
