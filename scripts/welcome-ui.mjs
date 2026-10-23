// Production UI with demo data; no network/model, microphone, or user profile.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist/renderer'),dir='docs/ui-preview/welcome';await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+sep))throw Error();res.setHeader('Content-Type',{'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[extname(p)]??'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:640,height:560}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/preview.html?conversations=1');
 // Use the native window's block root, not the demo page's shrink-to-fit flex wrapper.
 await page.evaluate(()=>document.body.classList.remove('preview'));
 await page.getByRole('button',{name:'Desplegar panel',exact:true}).click();
 await page.getByRole('button',{name:'Inicio',exact:true}).click();
 await page.locator('[data-presentation=welcome]').waitFor();
 const input=page.getByRole('textbox',{name:'Mensaje para ZEN',exact:true});await input.fill('Borrador conservado');
 const sizes=[];
 for(const [width,height] of [[640,560],[580,480],[320,360],[360,480],[960,640],[960,1032]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  assert.equal(await page.locator('.mascot-host').count(),1);
  await page.locator('.welcome-art img').first().evaluate(img=>img.decode());
  assert(await page.getByRole('heading',{name:'¿Qué hacemos hoy?'}).isVisible());
  assert(await input.isVisible());assert(await page.locator('.composer-send').isVisible());
  const geometry=await page.evaluate(()=>{
   const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom};};
   return{panel:r('main'),hero:r('.home-leaning'),title:r('.home-leaning h1'),composer:r('.composer-shell'),horizontalOverflow:document.body.scrollWidth>innerWidth,backLayer:+getComputedStyle(document.querySelector('.welcome-art-back')).zIndex,titleLayer:+getComputedStyle(document.querySelector('.home-leaning h1')).zIndex,handsLayer:+getComputedStyle(document.querySelector('.welcome-art-hands')).zIndex};
  });
  assert.equal(geometry.panel.width,width);assert.equal(geometry.panel.height,height);assert(!geometry.horizontalOverflow);assert(geometry.hero.bottom<=geometry.composer.y+1);assert(geometry.title.height>=32);assert(geometry.backLayer<geometry.titleLayer&&geometry.titleLayer<geometry.handsLayer);
  sizes.push({width,height,...geometry});await page.screenshot({path:`${dir}/${width}x${height}.png`});
 }
 await page.setViewportSize({width:640,height:560});
 await page.getByRole('button',{name:'Chat',exact:true}).click();await page.locator('[data-presentation=full]').waitFor();assert.equal(await page.locator('.mascot-host').count(),1);assert.equal(await input.inputValue(),'Borrador conservado');
 await page.getByRole('button',{name:'Inicio',exact:true}).click();await page.locator('[data-presentation=welcome]').waitFor();
 await page.getByRole('button',{name:'Recoger panel',exact:true}).click();await page.locator('[data-presentation=compact]').waitFor();assert.equal(await page.locator('.mascot-host').count(),1);
 await page.getByRole('button',{name:'Desplegar panel',exact:true}).click();await page.locator('[data-presentation=welcome]').waitFor();assert.equal(await input.inputValue(),'Borrador conservado');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.mascot-welcome').evaluate(el=>el.getAnimations({subtree:true}).length),0);
 assert.deepEqual(errors,[]);
 const asset=await page.locator('.welcome-art img').first().evaluate(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return{width:c.width,height:c.height,transparentCorner:ctx.getImageData(0,0,1,1).data[3]===0};});assert(asset.transparentCorner);
 const report={at:new Date().toISOString(),scope:'Production renderer in Edge; demo data and synthetic input',passed:true,singleMascot:true,depthLayers:true,draftAndNavigation:true,reducedMotion:true,asset,sizes,apiCalled:false};await writeFile('docs/evidence/welcome-ui.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}
