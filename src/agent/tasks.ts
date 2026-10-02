import { Orchestrator } from './orchestrator';
import { ZenError } from '../shared/errors';
import type { TaskResult } from '../shared/contracts';
import { randomUUID } from 'node:crypto';
import type { DesktopHandler } from '../shared/desktop';
import {computerRequest} from '../shared/computer';
type Deps = ConstructorParameters<typeof Orchestrator>[0];
export class DesktopQueue {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(() => { signal.throwIfAborted(); return operation(); });
    this.tail = result.catch(() => undefined); return result;
  }
}
export class TaskManager {
  private active = new Map<string, Orchestrator>();
  private requests = new Map<string, Promise<TaskResult>>();
  private desktop = new DesktopQueue();
  private paused = false;
  private pending: { id: string; requestId: string; text: string; memory?: string; image?: string; sessionId?: string; summary?: string; desktop?: DesktopHandler; priority: number; resolve: (result: TaskResult) => void }[] = [];
  constructor(private deps: Deps, private limit: () => number) {}
  get busy() { return this.active.size > 0 || this.pending.length > 0; }
  get activeCount() { return this.active.size + this.pending.length; }
  private cancelQueued(id: string) { const index = this.pending.findIndex(row => row.id === id); if (index < 0) return false; const [row] = this.pending.splice(index, 1); const result = { id, state: 'cancelled' as const, message: 'Tarea en cola cancelada. No se ejecutó ninguna operación.' }; this.deps.emit(result); row.resolve(result); return true; }
  stop() { for (const row of [...this.pending]) this.cancelQueued(row.id); this.active.forEach(owner => owner.stop()); }
  stopComputer(){this.active.forEach(owner=>{if(owner.controlsComputer)owner.stop();});for(const row of [...this.pending])if(computerRequest(row.text))this.cancelQueued(row.id);}
  cancelTask(id: string) { if (this.cancelQueued(id)) return; const owner = [...this.active.values()].find(owner => owner.taskId === id); if (!owner) throw new ZenError('La tarea ya no está activa.'); owner.stop(); }
  pause() { this.paused = true; this.active.forEach(owner => owner.pause()); }
  resume() { this.paused = false; this.active.forEach(owner => owner.resume()); this.drain(); }
  desktopRun<T>(signal: AbortSignal, operation: () => Promise<T>) { return this.desktop.run(signal, () => { if (this.paused) throw new ZenError('Acciones en pausa.'); return operation(); }); }
  private drain() {
    while (!this.paused && this.active.size < this.limit() && this.pending.length) {
      this.pending.sort((a, b) => b.priority - a.priority); // stable sort preserves FIFO ties
      const row = this.pending.shift()!;
      const owner = new Orchestrator({ ...this.deps, desktop: () => row.desktop!, direct: text => { const operation = this.deps.direct?.(text); return operation ? (signal,progress) => this.desktopRun(signal, () => operation(signal,progress)) : undefined; }, execute: signal => this.desktopRun(signal, () => this.deps.execute(signal)) });
      this.active.set(row.requestId, owner);
      void owner.run(row.text, row.requestId, row.memory, row.image, row.sessionId, row.id, row.summary).then(result => { this.active.delete(row.requestId); row.resolve(result); this.drain(); });
    }
  }
  run(text: string, requestId: string, memory?: string, image?: string, sessionId?: string, priority = 2, summary?: string) {
    const existing = this.requests.get(requestId); if (existing) return existing;
    if (this.paused) return Promise.reject(new ZenError('ZEN está en pausa. Usa «Continúa».'));
    if (this.pending.length >= this.deps.settings().maxQueuedTasks) return Promise.reject(new ZenError('Se alcanzó el límite de tareas en cola. Espera o cancela una tarea.'));
    if (image && this.active.size >= this.limit()) return Promise.reject(new ZenError('Una captura temporal no se deja en cola. Espera a una tarea libre y vuelve a observar.'));
    const id = randomUUID(); let resolve!: (value: TaskResult) => void;
    const task = new Promise<TaskResult>(done => { resolve = done; });
    this.requests.set(requestId, task);
    this.pending.push({ id, requestId, text, memory, image, sessionId, summary, desktop: this.deps.desktop?.(text), priority, resolve });
    if (this.active.size >= this.limit()) this.deps.emit({ id, state: 'queued', message: `Tarea en cola · prioridad ${priority === 3 ? 'alta' : priority === 1 ? 'baja' : 'normal'}.` });
    this.drain();
    if (this.requests.size > 200) this.requests.delete(this.requests.keys().next().value!);
    return task;
  }
}
