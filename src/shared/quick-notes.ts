import {z} from 'zod';

export const QuickNotes = z.object({
  text: z.string().max(1_000_000),
  selectionStart: z.number().int().nonnegative(),
  selectionEnd: z.number().int().nonnegative(),
  selectionDirection: z.enum(['forward','backward','none']),
  scrollTop: z.number().finite().nonnegative(),
}).strict().refine(value => value.selectionStart <= value.selectionEnd && value.selectionEnd <= value.text.length);
export type QuickNotes = z.infer<typeof QuickNotes>;

export const QuickNotesAction = z.discriminatedUnion('type', [
  z.object({type:z.literal('read')}).strict(),
  z.object({type:z.literal('save'),value:QuickNotes}).strict(),
]);
export type QuickNotesAction = z.infer<typeof QuickNotesAction>;

export const emptyQuickNotes: Readonly<QuickNotes> = {
  text:'', selectionStart:0, selectionEnd:0, selectionDirection:'none', scrollTop:0,
};
