import {PetPositionSchema,type PetPosition} from '../shared/pet';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { SettingsSchema, OverlayPositionSchema, type Settings, type OverlayPosition } from '../shared/contracts';
import { ZenError } from '../shared/errors';
import { z } from 'zod';
import { McpConnectionSchema, type McpConnection, type PublicMcpConnection } from '../shared/mcp';
type Protection = { isEncryptionAvailable(): boolean; encryptString(value: string): Buffer; decryptString(value: Buffer): string };
export class Store {
  private directory: string;
  constructor(directory: string, private protection: Protection) { this.directory = directory; mkdirSync(directory, { recursive: true }); }
  private path(name: string) { return join(this.directory, name); }
  private write(name: string, value: string | Buffer) { const path = this.path(name); writeFileSync(path + '.tmp', value, { mode: 0o600 }); renameSync(path + '.tmp', path); }
  settings(): Settings {
    if (!existsSync(this.path('settings.json'))) return SettingsSchema.parse({});
    try { const raw = JSON.parse(readFileSync(this.path('settings.json'), 'utf8')); if (raw.costControlsVersion === undefined) { raw.maxConcurrentTasks = 1; raw.maxToolCalls = Math.min(raw.maxToolCalls ?? 4, 4); raw.listenOnInvoke = false; } raw.voiceModel='gpt-live-1'; return SettingsSchema.parse(raw); }
    catch { throw new ZenError('Configuración local dañada. Revisa settings.json en los datos de ZEN.'); }
  }
  saveSettings(value: Settings) { this.write('settings.json', JSON.stringify(SettingsSchema.parse(value), null, 2)); }
  libraryRoots(): string[] { if(!existsSync(this.path('library.json')))return [];try{return z.array(z.string().min(3).max(1000)).max(10).parse(JSON.parse(readFileSync(this.path('library.json'),'utf8')));}catch{throw new ZenError('Las carpetas de consulta locales están dañadas.');} }
  saveLibraryRoots(roots:string[]) {this.write('library.json',JSON.stringify(z.array(z.string().min(3).max(1000)).max(10).parse(roots),null,2));}
  mcpConnection(includeToken=false): McpConnection | undefined {
    if(!existsSync(this.path('mcp.json')))return;
    try {const connection=McpConnectionSchema.parse(JSON.parse(readFileSync(this.path('mcp.json'),'utf8')));if(includeToken&&existsSync(this.path('mcp-token.bin'))){if(!this.protectedStorage())throw new Error('Unavailable protection');const secret=z.object({url:z.string(),token:z.string().min(1).max(8000)}).strict().parse(JSON.parse(this.protection.decryptString(readFileSync(this.path('mcp-token.bin')))));if(secret.url!==connection.url)throw new Error('Token/server mismatch');return {...connection,authorization:secret.token};}return connection;}catch{throw new ZenError('La conexión MCP local no pudo verificarse.');}
  }
  publicMcp():PublicMcpConnection|null {const connection=this.mcpConnection();return connection?{...connection,hasToken:existsSync(this.path('mcp-token.bin'))}:null;}
  saveMcp(connection:unknown,token?:string) {
    const parsed=McpConnectionSchema.parse(connection);if(token!==undefined){if(!this.protectedStorage())throw new ZenError('No hay protección de Windows para el token MCP.');this.write('mcp-token.bin',this.protection.encryptString(JSON.stringify({url:parsed.url,token})));}else if(this.publicMcp()?.url!==parsed.url && existsSync(this.path('mcp-token.bin')))unlinkSync(this.path('mcp-token.bin'));
    this.write('mcp.json',JSON.stringify(parsed,null,2));return this.publicMcp();
  }
  deleteMcp(){for(const name of ['mcp.json','mcp-token.bin'])if(existsSync(this.path(name)))unlinkSync(this.path(name));}
  overlayPosition(): OverlayPosition | undefined {
    try { const result = OverlayPositionSchema.safeParse(JSON.parse(readFileSync(this.path('overlay-position.json'), 'utf8'))); return result.success ? result.data : undefined; } catch { return undefined; }
  }
  saveOverlayPosition(value: Pick<OverlayPosition, 'displayId' | 'horizontalRatio'> & Partial<OverlayPosition>) { this.write('overlay-position.json', JSON.stringify(OverlayPositionSchema.parse(value))); }
  petPosition():PetPosition|undefined{try{return PetPositionSchema.parse(JSON.parse(readFileSync(this.path('pet-position.json'),'utf8')));}catch{return undefined;}}
  savePetPosition(value:PetPosition){this.write('pet-position.json',JSON.stringify(PetPositionSchema.parse(value)));}
  claimPetGreeting(){const today=new Date().toLocaleDateString('sv-SE');let previous='';try{previous=readFileSync(this.path('pet-greeting.txt'),'utf8');}catch{}if(previous===today)return false;this.write('pet-greeting.txt',today);return true;}
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
