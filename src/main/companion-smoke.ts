import {screen,BrowserWindow,dialog,nativeImage} from 'electron';
import type {CompanionHub} from './companion-hub';
import type {CompanionIntegration} from './companion-integration';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeEvidence} from './evidence-file';
import type {CompanionNotice} from '../shared/codex-companion';
import {DesktopObservation} from './companion-desktop';
import {nativeHelper} from './native-helper';
import type {CompanionMedia} from './companion-media';
import {codexChatUrl} from '../shared/companion-presentation';
import {newFields} from '../shared/knowledge-hub';
export async function companionSmoke({cap,hub,integration,profile,openedTargets,activateNotice,copiedRequests,queuedRequests,copiedText,media,observationFixture,dismissOnOutsideClick}:{cap:BrowserWindow;hub:CompanionHub;integration:CompanionIntegration;profile:string;openedTargets:string[];activateNotice:(n:CompanionNotice)=>Promise<void>;copiedRequests:string[];queuedRequests:{thread:string;text:string}[];copiedText:string[];media:CompanionMedia;observationFixture:{playing:boolean;source:string;reads:number;playerAvailable:boolean;playerSource:string};dismissOnOutsideClick:()=>void}){
 const evidenceDirectory=join(profile,'evidence'),screenshots=join(evidenceDirectory,'screenshots');
 mkdirSync(screenshots,{recursive:true});
 const report:Record<string,any>={at:new Date().toISOString(),scope:'Single ZEN workspace, isolated native hook and synthetic media',apiCalled:false,physicalInputTested:false,companionOnly:true,evidenceDirectory};
 const pause=(ms=100)=>new Promise(r=>setTimeout(r,ms)),js=(w:BrowserWindow,s:string)=>w.webContents.executeJavaScript(s).catch(e=>{throw Error('Isolated fixture expression failed: '+s.slice(0,180)+' · '+String(e));});
 const wait=async(fn:()=>Promise<any>)=>{for(let n=0;n<100;n++){if(await fn().catch(()=>false))return;await pause();}throw Error('Workspace smoke condition not reached: '+fn.toString().slice(0,180)+'; fixture: '+await js(cap,"JSON.stringify({analysis:document.querySelector('.context-analysis')?.innerHTML,page:document.querySelector('.workspace-content')?.dataset.page,root:document.querySelector('.companion-capsule')?.className,hidden:document.hidden})"));};
 const resizeForFixture=async(width:number,height:number)=>{cap.setBounds({...cap.getBounds(),width,height});try{await wait(async()=>cap.getBounds().width===width&&cap.getBounds().height===height);}catch{throw Error('Native resize fixture failed: '+JSON.stringify({requested:{width,height},actual:cap.getBounds(),minimum:cap.getMinimumSize(),resizable:cap.isResizable()}));}await pause(120);};
 const nav=async(page:string)=>{await js(cap,`window.companion.navigate(${JSON.stringify(page)})`);await wait(()=>js(cap,`!!document.querySelector('.workspace-content[data-page="${page}"]')`));};
 const shot=async(w:BrowserWindow,name:string)=>{await pause(220);let last:unknown;for(let attempt=0;attempt<3;attempt++){try{await writeEvidence(join(screenshots,name+'.png'),(await w.webContents.capturePage(undefined,{stayAwake:true})).toPNG());return;}catch(e){last=e;await pause(200);}}throw Error('Own-window capture failed: '+name+' · '+String(last));};
 cap.webContents.setBackgroundThrottling(false);
 // The fixture drives the renderer itself; input from the shared desktop must not close its panels.
 cap.webContents.on('before-input-event',event=>event.preventDefault());
 cap.webContents.on('before-mouse-event',event=>event.preventDefault());
 let mediaEffects=0,mediaReads=0;const mediaActions:string[]=[];
 const sendMedia=media.command.bind(media),readMedia=media.snapshot.bind(media);
 media.command=(...args:Parameters<CompanionMedia['command']>)=>{mediaEffects++;mediaActions.push(args[0].action);return sendMedia(...args);};
 media.snapshot=(...args:Parameters<CompanionMedia['snapshot']>)=>{mediaReads++;return readMedia(...args);};
 const nativeCalls={bounds:0,shape:0,order:0,focus:0},setBounds=cap.setBounds.bind(cap),setShape=cap.setShape.bind(cap),setOrder=cap.setAlwaysOnTop.bind(cap),focus=cap.focus.bind(cap);
 cap.setBounds=(...args:Parameters<BrowserWindow['setBounds']>)=>{nativeCalls.bounds++;return setBounds(...args);};
 cap.setShape=(...args:Parameters<BrowserWindow['setShape']>)=>{nativeCalls.shape++;return setShape(...args);};
 cap.setAlwaysOnTop=(...args:Parameters<BrowserWindow['setAlwaysOnTop']>)=>{nativeCalls.order++;return setOrder(...args);};
 cap.focus=()=>{nativeCalls.focus++;return focus();};

 await wait(()=>js(cap,"!!document.querySelector('.zen-mark')"));
 const nativeCapsuleFrame=()=>new Promise<boolean>(resolve=>{const p=spawn('pwsh.exe',['-NoProfile','-NonInteractive','-File',join(process.cwd(),'scripts','test-app-window-edges.ps1'),'-WindowHandle',cap.getNativeWindowHandle().readBigUInt64LE().toString(),'-Owner',String(process.pid),'-Capsule'],{stdio:'pipe',windowsHide:true});let output='';const timer=setTimeout(()=>{p.kill();resolve(false);},12000);p.stdout.on('data',b=>output+=b);p.stderr.resume();p.on('error',()=>{clearTimeout(timer);resolve(false);});p.on('close',()=>{clearTimeout(timer);try{const r=JSON.parse(output);report.capsuleNativeFrameAttributes=r;resolve(r.noBackdrop===true&&!cap.hasShadow()&&r.thickFrame===false&&r.ncEnabled===false&&JSON.stringify(r.window)===JSON.stringify(r.extendedFrame));}catch{resolve(false);}});});
 report.capsuleNativeOuterFrameRemoved=await nativeCapsuleFrame();report.capsuleNoCssOuterShadow=await js(cap,"getComputedStyle(document.querySelector('.companion-capsule')).boxShadow==='none'");
 await wait(()=>js(cap,"document.querySelector('.companion-capsule').dataset.background==='dusk'"));
 report.capsuleAppearanceAtStartup=await js(cap,"(()=>{const r=document.querySelector('.companion-capsule'),h=getComputedStyle(document.querySelector('.capsule-single-row'));return{theme:r.dataset.theme,background:r.dataset.background,color:h.backgroundColor,blur:h.backdropFilter,layer:getComputedStyle(r,'::before').content};})()");
 report.capsuleSavedAppearanceOnStartup=report.capsuleAppearanceAtStartup.theme==='dark'&&report.capsuleAppearanceAtStartup.background==='dusk'&&report.capsuleAppearanceAtStartup.color==='rgba(18, 20, 31, 0.41)'&&report.capsuleAppearanceAtStartup.blur.includes('blur(7px)')&&report.capsuleAppearanceAtStartup.layer!=='none';
 await writeEvidence(join(evidenceDirectory,'capsule-frame-native.json'),JSON.stringify({at:new Date().toISOString(),attributes:report.capsuleNativeFrameAttributes,outerFrameRemoved:report.capsuleNativeOuterFrameRemoved,cssOuterShadowRemoved:report.capsuleNoCssOuterShadow}));
 report.capsuleSize=cap.getBounds().width===820&&cap.getBounds().height===68;
 const headerLayout=()=>js(cap,`(()=>{
  const header=document.querySelector('.capsule-single-row'),rect=e=>e.getBoundingClientRect(),h=rect(header);
  const blocks=[...header.querySelectorAll(':scope>[data-capsule-block]')].map(rect);
  const buttons=[...header.querySelectorAll('.capsule-launcher button,.capsule-actions>button,.capsule-move button')].map(rect);
  return blocks.length===4&&buttons.length===12&&blocks.every((r,i)=>r.width>0&&r.left>=h.left&&r.right<=h.right+.5&&r.top>=h.top&&r.bottom<=h.bottom+.5&&(!i||blocks[i-1].right<=r.left+.5))&&
   buttons.every(r=>r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth+.5&&r.top>=0&&r.bottom<=h.bottom+.5)&&header.scrollWidth<=header.clientWidth;
 })()`);
 report.capsuleSingleRowWithoutOverlap=await headerLayout();
 report.fourIndependentHeaderBlocks=await js(cap,"[...document.querySelectorAll('.companion-bar>[data-capsule-block]')].map(e=>e.dataset.capsuleBlock).join(',')==='codex,navigation,music,controls'");
 report.compactHeaderHeight=await js(cap,"document.querySelector('.companion-bar').getBoundingClientRect().height===66");
 report.capsuleContentRailHeight=await js(cap,`[...document.querySelectorAll('.capsule-single-row > [data-capsule-block]')]
  .every(block=>block.getBoundingClientRect().height===54)`);
 report.capsuleStateTooltipAndTruncation=await js(cap,`(()=>{
  const state=document.querySelector('.companion-state'),label=state.querySelector('.capsule-state-label');
  const original=label.textContent;
  label.textContent=original.repeat(20);
  const style=getComputedStyle(label);
  const truncates=label.scrollWidth>label.clientWidth&&style.textOverflow==='ellipsis'&&state.title.includes(original);
  label.textContent=original;
  return truncates;
 })()`);
 await shot(cap,'capsule-roomy');
 report.noChat=await js(cap,"!document.querySelector('textarea')&&!window.zen");
 report.noCharacter=await js(cap,"!document.querySelector('canvas,.companion-wardrobe')");
 report.noCursorPolling=await js(cap,"!('cursor' in window.companion)&&!('onCursor' in window.companion)");
 report.capsuleNoAuthority=await js(cap,`window.companion.decide('${randomUUID()}','allow').then(r=>!r.ok)`);
 const compactBounds=cap.getBounds(),same=(a:any,b:any)=>['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<=1);
 const startDisplay=screen.getDisplayMatching(compactBounds),workArea=startDisplay.workArea;
 for(const [alignment,ratio] of [['left',0],['right',1],['center',.5]] as const){
  await js(cap,`document.querySelector('.capsule-move [data-alignment=${alignment}]').click()`);
  const expected={...compactBounds,x:workArea.x+Math.round((workArea.width-compactBounds.width)*ratio),y:workArea.y};
  await wait(async()=>same(expected,cap.getBounds())&&screen.getDisplayMatching(cap.getBounds()).id===startDisplay.id);
  await wait(async()=>JSON.parse(readFileSync(join(profile,'companion-placement.json'),'utf8')).some((p:any)=>p.displayId===startDisplay.id&&p.edge==='top'&&p.horizontalRatio===ratio));
 }
 report.capsuleQuickPositions=true;
 await shot(cap,'capsule-move-positions');
 const railStyle=`(()=>{
  const root=document.querySelector('.companion-capsule'),bar=root.querySelector('.capsule-single-row');
  const style=getComputedStyle(bar),scene=getComputedStyle(root,'::before');
  return JSON.stringify({color:style.backgroundColor,blur:style.backdropFilter,rounding:style.borderRadius,
   backdrop:[scene.height,scene.backgroundImage,scene.backgroundSize,scene.filter],
   bounds:[bar,...bar.querySelectorAll('[data-capsule-block],.capsule-move button')].map(e=>e.getBoundingClientRect().toJSON())});
 })()`;
 const foldedRail=await js(cap,railStyle);
 await nav('home');
 report.capsuleRailStableWhenExpanded=await js(cap,railStyle)===foldedRail;
 const homeBounds=cap.getBounds();
 await js(cap,"document.querySelector('.capsule-move [data-alignment=right]').click()");
 await wait(async()=>same({...homeBounds,x:workArea.x+workArea.width-homeBounds.width},cap.getBounds()));
 report.capsuleMovesWithHomeOpen=await js(cap,"!!document.querySelector('.workspace-content[data-page=home]')");
 await js(cap,"document.querySelector('.capsule-move [data-alignment=center]').click()");
 await wait(async()=>same(homeBounds,cap.getBounds()));
 await shot(cap,'capsule-same-rail-expanded');
 await js(cap,"window.companion.launcher(false)");
 await wait(()=>js(cap,"!document.querySelector('.workspace-content')"));
 for(const page of ['home','spotify','codex','notes','notices']){
  await js(cap,`document.querySelector('.companion-bar [data-page="${page}"]').click()`);await wait(()=>js(cap,`!!document.querySelector('.workspace-content[data-page="${page}"]')`));
  const other=page==='home'?'spotify':'home';const beforeSwitch=cap.getBounds();await js(cap,`document.querySelector('.companion-bar [data-page="${other}"]').click()`);await wait(()=>js(cap,`!!document.querySelector('.workspace-content[data-page="${other}"]')`));
  if(!same(beforeSwitch,cap.getBounds())||!await js(cap,"document.querySelectorAll('.companion-bar [data-page]').length===5"))throw Error('Switching integrations changed geometry or hid integrations.');
  await js(cap,`document.querySelector('.companion-bar [data-page="${page}"]').click()`);await wait(()=>js(cap,`!!document.querySelector('.workspace-content[data-page="${page}"]')`));
  await js(cap,`document.querySelector('.companion-bar [data-page="${page}"]').click()`);await wait(()=>js(cap,"!document.querySelector('.workspace-content')"));
  if(!same(compactBounds,cap.getBounds()))throw Error('Repeating the active icon did not restore the capsule anchor.');
 }
 report.allNavigationIconsToggleCapsule=true;
 report.switchingIconsKeepsExpanded=true;await js(cap,"Promise.all([window.companion.togglePage('home'),window.companion.togglePage('spotify')])");await wait(()=>js(cap,"!!document.querySelector('.workspace-content[data-page=spotify]')"));await js(cap,"window.companion.togglePage('spotify')");await wait(()=>js(cap,"!document.querySelector('.workspace-content')"));await js(cap,"Promise.all([window.companion.togglePage('home'),window.companion.togglePage('home')])");await wait(()=>js(cap,"!document.querySelector('.workspace-content')"));report.fastIconClicksUseMainState=true;
 await js(cap,"document.querySelector('button[aria-label=Integraciones]').click()");await wait(()=>js(cap,"!!document.querySelector('.workspace-content')"));
 const expandedBounds=cap.getBounds();
 report.extensionAnchored=same(expandedBounds,{...compactBounds,y:workArea.y,height:workArea.height});
 report.extensionFullHeight=expandedBounds.y===workArea.y&&expandedBounds.height===workArea.height;
 report.extensionStaysCapsule=!cap.isResizable()&&!cap.isMovable()&&!cap.isMaximizable()&&cap.isAlwaysOnTop()&&await headerLayout();
 report.extensionHeaderHeight=await js(cap,"document.querySelector('.companion-bar').getBoundingClientRect().height===66&&!('windowAction' in window.companion)");
 report.extensionHasNoNativeFrame=await nativeCapsuleFrame();
 report.singleCapsuleWindow=BrowserWindow.getAllWindows().length===1;
 report.launcherNoPrivateAccess=await js(cap,"window.companion.mediaList().then(r=>!r.ok)");
 report.fourHeaderIconsAndNotices=await js(cap,"document.querySelectorAll('.companion-bar .capsule-launcher button').length===4&&!!document.querySelector('.capsule-launcher [data-page=notes]')&&!!document.querySelector('.capsule-actions [data-page=notices]')");
 report.cleanCapsuleControls=await js(cap,"document.querySelectorAll('.companion-bar nav[aria-label=\"Controles de la cápsula\"]>button').length===5");
 await shot(cap,'capsule-integrations');
 await js(cap,"document.querySelector('[aria-label=Opciones]').click()");await wait(()=>js(cap,"!!document.querySelector('.capsule-inline-menu')"));report.inlineOptions=await js(cap,"document.body.textContent.includes('Presentación')&&document.body.textContent.includes('Preferencias')")&&BrowserWindow.getAllWindows().length===1;
 await js(cap,"document.querySelector('.companion-bar [data-page=spotify]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))");await wait(()=>js(cap,"!!document.querySelector('.workspace-content[data-page=shortcuts]')"));report.inlineContextMenu=await js(cap,"document.body.textContent.includes('Ver en cápsula')")&&BrowserWindow.getAllWindows().length===1;
 await js(cap,"document.querySelector('.companion-bar [data-page=home]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',altKey:true,bubbles:true,cancelable:true}))");await wait(()=>js(cap,"document.querySelector('.capsule-launcher button').dataset.page==='codex'"));
 report.launcherOrderPersisted=JSON.parse(readFileSync(join(profile,'companion-launcher.json'),'utf8')).order[0]==='codex';
 report.invalidLauncherOrderRefused=await js(cap,"window.companion.launcherOrder(['home','home','codex','notes','notices']).then(r=>!r.ok)");
 await js(cap,"window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");await wait(()=>js(cap,"!document.querySelector('.workspace-content')"));report.escapeCollectsCapsule=same(compactBounds,cap.getBounds());
 await js(cap,"document.querySelector('.companion-bar [data-page=spotify]').click()");await wait(()=>js(cap,"!!document.querySelector('.workspace-content[data-page=spotify]')"));report.launcherSelectSameWindow=BrowserWindow.getAllWindows().length===1&&same(expandedBounds,cap.getBounds());
 await js(cap,"window.companion.launcher(false)");await wait(()=>js(cap,"!document.querySelector('.workspace-content')"));report.launcherRestoresAnchor=same(compactBounds,cap.getBounds());
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
 for(const page of [null,'home']){
  if(page)await nav(page);
  const before=cap.getBounds();
  dismissOnOutsideClick();
  await wait(async()=>cap.isMinimized()&&!cap.isAlwaysOnTop());
  cap.restore();
  await wait(async()=>cap.isVisible()&&!cap.isMinimized()&&cap.isAlwaysOnTop()&&same(before,cap.getBounds()));
  await wait(()=>js(cap,page?"!!document.querySelector('.workspace-content[data-page=home]')":"!document.querySelector('.workspace-content')"));
 }
 await js(cap,"window.companion.launcher(false)");
 await wait(()=>js(cap,"!document.querySelector('.workspace-content')"));
 report.outsideClickDismissesBothModes=same(compactBounds,cap.getBounds());
 report.nativeHistoryRegression=await new Promise<boolean>(resolve=>{const p=spawn(desktopExe,['--verify-history'],{stdio:'pipe',windowsHide:true});let output='';const timer=setTimeout(()=>{p.kill();resolve(false);},3000);p.stdout.on('data',b=>output+=b);p.stderr.resume();p.stdin.end();p.on('error',()=>{clearTimeout(timer);resolve(false);});p.on('close',()=>{clearTimeout(timer);try{const r=JSON.parse(output);resolve(Object.keys(r).length===5&&Object.values(r).every(v=>v===true));}catch{resolve(false);}});});
 report.nativeWindowObserver=await new Promise<boolean>(resolve=>{const p=spawn(desktopExe,['--watch',String(process.pid)],{stdio:'pipe',windowsHide:true});let buffer='';const timer=setTimeout(()=>{p.kill();resolve(false);},3000);p.stderr.resume();p.stdin.on('error',()=>{});p.on('error',()=>{clearTimeout(timer);resolve(false);});p.stdout.on('data',b=>{buffer+=b;if(buffer.includes('\n')){let ok=false;try{ok=DesktopObservation.safeParse(JSON.parse(buffer.split('\n')[0])).success;}catch{}clearTimeout(timer);p.stdin.end();resolve(ok);}});});
 await js(cap,"document.querySelector('[aria-label=\"Opciones de ZEN\"]').click()");await wait(()=>js(cap,"!!document.querySelector('.workspace-content')"));
 report.singleWindowNavigation=BrowserWindow.getAllWindows().length===1&&await js(cap,"document.querySelectorAll('.companion-bar [data-page]').length===5");
 const area=screen.getDisplayMatching(cap.getBounds()).workArea;
 const placed=cap.getNormalBounds();
 await nav('home');const beforeNavigation={...nativeCalls};await js(cap,"window.fixtureHeader=document.querySelector('.companion-bar')");
 await nav('codex');await nav('options');await nav('notices');await nav('home');
 report.navigationDoesNotRecreateWindow=nativeCalls.bounds===beforeNavigation.bounds&&nativeCalls.shape===beforeNavigation.shape&&nativeCalls.order===beforeNavigation.order&&await js(cap,"window.fixtureHeader===document.querySelector('.companion-bar')");

 const beforeAutoEffects=mediaEffects;observationFixture.playing=true;
 await wait(()=>js(cap,"!!document.querySelector('.capsule-now-playing')"));
 for(const page of ['home','spotify','codex']){await nav(page);if(!await js(cap,"!!document.querySelector('.capsule-now-playing')"))throw Error('Automatic media disappeared while navigating.');}
 await js(cap,"window.companion.launcher(false)");await wait(()=>js(cap,"!!document.querySelector('.capsule-now-playing')&&!document.querySelector('.workspace-content')"));report.automaticMediaInEverySectionAndCapsule=true;
 observationFixture.source='Google Chrome';await wait(()=>js(cap,"document.querySelector('.capsule-now-playing')?.dataset.source==='Google Chrome'"));
 observationFixture.source='Reproductor de Windows';await wait(()=>js(cap,"document.querySelector('.capsule-now-playing')?.dataset.source==='Reproductor de Windows'"));report.automaticMediaAnyWindowsPublisher=true;
 report.automaticMediaDoesNotGrantControls=await js(cap,"window.companion.mediaNowPlaying().then(r=>r.ok&&r.value&&!('session' in r.value)&&!('controls' in r.value))")&&mediaEffects===beforeAutoEffects;
 await js(cap,"window.companion.presentation(true)");await wait(()=>js(cap,"!document.querySelector('.capsule-now-playing')"));report.automaticMediaRespectsPrivacy=await js(cap,"window.companion.mediaNowPlaying().then(r=>r.ok&&r.value===null)");await js(cap,"window.companion.presentation(false)");await wait(()=>js(cap,"!!document.querySelector('.capsule-now-playing')"));
 await js(cap,"document.querySelector('.capsule-hide').click()");await wait(async()=>cap.isMinimized());
 report.automaticMediaHiddenReturnsNothing=await js(cap,"window.companion.mediaNowPlaying().then(r=>r.ok&&r.value===null)");cap.restore();cap.showInactive();await wait(()=>js(cap,"!!document.querySelector('.capsule-now-playing')"));
 observationFixture.playing=false;await wait(()=>js(cap,"!document.querySelector('.capsule-now-playing')"));report.automaticMediaDisappearsWhenStopped=true;

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
 await js(cap,"document.querySelector('[aria-label=Pausar]').click()");await wait(()=>js(cap,"!!document.querySelector('[aria-label=Reproducir]')"));report.mediaDirectControl=true;

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
 await resizeForFixture(320,68);report.narrowMusicHeaderWithoutOverlap=await headerLayout();await shot(cap,'capsule-music-narrow');
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
 report.capsuleMoveDirectButtonsFitNarrow=await js(cap,"(()=>{const group=document.querySelector('.capsule-move'),panel=group.getBoundingClientRect(),controls=group.parentElement.getBoundingClientRect();return group.querySelectorAll('button').length===3&&panel.left>=controls.left&&panel.right<=controls.right&&panel.top>=controls.top&&panel.bottom<=controls.bottom})()");
 await resizeForFixture(820,68);
 await js(cap,"window.companion.presentation(true)");await wait(()=>js(cap,"!document.querySelector('.mini-track')"));report.compactPresentationBlocks=await js(cap,"window.companion.mediaCurrent().then(r=>!r.ok)");
 await js(cap,"window.companion.presentation(false)");
 await js(cap,"document.querySelector('.mini-dismiss').click()");
 await wait(()=>js(cap,"!document.querySelector('.mini-dismiss')"));
 report.compactClosedRevokes=await js(cap,"window.companion.mediaCurrent().then(r=>!r.ok)");

 await nav('home');report.mediaWrongPageRefused=await js(cap,"window.companion.mediaList().then(r=>!r.ok)");
 await js(cap,"window.companion.launcher(false)");await wait(async()=>cap.getBounds().height===68);
 await js(cap,"window.companion.launcher(true)");await wait(()=>js(cap,"!!document.querySelector('.workspace-content')"));report.workspacePositionRemembered=same(placed,cap.getNormalBounds());
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
   Math.abs(parseFloat(glass.backgroundColor.split(', ').at(-1))-.73)<.01&&glass.backdropFilter.includes('blur(7px)')&&
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
 report.hubNotesReaderSharesWidth=await js(cap,`(()=>{
  const items=document.querySelector('.hub-items').getBoundingClientRect(), reader=document.querySelector('.hub-reader').getBoundingClientRect();
  const heading=document.querySelector('.notes-editor-heading'), title=heading.firstElementChild.getBoundingClientRect();
  return items.width>=205&&reader.width>items.width&&reader.left-items.right>=15&&Math.abs(title.width-heading.clientWidth)<1;
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
 await fillNoteField('notes-title-field','Filtros con Power Fx');
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
 await nav('home');await nav('notes');
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
 report.hubPromptEditorUsesAvailableHeight=await js(cap,`(()=>{
  const editor=document.querySelector('.hub-edit'),area=editor.querySelector('#notes-code');
  return area.clientHeight>editor.clientHeight*.65&&
   document.querySelector('.hub-save').getBoundingClientRect().bottom<=document.querySelector('.hub-reader').getBoundingClientRect().bottom;
 })()`);
 const longPrompt=Array.from({length:48},(_,i)=>'Paso '+(i+1)+': Revisa el material del proyecto y registra las decisiones y las tareas que deben completarse antes de la entrega.').join('\n\n');
 await fillNoteField('notes-code',longPrompt);
 await wait(()=>js(cap,"document.querySelector('.hub-save [role=status]')?.textContent==='Guardado'"));
 await js(cap,"[...document.querySelectorAll('.notes-editor-heading button')].find(button=>button.textContent.includes('Vista previa')).click()");
 await wait(()=>js(cap,"!!document.querySelector('.notes-code-preview')"));
 report.hubLongPromptUsesReaderScroll=await js(cap,`(()=>{
  const body=document.querySelector('.hub-document'), code=body.querySelector('.notes-code-preview');
  const heading=body.querySelector('.notes-code-heading'), header=document.querySelector('.notes-editor-heading');
  const headerTop=header.getBoundingClientRect().top;
  body.scrollTop=body.scrollHeight;
  const ok=code.scrollWidth<=code.clientWidth+1&&code.scrollHeight<=code.clientHeight+1&&body.scrollTop>0&&
   Math.abs(body.scrollHeight-body.scrollTop-body.clientHeight)<1&&
   heading.getBoundingClientRect().top>=body.getBoundingClientRect().top&&header.getBoundingClientRect().top===headerTop;
  body.scrollTop=0;
  return ok;
 })()`);
 await shot(cap,'workspace-long-prompt');
 await js(cap,"[...document.querySelectorAll('.notes-editor-heading button')].find(button=>button.textContent.includes('Editar')).click()");
 await wait(()=>js(cap,"!!document.querySelector('#notes-code')"));
 await fillNoteField('notes-code','Resume el proyecto {{PROJECT_NAME}}\nDevuelve tres puntos.');
 await wait(()=>js(cap,"document.querySelector('.hub-save [role=status]')?.textContent==='Guardado'"));
 await js(cap,"[...document.querySelectorAll('.notes-editor-heading button')].find(button=>button.textContent.includes('Vista previa')).click()");
 await wait(()=>js(cap,"!!document.querySelector('.hub-document .hub-fields input')"));
 await js(cap,"(()=>{const input=document.querySelector('.hub-document .hub-fields input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'ZEN');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await js(cap,"document.querySelector('.notes-code-heading button').click()");
 await wait(async()=>copiedText.at(-1)==='Resume el proyecto ZEN\nDevuelve tres puntos.');
 report.hubAutosavePromptAndVariables=await js(cap,"document.querySelector('#notes-title')?.textContent==='Biblioteca de prompts'");
 const olderProject={type:'save',fields:{...newFields('project'),title:'Proyecto de prueba',related:[createdNote.id]}};
 await js(cap,`window.companion.notesChange(${JSON.stringify(olderProject)})`);
 await nav('home');await nav('notes');
 await wait(()=>js(cap,"!!document.querySelector('.hub-cards')"));
 await js(cap,"document.querySelector('.hub-search-launch').click()");
 await wait(()=>js(cap,"document.querySelector('.hub-search')?.open"));
 await js(cap,"[...document.querySelectorAll('.hub-results button')].find(b=>b.querySelector('strong')?.textContent==='Proyecto de prueba').click()");
 await wait(()=>js(cap,"document.querySelector('.hub-related button')?.textContent==='Filtros con Power Fx'"));
 report.hubProjectRelations=true;
 const hubPath=join(profile,'hub-export-fixture.json'),hubMarkdown=join(profile,'hub-export-fixture.md'),hubImage=join(profile,'hub-image.png');
 writeFileSync(hubImage,nativeImage.createFromBitmap(Buffer.from([60,100,160,255]),{width:1,height:1}).toPNG());
 const originalSave=dialog.showSaveDialog,originalOpen=dialog.showOpenDialog;
 try {
  dialog.showSaveDialog=(async (_window:unknown,options:{defaultPath?:string})=>({
   canceled:false,filePath:options.defaultPath?.endsWith('.md')?hubMarkdown:hubPath,
  })) as typeof dialog.showSaveDialog;
  dialog.showOpenDialog=(async (_window:unknown,options:{title?:string})=>({
   canceled:false,filePaths:[options.title==='Adjuntar imagen'?hubImage:hubPath],
  })) as typeof dialog.showOpenDialog;
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
 } finally {
  dialog.showSaveDialog=originalSave;
  dialog.showOpenDialog=originalOpen;
 }
 await js(cap,"[...document.querySelectorAll('.hub-sidebar nav button')].find(button=>button.textContent==='Configuración').click()");
 await wait(()=>js(cap,"[...document.querySelectorAll('.hub-panel button')].some(button=>button.textContent==='Oscuro')"));
 await js(cap,"[...document.querySelectorAll('.hub-panel button')].find(button=>button.textContent==='Oscuro').click()");
 await wait(()=>js(cap,"!!document.querySelector('.knowledge-hub[data-hub-theme=dark]')"));
 report.hubDarkTheme=await js(cap,`getComputedStyle(document.querySelector('#notes-title')).color==='rgb(243, 244, 255)'&&
  getComputedStyle(document.querySelector('.knowledge-hub')).backgroundColor.startsWith('rgba(18, 20, 31, ')&&
  window.companion.notesRead().then(r=>r.ok&&r.value.data.theme==='dark')`);
 await js(cap,"window.companion.presentation(true)");
 await wait(()=>js(cap,"!document.querySelector('.notes-editor')"));
 report.notesHiddenInPresentation=await js(cap,"window.companion.notesRead().then(r=>!r.ok&&!document.body.textContent.includes('Filtros con Power Fx'))");
 await js(cap,"window.companion.presentation(false)");await nav('home');
 await js(cap,"window.companion.presentation(false)");await nav('settings');report.settingsInWorkspace=BrowserWindow.getAllWindows().length===1&&await js(cap,"!!document.querySelector('.connection-diagnosis')");
 await integration.install();report.hookInstalled=hub.installed;
 const shellProbe=spawn(process.env.ComSpec??'cmd.exe',['/c',integration.command],{stdio:'pipe',windowsHide:true});let probeOutput='';shellProbe.stdout.on('data',b=>probeOutput+=b);shellProbe.stderr.resume();const probeDone=new Promise<number|null>((resolve,reject)=>{shellProbe.on('error',reject);shellProbe.on('close',resolve);});shellProbe.stdin.end('{"hook_event_name":"DiagnosticProbe","session_id":"diagnostic"}');report.shellCommandVerified=await probeDone===0&&probeOutput.trim()==='{}';
 const launch=(event:string,extra:any={})=>{const p=spawn(integration.executable,['--zen-companion'],{stdio:'pipe',windowsHide:true});let output='';p.stdout.on('data',b=>output+=b);p.stderr.resume();const done=new Promise<string>((resolve,reject)=>{p.on('error',reject);p.on('close',c=>c===0?resolve(output.trim()):reject(Error('Hook fixture failed')));});p.stdin.end(JSON.stringify({hook_event_name:event,session_id:'native-test',turn_id:'turn-1',cwd:'C:\\fixture',...extra}));return{child:p,done};};
 await launch('PermissionRequest',{session_id:'foreign',tool_name:'Bash',tool_input:{command:'PRIVATE FOREIGN'}}).done;report.foreignEventsIgnored=hub.status().sessions.length===0&&hub.status().approvals.length===0;
 await js(cap,"window.companion.launcher(false)");const beforeActivity=cap.getBounds(),beforeActivityCalls={...nativeCalls};await launch('UserPromptSubmit',{prompt:'DO NOT FORWARD'}).done;await wait(()=>js(cap,"document.querySelector('.orbital-mark').dataset.orbitalState==='thinking'"));report.promptNotForwarded=!JSON.stringify(hub.status()).includes('DO NOT FORWARD');report.activityKeepsGeometry=same(beforeActivity,cap.getBounds());report.signalsDoNotMutateNativeWindow=JSON.stringify(nativeCalls)===JSON.stringify(beforeActivityCalls);
 await nav('home');await wait(()=>js(cap,"document.querySelector('.home-work-state')?.textContent==='Pensando'"));report.homeThinkingStateObserved=true;const homeWorkBounds=cap.getBounds();
 await launch('PreToolUse',{tool_name:'Bash',tool_input:{command:'npm test'}}).done;await wait(()=>js(cap,"!!document.querySelector('.orbital-working')"));
 await wait(()=>js(cap,"document.querySelector('.home-work-state')?.textContent==='Usando herramientas'"));report.homeWorkingStateObserved=same(homeWorkBounds,cap.getBounds());
 report.orbitalFullTurn=await js(cap,"(()=>{const a=document.querySelector('.orbital-working').getAnimations()[0];return a&&a.effect.getTiming().duration===3200&&a.effect.getKeyframes().at(-1).transform==='rotate(360deg)';})()");
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
 report.capsuleStateOpensPermission=await js(cap,"document.querySelector('.workspace-content').dataset.page==='permissions'");
 await nav('home');await js(cap,"document.querySelector('[data-home-card=work] .home-status-action').click()");await wait(()=>js(cap,"!!document.querySelector('.approval-card pre')"));report.permissionReview=await js(cap,"document.querySelector('.approval-card pre').textContent.includes('PRIVATE REVIEW')");
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
 await launch('Stop',{last_assistant_message:finalReply}).done;await wait(()=>js(cap,"document.querySelector('.orbital-mark').dataset.orbitalState==='finished'"));report.lastReplyHiddenOutsideCodex=await js(cap,"window.companion.status().then(r=>!JSON.stringify(r.value).includes('Respuesta final de prueba'))");
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
 await js(cap,"window.companion.presentation(true)");
 await wait(()=>js(cap,"!document.querySelector('.codex-request-form,[data-quick-request]')&&!document.querySelector('.home-notice-count')"));
 report.homePrivacyHidesDetails=await js(cap,"window.companion.openRequest('Petición oculta').then(r=>!r.ok)");
 await js(cap,"window.companion.presentation(false)");
 await wait(()=>js(cap,"!!document.querySelector('.codex-request-form')"));
 await shot(cap,'workspace-home');
 await js(cap,"document.querySelector('[data-home-card=music] .home-status-action').click()");
 await wait(()=>js(cap,"!!document.querySelector('.workspace-content[data-page=spotify]')"));
 report.requestBlockedOutsideHome=await js(cap,"window.companion.openRequest('Desde Spotify').then(r=>!r.ok)");
 await nav('home');await js(cap,"document.querySelector('[data-home-card=work] .home-status-action').click()");
 await wait(()=>js(cap,"!!document.querySelector('.workspace-content[data-page=codex]')"));
 await nav('home');report.homeCardsNavigateWithoutClosing=true;
 const beforeNotices=cap.getBounds();await js(cap,"document.querySelector('[data-home-card=notices] .home-status-action').click()");await wait(()=>js(cap,"!!document.querySelector('.notice-card')"));report.noticesInCapsule=BrowserWindow.getAllWindows().length===1&&same(beforeNotices,cap.getBounds());report.homeNoticeCounterMarksRead=await js(cap,"window.companion.status().then(r=>r.ok&&r.value.notices.every(n=>n.read))");
 report.noticesCannotControlMedia=await js(cap,"window.companion.mediaList().then(r=>!r.ok)");
 await shot(cap,'capsule-notices');
 for(const page of ['home','spotify','codex','notes']){await nav(page);for(const width of [320,380,760]){await resizeForFixture(width,Math.min(680,area.height));if(!await js(cap,"document.body.scrollWidth<=innerWidth&&document.querySelector('.workspace-content').scrollWidth<=document.querySelector('.workspace-content').clientWidth+1")||!await headerLayout())throw Error('Workspace or header overflows: '+page);}}report.workspaceResponsive=true;report.responsiveWidthsActuallyApplied=true;
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
 await js(cap,"window.companion.launcher(false)");
 const hookResult=(turn:string,text:string)=>{hub.accept({id:randomUUID(),event:'UserPromptSubmit',session:'native-test',cwd:'C:\\fixture',turn},()=>{});hub.accept({id:randomUUID(),event:'Stop',session:'native-test',cwd:'C:\\fixture',turn,lastAssistantMessage:text},()=>{});};
 hookResult('context-correlated-result','<zen_resultado id="'+contextMarker+'">Archivo analizado, resultado local de prueba.</zen_resultado>');hookResult('context-later-unrelated','Respuesta posterior que no corresponde a la petición de ZEN.');
 await js(cap,"window.companion.launcher(true)");
 await wait(()=>js(cap,"document.querySelector('.codex-context .codex-result-text')?.textContent==='Archivo analizado, resultado local de prueba.'"));report.contextAutoResultReturns=true;report.contextHookResultSurvivesLaterReply=true;
 report.contextPrivateNotInStatus=await js(cap,"window.companion.status().then(r=>!JSON.stringify(r).includes('Archivo analizado, resultado local')&&!JSON.stringify(r).includes('selected-context.txt'))");
 writeFileSync(join(profile,'selected-context.txt'),'Contenido cambiado después del análisis.');await js(cap,"document.querySelector('.codex-context .codex-result-fetch').click()");await wait(()=>js(cap,"!document.querySelector('.codex-context .codex-result-text')&&document.querySelector('.codex-context').textContent.includes('contenido cambió')"));report.contextChangedFileRejectsResult=true;
 await js(cap,"document.querySelector('.codex-context .context-analysis-toggle').click()");await wait(()=>js(cap,"!!document.querySelector('.context-prepare')"));
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
 report.visualResultStacksAt320=await js(cap,"(()=>{const a=document.querySelector('.context-analysis').getBoundingClientRect(),b=document.querySelector('.codex-response-column').getBoundingClientRect(),s=document.querySelector('.workspace-content');return a.bottom<=b.top&&s.scrollWidth<=s.clientWidth;})()");
 await js(cap,"window.companion.codexTab('activity')");
 report.visualSourceBlockedInActivity=await js(cap,"window.companion.contextSource({id:'"+visualMarker+"',finding:0,source:0}).then(r=>!r.ok)");
 const followupReply='Respuesta de seguimiento para probar el lector de texto.\n\n- **España** y Dublín.';
 hookResult('visual-request-followup',followupReply);
 await nav('home');await resizeForFixture(820,Math.min(680,area.height));
 await shot(cap,'glass-home');
 await nav('codex');await js(cap,"document.getElementById('codex-tab-summary').click()");await shot(cap,'glass-codex');
 await nav('home');report.appearanceOnlyInSettings=await js(cap,"window.companion.appearanceSave({}).then(r=>!r.ok)");
 await nav('settings');await wait(()=>js(cap,"!!document.querySelector('.appearance-settings')"));
 await js(cap,"(()=>{const e=document.querySelector('[aria-label=\"Opacidad del cristal\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'55');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await wait(()=>js(cap,"document.querySelector('.companion-capsule').style.getPropertyValue('--glass-opacity')==='0.55'"));report.glassOpacityPreviews=true;
 await js(cap,"[...document.querySelectorAll('.appearance-theme button')].find(b=>b.textContent==='Claro').click()");await wait(()=>js(cap,"document.querySelector('.companion-capsule').dataset.theme==='light'"));
 await js(cap,"[...document.querySelectorAll('.appearance-save button')].find(b=>b.textContent==='Guardar apariencia').click()");await wait(()=>js(cap,"document.querySelector('.appearance-save .primary').textContent==='Guardado'"));
 const appearanceSaved=JSON.parse(readFileSync(join(profile,'companion-appearance.json'),'utf8'));report.glassSettingsPersist=appearanceSaved.options.theme==='light'&&appearanceSaved.options.opacity===.55;await shot(cap,'glass-settings-light');
 await js(cap,"document.querySelector('.appearance-file button').click()");await wait(()=>js(cap,"document.querySelector('.companion-capsule').dataset.background==='image'"));
 const wallpaper=await js(cap,"window.companion.status().then(r=>r.value.appearance.imageUrl)");
 report.wallpaperOwnedAndVisible=typeof wallpaper==='string'&&/^zen-theme:\/\/background\/[a-f0-9-]{36}$/.test(wallpaper)&&await js(cap,`new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth===1);i.onerror=()=>resolve(false);i.src=${JSON.stringify(wallpaper)};})`);
 await js(cap,"window.companion.launcher(false)");await wait(()=>js(cap,"!!document.querySelector('.companion-capsule.collapsed[data-background=image]')"));report.capsuleWallpaperPreferenceVisible=await js(cap,`getComputedStyle(document.querySelector('.companion-capsule'),'::before').backgroundImage.includes(${JSON.stringify(wallpaper)})`);report.capsuleOpacityPreferenceVisible=await js(cap,"getComputedStyle(document.querySelector('.capsule-single-row')).backgroundColor==='rgba(244, 246, 253, 0.55)'");report.capsuleAppearanceKeepsNativeFrameRemoved=await nativeCapsuleFrame();
 await shot(cap,'capsule-saved-appearance');await js(cap,"window.companion.navigate('settings')");await wait(()=>js(cap,"!!document.querySelector('.appearance-settings')"));
 report.wallpaperArbitraryPathsRejected=await js(cap,"new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(false);i.onerror=()=>resolve(true);i.src='zen-theme://background/../../gmail-oauth.bin';})");
 await js(cap,"window.companion.presentation(true)");await wait(()=>js(cap,"document.querySelector('.companion-capsule').dataset.background!=='image'&&!document.querySelector('.appearance-file')"));
 report.wallpaperPresentationRedacts=await js(cap,"Promise.all([window.companion.appearanceChoose(),window.companion.appearanceSave({})]).then(r=>r.every(v=>!v.ok))");
 await js(cap,"window.companion.presentation(false)");await wait(()=>js(cap,"!!document.querySelector('.appearance-settings')"));await js(cap,"window.companion.appearanceSave({theme:'dark',accent:'violet',background:'aurora',opacity:.68,blur:24})");
 // Local view tools operate only on already visible, supplied data.
 await nav('settings');report.polishOpaqueWorkspace=await js(cap,"Number(getComputedStyle(document.querySelector('.workspace-content')).backgroundColor.match(/[\\d.]+/g).at(-1))>=.84");
 await nav('home');report.polishHomeCompact=await js(cap,"(()=>{const home=document.querySelector('.home-status'),cards=[...home.querySelectorAll('.home-status-card')].map(card=>card.getBoundingClientRect()),hero=home.querySelector('.codex-request-form');return cards.length===3&&cards.every(card=>card.height<235)&&!!hero&&(home.clientWidth<=600||cards.every(card=>Math.abs(card.top-cards[0].top)<1));})()");await shot(cap,'polish-home');
 await nav('codex');await js(cap,"document.getElementById('codex-tab-activity').click()");await wait(()=>js(cap,"!!document.querySelector('.activity-tools')"));
 const actionTotal=await js(cap,"document.querySelectorAll('.event-list details').length"),commandTotal=await js(cap,"[...document.querySelectorAll('.event-list summary')].filter(e=>e.textContent.includes('Comando')).length");
 await js(cap,"(()=>{const i=document.querySelector('[aria-label=\"Buscar actividad\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'no-match-local-7832');i.dispatchEvent(new Event('input',{bubbles:true}));})()");await wait(()=>js(cap,"document.querySelectorAll('.event-list details').length===0"));report.polishActivitySearch=await js(cap,"!!document.querySelector('.view-empty')");
 await js(cap,"document.querySelector('[aria-label=\"Limpiar buscar actividad\"]').click()");await wait(()=>js(cap,`document.querySelectorAll('.event-list details').length===${actionTotal}`));
 await js(cap,"[...document.querySelectorAll('[aria-label=\"Tipo de actividad\"] button')].find(b=>b.textContent==='Comandos').click()");await wait(()=>js(cap,"[...document.querySelectorAll('.event-list summary')].every(e=>e.textContent.includes('Comando'))"));report.polishActivityFilter=await js(cap,`document.querySelectorAll('.event-list details').length===${commandTotal}`);
 await js(cap,"[...document.querySelectorAll('[aria-label=\"Tipo de actividad\"] button')].find(b=>b.textContent==='Todo').click()");await js(cap,"[...document.querySelectorAll('.activity-tools>button')].find(b=>b.textContent==='Ver detalles').click()");await wait(()=>js(cap,`document.querySelectorAll('.event-list details[open]').length===${actionTotal}`));report.polishActivityExpand=true;await js(cap,"[...document.querySelectorAll('.activity-tools>button')].find(b=>b.textContent==='Plegar detalles').click()");await shot(cap,'polish-codex');
 await js(cap,"document.getElementById('codex-tab-summary').click()");await wait(()=>js(cap,"!!document.querySelector('.codex-last-response-text')"));await js(cap,"document.querySelector('.codex-last-response .copy-visible button').click()");await wait(async()=>copiedText.at(-1)===followupReply);report.polishCopyVisibleReply=true;
 await nav('spotify');await wait(()=>js(cap,"!!document.querySelector('.music-player')"));const copiedTrack=await js(cap,"document.querySelector('.music-track h3').textContent+' — '+document.querySelector('.music-track p').textContent");await js(cap,"document.querySelector('.music-copy button').click()");await wait(async()=>copiedText.at(-1)?.startsWith(copiedTrack)===true);report.polishMusicCopy=true;await shot(cap,'polish-music');
 await nav('notices');await js(cap,"[...document.querySelectorAll('[aria-label=\"Filtrar avisos\"] button')].find(b=>b.textContent==='Errores').click()");report.polishNoticeTools=await js(cap,"document.querySelector('[aria-label=\"Filtrar avisos\"] button[aria-pressed=true]').textContent==='Errores'");await nav('settings');report.polishDiagnosticsFolded=await js(cap,"!!document.querySelector('.settings-connection:not([open])')&&!!document.querySelector('.settings-general')");report.polishAccentSwatches=await js(cap,"getComputedStyle(document.querySelector('.appearance-accents button[data-accent=violet]')).backgroundColor==='rgb(178, 153, 255)'");await shot(cap,'polish-settings');
 for(const width of [320,760,820]){await resizeForFixture(width,Math.min(680,area.height));for(const page of ['home','codex','spotify','notices','settings'] as const){await nav(page);await pause(80);if(!await js(cap,"document.body.scrollWidth<=innerWidth&&document.querySelector('.workspace-content').scrollWidth<=document.querySelector('.workspace-content').clientWidth+1"))throw Error('Polished tools overflow: '+page+' '+width);}}report.polishAllViewsResponsive=true;
 await nav('codex');await js(cap,"document.getElementById('codex-tab-summary').click()");await wait(()=>js(cap,"window.companion.status().then(r=>r.value.sessions.some(s=>!!s.lastReply))"));
 await js(cap,"window.companion.launcher(false)");
 await wait(async()=>same(compactBounds,cap.getBounds())&&!cap.isResizable()&&cap.isAlwaysOnTop());
 report.extensionCollectsToAnchor=await nativeCapsuleFrame();
 await js(cap,"window.companion.launcher(true)");
 await wait(()=>js(cap,"!!document.querySelector('.workspace-content')"));
 report.extensionReopensAtAnchor=same(expandedBounds,cap.getBounds());
 report.legacyAppGeometryIgnored=readFileSync(join(profile,'companion-desktop-window.json'),'utf8')==='{"version":1,"mode":"app","bounds":{"x":5,"y":5,"width":1100,"height":900},"maximized":true}';
 await js(cap,"window.companion.presentation(false)");await nav('home');hub.update({...hub.settings,motion:false,sounds:false,notifications:false});await pause(100);report.reducedMotion=await js(cap,"document.querySelector('.orbital-mark').getAnimations({subtree:true}).length===0");
 await nav('settings');
 await js(cap,"[...document.querySelectorAll('.appearance-theme button')].find(b=>b.textContent==='Monocromo').click()");
 await wait(()=>js(cap,"!!document.querySelector('.companion-capsule[data-theme=monochrome]')&&!!document.querySelector('[aria-label=\"Opacidad del cristal\"]')&&!!document.querySelector('[aria-label=\"Desenfoque del cristal\"]')&&!document.querySelector('.appearance-accents')"));
 await js(cap,"[...document.querySelectorAll('.appearance-background button')].find(b=>b.textContent==='Imagen').click()");
 await wait(()=>js(cap,`(()=>{const root=document.querySelector('.companion-capsule'),style=getComputedStyle(root,'::before');return root.dataset.background==='image'&&style.backgroundImage.includes(${JSON.stringify(wallpaper)})&&style.filter==='grayscale(1)';})()`));
 await nav('home');
 await wait(()=>js(cap,"!!document.querySelector('.companion-capsule[data-theme=dark]')"));
 await nav('settings');
 await js(cap,"[...document.querySelectorAll('.appearance-theme button')].find(b=>b.textContent==='Monocromo').click()");
 await js(cap,"document.querySelector('.appearance-save .primary').click()");
 await wait(()=>js(cap,"document.querySelector('.appearance-save .primary').textContent==='Guardado'"));
 const monochromeSaved=JSON.parse(readFileSync(join(profile,'companion-appearance.json'),'utf8'));
 report.monochromePersists=monochromeSaved.options.theme==='monochrome'&&monochromeSaved.options.opacity===.68&&monochromeSaved.options.blur===24&&monochromeSaved.image?.id===wallpaper.split('/').at(-1);
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
   const fits=await js(cap,"(()=>{const content=document.querySelector('.workspace-content'),header=document.querySelector('.capsule-single-row');return document.body.scrollWidth<=innerWidth&&content.scrollWidth<=content.clientWidth+1&&header.scrollWidth<=header.clientWidth;})()");
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
 await shot(cap,'monochrome-codex');
 await js(cap,"window.companion.launcher(false)");
 await wait(()=>js(cap,"!!document.querySelector('.companion-capsule.collapsed[data-theme=monochrome]')"));
 report.monochromeGlassCapsule=await js(cap,"(()=>{const style=getComputedStyle(document.querySelector('.capsule-single-row'));return style.backgroundColor==='rgba(28, 28, 29, 0.68)'&&style.backdropFilter.includes('blur(24px)');})()")&&await nativeCapsuleFrame();
 report.onlyExplicitCodexHandoffs=queuedRequests.length===6&&queuedRequests.every(item=>item.thread==='native-test')&&copiedRequests.length===0&&queuedRequests[3].text===expectedContextPrompt&&queuedRequests[4].text===expectedPagePrompt&&queuedRequests[5].text===visualPrompt;report.noExtraWindows=BrowserWindow.getAllWindows().length===1;
 integration.close();report.closedAppDoesNotBlock=await launch('PermissionRequest',{tool_name:'Bash',tool_input:{command:'must not run'}}).done==='{}';
 report.passed=Object.entries(report).filter(([k,v])=>typeof v==='boolean'&&!['apiCalled','physicalInputTested'].includes(k)).every(([,v])=>v===true);
 await writeEvidence(join(evidenceDirectory,'companion-native.json'),JSON.stringify(report,null,2));if(!report.passed)throw Error('Companion assertions failed: '+JSON.stringify(Object.entries(report).filter(([key,value])=>value===false&&!['apiCalled','physicalInputTested','passed'].includes(key))));return report;
}
