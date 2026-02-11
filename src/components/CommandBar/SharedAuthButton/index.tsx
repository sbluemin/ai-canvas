import { useEffect, useState, useCallback, CSSProperties, ReactNode } from 'react';
import './SharedAuthButton.css';

// Define the interface locally to avoid dependency on global window type augmentation being present
interface AuthStatus {
  isAuthenticated: boolean;
  expiresAt?: number;
}

interface AuthResult {
  success: boolean;
  error?: string;
}

export interface AuthProviderApi {
  authStart: () => Promise<AuthResult>;
  authStatus: () => Promise<AuthStatus>;
  authLogout: () => Promise<AuthResult>;
}

interface SharedAuthButtonProps {
  isAuthenticated: boolean;
  authLoading: boolean;
  setAuthStatus: (status: boolean) => void;
  setAuthLoading: (loading: boolean) => void;
  api: AuthProviderApi;
  icon: ReactNode;
  label: string;
  themeColorRgb: string; // e.g. "66, 133, 244"
}

function LoadingSpinner() {
  return (
    <svg className="auth-spinner" width="16" height="16" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
    </svg>
  );
}

export function SharedAuthButton({
  isAuthenticated,
  authLoading,
  setAuthStatus,
  setAuthLoading,
  api,
  icon,
  label,
  themeColorRgb,
}: SharedAuthButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

  const checkAuthStatus = useCallback(async () => {
    if (!isElectron) {
      setAuthLoading(false);
      return;
    }

    try {
      const status = await api.authStatus();
      setAuthStatus(status.isAuthenticated);
    } catch (error) {
      console.error(`Failed to check ${label} auth status:`, error);
      setAuthStatus(false);
    } finally {
      setAuthLoading(false);
    }
  }, [isElectron, setAuthStatus, setAuthLoading, api, label]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleClick = async () => {
    if (!isElectron) return;

    if (isAuthenticated) {
      setShowTooltip(true);
      return;
    }

    setActionLoading(true);
    try {
      const result = await api.authStart();
      if (result.success) {
        setAuthStatus(true);
      } else {
        console.error(`${label} auth failed:`, result.error);
      }
    } catch (error) {
      console.error(`${label} auth error:`, error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!isElectron) return;

    setActionLoading(true);
    try {
      await api.authLogout();
      setAuthStatus(false);
      setShowTooltip(false);
    } catch (error) {
      console.error(`${label} logout error:`, error);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (!showTooltip) return;

    const handleClickOutside = () => setShowTooltip(false);
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showTooltip]);

  const style = {
    '--theme-rgb': themeColorRgb,
  } as CSSProperties;

  if (authLoading) {
    return (
      <div className="auth-container" style={style}>
        <button className="auth-button loading" disabled>
          <LoadingSpinner />
        </button>
      </div>
    );
  }

  return (
    <div className="auth-container" style={style}>
      <button
        className={`auth-button ${isAuthenticated ? 'authenticated' : ''}`}
        onClick={handleClick}
        disabled={actionLoading}
        title={isAuthenticated ? `${label} 연결됨` : `${label} 로그인`}
      >
        {actionLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {icon}
            {isAuthenticated && <span className="auth-indicator" />}
          </>
        )}
      </button>

      {showTooltip && isAuthenticated && (
        <div className="auth-tooltip" onClick={(e) => e.stopPropagation()}>
          <div className="auth-tooltip-status">
            <span className="status-dot" />
            <span>{label} 연결됨</span>
          </div>
          <button className="logout-button" onClick={handleLogout} disabled={actionLoading}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
