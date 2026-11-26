import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {checkDesigns,chooseOffice} from './officina-designs-smoke.mjs';
import {checkGraphite} from './officina-graphite-smoke.mjs';

const profile = randomUUID();
const root = join(tmpdir(), 'zen-companion-smoke-' + profile);
const output = resolve('release/grafito-zoom');
const variants=process.argv.includes('--designs');
const captureVideo = process.argv.includes('--video');
const executablePath = process.argv.slice(2).find(argument => !argument.startsWith('--'));
const codexFixture = join(root, 'codex-fixture');
await mkdir(codexFixture, {recursive:true});
const index = new DatabaseSync(join(codexFixture, 'state_5.sqlite'));
index.exec('CREATE TABLE threads(id TEXT,rollout_path TEXT,cwd TEXT,agent_path TEXT,archived INTEGER,project_id TEXT); CREATE TABLE projects(id TEXT); CREATE TABLE project_roots(project_id TEXT,path TEXT);');
index.close();
const db = new DatabaseSync(join(root, 'officina.sqlite'));
db.exec('PRAGMA busy_timeout = 3000');
db.exec('CREATE TABLE officina_projects(id TEXT PRIMARY KEY,name TEXT,body TEXT); CREATE TABLE officina_selection(slot INTEGER PRIMARY KEY,project TEXT);');
const project = randomUUID(), task = randomUUID(), run = randomUUID();
const question = '¿Apruebas el modelo de proyectos y tareas?';
const proposal = '## Modelo propuesto\n\n```mermaid\nerDiagram\n  CLIENTE ||--o{ PROYECTO : solicita\n  PROYECTO ||--o{ TAREA : agrupa\n```';
const request = {kind:'request', mode:'approval', run, text:question, markdown:proposal,
  impact:'Desarrollo implementará el modelo de datos en el entorno de prueba.'};
const board = {
  id:project, name:'Proyecto de prueba', queueEnabled:false,
  tasks:[{id:task, title:'Diseñar el modelo de proyectos y tareas', objective:'Proponer un modelo de datos',
    criteria:'Cada proyecto reúne sus tareas y pertenece a un cliente.', owner:'architect', status:'active'}],
  runs:[{id:run, task, role:'architect', state:'completed', step:0, depth:0, requestedAt:Date.now()}],
  events:[], goals:[{task, request:question, steps:[{role:'architect', instruction:'Prepara la propuesta.'},
    {role:'developer', instruction:'Implementa el modelo aprobado.'}, {role:'tester', instruction:'Revisa la entrega.'}],
    cursor:0, round:1, phase:'work', humanRequest:request,
    history:[{from:'codex', text:question, markdown:proposal, reply:{run, kind:'request', role:'architect'}}]}],
};
db.prepare('INSERT INTO officina_selection VALUES (1,?)').run(project);
const update = value => db.prepare('INSERT OR REPLACE INTO officina_projects VALUES (?,?,?)').run(project, value.name, JSON.stringify(value));
const load = () => JSON.parse(db.prepare('SELECT body FROM officina_projects WHERE id=?').get(project).body);
update(board);
const env = {...process.env};
delete env.ELECTRON_RUN_AS_NODE;
delete env.OPENAI_API_KEY;

async function start(disable3D=false) {
  const app = await electron.launch({args:[...(executablePath ? [] : ['.']), '--zen-hover-smoke',
    '--zen-officina-profile='+profile, ...(disable3D ? ['--disable-3d-apis'] : [])],
    executablePath, env, timeout:30000,
  });
  const page = await app.firstWindow();
  if(disable3D) await page.evaluate(()=>{
    window.graphiteWebglAttempts=0;
    const context=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      if(type.includes('webgl')) {window.graphiteWebglAttempts++;return null;}
      return context.call(this,type,...args);
    };
  });
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => console.error('Renderer:', error));
  page.on('console', msg => {if (msg.type() === 'error') console.error('Renderer:', msg.text());});
  await app.evaluate(({BrowserWindow}) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.show();
    window.focus();
    window.webContents.setBackgroundThrottling(false);
  });
  assert.equal((await page.evaluate(() => window.companion.pinWindow(true))).ok,true);
  const trigger = page.locator('.capsule-launcher [data-page=officina]');
  // Open from the normal launcher without automatically following the decision badge.
  if (await page.locator('.companion-capsule.collapsed').isVisible()) {
    assert.equal((await page.evaluate(() => window.companion.togglePanel())).ok,true);
  }
  await trigger.click();
  const office = page.getByRole('region',{name:'Officina',exact:true});
  await office.waitFor();
  const stage = office.locator('.graphite-stage[data-ready=true]');
  await stage.waitFor();
  const back = office.getByRole('button',{name:'Volver a Officina'});
  if (await back.isVisible()) await back.click();
  await office.locator('.graphite-stage[data-camera=overview]').waitFor();
  return {app,page,office,stage};
}

async function size(app, page, width, height) {
  await app.evaluate(({BrowserWindow}, area) => BrowserWindow.getAllWindows()[0].setSize(...area), [width,height]);
  await page.waitForFunction(([width,height]) => innerWidth === width && innerHeight === height, [width,height]);
}
async function startClip(page, directory = output) {
  const path = join(directory,'recorrido-officina.webm');
  const size={width:948,height:978};
  await page.screencast.start({path,size});
  return async () => {
    await page.screencast.stop();
    return path;
  };
}
const {app,page,office,stage} = await start();
try {
  await size(app,page,948,977);
  assert.equal(await stage.getAttribute('data-design'),'graphite');
  await office.locator('.officina-team-select[data-role=architect]').getByText('! Aprobar',{exact:true}).waitFor();
  if(variants) await checkDesigns({page,office,load,resize:size,app});
  await checkGraphite({app,page,office,resize:size,load,update,db,board,startClip:captureVideo && startClip});
  if(variants) await chooseOffice(page,'nexus');
 } catch(error) {
  await mkdir(output,{recursive:true});
  await page.screenshot({path:join(output,'diagnostico.png')});
  console.error('Vista al fallar:',await page.locator('.graphite-stage:visible, .preferences-content:visible').evaluateAll(els=>els.map(el=>el.className)));
  throw error;
} finally {await app.close();db.close();}

const restarted = await start(true);
try {
  assert.equal(await restarted.stage.getAttribute('data-design'),variants?'nexus':'graphite');
  await restarted.office.locator('.officina-team-select[data-role=alm]').click();
  await restarted.office.locator('.graphite-stage[data-camera=alm]').waitFor();
  await restarted.office.locator('.officina-room-panel').getByText('2.4.0-rc.1',{exact:true}).waitFor();
  assert.equal(await restarted.page.evaluate(()=>window.graphiteWebglAttempts),0);
  console.log('Grafito verificado, siete despachos, reinicio y continuación única.');
} finally {await restarted.app.close();}
