import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function launchMainWindow(): Promise<{ electronApp: ElectronApplication; mainWindow: Page }> {
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../dist-electron/main.js')],
    env: {
      ...process.env,
      ELECTRON_IS_PACKAGED: 'true',
    },
  });

  let mainWindow = await electronApp.firstWindow();

  for (const win of electronApp.windows()) {
    const url = win.url();
    if (!url.includes('devtools://')) {
      mainWindow = win;
      break;
    }
  }

  if (mainWindow.url().includes('devtools://')) {
    mainWindow = await electronApp.waitForEvent('window', {
      predicate: (page) => !page.url().includes('devtools://'),
      timeout: 10000,
    });
  }

  await mainWindow.waitForLoadState('networkidle');
  await mainWindow.waitForTimeout(2000);

  return { electronApp, mainWindow };
}

async function openCommandPalette(mainWindow: Page): Promise<void> {
  if (process.platform === 'darwin') {
    await mainWindow.keyboard.press('Meta+Shift+P');
    return;
  }

  await mainWindow.keyboard.press('Control+Shift+P');
}

test.describe('Command Palette', () => {
  test('should open with shortcut and close with Escape/backdrop', async () => {
    const { electronApp, mainWindow } = await launchMainWindow();

    const commandPalette = mainWindow.locator('.command-palette');

    await openCommandPalette(mainWindow);
    await expect(commandPalette).toBeVisible({ timeout: 10000 });

    await mainWindow.keyboard.press('Escape');
    await expect(commandPalette).toBeHidden({ timeout: 10000 });

    await openCommandPalette(mainWindow);
    await expect(commandPalette).toBeVisible({ timeout: 10000 });

    await mainWindow.locator('.command-palette-backdrop').click();
    await expect(commandPalette).toBeHidden({ timeout: 10000 });

    await electronApp.close();
  });

  test('should show Open OpenCode Terminal command as disabled when runtime/project not ready', async () => {
    const { electronApp, mainWindow } = await launchMainWindow();

    await openCommandPalette(mainWindow);

    const commandItem = mainWindow
      .locator('.command-palette-item', { hasText: 'Open OpenCode Terminal' })
      .first();
    await expect(commandItem).toBeVisible({ timeout: 10000 });
    await expect(commandItem).toBeDisabled();

    const badge = mainWindow.locator('.command-palette-item-badge').first();
    await expect(badge).toBeVisible();

    await electronApp.close();
  });
});
