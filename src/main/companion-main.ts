import {CompanionCalendar} from './companion-calendar';
import {CalendarAction} from '../shared/companion-calendar';
import {CompanionOura} from './companion-oura';
import {authorizeOura} from './oura-oauth';
import {OuraAction,ouraLegal} from '../shared/companion-oura';
import {createSmokeOura} from './companion-smoke-oura';
import {WeatherAction} from '../shared/companion-weather';
import {CompanionWeather} from './companion-weather';
import {createSmokeWeather} from './companion-smoke-weather';
import {TranslatorAction} from '../shared/companion-translator';
import {OfficinaAction} from '../shared/companion-officina';
import {CompanionOfficina} from './companion-officina';
import {OfficinaProvisioning} from './companion-officina-provision';
import {makeOfficinaSmokeTeam} from './companion-officina-smoke';
import {CompanionTranslator} from './companion-translator';
import {smokeTranslatorResponse} from './companion-smoke-translator';
import {CompanionAppearance} from './companion-appearance';
import {AppearanceOptions} from '../shared/companion-appearance';
import {registerProfileBackupIpc} from './companion-backup-ipc';
import {restoreBackup,snapshotBackup} from './companion-backup';
import {ProfileSync} from './profile-sync';
import {profileFingerprint,registerProfileSyncIpc} from './profile-sync-ipc';
import {registerNotesIpc} from './companion-notes-ipc';
import {decodeTemplateBackupImage, loadTemplateSeeds} from './companion-template-images';
import {createSmokeMedia} from './companion-smoke-media';
import {desktopCodex,openCodexRequest,queueCodexBrowserRequest,queueCodexRequest} from './companion-request';
import {CodexRequest} from '../shared/companion-request';
import {CompanionContext} from './companion-context';
import {contextFile} from './companion-context-file';
import {ContextInput} from '../shared/companion-context';
import {CodexReferenceSelection} from '../shared/codex-result-document';
import {app,BrowserWindow,Tray,Menu,Notification,screen,globalShortcut,shell,clipboard,dialog,protocol,nativeImage,systemPreferences,safeStorage,powerMonitor} from 'electron';
import {dirname,extname,isAbsolute,join} from 'node:path';
import {execFile} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {z} from 'zod';
import {CompanionSettingsSchema,CompanionTargetSchema,migrateWindowPreferences,type CompanionSettings,type CompanionNotice,type CompanionTarget} from '../shared/codex-companion';
import {CompanionHub} from './companion-hub';
import {CompanionIntegration} from './companion-integration';
import {CodexRpc} from './codex-rpc';
import {CapsuleAlignment,type Area,type DockEdge} from '../shared/overlay-position';

import {codexChatUrl,noticeChatUrl,isSilenced} from '../shared/companion-presentation';
import {CodexReplyReader} from './companion-codex-reader';
import {inspectCodexCompanion} from './companion-codex-inspection';
import {preferCompanionReply} from './companion-reply';
import {registerCompanionShortcuts} from './companion-shortcuts';
import {displayStatus} from '../shared/companion-privacy';
import {CompanionDesktop} from './companion-desktop';
import {CompanionMedia,CompanionMediaObserver,NativeMediaRpc} from './companion-media';
import {WorkspacePage,LauncherPage,LauncherOrder,CapsuleView,SectionPage,CapsuleHoverInput,isLauncherPageSelected} from '../shared/companion-workspace';
import {CompanionLauncher} from './companion-launcher';
import {KnowledgeHub} from './knowledge-hub';
import {MediaCommand,SystemVolumeAction} from '../shared/companion-media';
import {CompanionSystemVolume} from './companion-system-volume';
import {mergeShape,overlaps,CapsuleVisibility} from './companion-placement';
import {CompanionWorkspaceWindow,compactIslandSize,edgeBounds,edgeWorkspaceMinimum,fitWorkspace,islandBounds,placeWorkspaceRail,railFromIsland,restoreWorkspace,workspaceCaptionHeight,workspaceLayout,workspaceMinimum,type EdgeDock,type WorkspaceGeometry} from './companion-workspace-window';
import {EDGE_ISLAND,ISLAND_BLUR_MS} from '../shared/island';
import {capsuleLayout,capsuleLayoutShape,permissionPanelSize,resizeCapsuleLayout,retractCapsulePanel,simpleWorkspacePanels} from './companion-capsule-layout';
import {CapsuleLocation,CapsuleMenuAnchor,WorkspaceLayoutAction,WorkspaceLayoutPreferences} from '../shared/workspace-layout';
import {capsuleMenuItems} from './companion-capsule-menu';
import {companionIpc} from './companion-ipc';
import {companionChannel,companionInterfaceEffectChannel} from '../shared/companion-ipc';
import {surfaceSound,type InterfaceEffect} from '../shared/companion-interface-audio';
import {nativeHelper} from './native-helper';
import {CompanionHover} from './companion-hover';
import {CompanionPanelTransition} from './companion-panel-transition';
import {atomicVaultWrite,PasswordVault} from './password-vault';
import {registerVaultIpc} from './companion-vault';
import {copyVaultText} from './vault-clipboard';
import {VaultHelloBinding,windowsVaultHello} from './vault-hello';
protocol.registerSchemesAsPrivileged([{scheme:'zen-theme',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const appUserModelId='com.zen.desktop';
app.setName('ZEN');app.setAppUserModelId(appUserModelId);
const hoverSmoke=process.argv.includes('--zen-hover-smoke');
const officinaSmokeProfile=hoverSmoke?process.argv.find(arg=>/^--zen-officina-profile=[a-f0-9-]{36}$/.test(arg))?.split('=')[1]:undefined;
const smoke=hoverSmoke||process.argv.includes('--zen-shell-smoke');if(smoke){const p=join(app.getPath('temp'),'zen-companion-smoke-'+(officinaSmokeProfile??process.pid));mkdirSync(p,{recursive:true});app.setPath('userData',p);}
const copiedRequests:string[]=[];const queuedRequests:{thread:string;text:string}[]=[];const copiedText:string[]=[];const openedTargets:string[]=[];const openExternal=(url:string)=>smoke?(openedTargets.push(url),Promise.resolve()):shell.openExternal(url);
const copyText = (text: string) => { if (smoke) copiedText.push(text); else clipboard.writeText(text); };
let reveal=()=>{};if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>reveal());
 app.on('window-all-closed',()=>app.quit());
 // Finalize the process after Electron's quit lifecycle, even if a local helper still holds a handle.
 app.once('quit',(_event,code)=>process.exit(code));
 void app.whenReady().then(async()=>{
  const profile=app.getPath('userData'),file=join(profile,'companion-settings.json');let settings:CompanionSettings;
  const workspaceWindow=new CompanionWorkspaceWindow(join(profile,'companion-workspace-window.json'));
  try{settings=CompanionSettingsSchema.parse(migrateWindowPreferences(JSON.parse(readFileSync(file,'utf8'))));}catch{settings=CompanionSettingsSchema.parse({});}
  const targetFile=join(profile,'companion-target.json');let target:CompanionTarget|undefined,targetError:string|undefined;
  if(smoke)target=CompanionTargetSchema.parse({session:'native-test',cwd:'C:\\fixture',title:'Revisar formulario en navegador'});
  else if(existsSync(targetFile))try{target=CompanionTargetSchema.parse(JSON.parse(readFileSync(targetFile,'utf8')));}catch{targetError='No se pudo leer el chat fijado. Revisa la configuración local de ZEN.';}
  const launcherPreferences=new CompanionLauncher(join(profile,'companion-launcher.json'));
  const notes = new KnowledgeHub(join(profile, 'knowledge-hub.sqlite'), join(profile, 'companion-notes.json'),
   ()=>loadTemplateSeeds(join(__dirname,'renderer','hub-templates')),decodeTemplateBackupImage);
  // An older saved preference file is reloaded by the same constructor in the isolated packaged fixture.
  if(smoke){
   writeFileSync(join(profile,'companion-appearance.json'),JSON.stringify({options:{theme:'dark',accent:'violet',background:'dusk',opacity:.41,blur:7}}));
   writeFileSync(join(profile,'companion-desktop-window.json'),'{"version":1,"mode":"app","bounds":{"x":5,"y":5,"width":1100,"height":900},"maximized":true}');
  }
  const appearance=new CompanionAppearance(profile,bytes=>{let image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw Error();const size=image.getSize(),ratio=Math.min(1,2560/Math.max(size.width,size.height));if(ratio<1)image=image.resize({width:Math.max(1,Math.round(size.width*ratio)),height:Math.max(1,Math.round(size.height*ratio)),quality:'best'});return image.toPNG();});
  let contextPage:LauncherPage|undefined;
  const savedPage=workspaceWindow.page??launcherPreferences.status().last;
  let expanded=false,workspacePage:WorkspacePage=savedPage==='permissions'?'codex':savedPage,quitting=false,dragTimer:ReturnType<typeof setInterval>|undefined,dragLimit:ReturnType<typeof setTimeout>|undefined,moved=false;
  let permissionReturnPage:WorkspacePage=workspacePage;
  let permissionPanel=permissionPanelSize();
  let simpleMode=false;
  let fullFrame:{geometry:WorkspaceGeometry;anchor:Area;location:CapsuleLocation}|undefined;
  const compactPanel=(page=workspacePage)=>page==='permissions'?permissionPanel:simpleMode?simpleWorkspacePanels[page]:undefined;
  const renderer=join(__dirname,'renderer','index.html'),preload=join(__dirname,'preload.cjs'),icon=join(__dirname,'renderer','icons','zen.ico');
  const rendererQuery={view:'capsule'};
  const rendererUrl=pathToFileURL(renderer).href+'?'+new URLSearchParams(rendererQuery);
  const nativeCaption=process.platform==='win32';
  const activeDisplay=()=>screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const fitDisplay=(saved:WorkspaceGeometry,displays=screen.getAllDisplays(),fallback=activeDisplay()):WorkspaceGeometry=>{
   const monitor=displays.find(d=>d.id===saved.displayId)??fallback;
   return {...saved,displayId:monitor.id,area:monitor.workArea,bounds:restoreWorkspace(saved,[monitor],monitor)};
  };
  const initialDisplay=activeDisplay();
  const {location:savedLocation,islandMode,side:defaultSide,restoreOnLaunch}=workspaceWindow.preferences;
  const startsFloating=(savedLocation??islandMode)==='floating';
  const savedGeometry=startsFloating?workspaceWindow.floating:workspaceWindow.current;
  let parked:WorkspaceGeometry=restoreOnLaunch&&savedGeometry
   ?fitDisplay(savedGeometry)
   :{displayId:initialDisplay.id,area:initialDisplay.workArea,bounds:workspaceLayout(initialDisplay.workArea,workspaceWindow.preferences.side),maximized:false};
  let dock:EdgeDock=workspaceWindow.edgeDock??{side:savedLocation&&savedLocation!=='floating'?savedLocation:defaultSide,displayId:parked.displayId,fraction:.5};
  const location=():CapsuleLocation=>(workspaceWindow.preferences.location??workspaceWindow.preferences.islandMode)==='floating'?'floating':dock.side;
  const isEdge=()=>location()!=='floating';
  const dockDisplay=()=>screen.getAllDisplays().find(d=>d.id===dock.displayId)??screen.getPrimaryDisplay();
  const activeWorkspaceMinimum=()=>isEdge()?edgeWorkspaceMinimum(dockDisplay().workArea,dock.side):workspaceMinimum;
  const surfaceBounds=()=>isEdge()?edgeBounds(dockDisplay().workArea,dock,true,nativeCaption):islandBounds(parked,nativeCaption);
  const layout=(open=expanded)=>{
   const area=isEdge()?dockDisplay().workArea:parked.area;
   const view=capsuleLayout(area,surfaceBounds(),parked.bounds,isEdge()?dock.side:undefined,open||nativeCaption,nativeCaption?workspaceCaptionHeight:0,compactPanel());
   // On Windows keep the compositor viewport in place between hover states.
   // The native region still exposes only the compact silhouette when closed.
   return open?view:{...view,panel:undefined};
  };
  let taskbarHidden=settings.hideCapsuleFromTaskbar;
  const cap=new BrowserWindow({...layout(false).bounds,title:'ZEN · Isla',frame:false,thickFrame:nativeCaption,roundedCorners:false,transparent:false,
   ...(nativeCaption?{titleBarStyle:'hidden' as const,titleBarOverlay:{height:workspaceCaptionHeight,color:'#00000000',symbolColor:'#f2f3fb'}}:{}),
   backgroundColor:'#101116',hasShadow:false,maximizable:false,minimizable:false,show:false,skipTaskbar:taskbarHidden,
   alwaysOnTop:false,resizable:false,movable:false,icon,webPreferences:{autoplayPolicy:'no-user-gesture-required',preload,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
  const currentLayout=()=>expanded?resizeCapsuleLayout(layout(),cap.getBounds(),isEdge()?dock.side:undefined,
   !!compactPanel()&&!cap.isMaximized()&&!(nativeCaption&&cap.isSnapped())):layout();
  const setTaskbarHidden=(hidden:boolean)=>{
   if(taskbarHidden===hidden)return;
   cap.setSkipTaskbar(hidden);
   taskbarHidden=hidden;
  };
  if(process.platform==='win32'){
   if(app.isPackaged){
    // The extracted Electron executable is temporary. Taskbar shortcuts should reopen the portable launcher.
    const portable=process.env.PORTABLE_EXECUTABLE_FILE;
    const launcher=portable&&isAbsolute(portable)&&extname(portable).toLowerCase()==='.exe'&&existsSync(portable)?portable:process.execPath;
    cap.setAppDetails({appId:appUserModelId,appIconPath:launcher,relaunchCommand:`"${launcher}"`,relaunchDisplayName:'ZEN'});
   }
   cap.setAccentColor(false);
   try{cap.setBackgroundMaterial('none');}catch{/* Windows versions without the backdrop attribute use the solid backing. */}
  }
  let desktop:CompanionDesktop|undefined,revision=0,surfaceReady=false,replyEpoch=0;
  const visibility=new CapsuleVisibility();
  let automaticPermissionReview=!smoke,desktopLocked=false;
  let priorityReview:{expanded:boolean;hidden:boolean;minimized:boolean}|undefined;
  let priorityNotice:CompanionNotice|undefined,priorityTimer:ReturnType<typeof setTimeout>|undefined;
  const surfaceVisible=()=>!cap.isDestroyed()&&cap.isVisible()&&!cap.isMinimized();
  let openDialogs=0,editing=false;
  let hoverInput:CapsuleHoverInput={inside:false,blocked:false,reduced:false};
  let nativeGeometryInteraction=false,fromApps=false;
  const animatePanel=()=>settings.motion&&!hoverInput.reduced;
  const panelTransition=new CompanionPanelTransition({
   visible:surfaceVisible,expanded:()=>expanded,quitting:()=>quitting,motionEnabled:animatePanel,
   updateShape:()=>updateShape(),broadcast:()=>broadcast(),
  });
  let blurTimer:ReturnType<typeof setTimeout>|undefined;
  const cancelAutoCollapse=()=>{clearTimeout(blurTimer);blurTimer=undefined;};
  const withWindowDialog=async <T,>(show:()=>Promise<T>)=>{
   cancelAutoCollapse();
   openDialogs++;
   hover.refresh();
   try{return await show();}
   finally{openDialogs--;hover.refresh();}
  };
  const workspaceVisible=(page?:WorkspacePage)=>surfaceVisible()&&expanded&&(page===undefined||workspacePage===page);
  const privateEffectsAllowed=()=>!settings.presentation&&!settings.paused;
  const helloHelper=nativeHelper(__dirname,'vaultHello');
  const helloOwner=()=>cap.getNativeWindowHandle().readBigUInt64LE().toString();
  const helloBinding=process.platform==='win32'?new VaultHelloBinding(join(profile,'passwords-hello.json'),
   windowsVaultHello(helloHelper,helloOwner,'prf'),atomicVaultWrite,windowsVaultHello(helloHelper,helloOwner,'passport')):undefined;
  let linkedProfile: ProfileSync|undefined;
  const vault=registerVaultIpc(companionIpc(cap,rendererUrl,()=>settings.presentation),cap,
   new PasswordVault(join(profile,'passwords.kdbx'),atomicVaultWrite,helloBinding,{
    active: () => privateEffectsAllowed() && Boolean(linkedProfile?.vaultActive()),
    hasCopies: () => privateEffectsAllowed() && Boolean(linkedProfile?.hasVaultCopies()),
    copies: () => privateEffectsAllowed() ? linkedProfile?.vaultCopies() ?? [] : [],
    adopted: bytes => {if(privateEffectsAllowed()) linkedProfile?.adoptedVault(bytes);},
    publish: () => {if(privateEffectsAllowed()) linkedProfile?.syncVault();},
    report: error => linkedProfile?.vaultReport(error),
   }),
   ()=>workspaceVisible('notes')&&!panelTransition.hoverClosing&&privateEffectsAllowed(),
   text=>copyVaultText(nativeHelper(__dirname,'vaultClipboard'),text),withWindowDialog);
  powerMonitor.on('lock-screen',()=>{desktopLocked=true;priorityNotice=undefined;finishPermissionReview(true);vault.lock();});
  powerMonitor.on('unlock-screen',()=>{desktopLocked=false;});
  powerMonitor.on('suspend',vault.lock);
  cap.webContents.on('render-process-gone',vault.lock);
  app.on('before-quit',vault.lock);
  const activityVisible=()=>workspaceVisible()&&isLauncherPageSelected(workspacePage,'codex')&&privateEffectsAllowed();
  const snapshot=(status=hub.status())=>displayStatus({
   ...status,
   oura:privateEffectsAllowed()&&workspaceVisible('metrics')?oura.snapshot():undefined,
   ouraGlance:privateEffectsAllowed()&&!expanded&&surfaceVisible()?oura.glance():undefined,
   ouraHomeSleep:privateEffectsAllowed()&&workspaceVisible('home')?oura.homeSleep():undefined,
   activitySessions:activityVisible()?hub.activitySessions():undefined,
   appearance:appearance.status(),
   workspace:{
    expanded,simpleMode,island:!expanded,islandSizing:false,islandControls:false,page:workspacePage,location:location(),geometry:currentLayout(),
    surfaceVisible:surfaceVisible(),...panelTransition.status(),fromApps,
    islandStacked:compactIslandSize(isEdge()?dockDisplay().workArea:parked.area,isEdge()&&dock.side!=='top').stacked,
    edge:isEdge()?{side:dock.side,railTop:layout().capsule.y}:undefined,
    context:contextPage,...launcherPreferences.status(),recentSection:launcherPreferences.recentSection,compact:'status',
    nativeCaption,layout:workspaceWindow.preferences,canRestorePosition:!!workspaceWindow.previous,
   },
   desktop:desktop?.status(),
  },++revision,surfaceVisible());
  const broadcast=()=>{
   if(cap.isDestroyed())return;
   const status=hub.status();
   cap.webContents.send(companionChannel('status'),snapshot(status));
   if(priorityReview&&(!status.approvalCount||!privateEffectsAllowed()))schedulePermissionReview();
   if(activityVisible()&&!smoke)void refreshActivityTitles();
  };
  const playEffect=(effect:InterfaceEffect)=>{
   if(!cap.isDestroyed()&&surfaceVisible())cap.webContents.send(companionInterfaceEffectChannel,effect);
  };
  function changeSurface(run:()=>void) {
   const current=()=>({island:!expanded,expanded,page:workspacePage,
    disclosure:workspacePage==='options'?'options':workspacePage==='shortcuts'?`shortcuts/${contextPage}`:undefined});
   const before=current();
   run();
   const effect=surfaceSound(before,current());
   if(effect)playEffect(effect);
   return true;
  }
  const observedChatUrl=(id:string)=>codexChatUrl({sessions:hub.activitySessions(),approvals:[],targetError:hub.targetError},id);
  const activateNotice=async(n:CompanionNotice)=>{
   if(n.id==='test'){reveal();return;}
   const status=hub.status();
   if(n.kind!=='permission'){await openExternal(noticeChatUrl(status,n));return;}
   if(!privateEffectsAllowed()||!status.notices.some(notice=>notice.id===n.id))return;
   if(status.approvals.some(approval=>approval.id===n.id)){reveal();changeSurface(()=>openWorkspace('permissions'));return;}
   await openExternal(observedChatUrl(n.session));
  };
  const notify=(n:CompanionNotice)=>{if(smoke||settings.presentation||isSilenced(settings)||!Notification.isSupported()||n.kind==='permission'&&automaticPermissionReview&&nativeCaption)return;const toast=new Notification({title:'ZEN · '+n.title,body:n.id==='test'?'Aviso de prueba de ZEN.':n.kind==='permission'?'Pulsa para revisar la solicitud.':'Pulsa para volver a este chat en Codex.',silent:n.id==='test'||!settings.sounds||(cap.isVisible()&&!cap.isMinimized()),icon});toast.on('click',()=>{void activateNotice(n).catch(()=>{});});toast.show();};
  const hub=new CompanionHub(settings,broadcast,notify,undefined,target,(_event,session,reply)=>{
   if(reply){context.observeReply(session.id,session.cwd,reply);calendar.observe(session.id,session.cwd,reply.text);}
  },queuePermissionReview);hub.targetError=targetError;
  const codexHome=smoke?join(profile,'codex-fixture'):process.env.CODEX_HOME??join(app.getPath('home'),'.codex');
  const replyReader=new CodexReplyReader(codexHome);
  let nextTitleCheck=0;
  async function refreshActivityTitles(){
   if(Date.now()<nextTitleCheck)return;
   const unnamed=hub.activitySessions().filter(session=>!session.title);
   if(!unnamed.length)return;
   nextTitleCheck=Date.now()+10000;
   const titles=await replyReader.observedTitles(unnamed);
   if(!activityVisible())return;
   for(const [id,title] of titles)hub.setTitle(id,title);
  }
  const integration=new CompanionIntegration(profile,codexHome,dirname(nativeHelper(__dirname,'hook')),hub);
  const mediaAllowed=()=>privateEffectsAllowed()&&workspaceVisible('spotify');
  const mediaObservationAllowed=()=>surfaceReady&&privateEffectsAllowed()&&surfaceVisible();
  const smokeMedia = smoke ? createSmokeMedia() : undefined;
  const mediaHelper = nativeHelper(__dirname, 'media');
  const nativeMedia = () => new NativeMediaRpc(mediaHelper);
  const mediaObserver = new CompanionMediaObserver(smokeMedia?.observer ?? nativeMedia, mediaObservationAllowed);
  const media = new CompanionMedia(smokeMedia?.player ?? nativeMedia, mediaAllowed);
  const systemVolume = new CompanionSystemVolume(smokeMedia?.systemVolume ?? nativeMedia,
   () => mediaAllowed()&&!panelTransition.hoverClosing, () => cap.isFocused());
  cap.webContents.on('render-process-gone',()=>systemVolume.close());
  let requestInFlight = false;
  const withRequest = async <T,>(send: () => Promise<T>) => {
   if (requestInFlight) throw Error('Ya hay una petición en curso.');
   requestInFlight = true;
   try { return await send(); }
   finally { requestInFlight = false; }
  };
  const submitRequest = async (thread: string, text: string, verify: () => void | Promise<void>) => {
   if (smoke){
    await verify();
    queuedRequests.push({thread,text});
    return;
   }
   const destination=target;
   const checkDestination=()=>{
    if(!privateEffectsAllowed()||targetError||target!==destination||destination?.session!==thread)
     throw Error('Revisa el chat fijado, Pausa y Presentación antes de enviar a Codex.');
   };
   return queueCodexRequest(thread,text,codexHome,()=>{
    checkDestination();
    return verify();
   },url=>{
    checkDestination();
    return openExternal(url);
   });
  };
  const context=new CompanionContext({
   policy:()=>({visible:workspaceVisible('codex'),presentation:settings.presentation,paused:settings.paused,target,targetError}),
   pick:async verify=>{
    let path:string|undefined;
    if(smoke){
     path=join(profile,'selected-context.txt');
     writeFileSync(path,'Contenido local sintético de la prueba de integración.');
    }else{
     const selected=await withWindowDialog(()=>dialog.showOpenDialog(cap,{title:'Analizar archivo en Codex',properties:['openFile']}));
     if(!selected.canceled&&selected.filePaths.length===1)path=selected.filePaths[0];
    }
    verify();
    return path?contextFile(path):undefined;
   },
   signature:async path=>(await contextFile(path)).signature,
   queue:(thread,text,verify)=>withRequest(()=>submitRequest(thread,text,verify)),
   read:async selected=>{
    if(smoke)return undefined;
    const local=await replyReader.read(selected);
    return preferCompanionReply(hub.lastReply(selected),local);
   },
  });
  const calendar=new CompanionCalendar(join(profile,'companion-calendar.json'),{
   policy:()=>({visible:workspaceVisible('calendar'),allowed:privateEffectsAllowed(),target:targetError?undefined:target}),
   queue:(thread,text,verify)=>withRequest(()=>submitRequest(thread,text,verify)),changed:broadcast,
  });
  const officinaAllowed=()=>!quitting&&!desktopLocked&&privateEffectsAllowed()&&workspaceVisible('officina')&&!panelTransition.hoverClosing;
  const connectOfficina=async()=>{
   const rpc=new CodexRpc(30000,{binary:await desktopCodex(),codexHome});
   try{
    await rpc.initialize(true);
    const {account}=await rpc.request('account/read',{refreshToken:false});
    if(account?.type!=='chatgpt')throw Error('Inicia sesión en Codex con ChatGPT.');
    return rpc;
   }catch(error){rpc.close();throw error;}
  };
  const officinaProvisioning=new OfficinaProvisioning(join(profile,'officina-projects'),connectOfficina,
   (id,cwd,name)=>replyReader.officinaProjectThreads(id,cwd,name));
  const officina=new CompanionOfficina(join(profile,'officina.sqlite'),{
   allowed:officinaAllowed,
   pickContext:kind=>withWindowDialog(async()=>{
    const selection=await dialog.showOpenDialog(cap,kind==='folder'
     ?{title:'Elegir carpeta de trabajo para Officina',properties:['openDirectory']}
     :{title:'Adjuntar archivos al encargo de Officina',properties:['openFile','multiSelections']});
    return selection.canceled?[]:selection.filePaths;
   }),
   verify:binding=>binding.thread===target?.session.toLowerCase()?Promise.resolve(false):
    replyReader.hasDedicatedThread({session:binding.thread,cwd:binding.cwd,title:'Officina'},binding.projectId),
   provision:(...args)=>officinaProvisioning.ensure(...args),
   missingThread:(projectId,cwd,thread)=>replyReader.missingOfficinaThread(projectId,cwd,thread),
   verifyProject:(projectId,cwd)=>replyReader.hasOfficinaProject(projectId,cwd),
   openChat:thread=>openExternal('codex://threads/'+thread),
   openProject:cwd=>openExternal('codex://new?path='+encodeURIComponent(cwd)),
   copyProjectPath:copyText,
   queue:(thread,text,verify,browser)=>withRequest(async()=>{
    const wake=(url:string)=>{
     if(!officinaAllowed())throw Error('La vista de Officina cambió.');
     return openExternal(url);
    };
    if(!browser)return queueCodexRequest(thread,text,codexHome,verify,wake);
    const rpc=await connectOfficina();
    try{return await queueCodexBrowserRequest(rpc,thread,browser.id,text,browser.name,verify,wake);}
    finally{rpc.close();}
   }),
   read:selected=>replyReader.read(selected),
   readTurn:(selected,identity,since)=>replyReader.readOfficinaTurn(selected,identity,since),
   needsPermission:(selected,turn)=>hub.turnNeedsPermission(selected,turn),
   ...(officinaSmokeProfile?makeOfficinaSmokeTeam(profile):undefined),
  });
  powerMonitor.on('lock-screen',()=>officina.suspend(true));
  powerMonitor.on('suspend',()=>officina.suspend(true));
  cap.webContents.on('render-process-gone',()=>officina.suspend(true));
  const smokeOura=smoke?createSmokeOura():undefined;
  const oura=new CompanionOura(join(profile,'companion-oura.bin'),safeStorage,{
   changed:broadcast,allowed:privateEffectsAllowed,
   authorize:(clientId,signal)=>authorizeOura(clientId,url=>shell.openExternal(url),signal),
   ...smokeOura?.dependencies,
  });
  const wakeOura=()=>oura.wake();
  const weatherAllowed=()=>privateEffectsAllowed()&&workspaceVisible('home')&&!panelTransition.hoverClosing;
  const weather=new CompanionWeather(join(profile,'companion-weather.bin'),safeStorage,{
   allowed:weatherAllowed,...(smoke?createSmokeWeather():undefined),
  });
  const translator=new CompanionTranslator(join(profile,'companion-translator.bin'),safeStorage,
   ()=>privateEffectsAllowed()&&workspaceVisible('notes')&&!panelTransition.hoverClosing,
   smoke?smokeTranslatorResponse:undefined);
  let shapeSize='',captionInset=0,workspaceFrame=false;
  let hoverRegion:Area[]=[],capsuleRegion:Area[]=[];
  const desktopHelper=nativeHelper(__dirname,'desktop');
  const frameInsets=new Map<string,{x:number;y:number}>();
  const insetKey=(display:number,workspace=workspaceFrame)=>`${display}:${workspace}`;
  let frameInsetRevision=0;
  let insetProbe:Promise<void>|undefined;
  const cancelFrameInsetProbe=()=>{
   frameInsetRevision++;
   insetProbe=undefined;
  };
  const updateShape=()=>{
   const layout=currentLayout(),bounds=cap.getBounds();
   // Keep the new area clipped until the renderer has drawn its glass and content.
   const geometry=panelTransition.paintToken===undefined?layout:{...layout,panel:undefined};
   const display=screen.getDisplayMatching(bounds).id;
   const inset=(nativeCaption&&!cap.isMaximized()&&
    (frameInsets.get(insetKey(display))??frameInsets.get(insetKey(display,!workspaceFrame))))||{x:0,y:0};
   const side=isEdge()?dock.side:undefined;
   const shown=retractCapsulePanel(geometry,side,panelTransition.retraction);
   const key=JSON.stringify([geometry,shown.panel,side,inset]);
   if(key===shapeSize)return;
   const offset=(rect:Area)=>({...rect,x:rect.x+inset.x,y:rect.y+inset.y});
   // Keep the original area eligible for hover reversal while its uncovered part passes clicks through.
   hoverRegion=capsuleLayoutShape(geometry,side).map(offset);
   capsuleRegion=geometry.panel?capsuleLayoutShape({...geometry,panel:undefined},side).map(offset):hoverRegion;
   cap.setShape(shown===geometry?hoverRegion:capsuleLayoutShape(shown,side).map(offset));
   shapeSize=key;
   captionInset=nativeCaption?workspaceCaptionHeight:0;
  };
  const capturePanelFrame=async()=>{
   const panel=currentLayout().panel;
   if(!panel)return false;
   try{
    // A renderer frame callback precedes Chromium's compositor submission.
    // A one-pixel copy waits for the surface before exposing the new native region.
    const point={x:panel.x+Math.floor(panel.width/2),y:panel.y+Math.floor(panel.height/2),width:1,height:1};
    await cap.webContents.capturePage(point,{stayAwake:true});
   }catch{return false;}
   return true;
  };
  const readFrameInset=()=>{
   if(!nativeCaption||cap.isDestroyed()||cap.isMaximized()||cap.isMinimized())return;
   const insetDisplay=()=>expanded?screen.getDisplayMatching(cap.getBounds()):dockDisplay();
   const {id}=insetDisplay();
   const key=insetKey(id);
   if(frameInsets.has(key)||insetProbe)return insetProbe;
   const revision=frameInsetRevision;
   const insetSchema=z.object({x:z.number().min(0).max(32),y:z.number().min(0).max(32)});
   insetProbe=new Promise<void>(resolve=>{
    execFile(desktopHelper,['--client-inset',cap.getNativeWindowHandle().readBigUInt64LE().toString(),String(process.pid)],{windowsHide:true,timeout:1500},(error,stdout)=>{
     if(revision!==frameInsetRevision){resolve();return;}
     if(!error&&!cap.isDestroyed()&&!cap.isMaximized()&&!cap.isMinimized()&&insetDisplay().id===id){
      try{frameInsets.set(key,insetSchema.parse(JSON.parse(stdout)));updateShape();}catch{/* Retain Windows' usual inset if the sample is unavailable. */}
     }
     insetProbe=undefined;
     resolve();
    });
   });
   return insetProbe;
  };
  const setCaptionTheme=()=>{
   if(nativeCaption)cap.setTitleBarOverlay({height:workspaceCaptionHeight,symbolColor:'#00000000'});
  };
  const positionSurface=(next=layout().bounds)=>{
   const current=cap.getBounds();
   if(Object.keys(next).some(key=>next[key as keyof Area]!==current[key as keyof Area]))cap.setBounds(next);
   updateShape();
  };
  let changingMode=false;
  cap.on('resize',()=>{if(!changingMode)updateShape();});
  cap.on('move',()=>{if(!changingMode&&isEdge()){updateShape();void readFrameInset();}});
  let savePositionTimer:ReturnType<typeof setTimeout>|undefined;
  const workspaceGeometry=()=>{
   const maximized=cap.isMaximized();
   const bounds=maximized?cap.getNormalBounds():cap.getBounds();
   const {id:displayId,workArea:area}=screen.getDisplayMatching(cap.getBounds());
   return {bounds,displayId,area,maximized};
  };
  const rememberWorkspace=()=>{
   clearTimeout(savePositionTimer);
   if(expanded&&!cap.isMinimized()){
    if(workspacePage==='permissions')return;
    if(compactPanel()){
     workspaceWindow.save({mode:'workspace',page:workspacePage,edgeDock:dock});
     return;
    }
    const current=workspaceGeometry();
    if(!current.maximized){
     const view=currentLayout();
     const vertical=isEdge()&&dock.side!=='top';
     parked={...parked,bounds:{...parked.bounds,width:current.bounds.width,height:view.panel!.height+(vertical?0:view.capsule.height)}};
    }
    workspaceWindow.save({mode:'workspace',page:workspacePage,current:{...current,bounds:parked.bounds},edgeDock:dock,...(!isEdge()?{floating:parked}:{})});
   }
  };
  const scheduleWorkspaceSave=()=>{
   if(!expanded||changingMode||cap.isMinimized())return;
   broadcast();
   clearTimeout(savePositionTimer);
   savePositionTimer=setTimeout(rememberWorkspace,250);
  };
  cap.on('move',scheduleWorkspaceSave);
  cap.on('resize',scheduleWorkspaceSave);
  cap.on('unmaximize',scheduleWorkspaceSave);
  const configureWorkspaceFrame=()=>{
   workspaceFrame=true;
   cancelFrameInsetProbe();
   cap.setResizable(true);
   cap.setMovable(!settings.windowLocked);
   cap.setMinimizable(true);
   cap.setMaximizable(true);
   setTaskbarHidden(false);
   cap.setTitle('ZEN');
   if(cap.isMaximized())cap.unmaximize();
  };
  const setWorkspaceMinimum=()=>{
   const area=isEdge()?dockDisplay().workArea:parked.area;
   const compact=compactPanel();
   const height=compact?Math.max(surfaceBounds().height,Math.min(workspaceMinimum.height,compact.height)):workspaceMinimum.height;
   cap.setMinimumSize(Math.min(workspaceMinimum.width,area.width),Math.min(height,area.height));
  };
  const enterWorkspace=(byHover=false,restore?:WorkspaceGeometry)=>{
   changingMode=true;
   expanded=true;
   if(!byHover||cap.isFocused())configureWorkspaceFrame();
   if(workspaceFrame)setWorkspaceMinimum();
   // Normal bounds can include the native caption reserve outside the work area.
   const monitor=restore&&screen.getAllDisplays().find(display=>display.id===restore.displayId);
   const bounds=restore&&(monitor&&JSON.stringify(monitor.workArea)===JSON.stringify(restore.area)
    ?restore.bounds:restoreWorkspace(restore,screen.getAllDisplays(),activeDisplay()));
   positionSurface(bounds);
   if(restore?.maximized)cap.maximize();
   updateShape();
   void readFrameInset();
   changingMode=false;
   rememberWorkspace();
  };
  cap.on('maximize',()=>{scheduleWorkspaceSave();broadcast();});
  const rememberRail=()=>workspaceWindow.save({mode:'capsule',page:workspacePage==='permissions'?permissionReturnPage:workspacePage,current:parked,edgeDock:dock,...(!isEdge()?{floating:parked}:{})});
  const leaveWorkspace=()=>{
   vault.lock();
   systemVolume.close();
   weather.cancel();
   translator.cancel();
   clearTimeout(savePositionTimer);
   panelTransition.reset();
   changingMode=true;
   if(cap.isMaximized())cap.unmaximize();
   expanded=false;
   if(workspaceFrame){
    workspaceFrame=false;
    cap.setMinimumSize(0,0);
    cap.setMovable(false);
    cap.setResizable(false);
    cancelFrameInsetProbe();
    setTaskbarHidden(settings.hideCapsuleFromTaskbar);
    cap.setTitle('ZEN · Cápsula');
   }
   positionSurface();
   void readFrameInset();
   changingMode=false;
   rememberRail();
  };
  const applyWorkspaceLayout=(action:WorkspaceLayoutAction)=>{
   if(simpleMode)toggleSimpleMode();
   const before=workspaceGeometry(),previous=workspaceWindow.previous;
   const displays=screen.getAllDisplays(),monitor=screen.getDisplayMatching(cap.getBounds());
   if(action==='restore'&&!previous)return;
   if(action==='maximize'&&before.maximized)return;
   if(!workspaceWindow.save({previous:before}))throw Error('No se pudo guardar la posición anterior.');
   if(action==='maximize')cap.maximize();
   else{
    if(before.maximized)cap.unmaximize();
    if(action==='restore'){
     if(previous)cap.setBounds(restoreWorkspace(previous,displays,monitor));
    }else {parked={...parked,area:monitor.workArea,displayId:monitor.id,bounds:workspaceLayout(monitor.workArea,action)};positionSurface();}
    if(action==='restore'&&previous?.maximized)cap.maximize();
   }
   if(action==='restore'&&previous){parked={...previous,bounds:restoreWorkspace(previous,displays,monitor)};positionSurface();}
   rememberWorkspace();broadcast();
  };
  const setTopmost=()=>{
   const next=settings.alwaysOnTop||!!priorityReview;
   // Electron's default level inserts the window behind the taskbar HWND on Windows.
   // That can clear topmost when the taskbar is in the normal z-order band.
   if(cap.isAlwaysOnTop()!==next)cap.setAlwaysOnTop(next,nativeCaption?'pop-up-menu':undefined);
  };
  function queuePermissionReview(notice:CompanionNotice){
   if(!automaticPermissionReview||!nativeCaption||!privateEffectsAllowed()||desktopLocked||quitting)return;
   priorityNotice=notice;
   schedulePermissionReview();
  }
  function schedulePermissionReview(delay=0){
   if(priorityTimer||quitting)return;
   priorityTimer=setTimeout(()=>{
    priorityTimer=undefined;
    if(cap.isDestroyed()||quitting)return;
    if(!privateEffectsAllowed()||desktopLocked){priorityNotice=undefined;finishPermissionReview(true);return;}
    if(priorityReview&&!hub.status().approvalCount)finishPermissionReview(true);
    const notice=priorityNotice;
    if(!notice||!hub.isPendingPermission(notice)){priorityNotice=undefined;return;}
    if(!surfaceReady||openDialogs||dragTimer||nativeGeometryInteraction){schedulePermissionReview(100);return;}
    priorityNotice=undefined;
    priorityReview??={expanded:expanded&&workspacePage!=='permissions',hidden:visibility.hidden,minimized:cap.isMinimized()};
    changeSurface(()=>openWorkspace('permissions'));
    setTopmost();
    if(!surfaceVisible())cap.showInactive();
    cap.moveTop();
    broadcast();
   },delay);
  }
  function finishPermissionReview(restore:boolean){
   const previous=priorityReview;
   if(!previous)return false;
   priorityReview=undefined;
   setTopmost();
   if(restore){
    if(previous.expanded)openWorkspace(permissionReturnPage);
    else collapse();
    if(previous.minimized)hide();
    else if(previous.hidden){visibility.hide();cap.hide();}
   }
   return true;
  }
  const fullscreenHere=()=>{const r=desktop?.observation?.fullscreen;return !!(settings.respectFullscreen&&r&&overlaps(screen.screenToDipRect(null,r),screen.getDisplayMatching(cap.getBounds()).bounds));};
  const syncVisibility=()=>{
   if(!surfaceReady||cap.isDestroyed()||visibility.hidden||cap.isMinimized())return;
   if(expanded||visibility.visible(fullscreenHere(),desktop?.observation?.foreground)){
    if(!cap.isMinimized()&&!cap.isVisible())cap.showInactive();
   }else if(cap.isVisible())cap.hide();
  };
  const secure=(w:BrowserWindow,url:string)=>{w.setMenu(null);w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',(e,next)=>{if(next!==url)e.preventDefault();});w.webContents.on('will-frame-navigate',e=>{if(!e.isMainFrame)e.preventDefault();});w.webContents.on('did-finish-load',broadcast);w.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));};
  secure(cap,rendererUrl);
  cap.webContents.session.protocol.handle('zen-theme',request=>{
   try{
    const u=new URL(request.url);
    if(request.method!=='GET'||u.hash)throw Error();
    const reference=u.hostname==='template'&&/^\/([a-f\d-]{36})\/(thumbnail|reference)$/i.exec(u.pathname);
    let image:{bytes:Buffer;mime:string};
    if(reference&&workspaceVisible('notes')&&privateEffectsAllowed()&&/^\?v=\d+$/.test(u.search)){
     const stored=notes.referenceImage(reference[1],reference[2]==='thumbnail');
     if(!stored)throw Error();
     image=stored;
    }else if(u.hostname==='background'&&!u.search&&!settings.presentation){
     image={bytes:appearance.image(u.pathname.slice(1)),mime:'image/png'};
    }else throw Error();
    return new Response(new Uint8Array(image.bytes),{headers:{'Content-Type':image.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
     'Content-Security-Policy':"default-src 'none'; sandbox"}});
   }catch{return new Response(null,{status:404});}
  });
  const invalidateContext=()=>{context.invalidate();replyEpoch++;};
  const rememberFullFrame=()=>{
   rememberWorkspace();
   fullFrame={geometry:workspaceGeometry(),anchor:surfaceBounds(),location:location()};
  };
  const savedFullFrame=()=>{
   const anchor=surfaceBounds();
   if(fullFrame?.location===location()&&
    (Object.keys(anchor) as (keyof Area)[]).every(key=>anchor[key]===fullFrame?.anchor[key]))return fullFrame.geometry;
  };
  const openWorkspace=(page:WorkspacePage,byHover=false,fromLauncher=byHover)=>{
   if(page!=='permissions')finishPermissionReview(false);
   if(workspacePage!==page){officina.suspend();vault.lock();systemVolume.close();weather.cancel();translator.cancel();}
   cancelAutoCollapse();
   if(!byHover)hover.selectExplicitly();
   if(expanded&&workspacePage===page){broadcast();return;}
   endDrag();
   const before=compactPanel();
   if(page==='permissions'){
    const status=hub.status();
    permissionPanel=permissionPanelSize(status.approvals[0]?.preview,status.approvalCount);
   }
   const next=compactPanel(page);
   const resize=before!==next;
   if(expanded&&resize&&!before)rememberFullFrame();
   if(page==='permissions')permissionReturnPage=workspacePage;
   else launcherPreferences.visit(page);
   if(workspacePage!==page)invalidateContext();
   workspacePage=page;
   fromApps=fromLauncher;
   if(page==='notices')hub.markNoticesRead();
   visibility.invoke();
   if(!expanded||resize){
    if(!expanded&&byHover)panelTransition.prepareHoverOpen();
    enterWorkspace(byHover,!next&&(before||simpleMode)?savedFullFrame():undefined);
   }
   syncVisibility();
   broadcast();
   if(!byHover)hover.refresh();
   if(page==='calendar')void refreshLastReply();
  };
  const toggleSimpleMode=()=>{
   if(workspacePage==='permissions'){simpleMode=!simpleMode;broadcast();return;}
   const before=compactPanel();
   if(!simpleMode&&expanded&&workspacePage!=='notes')rememberFullFrame();
   simpleMode=!simpleMode;
   const restore=!simpleMode?savedFullFrame():undefined;
   if(!simpleMode)fullFrame=undefined;
   if(!expanded&&simpleMode){changeSurface(()=>openWorkspace(workspacePage));return;}
   if(expanded){if(before||compactPanel())enterWorkspace(false,restore);}
   else positionSurface();
   broadcast();
   hover.refresh();
  };
  const collapse=()=>{
   cancelAutoCollapse();
   if(openDialogs)return;
   if(finishPermissionReview(true))return;
   endDrag();
   if(expanded){
    officina.suspend();
    invalidateContext();
    if(workspacePage==='permissions')workspacePage=permissionReturnPage;
    leaveWorkspace();hover.collapsed();
   }
   broadcast();syncVisibility();
  };
  const showCapsule=(explicit=true)=>{
   if(cap.isDestroyed())return;
   if(!expanded&&explicit&&!settings.windowLocked&&settings.followPointerDisplay&&!smoke){
    const d=screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    if(d.id!==(isEdge()?dock.displayId:parked.displayId)){
     if(isEdge())dock={...dock,displayId:d.id};
     else parked=fitDisplay(parked,[d],d);
     positionSurface();
     rememberRail();
    }
   }
   visibility.invoke(explicit&&fullscreenHere()?desktop?.observation?.foreground:undefined);
   if(explicit&&cap.isMinimized())cap.restore();
   syncVisibility();
   if(explicit&&surfaceVisible()&&!cap.isFocused())cap.focus();
   broadcast();
  };
  reveal=()=>showCapsule();
  const endDrag=()=>{clearInterval(dragTimer);clearTimeout(dragLimit);dragTimer=undefined;if(moved){moved=false;if(expanded)rememberWorkspace();else rememberRail();}};
  const moveRail=(monitor:ReturnType<typeof activeDisplay>,bounds:Area)=>{
   parked={displayId:monitor.id,area:monitor.workArea,bounds:placeWorkspaceRail(monitor.workArea,bounds),maximized:false};
   positionSurface();broadcast();
  };
  const drag=()=>{
   if(settings.windowLocked||!surfaceVisible())return;
   endDrag();
   const start=screen.getCursorScreenPoint(),rail=surfaceBounds();
   const panel=parked.maximized?parked.area:parked.bounds;
   const grabX=(start.x-rail.x)/rail.width,grabY=start.y-rail.y;
   dragTimer=setInterval(()=>{
    const cursor=screen.getCursorScreenPoint();
    if(!moved&&Math.hypot(cursor.x-start.x,cursor.y-start.y)<4)return;
    moved=true;
    const monitor=screen.getDisplayNearestPoint(cursor),area=monitor.workArea;
    if(isEdge()){
     if(dock.side==='top'){
      dock={side:'top',displayId:monitor.id,fraction:Math.min(1,Math.max(0,(cursor.x-grabX*rail.width+rail.width/2-area.x)/area.width))};
      positionSurface();broadcast();
      return;
     }
     const middle=area.x+area.width/2;
     const side=cursor.x<middle-24?'left':cursor.x>middle+24?'right':dock.side;
     const caption=nativeCaption?EDGE_ISLAND.captionReserve:0;
     const fraction=Math.min(1,Math.max(0,(cursor.y-grabY+(rail.height+caption)/2-area.y)/area.height));
     dock={side,displayId:monitor.id,fraction};
     positionSurface();
     broadcast();
     return;
    }
    {
     const bounds=railFromIsland(area,panel,Math.round(cursor.x-grabX*rail.width),cursor.y-grabY+captionInset);
     moveRail(monitor,bounds);
     return;
    }
   },30);
   dragLimit=setTimeout(()=>{endDrag();hover.refresh();},30000);
  };
  const hover=new CompanionHover({
   sample:()=>{
    const visible=nativeCaption&&(!smoke||hoverSmoke)&&surfaceReady&&!quitting&&surfaceVisible();
    const bounds=visible?cap.getBounds():undefined;
    const cursor=bounds?screen.getCursorScreenPoint():undefined;
    const over=(region:Area[])=>Boolean(bounds&&cursor&&region.some(rect=>
     cursor.x>=bounds.x+rect.x&&cursor.x<bounds.x+rect.x+rect.width&&
     cursor.y>=bounds.y+rect.y&&cursor.y<bounds.y+rect.y+rect.height));
    return {visible,expanded,page:workspacePage,overCapsule:over(capsuleRegion),overWorkspace:expanded&&over(hoverRegion),
     blocked:!!(openDialogs||dragTimer||nativeGeometryInteraction||hoverInput.blocked),
     holdOpen:!!(hoverInput.holdOpen&&(compactPanel()||workspacePage==='notes'||workspacePage==='officina')&&cap.isFocused()),
     locked:settings.windowLocked||!!priorityReview,animate:animatePanel()};
   },
   open:page=>changeSurface(()=>openWorkspace(page,true)),
   close:()=>changeSurface(collapse),
   previewClose:closing=>{
    if(closing){officina.suspend();systemVolume.close();weather.cancel();translator.cancel();}
    panelTransition.previewClose(closing,closing?vault.lockBeforeTransition():undefined);
   },
  });
  if(nativeCaption){
   cap.hookWindowMessage(0x0231,()=>{nativeGeometryInteraction=true;hover.refresh();}); // WM_ENTERSIZEMOVE
   cap.hookWindowMessage(0x0232,()=>{nativeGeometryInteraction=false;hover.refresh();}); // WM_EXITSIZEMOVE
  }
  const hide=()=>{finishPermissionReview(false);rememberWorkspace();cancelAutoCollapse();endDrag();media.close();visibility.hide();setTaskbarHidden(false);cap.minimize();};
  const dismissOnOutsideClick=()=>{
   if(!expanded&&settings.dismissCapsuleOnOutsideClick&&surfaceReady&&!quitting&&!visibility.hidden&&!openDialogs&&!dragTimer&&surfaceVisible())hide();
  };
  desktop=new CompanionDesktop(desktopHelper,()=>{syncVisibility();broadcast();},{
   windowHandle:cap.getNativeWindowHandle().readBigUInt64LE().toString(),
   dismiss:dismissOnOutsideClick,
  });
  cap.on('close',event=>{
   if(quitting)return;
   event.preventDefault();
   hide();
  });
  const canAutoCollapse=()=>!nativeCaption&&expanded&&settings.collapseOnBlur&&!settings.windowLocked&&!settings.keepExpanded&&!priorityReview&&
   !editing&&!dragTimer&&!moved&&!openDialogs&&!requestInFlight&&!quitting&&surfaceVisible();
  cap.on('blur',()=>{
   vault.conceal();
   const eligible=canAutoCollapse();
   endDrag();
   hover.refresh();
   cancelAutoCollapse();
   if(eligible)blurTimer=setTimeout(()=>{if(canAutoCollapse()&&!cap.isFocused())collapse();},ISLAND_BLUR_MS);
  });
  cap.on('focus',()=>{
   cancelAutoCollapse();
   if(!expanded||workspaceFrame||changingMode)return;
   changingMode=true;
   configureWorkspaceFrame();
   setWorkspaceMinimum();
   changingMode=false;
   updateShape();
   void readFrameInset();
  });
  cap.on('restore',()=>{
   visibility.invoke();
   if(!expanded)setTaskbarHidden(settings.hideCapsuleFromTaskbar);
   updateShape();
   syncVisibility();
   broadcast();
  });
  const hidePrivateContent=()=>{officina.suspend();finishPermissionReview(false);vault.lock();panelTransition.reset();hoverInput={reduced:hoverInput.reduced,inside:false,blocked:false};hover.reset();invalidateContext();mediaObserver.close();systemVolume.close();weather.cancel();translator.cancel();broadcast();};
  cap.on('hide',hidePrivateContent);
  cap.on('minimize',()=>{setTaskbarHidden(false);hidePrivateContent();});
  const reposition=()=>{
   endDrag();
   if(expanded&&!cap.isMinimized()&&!cap.isMaximized()&&!(nativeCaption&&cap.isSnapped())){
    const current=cap.getBounds(),monitor=screen.getDisplayMatching(current),area=monitor.workArea;
    const visibleTitleWidth=Math.min(current.x+current.width,area.x+area.width)-Math.max(current.x,area.x);
    const titleVisible=current.y>=area.y&&current.y+26<=area.y+area.height;
    if(!titleVisible||visibleTitleWidth<Math.min(120,current.width))cap.setBounds(fitWorkspace(area,current));
   }else if(!expanded){parked=fitDisplay(parked);positionSurface();}
   if(isEdge()){updateShape();broadcast();}
   syncVisibility();
  };
  const refreshDisplays=()=>{
   cancelFrameInsetProbe();
   frameInsets.clear();
   const display=dockDisplay();
   if(isEdge()&&display.id!==dock.displayId){
    dock={...dock,displayId:display.id};
    workspaceWindow.save({edgeDock:dock});
    if(expanded&&!cap.isMinimized()&&!cap.isMaximized()){
     if(compactPanel())setWorkspaceMinimum();
     else {const minimum=activeWorkspaceMinimum();cap.setMinimumSize(minimum.width,minimum.height);}
     positionSurface();
    }
   }
   reposition();
   void readFrameInset();
  };
  screen.on('display-added',refreshDisplays);screen.on('display-removed',refreshDisplays);screen.on('display-metrics-changed',refreshDisplays);
  const openCurrent=async()=>{await openExternal(codexChatUrl(hub.status()));};
  const tray=new Tray(icon);tray.setToolTip('ZEN · Codex');tray.setContextMenu(Menu.buildFromTemplate([{label:'Abrir ZEN',click:()=>{reveal();if(!expanded)openWorkspace(workspacePage);}},{label:'Mostrar cápsula',click:()=>{if(expanded)collapse();reveal();}},{label:'Volver al chat de Codex',click:()=>void openCurrent()},{label:'Volver a mi aplicación',click:()=>void desktop?.restore().catch(()=>{})},{type:'separator'},{label:'Salir de ZEN',click:()=>app.quit()}]));tray.on('click',reveal);
  let shortcutIssue:string|undefined,checking:Promise<boolean>|undefined;
  let replyRead:Promise<void>|undefined;
  const replyVisible=()=>!smoke&&!targetError&&workspaceVisible('calendar')&&calendar.waiting&&privateEffectsAllowed();
  const refreshLastReply=()=>{
   const selected=target;
   if(!selected||!replyVisible()||replyRead)return replyRead;
   const epoch=replyEpoch;
   replyRead=replyReader.read(selected).then(reply=>{
    if(reply&&epoch===replyEpoch&&replyVisible()){calendar.observe(selected.session,selected.cwd,reply.text);hub.setLastReply(selected.session,selected.cwd,reply);}
   }).catch(()=>{
    // Preserve the last observed answer if local recovery fails.
   }).finally(()=>{replyRead=undefined;});
   return replyRead;
  };
  const replyTicker=setInterval(()=>{void refreshLastReply();},4000);
  const check=()=>checking??=(async()=>{
   hub.checking=true;hub.error=shortcutIssue;broadcast();let rpc:CodexRpc|undefined;
   try{await integration.refresh();rpc=new CodexRpc();await rpc.initialize();const result=await inspectCodexCompanion(rpc,integration.command,app.getPath('home'),hub.status().sessions);hub.account=result.account;hub.connection=result.connection;for(const [id,title]of result.titles)hub.setTitle(id,title);return true;}
   catch{hub.connection={...hub.connection,state:'unavailable',checkedAt:Date.now()};hub.error='No se pudo comprobar Codex. Ábrelo y vuelve a comprobar la conexión.';return false;}
   finally{rpc?.close();hub.checking=false;checking=undefined;broadcast();}
  })();
  const handle=companionIpc(cap,rendererUrl,()=>settings.presentation);
  handle('translator',TranslatorAction,action=>translator.handle(action));
  handle('weather',WeatherAction,async action=>{
   if(!weatherAllowed())throw Error('Abre Home y desactiva Pausa o Presentación para consultar el clima.');
   if(action.type==='provider'){await openExternal('https://openweathermap.org/');return weather.status();}
   const result=action.type==='refresh'?await weather.refresh(action.force):await weather.configure(action);
   if(!weatherAllowed())throw Error('La vista de Clima se cerró.');
   broadcast();
   return result;
  });
  handle('oura',OuraAction,async action=>{
   if(!workspaceVisible('metrics')||!privateEffectsAllowed())throw Error('Abre Métricas y desactiva Pausa o Presentación.');
   switch(action.type){
    case 'refresh':await oura.refresh();break;
    case 'connect':await oura.connect(action.clientId);break;
    case 'cancel':oura.cancel();break;
    case 'capsule':oura.setCapsule(action.mode);break;
    case 'legal':await openExternal(ouraLegal[action.page]);break;
    case 'disconnect':{
     const answer=smoke?0:(await withWindowDialog(()=>dialog.showMessageBox(cap,{type:'question',title:'Desconectar Oura',
      message:'¿Desconectar Oura?',detail:'ZEN eliminará la sesión y las métricas guardadas en este equipo. Conservará el Client ID para volver a conectar.',
      buttons:['Desconectar','Cancelar'],defaultId:1,cancelId:1}))).response;
     if(answer!==0)return false;
     if(!workspaceVisible('metrics')||!privateEffectsAllowed())throw Error('Vuelve a Métricas para desconectar Oura.');
     oura.disconnect();break;
    }
   }
   return true;
  });
  const none=z.undefined();
  const setLocation=(next:CapsuleLocation)=>{
   if(!surfaceVisible())throw Error('Muestra ZEN para elegir su ubicación.');
   const previous=location();
   if(next===previous)return true;
   const monitor=previous==='floating'?screen.getDisplayMatching(cap.getBounds()):dockDisplay();
   const before=expanded&&!compactPanel()?workspaceGeometry():parked;
   endDrag();
   const floating=previous==='floating'?before:workspaceWindow.floating;
   const nextDock:EdgeDock=next==='floating'?dock:{side:next,displayId:monitor.id,fraction:next==='top'||dock.side==='top'?.5:dock.fraction};
   if(!workspaceWindow.save({preferences:{...workspaceWindow.preferences,location:next},edgeDock:nextDock,floating}))throw Error('No se pudo guardar la ubicación.');
   dock=nextDock;
   if(next==='floating')parked=floating?fitDisplay(floating,screen.getAllDisplays(),monitor):{
    displayId:monitor.id,area:monitor.workArea,bounds:workspaceLayout(monitor.workArea,workspaceWindow.preferences.side),maximized:false,
   };
   if(expanded)enterWorkspace();
   else{positionSurface();rememberRail();}
   setCaptionTheme();
   updateShape();
   void readFrameInset();
   broadcast();
   playEffect('navigate');
   return true;
  };
  handle('capsuleLocation',CapsuleLocation,setLocation);
  const requireWorkspace=(page?:WorkspacePage)=>{
   if(!workspaceVisible(page))throw Error('Abre la sección correspondiente en ZEN.');
  };
  handle('officina',OfficinaAction,action=>officina.handle(action));
  handle('status',none,snapshot);
  handle('calendar',CalendarAction,async action=>{
   requireWorkspace('calendar');
   if(action.type==='read')return calendar.snapshot();
   if(action.type==='create')return calendar.create(action.draft);
   return calendar.refresh(action.range,action.sources);
  });
  handle('check',none,()=>smoke?true:check());
  handle('openCodex',z.string().max(160).optional(),async id=>{
   const status=hub.status();
   const observedNotice=id&&privateEffectsAllowed()&&workspaceVisible('notices')&&status.notices.some(n=>n.kind==='permission'&&n.session===id);
   await openExternal(id&&(activityVisible()||observedNotice)&&id!==status.target?.session?observedChatUrl(id):codexChatUrl(status,id));
   return true;
  });
  handle('returnApp',none,()=>{if(!desktop)throw Error('Control de ventanas no disponible.');return desktop.restore();});
  handle('openRequest', CodexRequest, text => {
   const verify = () => {
    if (!workspaceVisible('home') || !privateEffectsAllowed()) throw Error('Abre Home y desactiva la pausa o Presentación.');
   };
   verify();
   if (targetError) throw Error(targetError);
   const fixedChat = target;
   return withRequest(() => openCodexRequest(text, {
    queue: fixedChat && (value => submitRequest(fixedChat.session,value,verify)),
    copy: value => {if (smoke) copiedRequests.push(value); else clipboard.writeText(value);},
    open: openExternal,
   }));
  });
  handle('openSpotify', none, async () => {
   if (settings.presentation) throw Error('Desactiva Presentación para abrir Spotify.');
   await openExternal('https://open.spotify.com/');
   return true;
  });
  const appearanceWindow=()=>{if(!workspaceVisible('settings')||settings.presentation)throw Error('Abre Apariencia y desactiva Presentación.');};
  handle('appearanceSave',AppearanceOptions,value=>{appearanceWindow();const result=appearance.save(value);setCaptionTheme();broadcast();return result;});
  handle('appearanceChoose',none,async()=>{appearanceWindow();if(smoke){
   const path=join(profile,'appearance-fixture.png'),size=256,bitmap=Buffer.alloc(size*size*4);
   for(let pixel=0;pixel<size*size;pixel++){
    const value=pixel%size%16<8?255:0;
    bitmap.set([value,value,value,255],pixel*4);
   }
   writeFileSync(path,nativeImage.createFromBitmap(bitmap,{width:size,height:size}).toPNG());
   const result=appearance.import(path);broadcast();return result;
  }const picked=await withWindowDialog(()=>dialog.showOpenDialog(cap,{title:'Imagen de fondo de ZEN',properties:['openFile'],filters:[{name:'Imagen de fondo',extensions:['png','jpg','jpeg','webp']}]}));appearanceWindow();if(picked.canceled||picked.filePaths.length!==1)return appearance.status();const result=appearance.import(picked.filePaths[0]);broadcast();return result;});
  handle('mediaNowPlaying',none,()=>mediaObservationAllowed()?mediaObserver.read():null);
  handle('mediaObservationClose',none,()=>{mediaObserver.close();return true;});
  handle('navigate',WorkspacePage,page=>changeSurface(()=>openWorkspace(page)));
  registerNotesIpc(handle, {
   notes, window: cap, requireWorkspace, privateEffectsAllowed, withWindowDialog, copy: copyText, openExternal,
  });
  handle('togglePage',SectionPage,page=>{
   if(!surfaceVisible()||openDialogs)throw Error('Vuelve a la cápsula para cambiar de sección.');
   changeSurface(()=>openWorkspace(expanded&&isLauncherPageSelected(workspacePage,page)?workspacePage:page,false,true));
   return {expanded,page:workspacePage,revision};
  });
  handle('togglePanel',none,()=>{
   if(!surfaceVisible()||openDialogs)throw Error('Vuelve a la cápsula para cambiar de sección.');
   changeSurface(()=>{if(expanded)collapse();else openWorkspace(workspacePage);});
   return {expanded,page:workspacePage,revision};
  });
  handle('launcher',z.boolean(),open=>changeSurface(()=>{if(open)openWorkspace(workspacePage);else collapse();}));
  handle('island',z.boolean(),compact=>changeSurface(()=>{
   if(!surfaceVisible())throw Error('Muestra ZEN para cambiar la vista.');
   if(compact)collapse();else openWorkspace(workspacePage);
  }));
  handle('islandFocusGuard',z.boolean(),blocked=>{editing=blocked;if(blocked)cancelAutoCollapse();return true;});
  handle('capsuleHover',CapsuleHoverInput,input=>{
   hoverInput=input;
   hover.pointer(input.inside?input.app:undefined);
   return true;
  });
  handle('panelPainted',z.number().int().positive(),token=>panelTransition.confirmPaint(token,capturePanelFrame));
  handle('compact',CapsuleView,view=>changeSurface(()=>{if(view==='status')collapse();else openWorkspace(view);visibility.invoke();syncVisibility();broadcast();}));
  handle('launcherOrder',LauncherOrder,order=>{launcherPreferences.reorder(order);broadcast();return true;});
  handle('options',none,()=>changeSurface(()=>openWorkspace('options')));
  handle('launcherContext',LauncherPage,page=>changeSurface(()=>{contextPage=page;openWorkspace('shortcuts');}));
  handle('mediaCurrent',none,()=>media.current());
  handle('systemVolume',SystemVolumeAction,action=>systemVolume.request(action));
  handle('mediaSnapshot',z.literal(true).optional(),followSystem=>media.snapshot(followSystem));
  handle('mediaList',none,()=>media.list());
  handle('mediaSelect',z.uuid(),id=>media.select(id));
  handle('mediaRead',z.uuid(),id=>media.read(id));
  handle('mediaCommand',MediaCommand,value=>media.command(value));
  handle('mediaClose',z.enum(['workspace','compact']).optional(),scope=>{
   if(scope===undefined||scope==='workspace')media.close();
   return true;
  });
  handle('contextStatus',none,()=>context.status());
  handle('contextChoose',none,()=>context.choose());
  handle('contextPrepare',ContextInput,input=>context.prepare(input));
  handle('contextCancel',z.uuid(),id=>{context.cancel(id);return true;});
  handle('contextHandoff',z.uuid(),id=>context.handoff(id));
  handle('contextResult',none,()=>context.result());
  handle('contextSource',CodexReferenceSelection,selection=>context.source(selection));
  handle('decide',z.object({id:z.uuid(),decision:z.enum(['allow','deny','pass'])}).strict(),async value=>{
   if(!activityVisible())throw Error('Abre Permisos de Codex para revisar la solicitud.');
   const approval=hub.status().approvals.find(item=>item.id===value.id);
   if(!approval)throw Error('Esta solicitud ya terminó o caducó.');
   if(target&&approval.session!==target.session&&workspacePage!=='permissions')throw Error('Abre Permisos de Codex para revisar la solicitud de este chat.');
   const destination=value.decision==='pass'?observedChatUrl(approval.session):undefined;
   hub.decide(value.id,value.decision);
   if(destination)await openExternal(destination);
   return true;
  });
  handle('install',none,async()=>{requireWorkspace('settings');await integration.install();if(!smoke)void check();return true;});
  const persist=(v:CompanionSettings)=>{
   if(v.shortcut.toLowerCase()===v.returnShortcut.toLowerCase())throw Error('Usa atajos diferentes para la cápsula y el chat.');
   const changed=v.shortcut!==settings.shortcut||v.returnShortcut!==settings.returnShortcut;
   const lockChanged=v.windowLocked!==settings.windowLocked;
   if(changed&&!smoke)registerCompanionShortcuts(globalShortcut,v,reveal,()=>void openCurrent(),settings);
   try{writeFileSync(file+'.tmp',JSON.stringify(v,null,2));renameSync(file+'.tmp',file);}
   catch{if(changed&&!smoke)registerCompanionShortcuts(globalShortcut,settings,reveal,()=>void openCurrent(),v);throw Error('No se pudieron guardar las preferencias.');}
   if(!expanded&&!cap.isMinimized())setTaskbarHidden(v.hideCapsuleFromTaskbar);
   if(lockChanged&&v.windowLocked)endDrag();
   if(workspaceFrame&&lockChanged)cap.setMovable(!v.windowLocked);
   if(lockChanged||!v.collapseOnBlur||v.keepExpanded)cancelAutoCollapse();
   const ouraPolicyChanged=v.paused!==settings.paused||v.presentation!==settings.presentation;
   settings=v;
   setTopmost();
   if(ouraPolicyChanged)oura.policyChanged();
   if(lockChanged){
    // The panel is still clipped here, so locking the visible capsule cancels the reveal.
    if(v.windowLocked&&panelTransition.paintToken!==undefined)collapse();
    hover.lockChanged();
   }
   if(changed){shortcutIssue=undefined;hub.error=undefined;}
   hub.update(v);
   if(v.presentation||v.paused){officina.suspend(true);vault.lock();context?.clear();replyEpoch++;media?.close();mediaObserver?.close();systemVolume.close();weather.cancel();translator.cancel();}
   syncVisibility();
   hover.refresh();
   return true;
  };
  handle('save',CompanionSettingsSchema,value=>{requireWorkspace('settings');return persist({...value,windowLocked:settings.windowLocked,keepExpanded:settings.keepExpanded});});
  handle('keepExpanded',z.boolean(),enabled=>{
   if(!surfaceVisible())throw Error('Muestra ZEN para cambiar esta preferencia.');
   return enabled===settings.keepExpanded||persist({...settings,keepExpanded:enabled});
  });
  registerProfileBackupIpc(handle, {
   window: cap, profile, requireSettings: () => requireWorkspace('settings'), privateEffectsAllowed, withWindowDialog,
   getSources: () => ({appearance, launcher: launcherPreferences, notes, settings,calendar}), saveSettings: persist,
   broadcast: () => {setCaptionTheme();broadcast();},
  });
  const syncSources = () => ({appearance, launcher: launcherPreferences, notes, settings, calendar});
  const profileSync = new ProfileSync(profile, safeStorage, {
   fingerprint: () => profileFingerprint(profile),
   snapshot: () => snapshotBackup(syncSources()),
   apply: (next, previous, first) => {
    restoreBackup(profile, syncSources(), next, persist, {previous, first});
    setCaptionTheme();broadcast();
   },
  });
  linkedProfile = profileSync;
  registerProfileSyncIpc(handle, {
   window: cap, sync: profileSync, requireSettings: () => requireWorkspace('settings'),
   privateEffectsAllowed, withWindowDialog,
   copyPrivate: text => copyVaultText(nativeHelper(__dirname,'vaultClipboard'),text),
  });
  const profileSyncTicker = setInterval(() => {
   if (quitting || !privateEffectsAllowed()) return;
   profileSync.syncVault();
   if (!workspaceVisible('notes') && !workspaceVisible('settings')) profileSync.run(false);
  }, 12_000);
  app.once('before-quit', () => clearInterval(profileSyncTicker));
  handle('pinWindow',z.boolean(),enabled=>{
   if(!surfaceVisible())throw Error('Muestra ZEN para cambiar el candado.');
   return enabled===settings.windowLocked||persist({...settings,windowLocked:enabled});
  });
  handle('sound',z.boolean(),enabled=>persist({...settings,sounds:enabled}));
  handle('presentation',z.boolean(),enabled=>persist({...settings,presentation:enabled}));
  handle('silence',z.union([z.literal(0),z.literal(30)]),minutes=>persist({...settings,silencedUntil:minutes?Date.now()+minutes*60000:0}));
  handle('testNotice',none,()=>{requireWorkspace('settings');if(settings.presentation)throw Error('Desactiva Presentación para probar avisos.');if(isSilenced(settings))throw Error('Los avisos están silenciados temporalmente. Reactívalos para probar.');if(!settings.notifications)throw Error('Activa las notificaciones para probar el aviso.');notify({id:'test',session:'',title:'Aviso de prueba',kind:'finished',read:false,at:Date.now()});return true;});
  handle('clearNotices',none,()=>{hub.clearNotices();return true;});handle('hide',none,()=>{hide();return true;});handle('drag',z.enum(['start','end']),a=>{a==='start'?drag():endDrag();hover.refresh();return true;});
  const moveCapsule=(alignment:CapsuleAlignment)=>{
   if(!surfaceVisible())throw Error('Muestra ZEN para mover la cápsula.');
   if(settings.windowLocked)throw Error('Desbloquea la posición de ZEN para mover la cápsula.');
   endDrag();
   const monitor=screen.getDisplayMatching(cap.getBounds()),{workArea}=monitor;
   if(isEdge()){
    dock={...dock,side:alignment==='center'?dock.side:alignment,displayId:monitor.id,fraction:alignment==='center'?.5:dock.fraction};
    if(expanded){if(cap.isMaximized())cap.unmaximize();positionSurface();rememberWorkspace();}
    else positionSurface();
    if(!workspaceWindow.save({edgeDock:dock}))throw Error('No se pudo guardar el anclaje.');
    updateShape();broadcast();return true;
   }
   const ratio=alignment==='left'?0:alignment==='right'?1:.5;
   if(expanded){
    const current=workspaceGeometry(),rect=fitWorkspace(workArea,current.bounds);
    if(!compactPanel()&&!workspaceWindow.save({previous:current}))throw Error('No se pudo guardar la posición anterior.');
    if(current.maximized)cap.unmaximize();
    cap.setBounds({...rect,x:workArea.x+Math.round((workArea.width-rect.width)*ratio)});
    rememberWorkspace();
    broadcast();
    return true;
   }
   const panel=parked.maximized?parked.area:parked.bounds;
   moveRail(monitor,{...panel,x:workArea.x+Math.round((workArea.width-panel.width)*ratio),y:workArea.y});
   rememberRail();
   return true;
  };
  handle('moveCapsule',CapsuleAlignment,moveCapsule);
  handle('capsuleLocationMenu',CapsuleMenuAnchor.optional(),anchor=>{
   if(!surfaceVisible()||openDialogs)return false;
   const content=cap.getContentBounds();
   const area=screen.getDisplayMatching(content).workArea;
   const point=anchor?{
    x:Math.min(area.x+area.width-1,Math.max(area.x,content.x+Math.min(anchor.x,content.width-1))),
    y:Math.min(area.y+area.height-1,Math.max(area.y,content.y+Math.min(anchor.y,content.height-1))),
   }:undefined;
   let selected=false;
   const menu=Menu.buildFromTemplate(capsuleMenuItems({settings,location:location(),full:true,nativeHover:nativeCaption,simpleMode,toggleSimpleMode,
    previousApp:desktop?.status()??{available:false},setLocation,move:moveCapsule,
    update:value=>persist({...settings,...value}),layout:()=>changeSurface(()=>openWorkspace('options')),
    appearance:()=>changeSurface(()=>openWorkspace('settings')),openChat:openCurrent,
    openNotices:()=>{if(privateEffectsAllowed())changeSurface(()=>openWorkspace('notices'));},
    restoreApp:()=>desktop?.restore(),hide,quit:()=>app.quit(),run:action=>{
     selected=true;
     if(surfaceVisible())void Promise.resolve().then(action).catch(error=>{dialog.showErrorBox('ZEN',String(error));});
    },
   }));
   return withWindowDialog(()=>new Promise<boolean>(resolve=>{
    playEffect('open');
    menu.popup({window:cap,...point,callback:()=>{
     if(!selected)playEffect('close');
     resolve(!selected);
    }});
   }));
  });
  handle('workspaceLayout',WorkspaceLayoutAction,action=>{
   requireWorkspace('options');
   applyWorkspaceLayout(action);
   broadcast();
   return true;
  });
  handle('workspaceLayoutPreferences',WorkspaceLayoutPreferences,({side,restoreOnLaunch})=>{
   if(!workspaceVisible('options')&&!workspaceVisible('settings'))throw Error('Abre la distribución de ventana o Preferencias.');
   if(!workspaceWindow.save({preferences:{...workspaceWindow.preferences,side,restoreOnLaunch}}))throw Error('No se pudo guardar la distribución.');
   if(compactPanel())setWorkspaceMinimum();
   else {const minimum=activeWorkspaceMinimum();cap.setMinimumSize(minimum.width,minimum.height);}
   setCaptionTheme();
   updateShape();
   broadcast();
   return true;
  });
  handle('copy',z.string().max(64000),value=>{if(settings.presentation)throw Error('Desactiva Presentación para copiar detalles.');copyText(value);return true;});
  if(!smoke)try{registerCompanionShortcuts(globalShortcut,settings,reveal,()=>void openCurrent());}catch(e){shortcutIssue=(e as Error).message;hub.error=shortcutIssue;}
  const officinaTicker=setInterval(()=>{if(officinaAllowed())void officina.tick();else officina.suspend();},2000);
  const ticker=setInterval(broadcast,15000);app.on('before-quit',()=>{quitting=true;surfaceReady=false;clearTimeout(priorityTimer);panelTransition.reset();hover.reset();clearInterval(ticker);clearInterval(replyTicker);clearInterval(officinaTicker);officina.close();powerMonitor.removeListener('resume',wakeOura);oura.close();weather.cancel();translator.cancel();cancelAutoCollapse();rememberWorkspace();replyEpoch++;endDrag();media?.close();mediaObserver?.close();systemVolume.close();context?.close();desktop?.close();integration.close();globalShortcut.unregisterAll();tray.destroy();});
  await integration.start();if(!smoke)desktop.start();await cap.loadFile(renderer,{query:rendererQuery});
  setCaptionTheme();
  if(workspaceWindow.startupMode==='workspace')enterWorkspace();
  else positionSurface();
  await readFrameInset();
  setTopmost();
  surfaceReady=true;showCapsule(false);if(!smoke){powerMonitor.on('resume',wakeOura);wakeOura();void check();}
  if(hoverSmoke)return;
  if(smokeMedia){try{const {companionSmoke}=await import('./companion-smoke');const result=await companionSmoke({cap,hub,integration,calendar,profile,openedTargets,activateNotice,copiedRequests,queuedRequests,copiedText,media,ouraFixture:smokeOura!,observationFixture:smokeMedia.state,dismissOnOutsideClick,toggleSimpleMode,enableAutomaticPermissionReview:()=>{automaticPermissionReview=true;}});writeFileSync(join(profile,'smoke-result.json'),JSON.stringify({pid:process.pid,executable:process.execPath,result}));app.quit();}catch(e){console.error(e);app.exit(1);}}
 }).catch(e=>{console.error('ZEN companion startup: '+String(e));app.exit(1);});
}
