import { z } from 'zod';
export const DesktopCallSchema = z.object({
  operation: z.enum(['list_apps', 'list_windows', 'list_media', 'list_directories', 'open_app', 'open_page', 'read_window', 'capture_window', 'pause_media', 'prepare_file', 'prepare_folder']),
  target: z.string().max(4000).nullable(), name: z.string().max(200).nullable(), content: z.string().max(16000).nullable()
}).strict();
export type DesktopCall = z.infer<typeof DesktopCallSchema>;
export type DesktopHandler = (arguments_: unknown, signal: AbortSignal) => Promise<unknown>;
