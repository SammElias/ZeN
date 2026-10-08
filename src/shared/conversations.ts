import {z} from 'zod';
import type {ContextAttachment} from './drop-context';
import type {TaskEvent} from './contracts';

export type ChatRunState='pending'|'running'|'completed'|'incomplete'|'failed'|'cancel_requested'|'cancelled'|'interrupted'|'external';
export const chatStateLabel:Record<ChatRunState,string>={pending:'En cola',running:'En curso',completed:'Terminada',incomplete:'Estado por comprobar',failed:'Fallida',cancel_requested:'Cancelación solicitada',cancelled:'Cancelada',interrupted:'Estado por comprobar',external:'Pendiente de resultado externo'};
const id=z.string().uuid();
export const ChatDraftSchema=z.object({text:z.string().max(8000),attachmentIds:z.array(id).max(8),image:z.string().regex(/^data:image\/(png|jpeg|webp);base64,/).max(3000000).optional(),scrollTop:z.number().nonnegative().max(100000000).default(0),folderNotice:z.string().max(200).optional()}).strict();
export type ChatDraft=z.infer<typeof ChatDraftSchema>;
export const emptyChatDraft=():ChatDraft=>({text:'',attachmentIds:[],scrollTop:0});
export type ChatRow={id:string;projectId:string|null;title:string;createdAt:number;updatedAt:number;pinned:boolean;archived:boolean;partial:boolean;preview:string;state?:ChatRunState;version:number;reconstructed:boolean};
export type ChatMessage={id:string;seq:number;role:'user'|'assistant'|'context';text:string;state:ChatRunState;createdAt:number;runId?:string;partial:boolean;event?:TaskEvent};
export type ChatAttachment=ContextAttachment&{availability:'available'|'missing'|'changed'|'historical';problem?:string};
export type ChatTransfer={id:string;sourceId:string;sourceTitle:string;sourceProject:string|null;sourceVersion:number;text:string;createdAt:number;active:boolean};
export type ChatCheckpoint={version:number;throughSeq:number;objective:string;lastResult:string;pending:string;sourceIds:string[];updatedAt:number};
export type ChatSnapshot={chat:ChatRow;messages:ChatMessage[];hasOlder:boolean;draft:ChatDraft;attachments:ChatAttachment[];transfers:ChatTransfer[];checkpoint:ChatCheckpoint|null};
export const ConversationCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('list'),projectId:id.nullable(),filter:z.enum(['recent','pinned','archived']).default('recent'),query:z.string().max(200).default(''),offset:z.number().int().nonnegative().default(0)}).strict(),
 z.object({action:z.literal('active'),projectId:id.nullable()}).strict(),
 z.object({action:z.literal('create'),projectId:id.nullable()}).strict(),
 z.object({action:z.literal('open'),id}).strict(),
 z.object({action:z.literal('activity'),id}).strict(),
 z.object({action:z.literal('read'),id,before:z.number().int().positive().optional()}).strict(),
 z.object({action:z.literal('update'),id,title:z.string().trim().min(1).max(100).optional(),pinned:z.boolean().optional(),archived:z.boolean().optional()}).strict(),
 z.object({action:z.literal('draft'),id,draft:ChatDraftSchema}).strict(),
 z.object({action:z.literal('search'),id,query:z.string().trim().min(1).max(200)}).strict(),
 z.object({action:z.literal('message'),id,messageId:id}).strict(),
 z.object({action:z.literal('use-message'),id,messageId:id}).strict(),
 z.object({action:z.literal('use-attachment'),id,attachmentId:id}).strict(),
 z.object({action:z.literal('transfer'),sourceId:id,targetId:id.nullable(),targetProject:id.nullable(),sourceVersion:z.number().int().nonnegative(),text:z.string().trim().min(1).max(24000),attachmentIds:z.array(id).max(8).default([])}).strict(),
 z.object({action:z.literal('detach'),id,transferId:id}).strict(),
 z.object({action:z.literal('delete-preview'),id}).strict(),
 z.object({action:z.literal('delete-confirm'),id,code:z.string().regex(/^\d{4}$/)}).strict(),
 z.object({action:z.literal('cleanup')}).strict(),
 z.object({action:z.literal('reconcile'),id}).strict(),
]);
export type ConversationCommand=z.infer<typeof ConversationCommandSchema>;
export type ConversationReply={updates?:Pick<ChatSnapshot,'chat'|'messages'|'hasOlder'|'checkpoint'>;rows?:ChatRow[];snapshot?:ChatSnapshot;messages?:ChatMessage[];code?:string;notice?:string;pendingCleanup?:number};

/** Conservative local planning estimate; never a billed usage or price. */
export function contextTokens(input:unknown):number {
 const text=JSON.stringify(input);const images=(text.match(/"type":"input_image"/g)??[]).length;
 return Math.ceil(new TextEncoder().encode(text.replace(/data:image\/[^"\s]+/g,'[image]')).length/2)+images*8192;
}
