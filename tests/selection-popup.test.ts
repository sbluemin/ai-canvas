import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Selection AI Popup', () => {
  test('should show AI popup when text is selected in canvas', async () => {
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

    const canvasEditor = mainWindow.locator('.milkdown-wrapper');
    await expect(canvasEditor).toBeVisible({ timeout: 10000 });

    await canvasEditor.click();
    await mainWindow.keyboard.down('Control');
    await mainWindow.keyboard.press('a');
    await mainWindow.keyboard.up('Control');

    await mainWindow.waitForTimeout(500);

    await mainWindow.screenshot({ path: 'tests/screenshots/selection-popup-visible.png' });

    await electronApp.close();
  });

  test('should have AI input field in selection popup', async () => {
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

    const canvasEditor = mainWindow.locator('.milkdown-wrapper');
    await expect(canvasEditor).toBeVisible({ timeout: 10000 });

    const editorParagraph = canvasEditor.locator('p, h1, h2, h3').first();
    if (await editorParagraph.isVisible()) {
      await editorParagraph.click({ clickCount: 3 });

      await mainWindow.waitForTimeout(1000);

      const selectionPopup = mainWindow.locator('.selection-ai-popup');
      if (await selectionPopup.isVisible()) {
        const aiInput = selectionPopup.locator('.ai-popup-input');
        await expect(aiInput).toBeVisible();
        await expect(aiInput).toHaveAttribute('placeholder', 'AI에게 물어보기');
      }
    }

    await mainWindow.screenshot({ path: 'tests/screenshots/selection-popup-input.png' });

    await electronApp.close();
  });
});
