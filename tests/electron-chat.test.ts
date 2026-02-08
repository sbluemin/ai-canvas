import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Electron Chat Test', () => {
  test('should send a chat message and receive response', async () => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../dist-electron/main.js')],
      env: {
        ...process.env,
        ELECTRON_IS_PACKAGED: 'true',
        MOCK_AI: 'true',
      },
    });

    const windows = electronApp.windows();
    console.log('Number of windows:', windows.length);
    
    let mainWindow = await electronApp.firstWindow();
    
    for (const win of electronApp.windows()) {
      const url = win.url();
      console.log('Window URL:', url);
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
    
    mainWindow.on('console', (msg) => {
      console.log(`[Console ${msg.type()}]: ${msg.text()}`);
    });

    mainWindow.on('pageerror', (error) => {
      console.error(`[Page Error]: ${error.message}`);
    });

    await mainWindow.waitForLoadState('networkidle');
    await mainWindow.waitForTimeout(2000);
    
    await mainWindow.screenshot({ path: 'tests/screenshots/electron-initial.png' });
    
    console.log('Main Window URL:', mainWindow.url());
    
    const inputField = mainWindow.locator('input[placeholder="메시지를 입력하세요..."]');
    await expect(inputField).toBeVisible({ timeout: 15000 });
    
    await inputField.fill('안녕하세요! 테스트입니다.');
    await inputField.press('Enter');
    
    await mainWindow.screenshot({ path: 'tests/screenshots/electron-after-send.png' });
    
    await mainWindow.waitForTimeout(10000);
    
    await mainWindow.screenshot({ path: 'tests/screenshots/electron-after-response.png' });
    
    const messagesHtml = await mainWindow.locator('.messages-container').innerHTML().catch(() => 'NOT FOUND');
    console.log('Messages:', messagesHtml.substring(0, 500));
    
    const hasError = await mainWindow.locator('text=오류').count() > 0;
    if (hasError) {
      const errorText = await mainWindow.locator('text=오류').first().textContent();
      console.error('Error found:', errorText);
    }
    
    await electronApp.close();
  });
});
