import {app,screen,BrowserWindow,Menu,safeStorage} from 'electron';
import type {CompanionHub} from './companion-hub';
import type {CompanionIntegration} from './companion-integration';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
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
import {calendarDateInZone,calendarGrid,addCalendarDays,sourceKey} from '../shared/companion-calendar';
import type {createSmokeOura} from './companion-smoke-oura';
import {emptyOuraCache} from '../shared/companion-oura';
import {nativeHelper} from './native-helper';
import {PasswordVault} from './password-vault';
export async function companionSmoke({cap,hub,integration,calendar,profile,openedTargets,activateNotice,copiedRequests,queuedRequests,copiedText,media,ouraFixture,observationFixture,dismissOnOutsideClick,toggleSimpleMode,enableAutomaticPermissionReview}:{cap:BrowserWindow;hub:CompanionHub;integration:CompanionIntegration;calendar:CompanionCalendar;profile:string;openedTargets:string[];activateNotice:(n:CompanionNotice)=>Promise<void>;copiedRequests:string[];queuedRequests:{thread:string;text:string}[];copiedText:string[];media:CompanionMedia;ouraFixture:ReturnType<typeof createSmokeOura>;observationFixture:SmokeMediaState;dismissOnOutsideClick:()=>void;toggleSimpleMode:()=>void;enableAutomaticPermissionReview:()=>void}){

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
 const inSimpleMode=()=>js(cap,"!!document.querySelector('#capsule-content[data-simple-mode]:not([hidden])')");
 const changeSimpleMode=async(enabled:boolean)=>{toggleSimpleMode();await wait(async()=>await inSimpleMode()===enabled);};
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
  check('capsuleMenuOrder-'+side,await js(cap,`(()=>{
   const buttons=[...document.querySelectorAll('.capsule-launcher button')];
   return buttons.map(button=>button.dataset.hoverApp).join(',')===${JSON.stringify(sectionPages.join(','))}&&
    buttons.map(button=>button.getAttribute('aria-label')).join(',')==='Home,HUB,Calendario,Métricas,Volumen,Officina,Configuración';
  })()`));
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
   check('currentAppStaysOpen-'+side+'-'+section,await js(cap,`window.companion.status().then(r=>r.value.workspace.expanded&&r.value.workspace.page===${JSON.stringify(section)})`));
   await js(cap,"document.querySelector('.zen-island-trigger').click()");
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
 check('homeShowsLocalDate',await js(cap,`(()=>{
  const time=document.querySelector('.home-date time');
  const now=new Date(), part=value=>String(value).padStart(2,'0');
  const localDay=[now.getFullYear(),part(now.getMonth()+1),part(now.getDate())].join('-');
  const label=new Intl.DateTimeFormat('es',{dateStyle:'full'}).format(now);
  return time?.getClientRects().length&&time.dateTime===localDay&&time.textContent===label;
 })()`));
 await wait(()=>js(cap,"!!document.querySelector('.home-weather > button')"));
 check('weatherDefaultsToDublin',await js(cap,"document.querySelector('.home-weather-heading p')?.textContent==='Dublín'"));
 await js(cap,"document.querySelector('.home-weather > button').click()");
 const weatherKey='1'.repeat(32);
 await fill('.home-weather-settings input[type=password]',weatherKey);
 await js(cap,"document.querySelector('.home-weather-settings button[type=submit]').click()");
 await wait(()=>js(cap,"document.querySelector('.home-weather-rain')?.textContent.includes('78 %')&&document.querySelector('.home-weather-footer img').naturalWidth>0"));
 check('weatherHomeForecast',await js(cap,"document.querySelector('.home-weather-current strong')?.textContent==='9°C'&&document.querySelector('.home-weather-range')?.textContent.includes('11°')&&document.querySelector('.home-weather-range')?.textContent.includes('6°')&&document.querySelector('.home-weather-footer img').naturalWidth>0"));
 check('weatherKeyEncryptedAndPrivate',!readFileSync(join(profile,'companion-weather.bin')).includes(weatherKey)&&
  await js(cap,`window.companion.weather({type:'refresh'}).then(result=>result.ok&&!JSON.stringify(result.value).includes(${JSON.stringify(weatherKey)}))`));
 await shot(cap,'home-clima-dublin');
 await js(cap,"document.querySelector('.home-weather [aria-label=\"Configurar clima\"]').click()");
 await fill('.home-weather-settings input:not([type=password])','Madrid, ES');
 await js(cap,"document.querySelector('.home-weather-settings button[type=submit]').click()");
 await wait(()=>js(cap,"document.querySelector('.home-weather-heading p')?.textContent==='Madrid · ES'"));
 check('weatherLocationCanChange',await js(cap,"document.querySelector('.home-weather-rain')?.textContent==='Sin lluvia prevista'&&document.querySelector('.home-weather-range')?.textContent.includes('25°')"));
 check('homeSummaryAboveComposer',await js(cap,`(()=>{
  const home=document.querySelector('.home-status');
  const request=home.querySelector('.codex-request-form');
  return !!request?.getClientRects().length&&home.lastElementChild.contains(request)&&
   !!home.querySelector('.home-weather')&&!!home.querySelector('.home-date')&&!!home.querySelector('.home-sleep')&&
   !home.querySelector('.home-continue,.home-notices,#home-notes-title,#home-activity-title');
 })()`));
 await shot(cap,'home-widgets');
 await js(cap,"document.querySelector('.home-status-grid button.home-module').click()");
 await wait(()=>js(cap,"document.querySelector('#capsule-content:not([hidden])')?.dataset.page==='codex'"));
 check('codexStillOpensFromHome',true);
 check('weatherRestrictedToHome',await js(cap,"window.companion.weather({type:'refresh',force:true}).then(result=>!result.ok&&!document.querySelector('.home-weather'))"));
 await nav('home');
 await js(cap,"document.querySelector('.home-date').click()");
 await wait(()=>js(cap,"document.querySelector('#capsule-content:not([hidden])')?.dataset.page==='calendar'"));
 check('homeDateOpensCalendar',true);
 await nav('home');
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
 await wait(()=>js(cap,"!!document.querySelector('.hub-library')"));
 check('hubSimplifiedNavigation',await js(cap,`(()=>{
  const nav=document.querySelector('.hub-sidebar nav');
  const labels=[...nav?.querySelectorAll('h2,button')??[]].map(item=>item.textContent.trim());
  return labels.join('|')==='Espacio de trabajo|Biblioteca de prompts|Contraseñas|Templates|Descubrimiento de apps|Traductor|Sistema|Configuración|Respaldo y exportación|Bloc personal|Apuntes|Pizarra'&&
   nav.querySelector('[aria-current=page]')?.textContent.trim()==='Biblioteca de prompts';
 })()`));
 const noteFolder=await js(cap,"window.companion.notesChange({type:'folder',name:'AI ENGINER',group:'folder'})");
 check('noteFolderSaved',noteFolder.ok&&noteFolder.value.id);
 const saved=await js(cap,`window.companion.notesChange({type:'save',fields:${JSON.stringify({...newFields('note',noteFolder.value.id),title:'Apunte de continuidad',description:'Descripción sintética'})}})`);
 check('noteSaved',saved.ok&&saved.value.id);
 await nav('home');
 await js(cap,"document.querySelector('.home-status-grid [data-home-card=notes]').click()");
 await wait(()=>js(cap,"!!document.querySelector('#capsule-content[data-page=notes]:not([hidden]) .hub-search-launch:enabled')"));
 await js(cap,"document.querySelector('.hub-search-launch').click()");
 const standaloneNote="document.querySelector('.hub-library[data-entry=true] .notes-editor-heading h2')?.textContent==='Apunte de continuidad'&&!document.querySelector('.hub-items')";
 await wait(()=>js(cap,"!!document.querySelector('.hub-search[open] input')"));
 await fill('.hub-search input','AI ENGINER');
 await wait(()=>js(cap,"document.querySelector('.hub-search .hub-results strong')?.textContent==='Apunte de continuidad'"));
 await js(cap,"document.querySelector('.hub-search .hub-results button').click()");
 await wait(()=>js(cap,standaloneNote));
 await js(cap,"document.querySelector('.hub-reader-back').click()");
 await wait(()=>js(cap,"document.querySelector('#notes-title')?.textContent==='Biblioteca de prompts'"));
 check('hubSearchFindsExistingNoteFolders',true);
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

 await nav('spotify');
 await wait(()=>js(cap,"document.querySelector('#system-volume:enabled')?.value==='42'"));
 check('systemVolumeWithoutPlayback',await js(cap,"!!document.querySelector('.music-empty')&&document.querySelector('#system-volume').max==='100'"));
 cap.focus();
 await fill('#system-volume','68');
 await wait(async()=>observationFixture.systemLevel===68);
 check('systemVolumeSliderSendsLevel',observationFixture.systemVolumeWrites.length===1&&observationFixture.systemVolumeWrites[0]===68);
 observationFixture.systemLevel=24;
 observationFixture.systemMuted=true;
 await wait(()=>js(cap,"document.querySelector('#system-volume')?.value==='24'&&document.querySelector('#system-volume-status')?.textContent==='Silenciado en Windows'"));
 check('systemVolumeReflectsWindows',observationFixture.systemVolumeWrites.length===1);
 await nav('home');
 check('systemVolumeRestrictedToSound',await js(cap,`window.companion.systemVolume({type:'set',endpoint:${JSON.stringify(observationFixture.systemOutput)},level:19}).then(result=>!result.ok&&!document.querySelector('#system-volume'))`));
 observationFixture.systemMuted=false;

 observationFixture.playing=true;
 observationFixture.playerAvailable=true;
 await nav('spotify');
 await wait(()=>js(cap,"!!document.querySelector('.music-player')"));
 await changeSimpleMode(true);
 await shot(cap,'simple-mode-sound');
 const simpleSound=await js(cap,`(()=>{
  const panel=document.querySelector('#capsule-content').getBoundingClientRect();
  const slider=document.querySelector('#system-volume');
  const playback=document.querySelector('.music-play');
  return {height:panel.height,bottom:panel.bottom,slider:slider?.getBoundingClientRect().bottom,playback:playback?.getBoundingClientRect().bottom};
 })()`);
 if(simpleSound.height>261||!(simpleSound.slider<=simpleSound.bottom)||!(simpleSound.playback<=simpleSound.bottom))throw Error('Sonido compacto: '+JSON.stringify(simpleSound));
 check('simpleModeSound',true);
 await changeSimpleMode(false);
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

 await integration.install(); // This integration and its Codex home are inside the smoke profile.
 const relay=(name:string,cmd:string,chat={session:'native-test',cwd:'C:\\fixture',turn:'capsule-turn'})=>new Promise<any>((resolve,reject)=>{
  const child=spawn(integration.executable,['--zen-companion'],{windowsHide:true,stdio:'pipe'});
  let output='';
  child.stdout.on('data',data=>output+=data);
  child.stderr.resume();child.stdin.on('error',reject);child.once('error',reject);
  child.once('close',code=>{try{if(code!==0)throw Error('Synthetic hook failed');resolve(JSON.parse(output));}catch(error){reject(error);}});
  child.stdin.end(JSON.stringify({hook_event_name:name,session_id:chat.session,cwd:chat.cwd,turn_id:chat.turn,tool_name:'functions.exec_command',tool_input:{cmd}}));
 });
 hub.accept({id:randomUUID(),event:'UserPromptSubmit',session:'native-test',cwd:'C:\\fixture',turn:'capsule-turn'},()=>{});
 await relay('PreToolUse','git status --short');
 await compact();
 const decision=relay('PermissionRequest','npm test -- --run');
 void decision.catch(()=>{});
 await wait(()=>js(cap,"!!document.querySelector('.capsule-launcher [data-page=home] .permission-badge')"));
 const permission=hub.status().approvals[0];
 check('openingPermissionNeverApproves',!!permission);
 check('permissionBlockedOnIsland',await js(cap,`window.companion.decide(${JSON.stringify(permission.id)},'allow').then(r=>!r.ok)`));
 await nav('codex');
 await wait(()=>js(cap,"document.querySelector('.approval-card')?.textContent.includes('npm test -- --run')"));
 check('permissionDetailsAccessible',hub.status().approvals.length===1&&await js(cap,"!document.querySelector('.codex-page [role=tablist]')"));
 check('monitorCommandVisibleWithoutExpansion',await js(cap,"document.querySelector('.codex-command-line')?.textContent==='git status --short'"));
 await compact();
 const approvalAnchor=await screenRect();
 const approvalSignal="document.querySelector('.zen-island-trigger[data-phase=attention]')";
 check('capsulePermissionSignal',await js(cap,`${approvalSignal}?.getAttribute('aria-label').includes('Revisar permisos de Codex')&&!document.querySelector('.approval-card')`));
 await js(cap,`${approvalSignal}.click()`);
 await wait(()=>js(cap,"document.querySelector('.codex-review .approval-card pre')?.textContent==='npm test -- --run'"));
 check('capsuleOpensFocusedPermissionReview',hub.status().approvals.length===1&&await js(cap,"document.querySelector('.codex-page[data-reviewing=true] h1').textContent==='Aprobar comando de Codex'&&!document.querySelector('.codex-chat-timeline')"));
 const approvalGeometry=await js(cap,"window.companion.status().then(r=>r.value.workspace.geometry.panel)");
 check('capsulePermissionPanelIsCompact',approvalGeometry.width===350&&approvalGeometry.height===238&&!await inSimpleMode()&&sameRect(await screenRect(),approvalAnchor));
 check('approvalShowsSingleSurface',await js(cap,`(()=>{
  const surface=document.querySelector('.workspace-surface[data-review=true]');
  const review=surface.querySelector('.codex-page');
  const buttonRows=[...review.querySelectorAll('.actions button')].map(button=>button.getBoundingClientRect().top);
  return !surface.querySelector('.workspace-neon-border')&&review.querySelectorAll('h1').length===1&&
   review.querySelector('.codex-review-heading button').ariaLabel==='Cerrar revisión'&&
   !review.querySelector('.codex-review-details').open&&!review.querySelector('.codex-review-deadline')&&
   buttonRows.length===3&&buttonRows.every(row=>Math.abs(row-buttonRows[0])<1);
 })()`));
 await shot(cap,'codex-permission');
 await js(cap,"document.querySelector('.codex-review-heading button[aria-label=\"Cerrar revisión\"]').click()");
 await wait(()=>js(cap,"document.querySelector('#capsule-content').hidden"));
 check('capsuleClosingReviewKeepsPermissionPending',hub.status().approvals.length===1);
 await js(cap,`${approvalSignal}.click()`);
 await wait(()=>js(cap,"document.querySelector('.codex-review .approval-card pre')?.textContent==='npm test -- --run'"));
 await js(cap,"Array.from(document.querySelectorAll('.approval-card button')).find(button=>button.textContent==='Rechazar').click()");
 check('denialReturnsOnceToNativeHook',(await decision).hookSpecificOutput?.decision?.behavior==='deny'&&hub.status().approvals.length===0);

 const granted=relay('PermissionRequest','git status --short');
 void granted.catch(()=>{});
 await nav('home');
 const beforePermission=cap.getBounds();
 await wait(()=>js(cap,`${approvalSignal}?.getAttribute('aria-label').includes('Revisar permisos de Codex')`));
 const singleApproval=hub.status().approvals[0];
 await js(cap,`${approvalSignal}.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`);
 await wait(()=>js(cap,"document.querySelector('.codex-review .approval-card pre')?.textContent==='git status --short'"));
 check('capsuleKeyboardPermissionReview',await js(cap,"document.activeElement?.id==='capsule-content'"));
 check('capsuleReviewNeverApprovesAutomatically',hub.status().approvals.length===1);
 await js(cap,"document.querySelector('.codex-review .approval-card .actions .primary').click()");
 check('capsuleApprovalReturnsOnceToNativeHook',(await granted).hookSpecificOutput?.decision?.behavior==='allow'&&hub.status().approvals.length===0&&
  await js(cap,`window.companion.decide(${JSON.stringify(singleApproval.id)},'allow').then(r=>!r.ok)`));
 await nav('home');
 check('capsuleRestoresWorkspaceAfterPermission',sameRect(cap.getBounds(),beforePermission));

 const otherChat={session:'other-test',cwd:'C:\\Calendario de prueba',turn:'other-turn'};
 hub.accept({id:randomUUID(),event:'PreToolUse',tool:'mcp__codex_apps__google_calendar__list_events',...otherChat},()=>{});
 hub.setTitle(otherChat.session,'Agenda del mes');
 await nav('codex');
 await wait(()=>js(cap,"document.querySelector('.codex-chat-row[data-chat-id=other-test]')"));
 await js(cap,"document.querySelector('.codex-chat-row[data-chat-id=other-test]').click()");
 await wait(()=>js(cap,"document.querySelector('.codex-chat-detail h2')?.textContent==='Agenda del mes'"));
 hub.accept({id:randomUUID(),event:'PreToolUse',session:'native-test',cwd:'C:\\fixture',turn:'capsule-turn',tool:'exec_command'},()=>{});
 check('monitorKeepsSelectionAndLabelsTool',await js(cap,"document.querySelector('.codex-chat-detail h2')?.textContent==='Agenda del mes'&&document.querySelector('.codex-chat-current')?.textContent.includes('Consultar calendario')"));
 await js(cap,"document.querySelector('.codex-monitor-actions button').click()");
 await wait(async()=>openedTargets.at(-1)==='codex://threads/other-test');
 check('monitorOpensSelectedChat',openedTargets.at(-1)==='codex://threads/other-test');
 hub.accept({id:randomUUID(),event:'PermissionRequest',tool:'shell',preview:'Contenido privado de otro chat',...otherChat},()=>{});
 await wait(()=>js(cap,"document.querySelector('.codex-monitor-actions button')?.textContent.includes('Revisar permiso en Codex')"));
 check('foreignPermissionIsVisibleWithoutArguments',await js(cap,"!!document.querySelector('.permission-badge')&&!document.querySelector('.approval-card')&&!document.querySelector('.codex-page').textContent.includes('Contenido privado de otro chat')"));
 const notice=hub.status().notices.find(item=>item.kind==='permission'&&item.session===otherChat.session)!;
 await activateNotice(notice);
 check('foreignPermissionNoticeOpensExactChat',openedTargets.at(-1)==='codex://threads/other-test');
 await js(cap,`${approvalSignal}.click()`);
 await wait(()=>js(cap,"document.querySelector('.codex-review-external button')"));
 check('capsuleReviewKeepsOtherChatsInCodex',await js(cap,"!document.querySelector('.approval-card')&&!document.querySelector('.codex-page').textContent.includes('Contenido privado de otro chat')"));
 const beforeExternalReview=openedTargets.length;
 await js(cap,"document.querySelector('.codex-review-external button').click()");
 await wait(async()=>openedTargets.length===beforeExternalReview+1);
 check('capsuleReviewOpensExactForeignChat',openedTargets.at(-1)==='codex://threads/other-test');
 await nav('codex');
 hub.accept({id:randomUUID(),event:'PostToolUse',tool:'shell',...otherChat},()=>{});
 hub.accept({id:randomUUID(),event:'UserPromptSubmit',...otherChat},()=>{});
 hub.setTitle(otherChat.session,'[https://example.com/repo](https://example.com/repo) Agenda del mes');
 const otherDecision=relay('PermissionRequest','git status --branch',otherChat);
 void otherDecision.catch(()=>{});
 await wait(async()=>hub.status().approvals.some(item=>item.session===otherChat.session));
 const otherApproval=hub.status().approvals.find(item=>item.session===otherChat.session)!;
 check('capsuleObservedCommandRequiresExplicitReview',await js(cap,`window.companion.status().then(async r=>
  !r.value.approvals.find(item=>item.id===${JSON.stringify(otherApproval.id)})?.preview&&
  !(await window.companion.decide(${JSON.stringify(otherApproval.id)},'allow')).ok)`));
 await js(cap,`${approvalSignal}.click()`);
 await wait(()=>js(cap,"document.querySelector('.codex-review .approval-card pre')?.textContent==='git status --branch'"));
 check('capsulePermissionTitleCleansRepeatedLink',await js(cap,"document.querySelector('.codex-review-chat').textContent==='Agenda del mes'"));
 await js(cap,"document.querySelector('.codex-review .approval-card .actions .primary').click()");
 check('capsuleDecidesForVerifiedOtherChat',(await otherDecision).hookSpecificOutput?.decision?.behavior==='allow');
 const handoff=relay('PermissionRequest','git diff --stat',otherChat);
 void handoff.catch(()=>{});
 await wait(()=>js(cap,"document.querySelector('.codex-review .approval-card pre')?.textContent==='git diff --stat'"));
 const beforeHandoff=openedTargets.length;
 await js(cap,"document.querySelector('.codex-review-handoff').click()");
 await wait(async()=>openedTargets.length===beforeHandoff+1);
 check('capsuleHandsOffWithoutDeciding',!(await handoff).hookSpecificOutput&&openedTargets.at(-1)==='codex://threads/other-test');
 hub.setTitle(otherChat.session,'Agenda del mes');
 await nav('codex');
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
 Menu.prototype.popup=function(options:any){
  menuLabels=this.items.map(item=>item.label);
  const notices=this.items.find(item=>item.label==='Ver avisos'&&item.enabled);
  notices?.click(notices,cap,{} as Electron.KeyboardEvent);
  options.callback?.();
 };
 try{await js(cap,"window.companion.capsuleLocationMenu()");}finally{Menu.prototype.popup=originalPopup;}
 check('allSecondaryActionsAccessible',['Minimizar ZEN','Salir de ZEN','Siempre encima','Apariencia y preferencias','Distribución de ventana','Ver avisos'].every(name=>menuLabels.includes(name)));
 await wait(()=>js(cap,"!!document.querySelector('#capsule-content[data-page=notices]:not([hidden]) .notice-tools')"));
 check('noticesAccessibleFromCapsuleMenu',true);

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
 const restoreFixtureEvents=calendar.restoreLocal({version:1,events:[]});
 try {
  await wait(()=>js(cap,"document.querySelector('.calendar-next p')?.textContent.includes('Sin eventos próximos')"));
  const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const upcomingDay=addCalendarDays(calendarDateInZone(new Date(),timeZone),1);
  await calendar.create({id:randomUUID(),title:'Próximo evento de prueba',date:upcomingDay,endDate:upcomingDay,
   start:'09:00',end:'10:00',allDay:true,timeZone,destination:'local',description:'',location:''});
  await wait(()=>js(cap,"document.querySelector('.calendar-next-link')?.textContent.includes('Próximo evento de prueba')"));
  check('calendarUpcomingAllDay',await js(cap,"document.querySelector('.calendar-next-link')?.textContent.includes('Todo el día')"));
  await resizeForFixture(940,850);
  await shot(cap,'calendar-next-event');
  await js(cap,"document.querySelector('.calendar-next-link').click()");
  await wait(()=>js(cap,`localStorage.getItem('zen-calendar-selected')===${JSON.stringify(upcomingDay)}`));
  check('calendarUpcomingOpensDay',await js(cap,"document.querySelector('.calendar-agenda .calendar-event')?.textContent.includes('Próximo evento de prueba')"));
  await changeSimpleMode(true);
  await shot(cap,'simple-mode-calendar');
  check('simpleModeCalendarAgenda',await js(cap,`(()=>{
   const event=document.querySelector('.calendar-agenda .calendar-event')?.getBoundingClientRect();
   const panel=document.querySelector('#capsule-content').getBoundingClientRect();
   return event?.bottom<=panel.bottom&&document.querySelector('.calendar-month-picker')?.open===false&&!!document.querySelector('[aria-label="Día siguiente"]');
  })()`));
  await js(cap,"document.querySelector('.calendar-month-picker summary').click()");
  check('simpleModeCalendarMonth',await js(cap,"!!document.querySelector('.calendar-grid')?.getClientRects().length&&!!document.querySelector('[aria-label=\"Mes siguiente\"]')"));
  await changeSimpleMode(false);
 } finally {restoreFixtureEvents();}
 await nav('metrics');
 await wait(()=>js(cap,"document.querySelector('#oura-client-id')"));
 const metricsToday=await js(cap,"window.companion.status().then(r=>r.value.oura.today)");
 const recentNight=addCalendarDays(metricsToday,-1);
 const connectOura=()=>js(cap,"window.companion.oura({type:'connect',clientId:'test-oura-app'})");
 ouraFixture.state.authorizationError='Oura no concedió el acceso. Aviso de prueba.';
 await connectOura();
 await compact();
 await clickSection('metrics');
 await wait(()=>js(cap,"document.querySelector('.oura-message')?.textContent.includes('Aviso de prueba.')"));
 check('ouraAuthorizationErrorSurvivesReopen',await js(cap,"document.querySelector('#oura-client-id')?.value==='test-oura-app'"));
 ouraFixture.state.authorizationError='';
 await connectOura();
 await wait(()=>js(cap,`document.querySelector('[data-oura-card=sleep]')?.dataset.day===${JSON.stringify(recentNight)}`));
 check('ouraCachedMorningAndTodayActivity',await js(cap,`document.querySelector('[data-oura-card=sleep]').dataset.day===${JSON.stringify(recentNight)}&&document.querySelector('[data-oura-card=activity]').dataset.day===${JSON.stringify(metricsToday)}`));
 await changeSimpleMode(true);
 check('simpleModeMetricsToday',await js(cap,"document.querySelectorAll('.oura-card').length===3&&!document.querySelector('.oura-simple-history').open&&document.querySelector('.oura-pending').textContent.includes('pendiente')"));
 await shot(cap,'simple-mode-metrics');
 await js(cap,"document.querySelector('[data-oura-card=activity]').click()");
 await wait(()=>js(cap,"document.querySelector('.oura-simple-history[open] .oura-week[data-metric=activity]')"));
 check('simpleModeMetricsHistory',true);
 await changeSimpleMode(false);
 await nav('home');
 await wait(()=>js(cap,"document.querySelector('.home-sleep')?.textContent.includes('Anoche pendiente de sincronizar')"));
 check('homeSleepDatesPreviousNight',await js(cap,`document.querySelector('.home-sleep time')?.dateTime===${JSON.stringify(recentNight)}&&document.querySelector('.home-sleep')?.textContent.includes('7 h 0 min')`));
 const openMetricsFromHome=()=>js(cap,"document.querySelector('.home-sleep button').click()");
 await openMetricsFromHome();
 await wait(()=>js(cap,"document.querySelector('#capsule-content:not([hidden])')?.dataset.page==='metrics'"));
 await js(cap,"window.companion.oura({type:'capsule',mode:'sleep'})");
 await compact();
 await wait(()=>js(cap,"document.querySelector('[data-page=metrics] .oura-glance')?.textContent.includes('7h00')"));
 ouraFixture.state.synced=true;
 await wait(()=>js(cap,"document.querySelector('[data-page=metrics] .oura-glance')?.textContent.includes('7h32')"));
 check('ouraAutoUpdatesCompactFromPoll',ouraFixture.state.requests.filter(row=>row==='sleep').length>=2);
 check('ouraPrivateCacheHiddenOnIsland',await js(cap,"window.companion.status().then(r=>r.value.oura===undefined&&r.value.ouraGlance.seconds===27120)"));
 const requestsBeforeOuraNav=ouraFixture.state.requests.length;
 await clickSection('metrics');
 await wait(()=>js(cap,"document.querySelector('[data-oura-card=sleep]')?.textContent.includes('7 h 32 min')"));
 check('ouraChartSevenUniqueDays',await js(cap,`document.querySelectorAll('.oura-week tbody tr').length===7&&document.querySelectorAll('.oura-week [data-day="${metricsToday}"]').length===1&&document.querySelectorAll('.oura-week [data-missing=true]').length>0`));
 await js(cap,"document.querySelector('[data-oura-card=activity]').click()");
 check('ouraChartsAndNavigationReadCache',ouraFixture.state.requests.length===requestsBeforeOuraNav&&await js(cap,"document.querySelector('.oura-week').dataset.metric==='activity'"));
 await shot(cap,'metrics-oura-fixture');
 await nav('home');
 await wait(()=>js(cap,"document.querySelector('.home-sleep')?.textContent.includes('7 h 32 min')"));
 check('homeSleepUsesOnlySummary',await js(cap,"window.companion.status().then(r=>r.value.oura===undefined&&r.value.ouraGlance===undefined&&r.value.ouraHomeSleep.latest.score===88)"));
 await shot(cap,'home-sleep-fixture');
 const sleepBounds=cap.getBounds();
 await resizeForFixture(470,sleepBounds.height);
 check('weatherFitsNarrow',await js(cap,`(()=>{const card=document.querySelector('.home-weather');return card.clientWidth>=card.scrollWidth-1&&!!card.querySelector('.home-weather-outlook')?.getClientRects().length;})()`));
 check('homeDateFitsNarrow',await js(cap,`(()=>{const card=document.querySelector('.home-date'),sleep=document.querySelector('.home-sleep');return card.clientWidth>=card.scrollWidth-1&&card.getBoundingClientRect().bottom<=sleep.getBoundingClientRect().top;})()`));
 check('homeSleepFitsNarrow',await js(cap,`(()=>{const card=document.querySelector('.home-sleep'),button=card.querySelector('button');return card.clientWidth>=card.scrollWidth-1&&button.getBoundingClientRect().right<=card.getBoundingClientRect().right;})()`));
 await resizeForFixture(sleepBounds.width,sleepBounds.height);
 await openMetricsFromHome();
 await wait(()=>js(cap,"document.querySelector('#capsule-content:not([hidden])')?.dataset.page==='metrics'"));
 check('homeSleepOpensMetricsWithoutFetching',ouraFixture.state.requests.length===requestsBeforeOuraNav&&await js(cap,"window.companion.status().then(r=>r.value.oura?.state==='connected'&&r.value.ouraHomeSleep===undefined)"));
 await js(cap,"window.companion.oura({type:'disconnect'})");
 await wait(()=>js(cap,"document.querySelector('#oura-client-id')?.value==='test-oura-app'"));
 const disconnectedOura=JSON.parse(safeStorage.decryptString(readFileSync(join(profile,'companion-oura.bin'))));
 check('ouraDisconnectClearsProtectedSession',disconnectedOura.token===undefined&&JSON.stringify(disconnectedOura.cache)===JSON.stringify(emptyOuraCache()));
 check('ouraDisconnectRemembersClientId',disconnectedOura.clientId==='test-oura-app');

 await nav('home');
 await fill('#codex-request','');
 Object.assign(report,await smokeTemplates({cap,js,wait,nav,shot,resize:resizeForFixture,selectPosition,profile,copiedText}));
 await fill('#codex-request','Borrador habitual de prueba');
 await nav('notes');
 const clickLabel=(root:string,label:string)=>js(cap,`(()=>{
  const button=Array.from(document.querySelectorAll(${JSON.stringify(root+' button')})).find(item=>item.textContent.trim()===${JSON.stringify(label)});
  if(!button||button.disabled)throw Error('Acción del HUB no disponible: '+${JSON.stringify(label)});
  button.click();
 })()`);
 const boardFixture={version:1,width:5,color:'ink',strokes:[
  {tool:'brush',width:12,color:'blue',points:[[192,320],[768,320]]},
  {tool:'eraser',points:[[480,256],[480,384]]},
 ]};
 const whiteboardSeed=await js(cap,`window.companion.whiteboard({type:'save',value:${JSON.stringify(boardFixture)}})`);
 if(!whiteboardSeed.ok)throw Error('No se pudo preparar la pizarra de prueba.');
 const hubSections=[
  ['Biblioteca de prompts','.hub-library'],
  ['Apuntes','.hub-quick-notes'],
  ['Pizarra','.hub-whiteboard'],
  ['Contraseñas','.password-vault'],
  ['Templates','.templates-view'],
  ['Descubrimiento de apps','.discovery-workspace'],
  ['Traductor','.translator-workspace'],
 ];
 const sidebarSettings=await js(cap,"window.companion.status().then(result=>result.value.settings)");
 await nav('settings');
 if(!(await js(cap,`window.companion.save(${JSON.stringify({...sidebarSettings,motion:true})})`)).ok)throw Error('No se pudo habilitar el movimiento de prueba.');
 await nav('notes');
 await wait(()=>js(cap,"document.querySelector('.companion-capsule')?.dataset.motion==='true'"));
 await clickLabel('.hub-sidebar','Biblioteca de prompts');
 await wait(()=>js(cap,"document.querySelector('#notes-title')?.textContent==='Biblioteca de prompts'"));
 await clickLabel('.hub-sidebar','Apuntes');
 await wait(()=>js(cap,"document.querySelector('.hub-main[data-cube-direction=bottom]')&&document.querySelector('#notes-title')?.textContent==='Apuntes'"));
 await clickLabel('.hub-sidebar','Biblioteca de prompts');
 await wait(()=>js(cap,"document.querySelector('.hub-main[data-cube-direction=top]')&&document.querySelector('#notes-title')?.textContent==='Biblioteca de prompts'"));
 check('hubSidebarCubeInBothDirections',true);
 await nav('settings');
 if(!(await js(cap,`window.companion.save(${JSON.stringify(sidebarSettings)})`)).ok)throw Error('No se pudo restaurar el movimiento de prueba.');
 await nav('notes');
 for(let round=0;round<3;round++){
  for(const [label,activeView] of hubSections){
   await clickLabel('.hub-sidebar',label);
   await wait(()=>js(cap,`document.querySelector('.hub-sidebar [aria-current=page]')?.textContent.trim()===${JSON.stringify(label)}`));
   const exclusive=await js(cap,`(()=>{
    const views=[...document.querySelectorAll('.knowledge-hub :is(.templates-view,.discovery-workspace,.translator-workspace,.password-vault,.hub-library,.hub-quick-notes,.hub-whiteboard)')];
    const visible=views.filter(view=>view.getClientRects().length>0);
    return visible.length===1&&visible[0].matches(${JSON.stringify(activeView)})&&
     ['.templates-view','.discovery-workspace'].every(selector=>{
      const retained=views.filter(view=>view.matches(selector));
      return retained.length<=1&&retained.every(view=>view===visible[0]?!view.inert:view.hidden&&view.inert);
     });
   })()`);
   if(!exclusive)throw Error('El HUB muestra vistas superpuestas o duplicadas en '+label);
  }
 }
 check('hubShowsOnlyActiveSection',true);
 await clickLabel('.hub-sidebar','Apuntes');
 await wait(()=>js(cap,"document.querySelector('.hub-quick-notes textarea')?.placeholder==='Escribe aquí…'"));
 const sheet = 'Primera línea  \n\n  Segundo párrafo.';
 await fill('.hub-quick-notes textarea',sheet);
 await clickLabel('.hub-sidebar','Biblioteca de prompts');
 await clickLabel('.hub-sidebar','Apuntes');
 const quickNotesText = `document.querySelector('.hub-quick-notes textarea')?.value===${JSON.stringify(sheet)}`;
 await wait(()=>js(cap,quickNotesText));
 await compact();
 await nav('notes');
 await wait(()=>js(cap,quickNotesText));
 check('quickNotesAutosaveAndCollapse',true);
 await clickLabel('.hub-sidebar','Pizarra');
 await wait(()=>js(cap,"!!document.querySelector('.hub-board-canvas')"));
 check('whiteboardDefaultBrush',await js(cap,"document.querySelector('.hub-board-tools button[aria-pressed=true]')?.textContent.trim()==='Medio'"));
 check('whiteboardFillsPanel',await js(cap,`(()=>{
  const canvas=document.querySelector('.hub-board-canvas'),stage=canvas.parentElement;
  return stage.clientHeight>110&&Math.abs(canvas.clientHeight-stage.clientHeight)<2&&Math.abs(canvas.clientWidth-stage.clientWidth)<2;
 })()`));
 const boardCount=(count:number)=>js(cap,`window.companion.whiteboard({type:'read'}).value?.strokes.length===${count}`);
 const boardSamples=()=>js(cap,`(()=>{
  const c=document.querySelector('.hub-board-canvas'),ctx=c.getContext('2d');
  const scale=Math.min(c.width/960,c.height/640);
  return [-192,0,192].map(x=>ctx.getImageData(Math.round(c.width/2+x*scale),Math.round(c.height/2),1,1).data[3]>0).join();
 })()`);
 await wait(async()=>await boardSamples()==='true,false,true');
 await js(cap,"window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,cancelable:true}))");
 await wait(()=>boardCount(1));
 await clickLabel('.hub-sidebar','Apuntes');
 await clickLabel('.hub-sidebar','Pizarra');
 await wait(async()=>await boardSamples()==='true,true,true');
 await compact();
 await nav('notes');
 await wait(async()=>await boardSamples()==='true,true,true');
 check('whiteboardPreciseEraseUndoAndCollapse',true);
 await clickLabel('.hub-sidebar','Configuración');
 await wait(()=>js(cap,"!!document.querySelector('.hub-switch[aria-label=\"Tema del lector\"]')"));
 await clickLabel('.hub-sidebar','Respaldo y exportación');
 await wait(()=>js(cap,"[...document.querySelectorAll('.hub-main button')].some(button=>button.textContent==='Restaurar biblioteca')"));
 check('hubSystemActionsAvailable',true);
 await clickLabel('.hub-sidebar','Traductor');
 await wait(()=>js(cap,"!!document.querySelector('#translator-key[type=password]:enabled')"));
 await fill('#translator-key','zen-translator-test-key');
 await clickLabel('.translator-key','Guardar clave');
 await wait(()=>js(cap,"!!document.querySelector('.translator-service button')&&!document.querySelector('#translator-key')"));
 check('translatorKeyProtected',await js(cap,"window.companion.translator({type:'status'}).then(r=>r.ok&&r.value.configured&&Object.keys(r.value).length===2)")&&
  !readFileSync(join(profile,'companion-translator.bin')).includes(Buffer.from('zen-translator-test-key')));
 await fill('#translator-original','¿Quién aprueba las solicitudes?');
 await clickLabel('.translator-form','Traducir');
 await wait(()=>js(cap,"document.querySelector('#translator-result')?.value==='Who approves the requests?'"));
 await clickLabel('.translator-form','Copiar');
 await wait(async()=>copiedText.at(-1)==='Who approves the requests?');
 await js(cap,"document.querySelector('.translator-direction button').click()");
 await fill('#translator-original','The manager approves the requests.');
 check('translatorEnterShortcut',await js(cap,`(()=>{
  const original=document.querySelector('#translator-original');
  const press=options=>original.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...options}));
  return press({shiftKey:true})&&press({isComposing:true})&&!press({});
 })()`));
 await wait(()=>js(cap,"document.querySelector('#translator-result')?.value==='El gestor aprueba las solicitudes.'"));
 check('translatorBothDirections',true);
 await shot(cap,'hub-translator');
 const translatorBounds=cap.getBounds();
 const savedWindow=()=>JSON.parse(readFileSync(join(profile,'companion-workspace-window.json'),'utf8'));
 await pause(300);
 const fullLayout=savedWindow();
 const windowFlags=()=>js(cap,'window.companion.status().then(({value})=>[value.settings.windowLocked,value.settings.alwaysOnTop,value.settings.presentation])');
 const originalFlags=await windowFlags();
 toggleSimpleMode();
 await wait(()=>js(cap,"window.companion.status().then(({value})=>value.workspace.simpleMode)"));
 check('simpleModeHubUnchanged',sameRect(cap.getBounds(),translatorBounds)&&!await inSimpleMode()&&await js(cap,`(()=>{
  const source=document.querySelector('#translator-original');
  const translation=document.querySelector('#translator-result');
  return source.value==='The manager approves the requests.'&&translation.value==='El gestor aprueba las solicitudes.';
 })()`));
 await nav('home');
 await wait(inSimpleMode);
 check('simpleModeKeepsSavedLayout',JSON.stringify(savedWindow().current)===JSON.stringify(fullLayout.current));
 await nav('notes');
 check('simpleModeReturnsToFullHub',sameRect(cap.getBounds(),translatorBounds)&&!await inSimpleMode());
 toggleSimpleMode();
 await wait(()=>js(cap,"window.companion.status().then(({value})=>!value.workspace.simpleMode)"));
 if(!sameRect(cap.getBounds(),translatorBounds))throw Error(`Modo simple recuperó ${JSON.stringify(cap.getBounds())}, se esperaba ${JSON.stringify(translatorBounds)}`);
 check('simpleModeRestoresWorkspace',sameRect(cap.getBounds(),translatorBounds)&&JSON.stringify(await windowFlags())===JSON.stringify(originalFlags));
 await resizeForFixture(440,translatorBounds.height);
 check('translatorFitsNarrow',await js(cap,`(()=>{
  const editor=document.querySelector('.translator-workspace');
  const source=document.querySelector('#translator-original').getBoundingClientRect();
  const target=document.querySelector('#translator-result').getBoundingClientRect();
  return editor.scrollWidth<=editor.clientWidth+1&&target.top>=source.bottom;
 })()`));
 await resizeForFixture(translatorBounds.width,translatorBounds.height);
 await nav('home');
 const beforeCompact=await screenRect();
 await compact();
 await changeSimpleMode(true);
 await wait(()=>js(cap,"!!document.querySelector('.home-weather')"));
 check('simpleModeHome',await js(cap,`(()=>{
  const details=document.querySelector('.home-simple-codex');
  const weather=document.querySelector('.home-weather');
  const glance=document.querySelector('.home-glance');
  const panel=document.querySelector('#capsule-content').getBoundingClientRect();
  return !details.open&&!!glance.querySelector('.home-date')&&!!glance.querySelector('.home-sleep')&&
   glance.getBoundingClientRect().bottom<=panel.bottom&&!!(weather.compareDocumentPosition(details)&Node.DOCUMENT_POSITION_FOLLOWING);
 })()`));
 await shot(cap,'simple-mode-home');
 await js(cap,"document.querySelector('.home-simple-codex summary').click()");
 check('simpleModeHomeDraft',await js(cap,"document.querySelector('.home-simple-codex').open&&document.querySelector('#codex-request').value==='Borrador habitual de prueba'"));
 const simpleHomeHeight=cap.getBounds().height;
 for(const [page,selector] of [
  ['codex','.codex-monitor'],['permissions','.codex-page[data-reviewing=true]'],['notices','.notice-tools'],
  ['options','.capsule-inline-menu'],['shortcuts','.capsule-inline-menu'],['settings','.preferences-category-select'],
 ]){
  await nav(page);
  check(`simpleMode-${page}`,await inSimpleMode()&&await js(cap,`!!document.querySelector(${JSON.stringify(selector)})?.getClientRects().length`));
 }
 check('simpleModeHasDifferentPanelSizes',cap.getBounds().height!==simpleHomeHeight);
 await js(cap,`(()=>{const select=document.querySelector('.preferences-category-select');select.value='shortcuts';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait(()=>js(cap,"document.querySelector('#shortcut')?.getClientRects().length"));
 check('simpleModeSettingsCategory',true);
 await nav('home');
 await compact();
 check('simpleModeLeavesCapsuleAnchored',sameRect(await screenRect(),beforeCompact));
 toggleSimpleMode();
 await nav('home');
 check('translatorRequiresHub',await js(cap,"window.companion.translator({type:'translate',from:'es',text:'Un ejemplo'}).then(r=>!r.ok)"));
 await nav('notes');
 await wait(()=>js(cap,"!!document.querySelector('.translator-service button')"));
 check('translatorRemembersOnlyDirection',await js(cap,"document.querySelector('#translator-original').lang==='en'&&!document.querySelector('#translator-original').value&&!document.querySelector('#translator-result').value"));
 const helloProbe=spawnSync(nativeHelper(__dirname,'vaultHello'),['probe'],{windowsHide:true,stdio:'ignore',timeout:5000});
 check('vaultHelloNativeProbe',[0,2].includes(helloProbe.status??-1));
 report.vaultHelloPlatformAvailable=helloProbe.status===0;
 const vaultFixture=new PasswordVault(join(profile,'passwords.kdbx'));
 await vaultFixture.create('ZEN vault fixture','ZEN vault fixture');
 vaultFixture.lock();
 check('vaultOnlyInHub',await js(cap,"window.companion.navigate('passwords').then(r=>!r.ok)"));
 await clickLabel('.hub-sidebar','Contraseñas');
 await wait(()=>js(cap,"!!document.querySelector('.hub-main .vault-unlock input:enabled')"));
 cap.focus();
 await fill('.vault-unlock input','ZEN vault fixture');
 await clickLabel('.vault-unlock','Desbloquear');
 await wait(()=>js(cap,"!!document.querySelector('.hub-main .vault-toolbar')"));
 await nav('home');
 await nav('notes');
 await clickLabel('.hub-sidebar','Contraseñas');
 await wait(()=>js(cap,"!!document.querySelector('.hub-main .vault-unlock input:enabled')"));
 check('hubVaultLocksOnNavigation',true);
 check('vaultHelloOptIn',await js(cap,"!document.querySelector('.vault-unlock button[type=button]')"));
 cap.focus();
 await fill('.vault-unlock input','ZEN vault fixture');
 await wait(()=>js(cap,"!!document.querySelector('.vault-unlock button[type=submit]:enabled')"));
 await clickLabel('.vault-unlock','Desbloquear');
 await wait(()=>js(cap,"!!document.querySelector('.vault-heading button[aria-expanded]')"));
 await clickLabel('.vault-heading','Windows Hello');
 await fill('.vault-form input[type=password]','incorrecta');
 await clickLabel('.vault-form','Activar Windows Hello');
 await wait(()=>js(cap,"document.querySelector('.password-vault [role=status]')?.textContent.includes('contraseña maestra no es correcta')"));
 check('vaultHelloValidatesMaster',!existsSync(join(profile,'passwords-hello.json')));
 await clickLabel('.hub-sidebar','Descubrimiento de apps');
 await wait(()=>js(cap,"!!document.querySelector('.discovery-workspace:not([hidden])')"));
 await clickLabel('.discovery-workspace','Nueva ficha');
 check('discoveryBilingual',await js(cap,"document.querySelector('[for=discovery-objective][lang=en]')?.textContent.includes('What problem')&&document.querySelector('#discovery-es-objective')?.textContent.includes('¿Qué problema')"));
 await fill('.discovery-project input','Help desk pilot');
 await fill('#discovery-objective','Reduce the time to resolve support tickets.');
 await shot(cap,'discovery-interview');
 await clickLabel('.discovery-workspace','Guardar ficha');
 await wait(()=>js(cap,"document.querySelector('.discovery-status [role=status]')?.textContent==='Ficha guardada.'"));
 await clickLabel('.discovery-workspace','Volver a las fichas');
 await js(cap,"document.querySelector('.discovery-records button').click()");
 check('discoveryReopensAnswers',await js(cap,"document.querySelector('#discovery-objective')?.value==='Reduce the time to resolve support tickets.'"));
 const queueBeforeDiscovery=queuedRequests.length,copyBeforeDiscovery=copiedText.length;
 await clickLabel('.discovery-workspace','Generar propuesta');
 check('discoveryLocalIdea',await js(cap,"document.querySelector('.discovery-idea strong')?.textContent==='Service desk'"));
 await clickLabel('.discovery-workspace','Copiar resumen');
 await wait(async()=>copiedText.length===copyBeforeDiscovery+1);
 check('discoveryBriefToClipboard',copiedText.at(-1)?.includes('Application discovery · Help desk pilot'));
 await wait(()=>js(cap,"document.querySelector('.discovery-status [role=status]')?.textContent==='Resumen copiado.'"));
 await clickLabel('.discovery-steps','Datos, integración y licencias');
 await fill('#discovery-licences','Confirm seat assignments with IT');
 await js(cap,"document.querySelector('[aria-label=\"Por confirmar · Licences\"]').click()");
 await clickLabel('.discovery-workspace','Valorar en Codex');
 await wait(()=>js(cap,"document.querySelector('.workspace-content')?.dataset.page==='home'&&document.querySelector('#codex-request')?.value.includes('Licences · To confirm (Confirm seat assignments with IT)')"));
 check('discoveryStagesWithoutSending',queuedRequests.length===queueBeforeDiscovery);
 await js(cap,"document.querySelector('.codex-request-form').requestSubmit()");
 await wait(()=>js(cap,"document.querySelector('#codex-request')?.value==='Borrador habitual de prueba'"));
 check('discoveryUsesExistingRequest',queuedRequests.length===queueBeforeDiscovery+1&&queuedRequests.at(-1)?.text.includes('Help desk pilot'));
 await nav('notes');
 check('discoveryAssessmentSaves',await js(cap,"window.companion.notesRead().then(result=>result.ok&&result.value.data.discoveries?.[0]?.answers.licences?.pending===true)"));
 await nav('home');
 await fill('#codex-request','');
 Object.assign(report,await smokeAppearance({cap,js,wait,nav,shot,selectPosition,compact,resize:resizeForFixture}));
 await selectPosition('floating');
 await compact();
 const foreground=new BrowserWindow({width:420,height:300,title:'Ventana de prueba de foco'});
 try{
  await foreground.loadURL('data:text/html,<input autofocus aria-label="Prueba de foco">');
  foreground.focus();
  await wait(async()=>foreground.isFocused());
  const foregroundBefore=await nativeProbe('-Order');
  enableAutomaticPermissionReview();
  const longCommand=Array.from({length:35},(_,index)=>`echo argumento largo de prueba ${index+1}`).join('\n')+
   '\n\nParámetros adicionales:\n'+JSON.stringify({workdir:'C:\\fixture',sandbox_permissions:'require_escalated'});
  const pending=relay('PermissionRequest',longCommand);
  void pending.catch(()=>{});
  await wait(()=>js(cap,"!!document.querySelector('#capsule-content[data-page=permissions]:not([hidden]) .codex-review pre')"));
  const raised=await nativeProbe('-Order');
  check('automaticApprovalTakesPriorityWithoutFocus',raised.topmost&&raised.foregroundHandle===foregroundBefore.foregroundHandle&&!raised.foreground&&hub.status().approvals.length===1);
  const longReview=await js(cap,"window.companion.status().then(r=>r.value.workspace.geometry.panel)");
  check('approvalHeightAdaptsToCommand',longReview.width===approvalGeometry.width&&longReview.height>approvalGeometry.height&&longReview.height<=306);
  await js(cap,"document.querySelector('.codex-review-details summary').click()");
  const copies=copiedText.length;
  await js(cap,"document.querySelector('.codex-review-details button').click()");
  await wait(async()=>copiedText.length===copies+1);
  check('approvalCopiesFullCommandAndScope',copiedText.at(-1)===longCommand);
  await js(cap,"document.querySelector('.codex-review-details summary').click()");
  await resizeForFixture(350,335);
  check('responsiveApprovalKeepsButtonsVisible',await js(cap,`(()=>{
   const panel=document.querySelector('#capsule-content').getBoundingClientRect();
   const command=document.querySelector('.codex-review pre');
   const detail=document.querySelector('.codex-approval-body');
   const detailBounds=detail.getBoundingClientRect();
   const buttons=[...document.querySelectorAll('.codex-review .actions button')];
   return command.textContent===${JSON.stringify(longCommand)}&&command.clientHeight>0&&document.querySelector('.codex-review-chat').clientHeight>0&&
    (detail.scrollHeight>detail.clientHeight||command.scrollHeight>command.clientHeight)&&buttons.length===3&&
    buttons.every(button=>{const rect=button.getBoundingClientRect();return rect.top>=detailBounds.bottom&&rect.bottom<=panel.bottom&&rect.right<=panel.right;});
  })()`));
  await shot(cap,'codex-permission-responsive');
  const another=relay('PermissionRequest','echo siguiente solicitud');
  void another.catch(()=>{});
  await wait(()=>js(cap,"document.querySelector('.codex-review-selector select')?.options.length===2"));
  await js(cap,"(()=>{const select=document.querySelector('.codex-review-selector select');select.selectedIndex=1;select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await wait(()=>js(cap,"document.querySelector('.codex-review pre')?.textContent==='echo siguiente solicitud'"));
  check('responsiveApprovalSwitchesBetweenPendingRequests',hub.status().approvals.length===2);
  await clickLabel('.codex-review','Rechazar');
  check('automaticApprovalRejectsSelectedRequest',(await another).hookSpecificOutput?.decision?.behavior==='deny');
  await clickLabel('.codex-review','Rechazar');
  check('automaticApprovalRejectsLastRequest',(await pending).hookSpecificOutput?.decision?.behavior==='deny');
  await wait(()=>js(cap,"document.querySelector('#capsule-content').hidden"));
  const restored=await nativeProbe('-Order');
  check('automaticApprovalRestoresPreviousOrder',restored.topmost===foregroundBefore.topmost&&restored.foregroundHandle===foregroundBefore.foregroundHandle);
  cap.minimize();
  const minimized=relay('PermissionRequest','echo aviso con ZEN minimizado');
  void minimized.catch(()=>{});
  await wait(async()=>!cap.isMinimized()&&cap.isVisible()&&await js(cap,"document.querySelector('.codex-review pre')?.textContent==='echo aviso con ZEN minimizado'"));
  check('automaticApprovalAppearsWhenMinimized',cap.isAlwaysOnTop()&&!cap.isFocused());
  await js(cap,"document.querySelector('.codex-review-heading button[aria-label=\"Cerrar revisión\"]').click()");
  await wait(async()=>cap.isMinimized());
  check('automaticApprovalDismissPreservesRequest',hub.status().approvals.length===1&&cap.isAlwaysOnTop()===foregroundBefore.topmost);
  hub.decide(hub.status().approvals[0].id,'pass');
  await minimized;
  cap.restore();
 }finally{foreground.destroy();}
 check('noDuplicateWindow',BrowserWindow.getAllWindows().length===1);
 check('noOldBarAtAnyEntry',await js(cap,"!document.querySelector('.companion-bar,.capsule-single-row')"));
 const savedState=JSON.parse(readFileSync(join(profile,'companion-workspace-window.json'),'utf8'));
 check('presentationSavedWithPage',savedState.page&&['workspace','capsule'].includes(savedState.mode));
 await writeEvidence(join(evidenceDirectory,'companion-native.json'),JSON.stringify({...report,passed:true},null,2));
 return {...report,passed:true};
}
