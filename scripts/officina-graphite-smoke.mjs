import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

// Physical features on the approved plan: each person's head and independently
// sampled door jambs, corridor and outside margins. Do not derive these from the hit map.
export const people={architect:[417,286],analyst:[796,318],coordinator:[263,546],alm:[812,659],
  developer:[170,865],tester:[773,976],observer:[344,1060]};
export const passage=[[501,536],[488,706],[417,835],[418,920],[516,771],[598,596],[515,1217],[81,1190]];

export async function checkGraphite({app,page,office,resize,load,update,db,board,startClip}){
  const output=resolve('release/grafito-zoom');await mkdir(output,{recursive:true});
  const stage=office.locator('.graphite-stage');
  const plan=stage.locator('.graphite-frame');
  async function camera(value) {await office.locator(`.graphite-stage[data-camera="${value}"]`).waitFor();}
  const panel=(role)=>office.locator(`.officina-room-panel[data-room="${role}"]`);
  async function geometry(){
    await camera('overview');
    await stage.getByRole('button',{name:'Ver todo',exact:true}).click();
    const box=await plan.boundingBox();
    assert.ok(Math.abs(box.width/box.height-2/3)<.002,'Se deformó la lámina del plano');
    const at=([x,y])=>({x:box.x+x*box.width/1024,y:box.y+y*box.height/1536});
    for(const [role,point] of [...Object.entries(people),...passage.map(p=>[null,p])]){
      assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('.graphite-room')?.dataset.role ?? null,at(point)),role,
        'Punto del plano '+point);
    }
    return at;
  }
  async function clickPerson(role){const at=await geometry(),p=at(people[role]);await page.mouse.click(p.x,p.y);await camera(role);await panel(role).waitFor();}
  async function back(role,team=false){
    await page.keyboard.press('Escape');await camera('overview');
    await office.locator(`.${team?'officina-team-select':'graphite-room'}[data-role="${role}"]:focus`).waitFor();
  }
  await camera('overview');
  await page.mouse.move(8,8);
  await stage.locator('.graphite-label[data-action=true]').filter({hasText:'Aprobar'}).waitFor();
  const button=name=>stage.getByRole('button',{name,exact:true});
  const center=await stage.boundingBox(), covered=await plan.boundingBox();
  assert.ok(covered.width>=center.width-2.1 && covered.height>=center.height-2.1);
  assert.deepEqual(await stage.locator('.graphite-instrument').evaluateAll(els=>[...new Set(els.map(el=>el.dataset.role))].sort()),Object.keys(people).sort());
  async function expectMotion(role) {
    const instrument=stage.locator('.graphite-instrument[data-role='+role+']').first();
    await page.waitForFunction(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running'),await instrument.elementHandle());
    const time=()=>instrument.evaluate(el=>el.getAnimations({subtree:true})[0]?.currentTime ?? 0);
    const start=await time();await page.waitForTimeout(120);assert.ok(await time()>start);
  }
  async function checkStatuses() {
    const badges=stage.locator('.graphite-label');
    assert.equal(await badges.count(),7);
    for(const role of Object.keys(people)) {
      const badge=stage.locator('.graphite-label[data-agent='+role+']');
      const row=office.locator('.officina-team-select[data-role='+role+']');
      assert.equal(await badge.locator('strong').innerText(),await row.locator('strong').innerText());
      assert.equal(await badge.getAttribute('data-state'),await row.locator('..').getAttribute('data-state'));
      if(await badge.getAttribute('data-action')==='true') assert.match(await row.innerText(),new RegExp(await badge.locator('.graphite-status').innerText()));
      else {
        assert.equal(await badge.locator('.graphite-status').innerText(),await row.locator('.officina-tracking-label').innerText());
        const color=el=>getComputedStyle(el).color;
        assert.equal(await badge.locator('.graphite-status').evaluate(color),await row.locator('.officina-tracking-label').evaluate(color));
      }
    }
    assert.equal(await badges.locator('small').innerText(),board.tasks[0].title);
  }
  await checkStatuses();
  async function setMotion(enabled) {
    assert.equal((await page.evaluate(()=>window.companion.navigate('settings'))).ok,true);
    const nav=page.locator('.preferences-nav [data-category=officina]');
    if(await nav.isVisible()) await nav.click();
    else await page.getByLabel('Categoría de preferencias').selectOption('officina');
    const prefs=page.locator('.preferences-content[data-category=officina]');
    await prefs.getByRole('heading',{name:'Diseño de oficina',exact:true}).waitFor();
    assert.equal(await prefs.locator('.officina-design-card').count(),4);
    await prefs.getByLabel('Animaciones de ZEN',{exact:true}).setChecked(enabled);
    await prefs.getByRole('button',{name:'Guardar',exact:true}).click();
    await prefs.getByText('Preferencias guardadas.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Volver',exact:true}).click();
    await camera('overview');
  }
  await setMotion(false);
  assert.equal(await stage.locator('.graphite-instrument').first().evaluate(el=>el.getAnimations({subtree:true}).length),0);
  await setMotion(true);
  await expectMotion('developer');
  async function fullscreen() {
    await button('Ver a pantalla completa').click();
    await page.waitForFunction(()=>document.fullscreenElement?.classList.contains('officina'));
    await button('Salir de pantalla completa').click();
    await page.waitForFunction(()=>!document.fullscreenElement);
  }
  async function checkChatLayout() {
    await office.getByRole('button',{name:'Chat global',exact:true}).click();
    await office.locator('.officina-chat').waitFor();
    assert.equal(await office.locator('.officina-layout').evaluate(el=>getComputedStyle(el).display),'none',
      'El plano y Equipo ocupan espacio en Chat global');
    const [above,below,unusedWidth]=await office.evaluate(root=>{
      const box=selector=>root.querySelector(selector).getBoundingClientRect();
      const chat=box('.officina-chat');
      return [chat.top-box('.officina-header').bottom,box('.officina-chat-compose').top-chat.bottom,root.clientWidth-chat.width];
    });
    assert.ok(above>=0 && above<=10 && below>=0 && below<=10 && unusedWidth<=18,
      'Chat global debe llenar el espacio entre la cabecera y el compositor');
  }
  async function checkSheet(opener) {
    await opener.click();
    const sheet=office.getByRole('dialog');
    await sheet.waitFor();
    await page.waitForFunction(el=>{
      const sheet=el.querySelector('dialog[open]').getBoundingClientRect();
      const bounds=el.getBoundingClientRect();
      return ['top','left','width','height'].every(axis=>Math.abs(sheet[axis]-bounds[axis])<=1);
    },await office.elementHandle());
    assert.equal(await sheet.evaluate(el=>getComputedStyle(el,'::backdrop').backgroundColor),'rgba(0, 0, 0, 0)');
    return sheet;
  }
  await fullscreen();
  await checkChatLayout();
  await page.screenshot({path:join(output,'chat-global.png')});
  const taskButton=office.locator('.officina-chat-toolbar').getByRole('button',{name:'Ver tarea'});
  await checkSheet(taskButton);
  await page.keyboard.press('Escape');
  await office.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await taskButton.evaluate(el=>document.activeElement===el),true);
  assert.equal(await stage.locator('.graphite-instrument').first().evaluate(el=>el.getAnimations({subtree:true}).length),0);
  await office.getByRole('button',{name:'Equipo',exact:true}).click();
  await expectMotion('developer');
  await stage.focus();await page.keyboard.press('+');await button('Restablecer encuadre').filter({hasText:'125%'}).waitFor();
  await page.keyboard.press('0');
  await page.screenshot({path:join(output,'plano.png')});
  await page.mouse.move(center.x+center.width/2,center.y+center.height/2);
  await page.mouse.wheel(0,-210);
  await page.waitForFunction(w=>document.querySelector('.graphite-frame').getBoundingClientRect().width>w,covered.width+20);
  const enlarged=await plan.boundingBox();
  const from={x:enlarged.x+people.alm[0]*enlarged.width/1024,y:enlarged.y+people.alm[1]*enlarged.height/1536};
  await page.mouse.move(from.x,from.y);await page.mouse.down();
  await page.mouse.move(from.x-75,from.y+24,{steps:8});await page.mouse.up();await camera('overview');
  const dragged=await plan.boundingBox();
  assert.ok(dragged.x < enlarged.x-30,'Arrastrar sobre un puesto mueve la cámara');
  await page.mouse.click(dragged.x+people.alm[0]*dragged.width/1024,dragged.y+people.alm[1]*dragged.height/1536);
  await camera('alm');await back('alm');
  const restored=await plan.boundingBox();
  for(const key of ['x','y','width','height']) assert.ok(Math.abs(restored[key]-dragged[key])<2,'Volver conserva '+key);
  await button('Restablecer encuadre').click();
  assert.ok(Math.abs((await plan.boundingBox()).width-covered.width)<2);
  for(const role of Object.keys(people)) {
    await clickPerson(role);
    assert.ok(await stage.locator('.graphite-plate').evaluate(i=>i.naturalWidth>=1024));
    assert.ok(await stage.locator('.graphite-screen').count()>0);
    await expectMotion(role);
    if(role==='alm') await fullscreen();
    if(role==='coordinator') {
      await panel(role).getByText('1. Arquitecto · Espera decisión',{exact:true}).waitFor();
      await panel(role).getByText(/Depende de Arquitecto/).waitFor();
    }
    if(!['alm','architect'].includes(role)) {
      await page.waitForTimeout(380);
      await page.screenshot({path:join(output,'despacho-'+role+'.png')});
    }
    await back(role);
    await office.locator(`.officina-team-select[data-role=${role}]`).click();
    await camera(role);await panel(role).waitFor();
    await office.getByRole('button',{name:'Volver a Officina'}).click();await camera('overview');
    await office.locator(`.officina-team-select[data-role=${role}]:focus`).waitFor();
  }
  const cdp=await page.context().newCDPSession(page);
  for(const [w,h,dpr] of [[1280,700,1],[948,977,1.25],[640,850,1.5]]) {
    await resize(app,page,w,h);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:dpr,mobile:false});
    await checkChatLayout();
    const sheet=await checkSheet(taskButton);
    await sheet.getByRole('button',{name:'Cerrar ficha'}).click();
    await office.getByRole('button',{name:'Equipo',exact:true}).click();
    await geometry();
    if(w===640){
      await clickPerson('observer');
      assert.ok((await panel('observer').boundingBox()).y>=(await stage.boundingBox()).y+(await stage.boundingBox()).height);
      await back('observer');
    }
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  }
  await cdp.detach();await resize(app,page,948,977);
  await office.locator('.officina-team-select[data-role="coordinator"]').click();
  await camera('coordinator');
  const boardSheet=await checkSheet(panel('coordinator').getByRole('button',{name:'Tablero del proyecto'}));
  await boardSheet.getByRole('button',{name:'Nueva tarea'}).waitFor();
  await boardSheet.evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
  await page.screenshot({path:join(output,'tablero-integrado.png')});
  await boardSheet.getByRole('button',{name:'Cerrar ficha'}).click();
  await back('coordinator',true);
  assert.equal((await page.evaluate(()=>window.companion.togglePanel())).ok,true);
  const capsule=page.locator('.companion-capsule.collapsed');
  await capsule.waitFor();
  const briefcase=page.locator('.capsule-launcher button[data-page=officina]');
  await briefcase.locator('[data-kind=decision]').waitFor();
  await briefcase.click();await camera('architect');
  await panel('architect').getByText(board.goals[0].humanRequest.text,{exact:true}).first().waitFor();
  const switcher=office.getByRole('combobox',{name:'Cambiar de despacho'});
  await switcher.selectOption('observer');await switcher.selectOption('developer');await switcher.selectOption('architect');
  await camera('architect');assert.equal(await stage.locator('.graphite-frame').count(),1);
  await office.getByRole('button',{name:'Volver a Officina'}).click();await camera('overview');
  await resize(app,page,948,977);
  await page.emulateMedia({reducedMotion:'reduce'});
  const architect=stage.locator('.graphite-room[data-role=architect]');
  await architect.focus();await page.keyboard.press('Space');await camera('architect');
  assert.equal(await stage.locator('.graphite-crossfade').count(),0);
  const form=panel('architect').getByRole('form',{name:'Decisión de Officina'});
  await page.screenshot({path:join(output,'arquitecto.png')});
  await form.getByRole('button',{name:'Pedir cambios',exact:true}).click();
  const draft=form.getByLabel('Indica qué quieres cambiar');
  await draft.fill('Conservar los nombres de entidades.');
  await button('Acercar').click();await button('Alejar').click();
  assert.equal(await draft.inputValue(),'Conservar los nombres de entidades.');
  assert.equal(await stage.locator('.graphite-instrument').first().evaluate(el=>el.getAnimations({subtree:true}).length),0);
  const old=load(),stale=structuredClone(old);delete stale.goals[0].humanRequest;
  const send=await form.getByRole('button',{name:'Enviar cambios'}).elementHandle();
  update(stale);await send.evaluate(b=>b.click());
  await office.locator('.officina-header .officina-error').waitFor();update(old);
  assert.equal(await draft.inputValue(),'Conservar los nombres de entidades.');
  const updated=structuredClone(old);
  updated.goals[0].humanRequest.text='¿Apruebas la relación entre cuenta y proyecto?';
  updated.goals[0].humanRequest.markdown=updated.goals[0].humanRequest.markdown.replace('CLIENTE','CUENTA');
  update(updated);
  await panel('architect').getByText(updated.goals[0].humanRequest.text,{exact:true}).first().waitFor();
  await stage.locator('.graphite-screen[data-value="¿Apruebas la relación entre cuenta y proyecto?"]').waitFor();
  await page.keyboard.press('Escape');await camera('overview');
  await clickPerson('architect');
  const beforeCount=load().runs.length;
  await form.getByRole('button',{name:'Aprobar y continuar'}).evaluate(b=>{b.click();b.click();});
  await form.waitFor({state:'detached'});
  const accepted=load();
  assert.equal(accepted.runs.filter(r=>r.humanAnswer?.action==='approve').length,1);
  assert.equal(accepted.runs.filter(r=>r.role==='developer').length,1);
  assert.ok(accepted.runs.length>beforeCount);
  await back('architect');
  await office.getByRole('button',{name:'Chat global',exact:true}).click();
  await office.getByText(/^Aprobado · ¿Apruebas la relación/).first().waitFor();
  await office.getByRole('button',{name:'Equipo',exact:true}).click();
  const project2={id:randomUUID(),name:'Proyecto alternativo',tasks:[],queueEnabled:true,runs:[],events:[],goals:[]};
  db.prepare('INSERT INTO officina_projects VALUES (?,?,?)').run(project2.id,project2.name,JSON.stringify(project2));
  const picker=office.getByRole('combobox',{name:'Proyecto de Officina'});
  await picker.locator('option',{hasText:project2.name}).waitFor({state:'attached'});
  await picker.selectOption(project2.id);await camera('overview');await clickPerson('alm');
  await panel('alm').getByText('Sin encargo activo',{exact:true}).waitFor();
  await back('alm');
  await office.getByRole('button',{name:'Chat global',exact:true}).click();
  await office.getByRole('combobox',{name:'Destinatario del encargo'}).selectOption('coordinator');
  await office.getByPlaceholder('Describe lo que quieres').fill('Analiza el contenido en Google Chrome con la herramienta de ChatGPT en el navegador.');
  await office.getByRole('button',{name:/Enviar a coordinación/i}).click();
  await office.locator('.officina-current').getByText('Trabajando en Codex',{exact:true}).waitFor();
  await office.getByRole('button',{name:'Equipo',exact:true}).click();
  const lime=stage.locator('.graphite-label[data-agent=analyst][data-state=working]');
  await lime.waitFor();
  const rgb=el=>getComputedStyle(el).color;
  assert.equal(await lime.locator('.graphite-status').evaluate(rgb),'rgb(201, 244, 127)');
  assert.equal(await office.locator('.officina-team-select[data-role=analyst] .officina-tracking-label').evaluate(rgb),'rgb(201, 244, 127)');
  await button('Restablecer encuadre').click();
  await page.screenshot({path:join(output,'agente-trabajando.png')});
  await lime.waitFor({state:'detached'});
  await picker.selectOption(board.id);await camera('overview');
  await page.emulateMedia({reducedMotion:'no-preference'});
  const stop=startClip && await startClip(page,output);
  await button('Restablecer encuadre').click();await page.waitForTimeout(550);
  await button('Acercar').click();await page.waitForTimeout(450);await clickPerson('alm');await page.waitForTimeout(520);
  await button('Acercar').click();await page.waitForTimeout(350);
  const handoff=randomUUID(),now=Date.now(),fixture=structuredClone(accepted),task=board.tasks[0].id;
  const deliveryRun=randomUUID();
  fixture.runs.push({id:deliveryRun,task,role:'alm',state:'completed',depth:0,requestedAt:now});
  fixture.events.push({id:handoff,task,from:'developer',at:now,source:'codex',data:{kind:'handoff',to:'tester',act:true,text:'Entrega de prueba',artifact:{version:'2.4.0-rc.1',link:'dist/',next:'Validar'}}},
    {id:randomUUID(),task,from:'tester',at:now+1,source:'codex',data:{kind:'qa',replyTo:handoff,passed:true,text:'Prueba completada',evidence:'Tablero de prueba'}},
    {id:deliveryRun,task,from:'alm',at:now+2,source:'codex',data:{kind:'progress',text:'Candidato preparado para la revisión.'}});
  update(fixture);
  await panel('alm').getByText('2.4.0-rc.1',{exact:true}).waitFor();
  await panel('alm').getByText('QA aprobado',{exact:true}).waitFor();
  await stage.locator('.graphite-screen[data-value="2.4.0-rc.1"]').first().waitFor();
  const progress={type:'contribute',project:board.id,task,role:'alm',nonce:randomUUID(),
    data:{kind:'progress',text:'Verificada la entrega en el entorno de prueba.'}};
  const submitted=await page.evaluate(action=>window.companion.officina(action),progress);
  assert.equal(submitted.ok,true,submitted.error);
  await panel('alm').getByText(progress.data.text,{exact:true}).waitFor();
  assert.ok(load().events.some(e=>e.id===progress.nonce && e.source==='user'));
  await page.screenshot({path:join(output,'alm.png')});await page.waitForTimeout(950);
  await back('alm');await button('Restablecer encuadre').click();await checkStatuses();await page.waitForTimeout(450);if(stop) await stop();
  assert.deepEqual(load().runs,fixture.runs);
  const notice={...progress,nonce:randomUUID(),data:{kind:'handoff',to:'developer',act:false,text:'Se puede consultar la entrega.',
    artifact:{version:'2.4.0-rc.1',link:'dist/',next:'Consulta'}}};
  assert.equal((await page.evaluate(action=>window.companion.officina(action),notice)).ok,true);
  await stage.locator('.graphite-pulse').waitFor();await stage.locator('.graphite-pulse').waitFor({state:'detached'});
  await clickPerson('alm');await back('alm');assert.equal(await stage.locator('.graphite-pulse').count(),0);
  assert.deepEqual(load().runs,fixture.runs);
  await writeFile(join(output,'comprobaciones.json'),JSON.stringify({roomsFromPlan:7,roomsFromTeam:7,
    zoomAndPan:true,fullscreen:true,synchronizedLabels:7,workingColorMatchesTeam:true,animatedRoles:7, reducedMotion:true, viewportAndScale:[[948,977,1],[1280,700,1],[948,977,1.25],[640,850,1.5]],duplicateContinuations:0,
    projectSwitch:true,liveBoardRead:true,nativeContribution:true,syntheticData:true,modelCalled:false},null,2));
}
