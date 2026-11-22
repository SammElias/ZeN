import {z} from 'zod';

export const ProfileSyncAction = z.discriminatedUnion('type', [
  z.object({type: z.literal('status')}).strict(),
  z.object({type: z.literal('create')}).strict(),
  z.object({type: z.literal('join'), code: z.string().trim().regex(/^[a-fA-F0-9]{64}$/)}).strict(),
  z.object({type: z.literal('copyCode')}).strict(),
  z.object({type: z.literal('sync')}).strict(),
  z.object({type: z.literal('disconnect')}).strict(),
  z.object({type: z.literal('vault'), enabled: z.boolean()}).strict(),
  z.object({type: z.literal('resolve'), record: z.string().max(64), candidate: z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
]);
export type ProfileSyncAction = z.infer<typeof ProfileSyncAction>;
export type ProfileSyncStatus = {
  linked: boolean;
  lastSync?: number;
  peers: number;
  vault?: boolean;
  vaultError?: string;
  conflicts: {record: string; label: string; choices: {id: string; device: string; preview: string}[]}[];
  error?: string;
};
