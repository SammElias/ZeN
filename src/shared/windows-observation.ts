import { z } from 'zod';

export const BoundsSchema=z.object({x:z.number().int(),y:z.number().int(),width:z.number().int().positive(),height:z.number().int().positive()});
export const WindowSchema = z.object({ id: z.string().regex(/^\d+$/), title: z.string(), pid: z.number().int(), foreground: z.boolean(), processName:z.string().optional(), bounds:BoundsSchema.optional(),monitorBounds:BoundsSchema.optional() });
export const MediaSchema = z.object({ id: z.string(), title: z.string().default(''), state: z.string(), canPause: z.boolean() });
export type WindowInfo = z.infer<typeof WindowSchema>;
export type MediaInfo = z.infer<typeof MediaSchema>;
