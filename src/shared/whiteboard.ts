import {z} from 'zod';

export const boardSize = {width:960, height:640};
export const boardCoordinateLimit = 1_000_000;
export const boardLimits = {strokes:2000, points:100_000};
export const brushWidths = [2,5,12] as const;
export const boardColors = ['ink','blue','green','amber','red'] as const;

const width = z.literal(brushWidths);
const color = z.enum(boardColors);
const coordinate = z.number().min(-boardCoordinateLimit).max(boardCoordinateLimit);
const point = z.tuple([coordinate,coordinate]);
const clip = z.object({left:coordinate,top:coordinate,right:coordinate,bottom:coordinate}).strict()
  .refine(area=>area.left<area.right && area.top<area.bottom);
const points = z.array(point).min(1).max(boardLimits.points);
const stroke = z.discriminatedUnion('tool', [
  z.object({tool:z.literal('brush'),width,color,points,clip:clip.optional()}).strict(),
  z.object({tool:z.literal('eraser'),points,clip:clip.optional()}).strict(),
]);
export type BoardStroke = z.infer<typeof stroke>;
export type BoardPoint = z.infer<typeof point>;
export type BoardClip = z.infer<typeof clip>;

export const WhiteboardDocument = z.object({
  version:z.literal(1), width, color, strokes:z.array(stroke).max(boardLimits.strokes),
}).strict().refine(board=>board.strokes.reduce((total,stroke)=>total+stroke.points.length,0)<=boardLimits.points);
export type WhiteboardDocument = z.infer<typeof WhiteboardDocument>;

export const WhiteboardAction = z.discriminatedUnion('type', [
  z.object({type:z.literal('read')}).strict(),
  z.object({type:z.literal('save'),value:WhiteboardDocument}).strict(),
]);
export type WhiteboardAction = z.infer<typeof WhiteboardAction>;

export function emptyWhiteboard(): WhiteboardDocument {
  return {version:1,width:5,color:'ink',strokes:[]};
}
