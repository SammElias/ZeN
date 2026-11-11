import type {CodexDocumentFormat} from '../shared/codex-result-document';

export const codexDocumentFormats = {
  report: 'Informe',
  plan: 'Plan de trabajo',
  comparison: 'Comparación',
} satisfies Record<CodexDocumentFormat, string>;
