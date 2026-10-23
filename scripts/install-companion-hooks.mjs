// Explicit local setup only. Installs the reviewed relay, never grants hook trust.
import {build} from 'esbuild';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
if(process.platform!=='win32'||!process.env.APPDATA)throw Error('Requiere Windows.');
const bundle=resolve('release/companion-setup.cjs');
await build({stdin:{contents:"export {CompanionIntegration} from './src/main/companion-integration'; export {CompanionHub} from './src/main/companion-hub'; export {CompanionSettingsSchema} from './src/shared/codex-companion'; export {CodexRpc} from './src/main/codex-rpc';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:bundle});
const {CompanionIntegration,CompanionHub,CompanionSettingsSchema,CodexRpc}=await import(pathToFileURL(bundle));
const profile=join(process.env.APPDATA,'ZEN'),codexHome=process.env.CODEX_HOME??join(homedir(),'.codex');
const hub=new CompanionHub(CompanionSettingsSchema.parse({}),()=>{},()=>{});
const integration=new CompanionIntegration(profile,codexHome,resolve('dist/hook'),hub);
const report={at:new Date().toISOString(),installed:false,trustChanged:false,modelRequests:0,sessionCheck:'unchecked',hooksReviewedByCodex:[],errors:[]};
let rpc;
try{
 // Do not bind the app's existing pipe or alter its bridge token during installation.
 await integration.install();report.installed=hub.installed;
 report.helperSha256=createHash('sha256').update(await readFile(integration.executable)).digest('hex');
 rpc=new CodexRpc();await rpc.initialize();
 const account=await rpc.request('account/read',{refreshToken:false});report.sessionCheck=account.account?.type??'missing';
 const result=await rpc.request('hooks/list',{cwds:[process.cwd()]});
 // Keep only ZEN's event and trust metadata, never other hook commands or account identity.
 report.hooksReviewedByCodex=(result.data??[]).flatMap(row=>(row.hooks??[]).filter(h=>JSON.stringify(h).includes(integration.executable.replaceAll('\\','\\\\'))||JSON.stringify(h).includes('Zen.CodexHook')).map(h=>({event:h.eventName??h.event??null,trust:h.trustStatus??h.trust??null})));
 report.codexHookErrors=(result.data??[]).reduce((n,row)=>n+(row.errors?.length??0),0);
}catch(e){report.errors.push(e?.code??'setup-or-local-check-failed');process.exitCode=1;}
finally{rpc?.close();integration.close();}
await writeFile('docs/evidence/companion-integration-install.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
