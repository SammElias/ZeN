import assert from 'node:assert/strict';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const folder = fileURLToPath(new URL('../', import.meta.url));
const evidence = resolve('release/archify-diagrams/visual');
await mkdir(evidence, {recursive: true});
const browser = await chromium.launch({channel: process.env.ARCHIFY_CHROME ? undefined : 'chrome',
  executablePath: process.env.ARCHIFY_CHROME});
try {
  const names = (await readdir(new URL('./', import.meta.url))).filter(name => name.endsWith('.json'))
    .map(name => name.slice(0, -5));
  for (const name of [...names, 'index']) {
    const url = pathToFileURL(resolve(folder, name + '.html')).href;
    for (const width of [1440, 390]) {
      const context = await browser.newContext({offline: true, colorScheme: 'light', reducedMotion: 'reduce',
        viewport: {width, height: 900}});
      const page = await context.newPage();
      const errors = [];
      const remote = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (/^https?:/u.test(request.url())) remote.push(request.url());
      });
      await page.goto(url);
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', name);
      await page.reload();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', name);
      if (name !== 'index') {
        await page.locator('svg[data-preset="signal-flow"][data-animation="trace"]').first().waitFor();
        if (width === 390) {
          assert.ok(await page.locator('.diagram-container').evaluate(container =>
            container.querySelector('svg').getBoundingClientRect().width <= container.clientWidth), name);
        }
      }
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name);
      if (name !== 'index') {
        const navigation = page.locator('.diagram-nav');
        const clipped = await navigation.evaluate(bar => {
          const bounds = bar.getBoundingClientRect();
          const canvas = bar.closest('.diagram-container').getBoundingClientRect();
          return [...bar.querySelectorAll('button')].filter(button => {
            if (!button.checkVisibility()) return false;
            const rect = button.getBoundingClientRect();
            return rect.left < Math.max(bounds.left, canvas.left) ||
              rect.right > Math.min(bounds.right, canvas.right) ||
              rect.top < Math.max(bounds.top, canvas.top) ||
              rect.bottom > Math.min(bounds.bottom, canvas.bottom);
          }).map(button => button.getAttribute('aria-label'));
        });
        assert.deepEqual(clipped, [], name + ' a ' + width + ' px');
        for (const button of await page.locator('.diagram-nav button:visible:enabled, .toolbar > button:visible:enabled').all()) {
          await button.click({trial: true});
        }
        const zoom = page.locator('[data-view-percent]');
        const initialZoom = await zoom.textContent();
        await page.locator('[data-view="in"]').press('Enter');
        assert.notEqual(await zoom.textContent(), initialZoom, name);
        await page.locator('[data-view="reset"]').click();
      }
      await page.screenshot({path: resolve(evidence, name + '-' + width + '.png')});
      if (name === 'index') {
        for (const link of await page.locator('a').all()) {
          const target = new URL(await link.getAttribute('href'), url);
          await readFile(target);
        }
      }
      if (width === 1440 && name !== 'index') {
        const node = page.locator('svg [data-node-id][tabindex="0"]').first();
        await node.press('Enter');
        await page.locator('#focus-chip').waitFor({state: 'visible'});
        await page.locator('#btn-focus-clear').click();
        await page.locator('#btn-export').click();
        const download = page.waitForEvent('download');
        await page.locator('[data-format="svg-dark"]').click();
        const path = resolve(folder, name + '.svg');
        await (await download).saveAs(path);
        const svg = (await readFile(path, 'utf8')).replace(/\s*@font-face\s*\{[^{}]*\}\s*/gu, '\n').replace(/[ \t]+$/gm, '');
        await writeFile(path, svg, 'utf8');
        assert.match(svg, /<svg\b[^>]*data-theme="dark"/u);
        assert.match(svg, /<svg\b[^>]*data-preset="signal-flow"/u);
        await page.goto(pathToFileURL(path).href);
        assert.equal(await page.locator('parsererror').count(), 0);
        await page.locator('svg[data-theme="dark"]').first().waitFor();
        await page.screenshot({path: resolve(evidence, name + '-svg.png')});
      }
      assert.deepEqual(errors, [], name);
      assert.deepEqual(remote, [], name);
      await context.close();
    }
    console.log(name + ': tema oscuro, recarga y escritorio/móvil sin red');
  }
} finally {
  await browser.close();
}
