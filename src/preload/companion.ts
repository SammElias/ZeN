import {contextBridge,ipcRenderer} from 'electron';
import type {CompanionBridge,CompanionStatus} from '../shared/codex-companion';
const call=(name:string,...args:unknown[])=>ipcRenderer.invoke('companion:'+name,...args);
const on=<T>(name:string,cb:(v:T)=>void)=>{const listener=(_e:Electron.IpcRendererEvent,v:T)=>cb(v);ipcRenderer.on('companion:'+name,listener);return()=>ipcRenderer.removeListener('companion:'+name,listener);};
const bridge:CompanionBridge={status:()=>call('status'),onStatus:cb=>on<CompanionStatus>('status',cb),openCodex:id=>call('open',id),check:()=>call('check'),settings:()=>call('settings'),install:()=>call('install'),save:v=>call('save',v),menu:v=>call('menu',v),panel:v=>call('panel',v),decide:(id,decision)=>call('decide',{id,decision}),clearNotices:()=>call('clear'),copy:text=>call('copy',text),sound:enabled=>call('sound',enabled),silence:minutes=>call('silence',minutes),testNotice:()=>call('testNotice'),hide:()=>call('hide'),drag:a=>call('drag',a),cursor:()=>call('cursor'),onCursor:cb=>on('cursor',cb)};
contextBridge.exposeInMainWorld('companion',Object.freeze(bridge));
