import {strict as assert} from 'node:assert';
import {randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';

const profile = randomUUID();
const executablePath = process.argv[2] && resolve(process.argv[2]);
const args = [...(executablePath ? [] : ['.']), '--zen-hover-smoke', `--zen-officina-profile=${profile}`];
const rule = 'Nadie puede aprobar su propio gasto.';
const version = '1.0.4';
const evidence = resolve('release', 'officina');
await mkdir(evidence, {recursive: true});
const env = {...process.env};
let profileDirectory;
delete env.ELECTRON_RUN_AS_NODE;
delete env.OPENAI_API_KEY;

async function withZen(run) {
  const app = await electron.launch({args, executablePath, env, timeout: 30000});
  try {
    profileDirectory ??= await app.evaluate(({app}) => app.getPath('userData'));
    const page = await app.firstWindow();
    await page.locator('.capsule-launcher [data-page=officina]:enabled').waitFor();
    await app.evaluate(({BrowserWindow}) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.show();
      window.focus();
      window.webContents.setBackgroundThrottling(false);
    });
    const lock = await page.evaluate(() => window.companion.pinWindow(true));
    assert.equal(lock.ok, true, lock.error);
    await run(page, app);
  } finally {
    await app.close();
  }
}

async function enter(page) {
  const button = page.locator('.capsule-launcher [data-page=officina]');
  await button.click();
  await page.locator('.officina h1').waitFor();
}

async function createProject(page, name) {
  await page.getByRole('combobox', {name: 'Proyecto de Officina'}).selectOption('new');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre del proyecto').fill(name);
  await dialog.getByRole('button', {name: 'Crear proyecto', exact: true}).click();
  await dialog.waitFor({state: 'hidden'});
}

async function createTask(page) {
  await page.getByRole('button', {name: 'Nueva tarea', exact: true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Título').fill('Permisos de aprobación');
  await dialog.getByLabel('Objetivo').fill('Verificar la segregación de funciones de los responsables.');
  await dialog.getByLabel('Criterios de aceptación').fill(rule);
  await dialog.getByLabel('Responsable').selectOption('developer');
  await dialog.getByRole('button', {name: 'Crear tarea', exact: true}).click();
  await dialog.waitFor({state: 'hidden'});
}

async function taskFromBoard(page) {
  await page.locator('.officina-table').press('Enter');
  await page.getByRole('button', {name: 'Tablero del proyecto', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: /Permisos de aprobación/}).click();
  await page.getByRole('heading', {name: 'Permisos de aprobación'}).waitFor();
}

async function record(page, kind, values) {
  const dialog = page.getByRole('dialog');
  const summary = dialog.getByText('Registrar actividad', {exact: true});
  if (!await summary.evaluate(node => node.parentElement.open)) await summary.click();
  await dialog.getByLabel('Tipo de registro').selectOption(kind);
  for (const [name, value] of Object.entries(values)) {
    const control = dialog.locator(`[name="${name}"]`);
    if (await control.evaluate(node => node.tagName === 'SELECT')) await control.selectOption(value);
    else await control.fill(value);
  }
  await dialog.getByRole('button', {name: 'Registrar', exact: true}).click();
  await dialog.getByRole('heading', {name: 'Historial de la tarea'}).waitFor();
  await page.waitForFunction(() => document.querySelector('dialog select') !== null &&
    [...document.querySelectorAll('dialog select')].some(select => select.value === 'progress'));
}

await withZen(async (page, app) => {
  await enter(page);
  assert.equal(await page.locator('.capsule-launcher [data-page=officina]').count(), 1);
  const position = await page.evaluate(() => window.companion.capsuleLocation('top'));
  assert.equal(position.ok, true);
  await page.evaluate(() => window.companion.navigate('options'));
  const half = await page.evaluate(() => window.companion.workspaceLayout('left'));
  assert.equal(half.ok, true);
  const normal = await app.evaluate(({BrowserWindow, screen}) => {
    const bounds = BrowserWindow.getAllWindows()[0].getBounds();
    return {bounds, area: screen.getDisplayMatching(bounds).workArea};
  });
  assert.equal(normal.bounds.width, Math.round(normal.area.width / 2));
  const normalPanel = await page.evaluate(async () => (await window.companion.status()).value.workspace.geometry.panel);
  await enter(page);
  const frame = await page.evaluate(async () => (await window.companion.status()).value.workspace.geometry);
  assert.deepEqual(frame.panel, normalPanel);
  assert.deepEqual(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].getBounds()), normal.bounds);
  await createProject(page, 'Aprobación de gastos');
  const idleSeats = page.locator('.officina-idle-seat');
  const analystIdle = page.locator('.officina-idle-seat[data-role=analyst]');
  const screens = page.locator('.officina-screen');
  const reflections = page.locator('.officina-screen-reflection');
  await screens.first().waitFor();
  assert.equal(await reflections.count(), 6);
  await page.waitForFunction(() => [...document.querySelectorAll('.officina-screen, .officina-screen-reflection')]
    .every(display => display.getAnimations({subtree: true}).some(animation => animation.playbackRate > 0 && animation.playbackRate < 1)));
  assert.equal(await page.locator('.officina-round').count(), 0);
  assert.deepEqual(await idleSeats.evaluateAll(seats => seats.map(seat => seat.dataset.action)),
    ['phone', 'pen', 'coffee', 'stretch', 'notebook']);
  assert.equal(await idleSeats.evaluateAll(seats => new Set(seats.map(seat =>
    getComputedStyle(seat.firstElementChild).animationDuration)).size), 5);
  assert.deepEqual(await screens.evaluateAll(displays => displays.map(display => [display.dataset.role,
    display.getAnimations({subtree: true}).some(animation => animation.playState === 'running' &&
      animation.effect.getTiming().iterations === Infinity)])),
  [['analyst', true], ['architect', true], ['developer', true], ['developer', true], ['tester', true], ['alm', true], ['observer', true]]);
  const discontinuities = await page.locator('.officina-screens').evaluate(layer => {
    const failures = [];
    for (const animation of layer.getAnimations({subtree: true})) {
      const {effect, currentTime} = animation;
      const {target, pseudoElement} = effect;
      const {duration, delay} = effect.getTiming();
      const sample = phase => {
        animation.currentTime = delay + duration * phase;
        const {opacity, left, top, translate, scale, transform} = getComputedStyle(target, pseudoElement);
        return {opacity: Number(opacity), position: [left, top, translate, scale, transform], transform};
      };
      const before = sample(1.9999);
      const after = sample(2.0001);
      animation.currentTime = currentTime;
      if (before.opacity < .001 && after.opacity < .001) continue;
      if (target.classList.contains('officina-code-reel')) {
        const pageHeight = Number.parseFloat(getComputedStyle(target.firstElementChild).height);
        const shift = new DOMMatrix(after.transform).m42 - new DOMMatrix(before.transform).m42;
        if (Math.abs(shift - pageHeight) > .05) failures.push(animation.animationName);
      } else if (Math.abs(before.opacity - after.opacity) > .01 ||
        before.position.some((value, index) => value !== after.position[index])) {
        failures.push(animation.animationName);
      }
    }
    return failures;
  });
  assert.deepEqual(discontinuities, [], 'Los ciclos de pantalla deben enlazar sus fotogramas');
  await page.locator('.officina-scene').evaluate(async scene => {
    await scene.querySelector('.officina-photo').decode();
    await scene.querySelector('.officina-observer-furniture').decode();
    const poses = [...scene.querySelectorAll('.officina-idle-frame')];
    const sources = new Set(poses.map(pose => getComputedStyle(pose).backgroundImage.slice(5, -2)));
    await Promise.all([...sources].map(async source => {
      const poseImage = new Image();
      poseImage.src = source;
      await poseImage.decode();
    }));
    for (const animation of scene.querySelector('.officina-idle-scene').getAnimations({subtree: true})) {
      const {duration, delay} = animation.effect.getTiming();
      animation.pause();
      animation.currentTime = (duration * 1.22 + delay) % duration;
    }
  });
  await page.locator('.officina-scene').screenshot({path: resolve(evidence, 'officina-pantallas.png')});
  await page.locator('.officina-idle-scene').evaluate(scene => scene.getAnimations({subtree: true}).forEach(animation => animation.play()));
  await page.locator('.officina-desk[data-role=analyst]').click();
  await page.getByRole('button', {name: 'Ficha del puesto'}).click();
  await page.getByRole('dialog').getByText('Mira el móvil cuando está libre.', {exact: false}).waitFor();
  await page.getByRole('dialog').getByRole('button', {name: 'Cerrar ficha'}).click();
  await createTask(page);
  await page.locator('.officina-idle-seat[data-role=developer]').waitFor({state: 'detached'});
  await analystIdle.waitFor();
  await taskFromBoard(page);
  await record(page, 'decision', {from: 'architect', text: rule});
  await record(page, 'handoff', {from: 'developer', to: 'tester', text: 'Flujo preparado',
    version, link: 'dist/gastos.zip', next: 'Verificar permisos'});
  const receipt = page.locator('.officina-test-screen .officina-screen-arrival');
  await receipt.waitFor({state: 'attached'});
  assert.equal(await page.locator('.officina-screen-arrival').count(), 1);
  const arrival = await receipt.evaluate(async element => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const motion = document.querySelector('.officina-pulse animateMotion');
    const elapsed = motion.getCurrentTime() - motion.getStartTime();
    const animation = element.getAnimations()[0];
    const {currentTime} = animation;
    const {delay, duration} = animation.effect.getTiming();
    const sample = time => {
      animation.currentTime = time;
      return Number(getComputedStyle(element).opacity);
    };
    const result = [sample(delay - 1), sample(delay + duration / 2), sample(delay + duration + 1)];
    animation.currentTime = currentTime;
    return {opacity: result, synchronized: motion.getAttribute('dur') === `${delay}ms` &&
      elapsed >= 0 && Math.abs(elapsed * 1000 - currentTime) < 100};
  });
  assert.equal(arrival.synchronized, true);
  assert.deepEqual(arrival.opacity, [0, .85, 0]);
  let dialog = page.getByRole('dialog');
  const versionOption = await dialog.locator('.officina-event').filter({hasText: 'dist/gastos.zip'}).getAttribute('class');
  assert.equal(versionOption, 'officina-event');
  const replyTo = await page.evaluate(async () => {
    const result = await window.companion.officina({type: 'read'});
    return result.value.project.events.find(event => event.data.kind === 'handoff').id;
  });
  await record(page, 'qa', {replyTo, result: 'fail',
    text: 'El solicitante todavía puede aprobar.', evidence: 'QA-18'});
  await dialog.getByText('QA bloqueó 1.0.4', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await page.locator('.officina-desk[data-role=alm]').click();
  await page.getByRole('button', {name: 'Ficha del puesto'}).click();
  dialog = page.getByRole('dialog');
  await dialog.getByText('QA bloqueó 1.0.4', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await page.getByRole('button', {name: 'Ver traspaso en conexión de Tester'}).click();
  await dialog.getByText('Flujo preparado', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await page.locator('.officina-photo').evaluate(async image => { await image.decode(); });
  assert.equal(await page.locator('.officina-desk[aria-pressed=false]').first().evaluate(button => getComputedStyle(button).backgroundColor), 'rgba(0, 0, 0, 0)');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.locator('.officina-gestures').waitFor({state: 'detached'});
  await page.locator('.officina-idle-scene').waitFor({state: 'detached'});
  await receipt.waitFor({state: 'detached'});
  await screens.first().waitFor();
  await page.waitForFunction(() => {
    const animations = document.querySelector('.officina-screens')?.getAnimations({subtree: true});
    return animations?.every(animation => animation.playState === 'paused');
  });
  await page.locator('.officina').screenshot({path: resolve(evidence, 'officina-aprobacion-de-gastos.png')});
  await app.evaluate(({BrowserWindow}) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.setSize(570, window.getBounds().height);
  });
  await page.waitForFunction(() => {
    const layout = document.querySelector('.officina-layout');
    return layout && getComputedStyle(layout).gridTemplateColumns.split(' ').length === 1;
  });
  const composer = page.getByPlaceholder('Describe lo que quieres', {exact: true});
  await composer.waitFor();
  assert.equal(await composer.evaluate(node => node.getBoundingClientRect().bottom <= innerHeight), true);
  await createProject(page, 'Inventario');
  assert.equal(await page.locator('.officina-desk-activity').getByText('Último traspaso', {exact: false}).count(), 0);
  const options = page.getByRole('combobox', {name: 'Proyecto de Officina'});
  await options.selectOption({label: 'Aprobación de gastos'});
  await page.getByRole('button', {name: 'Ver tarea', exact: true}).waitFor();
  await createProject(page, 'Coordinación de prueba');
  await composer.fill('Define la regla de aprobación de un gasto ficticio.');
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  assert.equal(await composer.inputValue(), 'Define la regla de aprobación de un gasto ficticio.');
  await page.getByRole('button', {name: 'Enviar a Coordinación'}).click();
  await page.getByText('6 chats vinculados', {exact: true}).waitFor();
  await page.locator('.officina-chat').getByText('Objetivo de prueba completado.', {exact: true}).waitFor();
  const formattedGoal = page.locator('.officina-goal').filter({hasText: 'Define la regla de aprobación'});
  assert.equal(await page.locator('.officina-scene').count(), 0);
  assert.equal(await formattedGoal.locator('.officina-response').count(), 0);
  const authorOrder = await formattedGoal.locator('.officina-chat-author strong').allTextContents();
  assert.equal(authorOrder[0], 'Tú');
  assert.equal(authorOrder[1], 'Coordinación');
  assert.ok(authorOrder.slice(2, -1).includes('Arquitecto'));
  assert.equal(authorOrder.at(-1), 'Coordinación');
  await formattedGoal.getByRole('button', {name: /^Ver mensaje de Arquitecto/}).click();
  await dialog.getByRole('heading', {name: 'Hallazgo'}).waitFor();
  await dialog.locator('li code').getByText('fixtures/aprobaciones.json', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await formattedGoal.getByRole('button', {name: 'Ver mensaje de Coordinación · Conclusión'}).press('Enter');
  await dialog.getByRole('heading', {name: 'Resumen'}).waitFor();
  assert.equal(await dialog.locator('ol li').count(), 2);
  await dialog.getByRole('table').getByText('Revisado', {exact: true}).waitFor();
  await dialog.screenshot({path: resolve(evidence, 'officina-respuestas.png')});
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  const chatLinks = page.locator('.officina-project-tools > summary').filter({hasText: 'Chats en Codex'});
  await chatLinks.click();
  assert.equal(await page.locator('.officina-chat-team button[data-role]').count(), 6);
  await page.getByRole('button', {name: 'Abrir carpeta en Codex'}).click();
  await page.getByText('Añadir a Proyectos de Codex', {exact: true}).click();
  await page.getByRole('button', {name: 'Copiar ruta de la carpeta'}).click();
  await page.getByText('Ruta copiada', {exact: true}).waitFor();
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await composer.fill('Analiza el contenido en Google Chrome con la herramienta de ChatGPT en el navegador.');
  await page.getByRole('button', {name: 'Enviar a coordinación'}).click();
  const browserGoal = page.locator('.officina-goal').filter({hasText: 'Analiza el contenido en Google Chrome'});
  await browserGoal.getByText('El Analista revisará las pestañas abiertas por medio de la extensión de ChatGPT.').waitFor();
  await browserGoal.locator('.officina-current').getByText('Trabajando en Codex', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await page.locator('.officina-signal').waitFor();
  await analystIdle.waitFor({state: 'detached'});
  assert.equal(await screens.count(), 7);
  await page.waitForFunction(() => [...document.querySelectorAll('.officina-screens [data-role=analyst][data-state=working]')]
    .filter(display => display.getAnimations({subtree: true}).some(animation => animation.playbackRate > 1)).length === 2);
  await page.locator('.officina-idle-seat[data-role=developer]').waitFor();
  const analyst = page.locator('.officina-team-list button[data-role=analyst]');
  const coordination = page.locator('.officina-team-list button[data-role=coordinator]');
  await analyst.getByText('Trabajando en Codex', {exact: true}).waitFor();
  assert.equal(await coordination.count(), 1);
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await browserGoal.getByText('Objetivo de prueba completado.', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await analystIdle.waitFor();
  await page.waitForFunction(() => {
    const animations = document.querySelector('.officina-analysis-screen[data-state=done]')?.getAnimations({subtree: true});
    return animations?.length && animations.every(animation => animation.playbackRate === 0);
  });
  assert.equal(await page.locator('.officina-board-pointer').evaluate(async cursor => {
    const before = cursor.getAnimations()[0].currentTime;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return cursor.getAnimations()[0].currentTime === before;
  }), true);
  await page.waitForFunction(() => document.querySelector('.officina-code-reel')?.getAnimations()
    .some(animation => animation.playState === 'running'));
  const browserResult = await page.evaluate(async () => {
    const result = await window.companion.officina({type: 'read'});
    return result.value.project.events.find(event => event.data.text === 'Pestañas sintéticas de Chrome revisadas.')?.from;
  });
  assert.equal(browserResult, 'analyst');
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await chatLinks.click();
  assert.equal(await page.locator('.officina-chat-team button[data-role]').count(), 6);
  await composer.fill('Revisa Chrome con la extensión de ChatGPT sin pestañas accesibles.');
  await page.getByRole('button', {name: 'Enviar a coordinación'}).click();
  const limitedGoal = page.locator('.officina-goal').filter({hasText: 'sin pestañas accesibles'});
  await limitedGoal.getByText('Cerrado con limitaciones', {exact: true}).waitFor();
  await limitedGoal.locator('[data-conclusion=true]').getByText('El navegador de prueba devolvió una lista vacía de pestañas.', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await analyst.getByText('Cerrado con limitaciones', {exact: true}).waitFor();
  assert.equal(await page.getByText(/^(?:Decisión|Aprobación) pendiente$/).count(), 0);
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  const chatTasks = page.getByRole('combobox', {name: 'Encargo de Chat global'});
  await chatTasks.selectOption({label: 'Define la regla de aprobación de un gasto ficticio.'});
  await formattedGoal.getByText('Objetivo de prueba completado.', {exact: true}).waitFor();
  assert.equal(await limitedGoal.count(), 0);
  const localRequest = 'Revisa la carpeta entera y contrasta el archivo adjunto.';
  await composer.fill(localRequest);
  await page.getByRole('button', {name: 'Elegir carpeta de trabajo'}).click();
  const sources = page.getByRole('group', {name: 'Contexto local del encargo'});
  await sources.getByText('Carpeta elegida · Proyecto sintético').waitFor();
  await page.getByRole('button', {name: 'Adjuntar archivos'}).click();
  await sources.getByText('Referencia de prueba.txt', {exact: true}).waitFor();
  await sources.getByRole('button', {name: 'Quitar Referencia de prueba.txt'}).click();
  await sources.getByText('Referencia de prueba.txt', {exact: true}).waitFor({state: 'detached'});
  await page.getByRole('button', {name: 'Adjuntar archivos'}).click();
  await sources.getByText('Referencia de prueba.txt', {exact: true}).waitFor();
  assert.equal(await composer.inputValue(), localRequest);
  assert.equal(await composer.evaluate(node => node.getBoundingClientRect().bottom <= innerHeight), true);
  await page.getByRole('button', {name: 'Enviar a coordinación'}).click();
  await sources.getByText('Carpeta de trabajo · Proyecto sintético').waitFor();
  const localGoal = page.locator('.officina-goal').filter({hasText: localRequest});
  await localGoal.getByText('Evidencia de subcarpeta / Evidencia del archivo adjunto', {exact: true}).waitFor();
  await localGoal.getByRole('list', {name: 'Archivos adjuntos'}).getByText('Referencia de prueba.txt').waitFor();
  await page.locator('.officina').screenshot({path: resolve(evidence, 'officina-contexto-local.png')});
  const localProject = await page.evaluate(async () => {
    const result = await window.companion.officina({type: 'read'});
    return {name: result.value.project.name, path: result.value.project.folder.path, cwd: result.value.project.team.cwd};
  });
  assert.equal(localProject.name, 'Proyecto sintético');
  assert.equal(localProject.path, localProject.cwd);
  await localGoal.getByRole('button', {name: 'Ver mensaje de Coordinación · Conclusión'}).click();
  const fileLink = dialog.getByRole('button', {name: 'Guía del proyecto'});
  await fileLink.click();
  const fileActions = dialog.getByRole('group', {name: 'Abrir archivo o carpeta'});
  await fileActions.getByRole('button', {name: 'Mostrar en el Explorador'}).click();
  await fileActions.waitFor({state: 'detached'});
  await fileLink.click();
  await fileActions.getByRole('button', {name: 'Abrir en VS Code'}).click();
  await fileActions.waitFor({state: 'detached'});
  await dialog.getByRole('button', {name: 'Referencia web'}).click();
  assert.equal(await dialog.getByRole('alert').count(), 0);
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await options.selectOption({label: 'Aprobación de gastos'});
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await page.getByRole('button', {name: 'Ver tarea', exact: true}).waitFor();
  assert.equal(await receipt.count(), 0);

  const reviewRequest = 'Analiza el proyecto y dime qué opinas.';
  await createProject(page, 'Revisión de ZeN');
  await page.locator('.officina-table').click();
  await composer.fill(reviewRequest);
  await page.getByRole('button', {name: 'Enviar a Coordinación'}).click();
  await page.locator('.officina-chat').getByText('Conclusión independiente de Coordinación.', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await coordination.getByText('Asignó al Analista funcional', {exact: true}).waitFor();
  await analyst.getByText('Análisis listo', {exact: true}).waitFor();
  const team = page.locator('.officina-team-list');
  const resultFor = role => team.getByRole('button', {name: `Ver resultado de ${role}`, exact: true});
  const readBoard = () => page.evaluate(async () => {
    const result = await window.companion.officina({type: 'read'});
    return result.value.project;
  });
  const before = await readBoard();
  const reviewTask = before.tasks[0].id;
  assert.deepEqual(before.runs.map(run => run.role), ['coordinator', 'analyst', 'coordinator']);
  assert.ok(before.runs.every(run => run.task === reviewTask && run.turn));
  await resultFor('Analista funcional').click();
  await dialog.getByRole('heading', {name: 'Opinión del Analista'}).waitFor();
  await dialog.getByText('El siguiente paso es medir la cobertura del puente.', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await resultFor('Coordinación').click();
  await dialog.getByText('Conclusión independiente de Coordinación.', {exact: true}).waitFor();
  assert.equal(await dialog.getByText('El Analista funcional revisará el proyecto de prueba.', {exact: true}).count(), 0);
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await options.selectOption({label: 'Inventario'});
  await page.locator('.officina-desk-activity').getByText('Sin encargos para este puesto.').waitFor();
  assert.equal(await resultFor('Analista funcional').count(), 0);
  await options.selectOption({label: 'Revisión de ZeN'});
  await resultFor('Analista funcional').click();
  await dialog.getByRole('heading', {name: 'Opinión del Analista'}).waitFor();
  assert.deepEqual(await readBoard(), before);
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();

  const layouts = [];
  await page.emulateMedia({reducedMotion: 'reduce'});
  for (const [width, height] of [[948, 977], [1280, 700]]) {
    await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    await page.waitForFunction(w => innerWidth === w, width);
    await page.locator('.officina-brand').hover();
    const geometry = await page.locator('.officina').evaluate(root => {
      const rect = selector => root.querySelector(selector).getBoundingClientRect().toJSON();
      const scene = rect('.officina-scene');
      const deskLabel = root.querySelector('.officina-desk-label');
      const anchors = [...root.querySelectorAll('.officina-desk')].map(button => {
        const box = button.getBoundingClientRect();
        return [(box.x + box.width / 2 - scene.x) / scene.width, (box.y - scene.y) / scene.height];
      });
      return {viewport: [innerWidth, innerHeight], scene, stage: rect('.officina-stage'),
        activity: rect('.officina-desk-activity'), composer: rect('.officina-chat-compose'),
        labelSize: parseFloat(getComputedStyle(deskLabel).fontSize), anchors};
    });
    assert.ok(Math.abs(geometry.scene.width / geometry.scene.height - 1.2) < .003);
    if (width === 948) assert.ok(Math.abs(geometry.activity.top - geometry.scene.bottom - 8) < 2);
    else {
      assert.ok(geometry.activity.left >= geometry.scene.right);
      assert.ok(Math.abs(geometry.activity.top - geometry.scene.top) < 2);
      assert.ok(geometry.scene.width > 500);
    }
    assert.ok(geometry.labelSize >= 10, `Rótulo de ${geometry.labelSize}px en ${geometry.viewport.join(' × ')}`);
    assert.ok(geometry.composer.bottom <= geometry.viewport[1] + 1);
    for (const [index, [x, y]] of [[.32, .11], [.78, .12], [.21, .35], [.82, .43], [.25, .63]].entries()) {
      assert.ok(Math.abs(geometry.anchors[index][0] - x) < .005 && Math.abs(geometry.anchors[index][1] - y) < .005);
    }
    layouts.push(geometry);
    await page.locator('.officina').screenshot({path: resolve(evidence, `officina-${width}x${height}.png`)});
    await page.getByRole('button', {name: 'Chat global', exact: true}).click();
    const chatGeometry = await page.locator('.officina').evaluate(root => {
      const rect = selector => root.querySelector(selector).getBoundingClientRect();
      const chat = rect('.officina-chat'), thread = rect('.officina-chat-content'), composer = rect('.officina-chat-compose');
      return {fullWidth: Math.abs(chat.width - root.clientWidth) < 18, centered: Math.abs(chat.left + chat.right - thread.left - thread.right) < 2,
        composerVisible: chat.bottom <= composer.top && composer.bottom <= innerHeight + 1};
    });
    assert.deepEqual(chatGeometry, {fullWidth: true, centered: true, composerVisible: true});
    await page.locator('.officina').screenshot({path: resolve(evidence, `officina-chat-${width}x${height}.png`)});
    await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  }
  await writeFile(resolve(evidence, 'officina-layouts.json'), JSON.stringify(layouts, null, 2));

  await page.getByRole('button', {name: 'Editar puesto'}).click();
  await dialog.getByRole('heading', {name: 'Configurar oficina'}).waitFor();
  await dialog.getByLabel('Puesto', {exact: true}).selectOption('tester');
  assert.equal(await dialog.getByRole('option').count(), 7);
  const customPrompt = 'Organiza los resultados en una tabla Caso | Estado | Evidencia.';
  await dialog.getByLabel('Nombre visible').fill('QA de aplicaciones');
  await dialog.getByLabel('Instrucciones del puesto').fill(customPrompt);
  await dialog.getByRole('button', {name: 'Guardar cambios'}).click();
  await dialog.getByText('Cambios guardados.', {exact: true}).waitFor();
  await dialog.screenshot({path: resolve(evidence, 'officina-configurar-puesto.png')});
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();

  const recipient = page.locator('#officina-recipient');
  const testerDesk = page.locator('.officina-desk[data-role=tester]');
  const testerCard = team.locator('[data-role=tester]');
  await testerDesk.click();
  assert.equal(await testerCard.getAttribute('aria-pressed'), 'true');
  await recipient.getByText('Para QA de aplicaciones', {exact: true}).waitFor();
  await composer.fill('Comprueba el destinatario del encargo.');
  await page.locator('.officina-desk[data-role=developer]').hover();
  assert.equal(await testerDesk.getAttribute('aria-pressed'), 'true');
  assert.equal(await composer.inputValue(), 'Comprueba el destinatario del encargo.');
  await coordination.click();
  assert.equal(await page.locator('.officina-table').getAttribute('aria-pressed'), 'true');
  await recipient.getByText('Para Coordinación', {exact: true}).waitFor();
  await testerCard.click();
  assert.equal(await testerDesk.getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  const chatRecipient = page.getByRole('combobox', {name: 'Destinatario del encargo'});
  assert.equal(await chatRecipient.inputValue(), 'tester');
  await chatRecipient.selectOption('analyst');
  await page.getByRole('button', {name: 'Enviar a Analista funcional', exact: true}).waitFor();
  await chatRecipient.selectOption('tester');
  assert.equal(await composer.inputValue(), 'Comprueba el destinatario del encargo.');
  await page.getByRole('button', {name: 'Enviar a QA de aplicaciones', exact: true}).click();
  const direct = page.locator('.officina-goal').filter({hasText: 'Comprueba el destinatario del encargo.'});
  await direct.getByText('Resultado registrado por QA de aplicaciones.', {exact: true}).waitFor();
  const sent = await readBoard();
  const directGoal = sent.goals.find(goal => goal.task !== reviewTask);
  assert.equal(sent.id, before.id);
  assert.equal(directGoal.recipient, 'tester');
  assert.equal(directGoal.phase, 'complete');
  const directRuns = sent.runs.filter(run => run.task === directGoal.task);
  assert.deepEqual(directRuns.map(run => [run.role, run.destination.thread]), [['tester', sent.team.threads.tester]]);
  await direct.getByRole('button', {name: /^Ver mensaje de QA de aplicaciones/}).click();
  await dialog.getByRole('table').getByRole('cell', {name: 'Correcto'}).waitFor();
  await dialog.getByText('Destino confirmado.', {exact: true}).waitFor();
  assert.deepEqual(await readBoard(), sent);
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  assert.deepEqual(sent.profiles.tester, {name: 'QA de aplicaciones', prompt: customPrompt});

  const pasted = '# Diagnóstico detallado\n\n' + 'Conserva los contratos y el comportamiento esperado.\n'.repeat(34);
  await composer.evaluate((input, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', value);
    input.dispatchEvent(new ClipboardEvent('paste', {bubbles: true, cancelable: true, clipboardData}));
  }, pasted);
  const card = page.getByRole('group', {name: 'Texto pegado'});
  await card.getByText('Diagnóstico detallado', {exact: true}).waitFor();
  assert.equal(await composer.inputValue(), '');
  await card.getByRole('button', {name: 'Mostrar en el campo de texto'}).click();
  const pasteEditor = page.getByRole('textbox', {name: 'Editar texto pegado'});
  assert.equal(await pasteEditor.inputValue(), pasted);
  const edited = pasted + '\nComprueba el recorrido final.';
  await pasteEditor.fill(edited);
  await card.getByRole('button', {name: 'Plegar texto'}).click();
  await page.locator('.officina').screenshot({path: resolve(evidence, 'officina-texto-pegado.png')});
  await page.getByRole('button', {name: 'Enviar a QA de aplicaciones', exact: true}).click();
  const pastedGoal = page.locator('.officina-goal').filter({hasText: 'Diagnóstico detallado'});
  await pastedGoal.getByText('Resultado registrado por QA de aplicaciones.', {exact: true}).waitFor();
  const pasteHistory = pastedGoal.locator('.officina-paste-history');
  await pasteHistory.locator('summary').click();
  assert.equal(await pasteHistory.locator('pre').textContent(), edited);
  assert.ok((await readBoard()).goals.some(goal => goal.pastedText === edited));

  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await page.emulateMedia({reducedMotion: 'no-preference'});
  const observerBefore = await readBoard();
  assert.equal(observerBefore.team.threads.observer, undefined);
  const marker = page.getByRole('button', {name: 'ZEN · Observador', exact: true});
  assert.equal(await marker.evaluate(element => {
    const scene = element.closest('.officina-scene').getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const station = element.closest('.officina-scene').querySelector('.officina-observer-station').getBoundingClientRect();
    return Math.abs((box.left + box.width / 2 - scene.left) / scene.width - .51) < .005 &&
      (box.top - scene.top) / scene.height < .1 && box.left <= station.left && box.right >= station.right &&
      box.bottom >= station.bottom;
  }), true);
  await marker.click();
  const observer = page.getByRole('region', {name: 'Puesto de ZEN'});
  assert.equal(await page.locator('.officina-team-select[data-role=observer]').getAttribute('aria-pressed'), 'true');
  await observer.getByRole('button', {name: 'Instrucciones'}).click();
  assert.match(await dialog.getByLabel('Instrucciones del puesto').inputValue(), /Audita cómo trabajó el equipo/);
  await dialog.getByText('Reglas fijas y formato de las respuestas').click();
  await dialog.getByText(/No contactes a otros agentes/).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await observer.getByRole('combobox', {name: 'Ámbito de la revisión de ZEN'}).selectOption({label: reviewRequest});
  await observer.getByRole('button', {name: 'Revisar actividad'}).click();
  await page.waitForFunction(() => {
    const monitor = document.querySelector('.officina-observer-monitor[data-state=working]');
    return monitor?.getAnimations({subtree: true}).some(animation => animation.playbackRate > 1);
  });
  await page.locator('.officina').screenshot({path: resolve(evidence, 'officina-zen-revisando.png')});
  await observer.getByRole('button', {name: 'Ver propuestas (2)'}).waitFor();
  await page.waitForFunction(() => {
    const animations = document.querySelector('.officina-observer-monitor[data-state=done]')?.getAnimations({subtree: true});
    return animations?.length && animations.every(animation => animation.playbackRate === 0);
  });
  const observation = await readBoard();
  assert.deepEqual(observation.profiles, observerBefore.profiles);
  assert.deepEqual(observation.events, observerBefore.events);
  assert.deepEqual(observation.tasks, observerBefore.tasks);
  assert.deepEqual(observation.runs.slice(observerBefore.runs.length).map(item => [item.role, item.state]), [['observer', 'completed']]);
  assert.equal(await observer.evaluate(desk => desk.scrollWidth <= desk.clientWidth + 1), true);
  await page.locator('.officina').screenshot({path: resolve(evidence, 'officina-zen-observador-apaisado.png')});
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setSize(948, 977));
  await page.waitForFunction(() => innerWidth === 948);
  assert.equal(await observer.evaluate(desk => desk.scrollWidth <= desk.clientWidth + 1), true);
  await page.locator('.officina').screenshot({path: resolve(evidence, 'officina-zen-observador.png')});
  await observer.getByRole('button', {name: 'Ver propuestas (2)'}).click();
  await dialog.getByRole('heading', {name: 'Observaciones', exact: true}).waitFor();
  const change = dialog.locator('.officina-observer-proposal').filter({hasText: 'Añadir evidencias al análisis'});
  assert.equal(await change.getByRole('button', {name: 'Aplicar prompt'}).isVisible(), false);
  await change.getByText('Comparar prompts', {exact: true}).click();
  await change.getByRole('heading', {name: 'Prompt en la revisión'}).waitFor();
  await change.getByRole('heading', {name: 'Prompt propuesto'}).waitFor();
  await dialog.screenshot({path: resolve(evidence, 'officina-zen-propuestas.png')});
  await change.getByRole('button', {name: 'Aplicar prompt'}).click();
  await dialog.getByText('Prompt aplicado', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Aprobar e iniciar seguimiento'}).click();
  await dialog.getByText('Recomendación aprobada', {exact: true}).waitFor();
  await dialog.getByText('ZEN · Trabajando en Codex', {exact: true}).waitFor();
  await dialog.getByText('Ver resultado de ZEN', {exact: true}).click();
  await dialog.getByRole('heading', {name: 'Resultado de seguimiento'}).waitFor();
  const approved = await readBoard();
  assert.match(approved.profiles.analyst.prompt, /Relaciona cada hallazgo/);
  assert.deepEqual(approved.runs.slice(0, -1), observation.runs);
  assert.equal(approved.runs.at(-1).followup.result.outcome, 'done');
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await options.selectOption({label: 'Aprobación de gastos'});
});

{
  const id = randomUUID(), task = randomUUID(), delivery = randomUUID(), qa = randomUUID(), closure = randomUUID();
  const db = new DatabaseSync(join(profileDirectory, 'officina.sqlite'));
  try {
    const name = 'Cierre tras QA';
    const title = 'Validar entrega v2';
    const project = {
      id, name, team: {projectId: id, cwd: 'C:\\fixture', threads: Object.fromEntries(
        ['coordinator','analyst','architect','developer','tester','alm'].map(role => [role, randomUUID()]))},
      tasks: [{id: task, title, objective: title, owner: 'tester', criteria: 'Pruebas de aceptación.', status: 'active'}],
      goals: [{task, request: title, phase: 'verify', steps: [], cursor: 0, round: 1, history: [{from: 'human', text: title}],
        question: 'El objetivo supera el contexto del puente. Revisa la tarea antes de indicar cómo continuar.'}],
      runs: [{id: closure, task, role: 'coordinator', depth: 0, state: 'review',
        issue: 'El contexto de decisiones y dependencias supera el límite del puente. Revisa el encargo en el tablero.'}],
      events: [
        {id: delivery, task, from: 'developer', source: 'codex', at: 1,
          data: {kind: 'handoff', text: 'Entrega v2 disponible.', to: 'tester', act: true,
            artifact: {version: 'v2', link: 'dist/app.zip', next: 'Valida v2.'}}},
        {id: qa, task, from: 'tester', source: 'codex', at: 2,
          data: {kind: 'qa', text: 'Pruebas aprobadas.', replyTo: delivery, evidence: 'QA-2', passed: true}},
      ],
    };
    db.prepare('INSERT INTO officina_projects(id,name,body) VALUES(?,?,?)').run(id, name, JSON.stringify(project));
  } finally { db.close(); }
}

await withZen(async (page) => {
  await enter(page);
  const selector = page.getByRole('combobox', {name: 'Proyecto de Officina'});
  await selector.getByRole('option', {name: 'Aprobación de gastos'}).waitFor({state: 'attached'});
  assert.equal(await selector.locator('option:checked').textContent(), 'Aprobación de gastos');
  await page.locator('.officina-desk-activity').getByRole('button', {name: 'Ver tarea', exact: true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('QA bloqueó 1.0.4', {exact: true}).waitFor();
  await dialog.getByText('QA-18', {exact: false}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await selector.selectOption({label: 'Inventario'});
  await page.locator('.officina-desk-activity').getByText('Sin encargos para este puesto.').waitFor();
  assert.equal(await page.locator('.officina-desk-activity').getByText('Último traspaso', {exact: false}).count(), 0);
  await selector.selectOption({label: 'Coordinación de prueba'});
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await page.getByRole('combobox', {name: 'Encargo de Chat global'}).selectOption({label: 'Define la regla de aprobación de un gasto ficticio.'});
  await page.getByText('Objetivo de prueba completado.', {exact: true}).last().waitFor();
  await selector.selectOption({label: 'Proyecto sintético'});
  await page.getByText('Carpeta de trabajo · Proyecto sintético').waitFor();
  await page.locator('.officina-chat').getByText('Evidencia de subcarpeta / Evidencia del archivo adjunto', {exact: true}).waitFor();
  await selector.selectOption({label: 'Revisión de ZeN'});
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await page.locator('.officina-team-member:has([data-role=observer])').getByRole('button', {name: 'Revisiones'}).click();
  await dialog.getByText('Prompt aplicado', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await page.locator('.officina-team-list').getByRole('button', {name: 'Ver resultado de Analista funcional'}).click();
  await dialog.getByRole('heading', {name: 'Opinión del Analista'}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await page.locator('.officina-desk[data-role=tester]').getByText('QA de aplicaciones', {exact: true}).click();
  await page.getByRole('button', {name: 'Editar puesto'}).click();
  assert.match(await dialog.getByLabel('Instrucciones del puesto').inputValue(), /^Organiza los resultados/);
  await dialog.getByRole('button', {name: 'Restaurar perfil predeterminado'}).click();
  await dialog.getByText('Perfil predeterminado restaurado.').waitFor();
  assert.equal(await dialog.getByLabel('Nombre visible').inputValue(), 'Tester');
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await selector.selectOption({label: 'Cierre tras QA'});
  const closureCard = page.locator('.officina-side .officina-next');
  await closureCard.getByText('Cierre de Coordinación pendiente', {exact: true}).waitFor();
  await closureCard.getByText('QA aprobó la versión', {exact: false}).waitFor();
  assert.equal(await page.getByText('Tu autorización es necesaria', {exact: true}).count(), 0);
  await page.locator('.officina').screenshot({path: resolve(evidence, 'officina-cierre-pendiente.png')});
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await page.locator('.officina-chat-toolbar .officina-next').getByText('Cierre de Coordinación pendiente', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await closureCard.getByRole('button', {name: 'Ver informes'}).click();
  await dialog.getByText('QA validó v2', {exact: true}).waitFor();
  assert.equal(await dialog.locator('textarea[name=answer]').count(), 0);
  await dialog.getByRole('button', {name: 'Reintentar cierre'}).click();
  await dialog.getByText('Cierre de Coordinación pendiente', {exact: true}).waitFor({state: 'detached'});
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await page.locator('.officina-chat').getByText('Objetivo de prueba completado.', {exact: true}).waitFor();
  await createProject(page, 'Incidencia de laboratorio');
  await page.getByRole('combobox', {name: 'Destinatario del encargo'}).selectOption('developer');
  await page.getByRole('textbox', {name: 'Objetivo'}).fill('Verifica el traspaso de laboratorio.');
  await page.getByRole('button', {name: 'Enviar a Desarrollador'}).click();
  const notice = page.locator('.officina-chat-toolbar .officina-next[data-kind=monitor]');
  await notice.getByText('ZEN detectó una incidencia').waitFor();
  await page.locator('.officina-goal').getByText('Cerrado con limitaciones', {exact: true}).waitFor();
  const board = await page.evaluate(async () => (await window.companion.officina({type: 'read'})).value.project);
  assert.deepEqual(board.runs.map(run => [run.role, run.state]), [['developer', 'completed'], ['tester', 'completed']]);
  assert.equal(board.team.threads.observer, undefined);
  await notice.getByRole('button', {name: 'Ver propuesta'}).click();
  await dialog.getByRole('heading', {name: 'Preparar una comprobación independiente de la entrega'}).waitFor();
  await dialog.getByText(/La interacción quedó pendiente/).waitFor();
  await dialog.getByRole('button', {name: 'Abrir turno en Codex'}).waitFor();
  await dialog.getByRole('button', {name: 'Aprobar e iniciar seguimiento'}).click();
  await dialog.getByText('Recomendación aprobada', {exact: true}).waitFor();
  await dialog.getByText('ZEN · Trabajando en Codex', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await notice.waitFor({state: 'detached'});
  await page.locator('.officina-chat-toolbar .officina-next[data-kind=followup]').getByText('ZEN · Seguimiento listo', {exact: true}).waitFor();
});

console.log(JSON.stringify({officina: true, evidence, restarted: true, projectIsolation: true, liveCodex: false}));
