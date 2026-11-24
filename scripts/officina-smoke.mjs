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

async function record(page, role, data) {
  const result = await page.evaluate(async ({role, data}) => {
    const {value:{project}} = await window.companion.officina({type: 'read'});
    const task = project.tasks.find(item => item.title === 'Permisos de aprobación').id;
    return window.companion.officina({type: 'contribute', project: project.id, task, role, data, nonce: crypto.randomUUID()});
  }, {role, data});
  assert.equal(result.ok, true, result.error);
}

async function openAgent(dialog, role) {
  const summary = dialog.locator('.officina-agent-group > summary').filter({has: dialog.page().getByText(role, {exact: true})});
  const group = summary.locator('..');
  if (!await group.evaluate(node => node.open)) await summary.click();
  return group;
}

async function checkCoordinationWidth(page, width) {
  const card = page.getByRole('region', {name: 'Actividad de Coordinación'});
  const geometry = await card.evaluate(node => {
    const selection = document.querySelector('.officina-task-focus select');
    const title = selection.selectedOptions[0];
    const previousTitle = title.textContent;
    title.textContent = 'segmento_sin_espacios_'.repeat(24).slice(0, 120);
    try {
      const card = node.getBoundingClientRect();
      const fits = element => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.left >= card.left && box.right <= card.right + 1;
      };
      const composer = document.querySelector('.officina-chat-compose').getBoundingClientRect();
      return {width: innerWidth, overflow: node.scrollWidth - node.clientWidth,
        controlsFit: [...node.querySelectorAll('button')].every(fits),
        taskSelectorFits: selection.getBoundingClientRect().right <= innerWidth,
        composerVisible: composer.height > 0 && composer.bottom <= innerHeight + 1,
        sidebarVisible: document.querySelector('.officina-side').getBoundingClientRect().width > 0};
    } finally {title.textContent = previousTitle;}
  });
  assert.deepEqual(geometry, {width, overflow: 0, controlsFit: true, taskSelectorFits: true, composerVisible: true, sidebarVisible: true});
  if (width === 320) await card.evaluate(node => node.scrollIntoView({block: 'start'}));
  await page.screenshot({path: resolve(evidence, 'officina-coordinacion-' + width + '.png')});
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
  assert.equal(await page.locator('.officina-compose-queue').count(), 0);
  assert.equal(await page.getByRole('button', {name: 'Activar cola', exact: true}).count(), 0);
  const idleSeats = page.locator('.officina-idle-seat');
  const analystIdle = page.locator('.officina-idle-seat[data-role=analyst]');
  const screens = page.locator('.officina-screen');
  const reflections = page.locator('.officina-screen-reflection');
  await screens.first().waitFor();
  assert.equal(await reflections.count(), 6);
  await page.waitForFunction(() => [...document.querySelectorAll('.officina-screen, .officina-screen-reflection')]
    .every(display => display.getAnimations({subtree: true}).some(animation => animation.playbackRate > 0 && animation.playbackRate < 1)));
  assert.equal(await page.locator('.officina-round').count(), 0);
  await page.locator('.officina-cafe-counter').waitFor();
  assert.equal(await page.locator('.officina-coffee-walk, .officina-cafe-button').count(), 0);
  assert.deepEqual(await idleSeats.evaluateAll(seats => seats.map(seat => seat.dataset.action)),
    ['phone', 'pen', 'coffee', 'stretch', 'notebook']);
  assert.equal(await idleSeats.evaluateAll(seats => new Set(seats.map(seat =>
    getComputedStyle(seat.firstElementChild).animationDuration)).size), 5);
  assert.deepEqual(await screens.evaluateAll(displays => displays.map(display => [display.dataset.role,
    display.getAnimations({subtree: true}).some(animation => animation.playState === 'running' &&
      animation.effect.getTiming().iterations === Infinity)])),
  [['analyst', true], ['architect', true], ['developer', true], ['developer', true], ['tester', true], ['alm', true],
    ['coordinator', true], ['observer', true]]);
  const scene = page.locator('.officina-scene');
  const visibleMotion = await scene.evaluate(async scene => {
    const sample = elements => elements.map(element => element.getAnimations({subtree: true}).map(({effect}) => {
      const {opacity, left, top, translate, scale, transform, backgroundPosition} =
        getComputedStyle(effect.target, effect.pseudoElement);
      return [opacity, left, top, translate, scale, transform, backgroundPosition].join('/');
    }).join('|'));
    const elements = [...scene.querySelectorAll('.officina-screen, [data-seated-gesture]')];
    const before = sample(elements);
    await new Promise(resolve => setTimeout(resolve, 350));
    return sample(elements).map((appearance, index) => [elements[index].dataset.role ??
      elements[index].dataset.seatedGesture, appearance !== before[index]]);
  });
  assert.equal(visibleMotion.length, 14);
  assert.deepEqual(visibleMotion.filter(([, changed]) => !changed), [], 'Cada puesto debe tener movimiento ambiental');
  const assertRoomTargets = async () => {
    const rooms = await scene.evaluate(scene => {
      const selectors = '.officina-desk, .officina-observer-marker, .officina-table';
      const areas = Array.from(scene.querySelectorAll(selectors), element => element.getBoundingClientRect());
      const separated = areas.every((area, index) => areas.slice(index + 1).every(other =>
        Math.min(area.right, other.right) - Math.max(area.left, other.left) < 1 ||
        Math.min(area.bottom, other.bottom) - Math.max(area.top, other.top) < 1));
      const screens = Array.from(scene.querySelectorAll('.officina-screen'), screen => {
        const bounds = screen.getBoundingClientRect();
        const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
        return [screen.dataset.role, hit?.closest(selectors)?.dataset.role, !!hit?.closest('.officina-desk-label')];
      });
      return {separated, areas: areas.length, screens};
    });
    assert.equal(rooms.areas, 7);
    assert.equal(rooms.separated, true);
    assert.equal(rooms.screens.length, 8);
    assert.deepEqual(rooms.screens.filter(([role, hit, covered]) => role !== hit || covered), []);
  };
  await assertRoomTargets();
  const measureWindow = () => app.evaluate(({BrowserWindow, screen}) => {
    const window = BrowserWindow.getAllWindows()[0];
    return {bounds: window.getBounds(), display: screen.getDisplayMatching(window.getBounds()).bounds,
      fullscreen: window.isFullScreen()};
  });
  const windowed = await measureWindow();
  const viewport = await page.evaluate(() => [innerWidth, innerHeight]);
  const showFullscreen = page.getByRole('button', {name: 'Pantalla completa', exact: true});
  const exitFullscreen = page.getByRole('button', {name: 'Salir de pantalla completa', exact: true});
  const fullscreenState = expected => page.waitForFunction(expected =>
    document.querySelector('.officina-stage')?.matches(':fullscreen') === expected, expected);
  await showFullscreen.click();
  await fullscreenState(true);
  await exitFullscreen.waitFor();
  await page.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, windowed.display);
  const fullscreen = await measureWindow();
  assert.equal(fullscreen.fullscreen, true);
  assert.deepEqual(fullscreen.bounds, windowed.display);
  const dimension = await scene.boundingBox();
  assert.ok(Math.abs(dimension.width / dimension.height - 1.2) < .003);
  const available = Math.min(fullscreen.display.width, fullscreen.display.height * 1.2);
  assert.ok(Math.abs(dimension.width - available) < 2);
  const stage = page.locator('.officina-stage');
  assert.match(await stage.evaluate(node => getComputedStyle(node, '::before').backgroundImage), /officina-office-rooms/);
  await assertRoomTargets();
  await page.screenshot({path: resolve(evidence, 'officina-pantalla-completa.png')});
  const narrowViewport = await page.context().newCDPSession(page);
  try {
    await narrowViewport.send('Emulation.setDeviceMetricsOverride', {width: 360, height: 780, deviceScaleFactor: 1, mobile: false});
    await page.waitForFunction(() => innerWidth === 360 && innerHeight === 780);
    await fullscreenState(true);
    const narrowScene = await scene.boundingBox();
    assert.ok(Math.abs(narrowScene.width - 360) < 2 && Math.abs(narrowScene.height - 300) < 2);
    await assertRoomTargets();
    await exitFullscreen.click({trial: true});
    await page.screenshot({path: resolve(evidence, 'officina-pantalla-completa-estrecha.png')});
  } finally {
    await narrowViewport.send('Emulation.clearDeviceMetricsOverride');
    await narrowViewport.detach();
  }
  await page.keyboard.press('Escape');
  await fullscreenState(false);
  await page.waitForFunction(([width, height]) => innerWidth === width && innerHeight === height, viewport);
  assert.deepEqual(await measureWindow(), windowed);
  await showFullscreen.waitFor();
  await page.waitForFunction(() => document.activeElement?.classList.contains('officina-fullscreen-button'));
  await showFullscreen.click();
  await exitFullscreen.click();
  await fullscreenState(false);
  await page.waitForFunction(([width, height]) => innerWidth === width && innerHeight === height, viewport);
  assert.deepEqual(await measureWindow(), windowed);
  const discontinuities = await page.locator('.officina-screens').evaluate(layer => {
    const failures = [];
    const numbers = value => (value.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    const close = (before, after) => {
      if (before === after) return true;
      const first = numbers(before), second = numbers(after);
      return first.length > 0 && first.length === second.length &&
        first.every((number, index) => Math.abs(number - second[index]) < .05);
    };
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
      if (target.matches('.officina-code-reel, .officina-test-reel, .officina-observer-reel')) {
        const horizontal = target.classList.contains('officina-observer-reel');
        const pageSize = Number.parseFloat(getComputedStyle(target.firstElementChild)[horizontal ? 'width' : 'height']);
        const axis = horizontal ? 'm41' : 'm42';
        const shift = new DOMMatrix(after.transform)[axis] - new DOMMatrix(before.transform)[axis];
        if (Math.abs(shift - pageSize) > .05) failures.push(animation.animationName);
      } else if (Math.abs(before.opacity - after.opacity) > .01 ||
        before.position.some((value, index) => !close(value, after.position[index]))) {
        failures.push(animation.animationName);
      }
    }
    return failures;
  });
  assert.deepEqual(discontinuities, [], 'Los ciclos de pantalla deben enlazar sus fotogramas');
  await scene.evaluate(async scene => {
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
      animation.currentTime = duration * 1.13 + delay;
    }
  });
  await scene.screenshot({path: resolve(evidence, 'officina-pantallas.png')});
  const coffee = await scene.evaluate(async scene => {
    await scene.querySelector('.officina-observer-coffee').decode();
    const frames = [...scene.querySelectorAll('[data-coffee]')];
    for (const animation of scene.querySelector('.officina-idle-scene').getAnimations({subtree: true})) {
      const {duration, delay} = animation.effect.getTiming();
      animation.currentTime = duration * 1.38 + delay;
    }
    return frames.map(frame => {
      const animation = frame.getAnimations().find(candidate => candidate.animationName === 'officina-coffee-sip');
      const {duration, delay} = animation.effect.getTiming();
      animation.pause();
      const sample = phase => {
        animation.currentTime = duration * (1 + phase) + delay;
        return Number(getComputedStyle(frame).opacity);
      };
      const opacity = [.002, .47, .57, .71, .998].map(sample);
      sample(['developer', 'tester', 'observer'].includes(frame.dataset.coffee) ? .57 : .38);
      return {role: frame.dataset.coffee, duration, delay, opacity};
    });
  });
  assert.deepEqual(coffee.map(frame => frame.role), ['analyst', 'architect', 'developer', 'tester', 'alm', 'observer']);
  assert.ok(coffee.every(frame => frame.duration >= 55_000));
  assert.equal(new Set(coffee.map(frame => frame.delay)).size, coffee.length);
  for (const frame of coffee) assert.deepEqual(frame.opacity, [0, 0, 1, 0, 0], frame.role);
  await scene.screenshot({path: resolve(evidence, 'officina-cafe-en-el-puesto.png')});
  await scene.evaluate(scene => scene.querySelectorAll('.officina-idle-scene, .officina-observer-coffee')
    .forEach(layer => layer.getAnimations({subtree: true}).forEach(animation => animation.play())));
  await page.locator('.officina-desk[data-role=analyst]').click();
  await page.getByRole('button', {name: 'Ficha del puesto'}).click();
  await page.getByRole('dialog').getByText('Mira el móvil cuando está libre.', {exact: false}).waitFor();
  await page.getByRole('dialog').getByRole('button', {name: 'Cerrar ficha'}).click();
  await createTask(page);
  await page.locator('.officina-idle-seat[data-role=developer]').waitFor({state: 'detached'});
  assert.equal(await page.locator('[data-coffee=developer]').count(), 0);
  await analystIdle.waitFor();
  await taskFromBoard(page);
  await record(page, 'architect', {kind: 'decision', text: rule});
  await record(page, 'developer', {kind: 'handoff', to: 'tester', act: false, text: 'Flujo preparado',
    artifact: {version, link: 'dist/gastos.zip', next: 'Verificar permisos'}});
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
    return {opacity: result, elapsed, currentTime, delay, synchronized: motion.getAttribute('dur') === `${delay}ms` &&
      elapsed >= 0 && Math.abs(elapsed * 1000 - currentTime) < 100};
  });
  assert.equal(arrival.synchronized, true, JSON.stringify(arrival));
  assert.deepEqual(arrival.opacity, [0, .85, 0]);
  let dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByText('Registrar actividad', {exact: true}).count(), 0);
  assert.equal(await dialog.locator('.officina-agent-group[open]').count(), 0);
  const deliveryGroup = await openAgent(dialog, 'Desarrollador');
  await deliveryGroup.locator('.officina-event').getByText('dist/gastos.zip', {exact: true}).waitFor();
  const replyTo = await page.evaluate(async () => {
    const result = await window.companion.officina({type: 'read'});
    return result.value.project.events.find(event => event.data.kind === 'handoff').id;
  });
  await record(page, 'tester', {kind: 'qa', replyTo, passed: false,
    text: 'El solicitante todavía puede aprobar.', evidence: 'QA-18'});
  await dialog.getByText('Detalles del encargo', {exact: true}).click();
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
  assert.equal(await page.locator('[data-seated-gesture]').count(), 0);
  await page.locator('.officina-cafe-counter').waitFor();
  assert.equal(await page.locator('[data-coffee]').count(), 0);
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
  await page.locator('.officina-desk-activity').getByRole('button', {name: 'Ver equipo', exact: true}).waitFor();
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
  await dialog.getByRole('table').locator('td[data-column="Estado"]').getByText('Revisado', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Copiar informe'}).click();
  await dialog.getByRole('status').getByText('Copiado', {exact: true}).waitFor();
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
  await browserGoal.locator('.officina-current').getByText('Trabajando en Codex', {exact: true}).waitFor();
  assert.equal(await browserGoal.getByText('El Analista revisará las pestañas abiertas por medio de la extensión de ChatGPT.').count(), 0);
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await page.locator('.officina-signal').waitFor();
  await analystIdle.waitFor({state: 'detached'});
  assert.equal(await screens.count(), 8);
  await page.waitForFunction(() => [...document.querySelectorAll('.officina-screens [data-role=analyst][data-state=working]')]
    .filter(display => display.getAnimations({subtree: true}).some(animation => animation.playbackRate > 1)).length === 2);
  await page.locator('.officina-idle-seat[data-role=developer]').waitFor();
  const analyst = page.locator('.officina-team-list button[data-role=analyst]');
  const coordination = page.locator('.officina-team-list button[data-role=coordinator]');
  await analyst.getByText('Trabajando en Codex', {exact: true}).waitFor();
  const workColor = await page.locator('.officina').evaluate(root => {
    const style = (selector, property) => getComputedStyle(root.querySelector(selector))[property];
    return {
      desk: style('.officina-desk[data-role=analyst][data-state=working] .officina-desk-label', 'borderTopColor'),
      list: style('.officina-team-member[data-state=working] .officina-tracking-label', 'color'),
      link: style('.officina-paths path[data-state=working]', 'stroke'),
      selected: style('.officina-team-member[data-selected=true]', 'borderRightColor'),
    };
  });
  assert.deepEqual(workColor, {desk: 'rgb(201, 244, 127)', list: 'rgb(201, 244, 127)',
    link: 'rgb(201, 244, 127)', selected: 'rgba(105, 236, 255, 0.604)'});
  await page.locator('.officina').screenshot({path: resolve(evidence, 'officina-trabajando-verde.png')});
  assert.equal(await coordination.count(), 1);
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await browserGoal.getByText('Objetivo de prueba completado.', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await analystIdle.waitFor();
  await page.waitForFunction(() => {
    const animations = document.querySelector('.officina-analysis-screen[data-state=done]')?.getAnimations({subtree: true});
    return animations?.length && animations.every(animation => animation.playbackRate > 0 && animation.playbackRate < 1);
  });
  assert.equal(await page.locator('.officina-board-pointer').evaluate(async cursor => {
    const before = cursor.getAnimations()[0].currentTime;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return cursor.getAnimations()[0].currentTime > before;
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
  const browserLimitation = limitedGoal.getByText('El navegador de prueba devolvió una lista vacía de pestañas.', {exact: true});
  await browserLimitation.waitFor();
  assert.equal(await browserLimitation.count(), 1);
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await analyst.getByText('Cerrado con limitaciones', {exact: true}).waitFor();
  assert.equal(await page.getByText(/^(?:Decisión|Aprobación) pendiente$/).count(), 0);
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  const chatTasks = page.getByRole('combobox', {name: 'Encargo de Officina'});
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
  await page.locator('.officina-desk-activity').getByRole('button', {name: 'Ver equipo', exact: true}).waitFor();
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
  await team.getByRole('button', {name: 'Ver equipo', exact: true}).click();
  const summary = dialog.getByRole('region', {name: 'Equipo del encargo'});
  assert.deepEqual(await summary.locator('.officina-agent-summary strong').allTextContents(), ['Coordinación', 'Analista funcional']);
  assert.equal(await summary.locator('.officina-agent-group[open]').count(), 0);
  await dialog.screenshot({path: resolve(evidence, 'officina-resumen-equipo.png')});
  const coordinationGroup = await openAgent(dialog, 'Coordinación');
  assert.equal(await coordinationGroup.locator('.officina-result-fold:not([open])').count(), 2);
  const analystGroup = await openAgent(dialog, 'Analista funcional');
  await analystGroup.getByRole('heading', {name: 'Opinión del Analista'}).waitFor();
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
    await checkCoordinationWidth(page, width);
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
  const originalWindow = await app.evaluate(({BrowserWindow}) => {
    const window = BrowserWindow.getAllWindows()[0];
    const original = {minimum: window.getMinimumSize(), size: window.getContentSize()};
    window.setMinimumSize(0, 0);
    window.setContentSize(320, original.size[1]);
    return original;
  });
  await page.waitForFunction(() => innerWidth === 320);
  assert.ok(await chatRecipient.evaluate(select => {
    const box = select.getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.width >= 120;
  }));
  await page.locator('.officina-chat-compose').screenshot({path: resolve(evidence, 'officina-destinatario-320.png')});
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  const mapToggle = page.getByRole('button', {name: 'Ver mapa'});
  await mapToggle.waitFor();
  const map = page.locator('.officina-scene');
  await map.waitFor({state: 'hidden'});
  assert.ok(await page.locator('.officina-team').evaluate(team =>
    team.getBoundingClientRect().top < document.querySelector('.officina-map-toggle').getBoundingClientRect().top));
  await mapToggle.press('Enter');
  await map.waitFor({state: 'visible'});
  const narrowTester = map.locator('.officina-desk[data-role=tester]');
  await narrowTester.press('Enter');
  await narrowTester.press('Escape');
  await map.waitFor({state: 'hidden'});
  assert.ok(await mapToggle.evaluate(button => button === document.activeElement));
  assert.equal(await testerCard.getAttribute('aria-pressed'), 'true');
  await coordination.click();
  await checkCoordinationWidth(page, 320);
  await testerCard.click();
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await app.evaluate(({BrowserWindow}, original) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.setContentSize(...original.size);
    window.setMinimumSize(...original.minimum);
  }, originalWindow);
  await page.waitForFunction(width => innerWidth === width, originalWindow.size[0]);
  await chatRecipient.selectOption('analyst');
  await page.getByRole('button', {name: 'Enviar a Analista funcional', exact: true}).waitFor();
  await chatRecipient.selectOption('tester');
  assert.equal(await composer.inputValue(), 'Comprueba el destinatario del encargo.');
  await page.getByRole('button', {name: 'Enviar a QA de aplicaciones', exact: true}).click();
  const direct = page.locator('.officina-goal').filter({hasText: 'Comprueba el destinatario del encargo.'});
  await direct.waitFor();
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await analyst.getByText(/^(En espera|Sin participación)$/).waitFor();
  assert.equal(await resultFor('Analista funcional').count(), 0);
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await direct.getByText('Objetivo completado', {exact: true}).waitFor();
  const sent = await readBoard();
  const directGoal = sent.goals.find(goal => goal.task !== reviewTask);
  assert.equal(sent.id, before.id);
  assert.equal(directGoal.recipient, 'tester');
  assert.equal(directGoal.phase, 'complete');
  const directRuns = sent.runs.filter(run => run.task === directGoal.task);
  assert.deepEqual(directRuns.map(run => [run.role, run.destination.thread]), [['tester', sent.team.threads.tester]]);
  const resultOrigin = direct.getByRole('button', {name: /^Ver mensaje de QA de aplicaciones/});
  await resultOrigin.click();
  await dialog.getByRole('table').getByRole('cell', {name: 'Correcto'}).waitFor();
  await dialog.getByText('Destino confirmado.', {exact: true}).waitFor();
  assert.deepEqual(await readBoard(), sent);
  await page.keyboard.press('Escape');
  await dialog.waitFor({state: 'hidden'});
  assert.ok(await resultOrigin.evaluate(node => node === document.activeElement));
  assert.deepEqual(sent.profiles.tester, {name: 'QA de aplicaciones', prompt: customPrompt});
  await chatTasks.selectOption(reviewTask);
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await analyst.getByText('Análisis listo', {exact: true}).waitFor();
  assert.equal(await resultFor('QA de aplicaciones').count(), 0);
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  assert.equal(await chatTasks.inputValue(), reviewTask);
  await page.locator('.officina-goal').getByText(reviewRequest, {exact: true}).waitFor();
  await chatTasks.selectOption(directGoal.task);
  await direct.waitFor();

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
  await pastedGoal.getByText('Objetivo completado', {exact: true}).waitFor();
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
    return Math.abs((box.left + box.width / 2 - scene.left) / scene.width - .5555) < .005 &&
      Math.abs((box.top - scene.top) / scene.height - .112) < .005 && box.left <= station.left && box.right >= station.right &&
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
    return animations?.length && animations.every(animation => animation.playbackRate > 0 && animation.playbackRate < 1);
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
  await page.locator('.officina-desk-activity').getByRole('button', {name: 'Ver equipo', exact: true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Detalles del encargo', {exact: true}).click();
  await dialog.getByText('QA bloqueó 1.0.4', {exact: true}).waitFor();
  const testerGroup = await openAgent(dialog, 'Tester');
  await testerGroup.getByText('QA-18', {exact: false}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await selector.selectOption({label: 'Inventario'});
  await page.locator('.officina-desk-activity').getByText('Sin encargos para este puesto.').waitFor();
  assert.equal(await page.locator('.officina-desk-activity').getByText('Último traspaso', {exact: false}).count(), 0);
  await selector.selectOption({label: 'Coordinación de prueba'});
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await page.getByRole('combobox', {name: 'Encargo de Officina'}).selectOption({label: 'Define la regla de aprobación de un gasto ficticio.'});
  await page.getByText('Objetivo de prueba completado.', {exact: true}).last().waitFor();
  await selector.selectOption({label: 'Proyecto sintético'});
  await page.getByText('Carpeta de trabajo · Proyecto sintético').waitFor();
  await page.locator('.officina-chat').getByText('Evidencia de subcarpeta / Evidencia del archivo adjunto', {exact: true}).waitFor();
  await selector.selectOption({label: 'Revisión de ZeN'});
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await page.locator('.officina-team-select[data-role=observer]').click();
  await page.getByRole('button', {name: /Ver revisiones|Ver propuestas/}).click();
  await dialog.getByText('Prompt aplicado', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  assert.equal(await page.locator('.officina-team-list').getByRole('button', {name: 'Ver resultado de Analista funcional'}).count(), 0);
  await page.getByRole('combobox', {name: 'Encargo de Officina'}).selectOption({label: 'Analiza el proyecto y dime qué opinas.'});
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
  await dialog.getByText('Detalles del encargo', {exact: true}).click();
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
  await page.locator('.officina-goal').getByText('Cerrado con limitaciones', {exact: true}).waitFor();
  assert.equal(await page.getByText('ZEN detectó una incidencia', {exact: true}).count(), 0);
  assert.ok(!(await page.locator('.officina-goal .officina-chat-author strong').allTextContents()).includes('Officina'));
  const board = await page.evaluate(async () => (await window.companion.officina({type: 'read'})).value.project);
  assert.deepEqual(board.runs.map(run => [run.role, run.state]), [['developer', 'completed'], ['tester', 'completed']]);
  assert.equal(board.team.threads.observer, undefined);
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  const zenMember = page.locator('.officina-team-member').filter({has: page.locator('[data-role=observer]')});
  await zenMember.locator('[data-role=observer]').click();
  await page.getByRole('button', {name: 'Ver propuestas (1)'}).click();
  await dialog.getByRole('heading', {name: 'Preparar una comprobación independiente de la entrega'}).waitFor();
  await dialog.getByText(/La interacción quedó pendiente/).waitFor();
  await dialog.getByRole('button', {name: 'Abrir turno en Codex'}).waitFor();
  await dialog.getByRole('button', {name: 'Aprobar e iniciar seguimiento'}).click();
  await dialog.getByText('Recomendación aprobada', {exact: true}).waitFor();
  await dialog.getByText('ZEN · Trabajando en Codex', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await zenMember.getByText('Seguimiento listo', {exact: true}).waitFor();
  assert.equal(await page.getByText('Seguimiento listo', {exact: true}).count(), 1);
  await zenMember.getByRole('button', {name: 'Ver seguimiento'}).click();
  await dialog.getByText('Ver resultado de ZEN', {exact: true}).waitFor();
  await dialog.getByRole('button', {name: 'Cerrar ficha'}).click();
  await zenMember.locator('[data-role=observer]').click();
  await page.getByRole('checkbox', {name: 'Mejoras automáticas', exact: false}).check();
  await page.waitForFunction(async () => (await window.companion.officina({type: 'read'})).value.project.goals.some(goal => goal.improvement));
  assert.equal(await page.getByRole('region', {name: 'Mejora automática de ZEN'}).count(), 0);
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  assert.equal(await page.getByRole('region', {name: 'Mejora automática de ZEN'}).count(), 0);
  await page.locator('.officina-goal').getByText('Verifica el traspaso de laboratorio.', {exact: true}).waitFor();

  const removable = 'Proyecto para eliminar';
  await createProject(page, removable);
  const removalId = await selector.inputValue();
  await page.getByText('Opciones del proyecto', {exact: true}).click();
  await page.getByRole('button', {name: 'Eliminar proyecto', exact: true}).click();
  await dialog.getByRole('heading', {name: 'Eliminar proyecto de Officina'}).waitFor();
  await dialog.getByText(/Proyecto para eliminar/).waitFor();
  await dialog.getByText(/Se conservarán el proyecto y sus chats en Codex/).waitFor();
  await dialog.getByRole('button', {name: 'Cancelar', exact: true}).click();
  assert.equal(await selector.inputValue(), removalId);
  await page.getByRole('button', {name: 'Equipo', exact: true}).click();
  await page.getByText('Opciones del proyecto', {exact: true}).click();
  await page.getByRole('button', {name: 'Eliminar proyecto', exact: true}).click();
  await dialog.getByRole('button', {name: 'Eliminar de Officina', exact: true}).click();
  await dialog.waitFor({state: 'hidden'});
  assert.equal(await selector.locator('option:checked').textContent(), 'Incidencia de laboratorio');
  assert.equal(await selector.locator('option').filter({hasText: removable}).count(), 0);
  await page.evaluate(async () => {
    const bridge = window.companion;
    const current = await bridge.officina({type: 'read'});
    const project = current.value.project.id;
    const paused = await bridge.officina({type: 'queue', project, enabled: false});
    if (!paused.ok) throw Error(paused.error);
    const queued = await bridge.officina({type: 'task', project, dispatch: true, fields: {
      owner: 'analyst', title: 'Comprobación de cola', objective: 'Comprobar activación manual', criteria: 'Turno pendiente',
    }});
    if (!queued.ok) throw Error(queued.error);
  });
  const activateQueue = page.locator('.officina-compose-queue').getByRole('button', {name: 'Activar cola'});
  await activateQueue.click();
  await activateQueue.waitFor({state: 'hidden'});

  await createProject(page, 'Imágenes y teclado');
  await page.getByRole('button', {name: 'Chat global', exact: true}).click();
  await page.getByRole('combobox', {name: 'Destinatario del encargo'}).selectOption('tester');
  const composer = page.getByRole('textbox', {name: 'Objetivo'});
  await composer.fill('Revisa la captura.');
  await composer.press('End');
  await composer.press('Shift+Enter');
  await page.keyboard.insertText('Comprueba el segundo punto.');
  assert.equal(await composer.inputValue(), 'Revisa la captura.\nComprueba el segundo punto.');
  const attach = event => composer.evaluate(async (field, event) => {
    const sample = document.createElement('canvas');
    sample.width = sample.height = 32;
    const context = sample.getContext('2d');
    context.fillStyle = '#1ab3c3';
    context.fillRect(0, 0, 32, 32);
    const image = await new Promise(resolve => sample.toBlob(resolve, 'image/png'));
    const data = new DataTransfer();
    data.items.add(new File([image], 'captura.png', {type: 'image/png'}));
    if (event === 'paste') field.dispatchEvent(new ClipboardEvent(event, {clipboardData: data, bubbles: true, cancelable: true}));
    else field.dispatchEvent(new DragEvent(event, {dataTransfer: data, bubbles: true, cancelable: true}));
  }, event);
  const preview = page.getByRole('img', {name: 'Imagen adjunta 1'});
  await attach('paste');
  await preview.waitFor();
  await page.getByRole('button', {name: 'Quitar imagen 1'}).click();
  await preview.waitFor({state: 'detached'});
  await attach('paste');
  await preview.waitFor();
  await page.locator('.officina-chat-compose').screenshot({path: resolve(evidence, 'officina-compositor-imagen.png')});
  await composer.press('Enter');
  const imageGoal = page.locator('.officina-goal').filter({hasText: 'Revisa la captura.'});
  await imageGoal.getByText('Captura recibida por Tester.', {exact: true}).waitFor();
  await imageGoal.getByRole('list', {name: 'Imágenes adjuntas'}).getByRole('button', {name: 'Imagen 1.jpg'}).waitFor();
  assert.equal(await imageGoal.locator('.officina-chat-row[data-from=human] .officina-chat-message p').textContent(),
    'Revisa la captura.\nComprueba el segundo punto.');
  assert.equal(await composer.inputValue(), '');
  await preview.waitFor({state: 'detached'});

  await attach('drop');
  await preview.waitFor();
  await composer.press('Enter');
  await page.locator('.officina-goal').filter({hasText: 'Analiza las imágenes adjuntas.'})
    .getByText('Captura recibida por Tester.', {exact: true}).waitFor();
});

console.log(JSON.stringify({officina: true, evidence, restarted: true, projectIsolation: true, liveCodex: false}));
