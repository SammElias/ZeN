import { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { VisualBrowser } from '../tools/toolkit';
import { ZenError } from '../shared/errors';
const Scroll=z.object({type:z.literal('scroll'),x:z.number().int().min(0).max(1023),y:z.number().int().min(0).max(719),scroll_x:z.number().int().min(-2000).max(2000),scroll_y:z.number().int().min(-2000).max(2000)});
export function visualActions(raw:unknown[]) {
  if(!raw.length || raw.length>12)throw new ZenError('Lote visual inválido.');
  return raw.map(value=>{
    if(value&&typeof value==='object'&&'type'in value&&['screenshot','wait'].includes(String(value.type)))return {type:value.type as 'screenshot'|'wait'};
    const result=Scroll.safeParse(value);if(!result.success)throw new ZenError('El navegador visual admite captura y desplazamiento. Clicks, escritura y formularios requieren una política adicional.');return result.data;
  });
}
export class ReadingBrowser implements VisualBrowser {
  private window?:BrowserWindow;
  private abort?:()=>void;
  private signal?:AbortSignal;
  async start(value:string,signal:AbortSignal) {
    signal.throwIfAborted(); const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname)||/\.local$/i.test(url.hostname))throw new ZenError('La lectura visual usa una URL HTTPS pública sin credenciales.');
    const window=new BrowserWindow({width:1024,height:720,useContentSize:true,show:false,webPreferences:{partition:'zen-visual-'+randomUUID(),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});this.window=window;
    this.signal=signal;this.abort=()=>this.close();signal.addEventListener('abort',this.abort,{once:true});
    window.webContents.setWindowOpenHandler(()=>({action:'deny'}));const browserSession=window.webContents.session;
    browserSession.setPermissionRequestHandler((_web,_permission,reply)=>reply(false));
    browserSession.setPermissionCheckHandler(()=>false);browserSession.on('will-download',event=>event.preventDefault());
    // Requests remain in the explicitly requested origin. No cookies/profile reuse.
    browserSession.webRequest.onBeforeRequest((details,reply)=>{let allowed=false;try{allowed=new URL(details.url).origin===url.origin;}catch{}reply({cancel:!allowed});});
    const guard=(event:Electron.Event,destination:string)=>{try{if(new URL(destination).origin!==url.origin)event.preventDefault();}catch{event.preventDefault();}};
    window.webContents.on('will-navigate',guard);window.webContents.on('will-redirect',guard);
    await window.loadURL(url.href);signal.throwIfAborted();return this.screenshot(signal);
  }
  private async screenshot(signal:AbortSignal) {signal.throwIfAborted();if(!this.window||this.window.isDestroyed())throw new ZenError('El navegador visual está cerrado.');const image=await this.window.webContents.capturePage();signal.throwIfAborted();if(image.isEmpty())throw new ZenError('La captura del navegador está vacía.');return 'data:image/png;base64,'+image.toPNG().toString('base64');}
  async act(raw:unknown[],signal:AbortSignal) {
    const actions=visualActions(raw);signal.throwIfAborted();const window=this.window;if(!window||window.isDestroyed())throw new ZenError('El navegador visual está cerrado.');
    for(const action of actions) {
      signal.throwIfAborted();if(action.type==='scroll')window.webContents.sendInputEvent({type:'mouseWheel',x:action.x,y:action.y,deltaX:action.scroll_x,deltaY:action.scroll_y,canScroll:true});
      if(action.type!=='screenshot')await new Promise(resolve=>setTimeout(resolve,150));
    }
    return this.screenshot(signal);
  }
  close(){if(this.abort)this.signal?.removeEventListener('abort',this.abort);this.abort=undefined;const window=this.window;this.window=undefined;if(window&&!window.isDestroyed())window.destroy();}
}
