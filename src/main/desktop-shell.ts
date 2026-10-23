import {BrowserWindow,screen} from 'electron';
import {pathToFileURL} from 'node:url';
import {CAPSULE_HEIGHT} from '../shared/island';
import {allowedPortal,initialShellStatus,type ShellAction,type ShellStatus} from '../shared/desktop-shell';
import {overlayBounds,capsuleShape,nearestEdge,draggedRatio,draggedVerticalRatio} from './overlay';
import {CursorGaze} from './cursor-gaze';
import {windowCursor} from '../shared/gaze';
import type {OverlayPosition,OverlayLayout,Settings} from '../shared/contracts';
import {petGeometry,petShape,petPositionAt,type PetPosition,type PetSurface} from '../shared/pet';

/** The capsule is a read-only status/control surface. All task, draft and audio
 * ownership remains in the one existing workspace renderer. */
export class DesktopShell {
 readonly capsule:BrowserWindow;
 readonly capsuleUrl:string;
 readonly children=new Set<BrowserWindow>();
 status=initialShellStatus;
 private gaze:CursorGaze;
 private dragTimer?:ReturnType<typeof setInterval>;
 private dragDeadline?:ReturnType<typeof setTimeout>;
 private beforeFullscreen?:Electron.Rectangle;
 private quitting=false;
 private hidden=false;
 private externalDrag=false;
 private menuOpen=false;
 get receivingWindow(){return this.externalDrag;}
 receiveWindow(active:boolean){this.externalDrag=active;if(!this.capsule.isDestroyed())this.capsule.setIgnoreMouseEvents(active,{forward:true});}
 private position:OverlayPosition;
 private moved=false;
 private destinationChanged=false;
 private settings?:Settings;
 private petPosition:PetPosition;
 private petSurface:PetSurface='none';
 private fullscreenApp=false;
 constructor(readonly workspace:BrowserWindow,private options:{renderer:string;preload:string;icon:string;position:OverlayPosition;petPosition:PetPosition;savePet:(p:PetPosition)=>void;save:(p:OverlayPosition)=>void;changed:()=>void;restore:()=>void}){
  this.position=options.position;
  this.petPosition=options.petPosition;
  this.capsuleUrl=pathToFileURL(options.renderer).href+'?view=capsule';
  this.capsule=new BrowserWindow({...this.bounds(),title:'ZEN · Cápsula',icon:options.icon,frame:false,transparent:true,backgroundColor:'#00000000',movable:false,resizable:false,skipTaskbar:true,alwaysOnTop:true,show:false,webPreferences:{preload:options.preload,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
  this.capsule.setMenu(null);this.capsule.setShape(capsuleShape(this.bounds()));
  this.capsule.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  this.capsule.webContents.on('will-navigate',(event,url)=>{if(url!==this.capsuleUrl)event.preventDefault();});
  this.capsule.on('close',e=>{if(!this.quitting){e.preventDefault();this.hide();}});
  this.capsule.on('restore',()=>{if(this.hidden){this.reveal();options.restore();}});
  this.gaze=new CursorGaze(()=>windowCursor(screen.getCursorScreenPoint(),this.capsule.getContentBounds(),this.capsule.webContents.getZoomFactor()),p=>this.capsule.webContents.send('zen:cursor',p));
  this.capsule.on('show',()=>this.syncGaze());this.capsule.on('hide',()=>this.syncGaze());this.capsule.on('minimize',()=>this.syncGaze());this.capsule.on('restore',()=>this.syncGaze());
  this.capsule.webContents.on('did-finish-load',()=>{this.publish(this.status);this.syncGaze();});
  this.capsule.on('blur',()=>this.endDrag());
  workspace.setResizable(true);workspace.setMovable(true);workspace.setSkipTaskbar(false);workspace.setAlwaysOnTop(false);
  workspace.setMinimumSize(360,440);workspace.setBounds(this.workspaceBounds());
  workspace.webContents.setWindowOpenHandler(({url,frameName})=>allowedPortal(url,frameName)?{action:'allow',overrideBrowserWindowOptions:{title:'ZEN',show:true,width:frameName==='zen-appearance'?400:560,height:frameName==='zen-appearance'?280:650,minWidth:340,minHeight:frameName==='zen-appearance'?250:320,frame:true,transparent:false,backgroundColor:'#111115',icon:options.icon,autoHideMenuBar:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}}}:{action:'deny'});
  workspace.webContents.on('did-create-window',(child)=>{this.children.add(child);child.setMenu(null);child.setSkipTaskbar(false);child.setAlwaysOnTop(false);if(this.externalDrag)child.showInactive();else{child.show();child.focus();}child.webContents.setWindowOpenHandler(()=>({action:'deny'}));child.webContents.on('will-navigate',event=>event.preventDefault());child.on('closed',()=>this.children.delete(child));});
  screen.on('display-removed',this.reposition);screen.on('display-metrics-changed',this.reposition);
 }
 get anchor(){return this.capsule;}
 get dock(){return this.position.edge;}
 get display(){return screen.getAllDisplays().find(d=>d.id===this.position.displayId)??screen.getPrimaryDisplay();}
 // Legacy preference is retained on disk; this shell always uses the capsule.
 get isPet(){return false;}
 petGeometry(){const d=screen.getAllDisplays().find(d=>d.id===this.petPosition.displayId)??this.display;return petGeometry(d.workArea,this.petPosition,this.settings?.petSize??96,this.petSurface);}
 bounds(){const b=overlayBounds(this.display.workArea,{mode:'capsule',height:CAPSULE_HEIGHT},this.position.horizontalRatio,this.position.edge,this.position.verticalRatio);if(!this.menuOpen)return b;const area=this.display.workArea,height=Math.min(234,area.height);return{...b,height,y:Math.min(b.y,area.y+area.height-height)};}
 menu(open:boolean){if(this.externalDrag)return false;this.menuOpen=open;this.positionSurface();return true;}
 configure(settings:Settings){const changed=this.settings?.showPetWhenFolded!==settings.showPetWhenFolded||this.settings?.petSize!==settings.petSize;this.settings=settings;if(changed){this.endDrag();this.petSurface='none';this.positionSurface();}this.applyVisibility();}
 private positionSurface(){this.capsule.setBounds(this.bounds());this.capsule.setShape(this.isPet?petShape(this.petGeometry(),this.petSurface):capsuleShape(this.bounds()));this.capsule.webContents.send('zen:pet-geometry',this.petGeometry());}
 surface(kind:PetSurface){this.petSurface=kind;if(this.isPet)this.positionSurface();return this.petGeometry();}
 dim(fullscreen:boolean){this.fullscreenApp=fullscreen;if(this.isPet)this.applyVisibility();}
 private applyVisibility(){if(this.capsule.isDestroyed()||this.externalDrag)return;const opacity=this.isPet&&this.settings?.petDimFullscreen&&this.fullscreenApp?0.25:1;if(this.capsule.getOpacity()!==opacity)this.capsule.setOpacity(opacity);const top=!this.hidden&&(!this.isPet||!!this.settings?.petAlwaysOnTop);if(this.capsule.isAlwaysOnTop()!==top)this.capsule.setAlwaysOnTop(top);}
 workspaceBounds(){const a=this.display.workArea,w=Math.min(a.width,Math.max(360,Math.round(a.width/2))),h=Math.min(a.height,900);return{x:a.x+Math.round((a.width-w)/2),y:a.y+Math.round((a.height-h)/2),width:w,height:h};}
 private reposition=()=>{if(this.capsule.isDestroyed())return;this.endDrag();this.position={...this.position,displayId:this.display.id};this.positionSurface();if(!screen.getAllDisplays().some(d=>{const b=this.workspace.getBounds(),a=d.workArea;return b.x<a.x+a.width&&b.x+b.width>a.x&&b.y<a.y+a.height&&b.y+b.height>a.y;}))this.workspace.setBounds(this.workspaceBounds());};
 async load(){await this.capsule.loadFile(this.options.renderer,{query:{view:'capsule'}});this.reveal();}
 reveal(){if(this.externalDrag)return;this.hidden=false;this.capsule.setSkipTaskbar(true);if(this.capsule.isMinimized())this.capsule.restore();this.applyVisibility();this.capsule.showInactive();this.syncGaze();}
 hide(){this.endDrag();this.hidden=true;this.capsule.setAlwaysOnTop(false);this.capsule.setSkipTaskbar(false);this.capsule.minimize();this.syncGaze();}
 publish(value:ShellStatus){this.status=value;if(!this.capsule.isDestroyed())this.capsule.webContents.send('zen:shell-status',value);this.syncGaze();}
 cursor(){return this.gaze.current();}
 private syncGaze(){this.gaze?.enable(!this.quitting&&!this.status.reduced&&this.capsule.isVisible()&&!this.capsule.isMinimized());}
 open(action:ShellAction,focus=true){if(this.externalDrag)return;this.reveal();if(['home','chat','attach','region','guide','quick'].includes(action)){if(this.workspace.isMinimized())this.workspace.restore();if(focus){this.workspace.show();this.workspace.focus();}else this.workspace.showInactive();}this.workspace.webContents.send('zen:shell-action',action);}
 closeWorkspace(){this.workspace.hide();}
 layout(next:OverlayLayout){if(next.mode==='fullscreen'&&!this.beforeFullscreen){this.beforeFullscreen=this.workspace.getBounds();this.workspace.setBounds(screen.getDisplayMatching(this.beforeFullscreen).bounds);}else if(next.mode!=='fullscreen'&&this.beforeFullscreen){this.workspace.setBounds(this.beforeFullscreen);this.beforeFullscreen=undefined;}return true;}
 drag(){this.endDrag();const origin=screen.getCursorScreenPoint(),b=this.capsule.getBounds(),grab=(origin.x-b.x)/b.width,vertical=(origin.y-b.y)/b.height;this.moved=false;this.destinationChanged=false;this.dragTimer=setInterval(()=>{const p=screen.getCursorScreenPoint();if(!this.moved&&Math.hypot(p.x-origin.x,p.y-origin.y)<4)return;this.moved=true;const d=screen.getDisplayNearestPoint(p);if(this.isPet){const size=this.settings?.petSize??96,avatar=this.petGeometry().avatar;this.petPosition={displayId:d.id,...petPositionAt(d.workArea,b.x+avatar.x+p.x-origin.x,b.y+avatar.y+p.y-origin.y,size)};this.positionSurface();return;}const edge=nearestEdge(d.workArea,p,this.position.edge);this.destinationChanged ||= d.id!==this.position.displayId;this.position={displayId:d.id,edge,horizontalRatio:edge==='top'?draggedRatio(d.workArea,{mode:'capsule',height:CAPSULE_HEIGHT},p.x,grab):this.position.horizontalRatio,verticalRatio:edge==='top'?this.position.verticalRatio:draggedVerticalRatio(d.workArea,p.y,vertical)};this.capsule.setBounds(this.bounds());},30);this.dragDeadline=setTimeout(()=>this.endDrag(),30000);}
 endDrag(){clearInterval(this.dragTimer);clearTimeout(this.dragDeadline);this.dragTimer=undefined;if(this.moved){this.moved=false;if(this.isPet)this.options.savePet(this.petPosition);else this.options.save(this.position);if(!this.quitting)this.options.changed();}}
 dispose(){this.quitting=true;this.moved=false;this.endDrag();this.gaze.dispose();screen.removeListener('display-removed',this.reposition);screen.removeListener('display-metrics-changed',this.reposition);for(const c of this.children)if(!c.isDestroyed())c.destroy();if(!this.capsule.isDestroyed())this.capsule.destroy();}
}
