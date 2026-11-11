import {z} from 'zod';

export const MAX_CODEX_REQUEST = 8000;

export const CodexRequest = z.string().max(MAX_CODEX_REQUEST).refine(text =>
  text.trim().length > 0 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\uD800-\uDFFF]/u.test(text),
);

export type CodexRequestReceipt = {mode: 'queued'} | {mode: 'draft' | 'clipboard'; opened: boolean};
