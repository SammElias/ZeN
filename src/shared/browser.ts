import {z} from 'zod';

export const BrowserCommandSchema = z.discriminatedUnion('action', [
  z.object({action:z.literal('navigate'),url:z.string().trim().min(1).max(4000)}).strict(),
  z.object({action:z.enum(['back','forward','reload','stop','external'])}).strict()
]);
export const BrowserViewportSchema = z.object({visible:z.boolean(),bounds:z.object({x:z.number().int().min(0).max(10000),y:z.number().int().min(0).max(10000),width:z.number().int().min(0).max(10000),height:z.number().int().min(0).max(10000)}).strict().optional()}).strict();
export type BrowserCommand = z.infer<typeof BrowserCommandSchema>;
export type BrowserViewport = z.infer<typeof BrowserViewportSchema>;
export type BrowserState = {url:string;title:string;loading:boolean;canBack:boolean;canForward:boolean;error?:string;externalUrl?:string};
export const emptyBrowserState:BrowserState = {url:'',title:'Tu navegador',loading:false,canBack:false,canForward:false};

export function browserUrl(input:string):string {
  const value=input.trim();
  const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(value)?value:'https://'+value);
  if(url.protocol!=='https:'||url.username||url.password)throw Error('Introduce una dirección HTTPS sin credenciales.');
  return url.href;
}
export function googleSignIn(url:string):boolean {
  try{return new URL(url).hostname==='accounts.google.com';}catch{return false;}
}
// Strip login callbacks/tokens before offering the system browser. Its session
// is separate: opening it cannot authenticate the embedded browser.
export function externalBrowserUrl(input:string):string {
  const url=new URL(browserUrl(input));
  if(url.hostname==='chatgpt.com'||url.hostname.endsWith('.chatgpt.com')||['auth.openai.com','auth0.openai.com'].includes(url.hostname))return 'https://chatgpt.com/';
  if(googleSignIn(url.href))return 'https://accounts.google.com/';
  return url.href;
}
