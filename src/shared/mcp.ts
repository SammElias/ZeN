import { z } from 'zod';
import type { Tool } from 'openai/resources/responses/responses';
import { ZenError } from './errors';
export const McpConnectionSchema=z.object({label:z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),url:z.url().refine(value=>{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname);},'Servidor HTTPS público sin credenciales o parámetros.'),tools:z.array(z.string().regex(/^(?:get_|list_|search_|read_|fetch_)[A-Za-z0-9_]+$/)).min(1).max(20)}).strict();
export type McpConnection=z.infer<typeof McpConnectionSchema>&{authorization?:string};
export type PublicMcpConnection=z.infer<typeof McpConnectionSchema>&{hasToken:boolean};
export function mcpTool(connection:McpConnection):Tool {return{type:'mcp',server_label:connection.label,server_url:connection.url,allowed_tools:connection.tools,require_approval:'always',...(connection.authorization?{authorization:connection.authorization}:{})};}
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
export function authorizeMcp(connection:McpConnection,name:string,args:string,originalRequest:string) {
  if(!connection.tools.includes(name)||!new RegExp('\\b'+name+'\\b').test(originalRequest))throw new ZenError('MCP requiere una herramienta de lectura configurada y nombrada en tu orden.');
  const start=originalRequest.indexOf('{'),end=originalRequest.lastIndexOf('}');
  if(start<0||end<start||args.length>8000)throw new ZenError('Para este primer puente MCP, indica los argumentos JSON exactos de la consulta; todavía no hay aprobación visual de llamadas externas.');
  let expected:unknown,actual:unknown;try{expected=JSON.parse(originalRequest.slice(start,end+1));actual=JSON.parse(args);}catch{throw new ZenError('Argumentos MCP inválidos.');}
  if(canonical(expected)!==canonical(actual))throw new ZenError('La llamada MCP no coincide con los argumentos autorizados.');
  return `${name}:${canonical(actual)}`;
}
