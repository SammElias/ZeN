import {z} from 'zod';
export const AppearanceOptions=z.object({theme:z.enum(['dark','light']).default('dark'),accent:z.enum(['violet','amber','mint']).default('violet'),background:z.enum(['aurora','dusk','image']).default('aurora'),opacity:z.number().min(.28).max(.96).default(.86),blur:z.number().int().min(0).max(40).default(24)}).strict();
export type AppearanceOptions=z.infer<typeof AppearanceOptions>;
export type AppearanceState=AppearanceOptions&{imageUrl?:string;imageName?:string};
export const defaultAppearance=AppearanceOptions.parse({});
