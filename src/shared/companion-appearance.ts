import {z} from 'zod';
export const glassOpacity = {minimum: .74, maximum: 1, initial: .90} as const;
export const AppearanceOptions=z.object({
 theme:z.enum(['dark','light','monochrome']).default('monochrome'),
 accent:z.enum(['violet','amber','mint']).default('violet'),
 background:z.enum(['aurora','dusk','image']).default('aurora'),
 opacity:z.number().min(glassOpacity.minimum).max(glassOpacity.maximum).default(glassOpacity.initial),
 blur:z.number().int().min(0).max(40).default(24),
}).strict();
export type AppearanceOptions=z.infer<typeof AppearanceOptions>;
export type AppearanceState=AppearanceOptions&{imageUrl?:string;imageName?:string};
export const defaultAppearance=AppearanceOptions.parse({});
