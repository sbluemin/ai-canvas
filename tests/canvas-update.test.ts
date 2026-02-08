import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Canvas Update', () => {
  test('should be able to request canvas update via chat', async () => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../dist-electron/main.js')],
      env: {
        ...process.env,
        ELECTRON_IS_PACKAGED: 'true',
        MOCK_AI: 'true',
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
    const initialContent = await canvasEditor.textContent();

    const inputField = mainWindow.locator('input[placeholder="메시지를 입력하세요..."]');
    await expect(inputField).toBeVisible({ timeout: 10000 });

    await inputField.fill('캔버스 문서 맨 아래에 "## E2E 테스트 섹션" 제목과 간단한 설명을 추가해줘');
    await inputField.press('Enter');

    const assistantMessage = mainWindow.locator('.message.assistant .message-content');
    await expect(assistantMessage.first()).toBeVisible({ timeout: 30000 });

    await expect(async () => {
      const messageText = await assistantMessage.first().textContent();
      expect(messageText?.length).toBeGreaterThan(10);
    }).toPass({ timeout: 30000, intervals: [1000, 2000] });

    await mainWindow.waitForTimeout(3000);

    const updatedContent = await canvasEditor.textContent();
    
    await mainWindow.screenshot({ path: 'tests/screenshots/canvas-update-request.png' });

    const canvasChanged = updatedContent !== initialContent;
    console.log('Canvas changed:', canvasChanged);
    console.log('Initial length:', initialContent?.length);
    console.log('Updated length:', updatedContent?.length);

    expect(canvasChanged).toBe(true);

    await electronApp.close();
  });
});
