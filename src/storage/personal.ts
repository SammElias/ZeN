import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { ModeSchema, ProfileSchema, type Profile, type ResponseMode } from '../shared/personal';
import type { TaskEvent } from '../shared/contracts';
import { ZenError } from '../shared/errors';
import {FavoriteSchema,type Favorite} from '../shared/workspace';
import {z} from 'zod';
import {ProjectContextsSchema,initialProjectContexts,type ProjectContexts} from '../shared/project-context';
import {InteractionsSchema,emptyInteractions,type Interactions} from '../shared/interactions';
export class PersonalStore {
  interactions(){return InteractionsSchema.parse(this.read('interactions.json',emptyInteractions));}
  saveInteractions(value:Interactions){const next=InteractionsSchema.parse(value);this.write('interactions.json',next);return next;}
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
  projectContexts():ProjectContexts{return ProjectContextsSchema.parse(this.read('project-contexts.json',initialProjectContexts));}
  saveProjectContexts(value:ProjectContexts){const parsed=ProjectContextsSchema.parse(value);this.write('project-contexts.json',parsed);return parsed;}
  favorites():Favorite[]{return z.array(FavoriteSchema).max(20).parse(this.read('favorites.json',[
    {id:'10000000-0000-4000-8000-000000000001',label:'Explicar un error',prompt:'Explica este error y los pasos para resolverlo.'},
    {id:'10000000-0000-4000-8000-000000000002',label:'Documentar un flujo',prompt:'Describe el flujo de esta referencia: propósito, entradas, pasos y posibles fallos.'},
    {id:'10000000-0000-4000-8000-000000000003',label:'Analizar una carpeta',prompt:'Analiza la carpeta adjunta y explica su estructura y las mejoras más importantes.'},
    {id:'10000000-0000-4000-8000-000000000004',label:'Revisar JS de Dynamics',prompt:'Revisa este JavaScript de Dynamics. Señala errores, explica su impacto y propón correcciones para revisar antes de aplicarlas.'},
    {id:'10000000-0000-4000-8000-000000000005',label:'Responder en inglés',prompt:'Redacta una respuesta en inglés al mensaje adjunto, clara, cordial y breve. Déjala preparada para que yo la revise.'}
  ]));}
  saveFavorites(rows:Favorite[]){const parsed=z.array(FavoriteSchema).max(20).parse(rows);if(new Set(parsed.map(row=>row.id)).size!==parsed.length)throw new ZenError('Hay favoritos duplicados.');this.write('favorites.json',parsed);return parsed;}
  tasks(): TaskEvent[] {
    const raw = this.read('tasks.json', []);
    if (!Array.isArray(raw)) throw new ZenError('Historial de tareas dañado.');
    return raw.slice(-100).filter((row): row is TaskEvent => row && typeof row.id === 'string' && typeof row.message === 'string' && ['idle', 'queued', 'listening', 'thinking', 'awaiting_approval', 'awaiting_input', 'executing', 'completed', 'failed', 'cancelled'].includes(row.state));
  }
  removeChat(id:string,taskIds:string[]=[]){const rows=this.tasks(),ids=new Set([...taskIds,...rows.filter(r=>r.chatId===id).map(r=>r.id)]);this.write('tasks.json',rows.filter(r=>r.chatId!==id&&!ids.has(r.id)));const interactions=this.interactions();this.saveInteractions({...interactions,guides:interactions.guides.filter(g=>!ids.has(g.taskId))});}
  recover() { const tasks = this.tasks().map(row => (['queued', 'thinking', 'executing', 'awaiting_approval'].includes(row.state) || row.workContext?.phase === 'review') ? { ...row, ...(row.workContext?{workContext:{owner:'codex' as const,phase:'incomplete' as const}}:{}), state: 'failed' as const, paused:false,undoAvailable:false, message: 'Tarea interrumpida por cierre o reinicio. No se reanuda ni se repiten acciones automáticamente.' } : {...row,undoAvailable:false}); this.write('tasks.json', tasks); }
  task(event: TaskEvent) { if (event.id === 'voice' || event.id === 'storage' || event.streamText !== undefined) return; const existing=this.tasks();event={createdAt:Date.now(),...existing.find(row=>row.id===event.id),...event,updatedAt:Date.now()};const tasks = existing.filter(row => row.id !== event.id); const persisted = event.approval ? { ...event, approval: { ...event.approval, content: undefined } } : event; this.write('tasks.json', [...tasks, persisted].slice(-100)); }
}
