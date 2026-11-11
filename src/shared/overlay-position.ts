import { z } from 'zod';

export type Area = { x: number; y: number; width: number; height: number };

export const DockEdgeSchema = z.enum(['top', 'left', 'right']);
export type DockEdge = z.infer<typeof DockEdgeSchema>;

export const CapsuleAlignment = z.enum(['left', 'center', 'right']);
export type CapsuleAlignment = z.infer<typeof CapsuleAlignment>;

export const DisplayPlacementSchema = z.object({
  displayId: z.number().int(),
  edge: DockEdgeSchema,
  horizontalRatio: z.number().min(0).max(1),
  verticalRatio: z.number().min(0).max(1),
}).strict();

export const OverlayPositionSchema = DisplayPlacementSchema.extend({
  edge: DockEdgeSchema.default('top'),
  verticalRatio: DisplayPlacementSchema.shape.verticalRatio.default(.5),
});
export type OverlayPosition = z.infer<typeof OverlayPositionSchema>;
