import { shell, safeStorage, app, BrowserWindow } from 'electron';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { TokenData, ValidTokenResult, AuthStatus } from './types';

const CLIENT_ID = process.env.ANTHROPIC_CLIENT_ID || '';
const REDIRECT_URI = process.env.ANTHROPIC_REDIRECT_URI || 'https://console.anthropic.com/oauth/code/callback';

if (!CLIENT_ID) {
  console.warn('Anthropic Client ID is missing. Anthropic authentication may not work correctly.');
}
const SCOPES = [
  'org:create_api_key',
  'user:profile',
  'user:inference',
];

const TOKEN_ENDPOINT = 'https://console.anthropic.com/v1/oauth/token';

function getTokenPath(): string {
  return path.join(app.getPath('userData'), 'anthropic-auth.enc');
}

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
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

async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  const tokenData: TokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in * 1000) - 60000,
  };

  await saveToken(tokenData);
  return tokenData;
}

async function exchangeCodeForToken(rawCode: string, codeVerifier: string): Promise<TokenData> {
  // Anthropic callback 형식: code#state
  const splits = rawCode.split('#');
  const code = splits[0];
  const state = splits[1] || '';

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      state,
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  const tokenData: TokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000) - 60000,
  };

  await saveToken(tokenData);
  return tokenData;
}

function buildAuthUrl(codeChallenge: string, state: string): string {
  const authUrl = new URL('https://claude.ai/oauth/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  return authUrl.toString();
}

function showCodeInputDialog(): Promise<string> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    
    const inputWindow = new BrowserWindow({
      width: 480,
      height: 280,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    inputWindow.setMenu(null);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Claude 인증</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              background: #1a1a1a;
              color: #fff;
              padding: 24px;
              height: 100vh;
              display: flex;
              flex-direction: column;
            }
            h1 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
            p { font-size: 13px; color: #888; margin-bottom: 16px; }
            input {
              width: 100%;
              padding: 12px;
              border: 1px solid #333;
              border-radius: 8px;
              background: #2a2a2a;
              color: #fff;
              font-size: 14px;
              font-family: monospace;
              margin-bottom: 16px;
            }
            input:focus { outline: none; border-color: #CC925B; }
            .buttons { display: flex; gap: 12px; justify-content: flex-end; }
            button {
              padding: 10px 20px;
              border-radius: 8px;
              font-size: 14px;
              cursor: pointer;
              border: none;
              transition: all 0.15s;
            }
            .cancel { background: #333; color: #fff; }
            .cancel:hover { background: #444; }
            .submit { background: #CC925B; color: #fff; }
            .submit:hover { background: #D9A76A; }
            .submit:disabled { background: #555; cursor: not-allowed; }
          </style>
        </head>
        <body>
          <h1>Claude 인증 코드 입력</h1>
          <p>브라우저에서 인증 후 표시된 코드를 붙여넣기 하세요.</p>
          <input type="text" id="code" placeholder="Authorization Code" autofocus />
          <div class="buttons">
            <button class="cancel" id="cancelBtn">취소</button>
            <button class="submit" id="submitBtn" disabled>확인</button>
          </div>
          <script>
            const input = document.getElementById('code');
            const submitBtn = document.getElementById('submitBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            
            input.focus();
            
            input.addEventListener('input', () => {
              submitBtn.disabled = input.value.trim().length < 10;
            });
            
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' && input.value.trim().length >= 10) {
                document.title = 'CODE:' + input.value.trim();
              }
              if (e.key === 'Escape') {
                document.title = 'CANCEL';
              }
            });
            
            submitBtn.addEventListener('click', () => {
              if (input.value.trim().length >= 10) {
                document.title = 'CODE:' + input.value.trim();
              }
            });
            
            cancelBtn.addEventListener('click', () => {
              document.title = 'CANCEL';
            });
          </script>
        </body>
      </html>
    `;

    inputWindow.loadURL('data:text/html;base64,' + Buffer.from(htmlContent).toString('base64'));

    const checkTitle = setInterval(() => {
      if (inputWindow.isDestroyed()) {
        clearInterval(checkTitle);
        return;
      }
      
      const title = inputWindow.getTitle();
      if (title.startsWith('CODE:')) {
        clearInterval(checkTitle);
        resolved = true;
        const code = title.substring(5);
        inputWindow.close();
        resolve(code);
      } else if (title === 'CANCEL') {
        clearInterval(checkTitle);
        resolved = true;
        inputWindow.close();
        reject(new Error('Authentication cancelled'));
      }
    }, 100);

    inputWindow.on('closed', () => {
      clearInterval(checkTitle);
      if (!resolved) {
        reject(new Error('Authentication cancelled'));
      }
    });
  });
}

export async function startAuth(): Promise<TokenData> {
  const pkce = generatePKCE();
  const state = generateState();
  const authUrl = buildAuthUrl(pkce.codeChallenge, state);

  await shell.openExternal(authUrl);
  
  const code = await showCodeInputDialog();
  
  return await exchangeCodeForToken(code, pkce.codeVerifier);
}

export async function getValidAccessToken(): Promise<ValidTokenResult | null> {
  let token = await loadToken();

  if (!token) return null;

  if (Date.now() >= token.expiresAt) {
    try {
      token = await refreshAccessToken(token.refreshToken);
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

  if (Date.now() >= token.expiresAt) {
    try {
      const newToken = await refreshAccessToken(token.refreshToken);
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
