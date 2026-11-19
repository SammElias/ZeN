import {app,screen,BrowserWindow,Menu} from 'electron';
import type {CompanionHub} from './companion-hub';
import type {CompanionIntegration} from './companion-integration';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeEvidence} from './evidence-file';
import type {CompanionNotice} from '../shared/codex-companion';
import type {CompanionMedia} from './companion-media';
import type {SmokeMediaState} from './companion-smoke-media';
import {newFields} from '../shared/knowledge-hub';
import {sectionPages} from '../shared/companion-navigation';
import {smokeTemplates} from './companion-smoke-templates';
import {smokeAppearance} from './companion-smoke-appearance';
import type {CompanionCalendar} from './companion-calendar';
import {calendarGrid,addCalendarDays,sourceKey} from '../shared/companion-calendar';
export async function companionSmoke({cap,hub,integration,calendar,profile,openedTargets,activateNotice,copiedRequests,queuedRequests,copiedText,media,observationFixture,dismissOnOutsideClick}:{cap:BrowserWindow;hub:CompanionHub;integration:CompanionIntegration;calendar:CompanionCalendar;profile:string;openedTargets:string[];activateNotice:(n:CompanionNotice)=>Promise<void>;copiedRequests:string[];queuedRequests:{thread:string;text:string}[];copiedText:string[];media:CompanionMedia;observationFixture:SmokeMediaState;dismissOnOutsideClick:()=>void}){

 const evidenceDirectory=join(profile,'evidence'),screenshots=join(evidenceDirectory,'screenshots');
 mkdirSync(screenshots,{recursive:true});
 const report:Record<string,any>={at:new Date().toISOString(),scope:'Fixed capsule and direct panels, synthetic isolated Windows session',apiCalled:false,physicalInputTested:false,companionOnly:true,evidenceDirectory};
 const pause=(ms=80)=>new Promise(resolve=>setTimeout(resolve,ms));
 const js=async(w:BrowserWindow,script:string)=>w.webContents.executeJavaScript(script);
 const wait=async(condition:()=>Promise<any>)=>{
  for(let attempt=0;attempt<100;attempt++){if(await condition().catch(()=>false))return;await pause();}
  throw Error('Capsule condition failed: '+condition.toString());
 };
 const check=(name:string,value:any)=>{report[name]=Boolean(value);if(!value)throw Error('Capsule assertion failed: '+name);};
 const nav=async(page:string)=>{
  const result=await js(cap,`window.companion.navigate(${JSON.stringify(page)})`);
  if(!result.ok)throw Error(result.error);
  await wait(()=>js(cap,`document.querySelector('.workspace-content:not([hidden])')?.dataset.page===${JSON.stringify(page)}`));
 };
 const compact=async()=>{
  await js(cap,"window.companion.island(true)");
  await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')&&!document.querySelector('.capsule-launcher [aria-current]')"));
 };
 const clickSection=async(page:string)=>{
  await js(cap,`document.querySelector('.capsule-launcher [data-page=${page}]').click()`);
 };
 const selectPosition=async(side:string)=>{
  const result=await js(cap,`window.companion.capsuleLocation(${JSON.stringify(side)})`);
  if(!result.ok)throw Error(result.error);
  await wait(()=>js(cap,`window.companion.status().then(r=>r.value.workspace.location===${JSON.stringify(side)})`));
 };
 const shot=async(w:BrowserWindow,name:string)=>{
  await pause(220);
  await writeEvidence(join(screenshots,name+'.png'),(await w.webContents.capturePage(undefined,{stayAwake:true})).toPNG());
 };
 const resizeForFixture=async(width:number,height:number)=>{
  cap.setBounds({...cap.getBounds(),width,height});
  await pause(120);
 };
 const nativeProbe=(...flags:string[])=>new Promise<any>((resolve,reject)=>{
  const child=spawn('pwsh.exe',['-NoProfile','-NonInteractive','-File',join(process.cwd(),'scripts/test-app-window-edges.ps1'),'-WindowHandle',cap.getNativeWindowHandle().readBigUInt64LE().toString(),'-Owner',String(process.pid),...flags],{windowsHide:true,stdio:'pipe'});
  let output='';
  child.stdout.on('data',data=>output+=data);
  child.stderr.resume();
  child.once('error',reject);
  child.once('exit',code=>{try{if(code!==0)throw Error('Native probe failed');resolve(JSON.parse(output));}catch(error){reject(error);}});
 });
 const capsuleRect=()=>js(cap,"document.querySelector('.compact-capsule').getBoundingClientRect().toJSON()");
 const sameRect=(a:any,b:any)=>['x','y','width','height'].every(key=>Math.abs(a[key]-b[key])<=1);
 const screenRect=async()=>{
  const rect=await capsuleRect(),bounds=cap.getBounds();
  return {...rect,x:rect.x+bounds.x,y:rect.y+bounds.y};
 };
 const fill=async(selector:string,value:string)=>{
  await js(cap,`(()=>{
   const field=document.querySelector(${JSON.stringify(selector)});
   Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field),'value').set.call(field,${JSON.stringify(value)});
   field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));
  })()`);
 };
 cap.webContents.setBackgroundThrottling(false);
 cap.webContents.setAudioMuted(true);
 cap.webContents.on('before-input-event',event=>event.preventDefault());
 cap.webContents.on('before-mouse-event',event=>event.preventDefault());
 await wait(()=>js(cap,"!!document.querySelector('.zen-island-trigger:enabled')"));
 check('capsuleNoAuthority',await js(cap,`window.companion.decide('${randomUUID()}','allow').then(r=>!r.ok)`));
 check('rendererIsolated',await js(cap,"!window.require&&!window.process&&!window.zen"));
 const identity=cap.getNativeWindowHandle().toString('hex');
 let mediaEffects=0;
 const command=media.command.bind(media);
 media.command=(...args:Parameters<CompanionMedia['command']>)=>{mediaEffects++;return command(...args);};
 await nav('settings');
 const originalSettings=await js(cap,"window.companion.status().then(r=>r.value.settings)");
 await js(cap,`window.companion.save(${JSON.stringify({...originalSettings,motion:false,collapseOnBlur:false,dismissCapsuleOnOutsideClick:false,alwaysOnTop:false})})`);
 await compact();

 const regions:unknown[]=[];
 for(const side of ['top','left','right','floating']){
  await selectPosition(side);
  await compact();
  const before=await screenRect();
  check('keyboard-'+side,await js(cap,`(()=>{
   const buttons=[...document.querySelectorAll('.capsule-launcher button')];
   const last=buttons.at(-1);last.focus();
   const key=${JSON.stringify(side==='left'||side==='right'?'ArrowDown':'ArrowRight')};
   last.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
   return document.activeElement===buttons[0]&&!document.querySelector('#capsule-content:not([hidden])');
  })()`));
  await shot(cap,side+'-solo-capsula');
  for(const section of sectionPages){
   await clickSection(section);
   await wait(()=>js(cap,`document.querySelector('.workspace-content:not([hidden])')?.dataset.page===${JSON.stringify(section)}`));
   check('fixedCapsule-'+side+'-'+section,sameRect(before,await screenRect()));
   check('oneNavigation-'+side+'-'+section,await js(cap,"document.querySelectorAll('.capsule-launcher').length===1&&!document.querySelector('.companion-bar,.capsule-media-block,.capsule-single-row')"));
   await clickSection(section);
   if(section!=='settings'){
    check('currentAppStaysOpen-'+side+'-'+section,await js(cap,`window.companion.status().then(r=>r.value.workspace.expanded&&r.value.workspace.page===${JSON.stringify(section)})`));
    await js(cap,"document.querySelector('.zen-island-trigger').click()");
   }
   await wait(()=>js(cap,"!document.querySelector('.workspace-content:not([hidden])')"));
   check('hiddenFocus-'+side+'-'+section,await js(cap,`document.activeElement?.dataset.page===${JSON.stringify(section)}&&document.querySelector('#capsule-content').inert`));
  }
  await nav('home');
  const point=await js(cap,`(()=>{
   const c=document.querySelector('.compact-capsule').getBoundingClientRect(),p=document.querySelector('#capsule-content').getBoundingClientRect();
   const a={x:Math.round(c.x+c.width/2),y:Math.round(c.y+c.height/2)};
   const b={x:Math.round(p.x+p.width/2),y:Math.round(p.y+p.height/2)};
   const gap=${JSON.stringify(side)}==='floating'?{x:Math.round(c.x+1),y:Math.round(c.y+c.height-1)}:
    ${JSON.stringify(side)}==='top'||${JSON.stringify(side)}==='floating'
    ?{x:Math.max(1,Math.round(c.x-8)),y:Math.round(c.y+c.height/2)}
    :{x:Math.round(c.x+c.width/2),y:Math.max(1,Math.round(c.y-8))};
   return {a,b,gap,panel:p.toJSON(),capsule:c.toJSON()};
  })()`);
  const probe=await nativeProbe('-ControlPoints',[point.a,point.b,point.gap].map(p=>p.x+','+p.y).join(';'));
  check('nativeRegion-'+side,probe.hits[0]===1&&probe.hits[1]===1&&probe.hits[2]===-1);
  regions.push({side,probe,point});
  await shot(cap,side+'-capsula-con-contenido');
  await compact();
 }
 report.nativeRegions=regions;
 await js(cap,"document.querySelector('.zen-island-trigger').click()");
 await wait(()=>js(cap,"document.querySelector('#capsule-content')?.hidden===false"));
 await js(cap,"document.querySelector('.zen-island-trigger').click()");
 await wait(()=>js(cap,"document.querySelector('#capsule-content')?.hidden===true"));
 check('emblemDirectToggle',BrowserWindow.getAllWindows().length===1);
 await js(cap,"Promise.all([window.companion.togglePage('home'),window.companion.togglePage('spotify'),window.companion.togglePage('spotify')])");
 await wait(()=>js(cap,"document.querySelector('#capsule-content:not([hidden])')?.dataset.page==='spotify'"));
 check('rapidActionsCoherent',await js(cap,"window.companion.status().then(r=>r.value.workspace.expanded&&r.value.workspace.page==='spotify')"));
 await nav('home');
 check('homeWidgetsAndCodexEditor',await js(cap,`(()=>{
  const home=document.querySelector('#capsule-content[data-page=home]:not([hidden])');
  const editor=home?.querySelector('.codex-request-form textarea#codex-request');
  const widgets=[...home?.querySelectorAll('.home-status-grid button.home-module')??[]];
  const names=widgets.map(widget=>widget.querySelector('strong')?.textContent?.split(' · ')[0]);
  return !!editor?.getClientRects().length&&!!home.querySelector('.home-composer-heading #home-request-destination')&&
    names.join(',')==='Codex,HUB,Sonido'&&widgets.every(widget=>widget.getClientRects().length&&getComputedStyle(widget).borderRadius==='999px');
 })()`));
 await shot(cap,'home-widgets');
 await fill('#codex-request','Borrador conservado al replegar');
 await compact();
 await nav('home');
 check('homeDraftRetained',await js(cap,"document.querySelector('#codex-request').value==='Borrador conservado al replegar'"));
 const beforeRequest=queuedRequests.length;
 await fill('#codex-request','Petición sintética de ZEN.');
 await js(cap,"document.querySelector('.codex-request-form button[type=submit]').click()");
 await wait(async()=>queuedRequests.length===beforeRequest+1);
 check('requestDeliveredOnce',queuedRequests[beforeRequest].text==='Petición sintética de ZEN.'&&queuedRequests[beforeRequest].thread==='native-test');
 await nav('notes');
 const saved=await js(cap,`window.companion.notesChange({type:'save',fields:${JSON.stringify({...newFields('note'),title:'Apunte de continuidad',description:'Descripción sintética'})}})`);
 check('noteSaved',saved.ok);
 await wait(()=>js(cap,"document.querySelector('.knowledge-hub')"));
 await js(cap,"document.querySelector('.hub-sidebar [data-section=all]')?.click()");
 const beforeNotes=await js(cap,"document.querySelector('.knowledge-hub')");
 await compact();
 await nav('notes');
 check('hubStaysMounted',await js(cap,"!!document.querySelector('.knowledge-hub')"));

 await nav('settings');
 await js(cap,"document.querySelector('.preferences-nav [data-category=appearance]').click()");
 await wait(()=>js(cap,"!!document.querySelector('.appearance-settings')"));
 await js(cap,"[...document.querySelectorAll('.appearance-theme button')].find(b=>b.textContent==='Claro').click()");
 await wait(()=>js(cap,"document.querySelector('.appearance-save .primary')&&!document.querySelector('.appearance-save .primary').disabled"));
 await compact();
 await nav('settings');
 check('settingsPendingRetained',await js(cap,"document.querySelector('.appearance-save [data-pending=true]')!==null&&!document.querySelector('.appearance-save .primary').disabled"));
 await js(cap,"document.querySelector('.appearance-save .primary').click()");
 await wait(()=>js(cap,"document.querySelector('.appearance-save [role=status]')?.textContent==='Apariencia guardada.'"));
 await js(cap,"window.companion.pinWindow(true)");
 await selectPosition('right');
 await nav('home');
 check('lockDoesNotForceTopmost',!cap.isAlwaysOnTop());
 check('lockPreventsDrag',await js(cap,"window.companion.moveCapsule('left').then(r=>!r.ok)"));
 check('pinnedActiveSectionStaysOpen',await js(cap,"window.companion.togglePage('home').then(r=>r.ok&&r.value.expanded)"));
 await compact();
 check('pinnedEmblemClosesPanel',await js(cap,`(async()=>{
  const opened=await window.companion.togglePanel();
  const closed=await window.companion.togglePanel();
  return opened.ok&&opened.value.expanded&&closed.ok&&!closed.value.expanded;
 })()`));
 await js(cap,"window.companion.pinWindow(false)");
 await selectPosition('floating');

 observationFixture.playing=true;
 observationFixture.playerAvailable=true;
 await nav('spotify');
 await wait(()=>js(cap,"!!document.querySelector('.music-player')"));
 const effectsBeforeHide=mediaEffects;
 await compact();
 await nav('spotify');
 await wait(()=>js(cap,"!!document.querySelector('.music-player')"));
 check('hidingDoesNotControlMedia',effectsBeforeHide===mediaEffects&&observationFixture.playing);
 await js(cap,"document.querySelector('.music-play').click()");
 await wait(async()=>mediaEffects===effectsBeforeHide+1);
 check('mediaControlsRemainInSound',await js(cap,"!document.querySelector('.compact-capsule .music-play,.compact-capsule .mini-track')"));
 observationFixture.playing=false;
 observationFixture.paused=true;
 await nav('home');
 await wait(()=>js(cap,"document.querySelector('.home-playback-state')?.textContent.includes('En pausa')"));
 check('homeUsesPausedMedia',await js(cap,"document.querySelector('.home-song-title')?.textContent==='Contenido multimedia automático'&&!document.querySelector('.home-playing-bars')"));
 observationFixture.paused=false;

 hub.accept({id:randomUUID(),event:'UserPromptSubmit',session:'native-test',cwd:'C:\\fixture',turn:'capsule-turn'},()=>{});
 hub.accept({id:randomUUID(),event:'PermissionRequest',session:'native-test',cwd:'C:\\fixture',turn:'capsule-turn',tool:'shell',preview:'Synthetic reviewed action'},()=>{});
 await compact();
 await wait(()=>js(cap,"!!document.querySelector('.capsule-launcher [data-page=codex] .permission-badge')"));
 const permission=hub.status().approvals[0];
 check('openingPermissionNeverApproves',!!permission);
 await nav('permissions');
 check('permissionDetailsAccessible',hub.status().approvals.length===1&&await js(cap,"!!document.querySelector('.approval-card')"));
 if(permission)hub.decide(permission.id,'deny');

 const otherChat={session:'other-test',cwd:'C:\\Calendario de prueba',turn:'other-turn'};
 hub.accept({id:randomUUID(),event:'PreToolUse',tool:'mcp__codex_apps__google_calendar__list_events',...otherChat},()=>{});
 hub.setTitle(otherChat.session,'Agenda del mes');
 await js(cap,"window.companion.codexTab('activity')");
 await wait(()=>js(cap,"document.querySelector('.codex-chat-row[data-chat-id=other-test]')"));
 await js(cap,"document.querySelector('.codex-chat-row[data-chat-id=other-test]').click()");
 await wait(()=>js(cap,"document.querySelector('.codex-chat-detail h2')?.textContent==='Agenda del mes'"));
 hub.accept({id:randomUUID(),event:'PreToolUse',session:'native-test',cwd:'C:\\fixture',turn:'capsule-turn',tool:'exec_command'},()=>{});
 check('monitorKeepsSelectionAndLabelsTool',await js(cap,"document.querySelector('.codex-chat-detail h2')?.textContent==='Agenda del mes'&&document.querySelector('.codex-chat-current')?.textContent.includes('Consultar calendario')"));
 await js(cap,"document.querySelector('.codex-monitor-actions button').click()");
 await wait(async()=>openedTargets.at(-1)==='codex://threads/other-test');
 check('monitorOpensSelectedChat',openedTargets.at(-1)==='codex://threads/other-test');
 await shot(cap,'codex-activity');
 const monitorBounds=cap.getBounds();
 await resizeForFixture(590,monitorBounds.height);
 check('monitorCompactPicker',await js(cap,"getComputedStyle(document.querySelector('.codex-chat-toggle')).display==='flex'&&getComputedStyle(document.querySelector('.codex-chat-picker')).display==='none'"));
 await js(cap,"document.querySelector('.codex-chat-toggle').click()");
 check('monitorCompactPickerExpands',await js(cap,"getComputedStyle(document.querySelector('.codex-chat-picker')).display!=='none'"));
 await shot(cap,'codex-activity-compact');
 await resizeForFixture(monitorBounds.width,monitorBounds.height);

 const originalPopup=Menu.prototype.popup;
 let menuLabels:string[]=[];
 Menu.prototype.popup=function(options:any){menuLabels=this.items.map(item=>item.label);options.callback?.();};
 try{await js(cap,"window.companion.capsuleLocationMenu()");}finally{Menu.prototype.popup=originalPopup;}
 check('allSecondaryActionsAccessible',['Minimizar ZEN','Salir de ZEN','Siempre encima','Apariencia y preferencias','Distribución de ventana'].every(name=>menuLabels.includes(name)));

 await nav('home');
 check('monitorCannotOpenOtherChatFromHome',await js(cap,"window.companion.openCodex('other-test').then(result=>!result.ok)"));
 await fill('#codex-request','Minimizar conserva este texto');
 const close=await nativeProbe('-Close');
 await wait(async()=>cap.isMinimized());
 const order=await nativeProbe('-Order');
 check('closeMinimizesNormally',close.posted&&order.minimized&&!order.topmost&&order.owner===0);
 await nativeProbe('-Restore');
 await wait(async()=>!cap.isMinimized());
 check('restoreKeepsDraftAndWindow',cap.getNativeWindowHandle().toString('hex')===identity&&await js(cap,"document.querySelector('#codex-request').value==='Minimizar conserva este texto'"));
 await compact();
 check('privateIpcRequiresVisiblePanel',await js(cap,"Promise.all([window.companion.notesRead(),window.companion.mediaList(),window.companion.contextChoose()]).then(rows=>rows.every(r=>!r.ok))"));
 await nav('calendar');
 await wait(()=>js(cap,"!!document.querySelector('.calendar-workspace')"));
 await js(cap,"window.fixtureCalendar=document.querySelector('.calendar-workspace');document.querySelector('.calendar-day:not([data-other-month=true])')?.click()");
 await wait(()=>js(cap,"document.querySelector('.calendar-day[aria-pressed=true]:not([data-other-month=true])')?.textContent.trim()==='1'&&document.querySelector('.calendar-selected strong').textContent==='1'"));
 await js(cap,"[...document.querySelectorAll('.calendar-agenda button')].find(button=>button.textContent.includes('Crear evento')).click()");
 await wait(()=>js(cap,"!!document.querySelector('.calendar-dialog[open] input')"));
 await fill('.calendar-dialog[open] input:not([type=date],[type=checkbox],[type=time])','Evento local del recorrido');
 await compact();
 await nav('calendar');
 await wait(()=>js(cap,"!!document.querySelector('.calendar-dialog[open]')"));
 check('calendarDraftRetained',await js(cap,"document.querySelector('.calendar-workspace')===window.fixtureCalendar&&document.querySelector('.calendar-dialog[open] input').value==='Evento local del recorrido'"));
 await js(cap,"document.querySelector('.calendar-dialog[open] form').requestSubmit()");
 await wait(()=>js(cap,"!document.querySelector('.calendar-dialog[open]')"));
 await wait(()=>js(cap,"[...document.querySelectorAll('.calendar-event')].some(event=>event.textContent.includes('Evento local del recorrido'))"));
 check('calendarLocalSave',await js(cap,"[...document.querySelectorAll('.calendar-event')].some(event=>event.textContent.includes('Evento local del recorrido')&&event.textContent.includes('Solo en ZEN'))"));
 await shot(cap,'calendar-local-and-month');
 await compact();await nav('calendar');
 check('calendarRetainsSelection',await js(cap,"document.querySelector('.calendar-selected strong').textContent===String(Number(document.querySelector('.calendar-day[aria-pressed=true]').textContent))"));
 const selectedDate=await js(cap,"localStorage.getItem('zen-calendar-selected')"),days=calendarGrid(selectedDate);
 const interval={start:days[0],end:addCalendarDays(days[41],1),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone};
 const source={accountId:'calendar-fixture-account',id:'calendar-fixture',name:'Calendario de prueba',writable:true};
 await calendar.refresh(interval,[sourceKey(source)]);
 const query=calendar.snapshot().operations.filter(item=>item.type==='events'&&item.status==='waiting'&&JSON.stringify(item.range)===JSON.stringify(interval)).at(-1)!;
 calendar.observe('native-test','C:\\fixture',`<zen_calendar id="${query.id}">${JSON.stringify({version:1,type:'events',range:interval,sources:[source],
  coverage:[{accountId:source.accountId,calendarId:source.id,complete:true}],events:[]})}</zen_calendar>`);
 await wait(()=>js(cap,"document.querySelector('.calendar-sources')?.textContent.includes('Calendario de prueba')"));
 await js(cap,"document.querySelector('.calendar-agenda header button').click()");
 await wait(()=>js(cap,"!!document.querySelector('.calendar-dialog[open] input')"));
 await fill('.calendar-dialog[open] input:not([type=date],[type=checkbox],[type=time])','Copia local tras petición externa');
 await fill('.calendar-dialog[open] select',sourceKey(source));
 await js(cap,"document.querySelector('.calendar-dialog[open] form').requestSubmit()");
 await wait(async()=>calendar.snapshot().operations.some(item=>item.type==='created'));
 await wait(()=>js(cap,"document.querySelector('.calendar-dialog[open] button[type=submit]')?.disabled&&document.querySelector('.calendar-dialog[open] fieldset')?.disabled"));
 const remoteRequests=queuedRequests.length;
 await js(cap,"document.querySelector('.calendar-dialog[open] form').requestSubmit()");
 await compact();await nav('calendar');
 check('calendarPendingRemoteRetained',await js(cap,"document.querySelector('.calendar-dialog[open] button[type=submit]')?.disabled&&document.querySelector('.calendar-dialog[open] input').value==='Copia local tras petición externa'"));
 await fill('.calendar-dialog[open] select','local');
 await wait(()=>js(cap,"document.querySelector('.calendar-dialog[open] button[type=submit]')?.disabled===false"));
 await js(cap,"document.querySelector('.calendar-dialog[open] form').requestSubmit()");
 await wait(()=>js(cap,"!document.querySelector('.calendar-dialog[open]')"));
 await wait(()=>js(cap,"[...document.querySelectorAll('.calendar-event')].some(event=>event.textContent.includes('Copia local tras petición externa')&&event.textContent.includes('Solo en ZEN'))"));
 check('calendarExplicitLocalFallback',queuedRequests.length===remoteRequests&&calendar.snapshot().operations.some(item=>item.type==='created'));
 await nav('home');
 await fill('#codex-request','');
 Object.assign(report,await smokeTemplates({cap,js,wait,nav,shot,resize:resizeForFixture,selectPosition,profile,copiedText}));
 Object.assign(report,await smokeAppearance({cap,js,wait,nav,shot,selectPosition,compact,resize:resizeForFixture}));
 check('noDuplicateWindow',BrowserWindow.getAllWindows().length===1);
 check('noOldBarAtAnyEntry',await js(cap,"!document.querySelector('.companion-bar,.capsule-single-row')"));
 const savedState=JSON.parse(readFileSync(join(profile,'companion-workspace-window.json'),'utf8'));
 check('presentationSavedWithPage',savedState.page&&['workspace','capsule'].includes(savedState.mode));
 await writeEvidence(join(evidenceDirectory,'companion-native.json'),JSON.stringify({...report,passed:true},null,2));
 return {...report,passed:true};
}
