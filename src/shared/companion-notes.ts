import {z} from 'zod';

export const noteLimits = {folder: 80, title: 120, description: 12000, code: 30000};
const folderName = z.string().trim().min(1).max(noteLimits.folder);
const noteId = z.uuid();

const noteFields = {
  folderId: noteId,
  title: z.string().trim().min(1).max(noteLimits.title),
  description: z.string().trim().min(1).max(noteLimits.description),
  code: z.string().max(noteLimits.code),
};

export const Notebook = z.object({
  version: z.literal(1),
  folders: z.array(z.object({id: noteId, name: folderName}).strict()).max(100),
  notes: z.array(z.object({
    ...noteFields,
    id: noteId,
    updatedAt: z.number().int().nonnegative().max(8640000000000000),
  }).strict()).max(1000),
}).strict();
export type Notebook = z.infer<typeof Notebook>;
export type Note = Notebook['notes'][number];

export const NotesChange = z.discriminatedUnion('type', [
  z.object({type: z.literal('createFolder'), name: folderName}).strict(),
  z.object({type: z.literal('renameFolder'), id: noteId, name: folderName}).strict(),
  z.object({type: z.literal('removeFolder'), id: noteId}).strict(),
  z.object({type: z.literal('saveNote'), id: noteId.optional(), ...noteFields}).strict(),
  z.object({type: z.literal('removeNote'), id: noteId}).strict(),
]);
export type NotesChange = z.infer<typeof NotesChange>;
export type NotesChangeResult = {notebook: Notebook; id?: string};
