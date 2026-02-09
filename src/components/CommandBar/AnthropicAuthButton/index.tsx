import { Claude } from '@lobehub/icons';
import { useStore } from '../../../store/useStore';
import { SharedAuthButton } from '../SharedAuthButton';

export function AnthropicAuthButton() {
  const { isAnthropicAuthenticated, anthropicAuthLoading, setAnthropicAuthStatus, setAnthropicAuthLoading } = useStore();

  const api = (typeof window !== 'undefined' && (window as any).electronAPI ? (window as any).electronAPI.anthropic : {}) as any;

  return (
    <SharedAuthButton
      isAuthenticated={isAnthropicAuthenticated}
      authLoading={anthropicAuthLoading}
      setAuthStatus={setAnthropicAuthStatus}
      setAuthLoading={setAnthropicAuthLoading}
      api={api}
      icon={<Claude.Avatar size={20} />}
      label="Claude"
      themeColorRgb="204, 146, 91"
    />
  );
}
