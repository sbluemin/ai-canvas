import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Canvas Context Awareness', () => {
  test('should include canvas content in AI context', async () => {
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

    const editorContent = await canvasEditor.textContent();
    expect(editorContent).toContain('AI Canvas');

    const inputField = mainWindow.locator('input[placeholder="메시지를 입력하세요..."]');
    await expect(inputField).toBeVisible({ timeout: 10000 });

    await inputField.fill('캔버스에 뭐가 있어?');
    await inputField.press('Enter');

    await mainWindow.waitForTimeout(5000);

    const messagesContainer = mainWindow.locator('.messages-container');
    await expect(messagesContainer).toBeVisible();

    const userMessage = messagesContainer.locator('.message.user').last();
    await expect(userMessage).toContainText('캔버스에 뭐가 있어?');

    await mainWindow.screenshot({ path: 'tests/screenshots/canvas-aware-test.png' });

    await electronApp.close();
  });

  test('should show canvas badge in chat input area', async () => {
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

    await mainWindow.waitForLoadState('networkidle');
    await mainWindow.waitForTimeout(2000);

    const canvasBadge = mainWindow.locator('.canvas-badge');
    await expect(canvasBadge).toBeVisible({ timeout: 10000 });
    await expect(canvasBadge).toContainText('Canvas');

    await electronApp.close();
  });
});
