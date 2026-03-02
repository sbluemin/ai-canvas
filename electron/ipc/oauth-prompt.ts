import { BrowserWindow, dialog } from 'electron';
import type { RuntimeOAuthPrompt, RuntimeOAuthAuthInfo } from '../runtime/service';

export async function promptInRenderer(
  sender: Electron.WebContents,
  prompt: RuntimeOAuthPrompt,
): Promise<string> {
  if (sender.isDestroyed()) {
    throw new Error('요청 화면이 닫혀 OAuth 입력을 받을 수 없습니다');
  }

  const payload = JSON.stringify({
    message: prompt.message,
    placeholder: prompt.placeholder ?? '',
    allowEmpty: prompt.allowEmpty === true,
  });

  const script = `(() => {
    const payload = ${payload};
    const existing = document.getElementById('__ai_canvas_oauth_prompt_overlay__');
    if (existing) {
      existing.remove();
    }

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.id = '__ai_canvas_oauth_prompt_overlay__';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = 'rgba(0, 0, 0, 0.45)';
      overlay.style.backdropFilter = 'blur(2px)';
      overlay.style.webkitBackdropFilter = 'blur(2px)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = '2147483647';

      const panel = document.createElement('div');
      panel.style.width = 'min(520px, calc(100vw - 32px))';
      panel.style.background = 'rgba(24, 24, 27, 0.92)';
      panel.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      panel.style.borderRadius = '14px';
      panel.style.padding = '16px';
      panel.style.boxShadow = '0 20px 48px rgba(0, 0, 0, 0.35)';
      panel.style.color = '#f3f4f6';
      panel.style.fontFamily = "'Inter', 'Noto Sans KR', system-ui, sans-serif";

      const title = document.createElement('div');
      title.textContent = payload.message;
      title.style.fontSize = '14px';
      title.style.fontWeight = '600';
      title.style.marginBottom = '10px';
      title.style.lineHeight = '1.4';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = payload.placeholder ?? '';
      input.autocomplete = 'off';
      input.style.width = '100%';
      input.style.boxSizing = 'border-box';
      input.style.border = '1px solid rgba(255, 255, 255, 0.25)';
      input.style.background = 'rgba(255, 255, 255, 0.08)';
      input.style.color = '#f9fafb';
      input.style.borderRadius = '10px';
      input.style.padding = '10px 12px';
      input.style.outline = 'none';

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.justifyContent = 'flex-end';
      actions.style.gap = '8px';
      actions.style.marginTop = '12px';

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = 'Cancel';
      cancelButton.style.border = '1px solid rgba(255, 255, 255, 0.25)';
      cancelButton.style.background = 'rgba(255, 255, 255, 0.08)';
      cancelButton.style.color = '#f9fafb';
      cancelButton.style.borderRadius = '8px';
      cancelButton.style.padding = '8px 12px';
      cancelButton.style.cursor = 'pointer';

      const submitButton = document.createElement('button');
      submitButton.type = 'button';
      submitButton.textContent = 'Submit';
      submitButton.style.border = '1px solid rgba(96, 165, 250, 0.45)';
      submitButton.style.background = 'rgba(59, 130, 246, 0.35)';
      submitButton.style.color = '#f9fafb';
      submitButton.style.borderRadius = '8px';
      submitButton.style.padding = '8px 12px';
      submitButton.style.cursor = 'pointer';

      const cleanup = () => {
        overlay.remove();
      };

      const submit = () => {
        const value = input.value;
        if (!payload.allowEmpty && value.trim().length === 0) {
          input.style.border = '1px solid rgba(248, 113, 113, 0.9)';
          input.focus();
          return;
        }
        cleanup();
        resolve(value);
      };

      const cancel = () => {
        cleanup();
        resolve(null);
      };

      submitButton.addEventListener('click', submit);
      cancelButton.addEventListener('click', cancel);
      input.addEventListener('input', () => {
        input.style.border = '1px solid rgba(255, 255, 255, 0.25)';
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
      });

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          cancel();
        }
      });

      actions.appendChild(cancelButton);
      actions.appendChild(submitButton);
      panel.appendChild(title);
      panel.appendChild(input);
      panel.appendChild(actions);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      input.focus();
      input.select();
    });
  })();`;

  const rawValue = await sender.executeJavaScript(script, true);

  if (rawValue === null) {
    if (prompt.allowEmpty) {
      return '';
    }
    throw new Error('OAuth 입력이 취소되었습니다');
  }

  const value = String(rawValue);
  if (!prompt.allowEmpty && value.trim().length === 0) {
    throw new Error('필수 입력값이 비어 있습니다');
  }

  return value;
}

export function showOAuthInstructionDialog(
  sender: Electron.WebContents,
  info: RuntimeOAuthAuthInfo,
): void {
  const instructions = info.instructions?.trim();
  if (!instructions) {
    return;
  }

  const ownerWindow = BrowserWindow.fromWebContents(sender);
  const detail = [instructions, '', `URL: ${info.url}`].join('\n');

  const options: Electron.MessageBoxOptions = {
    type: 'info',
    title: 'OAuth 인증 안내',
    message: '브라우저에서 아래 안내에 따라 인증을 완료해주세요.',
    detail,
    buttons: ['확인'],
    defaultId: 0,
  };

  if (ownerWindow) {
    void dialog.showMessageBox(ownerWindow, options);
    return;
  }

  void dialog.showMessageBox(options);
}
