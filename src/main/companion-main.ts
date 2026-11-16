import {CompanionAppearance} from './companion-appearance';
import {AppearanceOptions} from '../shared/companion-appearance';
import {registerProfileBackupIpc} from './companion-backup-ipc';
import {registerNotesIpc} from './companion-notes-ipc';
import {createSmokeMedia} from './companion-smoke-media';
import {openCodexRequest,queueCodexRequest} from './companion-request';
import {CodexRequest} from '../shared/companion-request';
import {CompanionContext} from './companion-context';
import {contextFile} from './companion-context-file';
import {ContextInput} from '../shared/companion-context';
import {CodexReferenceSelection} from '../shared/codex-result-document';
import {app,BrowserWindow,Tray,Menu,Notification,screen,globalShortcut,shell,clipboard,dialog,protocol,nativeImage,systemPreferences} from 'electron';
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
import {capsuleShape,nearestEdge} from './overlay';
import {codexChatUrl,noticeChatUrl,isSilenced} from '../shared/companion-presentation';
import {CodexReplyReader} from './companion-codex-reader';
import {inspectCodexCompanion} from './companion-codex-inspection';
import {preferCompanionReply} from './companion-reply';
import {registerCompanionShortcuts} from './companion-shortcuts';
import {displayStatus} from '../shared/companion-privacy';
import {CompanionSummaries} from './companion-summary';
import {projectFile} from './companion-project-path';
import {CompanionDesktop} from './companion-desktop';
import {CompanionMedia,CompanionMediaObserver,NativeMediaRpc} from './companion-media';
import {WorkspacePage,LauncherPage,LauncherOrder,CapsuleView,CodexTab,SectionPage,isLauncherPageSelected} from '../shared/companion-workspace';
import {CompanionLauncher} from './companion-launcher';
import {KnowledgeHub} from './knowledge-hub';
import {MediaCommand} from '../shared/companion-media';
import {mergeShape,overlaps,CapsuleVisibility} from './companion-placement';
import {CompanionWorkspaceWindow,compactIslandSize,compactWorkspaceBounds,edgeBounds,edgePanelBounds,edgeRailTop,edgeShape,edgeWorkspaceMinimum,fitWorkspace,islandBounds,placeWorkspaceRail,railFromIsland,restoreWorkspace,workspaceCaptionHeight,workspaceLayout,workspaceMinimum,type EdgeDock,type WorkspaceGeometry} from './companion-workspace-window';
import {EDGE_ISLAND,ISLAND_BLUR_MS} from '../shared/island';
import {motion,surfaceProgress} from '../shared/companion-motion';
import {CapsuleLocation,CapsuleMenuAnchor,WorkspaceLayoutAction,WorkspaceLayoutPreferences} from '../shared/workspace-layout';
import {capsuleMenuItems} from './companion-capsule-menu';
import {companionIpc} from './companion-ipc';
import {companionChannel,companionInterfaceEffectChannel} from '../shared/companion-ipc';
import {surfaceSound,type InterfaceEffect} from '../shared/companion-interface-audio';
import {nativeHelper} from './native-helper';
protocol.registerSchemesAsPrivileged([{scheme:'zen-theme',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const appUserModelId='com.zen.desktop';
app.setName('ZEN');app.setAppUserModelId(appUserModelId);
const smoke=process.argv.includes('--zen-shell-smoke');if(smoke){const p=join(app.getPath('temp'),'zen-companion-smoke-'+process.pid);mkdirSync(p,{recursive:true});app.setPath('userData',p);}
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
  const notes = new KnowledgeHub(join(profile, 'knowledge-hub.sqlite'), join(profile, 'companion-notes.json'));
  // An older saved preference file is reloaded by the same constructor in the isolated packaged fixture.
  if(smoke){
   writeFileSync(join(profile,'companion-appearance.json'),JSON.stringify({options:{theme:'dark',accent:'violet',background:'dusk',opacity:.41,blur:7}}));
   writeFileSync(join(profile,'companion-desktop-window.json'),'{"version":1,"mode":"app","bounds":{"x":5,"y":5,"width":1100,"height":900},"maximized":true}');
  }
  const appearance=new CompanionAppearance(profile,bytes=>{let image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw Error();const size=image.getSize(),ratio=Math.min(1,2560/Math.max(size.width,size.height));if(ratio<1)image=image.resize({width:Math.max(1,Math.round(size.width*ratio)),height:Math.max(1,Math.round(size.height*ratio)),quality:'best'});return image.toPNG();});
  let codexTab:CodexTab='activity';let contextPage:LauncherPage|undefined;
  let expanded=false,island=true,islandSizing=false,islandControls=false,compactView:CapsuleView='status',workspacePage:WorkspacePage=launcherPreferences.status().last,quitting=false,dragTimer:ReturnType<typeof setInterval>|undefined,dragLimit:ReturnType<typeof setTimeout>|undefined,moved=false;
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
  const surfaceBounds=(compact:boolean)=>isEdge()?edgeBounds(dockDisplay().workArea,dock,compact,nativeCaption,parked.bounds.width):
   compact?islandBounds(parked,nativeCaption):compactWorkspaceBounds(parked,nativeCaption);
  let taskbarHidden=settings.hideCapsuleFromTaskbar;
  const cap=new BrowserWindow({...surfaceBounds(true),title:'ZEN · Isla',frame:false,thickFrame:nativeCaption,roundedCorners:false,transparent:false,
   ...(nativeCaption?{titleBarStyle:'hidden' as const,titleBarOverlay:{height:workspaceCaptionHeight,color:'#00000000',symbolColor:'#f2f3fb'}}:{}),
   backgroundColor:'#101116',hasShadow:false,maximizable:false,minimizable:false,show:false,skipTaskbar:taskbarHidden,
   alwaysOnTop:false,resizable:false,movable:false,icon,webPreferences:{autoplayPolicy:'no-user-gesture-required',preload,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
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
  const surfaceVisible=()=>!cap.isDestroyed()&&cap.isVisible()&&!cap.isMinimized();
  let openDialogs=0,editing=false;
  let blurTimer:ReturnType<typeof setTimeout>|undefined;
  const cancelAutoCollapse=()=>{clearTimeout(blurTimer);blurTimer=undefined;};
  const withWindowDialog=async <T,>(show:()=>Promise<T>)=>{
   cancelAutoCollapse();
   openDialogs++;
   try{return await show();}
   finally{openDialogs--;}
  };
  const workspaceVisible=(page?:WorkspacePage)=>surfaceVisible()&&expanded&&(page===undefined||workspacePage===page);
  const summaryVisible=()=>workspaceVisible('codex')&&codexTab==='summary';
  const privateEffectsAllowed=()=>!settings.presentation&&!settings.paused;
  const snapshot=()=>displayStatus({
   ...hub.status(),
   appearance:appearance.status(),
   workspace:{
    expanded,island,islandSizing,islandControls,page:workspacePage,location:location(),
    surfaceVisible:surfaceVisible(),
    islandStacked:compactIslandSize(isEdge()?dockDisplay().workArea:parked.area,isEdge()&&dock.side!=='top').stacked,
    edge:isEdge()?{side:dock.side,railTop:expanded?edgeRailTop(cap.getBounds(),dockDisplay().workArea,dock):0}:undefined,
    codexTab,context:contextPage,...launcherPreferences.status(),compact:compactView,
    nativeCaption,layout:workspaceWindow.preferences,canRestorePosition:!!workspaceWindow.previous,
   },
   desktop:desktop?.status(),
  },++revision,surfaceVisible());
  const broadcast=()=>{if(!cap.isDestroyed())cap.webContents.send(companionChannel('status'),snapshot());};
  const playEffect=(effect:InterfaceEffect)=>{
   if(!cap.isDestroyed()&&surfaceVisible())cap.webContents.send(companionInterfaceEffectChannel,effect);
  };
  function changeSurface(run:()=>void) {
   const current=()=>({island,expanded,page:workspacePage,tab:codexTab,
    disclosure:workspacePage==='options'?'options':workspacePage==='shortcuts'?`shortcuts/${contextPage}`:undefined});
   const before=current();
   run();
   const effect=surfaceSound(before,current());
   if(effect)playEffect(effect);
   return true;
  }
  const activateNotice=async(n:CompanionNotice)=>{if(n.id==='test'){reveal();return;}await openExternal(noticeChatUrl(hub.status(),n));};
  const notify=(n:CompanionNotice)=>{if(smoke||settings.presentation||isSilenced(settings)||!Notification.isSupported())return;const toast=new Notification({title:'ZEN · '+n.title,body:n.id==='test'?'Aviso de prueba de ZEN.':'Pulsa para volver a este chat en Codex.',silent:n.id==='test'||!settings.sounds||(cap.isVisible()&&!cap.isMinimized()),icon});toast.on('click',()=>{void activateNotice(n).catch(()=>{});});toast.show();};
  const summaries=new CompanionSummaries(smoke?undefined:target,(id,key,value)=>hub.setSummary(id,key,value));
  const hub=new CompanionHub(settings,broadcast,notify,undefined,target,(event,session,reply)=>{
   summaries.observe(event,session);
   if(reply)context.observeReply(session.id,session.cwd,reply);
  });hub.targetError=targetError;
  const codexHome=smoke?join(profile,'codex-fixture'):process.env.CODEX_HOME??join(app.getPath('home'),'.codex');
  const replyReader=new CodexReplyReader(codexHome);
  const integration=new CompanionIntegration(profile,codexHome,dirname(nativeHelper(__dirname,'hook')),hub);
  const mediaAllowed=()=>privateEffectsAllowed()&&surfaceVisible()&&
   (expanded?workspacePage==='spotify':!island&&compactView==='spotify'&&hub.status().approvals.length===0);
  const mediaObservationAllowed=()=>surfaceReady&&privateEffectsAllowed()&&surfaceVisible();
  const smokeMedia = smoke ? createSmokeMedia() : undefined;
  const mediaHelper = nativeHelper(__dirname, 'media');
  const nativeMedia = () => new NativeMediaRpc(mediaHelper);
  const mediaObserver = new CompanionMediaObserver(smokeMedia?.observer ?? nativeMedia, mediaObservationAllowed);
  const media = new CompanionMedia(smokeMedia?.player ?? nativeMedia, mediaAllowed);
  let requestInFlight = false;
  const withRequest = async <T,>(send: () => Promise<T>) => {
   if (requestInFlight) throw Error('Ya hay una petición en curso.');
   requestInFlight = true;
   try { return await send(); }
   finally { requestInFlight = false; }
  };
  const submitRequest = async (thread: string, text: string, verify: () => void | Promise<void>) => {
   if (!smoke) return queueCodexRequest(thread,text,codexHome,verify);
   await verify();
   queuedRequests.push({thread,text});
  };
  const context=new CompanionContext({
   policy:()=>({visible:summaryVisible(),presentation:settings.presentation,paused:settings.paused,target,targetError}),
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
  let shapeSize='',captionInset=0,resizeTimer:ReturnType<typeof setInterval>|undefined;
  const desktopHelper=nativeHelper(__dirname,'desktop');
  const frameInsets=new Map<number,{x:number;y:number}>();
  let insetProbe:Promise<void>|undefined;
  const updateShape=()=>{
   const bounds=cap.getBounds(),{width,height}=bounds,edge=isEdge();
   const inset=edge&&nativeCaption&&!cap.isMaximized()?frameInsets.get((expanded?screen.getDisplayMatching(bounds):dockDisplay()).id)??{x:8,y:0}:{x:0,y:0};
   const railTop=expanded&&edge?edgeRailTop(bounds,dockDisplay().workArea,dock):0;
   const reserve=nativeCaption&&!expanded&&(edge||island||islandSizing)?workspaceCaptionHeight:0;
   const compact=island||islandSizing&&!islandControls;
   const key=edge?`edge/${dock.side}/${width}/${height}/${expanded}/${compact}/${railTop}/${inset.x}/${inset.y}`:expanded?'workspace':`${width}x${height}/${reserve}`;
   if(key===shapeSize)return;
   const shapedHeight=height-reserve;
   const shape=edge?edgeShape(width,shapedHeight,dock.side,railTop,expanded,compact):expanded?[]:capsuleShape({width,height:shapedHeight});
   cap.setShape(mergeShape(shape).map(rect=>({...rect,x:rect.x+inset.x,y:rect.y+inset.y+reserve})));
   shapeSize=key;
   captionInset=reserve;
  };
  const readFrameInset=()=>{
   if(!nativeCaption||!isEdge()||cap.isDestroyed()||cap.isMaximized()||cap.isMinimized())return;
   const insetDisplay=()=>expanded?screen.getDisplayMatching(cap.getBounds()):dockDisplay();
   const {id}=insetDisplay();
   if(frameInsets.has(id)||insetProbe)return insetProbe;
   const insetSchema=z.object({x:z.number().min(0).max(32),y:z.number().min(0).max(32)});
   insetProbe=new Promise<void>(resolve=>{
    execFile(desktopHelper,['--client-inset',cap.getNativeWindowHandle().readBigUInt64LE().toString(),String(process.pid)],{windowsHide:true,timeout:1500},(error,stdout)=>{
     if(!error&&!cap.isDestroyed()&&!cap.isMaximized()&&insetDisplay().id===id){
      try{frameInsets.set(id,insetSchema.parse(JSON.parse(stdout)));updateShape();}catch{/* Retain Windows' usual inset if the sample is unavailable. */}
     }
     insetProbe=undefined;
     resolve();
    });
   });
   return insetProbe;
  };
  const stopIslandResize=()=>{clearInterval(resizeTimer);resizeTimer=undefined;islandSizing=false;islandControls=false;};
  const setCaptionTheme=()=>{
   if(nativeCaption)cap.setTitleBarOverlay({
    height:workspaceCaptionHeight,
    symbolColor:!expanded&&(island||isEdge())?'#00000000':!isEdge()&&appearance.status().theme==='light'?'#161a24':'#f2f3fb',
   });
  };
  const positionSurface=(animate=false)=>{
   if(expanded)return;
   stopIslandResize();
   if(nativeCaption&&(island||isEdge())){cap.setMinimizable(false);cap.setMaximizable(false);setCaptionTheme();}
   const next=surfaceBounds(island),current=cap.getBounds();
   const place=(bounds:Area)=>{
    const old=cap.getBounds();
    if(bounds.x!==old.x||bounds.y!==old.y||bounds.width!==old.width||bounds.height!==old.height)cap.setBounds(bounds);
    updateShape();
   };
   const finish=()=>{
    stopIslandResize();
    place(next);
    if(nativeCaption&&!island&&!isEdge()){cap.setMinimizable(true);cap.setMaximizable(true);setCaptionTheme();}
   };
   if(!animate||!settings.motion||!surfaceVisible()||systemPreferences.getAnimationSettings().prefersReducedMotion||
      (current.width===next.width&&current.height===next.height&&current.x===next.x&&current.y===next.y)){finish();return;}
   const closing=island;
   const earlyControls=isEdge()&&!closing;
   const duration=closing?motion.panel:motion.island;
   // Animate the visible rectangle while the hidden caption is still reserved.
   // On expansion, the full rail resumes its native title controls at the same visible origin.
   const fromInset=captionInset;
   const toInset=nativeCaption&&(isEdge()||closing)?workspaceCaptionHeight:0;
   const motionInset=nativeCaption?workspaceCaptionHeight:0;
   const inAnimation=(bounds:Area,inset:number):Area=>({...bounds,y:bounds.y+inset-motionInset,height:bounds.height-inset+motionInset});
   const from=inAnimation(current,fromInset),to=inAnimation(next,toInset);
   islandSizing=true;
   place(from);
   const start=performance.now();
   resizeTimer=setInterval(()=>{
    if(!settings.motion||systemPreferences.getAnimationSettings().prefersReducedMotion){finish();broadcast();return;}
    const progress=Math.min(1,(performance.now()-start)/duration);
    if(progress===1){finish();broadcast();return;}
    const ease=surfaceProgress(progress,closing);
    const blend=(key:keyof Area)=>Math.round(from[key]+(to[key]-from[key])*ease);
    place({x:blend('x'),y:blend('y'),width:blend('width'),height:blend('height')});
    if(earlyControls&&!islandControls&&ease>=.97){islandControls=true;broadcast();}
   },16);
  };
  cap.on('resize',updateShape);
  cap.on('move',()=>{if(isEdge()){updateShape();void readFrameInset();}});
  let changingMode=false;
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
    const current=workspaceGeometry();
    workspaceWindow.save({mode:'workspace',current,...(!isEdge()?{floating:current}:{})});
   }
  };
  const scheduleWorkspaceSave=()=>{
   if(!expanded||changingMode||cap.isMinimized())return;
   if(isEdge())broadcast();
   clearTimeout(savePositionTimer);
   savePositionTimer=setTimeout(rememberWorkspace,250);
  };
  cap.on('move',scheduleWorkspaceSave);
  cap.on('resize',scheduleWorkspaceSave);
  cap.on('unmaximize',scheduleWorkspaceSave);
  const enterWorkspace=(maximize=!isEdge()&&parked.maximized,restore=false,bounds=parked.bounds)=>{
   stopIslandResize();
   changingMode=true;
   island=false;
   expanded=true;
   updateShape();
   cap.setResizable(true);
   cap.setMovable(!settings.windowLocked);
   cap.setMinimizable(true);
   cap.setMaximizable(true);
   setCaptionTheme();
   const minimum=activeWorkspaceMinimum();cap.setMinimumSize(minimum.width,minimum.height);
   setTaskbarHidden(false);
   cap.setTitle('ZEN');
   if(cap.isMaximized())cap.unmaximize();
   const area=dockDisplay().workArea;
   cap.setBounds(isEdge()&&!restore?edgePanelBounds(area,bounds,dock):bounds);
   updateShape();
   if(maximize)cap.maximize();
   changingMode=false;
   rememberWorkspace();
  };
  cap.on('maximize',()=>{
   if(!expanded&&!changingMode){enterWorkspace(true);broadcast();}
   else scheduleWorkspaceSave();
  });
  const rememberRail=()=>workspaceWindow.save({mode:'capsule',current:parked,edgeDock:dock,...(!isEdge()?{floating:parked}:{})});
  const leaveWorkspace=()=>{
   clearTimeout(savePositionTimer);
   if(!isEdge()&&!cap.isMinimized())parked=workspaceGeometry();
   changingMode=true;
   if(cap.isMaximized())cap.unmaximize();
   expanded=false;
   cap.setMinimumSize(0,0);
   cap.setMovable(false);
   cap.setResizable(false);
   setTaskbarHidden(settings.hideCapsuleFromTaskbar);
   cap.setTitle('ZEN · Cápsula');
   positionSurface();
   changingMode=false;
   rememberRail();
  };
  const applyWorkspaceLayout=(action:WorkspaceLayoutAction)=>{
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
    }else cap.setBounds(workspaceLayout(monitor.workArea,action));
    if(action==='restore'&&previous?.maximized)cap.maximize();
   }
   rememberWorkspace();
  };
  const setTopmost=(next:boolean)=>{
   // Electron's default level inserts the window behind the taskbar HWND on Windows.
   // That can clear topmost when the taskbar is in the normal z-order band.
   if(cap.isAlwaysOnTop()!==next)cap.setAlwaysOnTop(next,nativeCaption?'pop-up-menu':undefined);
  };
  const fullscreenHere=()=>{const r=desktop?.observation?.fullscreen;return !!(settings.respectFullscreen&&r&&overlaps(screen.screenToDipRect(null,r),screen.getDisplayMatching(cap.getBounds()).bounds));};
  const syncVisibility=()=>{
   if(!surfaceReady||cap.isDestroyed()||visibility.hidden||cap.isMinimized())return;
   if(expanded||visibility.visible(fullscreenHere(),desktop?.observation?.foreground)){
    if(!cap.isMinimized()&&!cap.isVisible())cap.showInactive();
   }else if(cap.isVisible())cap.hide();
  };
  const secure=(w:BrowserWindow,url:string)=>{w.setMenu(null);w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',(e,next)=>{if(next!==url)e.preventDefault();});w.webContents.on('will-frame-navigate',e=>{if(!e.isMainFrame)e.preventDefault();});w.webContents.on('did-finish-load',broadcast);w.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));};
  secure(cap,rendererUrl);
  cap.webContents.session.protocol.handle('zen-theme',request=>{try{const u=new URL(request.url);if(request.method!=='GET'||u.hostname!=='background'||u.search||u.hash||settings.presentation)throw Error();const bytes=appearance.image(u.pathname.slice(1));return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});}catch{return new Response(null,{status:404});}});
  const invalidateContext=()=>{context.invalidate();replyEpoch++;};
  const openWorkspace=(page:WorkspacePage)=>{
   cancelAutoCollapse();
   if(expanded&&workspacePage===page){broadcast();return;}
   endDrag();
   launcherPreferences.visit(page);
   if(page!=='spotify'||(expanded?workspacePage:compactView==='spotify'?'spotify':workspacePage)!=='spotify')media.close();
   if(workspacePage!==page)invalidateContext();
   compactView='status';
   workspacePage=page;
   if(page==='notices')hub.markNoticesRead();
   visibility.invoke();
   if(!expanded)enterWorkspace();
   syncVisibility();
   broadcast();
   if(page==='codex')void refreshLastReply();
  };
  let resumePanel=false;
  const openRail=()=>{
   if(!island||expanded)return;
   if(resumePanel){
    resumePanel=false;
    openWorkspace(workspacePage);
    return;
   }
   island=false;
   cap.setTitle('ZEN · Cápsula');
   positionSurface(true);
   broadcast();
  };
  const collapse=(view:CapsuleView='status',toIsland=false)=>{
   cancelAutoCollapse();
   if(toIsland&&openDialogs)return;
   endDrag();
   if(expanded||!toIsland)resumePanel=expanded&&toIsland;
   const samePlayer=view==='spotify'||toIsland&&(workspacePage==='spotify'||compactView==='spotify');
   if(!samePlayer)media.close();
   if(view!=='status'){launcherPreferences.visit(view);workspacePage=view;}
   if(!toIsland)compactView=view;
   if(expanded){invalidateContext();leaveWorkspace();}
   const change=island!==toIsland;
   island=toIsland;
   cap.setTitle(island?'ZEN · Isla':'ZEN · Cápsula');
   if(change)positionSurface(true);
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
  const endDrag=()=>{clearInterval(dragTimer);clearTimeout(dragLimit);dragTimer=undefined;if(moved){moved=false;rememberRail();}};
  const moveRail=(monitor:ReturnType<typeof activeDisplay>,bounds:Area)=>{
   parked={displayId:monitor.id,area:monitor.workArea,bounds:placeWorkspaceRail(monitor.workArea,bounds),maximized:false};
   positionSurface();
  };
  const drag=()=>{
   if(expanded||islandSizing||settings.windowLocked||!surfaceVisible())return;
   endDrag();
   const start=screen.getCursorScreenPoint(),rail=cap.getBounds();
   const panel=parked.maximized?parked.area:parked.bounds;
   const grabX=(start.x-rail.x)/rail.width,grabY=start.y-rail.y;
   let edge:DockEdge='top';
   dragTimer=setInterval(()=>{
    const cursor=screen.getCursorScreenPoint();
    if(!moved&&Math.hypot(cursor.x-start.x,cursor.y-start.y)<4)return;
    moved=true;
    const monitor=screen.getDisplayNearestPoint(cursor),area=monitor.workArea;
    if(isEdge()){
     if(dock.side==='top'){
      dock={side:'top',displayId:monitor.id,fraction:Math.min(1,Math.max(0,(cursor.x-grabX*rail.width+rail.width/2-area.x)/area.width))};
      positionSurface();
      return;
     }
     const middle=area.x+area.width/2;
     const side=cursor.x<middle-24?'left':cursor.x>middle+24?'right':dock.side;
     const caption=nativeCaption?EDGE_ISLAND.captionReserve:0;
     const fraction=Math.min(1,Math.max(0,(cursor.y-grabY+(rail.height+caption)/2-area.y)/area.height));
     const changed=side!==dock.side;
     dock={side,displayId:monitor.id,fraction};
     positionSurface();
     if(changed)broadcast();
     return;
    }
    edge=nearestEdge(area,cursor,edge);
    if(island){
     const bounds=railFromIsland(area,panel,Math.round(cursor.x-grabX*rail.width),cursor.y-grabY+captionInset);
     moveRail(monitor,bounds);
     return;
    }
    const width=Math.min(panel.width,area.width);
    const x=edge==='left'?area.x:edge==='right'?area.x+area.width-width:Math.round(cursor.x-grabX*width);
    const y=edge==='top'?area.y:cursor.y-grabY;
    moveRail(monitor,{...panel,x,y,width});
   },30);
   dragLimit=setTimeout(endDrag,30000);
  };
  const hide=()=>{rememberWorkspace();cancelAutoCollapse();endDrag();if(islandSizing)positionSurface();media.close();visibility.hide();setTaskbarHidden(false);cap.minimize();};
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
  const canAutoCollapse=()=>!island&&settings.collapseOnBlur&&!settings.keepExpanded&&!editing&&!dragTimer&&!moved&&
   !openDialogs&&!requestInFlight&&!quitting&&surfaceVisible();
  cap.on('blur',()=>{
   const eligible=canAutoCollapse();
   endDrag();
   cancelAutoCollapse();
   if(eligible)blurTimer=setTimeout(()=>{if(canAutoCollapse()&&!cap.isFocused())collapse('status',true);},ISLAND_BLUR_MS);
  });
  cap.on('focus',cancelAutoCollapse);
  cap.on('restore',()=>{
   visibility.invoke();
   if(!expanded)setTaskbarHidden(settings.hideCapsuleFromTaskbar);
   syncVisibility();
   broadcast();
  });
  const hidePrivateContent=()=>{invalidateContext();mediaObserver.close();broadcast();};
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
   frameInsets.clear();
   const display=dockDisplay();
   if(isEdge()&&display.id!==dock.displayId){
    dock={...dock,displayId:display.id};
    workspaceWindow.save({edgeDock:dock});
    if(expanded&&!cap.isMinimized()&&!cap.isMaximized()){
     const minimum=activeWorkspaceMinimum();
     cap.setMinimumSize(minimum.width,minimum.height);
     cap.setBounds(edgePanelBounds(display.workArea,cap.getBounds(),dock));
    }
   }
   reposition();
   void readFrameInset();
  };
  screen.on('display-added',refreshDisplays);screen.on('display-removed',refreshDisplays);screen.on('display-metrics-changed',refreshDisplays);
  const openCurrent=async()=>{await openExternal(codexChatUrl(hub.status()));};
  const tray=new Tray(icon);tray.setToolTip('ZEN · Codex');tray.setContextMenu(Menu.buildFromTemplate([{label:'Abrir ZEN',click:()=>{reveal();if(!expanded)openWorkspace(launcherPreferences.status().last);}},{label:'Mostrar cápsula',click:()=>{if(expanded)collapse();reveal();}},{label:'Volver al chat de Codex',click:()=>void openCurrent()},{label:'Volver a mi aplicación',click:()=>void desktop?.restore().catch(()=>{})},{type:'separator'},{label:'Salir de ZEN',click:()=>app.quit()}]));tray.on('click',reveal);
  let shortcutIssue:string|undefined,checking:Promise<boolean>|undefined;
  let replyRead:Promise<void>|undefined;
  const replyVisible=()=>!smoke&&!targetError&&summaryVisible()&&privateEffectsAllowed();
  const refreshLastReply=()=>{
   const selected=target;
   if(!selected||!replyVisible()||replyRead)return replyRead;
   const epoch=replyEpoch;
   replyRead=replyReader.read(selected).then(reply=>{
    if(reply&&epoch===replyEpoch&&replyVisible())hub.setLastReply(selected.session,selected.cwd,reply);
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
  const none=z.undefined();
  const setLocation=(next:CapsuleLocation)=>{
   if(!surfaceVisible())throw Error('Muestra ZEN para elegir su ubicación.');
   const previous=location();
   if(next===previous)return true;
   const monitor=previous==='floating'?screen.getDisplayMatching(cap.getBounds()):dockDisplay();
   const before=expanded?workspaceGeometry():parked;
   endDrag();
   const floating=previous==='floating'?before:workspaceWindow.floating;
   const nextDock:EdgeDock=next==='floating'?dock:{side:next,displayId:monitor.id,fraction:next==='top'||dock.side==='top'?.5:dock.fraction};
   if(!workspaceWindow.save({preferences:{...workspaceWindow.preferences,location:next},edgeDock:nextDock,floating}))throw Error('No se pudo guardar la ubicación.');
   dock=nextDock;
   if(next==='floating')parked=floating?fitDisplay(floating,screen.getAllDisplays(),monitor):{
    displayId:monitor.id,area:monitor.workArea,bounds:workspaceLayout(monitor.workArea,workspaceWindow.preferences.side),maximized:false,
   };
   if(expanded)enterWorkspace(next==='floating'&&parked.maximized,false,next==='floating'?parked.bounds:before.bounds);
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
  handle('status',none,snapshot);
  handle('check',none,()=>smoke?true:check());
  handle('openCodex',z.string().max(160).optional(),async id=>{await openExternal(codexChatUrl(hub.status(),id));return true;});
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
  handle('appearanceChoose',none,async()=>{appearanceWindow();if(smoke){const path=join(profile,'appearance-fixture.png');writeFileSync(path,nativeImage.createFromBitmap(Buffer.from([180,120,70,255]),{width:1,height:1}).toPNG());const result=appearance.import(path);broadcast();return result;}const picked=await withWindowDialog(()=>dialog.showOpenDialog(cap,{title:'Imagen de fondo de ZEN',properties:['openFile'],filters:[{name:'Imagen de fondo',extensions:['png','jpg','jpeg','webp']}]}));appearanceWindow();if(picked.canceled||picked.filePaths.length!==1)return appearance.status();const result=appearance.import(picked.filePaths[0]);broadcast();return result;});
  handle('mediaNowPlaying',none,()=>mediaObservationAllowed()?mediaObserver.read():null);
  handle('mediaObservationClose',none,()=>{mediaObserver.close();return true;});
  handle('navigate',WorkspacePage,page=>changeSurface(()=>openWorkspace(page)));
  registerNotesIpc(handle, {
   notes, window: cap, requireWorkspace, privateEffectsAllowed, withWindowDialog, copy: copyText, openExternal,
  });
  handle('codexTab',CodexTab,tab=>changeSurface(()=>{if(codexTab!==tab){invalidateContext();codexTab=tab;}openWorkspace('codex');}));
  handle('togglePage',SectionPage,page=>{
   if(!surfaceVisible()||openDialogs)throw Error('Vuelve a la cápsula para cambiar de sección.');
   changeSurface(()=>{
    const sameSection=isLauncherPageSelected(workspacePage,page);
    if(workspaceVisible()&&sameSection)collapse('status',true);
    else openWorkspace(sameSection&&resumePanel?workspacePage:page);
   });
   return {expanded,page:workspacePage,revision};
  });
  handle('launcher',z.boolean(),open=>changeSurface(()=>{if(open)openWorkspace(launcherPreferences.status().last);else collapse();}));
  handle('island',z.boolean(),compact=>changeSurface(()=>{
   if(!surfaceVisible())throw Error('Muestra ZEN para cambiar la vista.');
   if(compact)collapse('status',true);else openRail();
  }));
  handle('islandFocusGuard',z.boolean(),blocked=>{editing=blocked;if(blocked)cancelAutoCollapse();return true;});
  handle('compact',CapsuleView,view=>changeSurface(()=>{collapse(view);visibility.invoke();syncVisibility();broadcast();}));
  handle('launcherOrder',LauncherOrder,order=>{launcherPreferences.reorder(order);broadcast();return true;});
  handle('options',none,()=>changeSurface(()=>openWorkspace('options')));
  handle('launcherContext',LauncherPage,page=>changeSurface(()=>{contextPage=page;openWorkspace('shortcuts');}));
  handle('mediaCurrent',none,()=>media.current());
  handle('mediaSnapshot',z.literal(true).optional(),followSystem=>media.snapshot(followSystem));
  handle('mediaList',none,()=>media.list());
  handle('mediaSelect',z.uuid(),id=>media.select(id));
  handle('mediaRead',z.uuid(),id=>media.read(id));
  handle('mediaCommand',MediaCommand,value=>media.command(value));
  handle('mediaClose',z.enum(['workspace','compact']).optional(),scope=>{
   if(scope===undefined||(scope===(expanded?'workspace':'compact')&&(expanded||compactView==='spotify')))media.close();
   return true;
  });
  handle('contextStatus',none,()=>context.status());
  handle('contextChoose',none,()=>context.choose());
  handle('contextPrepare',ContextInput,input=>context.prepare(input));
  handle('contextCancel',z.uuid(),id=>{context.cancel(id);return true;});
  handle('contextHandoff',z.uuid(),id=>context.handoff(id));
  handle('contextResult',none,()=>context.result());
  handle('contextSource',CodexReferenceSelection,selection=>context.source(selection));
  handle('locate',z.object({session:z.string().max(160),path:z.string().max(4096)}).strict(),async v=>{if(settings.presentation)throw Error('Desactiva Presentación para ver ubicaciones.');const s=hub.status().sessions.find(s=>s.id===v.session);if(!s||s.state!=='finished'||!s.summary?.files.some(f=>f.path===v.path))throw Error('Este archivo no pertenece al resumen actual.');try{const p=await projectFile(s.cwd,v.path,true);if(p.missing)await shell.openPath(p.folder);else shell.showItemInFolder(p.file);return true;}catch{throw Error('La ubicación ya no está disponible dentro del proyecto.');}});
  handle('decide',z.object({id:z.uuid(),decision:z.enum(['allow','deny','pass'])}).strict(),value=>{requireWorkspace('permissions');hub.decide(value.id,value.decision);return true;});
  handle('install',none,async()=>{requireWorkspace('settings');await integration.install();if(!smoke)void check();return true;});
  const persist=(v:CompanionSettings)=>{
   if(v.shortcut.toLowerCase()===v.returnShortcut.toLowerCase())throw Error('Usa atajos diferentes para la cápsula y el chat.');
   const changed=v.shortcut!==settings.shortcut||v.returnShortcut!==settings.returnShortcut;
   if(changed&&!smoke)registerCompanionShortcuts(globalShortcut,v,reveal,()=>void openCurrent(),settings);
   try{writeFileSync(file+'.tmp',JSON.stringify(v,null,2));renameSync(file+'.tmp',file);}
   catch{if(changed&&!smoke)registerCompanionShortcuts(globalShortcut,settings,reveal,()=>void openCurrent(),v);throw Error('No se pudieron guardar las preferencias.');}
   if(v.alwaysOnTop!==settings.alwaysOnTop)setTopmost(v.alwaysOnTop);
   if(!expanded&&!cap.isMinimized())setTaskbarHidden(v.hideCapsuleFromTaskbar);
   if(v.windowLocked&&!settings.windowLocked)endDrag();
   if(expanded&&v.windowLocked!==settings.windowLocked)cap.setMovable(!v.windowLocked);
   if(!v.collapseOnBlur||v.keepExpanded)cancelAutoCollapse();
   settings=v;
   if(v.paused)summaries.clear();
   if(changed){shortcutIssue=undefined;hub.error=undefined;}
   hub.update(v);
   if(v.presentation||v.paused){context?.clear();replyEpoch++;media?.close();mediaObserver?.close();}
   syncVisibility();
   return true;
  };
  handle('save',CompanionSettingsSchema,value=>{requireWorkspace('settings');return persist({...value,windowLocked:settings.windowLocked,keepExpanded:settings.keepExpanded});});
  handle('keepExpanded',z.boolean(),enabled=>{
   if(!surfaceVisible()||island)throw Error('Abre la cápsula para cambiar esta preferencia.');
   return enabled===settings.keepExpanded||persist({...settings,keepExpanded:enabled});
  });
  registerProfileBackupIpc(handle, {
   window: cap, profile, requireSettings: () => requireWorkspace('settings'), privateEffectsAllowed, withWindowDialog,
   getSources: () => ({appearance, launcher: launcherPreferences, notes, settings}), saveSettings: persist,
   broadcast: () => {setCaptionTheme();broadcast();},
  });
  handle('pinWindow',z.boolean(),enabled=>{
   if(!surfaceVisible())throw Error('Muestra ZEN para cambiar el candado.');
   return enabled===settings.windowLocked||persist({...settings,windowLocked:enabled});
  });
  handle('sound',z.boolean(),enabled=>persist({...settings,sounds:enabled}));
  handle('presentation',z.boolean(),enabled=>persist({...settings,presentation:enabled}));
  handle('silence',z.union([z.literal(0),z.literal(30)]),minutes=>persist({...settings,silencedUntil:minutes?Date.now()+minutes*60000:0}));
  handle('testNotice',none,()=>{requireWorkspace('settings');if(settings.presentation)throw Error('Desactiva Presentación para probar avisos.');if(isSilenced(settings))throw Error('Los avisos están silenciados temporalmente. Reactívalos para probar.');if(!settings.notifications)throw Error('Activa las notificaciones para probar el aviso.');notify({id:'test',session:'',title:'Aviso de prueba',kind:'finished',read:false,at:Date.now()});return true;});
  handle('clearNotices',none,()=>{hub.clearNotices();return true;});handle('hide',none,()=>{hide();return true;});handle('drag',z.enum(['start','end']),a=>{a==='start'?drag():endDrag();return true;});
  const moveCapsule=(alignment:CapsuleAlignment)=>{
   if(!surfaceVisible())throw Error('Muestra ZEN para mover la cápsula.');
   if(settings.windowLocked)throw Error('Desbloquea la posición de ZEN para mover la cápsula.');
   endDrag();
   const monitor=screen.getDisplayMatching(cap.getBounds()),{workArea}=monitor;
   if(isEdge()){
    dock={...dock,side:alignment==='center'?dock.side:alignment,displayId:monitor.id,fraction:alignment==='center'?.5:dock.fraction};
    if(expanded){if(cap.isMaximized())cap.unmaximize();cap.setBounds(edgePanelBounds(workArea,cap.getBounds(),dock));rememberWorkspace();}
    else positionSurface();
    if(!workspaceWindow.save({edgeDock:dock}))throw Error('No se pudo guardar el anclaje.');
    updateShape();broadcast();return true;
   }
   const ratio=alignment==='left'?0:alignment==='right'?1:.5;
   if(expanded){
    const current=workspaceGeometry(),rect=fitWorkspace(workArea,current.bounds);
    if(!workspaceWindow.save({previous:current}))throw Error('No se pudo guardar la posición anterior.');
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
   if(!surfaceVisible()||openDialogs||anchor&&island)return false;
   const content=cap.getContentBounds();
   const area=screen.getDisplayMatching(content).workArea;
   const point=anchor?{
    x:Math.min(area.x+area.width-1,Math.max(area.x,content.x+Math.min(anchor.x,content.width-1))),
    y:Math.min(area.y+area.height-1,Math.max(area.y,content.y+Math.min(anchor.y,content.height-1))),
   }:undefined;
   let selected=false;
   const menu=Menu.buildFromTemplate(capsuleMenuItems({settings,location:location(),full:!!anchor,
    previousApp:desktop?.status()??{available:false},setLocation,move:moveCapsule,
    update:value=>persist({...settings,...value}),layout:()=>changeSurface(()=>openWorkspace('options')),
    appearance:()=>changeSurface(()=>openWorkspace('settings')),openChat:openCurrent,
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
   const minimum=activeWorkspaceMinimum();cap.setMinimumSize(minimum.width,minimum.height);
   setCaptionTheme();
   updateShape();
   broadcast();
   return true;
  });
  handle('copy',z.string().max(64000),value=>{if(settings.presentation)throw Error('Desactiva Presentación para copiar detalles.');copyText(value);return true;});
  if(!smoke)try{registerCompanionShortcuts(globalShortcut,settings,reveal,()=>void openCurrent());}catch(e){shortcutIssue=(e as Error).message;hub.error=shortcutIssue;}
  const ticker=setInterval(broadcast,15000);app.on('before-quit',()=>{quitting=true;surfaceReady=false;clearInterval(ticker);clearInterval(replyTicker);cancelAutoCollapse();stopIslandResize();rememberWorkspace();replyEpoch++;endDrag();summaries.clear();media?.close();mediaObserver?.close();context?.close();desktop?.close();integration.close();globalShortcut.unregisterAll();tray.destroy();});
  await integration.start();if(!smoke)desktop.start();await cap.loadFile(renderer,{query:rendererQuery});
  setCaptionTheme();
  if(workspaceWindow.startupMode==='workspace')enterWorkspace(parked.maximized,true);
  else positionSurface();
  await readFrameInset();
  setTopmost(settings.alwaysOnTop);
  surfaceReady=true;showCapsule(false);if(!smoke)void check();
  if(smokeMedia){try{const {companionSmoke}=await import('./companion-smoke');const result=await companionSmoke({cap,hub,integration,profile,openedTargets,activateNotice,copiedRequests,queuedRequests,copiedText,media,observationFixture:smokeMedia.state,dismissOnOutsideClick});writeFileSync(join(profile,'smoke-result.json'),JSON.stringify({pid:process.pid,executable:process.execPath,result}));app.quit();}catch(e){console.error(e);app.exit(1);}}
 }).catch(e=>{console.error('ZEN companion startup: '+String(e));app.exit(1);});
}
