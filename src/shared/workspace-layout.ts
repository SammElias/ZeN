import {z} from 'zod';

export const CapsuleLocation = z.enum(['top','left','right','floating']);
export type CapsuleLocation = z.infer<typeof CapsuleLocation>;
export const CapsuleMenuAnchor = z.object({x:z.int().min(0).max(32768),y:z.int().min(0).max(32768)}).strict();
export type CapsuleMenuAnchor = z.infer<typeof CapsuleMenuAnchor>;
export const WorkspaceLayoutPreferences = z.object({
  side: z.enum(['left', 'right']).default('left'),
  restoreOnLaunch: z.boolean().default(true),
  islandMode: z.enum(['edge','floating']).optional(),
  location: CapsuleLocation.optional(),
}).strict();
export type WorkspaceLayoutPreferences = z.infer<typeof WorkspaceLayoutPreferences>;

export const WorkspaceLayoutAction = z.enum(['left', 'right', 'free', 'maximize', 'restore']);
export type WorkspaceLayoutAction = z.infer<typeof WorkspaceLayoutAction>;
