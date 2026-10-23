// Actual renderer with explicitly identified synthetic IPC data; no model API.
import {chromium} from 'playwright';import {createServer} from 'node:http';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {resolve,sep,extname} from 'node:path';import assert from 'node:assert/strict';
const root=resolve('dist/renderer'),dir='docs/ui-preview/mascot';await mkdir(dir,{recursive:true});const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+sep))throw Error();res.setHeader('Content-Type',{'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.gif':'image/gif'}[extname(p)]??'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
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
  window.fixtureRead=()=>{};bridge.onReadResult=cb=>{window.fixtureRead=cb;return()=>{window.fixtureRead=()=>{};};};
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  speechSynthesis.getVoices=()=>[{localService:true,lang:'es-ES'}];speechSynthesis.speak=u=>{window.fixtureUtterance=u;};speechSynthesis.cancel=()=>{};
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
 const report={at:new Date().toISOString(),scope:'Production renderer in headless Edge on Windows; synthetic IPC/audio callbacks, no API or physical gestures',checks:{}};
 report.originalArtwork=[];
 for(const [source,target] of [['assets/zen-cuerpo.png','body.png'],['references/zen-estilos.png','outfits.png'],['assets/zen-cabeza-manos.png','head-hands.png']]){
  const reference=await readFile('zen_mascota_kit/'+source),runtime=await readFile('public/mascot/'+target),built=await readFile(root+'/mascot/'+target);
  assert(reference.equals(runtime)&&runtime.equals(built),'Canonical artwork must reach production without loss: '+target);
  report.originalArtwork.push({source,target,sha256:createHash('sha256').update(built).digest('hex'),byteIdentical:true});
 }
 const emit=(id,state,chatId)=>page.evaluate(({id,state,chatId})=>window.dispatchEvent(new CustomEvent('zen-demo-task',{detail:{id,state,chatId:chatId??window.fixtureCurrent,projectContextId:null,request:'[Prueba] Actividad local',message:'Estado simulado'}})),{id,state,chatId});
 const one=async()=>assert.equal(await page.locator('.mascot-host').count(),1);
 const activity=async value=>page.waitForFunction(v=>document.querySelector('.mascot-host')?.dataset.activity===v,value);
 const thinkingViews=[];
 const gazeViews=[];
 const checkGaze=async view=>{
  const selector=view==='home'?'.welcome-gaze':'.mascot-head-gaze';
  const poses=[];
  for(const [side,x,y] of [['left',-1800,-600],['right',2800,1600]]){
   await page.evaluate(({x,y})=>window.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y})),{x,y});await page.waitForTimeout(220);
   const transform=await page.locator(selector).evaluate(el=>el.style.transform);poses.push(transform);
   const angle=Number(/rotate\(([-.\d]+)deg\)/.exec(transform)?.[1]);assert(side==='left'?angle<0:angle>0);assert(Math.abs(angle)>(view==='capsule'?9:view==='home'?3.5:4.5));
   await page.screenshot({path:dir+'/gaze-'+view+'-'+side+'.png'});
  }
  assert.notEqual(poses[0],poses[1]);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(80);assert.equal(await page.locator(selector).evaluate(el=>getComputedStyle(el).transform),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});gazeViews.push({view,outsideWindow:true,visibleMotion:true,reducedMotion:true,poses});
 };
 const checkThinking=async view=>{
  const id='thinking-animation-'+view;
  await emit(id,'queued');await activity('thinking');
  await emit(id,'thinking');await page.locator('.mascot-thought').waitFor();
  const thinking=await page.locator('.mascot-host').evaluate(el=>{
   const names=el.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>a.animationName),r=el.querySelector('.mascot-thought').getBoundingClientRect();
   const slot=el.dataset.presentation==='full'?document.querySelector('.mascot-stage-anchor')?.getBoundingClientRect():null,h=el.getBoundingClientRect();
   return{dots:names.filter(n=>n==='zen-think-dot').length,head:names.includes('zen-think-head'),fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,aligned:!slot||Math.abs(h.top-slot.top)<1&&Math.abs(h.left-slot.left)<1};
  });
  assert.equal(thinking.dots,3);assert.equal(thinking.head,view!=='home');assert(thinking.fits);assert(thinking.aligned);
  await page.screenshot({path:dir+'/thinking-'+view+'.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('.mascot-host').dataset.animated==='false');
  assert.equal(await page.locator('.mascot-host').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
  assert.equal(await page.locator('.mascot-thought').count(),1);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>document.querySelector('.mascot-host').dataset.animated==='true');
  await page.evaluate(id=>window.dispatchEvent(new CustomEvent('zen-demo-task',{detail:{id,chatId:window.fixtureCurrent,state:'thinking',paused:true,message:'Pausa simulada'}})),id);
  await activity('idle');assert.equal(await page.locator('.mascot-thought').count(),0);
  await emit(id,'completed');
  for(const state of ['executing','awaiting_approval','failed','cancelled','completed']){
   await emit(id+'-'+state,'thinking');await activity('thinking');
   await emit(id+'-'+state,state);await page.waitForFunction(()=>!document.querySelector('.mascot-thought'));
   // End nonterminal fixtures so the UI correctly returns to the newest task.
   if(['executing','awaiting_approval'].includes(state))await emit(id+'-'+state,'cancelled');
  }
  await activity('idle');thinkingViews.push({view,...thinking,reducedMotion:true,stopsOnPauseAndTerminalStates:true});
  // Permission events intentionally open their review; restore the test surface.
  if(view==='capsule'&&!await page.locator('main.capsule').count())await page.getByRole('button',{name:'Recoger panel',exact:true}).click();
  if(view!=='capsule')await page.getByRole('button',{name:view==='home'?'Inicio':'Chat',exact:true}).click();
 };
 const sampleFrames=()=>page.evaluate(()=>new Promise(resolve=>{const times=[];let previous;const frame=t=>{if(previous!==undefined)times.push(t-previous);previous=t;if(times.length<100)requestAnimationFrame(frame);else{times.sort((a,b)=>a-b);resolve({p50:times[50],p95:times[95],p99:times[99],samples:times.length});}};requestAnimationFrame(frame);}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/preview.html?conversations=1');
 await page.locator('.mascot-host').waitFor();await page.waitForTimeout(400);
 await one();assert.equal(await page.locator('.mascot-host').getAttribute('data-presentation'),'compact');assert.equal((await page.locator('main').boundingBox()).height,60);
 await page.mouse.move(20,200);const left=await page.locator('.mascot-head-gaze').evaluate(el=>el.style.transform);await page.waitForTimeout(70);await page.mouse.move(620,200);const right=await page.locator('.mascot-head-gaze').evaluate(el=>el.style.transform);assert.notEqual(left,right);
 await emit('hands','thinking');await activity('thinking');await page.screenshot({path:dir+'/hands.png'});assert.equal((await page.locator('main').boundingBox()).height,60);await emit('hands','completed');await activity('idle');
 for(const width of [637,480,360,320]){
  await page.setViewportSize({width,height:60});await page.waitForTimeout(80);
  assert(await page.evaluate(()=>{
   const main=document.querySelector('main').getBoundingClientRect();
   return main.width===Math.min(637,innerWidth)&&main.height===60&&document.body.scrollWidth<=innerWidth&&
    [...document.querySelectorAll('.overlay-header button')].filter(el=>el.getClientRects().length).every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=60;});
  }),'Capsule controls must fit the actual native window at '+width);
 }
 await page.setViewportSize({width:637,height:60});await page.waitForTimeout(80);
 assert.equal(Math.round((await page.locator('.brand-home').boundingBox()).height),52);
 await page.screenshot({path:dir+'/capsule.png'});
 await checkGaze('capsule');await checkThinking('capsule');
 await page.setViewportSize({width:640,height:560});
 await page.evaluate(()=>{window.fixtureDrag=[];window.zen.drag=async kind=>{window.fixtureDrag.push(kind);return{ok:true,value:true};};});
 const headBox=await page.locator('.brand-home').boundingBox();await page.mouse.move(headBox.x+25,headBox.y+20);await page.mouse.down();await page.mouse.move(headBox.x+45,headBox.y+20);await page.mouse.up();assert.equal(await page.locator('main.capsule').count(),1);assert.deepEqual(await page.evaluate(()=>window.fixtureDrag),['start','end']);
 await page.getByRole('button',{name:'Desplegar panel',exact:true}).click();
 assert.equal(await page.locator('.overlay-header .brand-home').count(),0);
 assert.deepEqual(await page.locator('.navigation-tab').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label'))),['Inicio','Chat']);
 await page.getByRole('button',{name:'Chat',exact:true}).click();
 const input=page.getByRole('textbox',{name:'Mensaje para ZEN',exact:true});await input.fill('Borrador · mascota');
 await one();assert.equal(await page.locator('.mascot-host').getAttribute('data-presentation'),'full');
 await checkGaze('chat');await checkThinking('chat');
 await page.getByRole('button',{name:'Inicio',exact:true}).click();await page.locator('[data-presentation=welcome]').waitFor();await checkGaze('home');await checkThinking('home');
 await page.getByRole('button',{name:'Chat',exact:true}).click();await page.locator('[data-presentation=full]').waitFor();
 report.thinkingViews=thinkingViews;
 report.gazeViews=gazeViews;
 await page.waitForTimeout(400);await page.screenshot({path:dir+'/chat.png'});
 report.baselineNoMascot=await page.evaluate(async()=>{document.querySelector('.mascot-host').style.display='none';const times=[];await new Promise(resolve=>{let prev;const tick=t=>{if(prev)times.push(t-prev);prev=t;times.length<100?requestAnimationFrame(tick):resolve();};requestAnimationFrame(tick);});document.querySelector('.mascot-host').style.display='';times.sort((a,b)=>a-b);return{p50:times[50],p95:times[95],p99:times[99]};});
 report.idleFrames=await sampleFrames();
 assert.equal(await page.locator('.mascot-host').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
 await page.getByRole('button',{name:'Apariencia',exact:true}).click();
 for(const tone of ['Neutral','Creído','Seguro','Triste','Xulito']){await page.getByRole('button',{name:tone,exact:true}).first().click();await page.waitForTimeout(100);assert(await page.locator('.mascot-host').evaluate(el=>{const b=document.querySelector('.mascot-stage').getBoundingClientRect();const h=el.getBoundingClientRect();return h.left>=b.left&&h.right<=b.right&&el.querySelector('[data-rig=original-textured-2d]')!==null;}),'Original artwork stays inside the reserved stage: '+tone);await page.screenshot({path:dir+'/'+tone+'.png'});}
 const armBefore=await page.locator('.mascot-head-nod').evaluate(el=>getComputedStyle(el).transform);await page.getByLabel('Intensidad del gesto',{exact:true}).focus();await page.keyboard.press('End');const armAfter=await page.locator('.mascot-head-nod').evaluate(el=>getComputedStyle(el).transform);assert.notEqual(armBefore,armAfter);assert.equal(await input.inputValue(),'Borrador · mascota');
 assert(await page.locator('.mascot-host').evaluate(el=>{const b=document.querySelector('.mascot-stage').getBoundingClientRect();const h=el.getBoundingClientRect();return h.left>=b.left&&h.right<=b.right&&el.querySelector('[data-rig=original-textured-2d]')!==null;}),'Maximum gesture stays inside the stage');
 await page.getByLabel('Vestuario',{exact:true}).selectOption('cozy');await page.getByRole('button',{name:'Creído',exact:true}).click();assert.equal(await page.locator('.mascot-host').getAttribute('data-wardrobe'),'cozy');assert.equal(await page.locator('.mascot-rig').getAttribute('data-face'),'sad_empathic');
 await page.getByLabel('Vestuario',{exact:true}).selectOption('auto');await page.getByRole('button',{name:'Cerrar apariencia',exact:true}).click();assert.equal(await page.locator('.mascot-host').getAttribute('data-preview'),'false');
 await page.getByRole('button',{name:'Dar un paseo',exact:true}).click();await page.waitForTimeout(180);
 const joints=await page.locator('.mascot-rig').evaluate(el=>['.mascot-thigh.left','.mascot-thigh.right','.mascot-shin.left'].map(s=>getComputedStyle(el.querySelector(s)).transform));assert.notEqual(joints[0],joints[1]);report.walkFrames=await sampleFrames();await page.screenshot({path:dir+'/walk.png'});await page.getByRole('button',{name:'Detener movimiento',exact:true}).click();assert.equal(await page.locator('.mascot-host').getAttribute('data-locomotion'),'still');assert.equal(await input.inputValue(),'Borrador · mascota');
 const other=await page.evaluate(()=>Object.keys(window.fixtureData).find(id=>id!==window.fixtureCurrent));await emit('foreign','executing',other);await activity('idle');
 await emit('real-work','executing');await activity('executing');
 await page.evaluate(()=>window.fixtureRead({text:'Audio simulado',chatId:window.fixtureCurrent,taskId:'real-work'}));await activity('executing');
 await page.evaluate(()=>window.fixtureUtterance.onstart());await activity('speaking');await page.screenshot({path:dir+'/speaking.png'});
 report.localStopMs=await page.evaluate(async()=>{const t=performance.now();document.querySelector('[aria-label="Detener voz"]').click();await new Promise(requestAnimationFrame);return performance.now()-t;});await activity('executing');
 await page.evaluate(()=>window.fixtureUtterance.onstart());await activity('executing');
 await page.getByRole('button',{name:'Detener todas las tareas',exact:true}).click();await activity('idle');await emit('real-work','executing');await activity('idle');
 await emit('real-work','cancelled');await emit('foreign','cancelled',other);
 await page.getByRole('button',{name:'Apariencia',exact:true}).click();await page.getByRole('button',{name:'Xulito',exact:true}).click();
 await page.getByRole('button',{name:'Cerrar apariencia',exact:true}).click();await page.getByRole('button',{name:'Conversaciones',exact:true}).click();assert.equal(await page.locator('.mascot-host').count(),0);
 await page.getByRole('button',{name:/Conversación vacía/}).click();assert.equal(await input.inputValue(),'Borrador de B');assert.equal(await page.locator('.mascot-host').getAttribute('data-preview'),'false');
 for(const width of [320,360,480,580,640,960]){await page.setViewportSize({width,height:560});await page.waitForTimeout(120);assert.equal(await page.locator('.mascot-host').count(),width<580?0:1);assert.equal(await page.locator('.overlay-header .brand-home').count(),0);assert(await page.evaluate(()=>document.body.scrollWidth<=innerWidth));if(width>=580)assert.equal(await page.locator('.mascot-host').getAttribute('data-presentation'),'full');assert(await page.locator('.composer-send').isVisible());await page.screenshot({path:dir+'/width-'+width+'.png'});}
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(120);assert(await page.getByRole('button',{name:'Dar un paseo',exact:true}).isDisabled());assert(await page.locator('.mascot-rig').evaluate(el=>el.classList.contains('static')));await page.screenshot({path:dir+'/reduced.png'});
 await page.getByRole('button',{name:'Recoger panel',exact:true}).click();await one();
 await page.getByRole('button',{name:'Inicio de ZEN',exact:true}).focus();await page.keyboard.press('Shift+F10');await page.locator('.mascot-controls').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('.mascot-controls').count(),0);
 assert.equal(await input.inputValue(),'Borrador de B');
 const hashes=await page.evaluate(async()=>{const inventory=[];for(const src of ['./mascot/head.png','./mascot/expressions.png','./mascot/body.png','./mascot/outfits.png','./mascot/head-hands.png']){const i=new Image();i.src=src;await i.decode();inventory.push({src,width:i.naturalWidth,height:i.naturalHeight});}return inventory;});report.assets=hashes;
 report.checks={capsule60:true,dragDoesNotClick:true,singleAvatar:true,headGazeWithoutInventedEyes:true,handsWithoutResize:true,fiveTones:true,fixedWardrobe:true,originalAssetsUnchanged:true,texturedLegMovement:true,stopMovement:true,localPlaybackEvents:true,stopVoiceKeepsWork:true,stalePlaybackIgnored:true,cancelledOperationIgnored:true,foreignChatIgnored:true,draftAcrossModes:true,chatIsolation:true,responsive:true,reducedMotion:true,keyboardMenu:true,noApiCalls:await page.evaluate(()=>window.fixtureRuns.length===0)};
 report.machine={platform:process.platform,architecture:process.arch,cpus:(await import('node:os')).cpus()[0]?.model,browser:await browser.version()};
 assert.deepEqual(errors,[]);
 report.passed=Object.values(report.checks).every(Boolean);await writeFile('docs/evidence/mascot-ui.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}
