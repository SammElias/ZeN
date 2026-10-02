import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { ModeSchema, ProfileSchema, type Profile, type ResponseMode } from '../shared/personal';
import type { TaskEvent } from '../shared/contracts';
import { ZenError } from '../shared/errors';
import {FavoriteSchema,type Favorite} from '../shared/workspace';
import {z} from 'zod';
export class PersonalStore {
  constructor(private directory: string) { mkdirSync(directory, { recursive: true }); }
  private read(name: string, fallback: unknown): unknown {
    const path = join(this.directory, name);
    if (!existsSync(path)) return fallback;
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { throw new ZenError(`Datos locales dañados: ${name}. No se sobrescriben.`); }
  }
  private write(name: string, data: unknown) { const path = join(this.directory, name); writeFileSync(path + '.tmp', JSON.stringify(data, null, 2), { mode: 0o600 }); renameSync(path + '.tmp', path); }
  profile(): Profile { return ProfileSchema.parse(this.read('profile.json', [])); }
  saveProfile(profile: Profile) { this.write('profile.json', ProfileSchema.parse(profile)); }
  mode(): ResponseMode { return ModeSchema.parse(this.read('mode.json', { response: 'auto', meeting: false })); }
  saveMode(mode: ResponseMode) { this.write('mode.json', ModeSchema.parse(mode)); }
  favorites():Favorite[]{return z.array(FavoriteSchema).max(20).parse(this.read('favorites.json',[
    {id:'10000000-0000-4000-8000-000000000001',label:'Explicar un error',prompt:'Explica este error y los pasos para resolverlo.'},
    {id:'10000000-0000-4000-8000-000000000002',label:'Documentar un flujo',prompt:'Describe el flujo de esta referencia: propósito, entradas, pasos y posibles fallos.'},
    {id:'10000000-0000-4000-8000-000000000003',label:'Analizar una carpeta',prompt:'Analiza la carpeta adjunta y explica su estructura y las mejoras más importantes.'}
  ]));}
  saveFavorites(rows:Favorite[]){const parsed=z.array(FavoriteSchema).max(20).parse(rows);if(new Set(parsed.map(row=>row.id)).size!==parsed.length)throw new ZenError('Hay favoritos duplicados.');this.write('favorites.json',parsed);return parsed;}
  tasks(): TaskEvent[] {
    const raw = this.read('tasks.json', []);
    if (!Array.isArray(raw)) throw new ZenError('Historial de tareas dañado.');
    return raw.slice(-100).filter((row): row is TaskEvent => row && typeof row.id === 'string' && typeof row.message === 'string' && ['idle', 'queued', 'listening', 'thinking', 'awaiting_approval', 'awaiting_input', 'executing', 'completed', 'failed', 'cancelled'].includes(row.state));
  }
  recover() { const tasks = this.tasks().map(row => (['queued', 'thinking', 'executing', 'awaiting_approval'].includes(row.state) || row.workContext?.phase === 'review') ? { ...row, ...(row.workContext?{workContext:{owner:'codex' as const,phase:'incomplete' as const}}:{}), state: 'failed' as const, paused:false, message: 'Tarea interrumpida por cierre o reinicio. No se reanuda ni se repiten acciones automáticamente.' } : row); this.write('tasks.json', tasks); }
  task(event: TaskEvent) { if (event.id === 'voice' || event.id === 'storage' || event.streamText !== undefined) return; const tasks = this.tasks().filter(row => row.id !== event.id); const persisted = event.approval ? { ...event, approval: { ...event.approval, content: undefined } } : event; this.write('tasks.json', [...tasks, persisted].slice(-100)); }
}
