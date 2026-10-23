import type {CodexTransport} from './codex-rpc';
import type {CompanionSession} from '../shared/codex-companion';
import {hookEvents} from '../shared/codex-companion';
import {hookConnection} from '../shared/companion-presentation';
/** Read-only metadata. Never resumes a chat, reads turns, submits work or changes trust. */
export async function inspectCodexCompanion(rpc:Pick<CodexTransport,'request'>,command:string,cwd:string,sessions:CompanionSession[]){
 const account=await rpc.request('account/read',{refreshToken:false});
 const connection=hookConnection(await rpc.request('hooks/list',{cwds:[cwd]}),command,hookEvents.length);
 const titles=new Map<string,string>();
 for(const session of sessions.filter(s=>!s.title).slice(0,6)){
  try{const result=await rpc.request('thread/read',{threadId:session.id,includeTurns:false});const name=result.thread?.name;if(result.thread?.id===session.id&&typeof name==='string'&&name.trim()&&name.length<=200)titles.set(session.id,name.trim());}
  catch{/* A missing title never prevents the hook status from being shown. */}
 }
 return{account:account.account?.type==='chatgpt'?'chatgpt' as const:account.account?'unsupported' as const:'missing' as const,connection,titles};
}
