import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {saveChatImage} from './chat-images';
import type {BrowserWindow} from 'electron';
import type {ConversationStore} from '../storage/conversations';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {writeEvidence as writeFile} from './evidence-file';

/** Real local SQLite/IPC/renderer, with synthetic task records and DOM input. No API. */
export async function conversationsSmoke(window:BrowserWindow,store:ConversationStore){
 const a=store.create(null,'Conversación A'),b=store.create(null,'Conversación B');
 for(let i=0;i<38;i++){const id=randomUUID();store.begin(a.id,id,'Pregunta de prueba '+i);store.finish(id,{id,state:'completed',message:`Respuesta ${i}: `+'Contenido de prueba para revisar el desplazamiento. '.repeat(8)});}
 const imageMessage=store.messages(a.id).filter(m=>m.role==='user').at(-1)!;
 saveChatImage(store,a.id,imageMessage.runId!,'data:image/png;base64,'+readFileSync(join(process.cwd(),'public/icons/zen-256.png')).toString('base64'),'Captura de prueba.png');
 store.saveDraft(a.id,{text:'Borrador persistente A',attachmentIds:[],scrollTop:80});store.saveDraft(b.id,{text:'Borrador persistente B',attachmentIds:[],scrollTop:0});store.setActive(a.id);
 const call=(code:string)=>window.webContents.executeJavaScript(code);
 const wait=async(code:string)=>{for(let n=0;n<100;n++){if(await call(code).catch(()=>false))return;await new Promise(r=>setTimeout(r,50));}throw Error('Conversations UI condition failed: '+code);};
 window.webContents.reload();await wait("!!document.querySelector('.chat-topbar')");await call("document.querySelector('[aria-label=Chat]').click()");
 await wait("document.querySelector('#chat-input')?.value==='Borrador persistente A'");
 const checks:Record<string,unknown>={at:new Date().toISOString(),scope:'Windows Electron/SQLite/IPC real; tareas y entrada DOM simuladas',apiCalled:false,physicalInputTested:false};
 checks.restoredActiveDraft=await call("document.querySelector('.conversations').getAttribute('aria-label')==='Conversación: Conversación A'&&document.querySelectorAll('.history-message').length===60");
 await call("document.querySelector('.chat-navigation button[aria-label=Conversaciones]').click()");await wait("document.querySelectorAll('.chat-row').length>=2");
 await call("[...document.querySelectorAll('.chat-row')].find(b=>b.textContent.includes('Conversación B')).click()");await wait("document.querySelector('#chat-input')?.value==='Borrador persistente B'");
 checks.draftsIsolated=await call("document.querySelectorAll('.history-message').length===0");
 await call("document.querySelector('.chat-navigation button[aria-label=Conversaciones]').click()");await wait("document.querySelectorAll('.chat-row').length>=2");await call("[...document.querySelectorAll('.chat-row')].find(b=>b.textContent.includes('Conversación A')).click()");await wait("document.querySelector('#chat-input')?.value==='Borrador persistente A'");
 await call("[...document.querySelectorAll('.conversations button')].find(b=>b.textContent==='Cargar mensajes anteriores').click()");await wait("document.querySelectorAll('.history-message').length===76");checks.historyPagination=true;
 await call("document.querySelector('.chat-image-thumbnail').scrollIntoView({block:'center'})");
 await wait("document.querySelector('.chat-image-thumbnail img')?.naturalWidth>0");
 checks.messageImageVisible=await call("!!document.querySelector('.history-message.user .chat-image-thumbnail img')");
 await call("document.querySelector('.chat-image-thumbnail').click()");await wait("document.querySelector('.chat-image-dialog[open] img')?.naturalWidth===256&&!document.querySelector('.chat-image-dialog [role=status]')");
 checks.messageImageViewer=await call("document.querySelector('.chat-image-dialog').getBoundingClientRect().width<=innerWidth&&!!document.querySelector('[aria-label=\"Cerrar imagen\"]')");
 await mkdir('docs/ui-preview/chat-images',{recursive:true});
 await writeFile('docs/ui-preview/chat-images/viewer.png',(await window.webContents.capturePage()).toPNG());
 await call("document.querySelector('.chat-image-dialog').dispatchEvent(new Event('cancel',{cancelable:true}))");await wait("!document.querySelector('.chat-image-dialog[open]')");
 checks.messageImageClose=await call("document.activeElement?.classList.contains('chat-image-thumbnail')");
 const imageId=store.messages(a.id).find(m=>m.id===imageMessage.id)!.images![0].id;
 checks.messageImageScope=await call(`(async()=>{const r=await window.zen.conversations({action:'message-image',id:'${b.id}',messageId:'${imageMessage.id}',imageId:'${imageId}',size:'full'});return !r.ok;})()`);
 checks.sizes=[];await mkdir('docs/ui-preview/conversations',{recursive:true});
 for(const[width,height]of [[320,480],[640,560],[960,640]]){window.setBounds({...window.getBounds(),width,height});await new Promise(r=>setTimeout(r,200));const geometry=await call("(()=>{const b=document.querySelector('.composer-send').getBoundingClientRect(),s=document.querySelector('.chat-scroll-content');return{width:innerWidth,height:innerHeight,noHorizontalScroll:document.body.scrollWidth<=innerWidth,composerVisible:b.bottom<=innerHeight&&b.left>=0,internalScroll:s.scrollHeight>s.clientHeight};})()");(checks.sizes as unknown[]).push(geometry);await writeFile(`docs/ui-preview/conversations/native-${width}.png`,(await window.webContents.capturePage()).toPNG());}
 checks.responsive=(checks.sizes as any[]).every(s=>s.noHorizontalScroll&&s.composerVisible&&s.internalScroll);
 checks.noCostControls=await call("!document.querySelector('.conversations').textContent.match(/créditos|consumo|coste|€|USD/)");
 checks.localChatQueue=await call(`(async()=>{const drop=await window.zen.dropText({text:'Referencia sintética de continuidad local: 739162',link:false});if(!drop.ok)return false;const one={chatId:'${a.id}',requestId:crypto.randomUUID(),text:'Resume solo localmente sin API',attachmentIds:[drop.value.id],contextMode:'none',projectContextId:null},two={...one,requestId:crypto.randomUUID(),text:'Lee solo localmente sin API'};const results=await Promise.all([window.zen.run(one),window.zen.run(two)]);const again=await window.zen.run(one);const read=await window.zen.conversations({action:'read',id:'${a.id}'});return results.every(r=>r.ok&&r.value.localOnly&&r.value.message.includes('739162'))&&again.ok&&again.value.id===results[0].value.id&&read.ok&&read.value.snapshot.messages.filter(m=>m.runId===one.requestId).length===2;})()`);
 checks.deleteConfirmation=await call(`(async()=>{const r=await window.zen.conversations({action:'delete-preview',id:'${b.id}'});if(!r.ok)return false;const removed=await window.zen.conversations({action:'delete-confirm',id:'${b.id}',code:r.value.code});const read=await window.zen.conversations({action:'read',id:'${b.id}'});return removed.ok&&!read.ok;})()`);
 checks.passed=['messageImageVisible','messageImageViewer','messageImageClose','messageImageScope','restoredActiveDraft','draftsIsolated','historyPagination','responsive','noCostControls','localChatQueue','deleteConfirmation'].every(k=>checks[k]===true);
 await writeFile('docs/evidence/conversations-native.json',JSON.stringify(checks,null,2));return checks.passed===true;
}
