import Store from 'electron-store';
import { handleIpc } from '../core';

type ThemeMode = 'dark' | 'light' | 'system';

type AppSettingsStoreSchema = {
  theme?: ThemeMode;
};

const appSettingsStore = new Store<AppSettingsStoreSchema>({ name: 'app-settings' });

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function registerSettingsHandlers() {
  handleIpc('settings:read', async () => {
    const theme = appSettingsStore.get('theme');
    return {
      success: true,
      settings: {
        theme: isThemeMode(theme) ? theme : 'dark',
      },
    };
  });

  handleIpc('settings:write', async (_event: unknown, settings: { theme?: unknown }) => {
    if (!isThemeMode(settings?.theme)) {
      return { success: false, error: 'Invalid theme value' };
    }

    appSettingsStore.set('theme', settings.theme);
    return { success: true };
  });
}
