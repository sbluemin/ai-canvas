import { useEffect, useState, useCallback } from 'react';
import { OpenAI } from '@lobehub/icons';
import { useStore } from '../../../store/useStore';


import './CodexAuthButton.css';

function LoadingSpinner() {
  return (
    <svg className="codex-auth-spinner" width="16" height="16" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
    </svg>
  );
}

export function CodexAuthButton() {
  const { isCodexAuthenticated, codexAuthLoading, setCodexAuthStatus, setCodexAuthLoading } = useStore();
  const [showTooltip, setShowTooltip] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  const checkAuthStatus = useCallback(async () => {
    if (!isElectron) {
      setCodexAuthLoading(false);
      return;
    }
    
    try {
      const status = await window.electronAPI.codex.authStatus();
      setCodexAuthStatus(status.isAuthenticated);
    } catch (error) {
      console.error('Failed to check Codex auth status:', error);
      setCodexAuthStatus(false);
    } finally {
      setCodexAuthLoading(false);
    }
  }, [isElectron, setCodexAuthStatus, setCodexAuthLoading]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleClick = async () => {
    if (!isElectron) return;
    
    if (isCodexAuthenticated) {
      setShowTooltip(true);
      return;
    }
    
    setActionLoading(true);
    try {
      const result = await window.electronAPI.codex.authStart();
      if (result.success) {
        setCodexAuthStatus(true);
      } else {
        console.error('Codex auth failed:', result.error);
      }
    } catch (error) {
      console.error('Codex auth error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!isElectron) return;
    
    setActionLoading(true);
    try {
      await window.electronAPI.codex.authLogout();
      setCodexAuthStatus(false);
      setShowTooltip(false);
    } catch (error) {
      console.error('Codex logout error:', error);
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

  if (codexAuthLoading) {
    return (
      <button className="codex-auth-button loading" disabled>
        <LoadingSpinner />
      </button>
    );
  }

  return (
    <div className="codex-auth-container">
      <button
        className={`codex-auth-button ${isCodexAuthenticated ? 'authenticated' : ''}`}
        onClick={handleClick}
        disabled={actionLoading}
        title={isCodexAuthenticated ? 'Codex 연결됨' : 'Codex 로그인'}
      >
        {actionLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <OpenAI size={20} />
            {isCodexAuthenticated && <span className="codex-auth-indicator" />}
          </>
        )}
      </button>
      
      {showTooltip && isCodexAuthenticated && (
        <div className="codex-auth-tooltip" onClick={(e) => e.stopPropagation()}>
          <div className="codex-auth-tooltip-status">
            <span className="codex-status-dot" />
            <span>Codex 연결됨</span>
          </div>
          <button className="codex-logout-button" onClick={handleLogout} disabled={actionLoading}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
