import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {people,passage} from './officina-graphite-smoke.mjs';
import {checkPanorama} from './officina-panorama-smoke.mjs';

const output=resolve('release/oficinas');
export async function chooseOffice(page,design) {
  assert.equal((await page.evaluate(()=>window.companion.navigate('settings'))).ok,true);
  await page.getByRole('button',{name:'Volver',exact:true}).waitFor();
  const nav=page.locator('.preferences-nav [data-category=officina]');
  if(await nav.isVisible()) await nav.click();
  else await page.getByLabel('Categoría de preferencias').selectOption('officina');
  const group=page.getByRole('group',{name:'Diseño de oficina'});
  assert.equal(await group.getByRole('button').count(),4);
  const card=group.locator('[data-design='+design+']');
  if(await card.getAttribute('aria-pressed')!=='true') await card.click();
  await group.locator('[aria-pressed=true][data-design='+design+']').waitFor();
  if(design==='nexus') await page.screenshot({path:join(output,'preferencias.png')});
  await page.getByRole('button',{name:'Volver',exact:true}).click();
  await page.locator('.graphite-stage[data-ready=true][data-design='+design+']').waitFor();
}

export async function checkDesigns({page,office,load,resize,app}) {
  await mkdir(output,{recursive:true});
  const stage=office.locator('.graphite-stage');
  const original=load(),roles=['architect','analyst','developer','coordinator','tester','alm','observer'];
  const camera=role=>office.locator('.graphite-stage[data-camera='+role+']').waitFor();
  const task=office.getByRole('combobox',{name:'Encargo de Officina'});
  const initialTask=await task.inputValue();
  async function around() {
    await stage.getByRole('button',{name:'Ver todo',exact:true}).click();
    const box=await stage.locator('.graphite-plate').boundingBox();
    const point=([x,y])=>({x:box.x+x*box.width/1024,y:box.y+y*box.height/1536});
    for(const p of passage) assert.equal(await page.evaluate(({x,y})=>
      document.elementFromPoint(x,y)?.closest('.graphite-room')?.dataset.role??null,point(p)),null);
    return point;
  }
  const screenTransforms=()=>stage.locator('.graphite-screen').evaluateAll(els=>els.map(el=>el.style.transform));
  const framePose=()=>stage.locator('.graphite-frame').evaluate(el=>
    [el.offsetLeft,el.offsetTop,el.offsetWidth,el.offsetHeight]);
  await around();
  const reference=await screenTransforms();
  const comparisons=resolve('release/plantas-integradas/capturas');
  await mkdir(comparisons,{recursive:true});
  async function captureFinish(design) {
    await office.locator('.officina-team-select[data-role=coordinator]').click();
    await camera('coordinator');
    await page.keyboard.press('Escape');
    await camera('overview');
    await around();
    await page.mouse.move(8,8);
    await stage.screenshot({path:join(comparisons,design+'.png')});
  }
  await captureFinish('graphite');
  await checkPanorama(page,office,'graphite');
  for(const design of ['monochrome','redline','nexus']) {
    await stage.getByRole('button',{name:'Acercar',exact:true}).click();
    const previousFrame=await framePose();
    await chooseOffice(page,design);
    await camera('overview');
    assert.deepEqual(await framePose(),previousFrame);
    assert.equal(await task.inputValue(),initialTask);
    await stage.getByRole('button',{name:'Restablecer encuadre'}).click();
    await page.screenshot({path:join(output,design+'.png')});
    await around();
    assert.deepEqual(await screenTransforms(),reference);
    await captureFinish(design);
    await checkPanorama(page,office,design);
    if(process.argv.includes('--plates')) {
      const layers=stage.locator('.graphite-frame > :not(.graphite-plate), .graphite-tools');
      await layers.evaluateAll(els=>els.forEach(el=>el.style.visibility='hidden'));
      try {await stage.locator('.graphite-plate').screenshot({path:join(output,design+'-planta.png')});}
      finally {await layers.evaluateAll(els=>els.forEach(el=>el.style.removeProperty('visibility')));}
    }
    for(const role of roles) {
      const badge=stage.locator('.graphite-label[data-agent='+role+']');
      const team=office.locator('.officina-team-select[data-role='+role+']');
      assert.equal(await badge.locator('strong').innerText(),await team.locator('strong').innerText());
      assert.equal(await badge.getAttribute('data-state'),await team.locator('..').getAttribute('data-state'));
      if(await badge.getAttribute('data-action')==='true') {
        assert.ok((await team.innerText()).includes(await badge.locator('.graphite-status').innerText()));
      } else {
        const color=el=>getComputedStyle(el).color;
        assert.equal(await badge.locator('.graphite-status').evaluate(color),await team.locator('.officina-tracking-label').evaluate(color));
      }
      // Probe the actual character artwork, independently of the button polygon.
      const projectPoint=await around();
      const point=projectPoint(people[role]);
      assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('.graphite-room')?.dataset.role,point),role);
      await page.mouse.click(point.x,point.y);await camera(role);
      await office.locator('.officina-room-panel[data-room='+role+']').waitFor();
      const monitor=stage.locator('.graphite-screen[data-monitor='+role+']').first();
      await monitor.waitFor();
      assert.ok(await monitor.locator('.graphite-instrument').evaluate(el=>el.getAnimations({subtree:true}).length>0));
      if(role==='alm') {
        await stage.locator('.graphite-crossfade').waitFor({state:'hidden'});
        await page.screenshot({path:join(output,design+'-alm.png')});
      }
      await page.keyboard.press('Escape');await camera('overview');
    }
  }
  await resize(app,page,1220,730);await around();await resize(app,page,948,977);
  await office.locator('.officina-team-select[data-role=architect]').click();
  const panel=office.locator('.officina-room-panel[data-room=architect]');
  await panel.getByRole('button',{name:'Pedir cambios',exact:true}).click();
  const draft=panel.getByLabel('Indica qué quieres cambiar');
  await draft.fill('Borrador al cambiar de diseño');
  await stage.getByRole('button',{name:'Acercar',exact:true}).click();
  const zoomedRoom=await framePose();
  const roomScreens=await screenTransforms();
  await chooseOffice(page,'redline');await camera('architect');
  assert.deepEqual(await framePose(),zoomedRoom);
  assert.deepEqual(await screenTransforms(),roomScreens);
  assert.equal(await task.inputValue(),initialTask);
  assert.equal(await draft.inputValue(),'Borrador al cambiar de diseño');
  assert.equal(await stage.locator('.graphite-screen').first().getAttribute('data-value'),original.goals[0].humanRequest.text);
  await draft.fill('');await page.keyboard.press('Escape');await camera('overview');
  await chooseOffice(page,'graphite');
  await stage.getByRole('button',{name:'Restablecer encuadre',exact:true}).click();
  assert.deepEqual(load(),original,'La navegación no debe modificar el tablero');
  console.log('Tres acabados sobre la planta de Grafito y 21 despachos verificados. Coinciden los puntos de paso, la cámara y los monitores. Se conserva el borrador.');
}
