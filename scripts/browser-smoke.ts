import {app,BrowserWindow,session,type WebContentsView} from 'electron';
import assert from 'node:assert/strict';
import {IntegratedBrowser} from '../src/main/integrated-browser';
const profile=process.argv[2],phase=process.argv[3];
if(!profile||!['write','read'].includes(phase))throw Error('Fixture arguments missing');
app.setPath('userData',profile);
async function run(){
const host=new BrowserWindow({show:true,width:1040,height:800,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
let externalRequests=0;
const profileSession=session.fromPartition('persist:zen-user-browser-v1');
profileSession.protocol.handle('https',request=>{
  const url=new URL(request.url);if(!['zen-browser.test','chatgpt.com'].includes(url.hostname)){externalRequests++;return new Response('Blocked fixture',{status:403});}
  return new Response('<!doctype html><title>ZEN browser fixture</title><h1>Browser fixture</h1><a id="next" href="/next">Next</a>',{headers:{'Content-Type':'text/html'}});
});
const browser=new IntegratedBrowser(host,()=>{},()=>true);
const until=async(test:()=>boolean|Promise<boolean>)=>{for(let i=0;i<100;i++){if(await test())return;await new Promise(r=>setTimeout(r,50));}throw Error('Fixture timeout');};
try{
  await host.loadURL('data:text/html,<title>ZEN test host</title>');host.show();
  browser.setViewport({visible:true,bounds:{x:10,y:110,width:1020,height:670}});
  assert.equal(browser.snapshot().url,'https://chatgpt.com/');
  await browser.command({action:'navigate',url:'https://zen-browser.test/'});
  const view=host.contentView.children.find(v=>'webContents' in v&&(v as WebContentsView).webContents!==host.webContents) as WebContentsView;
  assert(view);await until(()=>!browser.snapshot().loading&&browser.snapshot().title==='ZEN browser fixture');
  const web=view.webContents,settings=web.getLastWebPreferences();
  assert.equal(settings.sandbox,true);assert.equal(settings.contextIsolation,true);assert.equal(settings.nodeIntegration,false);assert.equal(settings.webSecurity,true);assert(!settings.preload);
  assert.equal(await web.executeJavaScript("typeof window.zen+'|'+typeof process+'|'+typeof require"),'undefined|undefined|undefined');
  assert(view.getVisible());assert(view.getBounds().y>=80);
  if(phase==='write'){
    await web.executeJavaScript("localStorage.setItem('zen-fixture','persisted');document.cookie='zen_session_fixture=retained; max-age=3600; Secure; SameSite=Lax; path=/'");
    await profileSession.cookies.flushStore();profileSession.flushStorageData();
  }else{
    assert.equal(await web.executeJavaScript("localStorage.getItem('zen-fixture')==='persisted'&&document.cookie.includes('zen_session_fixture=retained')"),true);
  }
  await browser.command({action:'navigate',url:'https://zen-browser.test/next'});await until(()=>!browser.snapshot().loading&&browser.snapshot().canBack);
  await browser.command({action:'back'});await until(()=>browser.snapshot().url==='https://zen-browser.test/'&&browser.snapshot().canForward);
  await assert.rejects(()=>browser.command({action:'navigate',url:'file:///C:/secret.txt'}));
  await browser.command({action:'navigate',url:'https://accounts.google.com/o/oauth2/auth'});assert(browser.snapshot().error?.includes('Google'));assert.equal(new URL(web.getURL()).hostname,'zen-browser.test');
  await web.executeJavaScript("document.body.insertAdjacentHTML('beforeend','<a id=bad href=file:///C:/secret.txt>bad</a>');document.querySelector('#bad').click()");await new Promise(r=>setTimeout(r,150));assert.equal(new URL(web.getURL()).hostname,'zen-browser.test');
  await web.executeJavaScript("void window.open('https://zen-browser.test/popup')");
  await until(()=>BrowserWindow.getAllWindows().some(w=>w!==host));
  const popup=BrowserWindow.getAllWindows().find(w=>w!==host)!;await until(()=>!popup.webContents.isLoading());assert.equal(popup.webContents.getLastWebPreferences().sandbox,true);assert.equal(await popup.webContents.executeJavaScript("typeof window.zen+'|'+typeof require"),'undefined|undefined');
  browser.setViewport({visible:false});assert(popup.isDestroyed());assert.equal(view.getVisible(),false);assert.equal(web.isAudioMuted(),true);
  browser.setViewport({visible:true,bounds:{x:0,y:1,width:9000,height:9000}});assert(view.getBounds().y>=80);assert(view.getBounds().width<=host.getContentBounds().width);assert(view.getBounds().y+view.getBounds().height<=host.getContentBounds().height);
  assert.equal(externalRequests,0);
  console.log(JSON.stringify({phase,passed:true,isolatedRenderer:true,persistentStorage:phase==='read',googleEmbeddedLoginBlocked:true,unsafeNavigationBlocked:true,historyVerified:true,hideAndBoundsVerified:true,apiCalled:false}));
  browser.dispose();host.destroy();app.quit();
}catch(error){console.error(error);browser.dispose();host.destroy();app.exit(1);}
}
app.whenReady().then(run).catch(error=>{console.error(error);app.exit(1);});
