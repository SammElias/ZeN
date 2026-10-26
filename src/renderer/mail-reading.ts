export type MailThreadReading={mode:'original'|'text';open:string[]};
export type MailReading={key:string;query:string;thread?:string;offset:number;pages:number;reading?:MailThreadReading;at:number};
let saved:MailReading|undefined;
/** Session-only cursor. Never keeps a message body, draft, credential or server page token. */
export function saveMailReading(value:MailReading){saved={key:value.key,query:value.query.slice(0,240),thread:value.thread,offset:Number.isFinite(value.offset)?Math.max(0,Math.min(1200000,value.offset)):0,pages:Math.max(1,Math.min(5,value.pages)),reading:value.reading?{mode:value.reading.mode,open:value.reading.open.slice(0,100)}:undefined,at:Date.now()};}
export function restoreMailReading(key?:string){if(!saved||!key||saved.key!==key||Date.now()-saved.at>14400000){saved=undefined;return;}return structuredClone(saved);}
export function clearMailReading(){saved=undefined;}
