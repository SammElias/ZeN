import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';

// Independently sampled from the artwork: faces, the cross aisle and the entrance.
const faces={architect:[306,200],coordinator:[675,198],analyst:[1010,201],alm:[1380,234],
  developer:[320,641],observer:[758,626],tester:[1340,651]};
const passages=[[275,434],[725,461],[1060,472],[1428,470],[1053,689],[826,875]];

export async function checkPanorama(page,office,design) {
  const out=resolve('release/panoramica');
  await mkdir(out,{recursive:true});
  const stage=office.locator('.graphite-stage');
  const button=name=>stage.getByRole('button',{name,exact:true});
  const frame=stage.locator('.graphite-frame');
  await button('Ver todo').click();
  const previous=await frame.boundingBox();
  await button('Ver a pantalla completa').click();
  await page.waitForFunction(()=>document.fullscreenElement?.matches('.officina'));
  await office.locator('.graphite-stage[data-layout=panorama][data-ready=true]').waitFor();
  const rect=await stage.boundingBox(), image=await frame.boundingBox();
  const viewport=await page.evaluate(()=>[innerWidth,innerHeight]);
  assert.deepEqual([rect.x,rect.y,rect.width,rect.height],[0,0,...viewport]);
  assert.ok(image.width>=rect.width-1 && image.height>=rect.height-1,'Franjas en la panorámica');
  assert.equal(await stage.locator('.graphite-label').count(),7);
  const point=([x,y])=>({x:image.x+x*image.width/1672,y:image.y+y*image.height/941});
  const who=p=>page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('.graphite-room')?.dataset.role??null,p);
  for(const [role,xy] of Object.entries(faces)) assert.equal(await who(point(xy)),role);
  for(const xy of passages) assert.equal(await who(point(xy)),null);
  await page.mouse.move(0,0);
  await page.screenshot({path:join(out,design+'-plano.png')});
  if(design==='graphite') {
    const metrics=await page.context().newCDPSession(page);
    try {
      for(const [width,height,dpr] of [[1280,1024,1.25],[2560,1080,1.5]]) {
        await metrics.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
        await page.waitForFunction(({width,height,faces})=>{
          const pic=document.querySelector('.graphite-plate').getBoundingClientRect();
          return pic.width>=width-1 && pic.height>=height-1 && Object.entries(faces).every(([role,[x,y]])=>
            document.elementFromPoint(pic.x+x*pic.width/1672,pic.y+y*pic.height/941)?.closest('.graphite-room')?.dataset.role===role);
        },{width,height,faces});
      }
    } finally {
      await metrics.send('Emulation.clearDeviceMetricsOverride');
      await metrics.detach();
    }
    await page.waitForFunction(w=>Math.abs(document.querySelector('.graphite-frame').getBoundingClientRect().width-w)<1,image.width);
  }
  for(const [role,face] of Object.entries(faces)) {
    const pos=point(face);
    await page.mouse.click(pos.x,pos.y);
    await office.locator('.graphite-stage[data-camera='+role+']').waitFor();
    await office.locator('.graphite-crossfade').waitFor({state:'hidden'});
    const panel=office.locator('.officina-room-panel[data-room='+role+']');
    await panel.waitFor();
    const fits=()=>stage.evaluate(el=>{
      const stage=el.getBoundingClientRect(),pic=el.querySelector('.graphite-plate').getBoundingClientRect();
      return pic.left>=stage.left-1 && pic.right<=stage.right+1 && pic.top>=stage.top-1 && pic.bottom<=stage.bottom+1;
    });
    assert.ok(await fits(),'Despacho recortado: '+role);
    assert.ok(await page.evaluate(()=>document.fullscreenElement?.matches('.officina')));
    if(role==='architect') {
      await panel.getByRole('form',{name:'Decisión de Officina'}).waitFor();
      await page.screenshot({path:join(out,design+'-arquitecto.png')});
    }
    if(role==='alm') {
      await panel.getByRole('heading',{name:'Versiones y entregas'}).waitFor();
      await page.screenshot({path:join(out,design+'-despacho.png')});
      await office.getByRole('button',{name:'Ampliar el puesto',exact:true}).click();
      await page.waitForFunction(()=>{
        const stage=document.querySelector('.graphite-stage').getBoundingClientRect();
        const image=document.querySelector('.graphite-plate').getBoundingClientRect();
        return stage.width===innerWidth && stage.height===innerHeight && image.width>=innerWidth-1 && image.height>=innerHeight-1;
      });
      await page.screenshot({path:join(out,design+'-puesto.png')});
      const jump=office.getByRole('combobox',{name:'Ir a otro despacho'});
      await jump.selectOption('developer');
      await office.locator('.graphite-stage[data-camera=developer]').waitFor();
      await jump.selectOption('alm');
      await office.locator('.graphite-stage[data-camera=alm]').waitFor();
      await office.getByRole('button',{name:'Ver habitación completa',exact:true}).click();
      await panel.waitFor();
      await page.waitForFunction(()=>{
        const s=document.querySelector('.graphite-stage').getBoundingClientRect();
        const p=document.querySelector('.graphite-plate').getBoundingClientRect();
        return p.width<=s.width+1 && p.height<=s.height+1;
      });
      await panel.getByRole('combobox',{name:'Cambiar de despacho'}).selectOption('tester');
      await office.locator('.graphite-stage[data-camera=tester]').waitFor();
      await office.locator('.officina-room-panel[data-room=tester]').getByRole('button',{name:'Ver tarea',exact:true}).click();
      await office.getByRole('dialog').waitFor();
      await office.getByRole('button',{name:'Cerrar ficha',exact:true}).click();
      assert.ok(await page.evaluate(()=>document.fullscreenElement?.matches('.officina')));
    }
    if(role==='observer') {
      await stage.focus();
      await page.keyboard.press('Alt+ArrowLeft');
    } else await office.getByRole('button',{name:'Volver a Officina',exact:true}).click();
    await office.locator('.graphite-stage[data-layout=panorama][data-ready=true]').waitFor();
  }
  await button('Salir de pantalla completa').click();
  await page.waitForFunction(()=>!document.fullscreenElement);
  await page.waitForFunction(box=>{
    const pic=document.querySelector('.graphite-frame')?.getBoundingClientRect();
    return pic && ['x','y','width','height'].every(k=>Math.abs(box[k]-pic[k])<=1);
  },previous);
  await button('Restablecer encuadre').click();
  if(design==='graphite') {
    await office.locator('.officina-team-select[data-role=architect]').click();
    const panel=office.locator('.officina-room-panel[data-room=architect]');
    await panel.getByRole('button',{name:'Pedir cambios',exact:true}).click();
    const draft=panel.getByLabel('Indica qué quieres cambiar');
    await draft.fill('Mantener el nombre de la entidad.');
    await button('Ver a pantalla completa').click();
    await page.waitForFunction(()=>document.fullscreenElement?.matches('.officina'));
    assert.equal(await draft.inputValue(),'Mantener el nombre de la entidad.');
    await button('Salir de pantalla completa').click();
    await page.waitForFunction(()=>!document.fullscreenElement);
    assert.equal(await draft.inputValue(),'Mantener el nombre de la entidad.');
    await draft.fill('');
    await office.getByRole('button',{name:'Volver a Officina',exact:true}).click();
    await office.locator('.graphite-stage[data-camera=overview]').waitFor();
  }
  console.log(design,viewport.join(' × '),'siete habitaciones enteras, cambio directo y retorno en pantalla completa.');
}
