import {screen,type BrowserWindow} from 'electron';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fullscreenSmoke} from './fullscreen-smoke';
// Isolated, keyless profile. Renderer DOM events here do not certify physical input.
export async function interactionsSmoke(window:BrowserWindow,edgeProbe:()=>Promise<unknown>){
  // A portable executable starts in its fresh extraction directory, not the repository.
  await mkdir('docs/evidence',{recursive:true});
  const call=(code:string)=>window.webContents.executeJavaScript(code);
  const wait=async(selector:string)=>{for(let i=0;i<60;i++){if(await call(`!!document.querySelector(${JSON.stringify(selector)})`))return;await new Promise(r=>setTimeout(r,50));}throw Error('No apareció '+selector);};
  const checks:Record<string,unknown>={at:new Date().toISOString(),scope:'Windows Electron: real local IPC, native bounds, renderer capture; DOM events simulated',apiCalled:false,physicalInputTested:false};
  await wait('.pet-avatar');
  await call("document.querySelector('.pet-avatar').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))");await wait('.pet-fan');
  checks.fourFanActions=await call("document.querySelectorAll('.pet-fan [role=menuitem]').length===4");
  await call("document.querySelector('.pet-more').click()");await wait('.pet-menu');
  await call("[...document.querySelectorAll('.pet-menu button')].find(b=>b.textContent==='Pregunta rápida').click()");await wait('.quick-header');await new Promise(r=>setTimeout(r,350));
  checks.quickNativeWidth=window.getBounds().width===380;
  checks.rendererNodeUnavailable=await call("typeof window.require==='undefined'&&typeof window.process==='undefined'");
  await mkdir('docs/ui-preview/interactions',{recursive:true});await writeFile('docs/ui-preview/interactions/native-quick.png',(await window.webContents.capturePage()).toPNG());
  const requestId=randomUUID();
  checks.frozenContextAndDedup=await call(`(async()=>{const original=await window.zen.dropText({text:'Referencia local: 739162',link:false});if(!original.ok)return false;const request={text:'Resume solo localmente sin API',requestId:'${requestId}',attachmentIds:[original.value.id],contextMode:'none',projectContextId:null};const pending=window.zen.run(request);await window.zen.removeContextAttachment(original.value.id);const first=await pending;const duplicate=await window.zen.run(request);const removed=await window.zen.run({...request,requestId:crypto.randomUUID()});return first.ok&&first.value.localOnly&&first.value.message.includes('739162')&&duplicate.ok&&first.value.id===duplicate.value.id&&!removed.ok;})()`);
  checks.invalidVisualRejected=await call("(async()=>{const c=document.createElement('canvas');c.width=20;c.height=20;const result=await window.zen.run({text:'Explica esta imagen',requestId:crypto.randomUUID(),contextMode:'none',imageData:c.toDataURL(),visual:{id:crypto.randomUUID(),width:99,height:20,capturedAt:Date.now(),source:'Fixture'}});return !result.ok&&result.error.includes('no coincide');})()");
  checks.localGuidePersisted=await call("(async()=>{const guide={id:crypto.randomUUID(),projectId:null,taskId:crypto.randomUUID(),goal:'Prueba de persistencia local',steps:['Primero','Segundo'],index:1,status:'paused',updatedAt:Date.now()};const saved=await window.zen.saveInteractions({guides:[guide],dismissed:[]}),read=await window.zen.interactions(),invalid=await window.zen.saveInteractions({guides:[{...guide,index:7}],dismissed:[]});return saved.ok&&read.ok&&read.value.guides[0].index===1&&read.value.guides[0].status==='paused'&&!invalid.ok;})()");
  checks.appearanceSaved=await call("(async()=>{const current=await window.zen.settings();if(!current.ok)return false;const saved=await window.zen.saveSettings({...current.value.settings,petAccessory:'bow',resumeSuggestion:false,shortcut:'Control+Alt+Shift+F6',regionShortcut:'Control+Alt+Shift+F7',selectionShortcut:'Control+Alt+Shift+F8'}),read=await window.zen.settings();if(!saved.ok)console.error('Appearance test: '+saved.error);return saved.ok&&read.ok&&read.value.settings.petAccessory==='bow'&&!read.value.settings.resumeSuggestion;})()");
  await call("document.querySelector('[aria-label=\"Ampliar al chat\"]').click()");await wait('.overlay-header');await new Promise(r=>setTimeout(r,350));checks.chatNativeWidth=window.getBounds().width===640;
  checks.projectAttachmentsIsolated=await call("(async()=>{const read=await window.zen.projectContexts();if(!read.ok)return false;const original=read.value,item=await window.zen.dropText({text:'Proyecto General: 314159',link:false});if(!item.ok)return false;const project={id:crypto.randomUUID(),name:'Fixture aislada',preferences:'',documents:[]};const switched=await window.zen.saveProjectContexts({...original,activeId:project.id,projects:[...original.projects,project]});if(!switched.ok)return false;const foreign=await window.zen.activeContextAttachments([item.value.id]);const restored=await window.zen.saveProjectContexts(original);const local=await window.zen.activeContextAttachments([item.value.id]);const result=await window.zen.run({text:'Lee solo localmente sin API',requestId:crypto.randomUUID(),projectContextId:original.activeId,contextMode:'none',attachmentIds:[item.value.id]});return !foreign.ok&&restored.ok&&local.ok&&result.ok&&result.value.localOnly&&result.value.message.includes('314159');})()");
  checks.nativeSizes=[];
  await mkdir('docs/ui-preview/compact',{recursive:true});
  for(const [width,height] of [[360,400],[480,360],[640,480],[960,640],[320,480]]){
    window.setBounds({...window.getBounds(),width,height});await new Promise(r=>setTimeout(r,120));
    const layout=await call("(()=>{const send=document.querySelector('.composer-send').getBoundingClientRect();return{width:innerWidth,height:innerHeight,noHorizontalScroll:document.body.scrollWidth<=innerWidth,sendReachable:send.left>=0&&send.right<=innerWidth&&send.bottom<=innerHeight};})()");
    (checks.nativeSizes as unknown[]).push({requested:{width,height},bounds:window.getBounds(),...layout});
    if(width===640||width===320)await writeFile('docs/ui-preview/compact/native-'+width+'x'+height+'.png',(await window.webContents.capturePage()).toPNG());
  }
  checks.nativeResponsive=(checks.nativeSizes as Array<{bounds:{width:number;height:number};requested:{width:number;height:number};noHorizontalScroll:boolean;sendReachable:boolean}>).every(r=>r.bounds.width===r.requested.width&&r.bounds.height===r.requested.height&&r.noHorizontalScroll&&r.sendReachable);
  await call("(async()=>{const c=await window.zen.settings();await window.zen.saveSettings({...c.value.settings,showPetWhenFolded:false});})()");
  await call("document.querySelector('[aria-label=\"Recoger panel\"]').click()");await wait('main.capsule');await new Promise(r=>setTimeout(r,350));
  checks.headCapsuleBounds=window.getBounds();
  checks.headCapsuleNative=window.getBounds().width===490&&window.getBounds().height===46&&await call("!document.querySelector('.brand-home .robot-body,.brand-home .robot-arm')&&document.querySelectorAll('.overlay-header .navigation-tab').length===3");
  await mkdir('docs/ui-preview/head-capsule',{recursive:true});await writeFile('docs/ui-preview/head-capsule/native-rest.png',(await window.webContents.capturePage()).toPNG());
  const capsuleBefore=window.getBounds();
  for(const name of ['Inicio','Tareas','Chat','Chat']){await call("document.querySelector('[aria-label=\""+name+"\"]').click()");await new Promise(r=>setTimeout(r,70));}
  await new Promise(r=>setTimeout(r,300));checks.singlePanelNavigation=await call("document.querySelectorAll('nav[aria-label=\"Navegación principal\"]').length===1&&document.querySelector('.navigation-tab[aria-current=page]').ariaLabel==='Chat'");
  await writeFile('docs/ui-preview/head-capsule/native-panel.png',(await window.webContents.capturePage()).toPNG());
  await call("document.querySelector('[aria-label=\"Recoger panel\"]').click()");await new Promise(r=>setTimeout(r,300));
  checks.nativeFoldAnchor=JSON.stringify(capsuleBefore)===JSON.stringify(window.getBounds());
  checks.fullscreenChatVerified=await fullscreenSmoke(window);
  await call("document.querySelector('[aria-label=\"Recoger panel\"]').click()");await wait('main.capsule');await new Promise(r=>setTimeout(r,300));
  checks.nativeEdgeProbe=await edgeProbe();
  checks.nativeEdgesWithinWorkArea=(checks.nativeEdgeProbe as Array<{within:boolean;restored:boolean}>).every(row=>row.within&&row.restored);
  checks.observedDisplays=screen.getAllDisplays().map(d=>({id:d.id,scaleFactor:d.scaleFactor,workArea:d.workArea}));
  checks.DPIChangesTested=false;
  checks.passed=['fullscreenChatVerified','quickNativeWidth','rendererNodeUnavailable','frozenContextAndDedup','invalidVisualRejected','localGuidePersisted','appearanceSaved','chatNativeWidth','fourFanActions','projectAttachmentsIsolated','nativeResponsive','headCapsuleNative','singlePanelNavigation','nativeFoldAnchor','nativeEdgesWithinWorkArea'].every(key=>checks[key]===true);
  await writeFile('docs/evidence/head-capsule-native.json',JSON.stringify(checks,null,2));
  await writeFile('docs/evidence/compact-native.json',JSON.stringify(checks,null,2));
  await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/interactions-native.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));return checks.passed===true;
}
