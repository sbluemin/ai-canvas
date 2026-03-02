import { BrowserWindow } from 'electron';
import { registerProjectHandlers } from './handlers/project';
import { registerAiHandlers } from './handlers/ai';
import { registerSettingsHandlers } from './handlers/settings';
import { registerRuntimeHandlers } from './handlers/runtime';
import { registerWindowHandlers } from './handlers/window';
import { readStoredThemeMode, type ThemeMode } from './theme-store';

export { readStoredThemeMode, type ThemeMode };

export function registerIpcHandlers(
  createWindow: () => BrowserWindow,
  onThemeChanged?: (theme: ThemeMode) => void,
): void {
  void createWindow;

  registerProjectHandlers();
  registerAiHandlers();
  registerSettingsHandlers(onThemeChanged);
  registerRuntimeHandlers();
  registerWindowHandlers();
}
