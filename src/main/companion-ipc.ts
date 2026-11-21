import {ipcMain, type BrowserWindow, type IpcMainInvokeEvent} from 'electron';
import {z} from 'zod';
import type {CompanionBridge} from '../shared/codex-companion';
import {companionChannel, type CompanionCommand} from '../shared/companion-ipc';

export type CompanionIpcHandler = ReturnType<typeof companionIpc>;
export type CompanionWindowDialog = <T>(show: () => Promise<T>) => Promise<T>;

type CommandValue<Command extends CompanionCommand> =
  Extract<Awaited<ReturnType<CompanionBridge[Command]>>, {ok: true}>['value'];

export function companionIpc(window: BrowserWindow, rendererUrl: string, presenting: () => boolean) {
  function authorize(event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>) {
    const frame = event.senderFrame;
    if (window.isDestroyed() || event.sender !== window.webContents ||
        !frame || frame !== event.sender.mainFrame || frame.url !== rendererUrl) {
      throw Error('Origen no autorizado.');
    }
  }

  function failure(error: unknown) {
    const message = error instanceof z.ZodError ? 'Petición no válida.' :
      presenting() ? 'Acción no disponible. Revisa Codex o desactiva Presentación.' :
      error instanceof Error ? error.message : 'No se pudo completar la acción.';
    return {ok: false, error: message};
  }

  function handle<Command extends CompanionCommand, Schema extends z.ZodType>(
    name: Command,
    schema: Schema,
    run: (input: z.output<Schema>) => CommandValue<Command> | Promise<CommandValue<Command>>,
  ) {
    ipcMain.handle(companionChannel(name), async (event, input: unknown) => {
      try {
        authorize(event);
        return {ok: true, value: await run(schema.parse(input))};
      } catch (error) {
        return failure(error);
      }
    });
  }

  function sync<Command extends CompanionCommand, Schema extends z.ZodType>(
    name: Command,
    schema: Schema,
    run: (input: z.output<Schema>) => CommandValue<Command>,
  ) {
    ipcMain.on(companionChannel(name), (event, input: unknown) => {
      try {
        authorize(event);
        event.returnValue = {ok: true, value: run(schema.parse(input))};
      } catch (error) {
        event.returnValue = failure(error);
      }
    });
  }

  return Object.assign(handle, {sync});
}
