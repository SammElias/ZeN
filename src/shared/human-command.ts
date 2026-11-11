// Input must be the original human turn. This is syntax normalization, not a grant
// of authority to text from documents, window titles, tool output or the model.
export function humanCommand(text: string): string {
  let value = text.trim();
  let question = value.startsWith('¿');
  value = value.replace(/^[¿¡]\s*/, '');
  value = value.replace(/^(?:oye[,\s]+)?(?:zen|cem)[,\s]+/i, '');
  question ||= value.startsWith('¿');
  value = value.replace(/^[¿¡]\s*/, '');
  value = value.replace(/^por favor[,\s]+/i, '');
  const polite = /^(?:puedes|podr[ií]as|puede usted)\s+/i.test(value);
  value = value.replace(/^(?:puedes|podr[ií]as|puede usted)\s+/i, '');
  if (question || polite) value = value.replace(/[?!.]+$/, '').trim();
  return value.replace(/[,\s]+por favor[.!?]*$/i, '').trim();
}

export function commandClauses(text: string): string[] {
  // Do not split "y" inside a file/app name or a URL. A following verb is needed.
  return humanCommand(text).split(/\s+(?:y(?:\s+luego)?|despu[eé]s|luego)\s+(?=(?:no\s+)?(?:abre(?:me)?|[aá]breme|abrir(?:me)?|inicia(?:r)?|lanza(?:r)?|open|p[aá]usa(?:r)?(?:me)?|para|det[eé]n|confirma|env[ií]a|borra|lee|mira|captura|crea|prepara)\b)/i);
}
