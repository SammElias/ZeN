export type HumanConfirmation = { key:string; label:string; code:string; expiresAt:number;preview?:string };
const digits:Record<string,string>={cero:'0',uno:'1',una:'1',dos:'2',tres:'3',cuatro:'4',cinco:'5',seis:'6',siete:'7',ocho:'8',nueve:'9'};
export function confirmationCode(text:string):string|undefined {
  const match=/^\s*(?:confirmo|confirma|confirmar|acepto)\s+(?:el\s+c[oó]digo\s+)?([\p{L}\d\s]+)[.!]?\s*$/iu.exec(text);
  if(!match)return;
  const value=match[1].trim().split(/\s+/).map(word=>digits[word.toLowerCase()]??word).join('');
  return /^\d{4}$/.test(value)?value:undefined;
}
export const confirmationAttempt=(text:string)=>/^\s*(?:confirmo|confirma|confirmar|acepto)\b/i.test(text);
