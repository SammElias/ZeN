import {randomUUID} from 'node:crypto';
import type {CodexTransport} from './codex-rpc';
import type {CompanionTarget} from '../shared/codex-companion';
import {CompanionTargetSchema} from '../shared/codex-companion';
import {IntegrationTabSchema,IntegrationPrepareSchema,emptyCatalog,integrationActions,buildIntegrationPrompt,type IntegrationStatus,type IntegrationProposal,type IntegrationRequest,type IntegrationTab,type IntegrationCatalog} from '../shared/companion-integrations';

type Rpc=Pick<CodexTransport,'request'|'close'>;
type Policy={target?:CompanionTarget;targetError?:string;presentation:boolean;paused:boolean};
type Dependencies={rpc:()=>Promise<Rpc>;policy:()=>Policy;changed:()=>void;copy:(text:string)=>void;openChat:(id:string)=>Promise<void>;now?:()=>number};
/** Metadata discovery and a reviewed clipboard handoff. Never calls mail/music tools or resumes a chat. */
export class CompanionConnections{
 private catalog=emptyCatalog();private selected:IntegrationTab='connections';
 private proposal?:IntegrationProposal&{target:CompanionTarget};private lastHandoff?:IntegrationStatus['lastHandoff'];
 private checking?:Promise<boolean>;private disposed=false;private rpc?:Rpc;private generation=0;private now:()=>number;
 constructor(private deps:Dependencies){this.now=deps.now??Date.now;}
 status(includeProposal=false):IntegrationStatus{return structuredClone({...this.catalog,selected:this.selected,proposal:includeProposal&&this.proposal&&this.proposal.expiresAt>this.now()?{id:this.proposal.id,provider:this.proposal.provider,action:this.proposal.action,label:this.proposal.label,prompt:this.proposal.prompt,expiresAt:this.proposal.expiresAt}:undefined,lastHandoff:this.lastHandoff});}
 select(value:unknown){this.selected=IntegrationTabSchema.parse(value);this.cancel();}
 cancel(){this.proposal=undefined;this.deps.changed();}
 async check(force=false){
  if(this.disposed)throw Error('La ventana de integraciones se ha cerrado.');if(this.checking)return this.checking;
  if(!force&&this.catalog.phase==='ready'&&this.now()-(this.catalog.checkedAt??0)<60000)return true;
  const generation=++this.generation;this.proposal=undefined;this.catalog={...this.catalog,phase:'checking'};this.deps.changed();
  return this.checking=(async()=>{await Promise.resolve();let rpc:Rpc|undefined;try{
   if(this.disposed||generation!==this.generation)return false;
   rpc=await this.deps.rpc();if(this.disposed||generation!==this.generation){rpc.close();return false;}this.rpc=rpc;
   const tools=new Set<string>();let cursor:string|undefined;
   for(let page=0;page<3;page++){
    const result=await rpc.request('mcpServerStatus/list',{limit:40,detail:'toolsAndAuthOnly',...(cursor?{cursor}:{})});
    if(!Array.isArray(result?.data))throw Error('Catálogo no disponible.');
    for(const server of result.data.slice(0,40))if(server?.name==='codex_apps'&&server.tools&&typeof server.tools==='object'&&!Array.isArray(server.tools))for(const name of Object.keys(server.tools).slice(0,3000))if(/^(gmail|spotify)\.[a-z_]+$/.test(name))tools.add(name);
    if(!result.nextCursor){cursor=undefined;break;}if(typeof result.nextCursor!=='string'||result.nextCursor.length>4096)throw Error('Paginación no válida.');cursor=result.nextCursor;
   }
   if(cursor)throw Error('Catálogo incompleto.');if(this.disposed||generation!==this.generation)return false;
   this.catalog=catalogFromTools(tools,this.now());return true;
  }catch{if(!this.disposed&&generation===this.generation)this.catalog={...emptyCatalog(),phase:'error',checkedAt:this.now()};return false;}
  finally{rpc?.close();if(this.rpc===rpc)this.rpc=undefined;this.checking=undefined;if(!this.disposed)this.deps.changed();}})();
 }
 private policy(){const p=this.deps.policy();if(p.presentation)throw Error('Desactiva Presentación para preparar una consulta.');if(p.paused)throw Error('Reanuda ZEN antes de preparar una consulta.');if(p.targetError||!p.target)throw Error('Revisa el chat y proyecto fijados en Preferencias.');CompanionTargetSchema.parse(p.target);return p.target;}
 prepare(raw:IntegrationRequest){
  const target=this.policy(),input=IntegrationPrepareSchema.parse(raw),action=integrationActions[input.action];
  if(this.catalog.phase!=='ready'||!this.catalog.providers[action.provider].actions.includes(input.action))throw Error('Comprueba la conexión y las funciones disponibles en Codex.');
  this.proposal={id:randomUUID(),provider:action.provider,action:input.action,label:action.label,prompt:buildIntegrationPrompt(input),expiresAt:this.now()+120000,target:{...target}};this.deps.changed();return true;
 }
 async handoff(id:string){
  const target=this.policy(),proposal=this.proposal;
  if(!proposal||proposal.id!==id||proposal.expiresAt<=this.now())throw Error('La petición ya terminó o caducó. Prepárala de nuevo.');
  if(target.session!==proposal.target.session||target.cwd.toLowerCase()!==proposal.target.cwd.toLowerCase()){this.cancel();throw Error('El destino cambió. Revisa de nuevo la petición.');}
  this.proposal=undefined;this.lastHandoff={provider:proposal.provider,label:proposal.label,at:this.now(),copied:false,opened:false};
  try{this.deps.copy(proposal.prompt);this.lastHandoff.copied=true;try{await this.deps.openChat(target.session);this.lastHandoff.opened=true;}catch{/* A copied request is not resent; the user can open the fixed chat manually. */}return{...this.lastHandoff};}
  finally{this.deps.changed();}
 }
 close(){this.disposed=true;this.generation++;this.proposal=undefined;this.rpc?.close();}
}
export function catalogFromTools(tools:Set<string>,at:number):IntegrationCatalog{
 const value=emptyCatalog();value.phase='ready';value.checkedAt=at;
 for(const [id,action]of Object.entries(integrationActions))if(action.tools.every(group=>group.some(t=>tools.has(t))))value.providers[action.provider].actions.push(id as keyof typeof integrationActions);
 for(const provider of Object.values(value.providers))provider.available=provider.actions.length>0;
 return value;
}
