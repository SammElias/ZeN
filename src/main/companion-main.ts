import {app,BrowserWindow,ipcMain,Tray,Menu,Notification,screen,globalShortcut,shell,safeStorage,clipboard} from 'electron';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {z} from 'zod';
import {CompanionSettingsSchema,CompanionTargetSchema,type CompanionSettings,type CompanionNotice,type CompanionTarget} from '../shared/codex-companion';
import {CompanionHub} from './companion-hub';
import {CompanionIntegration} from './companion-integration';
import {CodexRpc} from './codex-rpc';
import {Store} from '../storage/store';
import {overlayBounds,capsuleShape,nearestEdge,draggedRatio,draggedVerticalRatio} from './overlay';
import {CAPSULE_HEIGHT} from '../shared/island';
import {codexChatUrl,noticeChatUrl,isSilenced} from '../shared/companion-presentation';
import {inspectCodexCompanion} from './companion-codex-reader';
import {registerCompanionShortcuts} from './companion-shortcuts';
app.setName('ZEN');app.setAppUserModelId('com.zen.desktop');
const smoke=process.argv.includes('--zen-shell-smoke');if(smoke){const p=join(app.getPath('temp'),'zen-companion-smoke-'+process.pid);mkdirSync(p,{recursive:true});app.setPath('userData',p);}
const openedTargets:string[]=[];const openExternal=(url:string)=>smoke?(openedTargets.push(url),Promise.resolve()):shell.openExternal(url);
let reveal=()=>{};if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>reveal());app.on('window-all-closed',()=>{});
 void app.whenReady().then(async()=>{
  const profile=app.getPath('userData'),legacy=new Store(profile,safeStorage),file=join(profile,'companion-settings.json');let settings:CompanionSettings;
  try{settings=CompanionSettingsSchema.parse(JSON.parse(readFileSync(file,'utf8')));}catch{settings=CompanionSettingsSchema.parse({});}
  const targetFile=join(profile,'companion-target.json');let target:CompanionTarget|undefined,targetError:string|undefined;
  if(smoke)target=CompanionTargetSchema.parse({session:'native-test',cwd:'C:\\fixture',title:'Revisar formulario en navegador'});
  else if(existsSync(targetFile))try{target=CompanionTargetSchema.parse(JSON.parse(readFileSync(targetFile,'utf8')));}catch{targetError='No se pudo leer el chat fijado. Revisa la configuración local de ZEN.';}
  let position=legacy.overlayPosition()??{displayId:screen.getPrimaryDisplay().id,edge:'top' as const,horizontalRatio:.5,verticalRatio:.5};
  let menu=false,quitting=false,dragTimer:ReturnType<typeof setInterval>|undefined,dragLimit:ReturnType<typeof setTimeout>|undefined,moved=false;
  const renderer=join(__dirname,'renderer','index.html'),preload=join(__dirname,'preload.cjs'),icon=join(__dirname,'renderer','icons','zen.ico');
  const display=()=>screen.getAllDisplays().find(d=>d.id===position.displayId)??screen.getPrimaryDisplay();
  const bounds=()=>{const area=display().workArea,b=overlayBounds(area,{mode:'capsule',height:CAPSULE_HEIGHT},position.horizontalRatio,position.edge,position.verticalRatio);const height=menu?Math.min(390,area.height):b.height;return{...b,height,y:Math.min(b.y,area.y+area.height-height)};};
  const cap=new BrowserWindow({...bounds(),title:'ZEN · Cápsula',frame:false,transparent:true,backgroundColor:'#00000000',show:false,skipTaskbar:true,alwaysOnTop:true,resizable:false,movable:false,icon,webPreferences:{autoplayPolicy:'no-user-gesture-required',preload,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
  const panels=new Map<string,BrowserWindow>();const windows=()=>[cap,...panels.values()].filter(w=>!w.isDestroyed());
  const broadcast=()=>{for(const w of windows())w.webContents.send('companion:status',hub.status());};
  const activateNotice=async(n:CompanionNotice)=>{if(n.id==='test'){reveal();return;}await openExternal(noticeChatUrl(hub.status(),n));};
  const notify=(n:CompanionNotice)=>{if(smoke||isSilenced(settings)||!Notification.isSupported())return;const toast=new Notification({title:'ZEN · '+n.title,body:n.id==='test'?'Aviso de prueba de ZEN.':'Pulsa para volver a este chat en Codex.',silent:n.id==='test'||!settings.sounds||(cap.isVisible()&&!cap.isMinimized()),icon});toast.on('click',()=>{void activateNotice(n).catch(()=>{});});toast.show();};
  const hub=new CompanionHub(settings,broadcast,notify,undefined,target);hub.targetError=targetError;
  const integration=new CompanionIntegration(profile,smoke?join(profile,'codex-fixture'):process.env.CODEX_HOME??join(app.getPath('home'),'.codex'),join(__dirname,'hook'),hub);
  const positionSurface=()=>{cap.setBounds(bounds());cap.setShape(capsuleShape(bounds()));};
  const secure=(w:BrowserWindow,url:string)=>{w.setMenu(null);w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',(e,next)=>{if(next!==url)e.preventDefault();});w.webContents.on('did-finish-load',broadcast);w.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));};
  secure(cap,pathToFileURL(renderer).href+'?view=capsule');
  const panel=async(view:string)=>{if(view==='notices')hub.markNoticesRead();if(!smoke&&(view==='settings'||view==='activity'))void check();let w=panels.get(view);if(w&&!w.isDestroyed()){w.show();w.focus();return;}w=new BrowserWindow({width:600,height:680,minWidth:360,minHeight:420,title:'ZEN · '+({settings:'Preferencias',activity:'Actividad de Codex',approvals:'Permisos',notices:'Avisos'} as any)[view],icon,backgroundColor:'#101113',show:false,autoHideMenuBar:true,webPreferences:{preload,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});panels.set(view,w);secure(w,pathToFileURL(renderer).href+'?view='+view);w.on('closed',()=>panels.delete(view));await w.loadFile(renderer,{query:{view}});w.show();};
  reveal=()=>{if(cap.isDestroyed())return;cap.setSkipTaskbar(true);if(cap.isMinimized())cap.restore();cap.setAlwaysOnTop(true);cap.showInactive();broadcast();};
  const endDrag=()=>{clearInterval(dragTimer);clearTimeout(dragLimit);dragTimer=undefined;if(moved){moved=false;legacy.saveOverlayPosition(position);}};
  const drag=()=>{endDrag();const p=screen.getCursorScreenPoint(),b=cap.getBounds(),gx=(p.x-b.x)/b.width,gy=(p.y-b.y)/b.height;dragTimer=setInterval(()=>{const q=screen.getCursorScreenPoint();if(!moved&&Math.hypot(q.x-p.x,q.y-p.y)<4)return;moved=true;const d=screen.getDisplayNearestPoint(q),edge=nearestEdge(d.workArea,q,position.edge);position={displayId:d.id,edge,horizontalRatio:edge==='top'?draggedRatio(d.workArea,{mode:'capsule',height:CAPSULE_HEIGHT},q.x,gx):position.horizontalRatio,verticalRatio:edge==='top'?position.verticalRatio:draggedVerticalRatio(d.workArea,q.y,gy)};positionSurface();},30);dragLimit=setTimeout(endDrag,30000);};
  const hide=()=>{endDrag();cap.setAlwaysOnTop(false);cap.setSkipTaskbar(false);cap.minimize();};
  cap.on('close',e=>{if(!quitting){e.preventDefault();hide();}});cap.on('blur',endDrag);cap.on('restore',reveal);
  const reposition=()=>{endDrag();position={...position,displayId:display().id};positionSurface();};screen.on('display-removed',reposition);screen.on('display-metrics-changed',reposition);
  const openCurrent=async()=>{await openExternal(codexChatUrl(hub.status()));};
  const tray=new Tray(join(__dirname,'renderer','icons','tray.ico'));tray.setToolTip('ZEN · Codex');tray.setContextMenu(Menu.buildFromTemplate([{label:'Mostrar cápsula',click:reveal},{label:'Volver al chat de Codex',click:()=>void openCurrent()},{label:'Actividad de Codex',click:()=>void panel('activity')},{label:'Preferencias',click:()=>void panel('settings')},{type:'separator'},{label:'Salir',click:()=>app.quit()}]));tray.on('click',reveal);
  let shortcutIssue:string|undefined,checking:Promise<boolean>|undefined;
  const check=()=>checking??=(async()=>{
   hub.checking=true;hub.error=shortcutIssue;broadcast();let rpc:CodexRpc|undefined;
   try{await integration.refresh();rpc=new CodexRpc();await rpc.initialize();const result=await inspectCodexCompanion(rpc,integration.command,app.getPath('home'),hub.status().sessions);hub.account=result.account;hub.connection=result.connection;for(const [id,title]of result.titles)hub.setTitle(id,title);return true;}
   catch{hub.connection={...hub.connection,state:'unavailable',checkedAt:Date.now()};hub.error='No se pudo comprobar Codex. Ábrelo y vuelve a comprobar la conexión.';return false;}
   finally{rpc?.close();hub.checking=false;checking=undefined;broadcast();}
  })();
  const handle=(name:string,schema:z.ZodType,fn:(v:any,source:BrowserWindow)=>unknown)=>ipcMain.handle('companion:'+name,async(e,input)=>{try{const w=BrowserWindow.fromWebContents(e.sender);if(!w||!windows().includes(w)||e.senderFrame!==e.sender.mainFrame||e.senderFrame.url!==pathToFileURL(renderer).href+'?view='+(w===cap?'capsule':[...panels].find(([,win])=>win===w)?.[0]))throw Error('Origen no autorizado.');return{ok:true,value:await fn(schema.parse(input),w)};}catch(e){return{ok:false,error:e instanceof z.ZodError?'Petición no válida.':(e as Error).message};}});
  const none=z.undefined();handle('status',none,()=>hub.status());handle('check',none,()=>check());handle('open',z.string().max(160).optional(),async id=>{await openExternal(codexChatUrl(hub.status(),id));return true;});
  handle('menu',z.boolean(),open=>{menu=open;positionSurface();return true;});handle('panel',z.enum(['activity','approvals','notices']),async v=>{await panel(v);return true;});handle('settings',none,async()=>{await panel('settings');return true;});
  handle('decide',z.object({id:z.string().uuid(),decision:z.enum(['allow','deny','pass'])}).strict(),(v,w)=>{if(w!==panels.get('approvals'))throw Error('Revisa la propuesta completa en Permisos.');hub.decide(v.id,v.decision);return true;});
  handle('install',none,async(_v,w)=>{if(w!==panels.get('settings'))throw Error('Abre Preferencias para preparar la integración.');await integration.install();if(!smoke)void check();return true;});
  const persist=(v:CompanionSettings)=>{if(v.shortcut.toLowerCase()===v.returnShortcut.toLowerCase())throw Error('Usa atajos diferentes para la cápsula y el chat.');const changed=v.shortcut!==settings.shortcut||v.returnShortcut!==settings.returnShortcut;if(changed&&!smoke)registerCompanionShortcuts(globalShortcut,v,reveal,()=>void openCurrent(),settings);try{writeFileSync(file+'.tmp',JSON.stringify(v,null,2));renameSync(file+'.tmp',file);}catch{if(changed&&!smoke)registerCompanionShortcuts(globalShortcut,settings,reveal,()=>void openCurrent(),v);throw Error('No se pudieron guardar las preferencias.');}settings=v;if(changed){shortcutIssue=undefined;hub.error=undefined;}hub.update(v);return true;};
  handle('save',CompanionSettingsSchema,(v,w)=>{if(w!==panels.get('settings'))throw Error('Abre Preferencias.');return persist(v);});
  handle('sound',z.boolean(),enabled=>persist({...settings,sounds:enabled}));
  handle('silence',z.union([z.literal(0),z.literal(30)]),minutes=>persist({...settings,silencedUntil:minutes?Date.now()+minutes*60000:0}));
  handle('testNotice',none,(_v,w)=>{if(w!==panels.get('settings'))throw Error('Abre Preferencias.');if(isSilenced(settings))throw Error('Los avisos están silenciados temporalmente. Reactívalos para probar.');if(!settings.notifications)throw Error('Activa las notificaciones para probar el aviso.');notify({id:'test',session:'',title:'Aviso de prueba',kind:'finished',read:false,at:Date.now()});return true;});
  handle('clear',none,()=>{hub.clearNotices();return true;});handle('hide',none,()=>{hide();return true;});handle('drag',z.enum(['start','end']),a=>{a==='start'?drag():endDrag();return true;});handle('cursor',none,()=>null);
  handle('copy',z.string().max(64000),value=>{clipboard.writeText(value);return true;});
  if(!smoke)try{registerCompanionShortcuts(globalShortcut,settings,reveal,()=>void openCurrent());}catch(e){shortcutIssue=(e as Error).message;hub.error=shortcutIssue;}
  const ticker=setInterval(broadcast,15000);app.on('before-quit',()=>{quitting=true;clearInterval(ticker);endDrag();integration.close();globalShortcut.unregisterAll();tray.destroy();});
  await integration.start();await cap.loadFile(renderer,{query:{view:'capsule'}});positionSurface();reveal();if(!smoke)void check();
  if(smoke){try{const {companionSmoke}=await import('./companion-smoke');console.log(JSON.stringify(await companionSmoke({cap,panels,panel,hub,integration,profile,openedTargets,activateNotice})));app.quit();}catch(e){console.error(String(e));app.exit(1);}}
 }).catch(e=>{console.error('ZEN companion startup: '+String(e));app.exit(1);});
}
