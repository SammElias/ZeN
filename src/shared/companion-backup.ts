import {z} from 'zod';
import {AppearanceOptions} from './companion-appearance';
import {CompanionSettingsSchema} from './codex-companion';
import {LauncherOrder} from './companion-workspace';
import {HubData, HubDraft} from './knowledge-hub';

export const PortableSettings = CompanionSettingsSchema.pick({
  shortcut:true, returnShortcut:true, motion:true, sounds:true, notifications:true,
  followPointerDisplay:true, respectFullscreen:true, keepOnTop:true,
});

export const PortableAppearance = z.object({
  options: AppearanceOptions,
  wallpaper: z.object({
    name:z.string().min(1).max(200).regex(/^[^\x00-\x1f\\/]+$/),
    png:z.string().min(1).max(16*1024*1024),
  }).strict().optional(),
}).strict().refine(value=>value.options.background!=='image'||value.wallpaper!==undefined);
export type PortableAppearance = z.infer<typeof PortableAppearance>;

export const CompanionBackup = z.object({
  format:z.literal('zen-backup'),
  version:z.literal(1),
  settings:PortableSettings,
  appearance:PortableAppearance,
  order:LauncherOrder,
  library:HubData,
  draft:HubDraft.optional(),
}).strict();
export type CompanionBackup = z.infer<typeof CompanionBackup>;
