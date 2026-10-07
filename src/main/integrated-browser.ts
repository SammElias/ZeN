import {BrowserWindow,WebContentsView,session,shell,dialog,type WebContents} from 'electron';
import {browserUrl,googleSignIn,externalBrowserUrl,emptyBrowserState,type BrowserState,type BrowserCommand,type BrowserViewport} from '../shared/browser';

// A user-operated browser, completely separate from agent/tool viewers. No
// preload, ZEN bridge, page extraction or model access to this session.
export class IntegratedBrowser {
  private view?:WebContentsView;
  private viewport:BrowserViewport={visible:false};
  private state:BrowserState={...emptyBrowserState};
  private popups=new Set<BrowserWindow>();
  private audioAllowed=false;
  private disposed=false;
  private readonly profile=session.fromPartition('persist:zen-user-browser-v1');
  constructor(private host:BrowserWindow,private emit:(state:BrowserState)=>void,private enabled:()=>boolean) {
    this.profile.setPermissionCheckHandler((contents,permission,origin,details)=>permission==='media'&&details.mediaType==='audio'&&this.audioAllowed&&this.owns(contents)&&origin==='https://chatgpt.com'&&this.isVisible());
    this.profile.setPermissionRequestHandler((contents,permission,reply,details)=>{
      const url=contents?.getURL();
      if(permission!=='media'||!this.owns(contents)||!this.isVisible()||!url||new URL(url).origin!=='https://chatgpt.com'||!details.isMainFrame||!('mediaTypes' in details)||!details.mediaTypes?.length||!details.mediaTypes.every(type=>type==='audio'))return reply(false);
      if(this.audioAllowed)return reply(true);
      void dialog.showMessageBox(this.host,{type:'question',title:'Micrófono de ChatGPT',message:'¿Permitir que chatgpt.com use el micrófono?',detail:'El audio se envía a ChatGPT desde su página. Este permiso dura mientras mantengas abierto Navegador.',buttons:['Ahora no','Permitir'],defaultId:0,cancelId:0,noLink:true}).then(result=>{
        const allowed=result.response===1&&!contents.isDestroyed()&&contents.getURL()===url&&this.isVisible();this.audioAllowed=allowed;reply(allowed);
      },()=>reply(false));
    });
    this.profile.on('will-download',this.blockDownload);
    this.host.on('resize',this.sync);
    this.host.on('show',this.sync);
    this.host.on('hide',this.suspend);
    this.host.on('minimize',this.suspend);
    this.host.on('closed',this.dispose);
  }
  private blockDownload=(event:Electron.Event)=>{event.preventDefault();this.update({error:'Para descargar este archivo, abre la página en tu navegador habitual.'});};
  private owns(contents:WebContents|null){return !!contents&&(contents===this.view?.webContents||[...this.popups].some(w=>!w.isDestroyed()&&w.webContents===contents));}
  private isVisible(){return !this.disposed&&this.viewport.visible&&this.enabled()&&!this.host.isDestroyed()&&this.host.isVisible()&&!this.host.isMinimized();}
  snapshot(){return {...this.state};}
  private update(value:Partial<BrowserState>={}){if(this.disposed)return;this.state={...this.state,...value};this.emit(this.snapshot());}
  private refresh=()=>{const web=this.view?.webContents;if(!web||web.isDestroyed())return;this.update({url:!web.getURL()||web.getURL()==='about:blank'?this.state.url:web.getURL(),title:web.getTitle().slice(0,160)||'Navegador',loading:web.isLoading(),canBack:web.navigationHistory.canGoBack(),canForward:web.navigationHistory.canGoForward()});};
  private permitted(destination:string):boolean {
    try {browserUrl(destination);}catch{this.update({error:'Este enlace no se puede abrir en ZEN. Usa una dirección HTTPS.'});return false;}
    if(googleSignIn(destination)){
      this.update({loading:false,error:'Google requiere el navegador habitual para iniciar sesión. Esa sesión no se transfiere a ZEN. En ChatGPT puedes probar otro método de acceso disponible.',externalUrl:this.state.url.includes('openai.com')||this.state.url.includes('chatgpt.com')?'https://chatgpt.com/':'https://accounts.google.com/'});return false;
    }
    return true;
  }
  private protect(web:WebContents){
    const guard=(event:Electron.Event,url:string)=>{if(!this.permitted(url))event.preventDefault();};
    web.on('will-navigate',guard);web.on('will-redirect',guard);
    web.on('will-frame-navigate',(event)=>{if(!/^https:\/\//i.test(event.url)&&event.url!=='about:blank')event.preventDefault();});
    web.on('will-attach-webview',event=>event.preventDefault());
    web.setWindowOpenHandler(({url})=>{
      if(!this.isVisible()||!this.permitted(url)||this.popups.size>=2)return {action:'deny'};
      return {action:'allow',overrideBrowserWindowOptions:{parent:this.host,autoHideMenuBar:true,width:600,height:720,webPreferences:{session:this.profile,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,preload:undefined}}};
    });
    web.on('did-create-window',popup=>{
      this.popups.add(popup);popup.setMenu(null);this.protect(popup.webContents);
      const title=()=>{if(!popup.isDestroyed()){try{popup.setTitle('ZEN · '+new URL(popup.webContents.getURL()).origin);}catch{popup.setTitle('ZEN · Acceso web');}}};
      popup.on('page-title-updated',event=>{event.preventDefault();title();});popup.webContents.on('did-navigate',title);
      popup.on('closed',()=>this.popups.delete(popup));
    });
  }
  private ensure(){
    if(this.view)return this.view;
    const view=new WebContentsView({webPreferences:{session:this.profile,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false}});
    this.view=view;this.host.contentView.addChildView(view);view.setVisible(false);view.setBackgroundColor('#101014');this.protect(view.webContents);
    view.webContents.on('did-start-loading',this.refresh);view.webContents.on('did-stop-loading',this.refresh);view.webContents.on('did-navigate',this.refresh);view.webContents.on('did-navigate-in-page',this.refresh);view.webContents.on('page-title-updated',this.refresh);
    view.webContents.on('did-fail-load',(_event,code,_description,_url,main)=>{if(main&&code!==-3)this.update({loading:false,error:'No se ha podido cargar la página. Reintenta o ábrela en tu navegador habitual.'});});
    view.webContents.on('render-process-gone',()=>{this.update({loading:false,error:'La página se ha cerrado inesperadamente. Pulsa Recargar para recuperarla.'});});
    this.sync();return view;
  }
  setViewport(value:BrowserViewport){this.viewport=value;if(value.visible&&!this.view)void this.command({action:'navigate',url:'https://chatgpt.com/'});this.sync();return true;}
  sync=()=>{
    const view=this.view;if(!view||this.host.isDestroyed())return;
    const bounds=this.viewport.bounds,content=this.host.getContentBounds();
    const visible=this.isVisible()&&!!bounds&&!!this.state.url;
    if(visible&&bounds){const x=Math.max(0,Math.min(bounds.x,content.width));const y=Math.max(80,Math.min(bounds.y,content.height));view.setBounds({x,y,width:Math.max(0,Math.min(bounds.width,content.width-x)),height:Math.max(0,Math.min(bounds.height,content.height-y-8))});}
    view.setVisible(visible);view.webContents.setAudioMuted(!visible);
    if(!visible){if(this.audioAllowed)view.webContents.reload();this.audioAllowed=false;for(const popup of this.popups)if(!popup.isDestroyed())popup.destroy();}
  };
  suspend=()=>{this.viewport={visible:false};this.sync();};
  async command(command:BrowserCommand){
    if(command.action==='external'){const url=this.state.externalUrl||this.state.url;if(!url)throw Error('Abre primero una página.');await shell.openExternal(externalBrowserUrl(url));return this.snapshot();}
    if(command.action==='navigate'){
      const url=browserUrl(command.url);if(!this.permitted(url))return this.snapshot();
      const view=this.ensure();this.audioAllowed=false;this.update({url,error:undefined,externalUrl:undefined,loading:true});this.sync();
      void view.webContents.loadURL(url).catch(()=>{});return this.snapshot();
    }
    const web=this.view?.webContents;if(!web||web.isDestroyed())return this.snapshot();
    if(command.action==='back'&&web.navigationHistory.canGoBack())web.navigationHistory.goBack();
    if(command.action==='forward'&&web.navigationHistory.canGoForward())web.navigationHistory.goForward();
    if(command.action==='reload'){this.update({error:undefined,externalUrl:undefined});web.reload();}
    if(command.action==='stop')web.stop();
    return this.snapshot();
  }
  dispose=()=>{if(this.disposed)return;this.disposed=true;this.host.removeListener('resize',this.sync);this.host.removeListener('show',this.sync);this.host.removeListener('hide',this.suspend);this.host.removeListener('minimize',this.suspend);this.profile.removeListener('will-download',this.blockDownload);for(const popup of this.popups)if(!popup.isDestroyed())popup.destroy();if(this.view&&!this.view.webContents.isDestroyed())this.view.webContents.close();this.profile.flushStorageData();void this.profile.cookies.flushStore();};
}
