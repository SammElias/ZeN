// Actual renderer with explicitly identified synthetic IPC data; no model API.
import {chromium} from 'playwright';import {createServer} from 'node:http';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve,sep,extname} from 'node:path';import assert from 'node:assert/strict';
const root=resolve('dist/renderer'),dir='docs/ui-preview/simple-chat';await mkdir(dir,{recursive:true});const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+sep))throw Error();res.setHeader('Content-Type',{'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.gif':'image/gif'}[extname(p)]??'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:640,height:560}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 const a=crypto.randomUUID(),b=crypto.randomUUID(),now=Date.now();window.fixtureCalls=[];window.fixtureRuns=[];window.fixtureCurrent=a;
 const row=(id,title)=>({id,projectId:null,title,createdAt:now,updatedAt:now,pinned:false,archived:false,partial:false,preview:'Datos de prueba identificados',state:'completed',version:1,reconstructed:false});
 const rich='## Ejemplo de prueba\n\n> Esta cita debe verse como una cita.\n\nTexto **destacado** y [documentación](https://example.com/docs).\n\n1. Paso uno\n2. Paso dos\n\n```js\n// > símbolo literal\nconst dato = "**sin formato**";\n```\n\n| Columna | Estado |\n| --- | --- |\n| Referencia | Preparada |';
 const messages=Array.from({length:80},(_,i)=>({id:crypto.randomUUID(),seq:i+1,role:i%2?'assistant':'user',text:i===79?rich:(i%2?'Respuesta de prueba. ':'Pregunta de prueba. ')+(i%2?'Texto para verificar la lectura sin saltos. '.repeat(6):''),state:'completed',createdAt:now+i,partial:false}));
 window.fixtureData={[a]:{chat:row(a,'[Prueba] Licencias SharePoint'),messages:messages.slice(-30),hasOlder:true,draft:{text:'Borrador de A',attachmentIds:[],scrollTop:100},attachments:[],transfers:[],checkpoint:null},[b]:{chat:row(b,'[Prueba] Conversación vacía'),messages:[],hasOlder:false,draft:{text:'Borrador de B',attachmentIds:[],scrollTop:0},attachments:[],transfers:[],checkpoint:null}};
 window.fixtureData[a].chat.partial=true;window.fixtureData[a].checkpoint={objective:'Metadato de prueba',lastResult:'Resultado antiguo',pending:'Pendiente de prueba',version:1,sourceIds:[]};
 for(let i=0;i<83;i++){const id=crypto.randomUUID(),chat=row(id,'[Prueba] Archivo '+String(i+1).padStart(2,'0'));chat.updatedAt=now-(i+1)*1000;chat.pinned=i===82;chat.archived=i===81;window.fixtureData[id]={chat,messages:[],hasOlder:false,draft:{text:'',attachmentIds:[],scrollTop:0},attachments:[],transfers:[],checkpoint:null};}
 window.fixtureDeleteCodes={};window.fixtureNextCode=1000;window.fixtureAll=messages;
 let bridge;Object.defineProperty(window,'zen',{configurable:true,get:()=>bridge,set:value=>{bridge=value;
  window.fixtureCallbacks=new Set();window.fixtureUpdate=event=>window.fixtureCallbacks.forEach(cb=>cb(event));bridge.onConversation=callback=>{window.fixtureCallbacks.add(callback);return()=>window.fixtureCallbacks.delete(callback);};
  bridge.run=async command=>{window.fixtureRuns.push(command);return{ok:true,value:{id:command.requestId,state:'completed',message:'Simulado'}};};
  bridge.conversations=async c=>{window.fixtureCalls.push(c);let current=window.fixtureData[window.fixtureCurrent];let reply={};
   if(c.action==='active'){if(!current){const id=crypto.randomUUID();current={chat:row(id,'Nuevo chat'),messages:[],hasOlder:false,draft:{text:'',attachmentIds:[],scrollTop:0},attachments:[],transfers:[],checkpoint:null};window.fixtureData[id]=current;window.fixtureCurrent=id;}reply={snapshot:structuredClone(current)};}
   if(c.action==='open'){window.fixtureCurrent=c.id;reply={snapshot:structuredClone(window.fixtureData[c.id])};}
   if(c.action==='list')reply={rows:Object.values(window.fixtureData).map(v=>v.chat).sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id)).slice(c.offset??0,(c.offset??0)+40)};
   if(c.action==='create'){const id=crypto.randomUUID();window.fixtureData[id]={chat:row(id,'[Prueba] Nuevo chat'),messages:[],hasOlder:false,draft:{text:'',attachmentIds:[],scrollTop:0},attachments:[],transfers:[],checkpoint:null};window.fixtureCurrent=id;reply={snapshot:structuredClone(window.fixtureData[id])};}
   if(c.action==='detach')window.fixtureData[c.id].transfers.find(t=>t.id===c.transferId).active=false;
   if(c.action==='draft')window.fixtureData[c.id].draft=structuredClone(c.draft);
   if(c.action==='read')reply=c.before?{messages:window.fixtureAll.filter(m=>m.seq<c.before)}:{snapshot:structuredClone(window.fixtureData[c.id])};
   if(c.action==='activity'){const {chat,messages,hasOlder,checkpoint}=window.fixtureData[c.id];reply={updates:structuredClone({chat,messages,hasOlder,checkpoint})};}
   if(c.action==='delete-preview'){window.fixtureDeleteCodes={};window.fixtureDeleteCodes[c.id]=String(++window.fixtureNextCode);reply={code:window.fixtureDeleteCodes[c.id],deletion:window.fixtureData[c.id].chat};}
   if(c.action==='delete-cancel'&&window.fixtureDeleteCodes[c.id]===c.code)delete window.fixtureDeleteCodes[c.id];
   if(c.action==='delete-confirm'){if(window.fixtureDeleteCodes[c.id]!==c.code)return{ok:false,error:'Código no válido'};delete window.fixtureDeleteCodes[c.id];delete window.fixtureData[c.id];if(window.fixtureCurrent===c.id)window.fixtureCurrent=Object.keys(window.fixtureData)[0];window.deletedChat=c.id;window.fixtureUpdate({chatId:c.id,deleted:true});}
   if(c.action==='update'){const chat=window.fixtureData[c.id].chat;for(const k of ['title','pinned','archived'])if(c[k]!==undefined)chat[k]=c[k];}
   return{ok:true,value:reply};
  };
 }});
});
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/preview.html?conversations=1');await page.getByRole('button',{name:'Desplegar panel',exact:true}).click();await page.getByRole('button',{name:'Chat',exact:true}).click();await page.locator('.conversations[aria-label="Conversación: [Prueba] Licencias SharePoint"]').waitFor();
 const input=page.getByRole('textbox',{name:'Mensaje para ZEN',exact:true}),reading=page.locator('.chat-reading');await input.fill('Borrador que debe conservarse');
 assert.equal(await page.locator('.overlay-header .brand-home .capsule-character').count(),1);assert.equal(await page.locator('.expanded-content .zen-companion,.expanded-content .robot-dock').count(),0);
 assert.deepEqual(await page.locator('.chat-topbar button').allTextContents(),['Conversaciones','+ Nuevo chat']);
 assert.equal(await page.locator('.chat-options,.chat-checkpoint,.chat-project-slot,.chat-reading>.chat-notice').count(),0);
 assert.equal(await page.locator('.chat-reading .chat-topbar,.chat-reading .chat-navigation').count(),0);
 assert.equal(await page.locator('.history-message').count(),30);assert.equal(await page.getByText('Terminada',{exact:true}).count(),0);assert.equal(await page.locator('.markdown-text blockquote').count(),1);assert.equal(await page.locator('.markdown-text table').count(),1);
 await reading.evaluate(el=>el.scrollTop=200);const top=await reading.evaluate(el=>el.scrollTop);
 await page.getByRole('button',{name:'Conversaciones',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.chat-row').length===40);
 assert.deepEqual(await page.locator('.top-navigation button').evaluateAll(items=>items.map(el=>el.ariaLabel)),['Inicio','Chat']);
 assert.equal(await page.locator('.tasks-view,.chat-filters,.conversation-list input').count(),0);
 const listScroll=page.locator('.chat-history-page');
 await listScroll.evaluate(el=>el.scrollTop=el.scrollHeight);await page.waitForFunction(()=>document.querySelectorAll('.chat-row').length===80);
 await listScroll.evaluate(el=>el.scrollTop=el.scrollHeight);await page.waitForFunction(()=>document.querySelectorAll('.chat-row').length===85);
 assert.deepEqual(await page.locator('.chat-row').evaluateAll(items=>items.map(el=>el.textContent)),await page.evaluate(()=>Object.values(window.fixtureData).map(v=>v.chat).sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id)).map(row=>row.title)));
 await page.locator('.history-loading').waitFor({state:'hidden'});
 await listScroll.evaluate(el=>el.scrollTop=0);await page.screenshot({path:dir+'/scroll-history.png',animations:'disabled'});
await page.getByRole('button',{name:'Volver al chat',exact:true}).click();assert.equal(await reading.evaluate(el=>el.scrollTop),top);assert.equal(await input.inputValue(),'Borrador que debe conservarse');
 await reading.evaluate(el=>el.scrollTop=0);
 const anchor=await reading.evaluate(el=>{const e=[...el.querySelectorAll('[data-message-id]')].find(e=>e.getBoundingClientRect().bottom>el.getBoundingClientRect().top);return{id:e.dataset.messageId,offset:e.getBoundingClientRect().top-el.getBoundingClientRect().top};});
 await page.getByRole('button',{name:'Cargar mensajes anteriores',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.history-message').length===80);
 const offset=await reading.evaluate((el,id)=>[...el.querySelectorAll('[data-message-id]')].find(e=>e.dataset.messageId===id).getBoundingClientRect().top-el.getBoundingClientRect().top,anchor.id);assert(Math.abs(offset-anchor.offset)<2,'Loading older preserves the visible message: '+JSON.stringify({offset,anchor}));
 const oldTop=await reading.evaluate(el=>el.scrollTop);await page.evaluate(()=>{const s=window.fixtureData[window.fixtureCurrent];s.messages=[...s.messages,{id:crypto.randomUUID(),seq:81,role:'assistant',text:'Deltas literales de prueba '.repeat(30),state:'running',partial:false,createdAt:Date.now()}];window.fixtureUpdate({chatId:s.chat.id});});try{await page.waitForFunction(()=>document.querySelectorAll('.history-message').length===81);}catch(e){console.log(await page.evaluate(()=>({count:document.querySelectorAll('.history-message').length,heading:document.querySelector('.conversations')?.getAttribute('aria-label'),current:window.fixtureCurrent,chat:window.fixtureData[window.fixtureCurrent].chat.id,messages:window.fixtureData[window.fixtureCurrent].messages.length,calls:window.fixtureCalls.slice(-8).map(c=>({action:c.action,id:c.id}))})));throw e;}assert.equal(await reading.evaluate(el=>el.scrollTop),oldTop);
 await page.getByRole('button',{name:'Ir a los mensajes nuevos',exact:true}).click();assert(await reading.evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop<3));
 await page.screenshot({path:dir+'/streaming.png',animations:'disabled'});
 await reading.evaluate(el=>el.scrollTop=1000);const retainedPage=await reading.evaluate(el=>{const e=[...el.querySelectorAll('[data-message-id]')].find(e=>e.getBoundingClientRect().bottom>el.getBoundingClientRect().top);return{top:el.scrollTop,id:e.dataset.messageId,offset:e.getBoundingClientRect().top-el.getBoundingClientRect().top};});
 await page.getByRole('button',{name:'Conversaciones',exact:true}).click();await page.getByRole('button',{name:/Conversación vacía/}).click();await page.waitForFunction(()=>document.querySelector('#chat-input').value==='Borrador de B');assert.equal(await page.locator('.history-message').count(),0);await page.screenshot({path:dir+'/empty.png',animations:'disabled'});
 await page.getByRole('button',{name:'Conversaciones',exact:true}).click();await page.getByRole('button',{name:/Licencias SharePoint/}).click();await page.waitForFunction(()=>document.querySelector('#chat-input').value==='Borrador que debe conservarse');
 assert.equal(await page.locator('.history-message').count(),81);const restoredPage=await reading.evaluate((el,id)=>{const e=[...el.querySelectorAll('[data-message-id]')].find(e=>e.dataset.messageId===id);return{top:el.scrollTop,offset:e.getBoundingClientRect().top-el.getBoundingClientRect().top};},retainedPage.id);assert(Math.abs(restoredPage.top-retainedPage.top)<2&&Math.abs(restoredPage.offset-retainedPage.offset)<2);
 await page.evaluate(()=>{const s=window.fixtureData[window.fixtureCurrent];s.messages.at(-1).state='interrupted';s.messages.at(-1).partial=true;window.fixtureUpdate({chatId:s.chat.id});});await page.getByText('Estado por comprobar · Parcial',{exact:true}).waitFor();
 await page.evaluate(()=>{window.stopCalls=0;window.zen.stop=async()=>{window.stopCalls++;return{ok:true,value:true};};const other=Object.values(window.fixtureData).find(s=>s.chat.id!==window.fixtureCurrent);window.dispatchEvent(new CustomEvent('zen-demo-task',{detail:{id:'other-chat-task',chatId:other.chat.id,projectContextId:null,state:'executing',request:'[Prueba] Trabajo en el otro chat',message:'Procesando',activity:'executing'}}));});
 await page.getByText('Otra conversación · [Prueba] Trabajo en el otro chat',{exact:true}).waitFor();
 await page.locator('.header-status').click();await page.getByRole('button',{name:'Volver a la conversación',exact:true}).click();assert.equal(await page.evaluate(()=>window.stopCalls),0);
 await page.getByRole('button',{name:'Detener',exact:true}).click();assert.equal(await page.evaluate(()=>window.stopCalls),1);
 await page.getByRole('button',{name:'Cerrar aviso',exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('zen-demo-task',{detail:{id:'other-chat-task',chatId:Object.values(window.fixtureData).find(s=>s.chat.id!==window.fixtureCurrent).chat.id,projectContextId:null,state:'cancelled',request:'[Prueba] Trabajo en el otro chat',message:'Detenido'}})));
 await page.screenshot({path:dir+'/interrupted.png',animations:'disabled'});
 await page.evaluate(()=>{window.copiedText='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedText=text;}}});});
 await page.getByRole('button',{name:'Copiar respuesta',exact:true}).last().click();await page.getByText('Copiado',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.copiedText),await page.evaluate(()=>window.fixtureData[window.fixtureCurrent].messages.at(-1).text));
 await reading.evaluate(el=>el.scrollTop=250);const beforeNew=await reading.evaluate(el=>el.scrollTop),oldId=await page.evaluate(()=>window.fixtureCurrent);
 await page.getByRole('button',{name:'Nuevo chat',exact:true}).click();await page.locator('.conversations[aria-label="Conversación: [Prueba] Nuevo chat"]').waitFor();assert.equal(await input.inputValue(),'');assert.equal(await page.evaluate(id=>window.fixtureData[id].draft.scrollTop,oldId),beforeNew);
 await page.getByRole('button',{name:'Conversaciones',exact:true}).click();await page.getByRole('button',{name:/Licencias SharePoint/}).click();await page.waitForFunction(()=>document.querySelector('#chat-input').value==='Borrador que debe conservarse');assert.equal(await reading.evaluate(el=>el.scrollTop),beforeNew);
 await reading.evaluate(el=>{const rich=[...el.querySelectorAll('.history-message')].find(e=>e.querySelector('blockquote'));el.scrollTop=rich.offsetTop-el.offsetTop;});await page.screenshot({path:dir+'/markdown.png',animations:'disabled'});
 for(const viewport of [{width:360,height:400},{width:480,height:360},{width:640,height:560},{width:900,height:640}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const g=await page.evaluate(()=>{const h=document.querySelector('.chat-topbar').getBoundingClientRect(),c=document.querySelector('.composer-block').getBoundingClientRect(),r=document.querySelector('.chat-reading').getBoundingClientRect();return{header:h.bottom,readingTop:r.top,readingBottom:r.bottom,composerTop:c.top,composerBottom:c.bottom,bodyWidth:document.body.scrollWidth,width:innerWidth,height:innerHeight};});
  assert(g.readingTop>=g.header-1&&g.readingBottom<=g.composerTop+1,'Controls must reserve actual space: '+JSON.stringify(g));assert(g.composerBottom<=g.height&&g.bodyWidth<=g.width);
  await reading.evaluate(el=>el.scrollTop=el.scrollHeight);await page.screenshot({path:dir+'/chat-'+viewport.width+'x'+viewport.height+'.png',animations:'disabled'});
 }
 await page.setViewportSize({width:900,height:720});await reading.evaluate(el=>{const rich=[...el.querySelectorAll('.history-message')].find(e=>e.querySelector('blockquote'));el.scrollTop=rich.offsetTop-el.offsetTop;});await page.screenshot({path:dir+'/markdown-900.png',animations:'disabled'});

 await page.getByRole('button',{name:'Conversaciones',exact:true}).click();
 const previousId=await page.evaluate(()=>window.fixtureCurrent),previousDraft=await input.inputValue();
 const target=page.getByRole('button',{name:'[Prueba] Archivo 01',exact:true});await target.click({button:'right'});
 assert.equal(await page.evaluate(()=>window.fixtureCurrent),previousId);
 await page.getByRole('menuitem',{name:'Eliminar conversación',exact:true}).click();
 const deleteDialog=page.getByRole('dialog',{name:'¿Eliminar conversación?',exact:true});await deleteDialog.waitFor();await deleteDialog.getByRole('button',{name:'Eliminar conversación',exact:true}).waitFor();
 await page.screenshot({path:dir+'/delete-confirmation.png',animations:'disabled'});
 await deleteDialog.getByRole('button',{name:'Cancelar',exact:true}).click();await page.waitForFunction(()=>Object.keys(window.fixtureDeleteCodes).length===0);
 assert.equal(await target.count(),1);assert.equal(await input.inputValue(),previousDraft);
 await target.focus();await page.keyboard.press('Shift+F10');await page.getByRole('menuitem',{name:'Eliminar conversación',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('menu').count(),0);assert(await page.locator('.chat-history-page').isVisible());
 await target.click({button:'right'});await page.getByRole('menuitem',{name:'Eliminar conversación',exact:true}).click();await deleteDialog.getByRole('button',{name:'Eliminar conversación',exact:true}).click();await target.waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>window.fixtureCurrent),previousId);assert.equal(await input.inputValue(),previousDraft);
 const activeRow=page.locator('.chat-row[aria-current=page]');await activeRow.click({button:'right'});await page.getByRole('menuitem',{name:'Eliminar conversación',exact:true}).click();
 const typedConfirm=deleteDialog.getByRole('textbox',{name:'Confirmar borrado por chat'});await typedConfirm.waitFor();await typedConfirm.fill(await typedConfirm.getAttribute('placeholder'));await typedConfirm.press('Enter');
 await page.waitForFunction(id=>document.querySelector('.conversations')?.getAttribute('data-chat-id')!==id&&document.querySelector('.conversations')?.getAttribute('data-chat-id'),previousId);
 assert.equal(await page.evaluate(id=>!!window.fixtureData[id],previousId),false);assert.equal(await deleteDialog.count(),0);
 await page.evaluate(()=>{const current=window.fixtureData[window.fixtureCurrent];window.fixtureData={[window.fixtureCurrent]:current};window.fixtureUpdate({chatId:window.fixtureCurrent});});
 await page.getByRole('button',{name:'Conversaciones',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.chat-row').length===1);
 const lastId=await page.evaluate(()=>window.fixtureCurrent);await page.locator('.chat-row').click({button:'right'});await page.getByRole('menuitem',{name:'Eliminar conversación',exact:true}).click();await deleteDialog.getByRole('button',{name:'Eliminar conversación',exact:true}).click();
 await page.waitForFunction(id=>document.querySelector('.conversations')?.getAttribute('data-chat-id')!==id&&document.querySelector('.conversations')?.getAttribute('data-chat-id'),lastId);
 assert.equal(await input.inputValue(),'');assert.equal(await page.locator('.history-message').count(),0);

 await page.setViewportSize({width:360,height:400});await page.addStyleTag({content:'.compact-shell button,.compact-shell input,.compact-shell textarea,.compact-shell p{font-size:20px!important}'});assert(await page.evaluate(()=>document.body.scrollWidth<=innerWidth));await page.screenshot({path:dir+'/large-text.png',animations:'disabled'});
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.fixtureRuns.length),0);
 await writeFile('docs/evidence/simple-chat-ui.json',JSON.stringify({at:new Date().toISOString(),passed:true,scope:'real Edge renderer with synthetic conversation IPC data; no API or physical input',simpleChatControls:true,homeChatOnly:true,historyInfiniteScroll:true,historyRowsVerified:85,historyChronological:true,historyIncludesArchives:true,historyFiltersAndSearchRemoved:true,contextMenuDelete:true,cancelRevokesDelete:true,deleteOtherPreservesDraft:true,deleteActiveRecoversChat:true,deleteLastCreatesEmptyChat:true,typedDeleteConfirmation:true,singleMascotPresentation:true,noAvatarInsideMessages:true,removedOptionsAndCheckpoint:true,headerOutsideMessageScroll:true,historyPreservesDraftAndScroll:true,olderMessagesPreserveAnchor:true,streamPreservesReading:true,tailAction:true,conversationDraftsIsolated:true,markdown:true,partialResultPreserved:true,widths:[360,480,640,900],lowHeight:360,enlargedText:true,foreignActivityOrigin:true,activityCloseDoesNotStop:true,stopAccessible:true,copyFeedback:true,immediateSwitchSavesReading:true,loadedPageRestoredAcrossChats:true,screenshots:dir},null,2));console.log('Simple chat rendering and continuity verified');
}finally{await browser.close();await new Promise(r=>server.close(r));}
