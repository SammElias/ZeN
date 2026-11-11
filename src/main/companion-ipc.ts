import {ipcMain, type BrowserWindow} from 'electron';
import {z} from 'zod';
import type {CompanionBridge} from '../shared/codex-companion';
import {companionChannel, type CompanionCommand} from '../shared/companion-ipc';

type CommandValue<Command extends CompanionCommand> =
  Extract<Awaited<ReturnType<CompanionBridge[Command]>>, {ok: true}>['value'];

export function companionIpc(window: BrowserWindow, rendererUrl: string, presenting: () => boolean) {
  return function handle<Command extends CompanionCommand, Schema extends z.ZodType>(
    name: Command,
    schema: Schema,
    run: (input: z.output<Schema>) => CommandValue<Command> | Promise<CommandValue<Command>>,
  ) {
    ipcMain.handle(companionChannel(name), async (event, input: unknown) => {
      try {
        const frame = event.senderFrame;
        if (window.isDestroyed() || event.sender !== window.webContents ||
            !frame || frame !== event.sender.mainFrame || frame.url !== rendererUrl) {
          throw Error('Origen no autorizado.');
        }
        return {ok: true, value: await run(schema.parse(input))};
      } catch (error) {
        const message = error instanceof z.ZodError ? 'Petición no válida.' :
          presenting() ? 'Acción no disponible. Revisa Codex o desactiva Presentación.' :
          error instanceof Error ? error.message : 'No se pudo completar la acción.';
        return {ok: false, error: message};
      }
    });
  };
}
