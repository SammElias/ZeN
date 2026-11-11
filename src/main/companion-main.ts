import {CompanionAppearance,wallpaperBytes} from './companion-appearance';
import {AppearanceOptions} from '../shared/companion-appearance';
import {openCodexRequest,queueCodexRequest} from './companion-request';
import {CodexRequest} from '../shared/companion-request';
import {CompanionContext} from './companion-context';
import {contextFile} from './companion-context-file';
import {ContextInput} from '../shared/companion-context';
import {CodexReferenceSelection} from '../shared/codex-result-document';
import {app,BrowserWindow,Tray,Menu,Notification,screen,globalShortcut,shell,clipboard,dialog,protocol,nativeImage} from 'electron';
import {basename,dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,rmSync} from 'node:fs';
import {z} from 'zod';
import {CompanionSettingsSchema,CompanionTargetSchema,type CompanionSettings,type CompanionNotice,type CompanionTarget} from '../shared/codex-companion';
import {CompanionHub} from './companion-hub';
import {CompanionIntegration} from './companion-integration';
import {CodexRpc} from './codex-rpc';
import {CompanionPlacements} from '../storage/overlay-position';
import {CapsuleAlignment} from '../shared/overlay-position';
import {overlayBounds,capsuleShape,nearestEdge,draggedRatio,draggedVerticalRatio} from './overlay';
import {CAPSULE_HEIGHT} from '../shared/island';
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
import {WorkspacePage,LauncherPage,LauncherOrder,CapsuleView,CodexTab,isLauncherPageSelected} from '../shared/companion-workspace';
import {CompanionLauncher} from './companion-launcher';
import {KnowledgeHub, readHubFile} from './knowledge-hub';
import {HubAction, HubDraft, HubFileAction, type HubFileResult} from '../shared/knowledge-hub';
import {entryMarkdown, fileStem} from '../shared/knowledge-markdown';
import {MediaCommand} from '../shared/companion-media';
import {capsuleExtensionBounds,mergeShape,overlaps,CapsuleVisibility} from './companion-placement';
import {companionIpc} from './companion-ipc';
import {companionChannel} from '../shared/companion-ipc';
import {nativeHelper} from './native-helper';
protocol.registerSchemesAsPrivileged([{scheme:'zen-theme',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.setName('ZEN');app.setAppUserModelId('com.zen.desktop');
const smoke=process.argv.includes('--zen-shell-smoke');if(smoke){const p=join(app.getPath('temp'),'zen-companion-smoke-'+process.pid);mkdirSync(p,{recursive:true});app.setPath('userData',p);}
const copiedRequests:string[]=[];const queuedRequests:{thread:string;text:string}[]=[];const copiedText:string[]=[];const openedTargets:string[]=[];const openExternal=(url:string)=>smoke?(openedTargets.push(url),Promise.resolve()):shell.openExternal(url);
let reveal=()=>{};if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>reveal());app.on('window-all-closed',()=>{});
 void app.whenReady().then(async()=>{
  const profile=app.getPath('userData'),file=join(profile,'companion-settings.json');let settings:CompanionSettings;
  try{settings=CompanionSettingsSchema.parse(JSON.parse(readFileSync(file,'utf8')));}catch{settings=CompanionSettingsSchema.parse({});}
  const targetFile=join(profile,'companion-target.json');let target:CompanionTarget|undefined,targetError:string|undefined;
  if(smoke)target=CompanionTargetSchema.parse({session:'native-test',cwd:'C:\\fixture',title:'Revisar formulario en navegador'});
  else if(existsSync(targetFile))try{target=CompanionTargetSchema.parse(JSON.parse(readFileSync(targetFile,'utf8')));}catch{targetError='No se pudo leer el chat fijado. Revisa la configuración local de ZEN.';}
  const placements=new CompanionPlacements(profile);
  let position=placements.initial(screen.getPrimaryDisplay().id);
  const remember=()=>placements.save(position);
  const launcherPreferences=new CompanionLauncher(join(profile,'companion-launcher.json'));
  const notes = new KnowledgeHub(join(profile, 'knowledge-hub.sqlite'), join(profile, 'companion-notes.json'));
  // An older saved preference file is reloaded by the same constructor in the isolated packaged fixture.
  if(smoke){
   writeFileSync(join(profile,'companion-appearance.json'),JSON.stringify({options:{theme:'dark',accent:'violet',background:'dusk',opacity:.41,blur:7}}));
   writeFileSync(join(profile,'companion-desktop-window.json'),'{"version":1,"mode":"app","bounds":{"x":5,"y":5,"width":1100,"height":900},"maximized":true}');
  }
  const appearance=new CompanionAppearance(profile,bytes=>{let image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw Error();const size=image.getSize(),ratio=Math.min(1,2560/Math.max(size.width,size.height));if(ratio<1)image=image.resize({width:Math.max(1,Math.round(size.width*ratio)),height:Math.max(1,Math.round(size.height*ratio)),quality:'best'});return image.toPNG();});
  let codexTab:CodexTab='activity';let contextPage:LauncherPage|undefined;
  let expanded=false,compactView:CapsuleView='status',workspacePage:WorkspacePage=launcherPreferences.status().last,quitting=false,dragTimer:ReturnType<typeof setInterval>|undefined,dragLimit:ReturnType<typeof setTimeout>|undefined,moved=false;
  const renderer=join(__dirname,'renderer','index.html'),preload=join(__dirname,'preload.cjs'),icon=join(__dirname,'renderer','icons','zen.ico');
  const rendererQuery={view:'capsule'};
  const rendererUrl=pathToFileURL(renderer).href+'?'+new URLSearchParams(rendererQuery);
  const display=()=>screen.getAllDisplays().find(d=>d.id===position.displayId)??screen.getPrimaryDisplay();
  const bounds=()=>{const area=display().workArea,base=overlayBounds(area,{mode:'capsule',height:CAPSULE_HEIGHT},position.horizontalRatio,position.edge,position.verticalRatio);return expanded?capsuleExtensionBounds(area,base):base;};
  const cap=new BrowserWindow({...bounds(),title:'ZEN · Cápsula',frame:false,thickFrame:false,roundedCorners:false,transparent:false,backgroundColor:'#101116',hasShadow:false,maximizable:false,show:false,skipTaskbar:true,alwaysOnTop:settings.keepOnTop,resizable:false,movable:false,icon,webPreferences:{autoplayPolicy:'no-user-gesture-required',preload,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
  if(process.platform==='win32'){
   cap.setAccentColor(false);
   try{cap.setBackgroundMaterial('none');}catch{/* Windows versions without the backdrop attribute use the solid backing. */}
  }
  let desktop:CompanionDesktop|undefined,revision=0,surfaceReady=false,replyEpoch=0;
  const visibility=new CapsuleVisibility();
  const surfaceVisible=()=>!cap.isDestroyed()&&cap.isVisible()&&!cap.isMinimized();
  let openDialogs=0;
  const withWindowDialog=async <T,>(show:()=>Promise<T>)=>{
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
    expanded,page:workspacePage,
    codexTab,context:contextPage,...launcherPreferences.status(),compact:compactView,
   },
   desktop:desktop?.status(),
  },++revision,surfaceVisible());
  const broadcast=()=>{if(!cap.isDestroyed())cap.webContents.send(companionChannel('status'),snapshot());};
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
   (expanded?workspacePage==='spotify':compactView==='spotify'&&hub.status().approvals.length===0);
  const mediaObservationAllowed=()=>surfaceReady&&privateEffectsAllowed()&&surfaceVisible();
  const observationFixture={playing:false,source:'Spotify',reads:0,playerAvailable:false,playerSource:'Spotify'};
  const mediaHelper=nativeHelper(__dirname,'media');
  const mediaObserver=new CompanionMediaObserver(()=>!smoke?new NativeMediaRpc(mediaHelper):{close:()=>{},request:async(method)=>{if(method!=='nowPlaying')throw Error('Read-only observation fixture');observationFixture.reads++;return{track:observationFixture.playing?{source:observationFixture.source,browser:observationFixture.source==='Google Chrome',title:'Contenido multimedia automático',artist:'ZEN · observación aislada',album:'Sin acciones de reproducción',artwork:null,playing:true}:null};}},mediaObservationAllowed);
  const media=new CompanionMedia(()=>{
   if(!smoke)return new NativeMediaRpc(mediaHelper);
   const sessions=[
    {id:'11111111-1111-4111-8111-111111111111',name:'Spotify',browser:false},
    {id:'22222222-2222-4222-8222-222222222222',name:'Google Chrome',browser:true},
   ];
   let selected=sessions[0],playing=true,manual=false;
   const select=(session:typeof selected)=>{if(session!==selected){selected=session;playing=true;}};
   const track=()=>({session:selected.id,source:selected.name,browser:selected.browser,title:selected.browser?'Vídeo de prueba local':'Música de prueba local',artist:'ZEN · fixture aislada',album:'Multimedia simulada',artwork:null,playing,shuffle:null,repeat:null,positionMs:48000,durationMs:210000,controls:{play:true,pause:true,previous:true,next:true,shuffle:false,repeat:false}});
   return {close:()=>{},request:async(method,params)=>{
    if(method==='list')return {sessions:observationFixture.playerAvailable?sessions:[]};
    if(method==='snapshot'){
     if(!observationFixture.playerAvailable){manual=false;return {sessions:[],track:null,manual};}
     if(params?.followSystem)manual=false;
     if(!manual)select(sessions.find(item=>item.name===observationFixture.playerSource)??sessions[0]);
     return {sessions,track:track(),manual};
    }
    if(method==='select'){
     const session=sessions.find(item=>item.id===params?.session);
     if(!session||!observationFixture.playerAvailable)throw Error('Invalid player fixture selection');
     select(session);manual=true;
    }
    if(method==='action'){playing=params?.action==='play'?true:params?.action==='pause'?false:playing;return {accepted:true};}
    return track();
   }};
  },mediaAllowed);
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
  let shapeSize='';
  const updateShape=()=>{
   const {width,height}=cap.getBounds(),key=width+'x'+height;
   if(key===shapeSize)return;
   const header=Math.min(height,CAPSULE_HEIGHT);
   const rows=capsuleShape({width,height:header});
   if(height>header)rows.push(...capsuleShape({width,height:height-header}).map(row=>({...row,y:row.y+header})));
   cap.setShape(mergeShape(rows));shapeSize=key;
  };
  const positionSurface=()=>{
   const next=bounds(),current=cap.getBounds();if(['x','y','width','height'].some(k=>next[k as keyof typeof next]!==current[k as keyof typeof current]))cap.setBounds(next);
   updateShape();
  };
  cap.on('resize',updateShape);
  const setTopmost=(next:boolean)=>{if(cap.isAlwaysOnTop()!==next)cap.setAlwaysOnTop(next);};
  const fullscreenHere=()=>{const r=desktop?.observation?.fullscreen;return !!(settings.respectFullscreen&&r&&overlaps(screen.screenToDipRect(null,r),display().bounds));};
  const syncVisibility=()=>{
   if(!surfaceReady||cap.isDestroyed()||visibility.hidden)return;
   setTopmost(settings.keepOnTop);
   if(expanded||visibility.visible(fullscreenHere(),desktop?.observation?.foreground,settings.keepOnTop)){
    if(!cap.isMinimized()&&!cap.isVisible())cap.showInactive();
   }else if(cap.isVisible())cap.hide();
  };
  const secure=(w:BrowserWindow,url:string)=>{w.setMenu(null);w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',(e,next)=>{if(next!==url)e.preventDefault();});w.webContents.on('will-frame-navigate',e=>{if(!e.isMainFrame)e.preventDefault();});w.webContents.on('did-finish-load',broadcast);w.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));};
  secure(cap,rendererUrl);
  cap.webContents.session.protocol.handle('zen-theme',request=>{try{const u=new URL(request.url);if(request.method!=='GET'||u.hostname!=='background'||u.search||u.hash||settings.presentation)throw Error();const bytes=appearance.image(u.pathname.slice(1));return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});}catch{return new Response(null,{status:404});}});
  const invalidateContext=()=>{context.invalidate();replyEpoch++;};
  const openWorkspace=(page:WorkspacePage)=>{
   endDrag();
   launcherPreferences.visit(page);
   if(page!=='spotify'||(expanded?workspacePage:compactView)!=='spotify')media.close();
   if(workspacePage!==page)invalidateContext();
   compactView='status';
   workspacePage=page;
   if(page==='notices')hub.markNoticesRead();
   visibility.invoke();
   if(!expanded){expanded=true;positionSurface();}
   if(cap.isMinimized()){cap.setSkipTaskbar(true);cap.restore();}
   syncVisibility();
   if(!cap.isVisible())cap.show();
   if(!cap.isFocused())cap.focus();
   broadcast();
   if(page==='codex')void refreshLastReply();
  };
  const collapse=(view:CapsuleView='status')=>{invalidateContext();endDrag();if(view!=='status'){launcherPreferences.visit(view);workspacePage=view;}if(view!=='spotify')media.close();compactView=view;expanded=false;contextPage=undefined;positionSurface();broadcast();syncVisibility();
   // A Windows restore can apply its previous z-order after the mode change.
   setTimeout(syncVisibility,150).unref();
  };
  const showCapsule=(explicit=true)=>{
   if(cap.isDestroyed())return;
   if(!expanded&&explicit&&settings.followPointerDisplay&&!smoke){
    const d=screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    if(d.id!==position.displayId){
     remember();
     position=placements.forDisplay(position,d.id);
     positionSurface();
     remember();
    }
   }
   visibility.invoke(explicit&&fullscreenHere()?desktop?.observation?.foreground:undefined);
   cap.setSkipTaskbar(true);
   if(cap.isMinimized())cap.restore();
   syncVisibility();
   if(!settings.keepOnTop&&surfaceVisible())cap.moveTop();
   broadcast();
  };
  reveal=()=>showCapsule();
  const endDrag=()=>{clearInterval(dragTimer);clearTimeout(dragLimit);dragTimer=undefined;if(moved){moved=false;remember();}};
  const drag=()=>{if(!surfaceVisible())return;endDrag();const p=screen.getCursorScreenPoint(),b=cap.getBounds(),gx=(p.x-b.x)/b.width,gy=(p.y-b.y)/CAPSULE_HEIGHT;dragTimer=setInterval(()=>{const q=screen.getCursorScreenPoint();if(!moved&&Math.hypot(q.x-p.x,q.y-p.y)<4)return;moved=true;const d=screen.getDisplayNearestPoint(q);const edge=nearestEdge(d.workArea,q,position.edge);position={displayId:d.id,edge,horizontalRatio:edge==='top'?draggedRatio(d.workArea,{mode:'capsule',height:CAPSULE_HEIGHT},q.x,gx):position.horizontalRatio,verticalRatio:edge==='top'?position.verticalRatio:draggedVerticalRatio(d.workArea,q.y,gy)};positionSurface();},30);dragLimit=setTimeout(endDrag,30000);};
  const hide=()=>{endDrag();media.close();visibility.hide();setTopmost(false);cap.setSkipTaskbar(false);cap.minimize();};
  const dismissOnOutsideClick=()=>{
   if(!settings.keepOnTop&&surfaceReady&&!quitting&&!visibility.hidden&&!openDialogs&&!dragTimer&&surfaceVisible())hide();
  };
  desktop=new CompanionDesktop(nativeHelper(__dirname,'desktop'),()=>{syncVisibility();broadcast();},{
   windowHandle:cap.getNativeWindowHandle().readBigUInt64LE().toString(),
   dismiss:dismissOnOutsideClick,
  });
  cap.on('close',e=>{if(!quitting){e.preventDefault();hide();}});cap.on('blur',endDrag);cap.on('restore',reveal);
  const hidePrivateContent=()=>{invalidateContext();mediaObserver.close();broadcast();};cap.on('hide',hidePrivateContent);cap.on('minimize',hidePrivateContent);
  const reposition=()=>{endDrag();const d=display();if(d.id!==position.displayId)position=placements.forDisplay(position,d.id);positionSurface();syncVisibility();};screen.on('display-added',reposition);screen.on('display-removed',reposition);screen.on('display-metrics-changed',reposition);
  const openCurrent=async()=>{await openExternal(codexChatUrl(hub.status()));};
  const tray=new Tray(join(__dirname,'renderer','icons','tray.ico'));tray.setToolTip('ZEN · Codex');tray.setContextMenu(Menu.buildFromTemplate([{label:'Abrir ZEN',click:()=>openWorkspace(launcherPreferences.status().last)},{label:'Mostrar cápsula',click:()=>{if(expanded)collapse();reveal();}},{label:'Volver al chat de Codex',click:()=>void openCurrent()},{label:'Volver a mi aplicación',click:()=>void desktop?.restore().catch(()=>{})},{type:'separator'},{label:'Salir',click:()=>app.quit()}]));tray.on('click',reveal);
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
  handle('appearanceSave',AppearanceOptions,value=>{appearanceWindow();const result=appearance.save(value);broadcast();return result;});
  handle('appearanceChoose',none,async()=>{appearanceWindow();if(smoke){const path=join(profile,'appearance-fixture.png');writeFileSync(path,nativeImage.createFromBitmap(Buffer.from([180,120,70,255]),{width:1,height:1}).toPNG());const result=appearance.import(path);broadcast();return result;}const picked=await withWindowDialog(()=>dialog.showOpenDialog(cap,{title:'Imagen de fondo de ZEN',properties:['openFile'],filters:[{name:'Imagen de fondo',extensions:['png','jpg','jpeg','webp']}]}));appearanceWindow();if(picked.canceled||picked.filePaths.length!==1)return appearance.status();const result=appearance.import(picked.filePaths[0]);broadcast();return result;});
  handle('mediaNowPlaying',none,()=>mediaObservationAllowed()?mediaObserver.read():null);
  handle('mediaObservationClose',none,()=>{mediaObserver.close();return true;});
  handle('navigate',WorkspacePage,page=>{openWorkspace(page);return true;});
  handle('notesRecent', none, () => {
   requireWorkspace('home');
   if (!privateEffectsAllowed()) throw Error('Desactiva la pausa o Presentación para ver apuntes.');
   try {return notes.recentNotes();}
   catch {throw Error('No se pudieron cargar los apuntes recientes.');}
  });
  const requireNotes = () => {
   requireWorkspace('notes');
   if (!privateEffectsAllowed()) throw Error('Desactiva la pausa o Presentación para abrir Apuntes.');
  };
  handle('notesRead', none, () => {
   requireNotes();
   return notes.read();
  });
  handle('notesChange', HubAction, change => {
   requireNotes();
   return notes.change(change, text => { if (smoke) copiedText.push(text); else clipboard.writeText(text); });
  });
  handle('notesDraft', HubDraft.nullable(), draft => {
   requireNotes();
   return notes.draft(draft);
  });
  handle('notesFile', HubFileAction, async (action): Promise<HubFileResult> => {
   requireNotes();
   if (action.type === 'url') {
    await openExternal(action.url);
    return {type:'done'};
   }
   if (action.type === 'image' || action.type === 'import') {
    const image = action.type === 'image';
    const picked = await withWindowDialog(()=>dialog.showOpenDialog(cap, {
     title: image ? 'Adjuntar imagen' : 'Restaurar respaldo de Knowledge Hub', properties:['openFile'],
     filters: image ? [{name:'Imagen',extensions:['png','jpg','jpeg','webp']}] : [{name:'Respaldo JSON',extensions:['json']}],
    }));
    requireNotes();
    const path = picked.filePaths[0];
    if (picked.canceled || !path) return {type:'cancelled'};
    if (!image) {
     let raw: unknown;
     try { raw = JSON.parse(readHubFile(path).toString('utf8').replace(/^\uFEFF/, '')); }
     catch { throw Error('No se pudo leer el respaldo JSON.'); }
     return {type:'import', data:notes.restore(raw)};
    }
    let decoded = nativeImage.createFromBuffer(wallpaperBytes(path));
    if (decoded.isEmpty()) throw Error('No se pudo abrir la imagen.');
    let bytes: Buffer;
    for (const size of [1440, 1100, 800, 560, 400]) {
     const {width, height} = decoded.getSize();
     const scale = Math.min(1, size / Math.max(width, height));
     if (scale < 1) decoded = decoded.resize({width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),quality:'best'});
     bytes = decoded.toPNG();
     if (bytes.length <= 540_000) return {
      type:'image',image:{id:randomUUID(),name:basename(path).slice(0,160),data:'data:image/png;base64,'+bytes.toString('base64')},
     };
    }
    throw Error('La imagen es demasiado grande. Prueba con una más pequeña.');
   }
   const {data} = notes.read();
   const entry = action.type === 'markdown' ? data.entries.find(item => item.id === action.id) : undefined;
   if (action.type === 'markdown' && !entry) throw Error('Guarda el elemento antes de exportarlo.');
   const extension = entry ? 'md' : 'json';
   const destination = await withWindowDialog(()=>dialog.showSaveDialog(cap, {
    title:'Exportar Knowledge Hub',defaultPath:entry ? fileStem(entry.title)+'.md' : 'zen-knowledge-hub.json',
    filters:[{name:entry ? 'Markdown' : 'Respaldo JSON',extensions:[extension]}],
   }));
   requireNotes();
   if (destination.canceled || !destination.filePath) return {type:'cancelled'};
   const path = destination.filePath;
   if ([join(profile,'knowledge-hub.sqlite'),join(profile,'companion-notes.json')].some(file => file.toLowerCase()===path.toLowerCase())) {
    throw Error('Elige otro destino para la exportación.');
   }
   const temporary = path+'.'+randomUUID()+'.tmp';
   try {
    writeFileSync(temporary,entry?entryMarkdown(entry):JSON.stringify(data),{encoding:'utf8',flag:'wx'});
    renameSync(temporary,path);
   } finally {rmSync(temporary,{force:true});}
   return {type:'done'};
  });
  handle('codexTab',CodexTab,tab=>{if(codexTab!==tab){invalidateContext();codexTab=tab;}openWorkspace('codex');return true;});
  handle('togglePage',LauncherPage,page=>{if(expanded&&isLauncherPageSelected(workspacePage,page))collapse();else openWorkspace(page);return true;});
  handle('launcher',z.boolean(),open=>{if(open)openWorkspace(launcherPreferences.status().last);else collapse();return true;});
  handle('compact',CapsuleView,view=>{collapse(view);visibility.invoke();syncVisibility();broadcast();return true;});
  handle('launcherOrder',LauncherOrder,order=>{launcherPreferences.reorder(order);broadcast();return true;});
  handle('options',none,()=>{openWorkspace('options');return true;});
  handle('launcherContext',LauncherPage,page=>{contextPage=page;openWorkspace('shortcuts');return true;});
  handle('mediaCurrent',none,()=>media.current());
  handle('mediaSnapshot',z.literal(true).optional(),followSystem=>media.snapshot(followSystem));
  handle('mediaList',none,()=>media.list());
  handle('mediaSelect',z.uuid(),id=>media.select(id));
  handle('mediaRead',z.uuid(),id=>media.read(id));
  handle('mediaCommand',MediaCommand,value=>media.command(value));
  handle('mediaClose',z.enum(['workspace','compact']).optional(),scope=>{if((scope??'workspace')===(expanded?'workspace':'compact'))media.close();return true;});
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
  const persist=(v:CompanionSettings)=>{if(v.shortcut.toLowerCase()===v.returnShortcut.toLowerCase())throw Error('Usa atajos diferentes para la cápsula y el chat.');const changed=v.shortcut!==settings.shortcut||v.returnShortcut!==settings.returnShortcut;if(changed&&!smoke)registerCompanionShortcuts(globalShortcut,v,reveal,()=>void openCurrent(),settings);try{writeFileSync(file+'.tmp',JSON.stringify(v,null,2));renameSync(file+'.tmp',file);}catch{if(changed&&!smoke)registerCompanionShortcuts(globalShortcut,settings,reveal,()=>void openCurrent(),v);throw Error('No se pudieron guardar las preferencias.');}settings=v;if(v.paused)summaries.clear();if(changed){shortcutIssue=undefined;hub.error=undefined;}hub.update(v);if(v.presentation||v.paused){context?.clear();replyEpoch++;media?.close();mediaObserver?.close();}syncVisibility();return true;};
  handle('save',CompanionSettingsSchema,value=>{requireWorkspace('settings');return persist({...value,keepOnTop:settings.keepOnTop});});
  handle('pinWindow',z.boolean(),enabled=>{
   if(!surfaceVisible())throw Error('Muestra ZEN para cambiar el candado.');
   return enabled===settings.keepOnTop||persist({...settings,keepOnTop:enabled});
  });
  handle('sound',z.boolean(),enabled=>persist({...settings,sounds:enabled}));
  handle('presentation',z.boolean(),enabled=>persist({...settings,presentation:enabled}));
  handle('silence',z.union([z.literal(0),z.literal(30)]),minutes=>persist({...settings,silencedUntil:minutes?Date.now()+minutes*60000:0}));
  handle('testNotice',none,()=>{requireWorkspace('settings');if(settings.presentation)throw Error('Desactiva Presentación para probar avisos.');if(isSilenced(settings))throw Error('Los avisos están silenciados temporalmente. Reactívalos para probar.');if(!settings.notifications)throw Error('Activa las notificaciones para probar el aviso.');notify({id:'test',session:'',title:'Aviso de prueba',kind:'finished',read:false,at:Date.now()});return true;});
  handle('clearNotices',none,()=>{hub.clearNotices();return true;});handle('hide',none,()=>{hide();return true;});handle('drag',z.enum(['start','end']),a=>{a==='start'?drag():endDrag();return true;});
  handle('moveCapsule',CapsuleAlignment,alignment=>{
   if(!surfaceVisible())throw Error('Muestra ZEN para mover la cápsula.');
   endDrag();
   const {id:displayId}=screen.getDisplayMatching(cap.getBounds());
   position={...position,displayId,edge:'top',horizontalRatio:alignment==='left'?0:alignment==='right'?1:.5};
   positionSurface();
   remember();
   return true;
  });
  handle('copy',z.string().max(64000),value=>{if(settings.presentation)throw Error('Desactiva Presentación para copiar detalles.');if(smoke)copiedText.push(value);else clipboard.writeText(value);return true;});
  if(!smoke)try{registerCompanionShortcuts(globalShortcut,settings,reveal,()=>void openCurrent());}catch(e){shortcutIssue=(e as Error).message;hub.error=shortcutIssue;}
  const ticker=setInterval(broadcast,15000);app.on('before-quit',()=>{quitting=true;surfaceReady=false;clearInterval(ticker);clearInterval(replyTicker);replyEpoch++;endDrag();summaries.clear();media?.close();mediaObserver?.close();context?.close();desktop?.close();integration.close();globalShortcut.unregisterAll();tray.destroy();});
  await integration.start();if(!smoke)desktop.start();await cap.loadFile(renderer,{query:rendererQuery});positionSurface();surfaceReady=true;showCapsule(false);if(!smoke)void check();
  if(smoke){app.once('quit',(_event,code)=>process.exit(code));try{const {companionSmoke}=await import('./companion-smoke');const result=await companionSmoke({cap,hub,integration,profile,openedTargets,activateNotice,copiedRequests,queuedRequests,copiedText,media,observationFixture,dismissOnOutsideClick});writeFileSync(join(profile,'smoke-result.json'),JSON.stringify({pid:process.pid,executable:process.execPath,result}));app.quit();}catch(e){console.error(String(e));app.exit(1);}}
 }).catch(e=>{console.error('ZEN companion startup: '+String(e));app.exit(1);});
}
