import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

const directory=resolve('dist/renderer');
const server=createServer(async(request,response)=>{
  try {
    const path=resolve(directory,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));
    if(!path.startsWith(directory+sep))throw Error('Invalid path');
    response.setHeader('Content-Type',{'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.gif':'image/gif'}[extname(path)]??'application/octet-stream');
    response.end(await readFile(path));
  }catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const results=[];
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/preview.html?state=long-result`);
  await page.evaluate(()=>{
    window.layoutCalls=[];window.zen.layout=async value=>{window.layoutCalls.push(value);return{ok:true,value:true};};
    window.captureCalls=0;window.zen.refreshScreen=async()=>{window.captureCalls++;return{ok:true,value:true};};
  });
  await page.getByRole('button',{name:'Desplegar panel'}).click();
  const input=page.getByRole('textbox',{name:'Mensaje para ZEN',exact:true});
  await input.fill('Borrador sin enviar');
  await page.evaluate(()=>{window.originalComposer=document.querySelector('textarea');window.originalMessage=document.querySelector('.live-message');});
  const beforeCaptures=await page.evaluate(()=>window.captureCalls);
  await page.getByRole('button',{name:'Pantalla completa (F11)',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('main').classList.contains('fullscreen')&&window.layoutCalls.at(-1)?.mode==='fullscreen');
  assert.deepEqual(await page.locator('main').boundingBox(),{x:0,y:0,width:1440,height:900});
  assert.equal(await input.inputValue(),'Borrador sin enviar');
  assert(await page.evaluate(()=>document.querySelector('textarea')===window.originalComposer&&document.querySelector('.live-message')===window.originalMessage));
  assert.equal(await page.evaluate(()=>window.captureCalls),beforeCaptures,'Changing the view must not request a screenshot');
  assert((await page.getByRole('region',{name:'Último mensaje',exact:true}).boundingBox()).height>600);
  assert((await page.locator('.chat-page').boundingBox()).width>640);
  assert(await page.locator('.text-composer').isVisible());
  const viewportFits=()=>page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight);
  assert(await viewportFits());
  results.push('full-viewport-readable-column-and-persistent-composer');

  // Reading long output stays under the user's scroll control.
  await page.getByRole('region',{name:'Último mensaje',exact:true}).evaluate(el=>{el.scrollTop=80;el.dispatchEvent(new Event('scroll'));});
  const scroll=await page.getByRole('region',{name:'Último mensaje',exact:true}).evaluate(el=>el.scrollTop);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('main').classList.contains('fullscreen'));
  assert.equal(await input.inputValue(),'Borrador sin enviar');
  assert.equal(await page.locator('main[data-demo-hidden]').count(),0,'First Esc exits full-screen instead of hiding');
  await page.keyboard.press('F11');
  await page.waitForFunction(()=>document.querySelector('main').classList.contains('fullscreen'));
  assert.equal(await page.getByRole('region',{name:'Último mensaje',exact:true}).evaluate(el=>el.scrollTop),scroll);
  results.push('escape-f11-and-scroll-preserved');

  // The attachment menu consumes Esc before the full-screen handler.
  await page.getByRole('button',{name:'Añadir contexto',exact:true}).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('menu',{name:'Añadir contexto'}).count(),0);
  assert(await page.locator('main').evaluate(el=>el.classList.contains('fullscreen')));
  results.push('escape-closes-menu-before-fullscreen');

  // Literal streaming never changes the native requested height or mounts a new chat.
  await page.evaluate(()=>{window.layoutCalls=[];window.originalComposer=document.querySelector('textarea');});
  for(let n=0;n<8;n++)await page.evaluate(n=>window.dispatchEvent(new CustomEvent('zen-demo-task',{detail:{id:'full-stream',state:'thinking',message:'Procesando…',streamText:'Texto literal en stream. '.repeat(n+1)}})),n);
  await page.waitForFunction(()=>document.querySelector('.result-text')?.textContent==='Texto literal en stream. '.repeat(8));
  assert.equal(await page.evaluate(()=>window.layoutCalls.length),0);
  assert(await page.evaluate(()=>document.querySelector('textarea')===window.originalComposer));
  assert(await viewportFits());
  results.push('streaming-without-window-resize');
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/fullscreen-chat.png',animations:'disabled'});

  for(const viewport of [{width:1920,height:1080},{width:800,height:600},{width:380,height:700}]){
    await page.setViewportSize(viewport);
    await page.waitForFunction(()=>document.querySelector('main').getBoundingClientRect().width===innerWidth);
    assert(await viewportFits());
    assert(await page.locator('header').evaluate(el=>Array.from(el.querySelectorAll('button')).every(button=>{const r=button.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})));
  }
  results.push('large-small-and-narrow-displays');
  await page.getByRole('button',{name:'Recoger panel',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('main').classList.contains('capsule'));
  await page.getByRole('button',{name:'Desplegar panel',exact:true}).click();
  assert.equal(await input.inputValue(),'Borrador sin enviar');
  assert.equal(await page.getByRole('button',{name:'Pantalla completa (F11)',exact:true}).count(),1);
  assert.deepEqual(errors,[]);
  results.push('fold-restores-capsule-and-draft');
  const report={at:new Date().toISOString(),passed:true,scope:'real-Edge-renderer-with-mocked-IPC',apiCalled:false,results};
  await writeFile('docs/evidence/fullscreen-ui.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
