import {app,screen,BrowserWindow,dialog,nativeImage,Menu,type PopupOptions} from 'electron';
import type {CompanionHub} from './companion-hub';
import type {CompanionIntegration} from './companion-integration';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,existsSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeEvidence} from './evidence-file';
import type {CompanionNotice} from '../shared/codex-companion';
import {DesktopObservation} from './companion-desktop';
import {nativeHelper} from './native-helper';
import type {CompanionMedia} from './companion-media';
import type {SmokeMediaState} from './companion-smoke-media';
import {codexChatUrl} from '../shared/companion-presentation';
import {newFields} from '../shared/knowledge-hub';
import {readBackup,writeBackup} from './companion-backup';
import {capsuleRailHeight,edgeShape,workspaceLayout} from './companion-workspace-window';
import {capsuleShape} from './overlay';
import {CAPSULE_POSITION,EDGE_ISLAND,ISLAND_BLUR_MS,ISLAND_SIZE} from '../shared/island';
import {motion} from '../shared/companion-motion';
import {interfaceTones} from '../shared/companion-interface-audio';
export async function companionSmoke({cap,hub,integration,profile,openedTargets,activateNotice,copiedRequests,queuedRequests,copiedText,media,observationFixture,dismissOnOutsideClick}:{cap:BrowserWindow;hub:CompanionHub;integration:CompanionIntegration;profile:string;openedTargets:string[];activateNotice:(n:CompanionNotice)=>Promise<void>;copiedRequests:string[];queuedRequests:{thread:string;text:string}[];copiedText:string[];media:CompanionMedia;observationFixture:SmokeMediaState;dismissOnOutsideClick:()=>void}){
 const evidenceDirectory=join(profile,'evidence'),screenshots=join(evidenceDirectory,'screenshots');
 mkdirSync(screenshots,{recursive:true});
 const report:Record<string,any>={at:new Date().toISOString(),scope:'Single ZEN workspace, isolated native hook and synthetic media',apiCalled:false,physicalInputTested:false,companionOnly:true,evidenceDirectory};
 const pause=(ms=100)=>new Promise(r=>setTimeout(r,ms)),js=(w:BrowserWindow,s:string)=>w.webContents.executeJavaScript(s).catch(e=>{throw Error('Isolated fixture expression failed: '+s.slice(0,180)+' · '+String(e));});
 const wait=async(fn:()=>Promise<any>)=>{for(let n=0;n<100;n++){if(await fn().catch(()=>false))return;await pause();}throw Error('Workspace smoke condition not reached: '+fn.toString().slice(0,180)+'; fixture: '+await js(cap,"JSON.stringify({analysis:document.querySelector('.context-analysis')?.innerHTML,page:document.querySelector('.workspace-content:not([hidden])')?.dataset.page,root:document.querySelector('.companion-capsule')?.className,hidden:document.hidden})"));};
 const resizeForFixture=async(width:number,height:number)=>{cap.setBounds({...cap.getBounds(),width,height});try{await wait(async()=>cap.getBounds().width===width&&cap.getBounds().height===height);}catch{throw Error('Native resize fixture failed: '+JSON.stringify({requested:{width,height},actual:cap.getBounds(),minimum:cap.getMinimumSize(),resizable:cap.isResizable()}));}await pause(120);};
 const nav=async(page:string)=>{await js(cap,`window.companion.navigate(${JSON.stringify(page)})`);await wait(()=>js(cap,`!!document.querySelector('.workspace-content:not([hidden])[data-page="${page}"]')`));};
 const preference=async(category:string)=>{
  await nav('settings');
  await js(cap,`document.querySelector('.preferences-nav [data-category=${category}]').click()`);
  await wait(()=>js(cap,`document.querySelector('.preferences-nav [aria-current=page]')?.dataset.category===${JSON.stringify(category)}`));
 };
 const shot=async(w:BrowserWindow,name:string)=>{await pause(220);let last:unknown;for(let attempt=0;attempt<3;attempt++){try{await writeEvidence(join(screenshots,name+'.png'),(await w.webContents.capturePage(undefined,{stayAwake:true})).toPNG());return;}catch(e){last=e;await pause(200);}}throw Error('Own-window capture failed: '+name+' · '+String(last));};
 cap.webContents.setBackgroundThrottling(false);
 cap.webContents.setAudioMuted(true);
 // The fixture drives the renderer itself; input from the shared desktop must not close its panels.
 cap.webContents.on('before-input-event',event=>event.preventDefault());
 cap.webContents.on('before-mouse-event',event=>event.preventDefault());
 let mediaEffects=0,mediaReads=0;const mediaActions:string[]=[];
 const sendMedia=media.command.bind(media),readMedia=media.snapshot.bind(media);
 media.command=(...args:Parameters<CompanionMedia['command']>)=>{mediaEffects++;mediaActions.push(args[0].action);return sendMedia(...args);};
 media.snapshot=(...args:Parameters<CompanionMedia['snapshot']>)=>{mediaReads++;return readMedia(...args);};
 const nativeCalls={bounds:0,shape:0,order:0,focus:0,raise:0},setBounds=cap.setBounds.bind(cap),setShape=cap.setShape.bind(cap),setOrder=cap.setAlwaysOnTop.bind(cap),focus=cap.focus.bind(cap),raise=cap.moveTop.bind(cap);
 cap.setBounds=(...args:Parameters<BrowserWindow['setBounds']>)=>{nativeCalls.bounds++;return setBounds(...args);};
 cap.setShape=(...args:Parameters<BrowserWindow['setShape']>)=>{nativeCalls.shape++;return setShape(...args);};
 cap.setAlwaysOnTop=(...args:Parameters<BrowserWindow['setAlwaysOnTop']>)=>{nativeCalls.order++;return setOrder(...args);};
 cap.focus=()=>{nativeCalls.focus++;return focus();};
 cap.moveTop=()=>{nativeCalls.raise++;return raise();};
 const taskbarCalls:boolean[]=[],setSkipTaskbar=cap.setSkipTaskbar.bind(cap);
 cap.setSkipTaskbar=(skip:boolean)=>{taskbarCalls.push(skip);setSkipTaskbar(skip);};

 const nativeProbe=(...flags:string[])=>new Promise<any>(resolve=>{
  const p=spawn('pwsh.exe',['-NoProfile','-NonInteractive','-File',join(process.cwd(),'scripts','test-app-window-edges.ps1'),'-WindowHandle',cap.getNativeWindowHandle().readBigUInt64LE().toString(),'-Owner',String(process.pid),...flags],{stdio:'pipe',windowsHide:true});
  let output='';
  const timer=setTimeout(()=>{p.kill();resolve({});},12000);
  p.stdout.on('data',bytes=>output+=bytes);p.stderr.resume();
  p.on('error',()=>{clearTimeout(timer);resolve({});});
  p.on('close',()=>{clearTimeout(timer);try{resolve(JSON.parse(output));}catch{resolve({});}});
 });
 const pillReady=()=>js(cap,"!!document.querySelector('.zen-island-trigger:not(:disabled)')&&!document.querySelector('.companion-bar')");
 const waitForIsland=()=>wait(async()=>await pillReady()&&cap.getBounds().width===ISLAND_SIZE.width&&cap.getBounds().height===ISLAND_SIZE.height+EDGE_ISLAND.captionReserve);
 const openIsland=async()=>{await js(cap,"document.querySelector('.zen-island-trigger').click()");await wait(()=>js(cap,"!!document.querySelector('.companion-bar')"));};
 const selectPosition=async(side:string)=>{
  await js(cap,`(()=>{const button=document.querySelector('.capsule-position [data-position=${side}]');button.focus();button.click();})()`);
  await wait(()=>js(cap,`document.querySelector('.capsule-position [aria-pressed=true]')?.dataset.position===${JSON.stringify(side)}`));
 };
 const selectorProof:Record<string,unknown>={};
 const inspectSelector=async(side:string,phase:'compact'|'expanded')=>{
  const facts=await js(cap,`(()=>{
   const buttons=[...document.querySelectorAll('.capsule-position button')];
   const points=buttons.flatMap(button=>{
    const {left,right,top,bottom}=button.getBoundingClientRect();
    return [[(left+right)/2,(top+bottom)/2],[left+2,top+2],[right-2,bottom-2]];
   });
   const visible=buttons.length===4&&buttons.every((button,index)=>{
    const [x,y]=points[index*3],rect=button.getBoundingClientRect();
    return button.getAttribute('aria-label')&&button.title&&rect.width===${CAPSULE_POSITION.button}&&rect.height===${CAPSULE_POSITION.button}&&button.contains(document.elementFromPoint(x,y));
   });
   for(const target of document.querySelectorAll('.zen-island-shell > :is(.zen-island-trigger,.capsule-move-grip,.capsule-pin)')){
    const {left,top,width,height}=target.getBoundingClientRect();
    points.push([left+width/2,top+height/2]);
    if(target.matches('.capsule-pin'))points.push([left+2,top+2],[left+width-2,top+height-2]);
   }
   return {visible,active:buttons.filter(button=>button.getAttribute('aria-pressed')==='true').map(button=>button.dataset.position),coordinates:points.map(pair=>pair.map(Math.round).join(',')).join(';')};
  })()`);
  const native=await nativeProbe('-ControlPoints',facts.coordinates);
  selectorProof[`${side}-${phase}`]={bounds:cap.getBounds(),...facts,...native};
  return facts.visible&&facts.active.length===1&&facts.active[0]===side&&native.hits?.length===(phase==='compact'?17:12)&&native.hits.every((hit:number)=>hit===1);
 };
 const capsuleMenu=async(...path:string[])=>{
  let menu:Menu|undefined,popup:PopupOptions|undefined;
  const original=Menu.prototype.popup;
  Menu.prototype.popup=function(options){menu=this;popup=options;};
  try{
   await js(cap,"document.querySelector('.capsule-options').click()");
   await wait(async()=>Boolean(menu&&popup));
   if(path.length){
    let items=menu!.items;
    const choice=path.reduce<typeof items[number]|undefined>((_,label)=>{
     const item=items.find(entry=>entry.label===label);
     items=item?.submenu?.items??[];
     return item;
    },undefined);
    if(!choice?.enabled)throw Error('Acción del menú no disponible: '+path.join(' / '));
    choice.click(choice,cap,{} as Electron.KeyboardEvent);
   }
   return menu!.items;
  }finally{
   popup?.callback?.();
   Menu.prototype.popup=original;
   await wait(()=>js(cap,"document.querySelector('.capsule-options')?.getAttribute('aria-expanded')==='false'"));
  }
 };
 const inspectVertical=()=>js(cap,`(()=>{
  const rail=document.querySelector('.capsule-single-row');
  const footer=rail.querySelector('.capsule-actions'),nav=[...rail.querySelectorAll('.capsule-launcher button')];
  const names=[...footer.children].map(item=>item.className).join(',');
  const bounds=rail.getBoundingClientRect(),strip=footer.getBoundingClientRect();
  const positions=rail.querySelector('.capsule-position').getBoundingClientRect();
  return rail.scrollHeight<=rail.clientHeight&&strip.bottom<=bounds.bottom&&
   rail.querySelector('.capsule-media-block').getBoundingClientRect().bottom<positions.top&&positions.bottom<strip.top&&
   names==='capsule-pin,capsule-options,capsule-fold'&&nav.every(row=>row.getBoundingClientRect().height===32)&&
   nav.map(row=>row.dataset.page).join(',')==='home,codex,spotify,notes,settings'&&
   !!rail.querySelector('.capsule-codex-block .capsule-notices')&&!rail.querySelector('.capsule-music-empty small');
 })()`);
 await wait(()=>js(cap,"document.querySelector('.companion-capsule').dataset.edge==='left'&&!document.querySelector('.zen-island-trigger').disabled"));
 const edgeAnchor=cap.getBounds();
 const edgeArea=screen.getDisplayMatching(edgeAnchor).workArea;
 const edgeReport:unknown[]=[];
 const captureSurface=async(name:string,side:'left'|'right'|'top'|'floating',panel=false)=>{
  await pause(200);
  const bounds=cap.getBounds();
  const shot=await cap.webContents.capturePage(undefined,{stayAwake:true});
  const size=shot.getSize(),pixels=shot.toBitmap();
  const reserve=panel?0:EDGE_ISLAND.captionReserve;
  const height=bounds.height-reserve;
  const top=panel?await js(cap,"parseInt(document.querySelector('.companion-capsule').style.getPropertyValue('--edge-top'),10)"):0;
  const region=side==='floating'?capsuleShape({width:bounds.width,height}):edgeShape(bounds.width,height,side,top,panel);
  for(let y=0;y<size.height;y++){
   const coord=Math.floor(y*bounds.height/size.height)-reserve;
   const rows=region.filter(row=>coord>=row.y&&coord<row.y+row.height);
   if(!rows.length){pixels.fill(0,y*size.width*4,(y+1)*size.width*4);continue;}
   const left=Math.round(Math.min(...rows.map(row=>row.x))*size.width/bounds.width);
   const right=Math.round(Math.max(...rows.map(row=>row.x+row.width))*size.width/bounds.width);
   pixels.fill(0,y*size.width*4,(y*size.width+left)*4);
   pixels.fill(0,(y*size.width+right)*4,(y+1)*size.width*4);
  }
  await writeEvidence(join(screenshots,name+'.png'),nativeImage.createFromBitmap(pixels,size).toPNG());
 };
 const inspectEdge=async(side:'left'|'right',expanded:boolean)=>{
  const bounds=cap.getBounds();
  const probe=await nativeProbe('-Edge',...(side==='right'?['-Right']:[]));
  edgeReport.push({side,expanded,bounds,content:cap.getContentBounds(),...probe});
  const scale=probe.dpi/96,expectedWidth=expanded?EDGE_ISLAND.railWidth:EDGE_ISLAND.width;
  const expectedHeight=expanded?EDGE_ISLAND.railHeight:EDGE_ISLAND.height;
  const screenArea=screen.dipToScreenRect(null,edgeArea);
  return probe.shoulders===true&&probe.reserveClear===true&&probe.passThrough===true&&probe.contentHit===1&&
   Math.abs(probe.width/scale-expectedWidth)<=1&&Math.abs(probe.height/scale-expectedHeight)<=1&&
   Math.abs(side==='left'?probe.left-screenArea.x:probe.right-screenArea.x-screenArea.width)<=1;
 };
 const leftCompact=await inspectEdge('left',false);
 const leftCompactSelector=await inspectSelector('left','compact');
 await captureSurface('edge-left-compact','left');
 await js(cap,"window.companion.island(false)");
 for(let i=0;i<28&&cap.getBounds().width===EDGE_ISLAND.width;i++)await pause(5);
 const intermediate=cap.getBounds();
 await js(cap,"window.companion.island(true)");
 const reversing=cap.getBounds();
 await wait(async()=>await pillReady()&&cap.getBounds().width===EDGE_ISLAND.width);
 report.edgeMotionReverses=intermediate.width>EDGE_ISLAND.width&&intermediate.x===reversing.x&&reversing.width<EDGE_ISLAND.railWidth&&
   cap.getBounds().y===edgeAnchor.y;
 await openIsland();
 const leftExpanded=await inspectEdge('left',true);
 const leftRailLayout=await inspectVertical();
 const leftExpandedSelector=await inspectSelector('left','expanded');
 const firstMenu=await capsuleMenu();
 report.edgeRailRetainsMinimize=!cap.isMinimizable()&&firstMenu.some(item=>item.label==='Minimizar ZEN');
 report.capsuleSecondaryMenu=firstMenu.some(item=>item.label==='Volver a mi aplicación'||item.label.startsWith('Volver a '))&&
  !firstMenu.some(item=>item.label==='Ubicación')&&
  firstMenu.find(item=>item.label==='Ajustar posición')?.submenu?.items.length===3&&firstMenu.some(item=>item.label==='Siempre encima')&&
  await js(cap,"document.activeElement===document.querySelector('.capsule-options')");
 const leftRail=cap.getBounds();
 await captureSurface('edge-left-expanded','left');
 await js(cap,"window.companion.moveCapsule('right')");
 await wait(()=>js(cap,"document.querySelector('.companion-capsule').dataset.edge==='right'"));
 const rightExpanded=await inspectEdge('right',true);
 const rightExpandedSelector=await inspectSelector('right','expanded');
 report.verticalCapsuleFiveBlocks=leftRailLayout&&await inspectVertical();
 await captureSurface('edge-right-expanded','right');
 const footerY=()=>js(cap,"document.querySelector('.capsule-actions').getBoundingClientRect().top");
 const footerRest=await footerY();
 observationFixture.paused=true;
 await wait(()=>js(cap,"document.querySelector('.capsule-now-playing')?.dataset.playing==='false'"));
 const pausedStable=await footerY()===footerRest&&await js(cap,"document.querySelector('.mini-track small')?.textContent==='En pausa'&&!document.querySelector('.mini-transport')");
 await captureSurface('edge-right-paused','right');
 observationFixture.playing=true;
 await wait(()=>js(cap,"document.querySelector('.capsule-now-playing')?.dataset.playing==='true'"));
 report.verticalMediaKeepsFooter=pausedStable&&await footerY()===footerRest&&await inspectVertical();
 observationFixture.playing=false;observationFixture.paused=false;
 await wait(()=>js(cap,"!!document.querySelector('.capsule-music-empty')"));
 await js(cap,"window.companion.island(true)");
 await wait(async()=>await pillReady()&&cap.getBounds().height===EDGE_ISLAND.height+EDGE_ISLAND.captionReserve);
 const rightCompact=await inspectEdge('right',false);
 await captureSurface('edge-right-compact','right');
 const rightCompactSelector=await inspectSelector('right','compact');
 const lockBounds=cap.getBounds();
 await js(cap,"document.querySelector('.zen-island-shell .capsule-pin').click()");
 await wait(()=>js(cap,"!!document.querySelector('.zen-island-shell .capsule-pin[aria-pressed=true]')&&!!document.querySelector('.zen-island-shell .capsule-move-grip[data-locked=true]')"));
 report.compactLockKeepsIslandAndOrder=await js(cap,"window.companion.moveCapsule('left').then(r=>!r.ok)")&&await pillReady()&&
  JSON.stringify(cap.getBounds())===JSON.stringify(lockBounds)&&!cap.isAlwaysOnTop();
 await captureSurface('edge-right-compact-locked','right');
 await openIsland();
 report.compactLockSharedWithCapsule=await js(cap,"!!document.querySelector('.capsule-single-row .capsule-pin[aria-pressed=true]')");
 await js(cap,"document.querySelector('.capsule-single-row .capsule-pin').click()");
 await wait(()=>js(cap,"!!document.querySelector('.capsule-single-row .capsule-pin[aria-pressed=false]')"));
 await js(cap,"window.companion.island(true)");
 await wait(async()=>await pillReady()&&cap.getBounds().height===EDGE_ISLAND.height+EDGE_ISLAND.captionReserve);
 report.capsuleUnlockSharedWithIsland=await js(cap,"!!document.querySelector('.zen-island-shell .capsule-pin[aria-pressed=false]')&&!!document.querySelector('.zen-island-shell .capsule-move-grip[data-locked=false]')");
 report.edgeRegionsAndHitTesting=leftCompact&&leftExpanded&&rightCompact&&rightExpanded;
 report.edgeGeometryEvidence=edgeReport;
 await writeEvidence(join(evidenceDirectory,'edge-native.json'),JSON.stringify(edgeReport));
 report.edgeCenterStable=Math.abs((edgeAnchor.y+edgeAnchor.height/2)-(leftRail.y+leftRail.height/2))<=1;
 const edgeCursor=screen.getCursorScreenPoint.bind(screen);
 const rightAnchor=cap.getBounds();
 let dragPoint={x:rightAnchor.x+16,y:rightAnchor.y+40};
 screen.getCursorScreenPoint=()=>dragPoint;
 try{
  await js(cap,"window.companion.drag('start')");
  dragPoint={x:edgeArea.x+10,y:rightAnchor.y-95};
  await wait(async()=>cap.getBounds().x===edgeArea.x&&cap.getBounds().y<rightAnchor.y-60);
  await js(cap,"window.companion.drag('end')");
  const saved=JSON.parse(readFileSync(join(profile,'companion-workspace-window.json'),'utf8')).edgeDock;
  report.edgeDragAndAnchorSaved=await pillReady()&&saved.side==='left'&&saved.displayId===screen.getDisplayMatching(cap.getBounds()).id&&saved.fraction<.45;
 } finally {screen.getCursorScreenPoint=edgeCursor;}
 await openIsland();
 await js(cap,"window.companion.moveCapsule('right')");
 await js(cap,"window.companion.moveCapsule('center')");
 await nav('codex');
 const panelGeometry=cap.getBounds();
 report.edgePanelOpensInward=panelGeometry.x+panelGeometry.width===edgeArea.x+edgeArea.width&&
  await js(cap,"document.querySelector('.workspace-content').getBoundingClientRect().width>=470");
 await captureSurface('edge-right-panel','right',true);
 await js(cap,"window.companion.pinWindow(true)");
 report.edgeLockIndependent=await js(cap,"window.companion.moveCapsule('left').then(r=>!r.ok)")&&!cap.isAlwaysOnTop();
 await selectPosition('top');
 await wait(()=>js(cap,"document.querySelector('.companion-capsule').dataset.edge==='top'&&!!document.querySelector('.workspace-content:not([hidden])[data-page=codex]')"));
 report.locationSelectorKeepsPanelWithLock=cap.getBounds().y===edgeArea.y&&!cap.isAlwaysOnTop()&&await js(cap,"document.activeElement.matches('.capsule-position [data-position=top]')");
 report.topWorkspaceMinimizeUsesNativeControl=cap.isMinimizable()&&await js(cap,"navigator.windowControlsOverlay.visible&&!document.querySelector('.capsule-hide')");
 await js(cap,"window.companion.pinWindow(false)");
 await js(cap,"window.companion.launcher(false)");
 await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
 const checkTop=async(phase:string)=>{
  const probe=await nativeProbe('-Edge','-Top');
  await captureSurface('edge-top-'+phase,'top');
  return probe.shoulders===true&&probe.reserveClear===true&&probe.passThrough===true&&probe.contentHit===1&&
    probe.top===screen.dipToScreenRect(null,edgeArea).y&&Math.abs((cap.getBounds().x+cap.getBounds().width/2)-(edgeArea.x+edgeArea.width/2))<=1;
 };
 const topOpen=await checkTop('expanded');
 const topExpandedSelector=await inspectSelector('top','expanded');
 await js(cap,"document.querySelector('.capsule-fold').click()");
 await wait(async()=>await pillReady()&&cap.getBounds().width===ISLAND_SIZE.width);
 report.topCapsuleNativeRegion=topOpen&&await checkTop('compact');
 const topCompactSelector=await inspectSelector('top','compact');
 const appearanceAcrossLocations=async()=>{
  const facts:string[][]=[];
  for(const position of ['left','right','top','floating']){
   await selectPosition(position);
   await wait(()=>js(cap,`window.companion.status().then(r=>r.value.workspace.location===${JSON.stringify(position)})`));
   facts.push(await js(cap,`(()=>{
    const root=document.querySelector('.companion-capsule'),scene=getComputedStyle(root,'::before'),glass=getComputedStyle(root,'::after');
    return [root.dataset.background,scene.backgroundImage,glass.backgroundColor,glass.backdropFilter];
   })()`));
  }
  return facts.every(fact=>fact[0]==='dusk'&&fact.slice(1).every(value=>value!=='none')&&JSON.stringify(fact)===JSON.stringify(facts[0]));
 };
 report.glassSharedAcrossLocations=await appearanceAcrossLocations();
 const floatingCompactSelector=await inspectSelector('floating','compact');
 await openIsland();
 const floatingExpandedSelector=await inspectSelector('floating','expanded');
 await shot(cap,'floating-expanded');
 report.selectorAllPositionsNative=leftCompactSelector&&leftExpandedSelector&&rightCompactSelector&&rightExpandedSelector&&topCompactSelector&&topExpandedSelector&&floatingCompactSelector&&floatingExpandedSelector;
 await writeEvidence(join(evidenceDirectory,'capsule-position-native.json'),JSON.stringify(selectorProof,null,2));
 await nav('home');
 await js(cap,`(()=>{
  const field=document.querySelector('#codex-request');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'Borrador de las cuatro posiciones');
  field.dispatchEvent(new Event('input',{bubbles:true}));
 })()`);
 const floatingBefore=cap.getBounds(),mediaBefore=mediaEffects,queuedBefore=queuedRequests.length;
 for(const value of ['top','right','left','floating'])await selectPosition(value);
 report.selectorRestoresFloatingGeometry=JSON.stringify(cap.getBounds())===JSON.stringify(floatingBefore)&&
  mediaBefore===mediaEffects&&queuedBefore===queuedRequests.length;
 const unchanged={...nativeCalls};
 await selectPosition('floating');
 report.selectorCurrentPositionQuiet=Object.keys(unchanged).every(key=>unchanged[key as keyof typeof unchanged]===nativeCalls[key as keyof typeof nativeCalls]);
 await js(cap,"['right','left','top','floating'].forEach(side=>document.querySelector('.capsule-position [data-position='+side+']').click())");
 await wait(()=>js(cap,"document.querySelector('.capsule-position [aria-pressed=true]')?.dataset.position==='floating'"));
 await pause(150);
 report.selectorLastRapidChoice=await js(cap,"window.companion.status().then(r=>r.value.workspace.location==='floating')");
 await js(cap,"document.querySelector('.capsule-fold').click()");
 await waitForIsland();
 await openIsland();
 report.locationRoundTripResumesPanel=await js(cap,"document.querySelector('.workspace-content:not([hidden])')?.dataset.page==='home'&&document.querySelector('#codex-request').value==='Borrador de las cuatro posiciones'");
 await js(cap,`(()=>{
  const field=document.querySelector('#codex-request');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'');
  field.dispatchEvent(new Event('input',{bubbles:true}));
 })()`);
 await nav('options');
 await js(cap,"window.companion.moveCapsule('left')");
 await js(cap,"window.companion.launcher(false)");
 await js(cap,"window.companion.island(true)");
 await waitForIsland();
 const islandStart=cap.getBounds(),islandOrder=await nativeProbe('-Order');
 const nativeIsland=await nativeProbe('-Island');
 await writeEvidence(join(evidenceDirectory,'island-region-native.json'),JSON.stringify(nativeIsland));
 report.islandNativeRegion=nativeIsland;
 report.islandRegionMatchesPill=nativeIsland.rounded===true&&nativeIsland.contentHit===1&&nativeIsland.rightHit===1&&nativeIsland.reserveClear===true&&
   Math.abs(nativeIsland.width/(nativeIsland.dpi/96)-ISLAND_SIZE.width)<=2&&Math.abs(nativeIsland.height/(nativeIsland.dpi/96)-ISLAND_SIZE.height)<=1;
 report.islandStartsCompactAndNormal=BrowserWindow.getAllWindows().length===1&&islandOrder.topmost===false&&islandOrder.owner===0;
 await captureSurface('dynamic-island','floating');
 const initialQueue=queuedRequests.length;
 for(let count=0;count<3;count++){
  if(count===0)await openIsland();
  else {
   const key=count===1?'Enter':' ';
   await js(cap,`(() => {
    const trigger=document.querySelector('.zen-island-trigger');
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},bubbles:true,cancelable:true}));
   })()`);
   await wait(()=>js(cap,"!!document.querySelector('.companion-bar')"));
  }
  await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
  await js(cap,count===1?"window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))":"document.querySelector('.capsule-fold').click()");
  await waitForIsland();
 }
 report.islandRoundTripQuiet=JSON.stringify(islandStart)===JSON.stringify(cap.getBounds())&&initialQueue===queuedRequests.length;
 const cursorPosition=screen.getCursorScreenPoint.bind(screen);
 let cursor={x:islandStart.x+30,y:islandStart.y+EDGE_ISLAND.captionReserve+18};
 screen.getCursorScreenPoint=()=>cursor;
 const gesture=(event:string,x:number)=>js(cap,`(() => {
  const button=document.querySelector('.zen-island-shell > .capsule-move-grip');
  button.setPointerCapture=()=>{};
  button.dispatchEvent(new PointerEvent('${event}',{bubbles:true,isPrimary:true,pointerId:1,screenX:${x}}));
 })()`);
 try {
  await gesture('pointerdown',30);
  await gesture('pointermove',38);
  await pause(70);
  cursor={...cursor,x:cursor.x+50};
  await wait(async()=>cap.getBounds().x>islandStart.x);
  await gesture('pointerup',88);
  await js(cap,"document.querySelector('.zen-island-shell > .capsule-move-grip').dispatchEvent(new MouseEvent('click',{detail:1,bubbles:true}))");
  await pause(motion.island+70);
  report.islandDragDoesNotOpen=await pillReady()&&cap.getBounds().x>islandStart.x;
 } finally {screen.getCursorScreenPoint=cursorPosition;}
 await openIsland();
 await js(cap,"window.companion.moveCapsule('left')");
 const realFocus=cap.isFocused.bind(cap);
 cap.isFocused=()=>false;
 try {
  const blur=async()=>{cap.emit('blur');await pause(ISLAND_BLUR_MS+motion.island+70);};
  const railVisible=()=>js(cap,"!!document.querySelector('.companion-bar')");
  await blur();
  const defaults=await railVisible();
  await nav('settings');
  await js(cap,"window.companion.save({collapseOnBlur:true})");
  await nav('home');
  await js(cap,`(() => {
   const field=document.querySelector('#codex-request');
   Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'Borrador durante la contracción');
   field.dispatchEvent(new Event('input',{bubbles:true}));
   field.focus();
  })()`);
  await pause(80);
  await blur();
  const editing=await railVisible();
  await js(cap,"document.querySelector('#codex-request').blur();window.companion.keepExpanded(true)");
  await blur();
  const pinned=await railVisible();
  await js(cap,"window.companion.keepExpanded(false)");
  cap.emit('blur');
  cap.emit('focus');
  await pause(ISLAND_BLUR_MS+70);
  const refocused=await railVisible();
  await js(cap,"window.companion.islandFocusGuard(false)");
  await blur();
  await waitForIsland();
  report.islandBlurRespectsGuards=defaults&&editing&&pinned&&refocused;
  await openIsland();
  await nav('home');
  report.islandPreservesDraft=await js(cap,"document.querySelector('#codex-request').value==='Borrador durante la contracción'");
  await js(cap,`(() => {
   const field=document.querySelector('#codex-request');
   Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'');
   field.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await nav('settings');
  await js(cap,"window.companion.save({collapseOnBlur:false})");
  await js(cap,"window.companion.launcher(false)");
  await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
 } finally {cap.isFocused=realFocus;}
 const nativeCapsuleFrame=async()=>{
  const r=await nativeProbe('-Capsule');
  report.capsuleNativeFrameAttributes=r;
  return r.noBackdrop===true&&!cap.hasShadow()&&r.thickFrame===false&&r.ncEnabled===false&&JSON.stringify(r.window)===JSON.stringify(r.extendedFrame);
 };
 if(app.isPackaged){
  const launcher=process.env.PORTABLE_EXECUTABLE_FILE??process.execPath;
  const details=await nativeProbe('-Taskbar');
  report.taskbarProperties=details;
  if(details.appId!=='com.zen.desktop'||details.relaunch!==`"${launcher}"`||details.displayName!=='ZEN'||
     details.icon?.replaceAll('"','')!==`${launcher},0`)throw Error('El botón de la barra de tareas no apunta a ZEN.exe. '+JSON.stringify(details));
  report.taskbarUsesStableLauncher=true;
 }
 report.capsuleNativeOuterFrameRemoved=await nativeCapsuleFrame();report.capsuleNoCssOuterShadow=await js(cap,"getComputedStyle(document.querySelector('.companion-capsule')).boxShadow==='none'");
 await wait(()=>js(cap,"document.querySelector('.companion-capsule').dataset.background==='dusk'"));
 report.capsuleAppearanceAtStartup=await js(cap,"(()=>{const r=document.querySelector('.companion-capsule'),h=getComputedStyle(document.querySelector('.capsule-single-row'));return{theme:r.dataset.theme,background:r.dataset.background,color:h.backgroundColor,blur:h.backdropFilter,layer:getComputedStyle(r,'::before').content};})()");
 report.capsuleSavedAppearanceOnStartup=report.capsuleAppearanceAtStartup.theme==='dark'&&report.capsuleAppearanceAtStartup.background==='dusk'&&report.capsuleAppearanceAtStartup.color==='rgba(18, 20, 31, 0.74)'&&report.capsuleAppearanceAtStartup.blur.includes('blur(7px)')&&report.capsuleAppearanceAtStartup.layer!=='none';
 await writeEvidence(join(evidenceDirectory,'capsule-frame-native.json'),JSON.stringify({at:new Date().toISOString(),attributes:report.capsuleNativeFrameAttributes,outerFrameRemoved:report.capsuleNativeOuterFrameRemoved,cssOuterShadowRemoved:report.capsuleNoCssOuterShadow}));
 const compactBounds=cap.getBounds(),same=(a:any,b:any)=>['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<=1);
 const startDisplay=screen.getDisplayMatching(compactBounds),workArea=startDisplay.workArea;
 const railBounds=(bounds:typeof compactBounds)=>({...bounds,height:capsuleRailHeight(bounds.width,true)});
 report.capsuleSize=same(compactBounds,railBounds(workspaceLayout(workArea,'left')));
 const headerLayout=()=>js(cap,`(()=>{
  const header=document.querySelector('.capsule-single-row'),rect=e=>e.getBoundingClientRect(),h=rect(header);
  const caption=navigator.windowControlsOverlay.getTitlebarAreaRect();
  const blocks=[...header.querySelectorAll(':scope>[data-capsule-block]')].map(rect);
  const buttons=[...header.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(rect);
  const disjoint=(a,b)=>a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5;
  return blocks.length===5&&header.querySelectorAll('.capsule-actions>button').length===3&&blocks.every((r,i)=>r.width>0&&r.left>=h.left&&r.right<=h.right+.5&&r.top>=h.top&&r.bottom<=h.bottom+.5&&blocks.slice(0,i).every(other=>disjoint(r,other)))&&
   buttons.every(r=>r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth+.5&&r.top>=0&&r.bottom<=h.bottom+.5&&
    (r.top>=caption.bottom||r.right<=caption.right))&&header.scrollWidth<=header.clientWidth;
 })()`);
 report.capsuleSingleRowWithoutOverlap=await headerLayout();
 report.fiveIndependentHeaderBlocks=await js(cap,"[...document.querySelectorAll('.companion-bar>[data-capsule-block]')].map(e=>e.dataset.capsuleBlock).join(',')==='codex,navigation,music,position,controls'");
 report.compactHeaderHeight=await js(cap,"document.querySelector('.companion-bar').getBoundingClientRect().height===66");
 report.capsuleContentRailHeight=await js(cap,`[...document.querySelectorAll('.capsule-single-row > [data-capsule-block]')]
  .every(block=>block.getBoundingClientRect().height===54)`);
 report.capsuleRefinedNavigation=await js(cap,`(()=>{
  const current=document.querySelector('.capsule-launcher button[aria-current=page]');
  const glyph=getComputedStyle(current.querySelector('svg')),label=getComputedStyle(current.querySelector('span'));
  const marker=getComputedStyle(current,'::after');
  return glyph.width==='18px'&&label.fontSize==='11px'&&label.color!==glyph.color&&marker.height==='2px'&&
   marker.backgroundColor===glyph.color&&current.getBoundingClientRect().height===42&&
   [...current.parentElement.querySelectorAll('button>span')].every(span=>span.scrollWidth<=span.clientWidth)&&
   getComputedStyle(document.querySelector('.companion-state strong')).fontSize==='13px'&&
   document.querySelector('.capsule-pin').getBoundingClientRect().height===29;
 })()`);
 report.capsuleStateTooltipAndTruncation=await js(cap,`(()=>{
  const state=document.querySelector('.companion-state'),label=state.querySelector('.capsule-state-label');
  const original=label.textContent;
  label.textContent=original.repeat(20);
  const style=getComputedStyle(label);
  const truncates=label.scrollWidth>label.clientWidth&&style.textOverflow==='ellipsis'&&state.title.includes(' · ')&&original.length<=16;
  label.textContent=original;
  return truncates;
 })()`);
 await shot(cap,'capsule-roomy');
 report.noChat=await js(cap,"!document.querySelector('textarea')&&!window.zen");
 report.noCharacter=await js(cap,"!document.querySelector('canvas,.companion-wardrobe')");
 report.noCursorPolling=await js(cap,"!('cursor' in window.companion)&&!('onCursor' in window.companion)");
 report.capsuleNoAuthority=await js(cap,`window.companion.decide('${randomUUID()}','allow').then(r=>!r.ok)`);
 for(const [alignment,ratio] of [['left',0],['right',1],['center',.5],['left',0]] as const){
  await capsuleMenu('Ajustar posición',alignment==='center'?'Centrar en este monitor':alignment==='left'?'Mover al extremo izquierdo':'Mover al extremo derecho');
  const expected={...compactBounds,x:workArea.x+Math.round((workArea.width-compactBounds.width)*ratio),y:workArea.y};
  await wait(async()=>same(expected,cap.getBounds())&&screen.getDisplayMatching(cap.getBounds()).id===startDisplay.id);
  await wait(async()=>{
   const saved=JSON.parse(readFileSync(join(profile,'companion-workspace-window.json'),'utf8'));
   return saved.mode==='capsule'&&saved.current.displayId===startDisplay.id&&same(expected,railBounds(saved.current.bounds));
  });
  if(alignment==='right'){
   await nav('home');
   await wait(async()=>same(expected,railBounds(cap.getBounds())));
   await js(cap,"window.companion.launcher(false)");
   await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
  }
 }
 report.capsuleQuickPositions=true;
 await shot(cap,'capsule-move-positions');
 const railStyle=`(()=>{
  const root=document.querySelector('.companion-capsule'),bar=root.querySelector('.capsule-single-row');
  const style=getComputedStyle(bar),scene=getComputedStyle(root,'::before');
  return JSON.stringify({color:style.backgroundColor,blur:style.backdropFilter,rounding:style.borderRadius,
   backdrop:[scene.height,scene.backgroundImage,scene.backgroundSize,scene.filter],
   nativeCaption:navigator.windowControlsOverlay.getTitlebarAreaRect().toJSON(),
   bounds:[bar,...bar.querySelectorAll('[data-capsule-block],.capsule-actions button')].map(e=>e.getBoundingClientRect().toJSON())});
 })()`;
 const foldedRail=await js(cap,railStyle);
 await nav('home');
 await wait(()=>js(cap,"[...document.querySelectorAll('.home-panel button')].some(b=>b.textContent==='Crear apunte')"));
 report.homeShowsRealEmptyStates=await js(cap,"document.querySelector('#home-title').textContent==='ZEN Workspace'&&!!document.querySelector('[data-home-card=notes]')&&document.querySelector('.home-panel').textContent.includes('Todavía no tienes apuntes.')");
 const homeBounds=cap.getBounds();
 report.workspaceInitiallyHalfLeft=same(homeBounds,workspaceLayout(workArea,'left'))&&!cap.isSnapped();
 try{await wait(async()=>await js(cap,railStyle)===foldedRail);}
 catch{throw Error('Cabecera recogida '+foldedRail+' · desplegada '+await js(cap,railStyle));}
 report.workspaceSharesCapsuleRail=same(railBounds(homeBounds),compactBounds);
 const homeArea=screen.getDisplayMatching(homeBounds).workArea;
 await capsuleMenu('Ajustar posición','Mover al extremo derecho');
 await wait(async()=>same({...homeBounds,x:homeArea.x+homeArea.width-homeBounds.width},cap.getBounds()));
 report.capsuleMovesWithHomeOpen=await js(cap,"!!document.querySelector('.workspace-content:not([hidden])[data-page=home]')");
 await capsuleMenu('Ajustar posición','Mover al extremo izquierdo');
 await wait(async()=>same(homeBounds,cap.getBounds()));
 await shot(cap,'capsule-same-rail-expanded');
 await js(cap,"window.companion.launcher(false)");
 await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
 report.capsuleRailStableAfterCollapse=await js(cap,railStyle)===foldedRail;
 report.workspaceLayoutOnlyFromOptions=await js(cap,"window.companion.workspaceLayout('right').then(r=>!r.ok)");
 for(const page of ['home','spotify','codex','notes','notices','settings']){
  await js(cap,`document.querySelector('.companion-bar [data-page="${page}"]').click()`);await wait(()=>js(cap,`!!document.querySelector('.workspace-content:not([hidden])[data-page="${page}"]')`));
  if(page==='settings')report.settingsInPrimaryNavigation=await js(cap,"!!document.querySelector('.preferences-center')&&document.querySelector('.capsule-launcher [aria-current=page]')?.dataset.page==='settings'");
  const other=page==='home'?'spotify':'home';const beforeSwitch=cap.getBounds();await js(cap,`document.querySelector('.companion-bar [data-page="${other}"]').click()`);await wait(()=>js(cap,`!!document.querySelector('.workspace-content:not([hidden])[data-page="${other}"]')`));
  if(!same(beforeSwitch,cap.getBounds())||!await js(cap,"document.querySelectorAll('.companion-bar [data-page]').length===6"))throw Error('Switching integrations changed geometry or hid integrations.');
  await js(cap,`document.querySelector('.companion-bar [data-page="${page}"]').click()`);await wait(()=>js(cap,`!!document.querySelector('.workspace-content:not([hidden])[data-page="${page}"]')`));
  await js(cap,`document.querySelector('.companion-bar [data-page="${page}"]').click()`);
  if(!await js(cap,`!!document.querySelector('.workspace-content:not([hidden])[data-page="${page}"]')`))throw Error('Clicking the active section closed the workspace.');
  await js(cap,"window.companion.launcher(false)");await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
  if(!same(compactBounds,cap.getBounds()))throw Error('Repeating the active icon did not restore the capsule anchor.');
 }
 report.allNavigationIconsToggleCapsule=true;
 report.switchingIconsKeepsExpanded=true;await js(cap,"Promise.all([window.companion.togglePage('home'),window.companion.togglePage('spotify')])");await wait(()=>js(cap,"!!document.querySelector('.workspace-content:not([hidden])[data-page=spotify]')"));await js(cap,"Promise.all([window.companion.togglePage('home'),window.companion.togglePage('home')])");await wait(()=>js(cap,"!!document.querySelector('.workspace-content:not([hidden])[data-page=home]')"));report.fastIconClicksUseMainState=true;
 await js(cap,"window.companion.launcher(false)");await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
 await js(cap,"document.querySelector('.companion-brand').click()");await wait(()=>js(cap,"!!document.querySelector('.workspace-content:not([hidden])')"));
 const expandedBounds=cap.getBounds();
 report.workspaceRestoresLeftHalf=same(expandedBounds,homeBounds);
 report.workspaceNativeSizing=cap.isResizable()&&cap.isMovable()&&cap.isMaximizable()&&cap.isMinimizable()&&await headerLayout();
 const gripPosition=()=>js(cap,`(()=>{const grip=document.querySelector('.capsule-move-grip'),r=grip.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),region:getComputedStyle(grip).getPropertyValue('app-region')};})()`);
 let grip=await gripPosition();
 let snapProbe=await nativeProbe('-Snap','-DragX',String(grip.x),'-DragY',String(grip.y));
 for(let attempt=0;attempt<2&&(!snapProbe.captionHit||!snapProbe.maximizeHit);attempt++){
  await pause(150);
  grip=await gripPosition();
  snapProbe=await nativeProbe('-Snap','-DragX',String(grip.x),'-DragY',String(grip.y));
 }
 const edgeProbe=await nativeProbe();
 report.workspaceNativeCaption=snapProbe.resizable===true&&snapProbe.maximizable===true&&snapProbe.maximizeHit===true&&snapProbe.captionHit===true;
 report.workspaceNativeResizeEdges=edgeProbe.left===true&&edgeProbe.right===true&&edgeProbe.bottom===true;
 report.workspaceNativeHitTests={caption:snapProbe,edges:edgeProbe,grip};
 report.singleCapsuleWindow=BrowserWindow.getAllWindows().length===1;
 report.launcherNoPrivateAccess=await js(cap,"window.companion.mediaList().then(r=>!r.ok)");
 report.fiveHeaderIconsAndNotices=await js(cap,"document.querySelectorAll('.companion-bar .capsule-launcher button').length===5&&!!document.querySelector('.capsule-launcher [data-page=notes]')&&!!document.querySelector('.capsule-launcher [data-page=settings][aria-label=Configuración]')&&!!document.querySelector('.capsule-codex-block [data-page=notices]')");
 report.cleanCapsuleControls=await js(cap,"document.querySelectorAll('.companion-bar nav[aria-label=\"Controles de la cápsula\"]>button').length===3&&navigator.windowControlsOverlay.visible");
 await shot(cap,'capsule-integrations');
 await capsuleMenu('Distribución de ventana');await wait(()=>js(cap,"!!document.querySelector('.capsule-inline-menu')"));report.inlineOptions=await js(cap,"document.body.textContent.includes('Distribución de ventana')")&&BrowserWindow.getAllWindows().length===1;
 const chooseLayout=async(label:string)=>js(cap,`[...document.querySelectorAll('.workspace-layout-actions button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
 await js(cap,"document.querySelector('.workspace-layout-menu summary').click()");
 await chooseLayout('Mitad derecha');
 await wait(async()=>same(workspaceLayout(homeArea,'right'),cap.getBounds()));
 await chooseLayout('Ventana libre');
 await wait(async()=>same(workspaceLayout(homeArea,'free'),cap.getBounds()));
 await chooseLayout('Maximizar');
 await wait(async()=>cap.isMaximized());
 await js(cap,"window.companion.launcher(false)");
 await wait(async()=>!cap.isMaximized()&&same(railBounds(homeArea),cap.getBounds()));
 await js(cap,"window.companion.options()");
 await wait(async()=>cap.isMaximized()&&await js(cap,"!!document.querySelector('.workspace-layout-menu')"));
 await js(cap,"document.querySelector('.workspace-layout-menu summary').click()");
 await chooseLayout('Restaurar última posición');
 await wait(async()=>!cap.isMaximized()&&same(workspaceLayout(homeArea,'free'),cap.getBounds()));
 await chooseLayout('Mitad izquierda');
 await wait(async()=>same(expandedBounds,cap.getBounds()));
 report.workspaceLayoutActions=true;
 await js(cap,"window.companion.launcher(false)");
 await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
 if(!cap.isMaximizable())throw Error('La cápsula perdió el control nativo de maximizar.');
 cap.maximize();
 await wait(async()=>cap.isMaximized()&&await js(cap,"!!document.querySelector('.workspace-content:not([hidden])')"));
 report.compactCaptionOpensMaximizedWorkspace=true;
 await js(cap,"window.companion.options()");
 await wait(()=>js(cap,"!!document.querySelector('.workspace-layout-menu')"));
 await js(cap,"document.querySelector('.workspace-layout-menu').open=true");
 await chooseLayout('Mitad izquierda');
 await wait(async()=>!cap.isMaximized()&&same(expandedBounds,cap.getBounds()));
 report.workspaceLayoutPreferences=await js(cap,"window.companion.workspaceLayoutPreferences({side:'right',restoreOnLaunch:false}).then(r=>r.ok)")&&
  JSON.parse(readFileSync(join(profile,'companion-workspace-window.json'),'utf8')).preferences.side==='right';
 await js(cap,"window.companion.workspaceLayoutPreferences({side:'left',restoreOnLaunch:true})");
 await js(cap,"document.querySelector('.companion-bar [data-page=spotify]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))");await wait(()=>js(cap,"!!document.querySelector('.workspace-content:not([hidden])[data-page=shortcuts]')"));report.inlineContextMenu=await js(cap,"document.body.textContent.includes('Ver en cápsula')")&&BrowserWindow.getAllWindows().length===1;
 await js(cap,"document.querySelector('.companion-bar [data-page=home]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',altKey:true,bubbles:true,cancelable:true}))");await wait(()=>js(cap,"document.querySelector('.capsule-launcher button').dataset.page==='codex'"));
 report.launcherOrderPersisted=JSON.parse(readFileSync(join(profile,'companion-launcher.json'),'utf8')).order[0]==='codex';
 report.invalidLauncherOrderRefused=await js(cap,"window.companion.launcherOrder(['home','home','codex','notes','notices']).then(r=>!r.ok)");
 await js(cap,"window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));report.escapeCollectsCapsule=same(compactBounds,cap.getBounds());
 await js(cap,"document.querySelector('.companion-bar [data-page=spotify]').click()");await wait(()=>js(cap,"!!document.querySelector('.workspace-content:not([hidden])[data-page=spotify]')"));report.launcherSelectSameWindow=BrowserWindow.getAllWindows().length===1&&same(expandedBounds,cap.getBounds());
 await js(cap,"window.companion.launcher(false)");await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));report.launcherRestoresAnchor=same(compactBounds,cap.getBounds());
 const desktopExe=nativeHelper(__dirname,'desktop');
 report.nativeOutsideClickHook=await new Promise<boolean>(resolve=>{
  const p=spawn(desktopExe,['--watch',String(process.pid),cap.getNativeWindowHandle().readBigUInt64LE().toString()],{stdio:'pipe',windowsHide:true});
  let buffer='';
  const timer=setTimeout(()=>{p.kill();resolve(false);},5000);
  p.stderr.resume();
  p.stdin.on('error',()=>{});
  p.on('error',()=>{clearTimeout(timer);resolve(false);});
  p.on('close',()=>{clearTimeout(timer);resolve(false);});
  p.stdout.on('data',chunk=>{
   buffer+=chunk;
   if(!buffer.split(/\r?\n/).includes('{"event":"outside-click-ready"}'))return;
   clearTimeout(timer);
   p.stdin.end();
   resolve(true);
  });
 });
 const setPin=async(enabled:boolean)=>{
  const order=nativeCalls.order;
  await js(cap,"document.querySelector('.capsule-pin').click()");
  try{
   await wait(()=>js(cap,`document.querySelector('.capsule-pin').getAttribute('aria-pressed')==='${enabled}'`));
  }catch{
   const pressed=await js(cap,"document.querySelector('.capsule-pin').getAttribute('aria-pressed')");
   throw Error('Candado · '+JSON.stringify({enabled,pressed,topmost:cap.isAlwaysOnTop(),visible:cap.isVisible(),minimized:cap.isMinimized()}));
  }
  const saved=JSON.parse(readFileSync(join(profile,'companion-settings.json'),'utf8'));
  if(saved.windowLocked!==enabled||saved.alwaysOnTop!==false||cap.isAlwaysOnTop()||nativeCalls.order!==order)throw Error('El candado debe guardarse sin cambiar el orden nativo.');
 };
 const saveWindowPreferences=async(values:{alwaysOnTop?:boolean;dismissCapsuleOnOutsideClick?:boolean;hideCapsuleFromTaskbar?:boolean})=>{
  await nav('settings');
  const saved=await js(cap,`window.companion.status().then(r=>window.companion.save({...r.value.settings,...${JSON.stringify(values)}}))`);
  if(!saved.ok)throw Error(saved.error);
 };
 const normalZOrder=async()=>{
  const native=await nativeProbe('-Order');
  return native.topmost===false&&native.toolWindow===false&&native.noActivate===false&&native.owner===0;
 };
 report.capsulePinStartsUnlocked=!cap.isAlwaysOnTop()&&await js(cap,"document.querySelector('.capsule-pin').getAttribute('aria-pressed')==='false'");
 report.capsuleUsesNormalZOrder=await normalZOrder();
 dismissOnOutsideClick();
 report.capsuleStaysVisibleByDefault=cap.isVisible()&&!cap.isMinimized();
 const orderBeforeNavigation={...nativeCalls};
 await saveWindowPreferences({dismissCapsuleOnOutsideClick:true});
 await js(cap,"window.companion.launcher(false)");
 await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
 for(const page of [null,'home']){
  if(page)await nav(page);
  const before=cap.getBounds();
  await setPin(true);
  dismissOnOutsideClick();
  if(!page){await wait(async()=>cap.isMinimized());cap.restore();await wait(async()=>!cap.isMinimized());}
  if(!cap.isVisible()||cap.isMinimized()||!same(before,cap.getBounds())||!await normalZOrder())throw Error('El candado o el clic fuera cambiaron el anclaje o el orden.');
  await js(cap,"window.companion.hide()");
  await wait(async()=>cap.isMinimized()&&!cap.isAlwaysOnTop());
  cap.restore();
  await wait(async()=>cap.isVisible()&&!cap.isMinimized()&&!cap.isAlwaysOnTop()&&same(before,cap.getBounds()));
  await setPin(false);
  dismissOnOutsideClick();
  if(page){
   if(cap.isMinimized()||!cap.isVisible())throw Error('El Workspace debe permitir trabajar al lado de otra ventana.');
  }else{
   await wait(async()=>cap.isMinimized()&&!cap.isAlwaysOnTop());
   cap.restore();
  }
  await wait(async()=>cap.isVisible()&&!cap.isMinimized()&&!cap.isAlwaysOnTop()&&same(before,cap.getBounds()));
  await wait(()=>js(cap,page?"!!document.querySelector('.workspace-content:not([hidden])[data-page=home]')":"!document.querySelector('.workspace-content:not([hidden])')"));
 }
 report.capsulePinWorksInBothModes=true;
 report.navigationAndRestoreDoNotRaiseWindow=nativeCalls.focus===orderBeforeNavigation.focus&&nativeCalls.raise===orderBeforeNavigation.raise;
 report.taskbarStableByDefault=taskbarCalls.length===0;
 await saveWindowPreferences({alwaysOnTop:true});
 await wait(async()=>cap.isAlwaysOnTop());
 const nativeOptIn=await nativeProbe('-Order');
 await js(cap,"window.companion.launcher(false)");
 await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
 const orderWithTopmost=nativeCalls.order;
 await js(cap,"window.companion.pinWindow(true)");
 await js(cap,"window.companion.pinWindow(false)");
 if(!cap.isAlwaysOnTop()||nativeCalls.order!==orderWithTopmost)throw Error('El candado cambió la preferencia explícita de orden.');
 await saveWindowPreferences({alwaysOnTop:false,dismissCapsuleOnOutsideClick:false});
 await wait(async()=>!cap.isAlwaysOnTop());
 const savedOrder=JSON.parse(readFileSync(join(profile,'companion-settings.json'),'utf8'));
 report.explicitTopmostSettingWorks=nativeOptIn.topmost===true&&savedOrder.alwaysOnTop===false&&savedOrder.windowLocked===false&&savedOrder.dismissCapsuleOnOutsideClick===false;
 await saveWindowPreferences({hideCapsuleFromTaskbar:true});
 await js(cap,"window.companion.launcher(false)");
 await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
 await saveWindowPreferences({hideCapsuleFromTaskbar:false});
 report.capsuleTaskbarOptOutWorks=taskbarCalls.join(',')==='true,false';
 await nav('home');
 const nativeCloseWindow=cap.getNativeWindowHandle().toString('hex'),nativeCloseBounds=cap.getBounds();
 const homeText=(value:string)=>js(cap,`(()=>{
  const field=document.querySelector('#codex-request');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,${JSON.stringify(value)});
  field.dispatchEvent(new Event('input',{bubbles:true}));
 })()`);
 await homeText('Borrador al minimizar desde la X');
 const close=await nativeProbe('-Close');
 await wait(async()=>!cap.isDestroyed()&&cap.isMinimized());
 const minimizedWindow=await nativeProbe('-Order');
 report.nativeCloseMinimizesToTaskbar=close.posted===true&&minimizedWindow.minimized===true&&minimizedWindow.visible===true&&
  minimizedWindow.toolWindow===false&&minimizedWindow.owner===0&&minimizedWindow.noActivate===false;
 await js(cap,`(()=>{
  if(document.hidden)return;
  Object.defineProperty(document,'hidden',{value:true,configurable:true});
  try{document.dispatchEvent(new Event('visibilitychange'));}finally{delete document.hidden;}
 })()`);
 const restore=await nativeProbe('-Restore');
 await wait(async()=>!cap.isMinimized()&&cap.isVisible());
 // The fixture disables background throttling, so pair its synthetic hidden event with a visible event.
 await js(cap,"document.dispatchEvent(new Event('visibilitychange'))");
 report.nativeClosePreservesWorkspace=restore.posted===true&&cap.getNativeWindowHandle().toString('hex')===nativeCloseWindow&&
  same(nativeCloseBounds,cap.getBounds())&&await js(cap,"document.querySelector('.workspace-content:not([hidden])')?.dataset.page==='home'&&document.querySelector('#codex-request').value==='Borrador al minimizar desde la X'");
 await homeText('');
 await js(cap,"window.companion.launcher(false)");
 await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
 report.outsideClickOnlyDismissesCapsule=same(compactBounds,cap.getBounds());
 report.nativeHistoryRegression=await new Promise<boolean>(resolve=>{const p=spawn(desktopExe,['--verify-history'],{stdio:'pipe',windowsHide:true});let output='';const timer=setTimeout(()=>{p.kill();resolve(false);},3000);p.stdout.on('data',b=>output+=b);p.stderr.resume();p.stdin.end();p.on('error',()=>{clearTimeout(timer);resolve(false);});p.on('close',()=>{clearTimeout(timer);try{const r=JSON.parse(output);resolve(Object.keys(r).length===5&&Object.values(r).every(v=>v===true));}catch{resolve(false);}});});
 report.nativeWindowObserver=await new Promise<boolean>(resolve=>{const p=spawn(desktopExe,['--watch',String(process.pid)],{stdio:'pipe',windowsHide:true});let buffer='';const timer=setTimeout(()=>{p.kill();resolve(false);},3000);p.stderr.resume();p.stdin.on('error',()=>{});p.on('error',()=>{clearTimeout(timer);resolve(false);});p.stdout.on('data',b=>{buffer+=b;if(buffer.includes('\n')){let ok=false;try{ok=DesktopObservation.safeParse(JSON.parse(buffer.split('\n')[0])).success;}catch{}clearTimeout(timer);p.stdin.end();resolve(ok);}});});
 await js(cap,"document.querySelector('[aria-label=\"Abrir panel de ZEN\"]').click()");await wait(()=>js(cap,"!!document.querySelector('.workspace-content:not([hidden])')"));
 report.singleWindowNavigation=BrowserWindow.getAllWindows().length===1&&await js(cap,"document.querySelectorAll('.companion-bar [data-page]').length===6");
 const area=screen.getDisplayMatching(cap.getBounds()).workArea;
 const placed=cap.getNormalBounds();
 await nav('home');const beforeNavigation={...nativeCalls};await js(cap,"window.fixtureHeader=document.querySelector('.companion-bar')");
 await nav('codex');await nav('options');await nav('notices');await nav('home');
 report.navigationDoesNotRecreateWindow=JSON.stringify(nativeCalls)===JSON.stringify(beforeNavigation)&&await js(cap,"window.fixtureHeader===document.querySelector('.companion-bar')");

 const beforeAutoEffects=mediaEffects;
 const originalTrackTitle=observationFixture.title;
 observationFixture.title='Pista de prueba con un título largo que conserva todos los controles de Windows '.repeat(5).trim();
 observationFixture.playing=true;
 await wait(()=>js(cap,"!!document.querySelector('.capsule-now-playing')"));
 for(const page of ['home','spotify','codex']){await nav(page);if(!await js(cap,"!!document.querySelector('.capsule-now-playing')"))throw Error('Automatic media disappeared while navigating.');}
 await js(cap,"window.companion.launcher(false)");await wait(()=>js(cap,"!!document.querySelector('.capsule-now-playing')&&!document.querySelector('.workspace-content:not([hidden])')"));report.automaticMediaInEverySectionAndCapsule=true;
 report.capsuleLongMediaTitleFits=await js(cap,`(()=>{
  const button=document.querySelector('.capsule-now-playing .mini-track'),title=button.querySelector('strong');
  return title.textContent===${JSON.stringify(observationFixture.title)}&&button.title.includes(title.textContent)&&
   title.scrollWidth>title.clientWidth&&getComputedStyle(title).textOverflow==='ellipsis';
 })()`)&&await headerLayout()&&same(compactBounds,cap.getBounds());
 observationFixture.source='Google Chrome';await wait(()=>js(cap,"document.querySelector('.capsule-now-playing')?.dataset.source==='Google Chrome'"));
 observationFixture.source='Reproductor de Windows';await wait(()=>js(cap,"document.querySelector('.capsule-now-playing')?.dataset.source==='Reproductor de Windows'"));report.automaticMediaAnyWindowsPublisher=true;
 report.automaticMediaDoesNotGrantControls=await js(cap,"window.companion.mediaNowPlaying().then(r=>r.ok&&r.value&&!('session' in r.value)&&!('controls' in r.value))")&&mediaEffects===beforeAutoEffects;
 await js(cap,"window.companion.presentation(true)");await wait(()=>js(cap,"!document.querySelector('.capsule-now-playing')"));report.automaticMediaRespectsPrivacy=await js(cap,"window.companion.mediaNowPlaying().then(r=>r.ok&&r.value===null)");await js(cap,"window.companion.presentation(false)");await wait(()=>js(cap,"!!document.querySelector('.capsule-now-playing')"));
 await js(cap,"window.companion.hide()");await wait(async()=>cap.isMinimized());
 report.automaticMediaHiddenReturnsNothing=await js(cap,"window.companion.mediaNowPlaying().then(r=>r.ok&&r.value===null)");cap.restore();await wait(async()=>cap.isVisible()&&!cap.isMinimized());await wait(()=>js(cap,"!!document.querySelector('.capsule-now-playing')"));
 observationFixture.playing=false;observationFixture.title=originalTrackTitle;await wait(()=>js(cap,"!document.querySelector('.capsule-now-playing')"));report.automaticMediaDisappearsWhenStopped=true;

 await nav('spotify');report.navigationKeepsBounds=same(placed,cap.getNormalBounds())&&BrowserWindow.getAllWindows().length===1;
 await wait(()=>js(cap,"document.querySelector('.music-empty h3')?.textContent==='Sin reproducción'"));
 const beforePlayback=mediaEffects;
 observationFixture.playerAvailable=true;
 await wait(()=>js(cap,"document.querySelector('.music-player')?.dataset.source==='Spotify'"));
 report.soundDetectsPlaybackAutomatically=mediaEffects===beforePlayback&&await js(cap,"document.querySelector('.music-heading h2')?.textContent==='Sonido'&&document.querySelector('.capsule-launcher [data-page=spotify]')?.getAttribute('aria-label')==='Sonido'&&!document.querySelector('.music-refresh')");
 observationFixture.playerSource='Google Chrome';
 await wait(()=>js(cap,"document.querySelector('.music-player')?.dataset.source==='Google Chrome'"));
 report.soundFollowsWindowsSource=mediaEffects===beforePlayback;
 await js(cap,"document.querySelector('.media-sources [data-session]').click()");
 await wait(()=>js(cap,"document.querySelector('.media-sources [data-session][aria-pressed=true]')&&document.querySelector('.music-player')?.dataset.source==='Spotify'"));
 await js(cap,"document.querySelector('.media-sources button:first-child').click()");
 await wait(()=>js(cap,"document.querySelector('.music-player')?.dataset.source==='Google Chrome'"));
 report.soundManualSourceAndAuto=mediaEffects===beforePlayback;
 observationFixture.playerSource='Spotify';
 await wait(()=>js(cap,"document.querySelector('.music-player')?.dataset.source==='Spotify'"));
 report.mediaUnsupportedDisabled=await js(cap,"document.querySelector('[aria-label=Aleatorio]').disabled&&document.querySelector('[aria-label=Repetir]').disabled");
 await js(cap,"document.querySelector('.capsule-now-playing .mini-play[aria-label=Pausar]').click()");await wait(()=>js(cap,"!!document.querySelector('.capsule-now-playing .mini-play[aria-label=Reproducir]')"));report.mediaDirectControl=true;

 const selectedTrack=await js(cap,"window.companion.mediaCurrent().then(r=>r.value.session)");
 await js(cap,`window.companion.mediaCommand({id:crypto.randomUUID(),session:${JSON.stringify(selectedTrack)},action:'play'})`);
 const afterPlayEffects=mediaEffects,beforePollReads=mediaReads;
 await wait(()=>js(cap,"!!document.querySelector('.music-play[aria-label=Pausar]')"));
 report.soundPollReadsOnly=mediaEffects===afterPlayEffects&&mediaReads>beforePollReads;
 await js(cap,"window.companion.mediaClose('workspace')");
 await wait(async()=>mediaReads>beforePollReads+1&&await js(cap,"window.companion.mediaCurrent().then(r=>r.ok&&r.value?.playing===true)"));
 report.soundRecoversAutomatically=mediaEffects===afterPlayEffects;
 await js(cap,"document.querySelector('.music-play').click()");await wait(()=>js(cap,"!!document.querySelector('.music-play[aria-label=Reproducir]')"));
 await shot(cap,'workspace-spotify');
 await js(cap,"window.companion.compact('spotify')");await wait(()=>js(cap,"!!document.querySelector('.mini-track strong')"));
 report.spotifyCompactKeepsSelection=await js(cap,"document.querySelector('.mini-track strong').textContent==='Música de prueba local'&&!!document.querySelector('.mini-play[aria-label=Reproducir]')")&&cap.getBounds().height===68;
 report.musicHeaderWithoutOverlap=await headerLayout();
 report.musicArtistVisible=await js(cap,"(()=>{const e=document.querySelector('.mini-track small'),r=e.getBoundingClientRect();return getComputedStyle(e).display!=='none'&&r.height>0;})()");
 await js(cap,"window.companion.mediaClose('workspace')");report.staleWorkspaceCannotCloseMini=await js(cap,"window.companion.mediaCurrent().then(r=>r.ok&&!!r.value)");
 await js(cap,"document.querySelector('.mini-play').click()");await wait(()=>js(cap,"!!document.querySelector('.mini-play[aria-label=Pausar]')"));report.spotifyCompactControls=true;
 await js(cap,"document.querySelector('.mini-transport [aria-label=Anterior]').click()");
 await wait(async()=>mediaActions.at(-1)==='previous'&&await js(cap,"!document.querySelector('.mini-transport [aria-label=Siguiente]').disabled"));
 await js(cap,"document.querySelector('.mini-transport [aria-label=Siguiente]').click()");
 await wait(async()=>mediaActions.at(-1)==='next'&&await js(cap,"!document.querySelector('.mini-play').disabled"));
 report.spotifyCompactSkipActions=true;

 await js(cap,"document.querySelector('.mini-track').click()");await wait(()=>js(cap,"!!document.querySelector('.music-player')"));
 await js(cap,"window.companion.mediaClose('compact')");report.compactReturnsToSamePlayer=await js(cap,"window.companion.mediaCurrent().then(r=>r.ok&&!!r.value&&r.value.playing)");
 await js(cap,"window.companion.compact('spotify')");await wait(()=>js(cap,"!!document.querySelector('.mini-track strong')"));
 await shot(cap,'capsule-music');
 if(workArea.width>=701){
  for(const width of [701,700,521,520]){
   const nativeHeight=capsuleRailHeight(width,true),barHeight=nativeHeight-2;
   await resizeForFixture(width,nativeHeight);
   const layout=await headerLayout();
   const geometry=await js(cap,`(()=>{
    const bar=document.querySelector('.capsule-single-row'),media=bar.querySelector('.capsule-media-block');
    return {bar:bar.getBoundingClientRect().height,media:media.clientWidth,scroll:media.scrollWidth,
     noticesFit:bar.querySelector('.capsule-notices').getBoundingClientRect().right<=bar.querySelector('.capsule-launcher').getBoundingClientRect().left+.5,
     play:media.querySelector('.mini-play').getBoundingClientRect().width};
   })()`);
   if(!layout||geometry.bar!==barHeight||geometry.scroll>geometry.media||!geometry.play||!geometry.noticesFit)
    throw Error('La cabecera multimedia no cabe a '+width+' DIP. '+JSON.stringify({layout,...geometry}));
  }
 }
 await resizeForFixture(320,capsuleRailHeight(320,true));report.narrowMusicHeaderWithoutOverlap=await headerLayout();await shot(cap,'capsule-music-narrow');
 report.capsuleNarrowTransportAndActionsFit=await js(cap,`(()=>{
  const rect=element=>element.getBoundingClientRect(),visible=element=>getComputedStyle(element).display!=='none';
  return ['.capsule-launcher','.capsule-actions','.capsule-media-block'].every(selector=>{
   const block=document.querySelector(selector),bounds=rect(block);
   const buttons=[...block.querySelectorAll('button')].filter(visible).map(rect);
   return buttons.every((b,i)=>b.width>=18&&b.height>=20&&b.left>=bounds.left&&b.right<=bounds.right+.5&&
    b.top>=bounds.top&&b.bottom<=bounds.bottom+.5&&buttons.slice(i+1).every(other=>
     b.right<=other.left+.5||other.right<=b.left+.5||b.bottom<=other.top+.5||other.bottom<=b.top+.5));
  })&&!!document.querySelector('.capsule-launcher [data-page=spotify][aria-label=Sonido]');
 })()`);
 report.capsuleSecondaryMenuFitsNarrow=(await capsuleMenu()).some(item=>item.label==='Ajustar posición');
 await resizeForFixture(compactBounds.width,compactBounds.height);
 await js(cap,"window.companion.presentation(true)");await wait(()=>js(cap,"!document.querySelector('.mini-track')"));report.compactPresentationBlocks=await js(cap,"window.companion.mediaCurrent().then(r=>!r.ok)");
 await js(cap,"window.companion.presentation(false)");
 await js(cap,"document.querySelector('.mini-dismiss').click()");
 await wait(()=>js(cap,"!document.querySelector('.mini-dismiss')"));
 report.compactClosedRevokes=await js(cap,"window.companion.mediaCurrent().then(r=>!r.ok)");

 await nav('home');report.mediaWrongPageRefused=await js(cap,"window.companion.mediaList().then(r=>!r.ok)");
 await js(cap,"window.companion.launcher(false)");await wait(async()=>cap.getBounds().height===68);
 await js(cap,"window.companion.launcher(true)");await wait(()=>js(cap,"!!document.querySelector('.workspace-content:not([hidden])')"));report.workspacePositionRemembered=same(placed,cap.getNormalBounds());
 report.noIndependentGeometry= !existsSync(join(profile,'companion-window-state.json'));
 await nav('home');
 report.gmailIntegrationRemoved=await js(cap,"Promise.all([window.companion.navigate('gmail'),window.companion.status()]).then(([nav,status])=>!nav.ok&&status.ok&&!status.value.workspace.gmail&&!document.querySelector('[data-page=gmail],[data-home-card=mail]')&&Object.keys(window.companion).every(key=>!key.startsWith('gmail')))");
 report.calendarIntegrationRemoved=await js(cap,"window.companion.navigate('calendar').then(result=>!result.ok&&!document.querySelector('[data-page=calendar],.calendar-workspace')&&Object.keys(window.companion).every(key=>!key.startsWith('calendar')))");
 const requestText='Dime qué reuniones tengo mañana.\nRevisa mis correos y destaca lo urgente & lo pendiente.';
 const beforeRequestOpen=openedTargets.length,beforeRequestCopy=copiedRequests.length;
 await js(cap,`(()=>{const textarea=document.querySelector('#codex-request');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(textarea,${JSON.stringify(requestText)});textarea.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await wait(()=>js(cap,"!document.querySelector('.codex-request-form button[type=submit]').disabled"));
 await js(cap,"const submitRequest=document.querySelector('.codex-request-form button[type=submit]');submitRequest.click();submitRequest.click()");
 await wait(()=>js(cap,"document.querySelector('.codex-request-form [role=status]')?.textContent.includes('En cola en el chat fijado')"));
 report.requestQueuesExactTextInFixedChat=copiedRequests.length===beforeRequestCopy&&queuedRequests.length===1&&queuedRequests[0].text===requestText&&queuedRequests[0].thread==='native-test'&&openedTargets.length===beforeRequestOpen;
 report.requestStaysOutOfStatus=await js(cap,`window.companion.status().then(r=>r.ok&&!JSON.stringify(r.value).includes(${JSON.stringify(requestText.split('\n')[0])}))`);
 const quickQueueStart=queuedRequests.length;
 await js(cap,"(()=>{const t=document.querySelector('#codex-request');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Borrador propio');t.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await js(cap,"(()=>{const b=document.querySelector('[data-quick-request=mail]');b.click();b.click();})()");
 await wait(()=>js(cap,"document.querySelector('.codex-request-form [role=status]')?.textContent.includes('En cola')&&!document.querySelector('[data-quick-request=calendar]').disabled"));
 await js(cap,"document.querySelector('[data-quick-request=calendar]').click()");
 await wait(()=>js(cap,"document.querySelector('.codex-request-form [role=status]')?.textContent.includes('En cola')&&!document.querySelector('[data-quick-request=calendar]').disabled"));
 const quick=queuedRequests.slice(quickQueueStart);
 report.quickRequestsQueueReadOnlyInFixedChat=quick.length===2&&quick.every(r=>r.thread==='native-test'&&r.text.includes('solo consultas de lectura'))&&quick[0].text.includes('conector de Gmail de Codex')&&quick[1].text.includes('conector de Google Calendar de Codex')&&openedTargets.length===beforeRequestOpen&&copiedRequests.length===beforeRequestCopy;
 report.quickRequestsPreserveDraft=await js(cap,"document.querySelector('#codex-request').value==='Borrador propio'");
 const composerHeight=await js(cap,`(()=>{
  const field=document.querySelector('#codex-request'),before=field.clientHeight;
  const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
  set.call(field,Array.from({length:24},(_,i)=>'Línea '+i).join('\\n'));
  field.dispatchEvent(new Event('input',{bubbles:true}));
  return before;
 })()`);
 await wait(()=>js(cap,`(()=>{const field=document.querySelector('#codex-request');
  return field.clientHeight>${composerHeight}&&field.getBoundingClientRect().height<=196&&field.scrollHeight>field.clientHeight;
 })()`));
 report.homeComposerExpandsWithinLimit=true;
 const fillNoteField=(id:string,value:string)=>js(cap,`(()=>{
  const input=document.getElementById(${JSON.stringify(id)});
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),'value').set.call(input,${JSON.stringify(value)});
  input.dispatchEvent(new Event('input',{bubbles:true}));
 })()`);
 const legacyFolderId=randomUUID(),aiFolderId=randomUUID();
 const legacyNotebook=JSON.stringify({version:1,
  folders:[{id:legacyFolderId,name:'AI Engineering'},{id:aiFolderId,name:'AI ENGINER'}],
  notes:[
   {id:randomUUID(),folderId:legacyFolderId,title:'Apunte anterior',description:'Contenido conservado',code:'',updatedAt:1},
   {id:randomUUID(),folderId:aiFolderId,title:'Nota de AI ENGINER',description:'Contenido de IA',code:'',updatedAt:2},
  ]});
 writeFileSync(join(profile,'companion-notes.json'),legacyNotebook);
 report.notesReadDeniedOutsideNotes=await js(cap,"window.companion.notesRead().then(r=>!r.ok)");
 report.homeRecentLegacyMetadataOnly=await js(cap,`window.companion.notesRecent().then(r=>r.ok&&
  r.value.map(n=>n.title).join('|')==='Nota de AI ENGINER|Apunte anterior'&&
  r.value.every(n=>Object.keys(n).sort().join(',')==='favorite,folder,id,title,updatedAt')
 )`)&&!existsSync(join(profile,'knowledge-hub.sqlite'));
 await js(cap,"document.querySelector('.capsule-launcher [data-page=notes]').click()");
 await wait(()=>js(cap,"document.querySelector('.hub-cards')?.children.length===3"));
 report.hubSimplifiedNavigation=await js(cap,`[...document.querySelectorAll('.hub-sidebar nav button')].map(b=>b.textContent.trim()).join('|')===
  'Inicio|Todos los apuntes|Biblioteca de prompts|Conocimiento de IA|Configuración|Respaldo y exportación'&&
  [...document.querySelectorAll('.hub-create button')].map(b=>b.textContent.trim()).join('|')==='Apunte|Prompt|Carpeta'`);
 report.hubLegacyMigration=await js(cap,"window.companion.notesRead().then(r=>r.ok&&r.value.data.entries.some(e=>e.title==='Apunte anterior'&&e.description==='Contenido conservado'))")&&
  readFileSync(join(profile,'companion-notes.json'),'utf8')===legacyNotebook;
 report.hubLightTheme=await js(cap,`(()=>{
  const hub=document.querySelector('.knowledge-hub'),card=hub.querySelector('.hub-card');
  const glass=getComputedStyle(hub);
  return getComputedStyle(hub.querySelector('#notes-title')).color==='rgb(32, 35, 52)'&&
   glass.backgroundColor.startsWith('rgba(244, 246, 253, ')&&
   Math.abs(parseFloat(glass.backgroundColor.split(', ').at(-1))-.89)<.01&&glass.backdropFilter.includes('blur(7px)')&&
   getComputedStyle(card).backgroundColor.startsWith('rgba(244, 246, 253, ')&&
   getComputedStyle(hub.querySelector('.hub-brand span')).backgroundColor==='rgb(178, 153, 255)';
 })()`);
 await shot(cap,'workspace-knowledge-hub');
 await js(cap,"[...document.querySelectorAll('.hub-sidebar nav button')].find(b=>b.textContent==='Conocimiento de IA').click()");
 await wait(()=>js(cap,"document.querySelector('#notes-title')?.textContent==='AI ENGINER'"));
 report.hubAiEngineerOnly=await js(cap,"[...document.querySelectorAll('.notes-list-item strong')].map(e=>e.textContent).join('|')==='Nota de AI ENGINER'");
 await js(cap,"[...document.querySelectorAll('.hub-sidebar nav button')].find(b=>b.textContent==='Todos los apuntes').click()");
 await wait(()=>js(cap,"document.querySelector('#notes-title')?.textContent==='Todos los apuntes'"));
 report.hubNotesListUsesAvailableWidth=await js(cap,`(()=>{
  const library=document.querySelector('.hub-library'), list=library.querySelector('.hub-items');
  return !library.querySelector('.hub-reader')&&Math.abs(library.clientWidth-list.getBoundingClientRect().width)<1&&
   getComputedStyle(list.querySelector('.notes-list')).gridTemplateColumns.split(' ').length===2;
 })()`);
 await shot(cap,'workspace-notes-list');
 await wait(()=>js(cap,"!!document.querySelector('.notes-list-item:not(:disabled)')"));
 await js(cap,"document.querySelector('.notes-list-item').click()");
 await wait(()=>js(cap,"!!document.querySelector('.notes-editor')"));
 const animationFrame=await js(cap,`(()=>{
  const reader=document.querySelector('.hub-reader'),animation=reader.getAnimations().find(a=>a.effect.target===reader);
  if(!animation)return false;
  animation.pause();animation.currentTime=75;
  return true;
 })()`);
 if(animationFrame){
  await shot(cap,'motion-note-entering');
  await js(cap,"document.querySelector('.hub-reader').getAnimations().forEach(a=>a.play())");
 }
 await pause(motion.note+30);
 report.hubNotesReaderSharesWidth=await js(cap,`(()=>{
  const items=document.querySelector('.hub-items').getBoundingClientRect(), reader=document.querySelector('.hub-reader').getBoundingClientRect();
  const heading=document.querySelector('.notes-editor-heading'), title=heading.firstElementChild.getBoundingClientRect();
  const actions=heading.lastElementChild.getBoundingClientRect();
  const titleFits=reader.width<=430?Math.abs(title.width-heading.clientWidth)<1:title.right<=actions.left||title.bottom<=actions.top;
  return items.width>=205&&reader.width>items.width&&reader.left-items.right>=15&&titleFits;
 })()`);
 report.hubNotesUsesAvailableHeight=await js(cap,`(()=>{
  const shell=document.querySelector('.hub-shell'), main=document.querySelector('.hub-main');
  const bounds=shell.getBoundingClientRect(), end=main.getBoundingClientRect().bottom-parseFloat(getComputedStyle(main).paddingBottom);
  return Math.abs(document.querySelector('.hub-sidebar').getBoundingClientRect().bottom-bounds.bottom)<1&&
   [...document.querySelectorAll('.hub-items,.notes-editor')].every(pane=>Math.abs(pane.getBoundingClientRect().bottom-end)<1)&&
   main.scrollHeight<=main.clientHeight+1;
 })()`);
 const notesBounds=cap.getBounds();
 await resizeForFixture(380,notesBounds.height);
 await wait(()=>js(cap,"getComputedStyle(document.querySelector('.hub-items')).display==='none'"));
 await js(cap,"document.querySelector('.hub-reader-back').click()");
 await wait(()=>js(cap,"getComputedStyle(document.querySelector('.hub-reader')).display==='none'"));
 report.hubNotesNarrowReturnsToList=await js(cap,"document.querySelector('.notes-list-item').getBoundingClientRect().width>250");
 await resizeForFixture(notesBounds.width,notesBounds.height);
 await js(cap,"document.querySelector('.hub-brand').click()");
 await wait(()=>js(cap,"!!document.querySelector('.hub-cards')"));
 await js(cap,"document.querySelector('.hub-create summary').click()");
 await js(cap,"document.querySelector('.notes-new-folder').click()");
 await wait(()=>js(cap,"!!document.querySelector('#notes-folder-name')"));
 await fillNoteField('notes-folder-name','Laboratorio Power Platform');
 await js(cap,"document.querySelector('.notes-folder-form button[type=submit]').click()");
 await wait(()=>js(cap,"document.querySelector('#notes-title')?.textContent==='Laboratorio Power Platform'"));
 await js(cap,"document.querySelector('.hub-items button').click()");
 await wait(()=>js(cap,"!!document.querySelector('.notes-editor')"));
 report.motionNewNoteFocus=await js(cap,"document.activeElement?.id==='notes-title-field'");
 await fillNoteField('notes-title-field','Filtros con Power Fx');
 const beforeNoteNavigation=queuedRequests.length;
 await nav('home');await nav('notes');
 report.motionKeepsNoteDraft=await js(cap,"document.querySelector('#notes-title-field').value==='Filtros con Power Fx'&&document.querySelectorAll('.workspace-content:not([hidden])').length===1")&&queuedRequests.length===beforeNoteNavigation;
 report.notesRequireTitleAndDescription=await js(cap,"document.querySelector('.notes-editor button[type=submit]').disabled");
 await fillNoteField('notes-description','Definición:\n• Filtrar las cuentas activas antes de mostrarlas.');
 const noteCode='Filter(Cuentas,\n  Activa = true\n)';
 await fillNoteField('notes-code',noteCode);
 await js(cap,"document.querySelector('.notes-format').click()");
 await wait(()=>js(cap,"document.querySelector('.notes-markdown h2')?.textContent==='Definición'&&!!document.querySelector('.notes-markdown li')"));
 report.notesMarkdownPreview=await js(cap,"document.querySelector('.notes-code-preview').textContent.includes('Filter(Cuentas,')");
 await js(cap,"document.querySelector('.notes-editor button[type=submit]').click()");
 await wait(()=>js(cap,"document.querySelector('.notes-list-item strong')?.textContent==='Filtros con Power Fx'"));
 await js(cap,"document.querySelector('.notes-code-heading button').click()");
 await wait(async()=>copiedText.at(-1)===noteCode);
 const noteStore=await js(cap,"window.companion.notesRead().then(result=>result.value.data)");
 const createdNote=noteStore.entries.find((entry:{title:string})=>entry.title==='Filtros con Power Fx');
 report.notesPersistFolderAndCode=createdNote?.folderId===noteStore.folders.find((folder:{name:string})=>folder.name==='Laboratorio Power Platform')?.id&&createdNote?.code===noteCode;
 await shot(cap,'workspace-notes');
 await js(cap,"[...document.querySelectorAll('.notes-editor-heading button')].find(b=>b.textContent.includes('Editar')).click()");
 await wait(()=>js(cap,"!!document.querySelector('#notes-title-field')"));
 await js(cap,`window.companion.notesRead().then(r=>{
  const {id,updatedAt,createdAt,copiedAt,...fields}=r.value.data.entries.find(e=>e.title==='Filtros con Power Fx');
  return window.companion.notesChange({type:'save',id,expected:updatedAt,fields:{...fields,description:fields.description+'\\n\\nCambio paralelo'}})
 })`);
 await fillNoteField('notes-title-field','Edición conservada tras conflicto');
 await js(cap,"document.querySelector('.hub-save button').click()");
 await wait(()=>js(cap,"document.querySelector('.hub-feedback[role=alert]')?.textContent.includes('cambió')"));
 report.motionSaveFailureKeepsDraft=await js(cap,"document.querySelector('#notes-title-field').value==='Edición conservada tras conflicto'&&!document.querySelector('.hub-save [role=status]').textContent.includes('Guardado')");
 await js(cap,"document.querySelector('.hub-brand').click()");
 await wait(()=>js(cap,"!!document.querySelector('.hub-confirm[open]')"));
 await js(cap,"document.querySelector('.hub-confirm .hub-primary').click()");
 await wait(()=>js(cap,"!!document.querySelector('.hub-cards')"));
 await nav('home');await nav('notes');
 await js(cap,"document.querySelector('.hub-brand').click()");
 await wait(()=>js(cap,"document.querySelector('.hub-activity button')?.textContent==='Filtros con Power Fx'"));
 await js(cap,"document.querySelector('.hub-activity button').click()");
 await wait(()=>js(cap,`document.querySelector('.notes-code-preview')?.textContent===${JSON.stringify(noteCode)}`));
 report.notesReopenAfterNavigation=true;
 await js(cap,"document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))");
 await wait(()=>js(cap,"document.querySelector('.hub-search')?.open"));
 await js(cap,"document.querySelector('.hub-search input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))");
 await wait(()=>js(cap,"!document.querySelector('.hub-search')&&!!document.querySelector('.notes-editor')"));
 report.hubSearchKeyboard=true;
 await js(cap,"[...document.querySelectorAll('.hub-sidebar nav button')].find(button=>button.textContent==='Biblioteca de prompts').click()");
 await wait(()=>js(cap,"!!document.querySelector('[aria-label=\"Crear prompt\"]')"));
 await js(cap,"document.querySelector('[aria-label=\"Crear prompt\"]').click()");
 await wait(()=>js(cap,"!!document.querySelector('#notes-title-field')"));
 await fillNoteField('notes-title-field','Resumir un proyecto');
 report.hubPromptRequiredFieldClear=await js(cap,`(()=>{
  const body=document.querySelector('#notes-code'),optional=document.querySelector('.hub-edit details'),save=document.querySelector('.hub-save button');
  return body.required&&body.labels[0].textContent==='Contenido del prompt'&&!optional.open&&
   Boolean(body.compareDocumentPosition(optional)&Node.DOCUMENT_POSITION_FOLLOWING)&&
   save.disabled&&document.querySelector('.hub-save [role=status]').textContent.includes('contenido del prompt');
 })()`);
 await fillNoteField('notes-code','Resume el proyecto {{PROJECT_NAME}}');
 await js(cap,"document.querySelector('.hub-save button').click()");
 await wait(()=>js(cap,"document.querySelector('.notes-list-item strong')?.textContent==='Resumir un proyecto'&&!!document.querySelector('.hub-document')"));
 report.hubPromptSavesWithTitleAndBody=await js(cap,`window.companion.notesRead().then(result=>result.ok&&
  result.value.data.entries.some(entry=>entry.kind==='prompt'&&entry.title==='Resumir un proyecto'&&entry.code==='Resume el proyecto {{PROJECT_NAME}}'&&entry.description===''))`);
 await js(cap,"[...document.querySelectorAll('.notes-editor-heading button')].find(button=>button.textContent.includes('Editar')).click()");
 await wait(()=>js(cap,"!!document.querySelector('#notes-code')"));
 report.hubPromptEditorDimensions=await js(cap,`(()=>{
  const editor=document.querySelector('.hub-edit'),area=editor.querySelector('#notes-code');
  const otherFields=[...editor.children].filter(child=>child!==area&&child.getBoundingClientRect().height>0);
  const usedHeight=otherFields.reduce((sum,child)=>sum+child.getBoundingClientRect().height,0)+
   otherFields.length*parseFloat(getComputedStyle(editor).rowGap);
  return {textarea:area.getBoundingClientRect().height, available:editor.clientHeight-usedHeight,
   saveBottom:document.querySelector('.hub-save').getBoundingClientRect().bottom,
   readerBottom:document.querySelector('.hub-reader').getBoundingClientRect().bottom};
 })()`);
 const {textarea,available,saveBottom,readerBottom}=report.hubPromptEditorDimensions;
 report.hubPromptEditorUsesAvailableHeight=textarea>0&&Math.abs(textarea-available)<=2&&saveBottom<=readerBottom+1;
 await shot(cap,'workspace-prompt-editor');
 const longPrompt=Array.from({length:48},(_,i)=>'Paso '+(i+1)+': Revisa el material del proyecto y registra las decisiones y las tareas que deben completarse antes de la entrega.').join('\n\n');
 await fillNoteField('notes-code',longPrompt);
 await wait(()=>js(cap,"document.querySelector('.hub-save [role=status]')?.textContent==='Guardado'"));
 await js(cap,"[...document.querySelectorAll('.notes-editor-heading button')].find(button=>button.textContent.includes('Vista previa')).click()");
 await wait(()=>js(cap,"!!document.querySelector('.hub-prompt-markdown p')"));
 report.hubLongPromptUsesReaderScroll=await js(cap,`(()=>{
  const body=document.querySelector('.hub-document'), code=body.querySelector('.hub-prompt-markdown');
  const heading=document.querySelector('.notes-editor > .notes-code-heading');
  const headingTop=heading.getBoundingClientRect().top;
  body.scrollTop=body.scrollHeight;
  const ok=code.scrollWidth<=code.clientWidth+1&&code.scrollHeight<=code.clientHeight+1&&body.scrollTop>0&&
   Math.abs(body.scrollHeight-body.scrollTop-body.clientHeight)<1&&
   heading.getBoundingClientRect().bottom<=body.getBoundingClientRect().top&&
   heading.getBoundingClientRect().top===headingTop;
  body.scrollTop=0;
  return ok;
 })()`);
 await js(cap,"[...document.querySelectorAll('[aria-label=\"Vista del prompt\"] button')].find(button=>button.textContent==='Texto').click()");
 await wait(()=>js(cap,`document.querySelector('.notes-code-preview')?.textContent===${JSON.stringify(longPrompt)}`));
 report.hubPromptCanReadSource=await js(cap,"!document.querySelector('.hub-prompt-markdown')&&document.querySelector('[aria-label=\"Vista del prompt\"] [aria-pressed=true]').textContent==='Texto'");
 await shot(cap,'workspace-long-prompt');
 await js(cap,"[...document.querySelectorAll('.notes-editor-heading button')].find(button=>button.textContent.includes('Editar')).click()");
 await wait(()=>js(cap,"!!document.querySelector('#notes-code')"));
 const promptSections='Objetivo:\n• Resume el proyecto {{PROJECT_NAME}}';
 const promptDetails='\n\n| Campo | Valor |\n| --- | --- |\n| Puntos | 3 |\n\n```json\n{"list": []}\n```';
 const organizedPrompt='## Objetivo\n\n- Resume el proyecto {{PROJECT_NAME}}'+promptDetails;
 await fillNoteField('notes-code',promptSections+promptDetails);
 await wait(()=>js(cap,"document.querySelector('.hub-save [role=status]')?.textContent==='Guardado'"));
 await js(cap,"document.querySelector('.notes-format').click()");
 await wait(()=>js(cap,`document.querySelector('.hub-prompt-markdown h2')?.textContent==='Objetivo'&&
  !!document.querySelector('.hub-prompt-markdown li')&&!!document.querySelector('.hub-prompt-markdown table')&&
  !!document.querySelector('.hub-prompt-markdown pre code')`));
 await js(cap,"document.querySelector('.notes-code-heading .hub-undo').click()");
 await wait(()=>js(cap,`document.querySelector('#notes-code')?.value===${JSON.stringify(promptSections+promptDetails)}`));
 await js(cap,"document.querySelector('.notes-format').click()");
 await wait(()=>js(cap,"!!document.querySelector('.hub-prompt-markdown h2')&&!document.querySelector('.hub-save button').disabled"));
 await js(cap,"document.querySelector('.hub-save button').click()");
 await wait(()=>js(cap,"!document.querySelector('.hub-save')&&!!document.querySelector('.hub-prompt-markdown h2')"));
 report.hubPromptMarkdownFormatsAndSaves=await js(cap,`window.companion.notesRead().then(result=>result.ok&&
  result.value.data.entries.some(entry=>entry.kind==='prompt'&&entry.code===${JSON.stringify(organizedPrompt)}))`);
 await shot(cap,'workspace-prompt-markdown');
 await wait(()=>js(cap,"!!document.querySelector('.hub-document .hub-fields input')"));
 await js(cap,"(()=>{const input=document.querySelector('.hub-document .hub-fields input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'ZEN');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await js(cap,"document.querySelector('.notes-code-heading button[aria-label=Copiar]').click()");
 await wait(async()=>copiedText.at(-1)===organizedPrompt.replace('{{PROJECT_NAME}}','ZEN'));
 report.hubAutosavePromptAndVariables=await js(cap,"document.querySelector('#notes-title')?.textContent==='Biblioteca de prompts'");
 const olderProject={type:'save',fields:{...newFields('project'),title:'Proyecto de prueba',related:[createdNote.id]}};
 await js(cap,`window.companion.notesChange(${JSON.stringify(olderProject)})`);
 await nav('home');await nav('notes');
 await js(cap,"document.querySelector('.hub-brand').click()");
 await wait(()=>js(cap,"!!document.querySelector('.hub-cards')"));
 await js(cap,"document.querySelector('.hub-search-launch').click()");
 await wait(()=>js(cap,"document.querySelector('.hub-search')?.open"));
 await js(cap,"[...document.querySelectorAll('.hub-results button')].find(b=>b.querySelector('strong')?.textContent==='Proyecto de prueba').click()");
 await wait(()=>js(cap,"document.querySelector('.hub-related button')?.textContent==='Filtros con Power Fx'"));
 report.hubProjectRelations=true;
 const hubPath=join(profile,'hub-export-fixture.json'),hubMarkdown=join(profile,'hub-export-fixture.md'),hubImage=join(profile,'hub-image.png');
 writeFileSync(hubImage,nativeImage.createFromBitmap(Buffer.from([60,100,160,255]),{width:1,height:1}).toPNG());
 const originalSave=dialog.showSaveDialog,originalOpen=dialog.showOpenDialog,originalHubMessage=dialog.showMessageBox;
 try {
  dialog.showSaveDialog=(async (_window:unknown,options:{defaultPath?:string})=>({
   canceled:false,filePath:options.defaultPath?.endsWith('.md')?hubMarkdown:hubPath,
  })) as typeof dialog.showSaveDialog;
  dialog.showOpenDialog=(async (_window:unknown,options:{title?:string})=>({
   canceled:false,filePaths:[options.title==='Adjuntar imagen'?hubImage:hubPath],
  })) as typeof dialog.showOpenDialog;
  dialog.showMessageBox=(async()=>({response:1,checkboxChecked:false})) as typeof dialog.showMessageBox;
  report.hubNativeFiles=await js(cap,`(async()=>{
   const bridge=window.companion;
   const image=await bridge.notesFile({type:'image'});
   const library=await bridge.notesRead();
   const note=library.value.data.entries.find(entry=>entry.title==='Filtros con Power Fx');
   const {id,createdAt,updatedAt,copiedAt,...fields}=note;
   const attached=await bridge.notesChange({type:'save',id,expected:updatedAt,fields:{...fields,images:[image.value.image]}});
   const backup=await bridge.notesFile({type:'export'});
   const markdown=await bridge.notesFile({type:'markdown',id});
   const removed=await bridge.notesChange({type:'remove',id});
   const restored=await bridge.notesFile({type:'import'});
   return image.ok&&attached.ok&&backup.ok&&markdown.ok&&removed.ok&&restored.ok&&
    restored.value.data.entries.find(entry=>entry.id===id)?.images[0]?.name==='hub-image.png';
  })()`)&&readFileSync(hubMarkdown,'utf8').includes('## Definición')&&readFileSync(hubPath,'utf8').includes('data:image/png;base64,');
  const lateExport = join(profile, 'hub-export-after-navigation.json');
  dialog.showSaveDialog=(async()=>{
   await nav('home');
   return {canceled:false,filePath:lateExport};
  }) as typeof dialog.showSaveDialog;
  report.hubExportRevokedAfterDialog=await js(cap,"window.companion.notesFile({type:'export'}).then(r=>!r.ok)")&&!existsSync(lateExport);
  await nav('notes');
 } finally {
  dialog.showSaveDialog=originalSave;
  dialog.showOpenDialog=originalOpen;
  dialog.showMessageBox=originalHubMessage;
 }
 await js(cap,"[...document.querySelectorAll('.hub-sidebar nav button')].find(button=>button.textContent==='Configuración').click()");
 await wait(()=>js(cap,"[...document.querySelectorAll('.hub-panel button')].some(button=>button.textContent==='Oscuro')"));
 await js(cap,"[...document.querySelectorAll('.hub-panel button')].find(button=>button.textContent==='Oscuro').click()");
 await wait(()=>js(cap,"!!document.querySelector('.knowledge-hub[data-hub-theme=dark]')"));
 report.hubDarkTheme=await js(cap,`getComputedStyle(document.querySelector('#notes-title')).color==='rgb(248, 249, 255)'&&
  getComputedStyle(document.querySelector('.knowledge-hub')).backgroundColor.startsWith('rgba(18, 20, 31, ')&&
  window.companion.notesRead().then(r=>r.ok&&r.value.data.theme==='dark')`);
 await js(cap,"window.companion.presentation(true)");
 await wait(()=>js(cap,"!document.querySelector('.notes-editor')"));
 report.notesHiddenInPresentation=await js(cap,"window.companion.notesRead().then(r=>!r.ok&&!document.body.textContent.includes('Filtros con Power Fx'))");
 await js(cap,"window.companion.presentation(false)");await nav('home');
 await js(cap,"window.companion.presentation(false)");await preference('connection');report.settingsInWorkspace=BrowserWindow.getAllWindows().length===1&&await js(cap,"!!document.querySelector('.connection-diagnosis')");
 await integration.install();report.hookInstalled=hub.installed;
 const shellProbe=spawn(process.env.ComSpec??'cmd.exe',['/c',integration.command],{stdio:'pipe',windowsHide:true});let probeOutput='';shellProbe.stdout.on('data',b=>probeOutput+=b);shellProbe.stderr.resume();const probeDone=new Promise<number|null>((resolve,reject)=>{shellProbe.on('error',reject);shellProbe.on('close',resolve);});shellProbe.stdin.end('{"hook_event_name":"DiagnosticProbe","session_id":"diagnostic"}');report.shellCommandVerified=await probeDone===0&&probeOutput.trim()==='{}';
 const launch=(event:string,extra:any={})=>{const p=spawn(integration.executable,['--zen-companion'],{stdio:'pipe',windowsHide:true});let output='';p.stdout.on('data',b=>output+=b);p.stderr.resume();const done=new Promise<string>((resolve,reject)=>{p.on('error',reject);p.on('close',c=>c===0?resolve(output.trim()):reject(Error('Hook fixture failed')));});p.stdin.end(JSON.stringify({hook_event_name:event,session_id:'native-test',turn_id:'turn-1',cwd:'C:\\fixture',...extra}));return{child:p,done};};
 await launch('PermissionRequest',{session_id:'foreign',tool_name:'Bash',tool_input:{command:'PRIVATE FOREIGN'}}).done;report.foreignEventsIgnored=hub.status().sessions.length===0&&hub.status().approvals.length===0;
 await js(cap,"window.companion.launcher(false)");const beforeActivity=cap.getBounds(),beforeActivityCalls={...nativeCalls};await launch('UserPromptSubmit',{prompt:'DO NOT FORWARD'}).done;await wait(()=>js(cap,"document.querySelector('.zen-status-mark').dataset.phase==='thinking'"));report.promptNotForwarded=!JSON.stringify(hub.status()).includes('DO NOT FORWARD');report.activityKeepsGeometry=same(beforeActivity,cap.getBounds());report.signalsDoNotMutateNativeWindow=JSON.stringify(nativeCalls)===JSON.stringify(beforeActivityCalls);
 await nav('home');await wait(()=>js(cap,"document.querySelector('.home-work-state')?.textContent==='Pensando'"));report.homeThinkingStateObserved=true;const homeWorkBounds=cap.getBounds();
 await launch('PreToolUse',{tool_name:'Bash',tool_input:{command:'npm test'}}).done;await wait(()=>js(cap,"!!document.querySelector('.zen-status-mark[data-phase=working]')"));
 await wait(()=>js(cap,"document.querySelector('.home-work-state')?.textContent==='Usando herramientas'"));report.homeWorkingStateObserved=same(homeWorkBounds,cap.getBounds());
 report.emblemKeepsOrientation=await js(cap,"(()=>{const mark=document.querySelector('.zen-status-mark'),emblem=mark.querySelector('.zen-emblem');return getComputedStyle(mark).transform==='none'&&getComputedStyle(emblem).transform==='none'&&emblem.src.endsWith('/icons/zen-256.png');})()");
 await nav('codex');report.codexActivityInWorkspace=await js(cap,"document.body.textContent.includes('npm test')")&&BrowserWindow.getAllWindows().length===1;
 report.codexTwoInternalTabs=await js(cap,"document.querySelectorAll('.codex-subnav [role=tab]').length===2&&document.querySelector('[data-codex-tab=activity]').getAttribute('aria-selected')==='true'");
 report.codexActivityExcludesSummary=await js(cap,"!!document.querySelector('.event-list')&&!document.querySelector('.codex-last-response,.codex-turn-summary,.codex-context')");
 await js(cap,"[...document.querySelectorAll('[aria-label=\"Tipo de actividad\"] button')].find(b=>b.textContent==='Comandos').click()");await wait(()=>js(cap,"document.querySelectorAll('.event-list details').length>0&&[...document.querySelectorAll('.event-list summary')].every(e=>e.textContent.includes('Comando'))"));report.polishActivityKnownCommand=true;await js(cap,"[...document.querySelectorAll('[aria-label=\"Tipo de actividad\"] button')].find(b=>b.textContent==='Todo').click()");
 const beforeCodexTabBounds=nativeCalls.bounds,beforeCodexTabShape=nativeCalls.shape;
 await js(cap,"document.querySelector('[data-codex-tab=activity]').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}))");await wait(()=>js(cap,"document.querySelector('[data-codex-tab=summary]').getAttribute('aria-selected')==='true'"));
 report.codexSummaryEmptyState=await js(cap,"!!document.querySelector('.codex-summary-empty')&&!document.querySelector('.event-list')");
 await js(cap,"document.querySelector('[data-codex-tab=summary]').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}))");await wait(()=>js(cap,"document.querySelector('[data-codex-tab=activity]').getAttribute('aria-selected')==='true'"));
 report.codexTabsKeyboardNavigation=true;report.codexTabsKeepNativeGeometry=nativeCalls.bounds===beforeCodexTabBounds&&nativeCalls.shape===beforeCodexTabShape;

 await js(cap,"window.companion.openCodex()");report.returnExactChat=openedTargets.at(-1)==='codex://threads/native-test';
 await js(cap,"window.companion.compact('codex')");await wait(()=>js(cap,"!!document.querySelector('.companion-state[data-compact=true]')"));report.codexCompactRealAction=await js(cap,"document.querySelector('.companion-state small').textContent.includes('npm test')");
 observationFixture.playing=true;observationFixture.source='Spotify';await wait(()=>js(cap,"!!document.querySelector('.capsule-now-playing')"));report.codexWorkingAndMusicVisibleTogether=await js(cap,"document.querySelector('.companion-capsule').dataset.state==='working'&&!!document.querySelector('.companion-state strong')&&!!document.querySelector('.capsule-now-playing strong')")&&await headerLayout();await shot(cap,'capsule-codex-and-media');await js(cap,"window.companion.launcher(false)");await wait(async()=>cap.getBounds().height===68);await shot(cap,'capsule-single-row-live');await nav('codex');
 const permission=launch('PermissionRequest',{tool_name:'apply_patch',tool_input:{command:'*** Add File: demo.txt\n+PRIVATE REVIEW'}});await wait(async()=>hub.status().approvals.length===1);const id=hub.status().approvals[0].id;
 report.hiddenPermissionPreview=await js(cap,"window.companion.status().then(r=>!JSON.stringify(r.value).includes('PRIVATE REVIEW'))");
 report.capsuleCannotApprove=await js(cap,`window.companion.decide(${JSON.stringify(id)},'allow').then(r=>!r.ok)`);
 report.codexPermissionAndMusicVisibleTogether=await js(cap,"document.querySelector('.companion-capsule').dataset.state==='approval'&&!!document.querySelector('.companion-state strong')&&!!document.querySelector('.capsule-now-playing strong')")&&await headerLayout();
 await nav('home');await wait(()=>js(cap,"document.querySelector('.home-work-state')?.textContent==='Necesita tu permiso'"));report.homePermissionStateObserved=await js(cap,"!document.body.textContent.includes('PRIVATE REVIEW')");
 await js(cap,"document.querySelector('.companion-state').click()");await wait(()=>js(cap,"!!document.querySelector('.approval-card pre')"));
 report.capsuleStateOpensPermission=await js(cap,"document.querySelector('.workspace-content:not([hidden])').dataset.page==='permissions'");
 await nav('home');await js(cap,"document.querySelector('[data-home-card=work]').click()");await wait(()=>js(cap,"!!document.querySelector('.approval-card pre')"));report.permissionReview=await js(cap,"document.querySelector('.approval-card pre').textContent.includes('PRIVATE REVIEW')");
 cap.minimize();
 await wait(async()=>cap.isMinimized());
 report.minimizedPermissionPreview=await js(cap,"window.companion.status().then(r=>r.ok&&!JSON.stringify(r.value).includes('PRIVATE REVIEW'))");
 report.minimizedCannotApprove=await js(cap,`window.companion.decide(${JSON.stringify(id)},'allow').then(r=>!r.ok)`);
 cap.restore();
 await wait(()=>js(cap,"document.querySelector('.approval-card pre')?.textContent.includes('PRIVATE REVIEW')"));
 await shot(cap,'workspace-permission');
 await js(cap,"window.companion.presentation(true)");await wait(()=>js(cap,"!document.querySelector('.approval-card pre')"));report.presentationCannotApprove=await js(cap,`window.companion.decide(${JSON.stringify(id)},'allow').then(r=>!r.ok)`);
 await js(cap,"window.companion.presentation(false)");await wait(()=>js(cap,"!!document.querySelector('.approval-card pre')"));
 await js(cap,"[...document.querySelectorAll('button')].find(b=>b.textContent==='Rechazar').click()");report.exactDenial=JSON.parse(await permission.done).hookSpecificOutput?.decision?.behavior==='deny';
 report.singleUse=await js(cap,`window.companion.decide(${JSON.stringify(id)},'allow').then(r=>!r.ok)`);
 const finalReply='**Respuesta final de prueba en España**\n\n| Fecha | Hora | Evento |\n|---|---|---|\n| Miércoles 25 | 09:00–10:00 | Incorporación |\n\n- Entrevista en Dublín.\n\n<script>window.untrustedReplyExecuted=true</script>\n\n![Imagen remota](https://example.test/probe.png)';
 await launch('Stop',{last_assistant_message:finalReply}).done;await wait(()=>js(cap,"document.querySelector('.zen-status-mark').dataset.phase==='finished'"));report.lastReplyHiddenOutsideCodex=await js(cap,"window.companion.status().then(r=>!JSON.stringify(r.value).includes('Respuesta final de prueba'))");
 await nav('codex');report.codexActivityRedactsResponseBeforeIpc=await js(cap,"window.companion.status().then(r=>!JSON.stringify(r.value).includes('Respuesta final de prueba')&&!document.querySelector('.codex-last-response'))");
 await js(cap,"document.querySelector('[data-codex-tab=summary]').click()");await wait(()=>js(cap,"document.querySelector('.codex-last-response-text strong')?.textContent==='Respuesta final de prueba en España'"));
 report.codexSummaryExcludesCommands=await js(cap,"!!document.querySelector('.codex-turn-summary')&&!document.querySelector('.event-list,.session-card,.approval-card')");
 report.contextOnlyInSummary=await js(cap,"!!document.querySelector('.codex-context')");
 report.latestCodexReplyVisibleAndInert=await js(cap,"(()=>{const body=document.querySelector('.codex-last-response-text');return !body.querySelector('script,img,iframe')&&window.untrustedReplyExecuted===undefined;})()");
 report.latestCodexReplyMarkdownAndUtf8=await js(cap,"(()=>{const body=document.querySelector('.codex-last-response-text');return body.querySelector('strong')?.textContent==='Respuesta final de prueba en España'&&body.querySelector('th')?.textContent==='Fecha'&&body.querySelector('td:nth-child(1)')?.textContent==='Miércoles 25'&&body.querySelector('td:nth-child(2)')?.textContent==='09:00–10:00'&&body.querySelector('li')?.textContent==='Entrevista en Dublín.';})()");
 await js(cap,"document.querySelector('.codex-last-response button').click()");report.latestReplyKeepsOpenCodex=openedTargets.at(-1)==='codex://threads/native-test';
 await js(cap,"window.companion.presentation(true)");await wait(()=>js(cap,"!document.querySelector('.codex-last-response')"));report.latestReplyRespectsPresentation=await js(cap,"window.companion.status().then(r=>!JSON.stringify(r.value).includes('Respuesta final de prueba'))");await js(cap,"window.companion.presentation(false)");await wait(()=>js(cap,"!!document.querySelector('.codex-last-response')"));
 await js(cap,"window.companion.hide()");await wait(async()=>cap.isMinimized());report.latestReplyHiddenBeforeIpc=await js(cap,"window.companion.status().then(r=>!JSON.stringify(r.value).includes('Respuesta final de prueba'))");cap.restore();cap.showInactive();await wait(()=>js(cap,"!!document.querySelector('.codex-last-response')"));
 report.noReplyInNoticesOrSummary=!JSON.stringify({notices:hub.status().notices,summaries:hub.status().sessions.map(s=>s.summary)}).includes('Respuesta final de prueba');await shot(cap,'codex-latest-reply');await shot(cap,'codex-summary-tab');await js(cap,"document.querySelector('[data-codex-tab=activity]').click()");await wait(()=>js(cap,"!!document.querySelector('.event-list')"));await shot(cap,'codex-activity-tab');await js(cap,"document.querySelector('[data-codex-tab=summary]').click()");await wait(()=>js(cap,"!!document.querySelector('.codex-last-response')"));
 await nav('home');
 await wait(()=>js(cap,"document.querySelector('.home-song-title')?.textContent==='Contenido multimedia automático'"));
 report.homeShowsMusicAndWork=await js(cap,"document.querySelector('.home-work-state')?.textContent==='Turno terminado'");
 report.homeShowsNotices=await js(cap,"Number(document.querySelector('.home-notice-count')?.textContent)>0");
 await wait(()=>js(cap,"!!document.querySelector('.home-item[data-note-id]')"));
 const beforeHomeNotes=cap.getBounds();
 report.homeRecentNotesAreCurrent=await js(cap,`window.companion.notesRecent().then(r=>r.ok&&r.value.length<=4&&
  r.value.every((n,i)=>n.title!=='Resumir un proyecto'&&(!i||r.value[i-1].updatedAt>=n.updatedAt))&&
  r.value.map(n=>n.id).join()===Array.from(document.querySelectorAll('.home-item[data-note-id]'),el=>el.dataset.noteId).join()
 )`);
 const noteTitle=await js(cap,"document.querySelector('.home-item[data-note-id] strong').textContent");
 await js(cap,"document.querySelector('.home-item[data-note-id]').click()");
 await wait(()=>js(cap,"!!document.querySelector('.hub-document[data-kind=note]')"));
 report.homeOpensExactNoteAtSameSize=same(beforeHomeNotes,cap.getBounds())&&await js(cap,`document.querySelector('.notes-editor-heading h2')?.textContent===${JSON.stringify(noteTitle)}`);
 report.recentNotesBlockedInOtherModules=await js(cap,"window.companion.notesRecent().then(r=>!r.ok)");
 await nav('home');
 await js(cap,"document.querySelector('.home-item[title=\"Ver resumen\"]').click()");
 await wait(()=>js(cap,"document.querySelector('.codex-last-response-text strong')?.textContent==='Respuesta final de prueba en España'"));
 report.homeActivityOpensObservedResult=same(beforeHomeNotes,cap.getBounds());
 await nav('home');
 await js(cap,"window.companion.presentation(true)");
 await wait(()=>js(cap,"!document.querySelector('.codex-request-form,[data-quick-request],.home-continue,.home-notice-count')"));
 report.homePrivacyHidesDetails=await js(cap,"Promise.all([window.companion.openRequest('Petición oculta'),window.companion.notesRecent()]).then(results=>results.every(r=>!r.ok))");
 await js(cap,"window.companion.presentation(false)");
 await wait(()=>js(cap,"!!document.querySelector('.codex-request-form')"));
 await shot(cap,'workspace-home');
 await js(cap,"document.querySelector('[data-home-card=music]').click()");
 await wait(()=>js(cap,"!!document.querySelector('.workspace-content:not([hidden])[data-page=spotify]')"));
 report.requestBlockedOutsideHome=await js(cap,"window.companion.openRequest('Desde Spotify').then(r=>!r.ok)");
 await nav('home');await js(cap,"document.querySelector('[data-home-card=work]').click()");
 await wait(()=>js(cap,"!!document.querySelector('.workspace-content:not([hidden])[data-page=codex]')"));
 await nav('home');report.homeCardsNavigateWithoutClosing=true;
 await js(cap,"document.querySelector('.home-notices .quiet-control button').click()");
 await wait(()=>js(cap,"document.querySelector('.home-notices .quiet-control button').getAttribute('aria-pressed')==='true'"));
 report.homeSilenceControlsExistingTimer=await js(cap,"window.companion.status().then(r=>r.ok&&r.value.settings.silencedUntil-Date.now()>29*60000&&r.value.settings.silencedUntil-Date.now()<=30*60000)");
 await js(cap,"document.querySelector('.home-notices .quiet-control button').click()");
 await wait(()=>js(cap,"document.querySelector('.home-notices .quiet-control button').getAttribute('aria-pressed')==='false'"));
 const beforeNotices=cap.getBounds();await js(cap,"document.querySelector('[data-home-card=notices] .home-status-action').click()");await wait(()=>js(cap,"!!document.querySelector('.notice-card')"));report.noticesInCapsule=BrowserWindow.getAllWindows().length===1&&same(beforeNotices,cap.getBounds());report.homeNoticeCounterMarksRead=await js(cap,"window.companion.status().then(r=>r.ok&&r.value.notices.every(n=>n.read))");
 report.noticesCannotControlMedia=await js(cap,"window.companion.mediaList().then(r=>!r.ok)");
 await shot(cap,'capsule-notices');
 for(const page of ['home','spotify','codex','notes']){await nav(page);for(const width of [320,380,760]){await resizeForFixture(width,Math.min(680,area.height));if(!await js(cap,"document.body.scrollWidth<=innerWidth&&document.querySelector('.workspace-content:not([hidden])').scrollWidth<=document.querySelector('.workspace-content:not([hidden])').clientWidth+1")||!await headerLayout())throw Error('Workspace or header overflows: '+page);}}report.workspaceResponsive=true;report.responsiveWidthsActuallyApplied=true;
 await resizeForFixture(380,Math.min(680,area.height));
 const narrowWorkspace=cap.getBounds(),narrowRail=await js(cap,railStyle);
 await js(cap,"window.companion.launcher(false)");
 await wait(async()=>same(railBounds(narrowWorkspace),cap.getBounds())&&await js(cap,railStyle)===narrowRail);
 await nav('notes');
 await wait(async()=>same(narrowWorkspace,cap.getBounds())&&await js(cap,railStyle)===narrowRail);
 report.narrowWorkspaceSharesCapsuleRail=true;
 await nav('spotify');await wait(()=>js(cap,"!!document.querySelector('.music-player')"));await js(cap,"window.companion.presentation(true)");await wait(()=>js(cap,"!document.querySelector('.music-player')"));report.mediaPresentationRedacts=true;
 report.soundRespectsPresentation=await js(cap,"!!document.querySelector('.music-blocked')&&!document.querySelector('.media-sources')");
 await shot(cap,'music-presentation-recovery');
 await js(cap,"document.querySelector('.music-blocked .primary').click()");await wait(()=>js(cap,"!!document.querySelector('.music-player')"));
 report.musicPresentationExitExplicit=await js(cap,"window.companion.status().then(r=>r.ok&&!r.value.settings.presentation)")&&await js(cap,"!!document.querySelector('.music-player')");

 await js(cap,"window.companion.presentation(false)");await nav('home');
 report.contextBlockedOutsideCodex=await js(cap,"Promise.all([window.companion.contextChoose(),window.companion.contextResult(),window.companion.contextPrepare({kind:'text',text:'test',instruction:'Analiza'})]).then(r=>r.every(v=>!v.ok))");
 await nav('codex');await js(cap,"window.companion.codexTab('activity')");report.contextBlockedInActivity=await js(cap,"Promise.all([window.companion.contextStatus(),window.companion.contextResult()]).then(r=>r.every(v=>!v.ok))");
 await js(cap,"window.companion.codexTab('summary')");await wait(()=>js(cap,"!!document.querySelector('.codex-context .context-analysis-toggle')"));

 report.contextCompactByDefault=await js(cap,"!!document.querySelector('.codex-context textarea')&&!document.querySelector('.codex-source-picker')");
 await js(cap,"(()=>{const t=document.querySelector('[aria-label=\"Indicación para Codex\"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Revisa el contexto y explica el resultado.');t.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await js(cap,"document.querySelector('.codex-context .context-analysis-toggle').click()");await wait(()=>js(cap,"!!document.querySelector('.codex-context .context-prepare')"));
 await js(cap,"[...document.querySelectorAll('.codex-context button')].find(b=>b.textContent==='Elegir archivo').click()");await wait(()=>js(cap,"document.querySelector('.codex-context').textContent.includes('selected-context.txt')"));
 await js(cap,"document.querySelector('.context-prepare').click()");await wait(()=>js(cap,"!!document.querySelector('.codex-context .context-analysis-review pre')"));
 const expectedContextPrompt=await js(cap,"document.querySelector('.codex-context .context-analysis-review pre').textContent"),contextMarker=/<zen_resultado id="([a-f0-9-]+)">/.exec(expectedContextPrompt)?.[1];if(!contextMarker)throw Error('Missing context correlation');
 const contextQueueStart=queuedRequests.length,contextOpenStart=openedTargets.length;
 report.contextReviewExactSource=expectedContextPrompt.includes('versionSHA256')&&expectedContextPrompt.includes('selected-context.txt')&&await js(cap,"document.querySelector('.codex-context .context-analysis-review').textContent.includes('Revisar formulario en navegador')");
 await js(cap,"document.querySelector('.context-handoff').click();document.querySelector('.context-handoff')?.click()");await wait(()=>js(cap,"document.querySelector('.context-notice')?.textContent.includes('En cola en el chat fijado')"));
 report.contextSingleReviewedHandoff=queuedRequests.length===contextQueueStart+1&&queuedRequests.at(-1)?.text===expectedContextPrompt&&queuedRequests.at(-1)?.thread==='native-test'&&openedTargets.length===contextOpenStart;
 await js(cap,"window.companion.island(true)");
 await waitForIsland();
 const hookResult=(turn:string,text:string)=>{hub.accept({id:randomUUID(),event:'UserPromptSubmit',session:'native-test',cwd:'C:\\fixture',turn},()=>{});hub.accept({id:randomUUID(),event:'Stop',session:'native-test',cwd:'C:\\fixture',turn,lastAssistantMessage:text},()=>{});};
 hookResult('context-correlated-result','<zen_resultado id="'+contextMarker+'">Archivo analizado, resultado local de prueba.</zen_resultado>');hookResult('context-later-unrelated','Respuesta posterior que no corresponde a la petición de ZEN.');
 await wait(()=>js(cap,"!!document.querySelector('.zen-island-trigger[data-phase=finished]')"));
 report.islandReceivesCompletionQuietly=await pillReady()&&queuedRequests.length===contextQueueStart+1;
 await openIsland();
 await js(cap,"window.companion.launcher(true)");
 await wait(()=>js(cap,"document.querySelector('.codex-context .codex-result-text')?.textContent==='Archivo analizado, resultado local de prueba.'"));report.contextAutoResultReturns=true;report.contextHookResultSurvivesLaterReply=true;
 report.contextPrivateNotInStatus=await js(cap,"window.companion.status().then(r=>!JSON.stringify(r).includes('Archivo analizado, resultado local')&&!JSON.stringify(r).includes('selected-context.txt'))");
 writeFileSync(join(profile,'selected-context.txt'),'Contenido cambiado después del análisis.');await js(cap,"document.querySelector('.codex-context .codex-result-fetch').click()");await wait(()=>js(cap,"!document.querySelector('.codex-context .codex-result-text')&&document.querySelector('.codex-context').textContent.includes('contenido cambió')"));report.contextChangedFileRejectsResult=true;
 await js(cap,"(()=>{const toggle=document.querySelector('.codex-context .context-analysis-toggle');if(toggle.getAttribute('aria-expanded')!=='true')toggle.click();})()");
 await wait(()=>js(cap,"!!document.querySelector('.codex-context [aria-label=\"Tipo de contexto\"]')"));
 await js(cap,"[...document.querySelectorAll('.codex-context .context-analysis-actions button')].find(b=>b.textContent==='Página').click()");
 await js(cap,"(()=>{const t=document.querySelector('[aria-label=\"Indicación para Codex\"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Analiza la página seleccionada.');t.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await js(cap,"(()=>{const u=document.querySelector('[aria-label=\"Página para analizar\"]'),t=document.querySelector('[aria-label=\"Texto para analizar\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(u,'https://example.test/selected');u.dispatchEvent(new Event('input',{bubbles:true}));Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Texto elegido de la página de prueba.');t.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await js(cap,"document.querySelector('.context-prepare').click()");await wait(()=>js(cap,"!!document.querySelector('.codex-context .context-analysis-review pre')"));
 const expectedPagePrompt=await js(cap,"document.querySelector('.codex-context .context-analysis-review pre').textContent");report.contextPageUserSelectedOnly=expectedPagePrompt.includes('https://example.test/selected')&&expectedPagePrompt.includes('Texto elegido de la página de prueba.');
 await js(cap,"document.querySelector('.context-handoff').click()");await wait(()=>js(cap,"document.querySelector('.context-notice')?.textContent.includes('En cola en el chat fijado')"));
 await js(cap,"window.companion.launcher(false)");report.contextHiddenRefusesResults=await js(cap,"window.companion.contextResult().then(r=>!r.ok)");await js(cap,"window.companion.launcher(true)");await wait(()=>js(cap,"!!document.querySelector('.codex-context')"));
 await js(cap,"window.companion.presentation(true)");report.contextPrivacyClears=await js(cap,"window.companion.contextResult().then(r=>!r.ok)");await js(cap,"window.companion.presentation(false)");report.contextPrivacyRevokes=await js(cap,"window.companion.contextResult().then(r=>r.ok&&r.value.state==='none')");
 await shot(cap,'codex-context-compact');
 await nav('home');await js(cap,"document.querySelector('.home-open-requests').click()");
 await wait(()=>js(cap,"!!document.querySelector('.codex-context')"));
 await js(cap,"(()=>{const t=document.querySelector('[aria-label=\"Indicación para Codex\"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Revisa el puente IPC.');t.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await js(cap,"document.querySelector('.context-prepare').click()");
 await wait(()=>js(cap,"!!document.querySelector('.context-analysis-review pre')"));
 const visualPrompt=await js(cap,"document.querySelector('.context-analysis-review pre').textContent");
 const visualMarker=/<zen_resultado id="([a-f0-9-]+)">/.exec(visualPrompt)?.[1];
 if(!visualMarker)throw Error('Missing visual result correlation');
 report.visualRequestFromHome=visualPrompt.includes('Revisa el puente IPC')&&visualPrompt.includes('"type":"report"');
 await js(cap,"document.querySelector('.context-handoff').click()");
 await wait(()=>js(cap,"!!document.querySelector('.codex-result-waiting')"));
 const visualResult={version:1,type:'report',title:'Revisión del puente IPC',summary:'La interfaz usa el puente para solicitar acciones.',findings:[{title:'Validar el origen',detail:'Comprueba el marco y la URL antes de ejecutar la acción.',sources:[{path:'src/preload/companion.ts',line:5,excerpt:'const bridge = operacionesAutorizadas;'}]}]};
 hookResult('visual-request-result','<zen_resultado id="'+visualMarker+'">'+JSON.stringify(visualResult)+'</zen_resultado>');
 await wait(()=>js(cap,"document.querySelector('.codex-document-heading h3')?.textContent==='Revisión del puente IPC'"));
 await js(cap,"document.querySelector('.codex-reference summary').click()");
 report.visualReportShowsEvidence=await js(cap,"document.querySelector('.codex-reference').open&&document.querySelector('.codex-reference pre')?.textContent.includes('operacionesAutorizadas')");
 report.visualResultStaysOutOfStatus=await js(cap,"window.companion.status().then(r=>r.ok&&!JSON.stringify(r.value).includes('operacionesAutorizadas'))");
 await resizeForFixture(820,Math.min(680,area.height));
 report.visualResultTwoColumns=await js(cap,"(()=>{const a=document.querySelector('.context-analysis').getBoundingClientRect(),b=document.querySelector('.codex-response-column').getBoundingClientRect();return a.right<b.left&&b.width>a.width;})()");
 await shot(cap,'codex-peticion-resultado');
 await resizeForFixture(320,Math.min(680,area.height));
 report.visualResultStacksAt320=await js(cap,"(()=>{const a=document.querySelector('.context-analysis').getBoundingClientRect(),b=document.querySelector('.codex-response-column').getBoundingClientRect(),s=document.querySelector('.workspace-content:not([hidden])');return a.bottom<=b.top&&s.scrollWidth<=s.clientWidth;})()");
 await js(cap,"window.companion.codexTab('activity')");
 report.visualSourceBlockedInActivity=await js(cap,"window.companion.contextSource({id:'"+visualMarker+"',finding:0,source:0}).then(r=>!r.ok)");
 const followupReply='Respuesta de seguimiento para probar el lector de texto.\n\n- **España** y Dublín.';
 hookResult('visual-request-followup',followupReply);
 await nav('home');await resizeForFixture(820,Math.min(680,area.height));
 const glassContrast=()=>js(cap,`(()=>{
  const root=document.querySelector('.companion-capsule');
  const wallpaper=root.dataset.theme==='light'?0:255;
  const pixel=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
  const read=(element,property)=>{
   pixel.clearRect(0,0,1,1);
   pixel.fillStyle=getComputedStyle(element)[property];
   pixel.fillRect(0,0,1,1);
   return [...pixel.getImageData(0,0,1,1).data];
  };
  const blend=(base,layer)=>base.map((value,i)=>value*(1-layer[3]/255)+layer[i]*layer[3]/255);
  const linear=value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4;
  const luminance=rgb=>rgb.slice(0,3).reduce((sum,value,i)=>sum+linear(value/255)*[.2126,.7152,.0722][i],0);
  const worst=[wallpaper,wallpaper,wallpaper];
  const rail=document.querySelector('.capsule-single-row'),panel=document.querySelector('.workspace-content:not([hidden])');
  const railBackground=blend(worst,read(rail,'backgroundColor'));
  const active=rail.querySelector('.capsule-launcher [aria-current=page]');
  const selected=blend(railBackground,read(active,'backgroundColor'));
  return [
   ['Estado',rail.querySelector('.companion-state small'),railBackground,4.5],
   ['Navegación',rail.querySelector('.capsule-launcher button:not([aria-current]) span'),railBackground,4.5],
   ['Pestaña activa',active.querySelector('span'),selected,4.5],
   ['Icono activo',active.querySelector('svg'),selected,3],
   ['Sonido',rail.querySelector('.capsule-media-block small'),railBackground,4.5],
   ['Candado',rail.querySelector('.capsule-pin svg'),railBackground,3],
   ...(panel?.querySelector('.home-current-state')?[['Inicio',panel.querySelector('.home-current-state'),blend(worst,read(panel,'backgroundColor')),4.5]]:[]),
  ].map(([name,element,background,minimum])=>{
   const base=luminance(background),text=luminance(read(element,'color'));
   return {name,minimum,ratio:(Math.max(base,text)+.05)/(Math.min(base,text)+.05)};
  });
 })()`);
 const passesContrast=(samples:{minimum:number;ratio:number}[])=>samples.every(({minimum,ratio})=>ratio>=minimum);
 report.darkGlassContrast=await glassContrast();
 report.darkGlassTextReadable=passesContrast(report.darkGlassContrast);
 await shot(cap,'glass-home');
 await nav('codex');await js(cap,"document.getElementById('codex-tab-summary').click()");await shot(cap,'glass-codex');
 await nav('home');report.appearanceOnlyInSettings=await js(cap,"window.companion.appearanceSave({}).then(r=>!r.ok)");
 await preference('appearance');await wait(()=>js(cap,"!!document.querySelector('.appearance-settings')"));
 const changeGlassOpacity=(percent:number)=>js(cap,`(()=>{
  const input=document.querySelector('[aria-label="Opacidad del cristal"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(${percent}));
  input.dispatchEvent(new Event('input',{bubbles:true}));
 })()`);
 await changeGlassOpacity(100);
 await wait(()=>js(cap,"document.querySelector('.companion-capsule').style.getPropertyValue('--glass-opacity')==='1'"));
 report.glassMaximumOpaque=await js(cap,"getComputedStyle(document.querySelector('.capsule-single-row')).backgroundColor==='rgb(18, 20, 31)'&&getComputedStyle(document.querySelector('.workspace-content:not([hidden])')).backgroundColor==='rgb(18, 20, 31)'");
 await preference('capsule');
 report.preferencePreviewSuspendsOutsideAppearance=await js(cap,"document.querySelector('.companion-capsule').style.getPropertyValue('--glass-opacity')!=='1'");
 const beforePosition=await js(cap,"window.companion.status().then(r=>r.value.workspace.location)");
 const nextPosition=beforePosition==='right'?'left':'right';
 await js(cap,`document.querySelector('.preference-positions [data-position=${nextPosition}]').click()`);
 await wait(()=>js(cap,`document.querySelector('.preference-positions [aria-pressed=true]')?.dataset.position===${JSON.stringify(nextPosition)}`));
 report.preferencePositionSharesCapsule=await js(cap,`document.querySelector('.capsule-single-row .capsule-position [aria-pressed=true]')?.dataset.position===${JSON.stringify(nextPosition)}`);
 await js(cap,`document.querySelector('.preference-positions [data-position=${beforePosition}]').click()`);
 await wait(()=>js(cap,`document.querySelector('.preference-positions [aria-pressed=true]')?.dataset.position===${JSON.stringify(beforePosition)}`));
 await preference('appearance');
 report.preferenceDraftSurvivesCategory=await js(cap,"document.querySelector('#preference-opacity').value==='100'&&document.querySelector('.appearance-save [data-pending=true]')&&!document.querySelector('.appearance-preview :is(button,input,a)')").then(Boolean);
 await js(cap,"document.querySelector('.appearance-save button:not(.primary)').click()");
 await wait(()=>js(cap,"document.querySelector('.appearance-save [data-pending=false]')&&document.querySelector('#preference-opacity').value==='74'"));
 report.preferenceDiscardRestoresPreview=await js(cap,"document.querySelector('.companion-capsule').style.getPropertyValue('--glass-opacity')==='0.74'");
 await changeGlassOpacity(74);
 await wait(()=>js(cap,"document.querySelector('.companion-capsule').style.getPropertyValue('--glass-opacity')==='0.74'"));report.glassOpacityPreviews=true;
 await js(cap,"[...document.querySelectorAll('.appearance-theme button')].find(b=>b.textContent==='Claro').click()");await wait(()=>js(cap,"document.querySelector('.companion-capsule').dataset.theme==='light'"));
 await js(cap,"document.querySelector('.appearance-save .primary').click()");await wait(()=>js(cap,"document.querySelector('.appearance-save [role=status]')?.textContent==='Apariencia guardada.'"));
 const appearanceSaved=JSON.parse(readFileSync(join(profile,'companion-appearance.json'),'utf8'));report.glassSettingsPersist=appearanceSaved.options.theme==='light'&&appearanceSaved.options.opacity===.74;await shot(cap,'glass-settings-light');
 await js(cap,"document.querySelector('.appearance-file button').click()");await wait(()=>js(cap,"document.querySelector('.companion-capsule').dataset.background==='image'"));
 const wallpaper=await js(cap,"window.companion.status().then(r=>r.value.appearance.imageUrl)");
 report.wallpaperOwnedAndVisible=typeof wallpaper==='string'&&/^zen-theme:\/\/background\/[a-f0-9-]{36}$/.test(wallpaper)&&await js(cap,`new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth===1);i.onerror=()=>resolve(false);i.src=${JSON.stringify(wallpaper)};})`);
 await js(cap,"window.companion.launcher(false)");await wait(()=>js(cap,"!!document.querySelector('.companion-capsule.collapsed[data-background=image]')"));report.capsuleWallpaperPreferenceVisible=await js(cap,`getComputedStyle(document.querySelector('.companion-capsule'),'::before').backgroundImage.includes(${JSON.stringify(wallpaper)})`);report.capsuleOpacityPreferenceVisible=await js(cap,"getComputedStyle(document.querySelector('.capsule-single-row')).backgroundColor==='rgba(244, 246, 253, 0.74)'");report.capsuleAppearanceKeepsNativeFrameRemoved=await nativeCapsuleFrame();
 await shot(cap,'capsule-saved-appearance');
 const wallpaperChecks:boolean[]=[],emblemChecks:boolean[]=[];
 const inspectEmblem=()=>js(cap,`(async()=>{
  const button=document.querySelector('.zen-island-trigger,.companion-brand');
  const image=button?.querySelector('.zen-emblem');
  if(!image||!button.getAttribute('aria-label'))return false;
  await image.decode();
  const b=button.getBoundingClientRect(),i=image.getBoundingClientRect();
  return i.width>0&&i.width===i.height&&i.left>=b.left-1&&i.right<=b.right+1&&
   i.top>=b.top-1&&i.bottom<=b.bottom+1&&image.naturalWidth===256&&image.src.endsWith('/icons/zen-256.png');
 })()`);
 for(const position of ['top','left','right','floating']){
  await js(cap,`window.companion.capsuleLocation(${JSON.stringify(position)})`);
  await wait(()=>js(cap,`window.companion.status().then(r=>r.value.workspace.location===${JSON.stringify(position)})`));
  const inspectWallpaper=()=>js(cap,`getComputedStyle(document.querySelector('.companion-capsule'),'::before').backgroundImage.includes(${JSON.stringify(wallpaper)})`);
  wallpaperChecks.push(await inspectWallpaper());
  emblemChecks.push(await inspectEmblem());
  await js(cap,"window.companion.island(true)");
  await wait(()=>js(cap,"!!document.querySelector('.zen-island-trigger')&&document.querySelector('.companion-capsule').dataset.sizing==='false'"));
  wallpaperChecks.push(await inspectWallpaper());
  emblemChecks.push(await inspectEmblem());
  await openIsland();
 }
 report.ownWallpaperAcrossLocations=wallpaperChecks.every(Boolean);
 report.emblemAcrossLocations=emblemChecks.every(Boolean);
 const emblemBytes=readFileSync(join(__dirname,'renderer','icons','zen-256.png')).toString('base64');
 report.emblemPreservesTransparency=await js(cap,`(async()=>{
  const image=new Image();image.src='data:image/png;base64,${emblemBytes}';
  await image.decode();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const context=canvas.getContext('2d');context.drawImage(image,0,0);
  const {data}=context.getImageData(0,0,256,256);
  const gap=data.findIndex((value,index)=>index%4===3&&value===0&&
   index/4%256>=88&&index/4%256<168&&Math.floor(index/1024)>=88&&Math.floor(index/1024)<168);
  const stroke=data.findIndex((value,index)=>index%4===3&&value>=250&&data[index-3]>=240&&data[index-2]>=240&&data[index-1]>=240);
  if(gap<0||stroke<0||data[3]!==0)return false;
  return ['#101116','#f4f6fd','#4678b4'].every(background=>{
   context.globalCompositeOperation='destination-over';context.fillStyle=background;context.fillRect(0,0,256,256);
   const composited=context.getImageData(0,0,256,256).data;
   const passed=[1,2,3].every(channel=>composited[gap-channel]===composited[3-channel])&&composited[stroke-3]>=238;
   context.clearRect(0,0,256,256);context.globalCompositeOperation='source-over';context.drawImage(image,0,0);
   return passed;
  });
 })()`);
 await nav('home');
 report.lightGlassContrast=await glassContrast();
 report.lightGlassTextReadable=passesContrast(report.lightGlassContrast);
 await preference('connection');
 report.emblemInAboutAndFavicon=existsSync(join(__dirname,'renderer','icons','zen.ico'))&&await js(cap,`(async()=>{
  const image=document.querySelector('.companion-about summary .zen-emblem');await image.decode();
  return image.naturalWidth===256&&document.querySelector('link[rel=icon]').href.endsWith('/icons/zen.ico');
 })()`);
 report.wallpaperArbitraryPathsRejected=await js(cap,"new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(false);i.onerror=()=>resolve(true);i.src='zen-theme://background/../../gmail-oauth.bin';})");
 await preference('appearance');
 await js(cap,"window.companion.presentation(true)");await wait(()=>js(cap,"document.querySelector('.companion-capsule').dataset.background!=='image'&&!document.querySelector('.appearance-file')"));
 report.wallpaperPresentationRedacts=await js(cap,"Promise.all([window.companion.appearanceChoose(),window.companion.appearanceSave({})]).then(r=>r.every(v=>!v.ok))");
 await js(cap,"window.companion.presentation(false)");await wait(()=>js(cap,"!!document.querySelector('.appearance-settings')"));await js(cap,"window.companion.appearanceSave({theme:'dark',accent:'violet',background:'aurora',opacity:.82,blur:24})");
 // Local view tools operate only on already visible, supplied data.
 await nav('settings');report.polishOpaqueWorkspace=await js(cap,"Number(getComputedStyle(document.querySelector('.workspace-content:not([hidden])')).backgroundColor.match(/[\\d.]+/g).at(-1))>=.84");
 await nav('home');report.polishHomeCompact=await js(cap,"(()=>{const home=document.querySelector('.home-status'),cards=[...home.querySelectorAll('.home-module')].map(card=>card.getBoundingClientRect()),hero=home.querySelector('.codex-request-form');return cards.length===3&&cards.every(card=>card.height<=100)&&!!hero&&(home.clientWidth<=525||cards.every(card=>Math.abs(card.top-cards[0].top)<1));})()");await shot(cap,'polish-home');
 await js(cap,`(()=>{
  const field=document.querySelector('#codex-request');
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'Petición de prueba sin enviar');
  field.dispatchEvent(new Event('input',{bubbles:true}));
 })()`);
 await wait(()=>js(cap,"!document.querySelector('.codex-request-form button[type=submit]').disabled"));
 await pause(220);
 const composerStyle=await js(cap,`(()=>{
  const field=document.querySelector('#codex-request'),submit=document.querySelector('.codex-request-form button[type=submit]');
  return {focused:field===document.activeElement,outline:parseFloat(getComputedStyle(field).outlineWidth),
   height:field.clientHeight,action:getComputedStyle(submit).backgroundColor};
 })()`);
 report.refinedComposerStyle=composerStyle;
 report.refinedComposerFocusAndAction=composerStyle.focused&&composerStyle.outline>=2&&composerStyle.height>=76&&composerStyle.action==='rgb(255, 187, 128)';
 await shot(cap,'home-composer-active');
 await nav('codex');await js(cap,"document.getElementById('codex-tab-activity').click()");await wait(()=>js(cap,"!!document.querySelector('.activity-tools')"));
 const actionTotal=await js(cap,"document.querySelectorAll('.event-list details').length"),commandTotal=await js(cap,"[...document.querySelectorAll('.event-list summary')].filter(e=>e.textContent.includes('Comando')).length");
 await js(cap,"(()=>{const i=document.querySelector('[aria-label=\"Buscar actividad\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'no-match-local-7832');i.dispatchEvent(new Event('input',{bubbles:true}));})()");await wait(()=>js(cap,"document.querySelectorAll('.event-list details').length===0"));report.polishActivitySearch=await js(cap,"!!document.querySelector('.view-empty')");
 await js(cap,"document.querySelector('[aria-label=\"Limpiar buscar actividad\"]').click()");await wait(()=>js(cap,`document.querySelectorAll('.event-list details').length===${actionTotal}`));
 await js(cap,"[...document.querySelectorAll('[aria-label=\"Tipo de actividad\"] button')].find(b=>b.textContent==='Comandos').click()");await wait(()=>js(cap,"[...document.querySelectorAll('.event-list summary')].every(e=>e.textContent.includes('Comando'))"));report.polishActivityFilter=await js(cap,`document.querySelectorAll('.event-list details').length===${commandTotal}`);
 await js(cap,"[...document.querySelectorAll('[aria-label=\"Tipo de actividad\"] button')].find(b=>b.textContent==='Todo').click()");await js(cap,"[...document.querySelectorAll('.activity-tools>button')].find(b=>b.textContent==='Ver detalles').click()");await wait(()=>js(cap,`document.querySelectorAll('.event-list details[open]').length===${actionTotal}`));report.polishActivityExpand=true;await js(cap,"[...document.querySelectorAll('.activity-tools>button')].find(b=>b.textContent==='Plegar detalles').click()");await shot(cap,'polish-codex');
 await js(cap,"document.getElementById('codex-tab-summary').click()");await wait(()=>js(cap,"!!document.querySelector('.codex-last-response-text')"));await js(cap,"document.querySelector('.codex-last-response .copy-visible button').click()");await wait(async()=>copiedText.at(-1)===followupReply);report.polishCopyVisibleReply=true;
 await nav('spotify');await wait(()=>js(cap,"!!document.querySelector('.music-player')"));const copiedTrack=await js(cap,"document.querySelector('.music-track h3').textContent+' — '+document.querySelector('.music-track p').textContent");await js(cap,"document.querySelector('.music-copy button').click()");await wait(async()=>copiedText.at(-1)?.startsWith(copiedTrack)===true);report.polishMusicCopy=true;await shot(cap,'polish-music');
 report.refinedPlayerLayout=await js(cap,`(()=>{
  const box=selector=>document.querySelector(selector).getBoundingClientRect();
  const progress=document.querySelector('.music-timeline progress'),controls=box('.music-controls');
  return progress.value===48000&&progress.max===210000&&box('.music-timeline').bottom<=controls.top&&
   box('.music-artwork').right<=box('.music-track').left&&box('.music-copy').left>=controls.right;
 })()`);
 for(const page of ['home','codex','spotify','notes']){
  await nav(page);await resizeForFixture(1180,Math.min(680,area.height));
  if(!await js(cap,"document.body.scrollWidth<=innerWidth&&document.querySelector('.workspace-content:not([hidden])').scrollWidth<=document.querySelector('.workspace-content:not([hidden])').clientWidth+1")||!await headerLayout())throw Error('Wide workspace overflows: '+page);
 }
 report.refinedWideWorkspace=true;
 await resizeForFixture(820,Math.min(680,area.height));
 const defaultZoom=cap.webContents.getZoomFactor();
 try {
  for(const scale of [1.25,1.5]){
   cap.webContents.setZoomFactor(scale);
   for(const page of ['home','codex','spotify','notes']){
    await nav(page);
    const fits=await js(cap,"(()=>{const content=document.querySelector('.workspace-content:not([hidden])'),rail=document.querySelector('.capsule-single-row');return document.body.scrollWidth<=innerWidth&&content.scrollWidth<=content.clientWidth+1&&rail.scrollWidth<=rail.clientWidth;})()");
    if(!fits)throw Error('Workspace overflows at renderer zoom '+scale+': '+page);
   }
  }
  report.refinedRendererZoom=true;
 }finally{cap.webContents.setZoomFactor(defaultZoom);}
 await nav('notices');await js(cap,"[...document.querySelectorAll('[aria-label=\"Filtrar avisos\"] button')].find(b=>b.textContent==='Errores').click()");report.polishNoticeTools=await js(cap,"document.querySelector('[aria-label=\"Filtrar avisos\"] button[aria-pressed=true]').textContent==='Errores'");
 await preference('connection');
 report.polishDiagnosticsFolded=await js(cap,"!!document.querySelector('.connection-diagnosis .settings-connection:not([open])')");
 await shot(cap,'preferences-connection');
 await preference('appearance');
 report.polishAccentSwatches=await js(cap,"getComputedStyle(document.querySelector('.appearance-accents button[data-accent=violet]')).backgroundColor==='rgb(178, 153, 255)'");
 await shot(cap,'polish-settings');
 await preference('shortcuts');
 await js(cap,`(()=>{const first=document.querySelector('#shortcut'),second=document.querySelector('#returnShortcut');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(first,second.value);first.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await js(cap,"document.querySelector('.preferences-page:not([hidden]) .preference-save .primary').click()");
 await wait(()=>js(cap,"document.querySelector('.preferences-page:not([hidden]) [role=alert]')?.textContent.includes('atajos diferentes')"));
 report.preferenceShortcutErrorKeepsDraft=await js(cap,"document.querySelector('#shortcut').value===document.querySelector('#returnShortcut').value&&!!document.querySelector('.preferences-page:not([hidden]) [data-pending=true]')");
 await js(cap,"document.querySelector('.preferences-page:not([hidden]) .preference-save button:not(.primary)').click()");
 report.preferenceShortcutDiscard=await js(cap,"document.querySelector('#shortcut').value!==document.querySelector('#returnShortcut').value");
 await js(cap,"document.querySelector('.preferences-back').click()");
 await wait(()=>js(cap,"!!document.querySelector('.workspace-content:not([hidden])[data-page=notices]')"));
 await nav('settings');
 report.preferencesBackAndRememberCategory=await js(cap,"document.querySelector('.preferences-nav button[aria-current=page]')?.dataset.category==='shortcuts'&&localStorage.getItem('zen.preferences.category')==='shortcuts'");
 await resizeForFixture(320,Math.min(680,area.height));
 for(const category of ['appearance','capsule','audio','shortcuts','data','connection']){
  await preference(category);
  const fits=await js(cap,"(()=>{const panel=document.querySelector('.workspace-content:not([hidden])');return panel.scrollWidth<=panel.clientWidth+1&&panel.querySelectorAll('.preferences-page:not([hidden])').length===1;})()");
  if(!fits)throw Error('Preferencias overflows at 320 DIP: '+category);
 }
 await preference('capsule');await shot(cap,'preferences-narrow');
 report.preferenceNarrowPositionCardsReachable=await js(cap,`[...document.querySelectorAll('.preference-positions button')].every(button=>{
   const rect=button.getBoundingClientRect();
   return button.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2));
 })`);
 await preference('appearance');
 for(const width of [320,760,820]){await resizeForFixture(width,Math.min(680,area.height));for(const page of ['home','codex','spotify','notices','settings','options'] as const){await nav(page);if(page==='options')await js(cap,"document.querySelector('.workspace-layout-menu').open=true");await pause(80);if(!await js(cap,"document.body.scrollWidth<=innerWidth&&document.querySelector('.workspace-content:not([hidden])').scrollWidth<=document.querySelector('.workspace-content:not([hidden])').clientWidth+1"))throw Error('Polished tools overflow: '+page+' '+width);}}report.polishAllViewsResponsive=true;
 await nav('codex');await js(cap,"document.getElementById('codex-tab-summary').click()");await wait(()=>js(cap,"window.companion.status().then(r=>r.value.sessions.some(s=>!!s.lastReply))"));
 const beforeCollect=cap.getBounds();
 await js(cap,"window.companion.launcher(false)");
 await wait(async()=>same(railBounds(beforeCollect),cap.getBounds())&&!cap.isResizable()&&!cap.isAlwaysOnTop());
 report.extensionCollectsToAnchor=await nativeCapsuleFrame();
 await js(cap,"window.companion.launcher(true)");
 await wait(()=>js(cap,"!!document.querySelector('.workspace-content:not([hidden])')"));
 report.workspaceReopensAtLastGeometry=same(beforeCollect,cap.getBounds());
 report.legacyAppGeometryIgnored=readFileSync(join(profile,'companion-desktop-window.json'),'utf8')==='{"version":1,"mode":"app","bounds":{"x":5,"y":5,"width":1100,"height":900},"maximized":true}';
 await js(cap,"window.companion.presentation(false)");await nav('home');hub.update({...hub.settings,motion:false,sounds:false,notifications:false});await pause(100);report.reducedMotion=await js(cap,"document.querySelector('.zen-status-mark').getAnimations({subtree:true}).length===0");
 await preference('appearance');
 await js(cap,"[...document.querySelectorAll('.appearance-theme button')].find(b=>b.textContent==='Monocromo').click()");
 await wait(()=>js(cap,"!!document.querySelector('.companion-capsule[data-theme=monochrome]')&&!!document.querySelector('[aria-label=\"Opacidad del cristal\"]')&&!!document.querySelector('[aria-label=\"Desenfoque del cristal\"]')&&!document.querySelector('.appearance-accents')"));
 await js(cap,"[...document.querySelectorAll('.appearance-background button')].find(b=>b.textContent==='Imagen').click()");
 await wait(()=>js(cap,`(()=>{const root=document.querySelector('.companion-capsule'),style=getComputedStyle(root,'::before');return root.dataset.background==='image'&&style.backgroundImage.includes(${JSON.stringify(wallpaper)})&&style.filter==='grayscale(1)';})()`));
 await nav('home');
 await wait(()=>js(cap,"!!document.querySelector('.companion-capsule[data-theme=dark]')"));
 await nav('settings');
 await js(cap,"[...document.querySelectorAll('.appearance-theme button')].find(b=>b.textContent==='Monocromo').click()");
 await js(cap,"document.querySelector('.appearance-save .primary').click()");
 await wait(()=>js(cap,"document.querySelector('.appearance-save [role=status]')?.textContent==='Apariencia guardada.'"));
 const monochromeSaved=JSON.parse(readFileSync(join(profile,'companion-appearance.json'),'utf8'));
 report.monochromePersists=monochromeSaved.options.theme==='monochrome'&&monochromeSaved.options.opacity===.82&&monochromeSaved.options.blur===24&&monochromeSaved.image?.id===wallpaper.split('/').at(-1);
 await nav('notes');
 await wait(()=>js(cap,"!!document.querySelector('[data-theme=monochrome] .knowledge-hub[data-hub-theme=dark] .hub-card')"));
 const notesMonochromeGlass=`(()=>{
  const hub=document.querySelector('.knowledge-hub'),style=getComputedStyle(hub);
  return {surface:style.backgroundColor,blur:style.backdropFilter,accent:getComputedStyle(hub.querySelector('.hub-brand span')).backgroundColor};
 })()`;
 const darkNotesGlass=await js(cap,notesMonochromeGlass);
 await js(cap,"[...document.querySelectorAll('.hub-sidebar nav button')].find(button=>button.textContent==='Configuración').click()");
 await wait(()=>js(cap,"[...document.querySelectorAll('.hub-panel button')].some(button=>button.textContent==='Claro')"));
 await js(cap,"[...document.querySelectorAll('.hub-panel button')].find(button=>button.textContent==='Claro').click()");
 await wait(()=>js(cap,"!!document.querySelector('.knowledge-hub[data-hub-theme=light]')"));
 const lightNotesGlass=await js(cap,notesMonochromeGlass);
 report.hubMonochromeStyles={dark:darkNotesGlass,light:lightNotesGlass};
 report.hubMonochromeGlass=[darkNotesGlass,lightNotesGlass].every(glass=>glass.blur.includes('blur(24px)'))&&
  darkNotesGlass.surface.startsWith('rgba(28, 28, 29, ')&&darkNotesGlass.accent==='rgb(245, 245, 245)'&&
  lightNotesGlass.surface.startsWith('rgba(255, 255, 255, ')&&lightNotesGlass.accent==='rgb(56, 57, 58)';
 for(const width of [320,760,820]){
  await resizeForFixture(width,Math.min(680,area.height));
  for(const page of ['home','codex','spotify','notices','settings'] as const){
   await nav(page);
   const fits=await js(cap,"(()=>{const content=document.querySelector('.workspace-content:not([hidden])'),header=document.querySelector('.capsule-single-row');return document.body.scrollWidth<=innerWidth&&content.scrollWidth<=content.clientWidth+1&&header.scrollWidth<=header.clientWidth;})()");
   if(!fits)throw Error('Monochrome workspace overflow: '+page+' '+width);
  }
 }
 report.monochromeResponsive=true;
 await nav('codex');
 await js(cap,"document.getElementById('codex-tab-summary').click()");
 await wait(()=>js(cap,"!!document.querySelector('#codex-panel-summary .codex-last-response')"));
 report.monochromeExtensionGlass=await js(cap,`(()=>{
  const header=document.querySelector('.companion-bar'),menu=document.querySelector('.codex-page>.workspace-section-heading'),panel=document.querySelector('#codex-panel-summary');
  const [a,b,c]=[header,menu,panel].map(e=>e.getBoundingClientRect());
  return a.bottom<b.top&&b.right<c.left&&[header,menu,panel].every(e=>getComputedStyle(e).backdropFilter.includes('blur(24px)'))&&
   getComputedStyle(panel).backgroundColor.startsWith('rgba(255, 255, 255, ')&&getComputedStyle(menu.querySelector('[aria-selected=true]')).backgroundColor==='rgb(224, 225, 226)';
 })()`);
 report.refinedMonochromeAction=await js(cap,`(()=>{
  const button=document.querySelector('.codex-last-response .primary');
  const style=getComputedStyle(button);
  const background=style.backgroundColor.match(/[0-9.]+/g)?.slice(0,3).map(Number);
  return style.color==='rgb(250, 250, 250)'&&background?.length===3&&background.every(channel=>channel<100);
 })()`);
 await shot(cap,'monochrome-codex');
 await js(cap,"window.companion.launcher(false)");
 await wait(()=>js(cap,"!!document.querySelector('.companion-capsule.collapsed[data-theme=monochrome]')"));
 report.monochromeGlassCapsule=await js(cap,"(()=>{const style=getComputedStyle(document.querySelector('.capsule-single-row'));return style.backgroundColor==='rgba(28, 28, 29, 0.82)'&&style.backdropFilter.includes('blur(24px)');})()")&&await nativeCapsuleFrame();
 report.monochromeCapsuleContrast=await glassContrast();
 report.monochromeCapsuleReadable=passesContrast(report.monochromeCapsuleContrast);
 report.profileBackupRequiresSettings=await js(cap,"window.companion.profileBackup('export').then(r=>!r.ok)");
 await preference('data');
 await shot(cap,'preferences-data');
 const transferPath=join(profile,'zen-transfer-fixture.zen-backup.json');
 const originalMessage=dialog.showMessageBox;
 let decision=0,leaveViewOnConfirm=false,notesImportDetail='';
 try{
  dialog.showSaveDialog=(async()=>({canceled:false,filePath:transferPath})) as typeof dialog.showSaveDialog;
  dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[transferPath]})) as typeof dialog.showOpenDialog;
  dialog.showMessageBox=(async(_window:unknown,options:{detail?:string})=>{
   notesImportDetail=options.detail??'';
   if(leaveViewOnConfirm)await nav('home');
   return {response:decision,checkboxChecked:false};
  }) as typeof dialog.showMessageBox;
  await js(cap,"document.querySelector('.settings-backup button').click()");
  await wait(()=>js(cap,"document.querySelector('.settings-backup [role=status]')?.textContent.startsWith('Copia guardada')"));
  const exported=readBackup(transferPath);
  report.profileBackupExportsPortableData=!!exported.appearance.wallpaper&&
   exported.library.entries.some(entry=>entry.title==='Filtros con Power Fx'&&entry.images.length===1)&&
   !Object.hasOwn(exported.settings,'presentation')&&!Object.hasOwn(exported,'target');
  const imported=structuredClone(exported);
  imported.settings.sounds=!exported.settings.sounds;
  imported.appearance.options.theme='light';
  imported.library.entries[0].title='Nota restaurada en el equipo nuevo';
  writeBackup(transferPath,imported);
  report.profileBackupCancellation=await js(cap,"window.companion.profileBackup('import').then(r=>r.ok&&r.value==='cancelled')")&&!existsSync(join(profile,'backups'));
  decision=1;
  leaveViewOnConfirm=true;
  report.profileBackupRevokedAfterConfirmation=await js(cap,"window.companion.profileBackup('import').then(r=>!r.ok)")&&!existsSync(join(profile,'backups'));
  leaveViewOnConfirm=false;
  await nav('settings');
  await js(cap,"document.querySelector('.settings-backup [data-backup=import]').click()");
  await wait(()=>js(cap,"document.querySelector('.settings-backup [role=status]')?.textContent.startsWith('Copia importada')"));
  const recovery=readBackup(join(profile,'backups',readdirSync(join(profile,'backups'))[0]));
  report.profileBackupCreatesRecovery=JSON.stringify(recovery)===JSON.stringify(exported);
  report.profileBackupAppliesPreferences=await js(cap,`window.companion.status().then(r=>r.ok&&r.value.appearance.theme==='light'&&r.value.settings.sounds===${imported.settings.sounds}&&r.value.target.session==='native-test')`);
  await nav('notes');
  report.profileBackupRestoresLibrary=await js(cap,"window.companion.notesRead().then(r=>r.ok&&r.value.data.entries.some(entry=>entry.title==='Nota restaurada en el equipo nuevo'))");
  const notesOnly=structuredClone(imported);
  notesOnly.settings.sounds=exported.settings.sounds;
  notesOnly.appearance.options.theme='dark';
  notesOnly.library.entries[0].title='Nota restaurada desde Apuntes';
  writeBackup(transferPath,notesOnly);
  const noteWasReplaced=()=>js(cap,"window.companion.notesRead().then(r=>r.ok&&r.value.data.entries.some(entry=>entry.title==='Nota restaurada desde Apuntes'))");
  const importInNotes="window.companion.notesFile({type:'import'})";
  decision=0;
  report.hubPortableBackupCancellation=await js(cap,importInNotes+".then(r=>r.ok&&r.value.type==='cancelled')")&&
   notesImportDetail.includes('Ajustes → Datos y configuración')&&!await noteWasReplaced();
  decision=1;
  leaveViewOnConfirm=true;
  report.hubPortableBackupRevokedAfterConfirmation=await js(cap,importInNotes+".then(r=>!r.ok)");
  leaveViewOnConfirm=false;
  await nav('notes');
  report.hubPortableBackupRevokedAfterConfirmation&&=!await noteWasReplaced();
  report.hubPortableBackupOnlyRestoresLibrary=await js(cap,importInNotes+".then(r=>r.ok&&r.value.type==='import')")&&await noteWasReplaced()&&
   await js(cap,`window.companion.status().then(r=>r.ok&&r.value.appearance.theme==='light'&&r.value.settings.sounds===${imported.settings.sounds})`);
 }finally{
  dialog.showSaveDialog=originalSave;
  dialog.showOpenDialog=originalOpen;
  dialog.showMessageBox=originalMessage;
 }
 await preference('audio');
 await shot(cap,'preferences-audio');
 const savedAudioSettings=await js(cap,"window.companion.status().then(r=>r.value.settings)");
 const audioSettings={...savedAudioSettings,paused:false,presentation:false,silencedUntil:0,interfaceSounds:true};
 await js(cap,`window.companion.save(${JSON.stringify({...audioSettings,interfaceVolume:18})})`);
 await js(cap,"window.companion.launcher(false)");
 await js(cap,"window.companion.island(true)");
 await wait(()=>js(cap,"!!document.querySelector('.zen-island-trigger:not(:disabled)')&&document.querySelector('.companion-capsule').dataset.sizing==='false'"));
 await pause(200);
 await js(cap,`(()=>{
  window.fixtureTones=[];
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){
   start.apply(this,args);
   window.fixtureTones.push(Math.round(this.buffer.duration*1000));
  };
  window.restoreFixtureAudio=()=>{AudioBufferSourceNode.prototype.start=start;};
 })()`);
 await openIsland();
 await wait(()=>js(cap,`window.fixtureTones.includes(${interfaceTones.expand.ms})`));
 await pause(180);
 await js(cap,"window.companion.island(false)");
 await nav('home');
 await pause(180);
 await js(cap,"window.companion.togglePage('home')");
 await js(cap,`(()=>{
  const form=document.querySelector('.codex-request-form');
  const field=form.querySelector('textarea');
  form.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
  field.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));
  field.dispatchEvent(new Event('scroll',{bubbles:true}));
 })()`);
 await pause(160);
 report.interfaceAudioUsesOneEffectPerTransition=await js(cap,`JSON.stringify(window.fixtureTones)===JSON.stringify([${interfaceTones.expand.ms},${interfaceTones.open.ms}])`);
 const tonesBeforePosition=await js(cap,"window.fixtureTones.length");
 await selectPosition('right');
 await wait(()=>js(cap,`window.fixtureTones.length===${tonesBeforePosition+1}`));
 await selectPosition('right');
 await pause(180);
 report.selectorSoundsOnlyOnChange=await js(cap,`window.fixtureTones.length===${tonesBeforePosition+1}&&window.fixtureTones.at(-1)===${interfaceTones.navigate.ms}`);
 await selectPosition('floating');
 await nav('settings');
 await pause(180);
 await js(cap,`window.companion.save(${JSON.stringify({...audioSettings,interfaceVolume:31})})`);
 await wait(()=>js(cap,"document.querySelector('#interface-volume')?.value==='31'"));
 await js(cap,"document.querySelector('.settings-interface-audio button').click()");
 await wait(()=>js(cap,`window.fixtureTones.at(-1)===${interfaceTones.open.ms}`));
 await pause(180);
 await js(cap,`window.companion.save(${JSON.stringify({...audioSettings,interfaceSounds:false,interfaceVolume:31})})`);
 await wait(()=>js(cap,"document.querySelector('.settings-interface-audio button')?.disabled"));
 const tonesBeforeMute=await js(cap,"window.fixtureTones.length");
 await nav('home');
 await pause(180);
 const settingsFile=JSON.parse(readFileSync(join(profile,'companion-settings.json'),'utf8'));
 report.interfaceAudioPersistsAndRespectsMute=settingsFile.interfaceVolume===31&&settingsFile.interfaceSounds===false&&
  await js(cap,`window.companion.status().then(r=>r.ok&&r.value.settings.interfaceVolume===31&&r.value.settings.interfaceSounds===false&&window.fixtureTones.length===${tonesBeforeMute})`);
 await nav('settings');
 await js(cap,`window.companion.save(${JSON.stringify(savedAudioSettings)})`);
 await js(cap,"window.companion.launcher(false)");
 await js(cap,"window.companion.island(true)");
 await wait(()=>js(cap,"!!document.querySelector('.zen-island-trigger')&&document.querySelector('.companion-capsule').dataset.sizing==='false'"));
 await js(cap,"window.restoreFixtureAudio();delete window.restoreFixtureAudio;delete window.fixtureTones;");
 report.onlyExplicitCodexHandoffs=queuedRequests.length===6&&queuedRequests.every(item=>item.thread==='native-test')&&copiedRequests.length===0&&queuedRequests[3].text===expectedContextPrompt&&queuedRequests[4].text===expectedPagePrompt&&queuedRequests[5].text===visualPrompt;report.noExtraWindows=BrowserWindow.getAllWindows().length===1;
 integration.close();report.closedAppDoesNotBlock=await launch('PermissionRequest',{tool_name:'Bash',tool_input:{command:'must not run'}}).done==='{}';
 report.passed=Object.entries(report).filter(([k,v])=>typeof v==='boolean'&&!['apiCalled','physicalInputTested'].includes(k)).every(([,v])=>v===true);
 await writeEvidence(join(evidenceDirectory,'companion-native.json'),JSON.stringify(report,null,2));if(!report.passed)throw Error('Companion assertions failed: '+JSON.stringify(Object.entries(report).filter(([key,value])=>value===false&&!['apiCalled','physicalInputTested','passed'].includes(key))));return report;
}
