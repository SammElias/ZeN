import {z} from 'zod';
import {AppearanceOptions} from './companion-appearance';
import {CompanionSettingsSchema,migrateWindowPreferences} from './codex-companion';
import {LauncherOrder} from './companion-workspace';
import {HubData, HubDraft} from './knowledge-hub';
import {TemplateDraft} from './knowledge-templates';
import {CalendarLibrary} from './companion-calendar';

export const PortableSettings = CompanionSettingsSchema.pick({
  shortcut:true, returnShortcut:true, motion:true, sounds:true, interfaceSounds:true, interfaceVolume:true, notifications:true,
  followPointerDisplay:true, respectFullscreen:true, windowLocked:true, alwaysOnTop:true, dismissCapsuleOnOutsideClick:true,
  hideCapsuleFromTaskbar:true, collapseOnBlur:true, keepExpanded:true, officinaDesign:true,
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
  settings:z.preprocess(migrateWindowPreferences,PortableSettings),
  appearance:PortableAppearance,
  order:LauncherOrder,
  library:HubData,
  draft:HubDraft.optional(),
  templateDraft:TemplateDraft.optional(),
  calendar:CalendarLibrary.optional(),
}).strict();
export type CompanionBackup = z.infer<typeof CompanionBackup>;
