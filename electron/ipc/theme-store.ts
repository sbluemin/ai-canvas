import Store from 'electron-store';

export type ThemeMode = 'dark' | 'light' | 'system';

type AppSettingsStoreSchema = {
  theme?: ThemeMode;
};

const appSettingsStore = new Store<AppSettingsStoreSchema>({ name: 'app-settings' });

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function readStoredThemeMode(): ThemeMode {
  const theme = appSettingsStore.get('theme');
  return isThemeMode(theme) ? theme : 'dark';
}

export function writeStoredThemeMode(theme: ThemeMode): void {
  appSettingsStore.set('theme', theme);
}
