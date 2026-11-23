import {strict as assert} from 'node:assert';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {_electron as electron} from 'playwright';

const profile = randomUUID();
const executablePath = process.argv[2] && resolve(process.argv[2]);
const args = [...(executablePath ? [] : ['.']), '--zen-hover-smoke', `--zen-officina-profile=${profile}`];
const rule = 'Nadie puede aprobar su propio gasto.';
const version = '1.0.4';
const evidence = resolve('release', 'officina');
await mkdir(evidence, {recursive: true});
const env = {...process.env};
delete env.ELECTRON_RUN_AS_NODE;
delete env.OPENAI_API_KEY;

async function withZen(run) {
  const app = await electron.launch({args, executablePath, env, timeout: 30000});
  try {
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
  const table = page.getByRole('button', {name: 'Abrir tablero del proyecto'});
  await table.focus();
  await table.press('Enter');
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
  assert.equal(await reflections.count(), 5);
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
  [['analyst', true], ['architect', true], ['developer', true], ['developer', true], ['tester', true], ['alm', true]]);
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
  await page.getByRole('button', {name: 'Analista funcional', exact: true}).first().click();
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
  await page.getByRole('button', {name: 'ALM', exact: true}).click();
  dialog = page.getByRole('dialog');
  await dialog.getByText('QA bloqueó 1.0.4', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await page.getByRole('button', {name: 'Ver traspaso en conexión de Tester'}).click();
  await dialog.getByText('Flujo preparado', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await page.locator('.officina-photo').evaluate(async image => { await image.decode(); });
  assert.equal(await page.locator('.officina-desk').first().evaluate(button => getComputedStyle(button).backgroundColor), 'rgba(0, 0, 0, 0)');
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
  assert.equal(await page.getByText('Último traspaso', {exact: true}).count(), 0);
  const options = page.getByRole('combobox', {name: 'Proyecto de Officina'});
  await options.selectOption({label: 'Aprobación de gastos'});
  await page.getByRole('button', {name: 'Ver tarea', exact: true}).waitFor();
  await createProject(page, 'Coordinación de prueba');
  await composer.fill('Define la regla de aprobación de un gasto ficticio.');
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  assert.equal(await composer.inputValue(), 'Define la regla de aprobación de un gasto ficticio.');
  await page.getByRole('button', {name: 'Enviar a coordinación'}).click();
  await page.getByText('6 chats vinculados', {exact: true}).waitFor();
  await page.getByText('Objetivo de prueba completado.', {exact: true}).waitFor();
  const formattedGoal = page.locator('.officina-goal').filter({hasText: 'Define la regla de aprobación'});
  const replies = formattedGoal.getByRole('region', {name: 'Respuestas del equipo'});
  await replies.getByText('Arquitecto', {exact: true}).click();
  await replies.getByRole('heading', {name: 'Hallazgo'}).waitFor();
  await replies.locator('li code').getByText('fixtures/aprobaciones.json', {exact: true}).waitFor();
  const conclusion = formattedGoal.locator('[data-conclusion=true]');
  await conclusion.getByRole('heading', {name: 'Resumen'}).waitFor();
  assert.equal(await conclusion.locator('ol li').count(), 2);
  await conclusion.getByRole('table').getByText('Revisado', {exact: true}).waitFor();
  await conclusion.scrollIntoViewIfNeeded();
  await page.locator('.officina').screenshot({path: resolve(evidence, 'officina-respuestas.png')});
  await page.locator('.officina-project-tools > summary').filter({hasText: 'Chats en Codex'}).click();
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
  await page.locator('.officina-signal').waitFor();
  await analystIdle.waitFor({state: 'detached'});
  assert.equal(await screens.count(), 6);
  await page.waitForFunction(() => [...document.querySelectorAll('.officina-screens [data-role=analyst][data-state=working]')]
    .filter(display => display.getAnimations({subtree: true}).some(animation => animation.playbackRate > 1)).length === 2);
  await page.locator('.officina-idle-seat[data-role=developer]').waitFor();
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  const analyst = page.locator('.officina-team-list button[data-role=analyst]');
  const coordination = page.locator('.officina-team-list button[data-role=coordinator]');
  await analyst.getByText('Trabajando en Codex', {exact: true}).waitFor();
  assert.equal(await coordination.count(), 1);
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await browserGoal.getByText('Objetivo de prueba completado.', {exact: true}).waitFor();
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
  await page.locator('.officina').screenshot({path: resolve(evidence, 'officina-chat-global.png')});
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
  await options.selectOption({label: 'Aprobación de gastos'});
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await page.getByRole('button', {name: 'Ver tarea', exact: true}).waitFor();
  assert.equal(await receipt.count(), 0);
});

await withZen(async (page) => {
  await enter(page);
  const selector = page.getByRole('combobox', {name: 'Proyecto de Officina'});
  await selector.getByRole('option', {name: 'Aprobación de gastos'}).waitFor({state: 'attached'});
  assert.equal(await selector.locator('option:checked').textContent(), 'Aprobación de gastos');
  await page.getByRole('button', {name: 'Ver tarea', exact: true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('QA bloqueó 1.0.4', {exact: true}).waitFor();
  await dialog.getByText('QA-18', {exact: false}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await selector.selectOption({label: 'Inventario'});
  assert.equal(await page.getByText('Último traspaso', {exact: true}).count(), 0);
  await selector.selectOption({label: 'Coordinación de prueba'});
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await page.getByText('Objetivo de prueba completado.', {exact: true}).last().waitFor();
  await selector.selectOption({label: 'Proyecto sintético'});
  await page.getByText('Carpeta de trabajo · Proyecto sintético').waitFor();
  await page.getByText('Evidencia de subcarpeta / Evidencia del archivo adjunto', {exact: true}).waitFor();
});

console.log(JSON.stringify({officina: true, evidence, restarted: true, projectIsolation: true, liveCodex: false}));
