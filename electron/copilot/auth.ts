import { shell, safeStorage, app, BrowserWindow } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { TokenData, ValidTokenResult, AuthStatus, DeviceCodeResponse, TokenResponse, CopilotTokenResponse } from './types';

// GitHub Copilot OAuth 설정
// Copilot CLI의 클라이언트 ID 사용
const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const COPILOT_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token';
const COPILOT_HEADERS = {
  'User-Agent': 'GitHubCopilotChat/0.35.0',
  'Editor-Version': 'vscode/1.107.0',
  'Editor-Plugin-Version': 'copilot-chat/0.35.0',
  'Copilot-Integration-Id': 'vscode-chat',
} as const;

function getTokenPath(): string {
  return path.join(app.getPath('userData'), 'copilot-auth.enc');
}

async function saveToken(token: TokenData): Promise<void> {
  const tokenPath = getTokenPath();
  const tokenJson = JSON.stringify(token);

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(tokenJson);
    await fs.writeFile(tokenPath, encrypted);
  } else {
    await fs.writeFile(tokenPath, tokenJson, 'utf-8');
  }
}

async function loadToken(): Promise<TokenData | null> {
  const tokenPath = getTokenPath();

  try {
    const data = await fs.readFile(tokenPath);

    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(data);
      return JSON.parse(decrypted);
    }
    return JSON.parse(data.toString('utf-8'));
  } catch {
    return null;
  }
}

async function deleteToken(): Promise<void> {
  try {
    await fs.unlink(getTokenPath());
  } catch {}
}

// GitHub Device Flow - 1단계: device code 요청
async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'GitHubCopilotChat/0.35.0',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: 'read:user',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Device code request failed: ${error}`);
  }

  return await response.json();
}

// GitHub Device Flow - 2단계: 토큰 폴링
async function pollForToken(deviceCode: string, interval: number, expiresIn: number): Promise<TokenResponse> {
  const startTime = Date.now();
  const timeoutMs = expiresIn * 1000;

  while (Date.now() - startTime < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, interval * 1000));

    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'GitHubCopilotChat/0.35.0',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = await response.json();

    if (data.access_token) {
      return data as TokenResponse;
    }

    if (data.error === 'authorization_pending') {
      continue;
    }
    
    if (data.error === 'slow_down') {
      interval = Math.max(interval + 5, data.interval || interval);
      continue;
    }

    if (data.error === 'expired_token') {
      throw new Error('인증 시간이 만료되었습니다. 다시 시도해주세요.');
    }

    if (data.error === 'access_denied') {
      throw new Error('인증이 거부되었습니다.');
    }

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }
  }

  throw new Error('인증 시간 초과');
}

// Copilot API 토큰 획득
async function getCopilotToken(gitHubToken: string): Promise<CopilotTokenResponse> {
  const response = await fetch(COPILOT_TOKEN_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${gitHubToken}`,
      'Accept': 'application/json',
      ...COPILOT_HEADERS,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Copilot token request failed: ${error}`);
  }

  return await response.json();
}

// Device Code 다이얼로그 표시 (브라우저 열기 처리)
function showDeviceCodeDialog(userCode: string, verificationUri: string): { cancel: () => void; waitForBrowserOpen: () => Promise<void> } {
  let cancelled = false;
  let resolveWait: () => void;
  let rejectWait: (error: Error) => void;
  let browserOpened = false;
  
  const waitPromise = new Promise<void>((resolve, reject) => {
    resolveWait = resolve;
    rejectWait = reject;
  });

  const dialogWindow = new BrowserWindow({
    width: 420,
    height: 320,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  dialogWindow.setMenu(null);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>GitHub Copilot 인증</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            padding: 28px;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          h1 { 
            font-size: 18px; 
            font-weight: 600; 
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .github-icon {
            width: 24px;
            height: 24px;
          }
          p { font-size: 13px; color: #8b949e; margin-bottom: 20px; line-height: 1.5; }
          .code-box {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            margin-bottom: 16px;
            cursor: pointer;
          }
          .user-code {
            font-size: 28px;
            font-weight: 700;
            font-family: 'SF Mono', Consolas, monospace;
            letter-spacing: 4px;
            color: #58a6ff;
          }
          .copy-hint {
            font-size: 11px;
            color: #6e7681;
            margin-top: 8px;
          }
          .status {
            font-size: 12px;
            color: #8b949e;
            text-align: center;
            margin-bottom: 12px;
          }
          .status.waiting {
            color: #f0883e;
          }
          .buttons { 
            display: flex; 
            gap: 12px; 
            margin-top: auto;
          }
          button {
            flex: 1;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid #30363d;
            transition: all 0.15s;
          }
          .cancel { 
            background: #21262d; 
            color: #e6edf3; 
          }
          .cancel:hover { 
            background: #30363d;
            border-color: #8b949e;
          }
          .open-browser { 
            background: #238636; 
            color: #fff;
            border-color: #238636;
          }
          .open-browser:hover { 
            background: #2ea043; 
            border-color: #2ea043;
          }
          .open-browser:disabled {
            background: #1f6b32;
            cursor: default;
          }
        </style>
      </head>
      <body>
        <h1>
          <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub Copilot 인증
        </h1>
        <p>아래 코드를 GitHub 페이지에 입력하세요.<br>브라우저에서 인증을 완료하면 자동으로 연결됩니다.</p>
        <div class="code-box" id="codeBox">
          <div class="user-code" id="userCode">${userCode}</div>
          <div class="copy-hint">클릭하여 복사</div>
        </div>
        <div class="status" id="status"></div>
        <div class="buttons">
          <button class="cancel" id="cancelBtn">취소</button>
          <button class="open-browser" id="openBtn">GitHub 열기</button>
        </div>
        <script>
          const codeBox = document.getElementById('codeBox');
          const openBtn = document.getElementById('openBtn');
          const cancelBtn = document.getElementById('cancelBtn');
          const userCodeEl = document.getElementById('userCode');
          const statusEl = document.getElementById('status');
          
          codeBox.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText('${userCode}');
              userCodeEl.style.color = '#3fb950';
              setTimeout(() => {
                userCodeEl.style.color = '#58a6ff';
              }, 1000);
            } catch {}
          });
          
          openBtn.addEventListener('click', () => {
            document.title = 'OPEN:${verificationUri}';
            openBtn.textContent = '브라우저에서 인증 중...';
            openBtn.disabled = true;
            statusEl.textContent = '브라우저에서 인증을 완료해주세요';
            statusEl.className = 'status waiting';
          });
          
          cancelBtn.addEventListener('click', () => {
            document.title = 'CANCEL';
          });
        </script>
      </body>
    </html>
  `;

  dialogWindow.loadURL('data:text/html;base64,' + Buffer.from(htmlContent).toString('base64'));

  const checkTitle = setInterval(() => {
    if (dialogWindow.isDestroyed()) {
      clearInterval(checkTitle);
      return;
    }

    const title = dialogWindow.getTitle();
    if (title.startsWith('OPEN:') && !browserOpened) {
      browserOpened = true;
      const uri = title.substring(5);
      shell.openExternal(uri);
      resolveWait(); // 브라우저가 열렸음을 알림
    } else if (title === 'CANCEL') {
      clearInterval(checkTitle);
      cancelled = true;
      dialogWindow.close();
      rejectWait(new Error('인증이 취소되었습니다'));
    }
  }, 100);

  dialogWindow.on('closed', () => {
    clearInterval(checkTitle);
    if (!cancelled && !browserOpened) {
      rejectWait(new Error('인증이 취소되었습니다'));
    }
  });

  // 다이얼로그 참조 저장
  (global as any)._copilotAuthDialog = dialogWindow;

  return {
    cancel: () => {
      cancelled = true;
      if (!dialogWindow.isDestroyed()) {
        dialogWindow.close();
      }
    },
    waitForBrowserOpen: () => waitPromise,
  };
}

function closeAuthDialog(): void {
  const dialog = (global as any)._copilotAuthDialog;
  if (dialog && !dialog.isDestroyed()) {
    dialog.close();
  }
  delete (global as any)._copilotAuthDialog;
}

export async function startAuth(): Promise<TokenData> {
  // 1. Device code 요청
  const deviceCode = await requestDeviceCode();

  // 2. 다이얼로그 표시
  const dialog = showDeviceCodeDialog(deviceCode.user_code, deviceCode.verification_uri);
  
  try {
    // 3. 브라우저가 열릴 때까지 대기
    await dialog.waitForBrowserOpen();
    
    // 4. 토큰 폴링 (다이얼로그는 열린 상태 유지)
    const gitHubToken = await pollForToken(
      deviceCode.device_code,
      deviceCode.interval,
      deviceCode.expires_in
    );
    
    // 5. GitHub 토큰으로 Copilot 토큰 획득
    const copilotToken = await getCopilotToken(gitHubToken.access_token);

    const tokenData: TokenData = {
      accessToken: copilotToken.token,
      expiresAt: copilotToken.expires_at * 1000,
      gitHubToken: gitHubToken.access_token,
    };

    await saveToken(tokenData);
    return tokenData;
  } finally {
    closeAuthDialog();
  }
}

async function refreshCopilotToken(gitHubToken: string): Promise<TokenData> {
  const copilotToken = await getCopilotToken(gitHubToken);

  const tokenData: TokenData = {
    accessToken: copilotToken.token,
    expiresAt: copilotToken.expires_at * 1000,
    gitHubToken,
  };

  await saveToken(tokenData);
  return tokenData;
}

export async function getValidAccessToken(): Promise<ValidTokenResult | null> {
  let token = await loadToken();

  if (!token || !token.gitHubToken) return null;

  // Copilot 토큰 만료 확인 (1분 여유)
  if (Date.now() >= token.expiresAt - 60000) {
    try {
      token = await refreshCopilotToken(token.gitHubToken);
    } catch {
      await deleteToken();
      return null;
    }
  }

  return { accessToken: token.accessToken };
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const token = await loadToken();

  if (!token) return { isAuthenticated: false };

  if (!token.gitHubToken) {
    await deleteToken();
    return { isAuthenticated: false };
  }

  // Copilot 토큰 만료 확인
  if (Date.now() >= token.expiresAt - 60000) {
    try {
      const newToken = await refreshCopilotToken(token.gitHubToken);
      return { isAuthenticated: true, expiresAt: newToken.expiresAt };
    } catch {
      await deleteToken();
      return { isAuthenticated: false };
    }
  }

  return { isAuthenticated: true, expiresAt: token.expiresAt };
}

export async function logout(): Promise<void> {
  await deleteToken();
}
