import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist/renderer'),directory=resolve('docs/ui-preview/pet');
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.gif':'image/gif'})[extname(path)]??'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));await mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:640,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const emit=detail=>page.evaluate(detail=>window.dispatchEvent(new CustomEvent('zen-demo-task',{detail})),detail);
const settings=detail=>page.evaluate(detail=>window.dispatchEvent(new CustomEvent('zen-demo-settings',{detail})),detail);
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/preview.html?pet=1`);
 await page.evaluate(()=>{document.body.classList.remove('preview');window.runs=0;window.voices=0;window.zen.run=async()=>{window.runs++;return{ok:false,error:'No API in preview'};};window.zen.voiceStart=async()=>{window.voices++;return{ok:false,error:'No microphone in preview'};};});
 const pet=page.locator('.pet-avatar');await pet.waitFor();await pet.hover();await page.waitForTimeout(350);assert.equal(await page.locator('.pet-bubble').count(),0);await page.locator('.pet-bubble').getByText('¿En qué te ayudo?',{exact:true}).waitFor();
 await page.locator('main').screenshot({path:directory+'/hover.png'});
 await page.mouse.move(500,50);await page.waitForTimeout(230);assert.equal(await page.locator('.pet-bubble').count(),0);assert.match(await pet.locator('.companion-gaze').getAttribute('style'),/0px/);
 await pet.focus();await pet.press('Shift+F10');await page.getByRole('menuitem',{name:'Hablar',exact:true}).waitFor();assert.equal(await page.getByRole('menuitem',{name:'Hablar',exact:true}).evaluate(el=>el===document.activeElement),true);
 await page.locator('main').screenshot({path:directory+'/menu.png'});await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');assert.equal(await page.locator('.pet-menu').count(),0);assert.equal(await page.locator('main.pet').count(),1);
 const b=await pet.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+25,b.y+b.height/2+10);await page.mouse.up();assert.equal(await page.locator('main.pet').count(),1);
 await pet.click();await page.getByRole('textbox',{name:'Mensaje para ZEN'}).waitFor();assert.equal(await page.evaluate(()=>window.voices),0);await page.getByRole('textbox',{name:'Mensaje para ZEN'}).fill('Mi borrador');
 await page.getByRole('button',{name:'Recoger panel',exact:true}).click();await pet.waitFor();
 const id='new-task';await emit({id,state:'executing',message:'Trabajo de prueba'});await emit({id,state:'completed',message:'Resultado de prueba verificado'});await page.locator('.pet-bubble').getByText('Resultado de prueba verificado',{exact:true}).waitFor();await page.locator('main').screenshot({path:directory+'/completed.png'});
 await page.getByRole('button',{name:'Cerrar burbuja',exact:true}).click();await emit({id,state:'completed',message:'Resultado de prueba verificado'});assert.equal(await page.locator('.pet-bubble').count(),0);
 await page.waitForTimeout(1900);assert.notEqual(await pet.locator('.zen-robot').getAttribute('data-pose'),'success');
 await emit({id:'failed',state:'failed',message:'Error simulado'});await page.getByText('La tarea necesita atención.',{exact:true}).waitFor();await pet.hover();await page.waitForTimeout(800);assert.equal(await pet.locator('.zen-robot').getAttribute('data-pose'),'concerned');await page.locator('main').screenshot({path:directory+'/attention.png'});
 await emit({id:'codex',state:'awaiting_input',message:'Preparada en Codex',workContext:{owner:'codex',phase:'external'}});assert.equal(await page.locator('main.pet').count(),1);await pet.click();await page.getByRole('button',{name:/^Actividad /}).click();await page.getByText('Continúa en Codex',{exact:false}).first().waitFor();await page.getByRole('button',{name:'Volver a la conversación',exact:true}).click();
 await page.getByRole('button',{name:'Recoger panel',exact:true}).click();await pet.waitFor();assert.equal(await pet.locator('.zen-robot').getAttribute('data-pose'),'idle');
 await settings({petMotion:'reduced',petSilent:true});await pet.hover();await page.waitForTimeout(800);assert.equal(await page.locator('.pet-bubble').count(),0);assert.equal(await pet.locator('.zen-robot').evaluate(el=>el.classList.contains('still')),true);
 await pet.click();await page.getByRole('textbox',{name:'Mensaje para ZEN'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Mensaje para ZEN'}).inputValue(),'Mi borrador');
 await settings({petMotion:'normal',petSilent:false});await page.getByRole('textbox',{name:'Mensaje para ZEN'}).fill('Gracias Zen');await page.getByRole('button',{name:'Enviar mensaje',exact:true}).click();assert.equal(await page.evaluate(()=>window.runs),0);await page.waitForTimeout(100);assert.equal(await page.locator('.robot-dock .zen-robot').getAttribute('data-pose'),'success');
 assert.equal(await page.locator('.conversation-pane.hidden-pane').count(),0);
 await page.locator('main').screenshot({path:directory+'/chat.png'});
 await page.getByRole('button',{name:'Inicio',exact:true}).click();await page.waitForTimeout(300);await page.locator('main').screenshot({path:directory+'/home.png'});
 assert.deepEqual(errors,[]);await writeFile('docs/evidence/pet-ui.json',JSON.stringify({at:new Date().toISOString(),passed:true,scope:'renderer-mocked-events',apiCalled:false,hoverDelay:true,keyboardMenu:true,dragDoesNotOpen:true,draftRestored:true,completionDeduplicated:true,errorPriority:true,codexPending:true,reducedMotion:true,silent:true,noMicOnOpen:true,screenshots:directory},null,2));console.log('Pet renderer checks passed');
}finally{await browser.close();await new Promise(r=>server.close(r));}

