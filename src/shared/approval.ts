import { z } from 'zod';
export const PrepareSchema = z.object({ grantId: z.string().uuid(), kind: z.enum(['create-folder', 'create-file']), name: z.string().min(1).max(100), content: z.string().max(16000).default('') }).strict();
export type Prepare = z.infer<typeof PrepareSchema>;
export type Approval = { id: string; kind: Prepare['kind']; title: string; destination: string; content?: string };
