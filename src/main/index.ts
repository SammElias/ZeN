import { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, ipcMain, safeStorage, session } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import OpenAI from 'openai';
import { z } from 'zod';
import { Store } from '../storage/store';
import { SettingsSchema, RequestSchema, type Settings } from '../shared/contracts';
import { diagnose, ZenError } from '../shared/errors';
import { Orchestrator } from '../agent/orchestrator';
import { VoiceBackend } from '../agent/voice';
import { openNotepad } from '../tools/windows/notepad';
let window: BrowserWindow;
let tray: Tray;
let quitting = false;
let shortcutRegistered = false;
app.setName('ZEN');
if (!app.requestSingleInstanceLock()) app.quit();
else {
app.on('second-instance', () => { window?.show(); window?.focus(); });
void app.whenReady().then(async () => {
  const smoke = process.argv.includes('--zen-smoke');
  const store = new Store(smoke ? join(app.getPath('temp'), 'zen-electron-smoke') : app.getPath('userData'), safeStorage);
  let settings = store.settings();
  const emit = (event: Parameters<NonNullable<import('../shared/contracts').ZenBridge['onTask']>>[0] extends (e: infer E) => void ? E : never) => { if (!window?.isDestroyed()) window?.webContents.send('zen:task', event); };
  const log = (row: Record<string, unknown>) => { try { store.log(row); } catch { emit({ id: 'storage', state: 'failed', message: 'No se pudo escribir el registro local.' }); } };
  const orchestrator = new Orchestrator({ client: () => new OpenAI({ apiKey: store.key(), maxRetries: 0, timeout: settings.taskTimeoutMs }), settings: () => settings, execute: signal => openNotepad(join(__dirname, 'tools/notepad.ps1'), signal), emit, log });
  const voice = new VoiceBackend({ key: () => store.key(), settings: () => settings, orchestrator, log, emit });
  const rendererPath = join(__dirname, 'renderer/index.html');
  const rendererUrl = pathToFileURL(rendererPath).href;
  const invoke = () => { window.show(); window.focus(); window.webContents.send('zen:invoke'); };
  const register = (next: string) => {
    if (next === settings.shortcut && shortcutRegistered) return true;
    if (!globalShortcut.register(next, invoke)) return false;
    if (shortcutRegistered) globalShortcut.unregister(settings.shortcut);
    shortcutRegistered = true;
    return true;
  };
  shortcutRegistered = register(settings.shortcut);
  window = new BrowserWindow({ width: 1000, height: 780, minWidth: 680, minHeight: 620, show: !smoke, backgroundColor: '#101819', webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== rendererUrl) event.preventDefault(); });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(contents === window.webContents && details.requestingUrl === rendererUrl && permission === 'media' && settings.voiceConsent && 'mediaTypes' in details && !!details.mediaTypes?.length && details.mediaTypes.every((type: string) => type === 'audio')));
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) => contents === window.webContents && permission === 'media' && settings.voiceConsent && details.mediaType === 'audio');
  const publicSettings = () => ({ settings, hasKey: store.hasKey(), shortcutRegistered, protectedStorage: store.protectedStorage() });
  function handle(name: string, schema: z.ZodType, action: (value: any) => unknown) {
    ipcMain.handle(`zen:${name}`, async (event, raw) => {
      try {
        if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== rendererUrl) throw new ZenError('Origen IPC no autorizado.');
        const parsed = schema.safeParse(raw);
        if (!parsed.success) throw new ZenError('Datos IPC inválidos.');
        return { ok: true, value: await action(parsed.data) };
      } catch (error) { return { ok: false, error: diagnose(error) }; }
    });
  }
  const noArg = z.undefined();
  const ensureIdle = () => { if (orchestrator.busy || voice.active) throw new ZenError('Detén la tarea y la voz antes de cambiar la configuración.'); };
  handle('settings', noArg, publicSettings);
  handle('save-settings', SettingsSchema, (next: Settings) => {
    ensureIdle();
    if (!register(next.shortcut)) throw new ZenError('Ese atajo no está disponible. Se conserva el anterior.');
    try { store.saveSettings(next); } catch { if (next.shortcut !== settings.shortcut) { globalShortcut.unregister(next.shortcut); shortcutRegistered = globalShortcut.register(settings.shortcut, invoke); } throw new ZenError('No se pudo guardar la configuración.'); }
    settings = next; return publicSettings();
  });
  handle('save-key', z.string().trim().min(20).max(512), (key: string) => { ensureIdle(); store.saveKey(key); return true; });
  handle('delete-key', noArg, () => { ensureIdle(); store.deleteKey(); return true; });
  handle('run', RequestSchema, ({ text, requestId }) => { if (voice.active) throw new ZenError('Desconecta la voz antes de usar el chat de texto.'); return orchestrator.run(text, requestId); });
  handle('stop', noArg, async () => { orchestrator.stop(); await voice.stop(); return true; });
  handle('voice-start', z.string().min(20).max(65536).refine(value => value.startsWith('v=0')), (sdp: string) => voice.start(sdp));
  handle('voice-end', z.string().regex(/^rtc_[a-zA-Z0-9_-]+$/), async () => { await voice.stop(); return true; });
  handle('clear-logs', noArg, () => { ensureIdle(); store.clearLogs(); return true; });
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFUlEQVQ4T2Nk+P//PwMlgImBQjDwHAAA2n4DHd9rF1gAAAAASUVORK5CYII=');
  tray = new Tray(icon); tray.setToolTip('ZEN · Disponible');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Abrir ZEN', click: () => { window.show(); window.focus(); } }, { label: 'Conversar por voz', click: invoke }, { label: 'Detener', click: () => { orchestrator.stop(); void voice.stop(); window.webContents.send('zen:task', { id: 'voice', state: 'cancelled', message: 'Sesión detenida desde la bandeja.' }); } }, { type: 'separator' }, { label: 'Salir', click: () => app.quit() }]));
  tray.on('double-click', () => { window.show(); window.focus(); });
  window.on('close', event => { if (!quitting) { event.preventDefault(); window.hide(); orchestrator.stop(); void voice.stop(); window.webContents.send('zen:task', { id: 'voice', state: 'cancelled', message: 'Ventana oculta; micrófono desconectado.' }); } });
  app.on('before-quit', () => { quitting = true; orchestrator.stop(); void voice.stop(); });
  await window.loadFile(rendererPath);
  if (smoke) {
    const result = await window.webContents.executeJavaScript(`(async () => ({ bridge: typeof window.zen?.run === 'function', nodeAbsent: typeof require === 'undefined', rendered: document.body.innerText.includes('ZEN'), settings: await window.zen.settings() }))()`);
    const protectedRoundTrip = store.protectedStorage() && (() => { store.saveKey('smoke-dummy-not-a-real-api-key'); const match = store.key() === 'smoke-dummy-not-a-real-api-key'; store.deleteKey(); return match; })();
    const invalidIpc = await window.webContents.executeJavaScript(`window.zen.run({text:'Abre el Bloc de notas',requestId:'invalid',command:'cmd'})`);
    console.log(JSON.stringify({ ...result, protectedRoundTrip, shortcutRegistered, trayCreated: !tray.isDestroyed(), invalidIpcBlocked: !invalidIpc.ok }));
    app.quit();
  }
}).catch(error => { console.error('ZEN no pudo iniciarse. Revisa configuración, almacenamiento y dependencias.'); if (process.argv.includes('--zen-smoke')) console.error(error.message); app.exit(1); });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {});
}
