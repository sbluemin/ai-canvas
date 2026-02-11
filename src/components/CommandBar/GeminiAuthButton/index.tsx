import { Gemini } from '@lobehub/icons';
import { useStore } from '../../../store/useStore';
import { SharedAuthButton } from '../SharedAuthButton';

export function GeminiAuthButton() {
  const { isAuthenticated, authLoading, setAuthStatus, setAuthLoading } = useStore();

  const api = (typeof window !== 'undefined' && (window as any).electronAPI ? (window as any).electronAPI.gemini : {}) as any;

  return (
    <SharedAuthButton
      isAuthenticated={isAuthenticated}
      authLoading={authLoading}
      setAuthStatus={setAuthStatus}
      setAuthLoading={setAuthLoading}
      api={api}
      icon={<Gemini.Color size={20} />}
      label="Gemini"
      themeColorRgb="66, 133, 244"
    />
  );
}
