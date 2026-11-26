import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir, writeFile, appendFile, rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';

const profile = randomUUID();
const root = join(tmpdir(), 'zen-companion-smoke-' + profile);
const home = join(root, 'codex-fixture'), sessions = join(home, 'sessions');
await mkdir(sessions, {recursive: true});
const project = randomUUID(), task = randomUUID(), developer = randomUUID(), tester = randomUUID();
const cwd = 'C:\\Fixture Officina';
const file = id => join(sessions, 'rollout-' + id + '.jsonl');
const indexPath = join(home, 'state_5.sqlite');
async function moveIndex(from, to) {
  for (let attempt = 0; ; attempt++) {
    try {await rename(from, to); return;}
    catch (error) {
      if (!['EBUSY','EPERM'].includes(error.code) || attempt === 15) throw error;
      await new Promise(resolve=>setTimeout(resolve, 125));
    }
  }
}
const index = new DatabaseSync(indexPath);
index.exec('CREATE TABLE threads(id TEXT,rollout_path TEXT,cwd TEXT,agent_path TEXT,archived INTEGER,project_id TEXT); CREATE TABLE projects(id TEXT); CREATE TABLE project_roots(project_id TEXT,path TEXT);');
index.prepare('INSERT INTO projects VALUES (?)').run(project);
index.prepare('INSERT INTO project_roots VALUES (?,?)').run(project,cwd);
const log = (type,payload) => JSON.stringify({type,payload,timestamp:new Date().toISOString()})+'\n';
for (const id of [developer,tester]) {
  index.prepare('INSERT INTO threads VALUES (?,?,?,NULL,0,?)').run(id,file(id),cwd,project);
  await writeFile(file(id),log('session_meta',{id,cwd,source:'vscode'}));
}
index.close();
const db = new DatabaseSync(join(root,'officina.sqlite'));
db.exec('PRAGMA busy_timeout = 3000');
db.exec('CREATE TABLE officina_projects(id TEXT PRIMARY KEY,name TEXT,body TEXT); CREATE TABLE officina_selection(slot INTEGER PRIMARY KEY,project TEXT);');
db.prepare('INSERT INTO officina_selection VALUES (1,?)').run(project);
const question = 'Elige el alcance de prueba.';
const board = {id:project,name:'Equipo sintético',tasks:[{id:task,title:'Destino de la decisión',objective:'Probar el indicador',criteria:'Una decisión',owner:'architect',status:'active'}],
  runs:[],events:[],team:{projectId:project,cwd,threads:{developer,tester}}};
function save(withQuestion = false) {
  db.prepare('INSERT OR REPLACE INTO officina_projects VALUES (?,?,?)').run(project,board.name,JSON.stringify({...board,
    goals:withQuestion?[{task,request:'Prueba',steps:[],cursor:0,round:0,phase:'plan',question,
      history:[{from:'codex',text:question,reply:{run:randomUUID(),kind:'question'}}]}]:[]}));
}
save();
function start(id,turn) {
  const item = {type:'UserMessage',content:[{type:'text',text:'Prueba de actividad'}]};
  return appendFile(file(id),log('turn_context',{turn_id:turn,cwd})+
    log('event_msg',{type:'item_completed',thread_id:id,turn_id:turn,item}));
}
function stop(id,turn,success) {
  const text='Trabajo sintético completado';
  const answer=success?log('response_item',{type:'message',role:'assistant',phase:'final_answer',status:'completed',
    content:[{type:'output_text',text}]}):'';
  return appendFile(file(id),answer+log('event_msg',{type:success?'task_complete':'turn_aborted',turn_id:turn,
    ...(success?{last_agent_message:text}:{})}));
}
const env = {...process.env};
delete env.ELECTRON_RUN_AS_NODE;
delete env.OPENAI_API_KEY;
const executablePath=process.argv[2];
const app = await electron.launch({args:['--disable-3d-apis',...(executablePath?[]:['.']),'--zen-hover-smoke','--zen-officina-profile='+profile],executablePath,env});
try {
  const page=await app.firstWindow();
  await page.evaluate(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...options) {
      return type.startsWith('webgl') ? null : getContext.call(this, type, ...options);
    };
  });
  page.setDefaultTimeout(20000);
  const button=page.locator('.capsule-launcher [data-page=officina]');
  const badge=button.locator('.officina-glance-badge');
  const queueBadge=button.locator('.officina-queue-badge');
  const show=label=>page.waitForFunction(value=>document.querySelector('.officina-glance-badge')?.firstChild?.textContent===value,label);
  const collapsed=()=>page.locator('.companion-capsule.collapsed').waitFor();
  const checkTaskLabel=async (title, shortened=false)=>{
    if(await page.locator('.officina-room-panel').isVisible()) {
      const selection=page.getByRole('combobox',{name:'Encargo de Officina'});
      assert.equal(await selection.locator('option:checked').textContent(),title);
      return;
    }
    const label=page.locator('.graphite-label[data-agent=coordinator] small');
    await label.filter({hasText:title}).waitFor();
    if(shortened) assert.equal(await label.evaluate(node=>node.scrollWidth>node.clientWidth),true);
    const fit=await label.evaluate(node=>{
      const task=node.getBoundingClientRect(),role=node.parentElement.querySelector('strong').getBoundingClientRect();
      const scene=node.closest('.graphite-stage').getBoundingClientRect();
      return task.left>=scene.left && task.right<=scene.right && task.top>=scene.top && task.bottom<=role.top+1;
    });
    assert.equal(fit,true);
  };
  await collapsed();
  await button.waitFor();
  await start(developer,'d1');
  await show('1');
  const original = await button.boundingBox();
  await start(tester,'t1');
  await show('2');
  await collapsed();
  const second = await button.boundingBox();
  assert.deepEqual([second.width,second.height],[original.width,original.height]);
  for(const side of ['top','left']) {
    assert.equal((await page.evaluate(side=>window.companion.capsuleLocation(side),side)).ok,true);
    const fits=await badge.evaluate(node=>{
      const a=node.getBoundingClientRect(),b=node.parentElement.getBoundingClientRect();
      return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;
    });
    assert.equal(fits,true);
  }
  await button.click();
  await page.getByText('Actividad actual',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Desarrollador · Equipo sintético/}).click();
  await page.locator('.officina-team-select[data-role=developer][aria-pressed=true]').waitFor();
  await checkTaskLabel('Destino de la decisión');
  assert.equal((await page.evaluate(()=>window.companion.island(true))).ok,true);
  await collapsed();
  save(true);
  await show('!');
  await button.click();
  await page.getByRole('region',{name:'Solicitudes del puesto'}).getByText(question,{exact:true}).waitFor();
  assert.equal((await page.evaluate(()=>window.companion.island(true))).ok,true);
  await collapsed();
  save();
  await show('2');
  await stop(developer,'d1',true);
  await show('1');
  await stop(tester,'t1',true);
  await show('✓');
  await badge.waitFor({state:'detached'});
  await start(tester,'t2');
  await show('1');
  await stop(tester,'t2',false);
  await badge.waitFor({state:'detached'});
  await moveIndex(indexPath,indexPath+'.offline');
  await show('?');
  await moveIndex(indexPath+'.offline',indexPath);
  await badge.waitFor({state:'detached'});
  await collapsed();
  assert.deepEqual(JSON.parse(db.prepare('SELECT body FROM officina_projects').get().body).runs,[]);

  const requestRun = randomUUID(), queuedTask = randomUUID(), queuedRun = randomUUID();
  const request = {kind:'request',mode:'approval',run:requestRun,text:'Aprueba el diseño sintético.',markdown:'## Diseño de prueba'};
  db.prepare('UPDATE officina_projects SET body=? WHERE id=?').run(JSON.stringify({...board,queueEnabled:false,
    tasks:[...board.tasks,{...board.tasks[0],id:queuedTask,title:'Siguiente encargo en cola'}],
    runs:[{id:requestRun,task,role:'architect',state:'completed',step:0,depth:0},
      {id:queuedRun,task:queuedTask,role:'developer',state:'waiting',depth:0}],
    goals:[{task,request:'Prueba',steps:[{role:'architect',instruction:'Prepara el diseño.'},
      {role:'developer',instruction:'Aplica el diseño.'}],cursor:0,round:1,phase:'work',humanRequest:request,
      history:[{from:'codex',text:request.text,reply:{run:requestRun,kind:'request',role:'architect'}}]}]}),project);
  await show('!');
  await queueBadge.filter({hasText:'1'}).waitFor();
  assert.match(await button.getAttribute('aria-label'), /decisión pendiente, 1 turno en cola/);
  assert.equal(await queueBadge.locator('i').first().evaluate(node=>getComputedStyle(node).animationName),'officina-queue-wave');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.officina-queue-badge i')).animationName==='none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await button.click();
  const form = page.getByRole('form',{name:'Decisión de Officina'});
  const detail = page.getByRole('region',{name:'Solicitudes del puesto'});
  await detail.getByText(request.text,{exact:true}).waitFor();
  await page.getByRole('button',{name:'Volver a Officina'}).click();
  await page.locator('.officina-team-select[data-role=architect]').getByText('! Aprobar',{exact:true}).waitFor();
  await page.locator('.graphite-label[data-agent=architect]').getByText('Aprobar',{exact:true}).waitFor();
  await page.locator('.graphite-room[data-role=architect]').press('Enter');
  await detail.getByText(request.text,{exact:true}).waitFor();
  await form.getByText('Ver propuesta y evidencia',{exact:true}).click();
  await form.getByRole('heading',{name:'Diseño de prueba'}).waitFor();
  await form.getByRole('button',{name:'Aprobar y continuar'}).evaluate(button => {
    button.click();
    button.click();
  });
  await form.waitFor({state:'detached'});
  await page.getByRole('button',{name:'Equipo',exact:true}).click();
  if(await page.getByRole('button',{name:'Volver a Officina'}).isVisible()) await page.getByRole('button',{name:'Volver a Officina'}).click();
  const queue = page.locator('details.officina-queue-list').filter({hasText:'Cola de Officina'});
  await queue.locator('summary').click();
  await queue.getByRole('button',{name:/Siguiente encargo en cola/}).waitFor();
  await queue.getByRole('button',{name:/Destino de la decisión/}).waitFor();
  const saved = JSON.parse(db.prepare('SELECT body FROM officina_projects').get().body);
  assert.equal(saved.goals[0].humanRequest,undefined);
  assert.deepEqual(saved.runs.map(run=>[run.role,run.state]),
    [['architect','completed'],['developer','waiting'],['developer','waiting']]);
  assert.equal(saved.queueEnabled,false);
  assert.equal(saved.goals[0].history.filter(message => message.text.startsWith('Aprobado ·')).length,1);
  await page.getByRole('button',{name:'Chat global',exact:true}).click();
  await page.getByText('Aprobado · '+request.text,{exact:true}).last().waitFor();
  const pending = [
    {mode:'review', text:'¿Qué ajustes necesita el diseño?', title:'Revisión de diseño'},
    {mode:'question', text:'¿Qué alcance debe usarse?', title:'Alcance de diseño y criterios de aceptación para la revisión de la entrega de prueba del equipo'},
    {mode:'approval', text:'Aprueba el despliegue sintético.', title:'Despliegue de prueba', priority:'blocking', sensitive:true},
  ].map(item => ({...item, task:randomUUID(), run:randomUUID()}));
  const multiple = {...saved,
    tasks:[...saved.tasks,...pending.map(item => ({...board.tasks[0],id:item.task,title:item.title}))],
    runs:[...saved.runs,...pending.map(item => ({id:item.run,task:item.task,role:'architect',state:'completed',step:0,depth:0}))],
    goals:[...saved.goals,...pending.map(item => ({
      task:item.task,request:item.title,steps:saved.goals[0].steps,cursor:0,round:1,phase:'work',
      humanRequest:{kind:'request',mode:item.mode,run:item.run,text:item.text,priority:item.priority,sensitive:item.sensitive},
      history:[{from:'codex',text:item.text,reply:{run:item.run,kind:'request',role:'architect'}}],
    }))],
  };
  db.prepare('UPDATE officina_projects SET body=? WHERE id=?').run(JSON.stringify(multiple),project);
  assert.equal((await page.evaluate(()=>window.companion.island(true))).ok,true);
  await collapsed();
  await page.waitForFunction(()=>document.querySelector('.officina-glance-badge')?.textContent==='!3');
  await button.click();
  const row = page.locator('.officina-team-select[data-role=architect]');
  const center = page.getByRole('dialog',{name:'Centro de decisiones'});
  const rows = center.locator('li');
  await rows.first().getByText('Bloqueante',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.activeElement?.matches('.officina-decision-list li:first-child button'));
  await rows.filter({hasText:'Despliegue de prueba'}).getByRole('button',{name:'Abrir agente'}).click();
  await moveIndex(indexPath,indexPath+'.offline');
  await form.getByText('Vuelve a conectar con Codex para responder.').waitFor();
  assert.match(await page.getByText(/Última sincronización/).allTextContents().then(text=>text.join(' ')),/Última sincronización/);
  assert.equal(await form.getByRole('button',{name:'Aprobar y continuar'}).isDisabled(),true);
  await moveIndex(indexPath+'.offline',indexPath);
  await form.getByText('Vuelve a conectar con Codex para responder.').waitFor({state:'detached'});
  await form.getByRole('button',{name:'Aprobar y continuar'}).click();
  await form.getByRole('button',{name:'Confirmar alcance y continuar'}).waitFor();
  await form.getByRole('button',{name:'Volver',exact:true}).click();
  await form.getByRole('button',{name:'Rechazar',exact:true}).click();
  await form.getByLabel('Motivo (opcional)').fill('Fuera del alcance de prueba.');
  await form.getByRole('button',{name:'Confirmar rechazo'}).click();
  const inbox=page.getByRole('button',{name:/^Decisiones \(/});
  await inbox.filter({hasText:'(2)'}).click();
  await rows.filter({hasText:'Revisión de diseño'}).getByRole('button',{name:'Abrir agente'}).click();
  await page.locator('.officina-room-panel[data-room=architect]').waitFor();
  await checkTaskLabel('Revisión de diseño');
  assert.equal(await page.getByRole('combobox',{name:'Encargo de Officina'}).inputValue(),pending[0].task);
  assert.equal(await detail.getByText(pending[1].text,{exact:true}).count(),0);
  await form.getByRole('button',{name:'Pedir cambios',exact:true}).click();
  await form.getByLabel('Indica qué quieres cambiar').fill('Simplifica la propuesta.');
  await form.getByLabel('Indica qué quieres cambiar').press('Escape');
  await form.waitFor({state:'detached'});
  await row.click();
  assert.equal(await form.getByLabel('Indica qué quieres cambiar').inputValue(),'Simplifica la propuesta.');
  await form.getByRole('button',{name:'Enviar cambios'}).click();
  await inbox.filter({hasText:'(1)'}).click();
  await rows.filter({hasText:'Alcance de diseño'}).getByRole('button',{name:'Abrir agente'}).click();
  await form.getByText(pending[1].text,{exact:true}).waitFor();
  await checkTaskLabel(pending[1].title,true);
  await form.getByLabel('Tu respuesta').fill('Limita el alcance a Equipo.');
  await form.getByRole('button',{name:'Enviar respuesta'}).click();
  await detail.waitFor({state:'detached'});
  const answered = JSON.parse(db.prepare('SELECT body FROM officina_projects').get().body);
  for (const [index, action] of ['request-changes','respond'].entries()) {
    const item = pending[index];
    const runs = answered.runs.filter(run => run.task === item.task);
    assert.equal(runs.length,2);
    assert.equal(runs[0].humanAnswer.action,action);
    assert.equal(runs[1].role,'architect');
    assert.equal(runs[1].step,0);
  }
  assert.equal(answered.runs.find(run=>run.id===pending[2].run).humanAnswer.action,'reject');
  assert.equal(answered.runs.filter(run=>run.task===pending[2].task).length,1);
  await inbox.filter({hasText:'(0)'}).click();
  await center.getByLabel('Estado').selectOption('resolved');
  await center.getByText('Rechazada',{exact:true}).waitFor();
  await center.getByText('Continuación en cola',{exact:true}).first().waitFor();
  await center.getByLabel('Proyecto').selectOption(project);
  const evidence = resolve('release','officina-decisions');
  await mkdir(evidence,{recursive:true});
  for (const [width,height] of [[948,977],[1280,700]]) {
    await app.evaluate(({BrowserWindow},[width,height])=>BrowserWindow.getAllWindows()[0].setSize(width,height),[width,height]);
    await page.waitForFunction(([width,height])=>innerWidth===width&&innerHeight===height,[width,height]);
    assert.equal(await center.evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);
    await page.screenshot({path:join(evidence,`decisiones-${width}x${height}.png`)});
  }
  await page.keyboard.press('Escape');
  const otherProject=randomUUID(), otherTask=randomUUID(), otherRun=randomUUID();
  const foreignRequest={kind:'request',mode:'question',text:'¿Qué revisar en el segundo proyecto?',run:otherRun};
  const foreignBoard={id:otherProject,name:'Proyecto sintético secundario',queueEnabled:false,events:[],
    tasks:[{...board.tasks[0],id:otherTask,title:'Encargo secundario'}],
    runs:[{id:otherRun,task:otherTask,role:'architect',state:'completed',step:0,depth:0}],
    goals:[{task:otherTask,request:foreignRequest.text,steps:saved.goals[0].steps,cursor:0,round:1,
      phase:'work',humanRequest:foreignRequest,history:[{from:'codex',text:foreignRequest.text,
        reply:{run:otherRun,kind:'request',role:'architect'}}]}]};
  db.prepare('INSERT INTO officina_projects VALUES (?,?,?)').run(otherProject,foreignBoard.name,JSON.stringify(foreignBoard));
  await inbox.filter({hasText:'(1)'}).click();
  await center.getByLabel('Proyecto').selectOption(otherProject);
  await center.getByText('Encargo secundario',{exact:false}).waitFor();
  await rows.getByRole('button',{name:'Abrir agente'}).click();
  await form.getByText(foreignRequest.text,{exact:true}).waitFor();
  assert.equal(await page.getByRole('combobox',{name:'Proyecto de Officina'}).inputValue(),otherProject);
  assert.equal(await page.getByRole('combobox',{name:'Encargo de Officina'}).inputValue(),otherTask);
  console.log(JSON.stringify({officinaGlance:true,synthetic:true,noDispatch:true,humanDecision:true,multipleRequests:true,queue:true,decisionCenter:true}));
} finally { db.close(); await app.close(); }
