import {z} from 'zod';

export const VAULT_MASK = '••••••••';
export const VAULT_REVEAL_MS = 10_000;
export const VAULT_CLIPBOARD_MS = 30_000;
const name = z.string().trim().min(1);
const id = z.string().min(1);
export const VaultChange = z.discriminatedUnion('type', [
 z.object({type:z.literal('project'), id:id.optional(), name}).strict(),
 z.object({type:z.literal('removeProject'), id, accounts:z.number().int().nonnegative()}).strict(),
 z.object({type:z.literal('account'), project:id, id:id.optional(), service:name, user:z.string(), password:z.string().min(1).optional()}).strict(),
 z.object({type:z.literal('removeAccount'), project:id, id}).strict(),
]);
export type VaultChange = z.infer<typeof VaultChange>;
export const VaultRequest = z.discriminatedUnion('type', [
 z.object({type:z.literal('enter')}).strict(),
 z.object({type:z.literal('lock')}).strict(),
 z.object({type:z.literal('conceal')}).strict(),
 z.object({type:z.literal('create'), session:id, master:z.string().min(1), confirmation:z.string().min(1)}).strict(),
 z.object({type:z.literal('unlock'), session:id, master:z.string().min(1)}).strict(),
 z.object({type:z.literal('hello-enable'), session:id, master:z.string().min(1)}).strict(),
 z.object({type:z.literal('hello-unlock'), session:id}).strict(),
 z.object({type:z.literal('hello-disable'), session:id}).strict(),
 z.object({type:z.literal('change'), session:id, change:VaultChange}).strict(),
 z.object({type:z.literal('reveal'), session:id, project:id, id}).strict(),
 z.object({type:z.literal('copy'), session:id, project:id, id, field:z.enum(['user','password'])}).strict(),
]);
export type VaultRequest = z.infer<typeof VaultRequest>;
export type VaultAccount = {id:string;service:string;user:string};
export type VaultProject = {id:string;name:string;accounts:VaultAccount[]};
export type VaultSnapshot = {exists:boolean;locked:boolean;hello?:'available'|'enabled';projects?:VaultProject[]};
export type VaultReply = {type:'state';state:VaultSnapshot;session?:string} | {type:'secret';value:string;expiresAt:number} | {type:'copied'};
export type VaultSignal = 'lock' | 'conceal';
export const vaultSignalChannel = 'companion:vault-signal';
