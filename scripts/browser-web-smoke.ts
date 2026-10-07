import {app,BrowserWindow,type WebContentsView} from 'electron';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {IntegratedBrowser} from '../src/main/integrated-browser';
async function run(){
  const host=new BrowserWindow({show:false,width:1040,height:800,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const browser=new IntegratedBrowser(host,()=>{},()=>true);const pages=[];
  try{
    await host.loadURL('data:text/html,<title>ZEN public browser test</title>');host.show();await new Promise(r=>setTimeout(r,50));host.show();
    browser.setViewport({visible:true,bounds:{x:0,y:80,width:1020,height:680}});
    for(const [name,url] of [['google','https://www.google.com/'],['chatgpt','https://chatgpt.com/']]){
      await browser.command({action:'navigate',url});
      for(let i=0;i<80&&browser.snapshot().loading;i++)await new Promise(r=>setTimeout(r,250));
      await new Promise(r=>setTimeout(r,1500));
      const view=host.contentView.children.find(v=>'webContents' in v&&(v as WebContentsView).webContents!==host.webContents) as WebContentsView;
      view.webContents.setBackgroundThrottling(false);browser.sync();await new Promise(r=>setTimeout(r,300));const image=await view.webContents.capturePage();if(image.isEmpty())throw Error('Empty browser image: '+JSON.stringify({visible:host.isVisible(),bounds:view.getBounds()}));await writeFile(`test-results/browser-public-${name}.png`,image.toPNG());
      pages.push({name,...browser.snapshot()});
    }
    const report={at:new Date().toISOString(),scope:'public pages in isolated embedded Chromium, no account or login automation',pages,apiCalled:false,authenticatedChatVerified:false};
    await writeFile('docs/evidence/browser-public-web.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{browser.dispose();host.destroy();app.quit();}
}
mkdtemp(join(tmpdir(),'zen-browser-public-')).then(profile=>{app.setPath('userData',profile);return app.whenReady();}).then(run).catch(error=>{console.error(error);app.exit(1);});
