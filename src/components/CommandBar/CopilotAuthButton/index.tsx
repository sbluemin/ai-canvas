import { useEffect, useState, useCallback } from 'react';
import { GithubCopilot } from '@lobehub/icons';
import { useStore } from '../../../store/useStore';
import './CopilotAuthButton.css';

function LoadingSpinner() {
  return (
    <svg className="copilot-auth-spinner" width="16" height="16" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
    </svg>
  );
}

export function CopilotAuthButton() {
  const { isCopilotAuthenticated, copilotAuthLoading, setCopilotAuthStatus, setCopilotAuthLoading } = useStore();
  const [showTooltip, setShowTooltip] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  const checkAuthStatus = useCallback(async () => {
    if (!isElectron) {
      setCopilotAuthLoading(false);
      return;
    }
    
    try {
      const status = await window.electronAPI.copilot.authStatus();
      setCopilotAuthStatus(status.isAuthenticated);
    } catch (error) {
      console.error('Failed to check Copilot auth status:', error);
      setCopilotAuthStatus(false);
    } finally {
      setCopilotAuthLoading(false);
    }
  }, [isElectron, setCopilotAuthStatus, setCopilotAuthLoading]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleClick = async () => {
    if (!isElectron) return;
    
    if (isCopilotAuthenticated) {
      setShowTooltip(true);
      return;
    }
    
    setActionLoading(true);
    try {
      const result = await window.electronAPI.copilot.authStart();
      if (result.success) {
        setCopilotAuthStatus(true);
      } else {
        console.error('Copilot auth failed:', result.error);
      }
    } catch (error) {
      console.error('Copilot auth error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!isElectron) return;
    
    setActionLoading(true);
    try {
      await window.electronAPI.copilot.authLogout();
      setCopilotAuthStatus(false);
      setShowTooltip(false);
    } catch (error) {
      console.error('Copilot logout error:', error);
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

  if (copilotAuthLoading) {
    return (
      <button className="copilot-auth-button loading" disabled>
        <LoadingSpinner />
      </button>
    );
  }

  return (
    <div className="copilot-auth-container">
      <button
        className={`copilot-auth-button ${isCopilotAuthenticated ? 'authenticated' : ''}`}
        onClick={handleClick}
        disabled={actionLoading}
        title={isCopilotAuthenticated ? 'GitHub Copilot 연결됨' : 'GitHub Copilot 로그인'}
      >
        {actionLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <GithubCopilot size={20} />
            {isCopilotAuthenticated && <span className="copilot-auth-indicator" />}
          </>
        )}
      </button>
      
      {showTooltip && isCopilotAuthenticated && (
        <div className="copilot-auth-tooltip" onClick={(e) => e.stopPropagation()}>
          <div className="copilot-auth-tooltip-status">
            <span className="copilot-status-dot" />
            <span>GitHub Copilot 연결됨</span>
          </div>
          <button className="copilot-logout-button" onClick={handleLogout} disabled={actionLoading}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
