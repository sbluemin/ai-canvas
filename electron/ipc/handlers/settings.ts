import { handleIpc } from '../../shared/utils';
import { isThemeMode, readStoredThemeMode, writeStoredThemeMode, type ThemeMode } from '../theme-store';

export function registerSettingsHandlers(onThemeChanged?: (theme: ThemeMode) => void): void {
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

    writeStoredThemeMode(settings.theme);
    onThemeChanged?.(settings.theme);
    return { success: true };
  });
}
