import { shell, safeStorage, app } from 'electron';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { TokenData, ValidTokenResult, AuthStatus, JWTPayload } from './types';

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const REDIRECT_URI = 'http://localhost:1455/auth/callback';
const SCOPE = 'openid profile email offline_access';

const TOKEN_ENDPOINT = 'https://auth.openai.com/oauth/token';
const AUTH_ENDPOINT = 'https://auth.openai.com/oauth/authorize';

function getTokenPath(): string {
  return path.join(app.getPath('userData'), 'codex-auth.enc');
}

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded) as JWTPayload;
  } catch {
    return null;
  }
}

function extractAccountId(accessToken: string): string | null {
  const payload = decodeJWT(accessToken);
  if (!payload) return null;
  return payload['https://api.openai.com/auth']?.chatgpt_account_id ?? null;
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
    } else {
      return JSON.parse(data.toString('utf-8'));
    }
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
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

  const accountId = extractAccountId(tokenData.accessToken);
  if (accountId) {
    tokenData.accountId = accountId;
  }
  
  await saveToken(tokenData);
  return tokenData;
}

async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenData> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      redirect_uri: REDIRECT_URI,
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

  const accountId = extractAccountId(tokenData.accessToken);
  if (accountId) {
    tokenData.accountId = accountId;
  }
  
  await saveToken(tokenData);
  return tokenData;
}

function waitForCallback(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith('/auth/callback')) {
        res.writeHead(404);
        res.end();
        return;
      }
      
      const url = new URL(req.url, 'http://localhost:1455');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <body style="font-family: system-ui; text-align: center; padding: 50px; background: #1a1a1a; color: white;">
              <h1>인증 실패</h1>
              <p>${error}</p>
              <p>이 창을 닫아주세요.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error(error));
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <body style="font-family: system-ui; text-align: center; padding: 50px; background: #1a1a1a; color: white;">
              <h1>인증 실패</h1>
              <p>State 불일치</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error('State mismatch'));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <head>
              <title>인증 완료</title>
              <style>
                body {
                  font-family: system-ui, -apple-system, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background: #1a1a1a;
                  color: #fff;
                }
                .container {
                  text-align: center;
                }
                .checkmark {
                  font-size: 48px;
                  margin-bottom: 16px;
                }
                h1 {
                  font-size: 24px;
                  font-weight: 500;
                  margin: 0 0 8px 0;
                }
                p {
                  color: #888;
                  margin: 0;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="checkmark">✓</div>
                <h1>Codex 인증 완료</h1>
                <p>이 탭을 닫아주세요</p>
              </div>
              <script>
                try { window.close(); } catch(e) {}
              </script>
            </body>
          </html>
        `);
        server.close();
        resolve(code);
      }
    });

    server.listen(1455);

    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout'));
    }, 5 * 60 * 1000);
  });
}

export async function startAuth(): Promise<TokenData> {
  const pkce = generatePKCE();
  const state = generateState();
  
  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('code_challenge', pkce.codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('id_token_add_organizations', 'true');
  authUrl.searchParams.set('codex_cli_simplified_flow', 'true');
  authUrl.searchParams.set('originator', 'codex_cli_rs');

  const codePromise = waitForCallback(state);
  await shell.openExternal(authUrl.toString());
  const code = await codePromise;
  
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
  
  if (!token.accountId) {
    const accountId = extractAccountId(token.accessToken);
    if (accountId) {
      token.accountId = accountId;
      await saveToken(token);
    }
  }
  
  if (!token.accountId) return null;
  
  return {
    accessToken: token.accessToken,
    accountId: token.accountId,
  };
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
