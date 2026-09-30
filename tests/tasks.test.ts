import { describe, it, expect, vi } from 'vitest';
import { TaskManager, DesktopQueue } from '../src/agent/tasks';
import { SettingsSchema } from '../src/shared/contracts';
import { randomUUID } from 'node:crypto';
describe('Tareas y cola de escritorio', () => {
  it('serializa operaciones y descarta una acción cancelada antes de ejecutarla', async () => {
    const queue = new DesktopQueue(); const signal = new AbortController(); const order: string[] = []; let release!: () => void;
    const first = queue.run(new AbortController().signal, async () => { order.push('first'); await new Promise<void>(resolve => { release = resolve; }); });
    const second = queue.run(signal.signal, async () => { order.push('second'); });
    const rejected = expect(second).rejects.toThrow();
    await Promise.resolve(); signal.abort(); release(); await first; await rejected; expect(order).toEqual(['first']);
  });
  it('limita concurrencia, deduplica y mantiene resultados independientes', async () => {
    const releases: (() => void)[] = []; const run = vi.fn().mockImplementation(() => new Promise(resolve => releases.push(() => resolve({ message: 'resultado' }))));
    const manager = new TaskManager({ saved: { run } as any, client: vi.fn() as any, settings: () => SettingsSchema.parse({ maxQueuedTasks: 1 }), execute: vi.fn(), emit: vi.fn(), log: vi.fn() }, () => 2);
    const id = randomUUID(); const first = manager.run('investigación uno', id); const second = manager.run('investigación dos', randomUUID());
    expect(manager.run('duplicada', id)).toBe(first); const third = manager.run('tercera', randomUUID()); await expect(manager.run('cuarta', randomUUID())).rejects.toThrow('límite');
    await Promise.resolve(); expect(run).toHaveBeenCalledTimes(2); releases.slice(0, 2).forEach(release => release());
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(3)); releases[2]();
    const results = await Promise.all([first, second, third]); expect(results.every(row => row.state === 'completed')).toBe(true); expect(manager.busy).toBe(false);
  });
  it('ordena pendientes por prioridad, no interrumpe efectos activos y conserva FIFO entre iguales', async () => {
    const started: string[] = []; const releases: (() => void)[] = [];
    const run = vi.fn((text: string) => { started.push(text); return new Promise(resolve => releases.push(() => resolve({ message: text }))); });
    const manager = new TaskManager({ saved: { run } as any, client: vi.fn() as any, settings: () => SettingsSchema.parse({}), execute: vi.fn(), emit: vi.fn(), log: vi.fn() }, () => 1);
    const tasks = [manager.run('activa', randomUUID()), manager.run('baja', randomUUID(), undefined, undefined, undefined, 1), manager.run('alta uno', randomUUID(), undefined, undefined, undefined, 3), manager.run('alta dos', randomUUID(), undefined, undefined, undefined, 3)];
    await Promise.resolve(); expect(started).toEqual(['activa']);
    for (let index = 0; index < 4; index++) { await vi.waitFor(() => expect(releases.length).toBe(index + 1)); releases[index](); }
    await Promise.all(tasks); expect(started).toEqual(['activa', 'alta uno', 'alta dos', 'baja']);
  });
  it('cancelar una tarea en cola no ejecuta herramientas y Detener vacía el resto', async () => {
    const emit = vi.fn(); const run = vi.fn(() => new Promise(() => {}));
    const manager = new TaskManager({ saved: { run } as any, client: vi.fn() as any, settings: () => SettingsSchema.parse({}), execute: vi.fn(), emit, log: vi.fn() }, () => 1);
    const active = manager.run('activa', randomUUID()); const queued = manager.run('pendiente', randomUUID());
    const id = emit.mock.calls.find(([event]) => event.state === 'queued')![0].id;
    manager.cancelTask(id); expect((await queued).state).toBe('cancelled');
    const more = manager.run('otra pendiente', randomUUID()); manager.stop(); expect((await more).state).toBe('cancelled');
    await Promise.resolve(); expect(run).toHaveBeenCalledTimes(1); void active;
  });
});
