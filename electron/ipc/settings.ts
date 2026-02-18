import Store from 'electron-store';
import { handleIpc } from '../core';

export type ThemeMode = 'dark' | 'light' | 'system';

type AppSettingsStoreSchema = {
  theme?: ThemeMode;
};

const appSettingsStore = new Store<AppSettingsStoreSchema>({ name: 'app-settings' });

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function readStoredThemeMode(): ThemeMode {
  const theme = appSettingsStore.get('theme');
  return isThemeMode(theme) ? theme : 'dark';
}

export function registerSettingsHandlers(onThemeChanged?: (theme: ThemeMode) => void) {
  handleIpc('settings:read', async () => {
    return {
      success: true,
      settings: {
        theme: readStoredThemeMode(),
      },
    };
  });

  handleIpc('settings:write', async (_event: unknown, settings: { theme?: unknown }) => {
    if (!isThemeMode(settings?.theme)) {
      return { success: false, error: 'Invalid theme value' };
    }

    appSettingsStore.set('theme', settings.theme);
    onThemeChanged?.(settings.theme);
    return { success: true };
  });
}
