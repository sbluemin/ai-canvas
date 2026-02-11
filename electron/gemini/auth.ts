import { shell, safeStorage, app } from 'electron';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { TokenData, ValidTokenResult, AuthStatus } from './types';

const CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:8085/oauth2callback';
const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_HEADERS = {
  'User-Agent': 'google-api-nodejs-client/9.15.1',
  'X-Goog-Api-Client': 'gl-node/22.17.0',
  'Client-Metadata': 'ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI',
};

function getTokenPath(): string {
  return path.join(app.getPath('userData'), 'gemini-auth.enc');
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
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
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

async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenData> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
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
  
  await saveToken(tokenData);
  return tokenData;
}

function waitForCallback(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith('/oauth2callback')) {
        res.writeHead(404);
        res.end();
        return;
      }
      
      const url = new URL(req.url, 'http://localhost:8085');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <body style="font-family: system-ui; text-align: center; padding: 50px; background: #1a1a1a; color: white;">
              <h1>❌ 인증 실패</h1>
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
              <h1>❌ 인증 실패</h1>
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
                <h1>인증 완료</h1>
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

<<<<<<< HEAD
    server.listen(8085, '127.0.0.1');
=======
    server.listen(8085);
>>>>>>> origin/main

    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout'));
    }, 5 * 60 * 1000);
  });
}

async function loadManagedProject(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`${CODE_ASSIST_ENDPOINT}/v1internal:loadCodeAssist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...CODE_ASSIST_HEADERS,
      },
      body: JSON.stringify({
        metadata: {
          ideType: 'IDE_UNSPECIFIED',
          platform: 'PLATFORM_UNSPECIFIED',
          pluginType: 'GEMINI',
        },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data.cloudaicompanionProject) {
      const projectId = typeof data.cloudaicompanionProject === 'string' 
        ? data.cloudaicompanionProject 
        : data.cloudaicompanionProject.id;
      return projectId || null;
    }

    if (data.allowedTiers?.length > 0) {
      const tier = data.allowedTiers.find((t: { isDefault?: boolean }) => t.isDefault) || data.allowedTiers[0];
      const tierId = tier?.id || 'free-tier';
      
      const onboardResponse = await fetch(`${CODE_ASSIST_ENDPOINT}/v1internal:onboardUser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          ...CODE_ASSIST_HEADERS,
        },
        body: JSON.stringify({
          tierId,
          metadata: {
            ideType: 'IDE_UNSPECIFIED',
            platform: 'PLATFORM_UNSPECIFIED',
            pluginType: 'GEMINI',
          },
        }),
      });

      if (onboardResponse.ok) {
        const onboardData = await onboardResponse.json();
        return onboardData.response?.cloudaicompanionProject?.id || null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function startAuth(): Promise<TokenData> {
  const pkce = generatePKCE();
  const state = generateState();
  
  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', pkce.codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  const codePromise = waitForCallback(state);
  await shell.openExternal(authUrl.toString());
  const code = await codePromise;
  
  const tokenData = await exchangeCodeForToken(code, pkce.codeVerifier);
  
  const projectId = await loadManagedProject(tokenData.accessToken);
  if (projectId) {
    tokenData.projectId = projectId;
    await saveToken(tokenData);
  }
  
  return tokenData;
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
  
  if (!token.projectId) {
    const projectId = await loadManagedProject(token.accessToken);
    if (projectId) {
      token.projectId = projectId;
      await saveToken(token);
    }
  }
  
  if (!token.projectId) return null;
  
  return {
    accessToken: token.accessToken,
    projectId: token.projectId,
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
