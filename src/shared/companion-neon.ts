import {z} from 'zod';

export const neonPalettes = {
  amber: {label: 'Ámbar solar', color: '#FFB547', core: '#FFF0BD'},
  cyan: {label: 'Cian eléctrico', color: '#36D9FF', core: '#D2F8FF'},
  violet: {label: 'Violeta plasma', color: '#A783FF', core: '#EEE3FF'},
  jade: {label: 'Verde jade', color: '#42E3B4', core: '#D5FFF0'},
} as const;

export const neonSpeeds = {
  slow: {label: 'Lenta', duration: 9000},
  normal: {label: 'Normal', duration: 6000},
  fast: {label: 'Rápida', duration: 4000},
} as const;

export const neonPaletteIds=Object.keys(neonPalettes) as (keyof typeof neonPalettes)[];
export const neonSpeedIds=Object.keys(neonSpeeds) as (keyof typeof neonSpeeds)[];
export const neonVisual = {line: 2.5, halo: 5, inset: 1.5, segment: .18, minimumIntensity: 15, maximumExtension: 18, frameMs: 1000 / 30} as const;

export const NeonOptions = z.object({
  enabled: z.boolean().default(true),
  palette: z.enum(neonPaletteIds).default('amber'),
  animated: z.boolean().default(true),
  intensity: z.number().int().min(neonVisual.minimumIntensity).max(100).default(60),
  speed: z.enum(neonSpeedIds).default('normal'),
  extension: z.number().int().min(0).max(neonVisual.maximumExtension).default(16),
}).strict();

export type NeonOptions = z.infer<typeof NeonOptions>;
export const defaultNeon = NeonOptions.parse({});
