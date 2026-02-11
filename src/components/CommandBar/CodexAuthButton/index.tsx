import { OpenAI } from '@lobehub/icons';
import { useStore } from '../../../store/useStore';
import { SharedAuthButton } from '../SharedAuthButton';

export function CodexAuthButton() {
  const { isCodexAuthenticated, codexAuthLoading, setCodexAuthStatus, setCodexAuthLoading } = useStore();

  const api = (typeof window !== 'undefined' && (window as any).electronAPI ? (window as any).electronAPI.codex : {}) as any;

  return (
    <SharedAuthButton
      isAuthenticated={isCodexAuthenticated}
      authLoading={codexAuthLoading}
      setAuthStatus={setCodexAuthStatus}
      setAuthLoading={setCodexAuthLoading}
      api={api}
      icon={<OpenAI size={20} />}
      label="Codex"
      themeColorRgb="142, 142, 147"
    />
  );
}
