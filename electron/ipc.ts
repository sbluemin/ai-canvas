import { ipcMain, IpcMainInvokeEvent } from 'electron';

export type IpcHandler<T = any> = (
  event: IpcMainInvokeEvent,
  ...args: any[]
) => Promise<T> | T;

export function handleIpc<T>(channel: string, handler: IpcHandler<T>) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });
}
