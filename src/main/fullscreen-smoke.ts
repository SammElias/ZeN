import {screen,type BrowserWindow} from 'electron';
import {writeFile} from 'node:fs/promises';

// Native geometry and IPC, using simulated DOM input in the isolated test profile.
export async function fullscreenSmoke(window:BrowserWindow){
 const call=(code:string)=>window.webContents.executeJavaScript(code);
 const wait=async(mode:string)=>{for(let n=0;n<90;n++){if(await call(`document.querySelector('main')?.classList.contains('${mode}')`)){await new Promise(r=>setTimeout(r,80));return;}await new Promise(r=>setTimeout(r,20));}throw Error('No se asentó '+mode);};
 await call("document.querySelector('[aria-label=\"Chat\"]').click()");await wait('card');await new Promise(r=>setTimeout(r,300));
 const before=window.getBounds(),monitor=screen.getDisplayMatching(before);
 await call("window.fullscreenComposer=document.querySelector('textarea');window.fullscreenHistory=document.querySelector('.conversations');window.fullscreenScroll=document.querySelector('.chat-scroll-content');window.fullscreenText=window.fullscreenComposer.value;document.querySelector('[aria-label=\"Pantalla completa (F11)\"]').click()");await wait('fullscreen');
 const bounds=window.getBounds();
 const checks={monitorFilled:JSON.stringify(bounds)===JSON.stringify(monitor.bounds),contentPreserved:await call("window.fullscreenComposer===document.querySelector('textarea')&&window.fullscreenText===document.querySelector('textarea').value&&window.fullscreenHistory===document.querySelector('.conversations')&&window.fullscreenScroll===document.querySelector('.chat-scroll-content')"),dragBlocked:!(await call("window.zen.drag('start')")).ok,arbitraryBoundsBlocked:!(await call("window.zen.layout({mode:'fullscreen',height:560,width:9000,x:0})")).ok,viewportFits:await call("(()=>{const b=document.querySelector('.composer-send').getBoundingClientRect();return document.body.scrollWidth<=innerWidth&&b.bottom<=innerHeight;})()"),restored:false,keyboardToggle:false};
 await call("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");await wait('card');
 checks.restored=JSON.stringify(before)===JSON.stringify(window.getBounds())&&await call("document.querySelector('textarea')===window.fullscreenComposer");
 await call("document.dispatchEvent(new KeyboardEvent('keydown',{key:'F11',bubbles:true,cancelable:true}))");await wait('fullscreen');
 checks.keyboardToggle=JSON.stringify(bounds)===JSON.stringify(window.getBounds());
 await call("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");await wait('card');
 const passed=Object.values(checks).every(v=>v===true);
 await writeFile('docs/evidence/fullscreen-merge-native.json',JSON.stringify({at:new Date().toISOString(),scope:'Electron/Windows real; entrada DOM simulada',apiCalled:false,checks,before,bounds,passed},null,2));
 return passed;
}
