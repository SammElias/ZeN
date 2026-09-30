import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { SettingsSchema, type Settings } from '../shared/contracts';
import { ZenError } from '../shared/errors';
type Protection = { isEncryptionAvailable(): boolean; encryptString(value: string): Buffer; decryptString(value: Buffer): string };
export class Store {
  private directory: string;
  constructor(directory: string, private protection: Protection) { this.directory = directory; mkdirSync(directory, { recursive: true }); }
  private path(name: string) { return join(this.directory, name); }
  private write(name: string, value: string | Buffer) { const path = this.path(name); writeFileSync(path + '.tmp', value, { mode: 0o600 }); renameSync(path + '.tmp', path); }
  settings(): Settings {
    if (!existsSync(this.path('settings.json'))) return SettingsSchema.parse({});
    try { const raw = JSON.parse(readFileSync(this.path('settings.json'), 'utf8')); if (raw.costControlsVersion === undefined) { raw.maxConcurrentTasks = 1; raw.maxToolCalls = Math.min(raw.maxToolCalls ?? 4, 4); raw.listenOnInvoke = false; if (raw.voiceModel === 'gpt-realtime-2.1') raw.voiceModel = 'gpt-realtime-2.1-mini'; } return SettingsSchema.parse(raw); }
    catch { throw new ZenError('Configuración local dañada. Revisa settings.json en los datos de ZEN.'); }
  }
  saveSettings(value: Settings) { this.write('settings.json', JSON.stringify(SettingsSchema.parse(value), null, 2)); }
  protectedStorage() { return process.platform === 'win32' && this.protection.isEncryptionAvailable(); }
  hasKey() { return existsSync(this.path('key.bin')); }
  saveKey(value: string) {
    if (!this.protectedStorage()) throw new ZenError('No hay protección de secretos de Windows disponible. No se ha guardado la clave.');
    this.write('key.bin', this.protection.encryptString(value));
  }
  key(): string {
    if (!this.hasKey()) throw new ZenError('Falta una clave API. Introdúcela en Configuración; no uses el chat.');
    if (!this.protectedStorage()) throw new ZenError('El almacenamiento protegido de Windows no está disponible.');
    try { return this.protection.decryptString(readFileSync(this.path('key.bin'))); }
    catch { throw new ZenError('No se pudo descifrar la clave. Vuelve a configurarla en este usuario de Windows.'); }
  }
  deleteKey() { if (this.hasKey()) unlinkSync(this.path('key.bin')); }
  log(metadata: Record<string, unknown>) {
    const path = this.path('execution.json');
    let rows: Record<string, unknown>[] = [];
    try { rows = JSON.parse(readFileSync(path, 'utf8')); } catch {}
    const cutoff = Date.now() - 7 * 86400000;
    rows = rows.filter(row => typeof row.at === 'string' && Date.parse(row.at) >= cutoff).slice(-499);
    rows.push({ at: new Date().toISOString(), ...metadata });
    this.write('execution.json', JSON.stringify(rows, null, 2));
  }
  clearLogs() { this.write('execution.json', '[]'); }
}
