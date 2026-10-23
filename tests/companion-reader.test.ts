import {it,expect} from 'vitest';
import {inspectCodexCompanion} from '../src/main/companion-codex-reader';
const s=(id:string)=>({id,cwd:'C:\\test',label:id,state:'idle' as const,at:1,steps:[]});
it('uses only read-only account, hook and metadata requests and discards conversation previews',async()=>{
 const calls:{method:string;params:any}[]=[];
 const result=await inspectCodexCompanion({request:async(method,params)=>{calls.push({method,params});if(method==='account/read')return{account:{type:'chatgpt',email:'DO NOT KEEP'}};if(method==='hooks/list')return{data:[]};return{thread:{id:'known',name:'Nombre del chat',preview:'DO NOT KEEP',turns:[]}};}},'own','C:\\test',[s('known')]);
 expect(calls.map(c=>c.method)).toEqual(['account/read','hooks/list','thread/read']);expect(calls[2].params).toEqual({threadId:'known',includeTurns:false});expect(result.titles.get('known')).toBe('Nombre del chat');expect(JSON.stringify({...result,titles:[...result.titles]})).not.toContain('DO NOT KEEP');
});
it('ignores missing metadata and mismatched identities without reading message previews',async()=>{
 const result=await inspectCodexCompanion({request:async(method,params:any)=>method==='account/read'?{account:null}:method==='hooks/list'?{data:[]}:{thread:{id:'different',name:'Wrong',preview:'Not a title'}}},'own','C:\\test',[s('known')]);
 expect(result.account).toBe('missing');expect(result.titles.size).toBe(0);
});
