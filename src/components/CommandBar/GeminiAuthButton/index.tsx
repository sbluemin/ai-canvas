import { useEffect, useState, useCallback } from 'react';
import { Gemini } from '@lobehub/icons';
import { useStore } from '../../../store/useStore';


import './GeminiAuthButton.css';

function LoadingSpinner() {
  return (
    <svg className="auth-spinner" width="16" height="16" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
    </svg>
  );
}

export function GeminiAuthButton() {
  const { isAuthenticated, authLoading, setAuthStatus, setAuthLoading } = useStore();
  const [showTooltip, setShowTooltip] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  const checkAuthStatus = useCallback(async () => {
    if (!isElectron) {
      setAuthLoading(false);
      return;
    }
    
    try {
      const status = await window.electronAPI.gemini.authStatus();
      setAuthStatus(status.isAuthenticated);
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setAuthStatus(false);
    } finally {
      setAuthLoading(false);
    }
  }, [isElectron, setAuthStatus, setAuthLoading]);

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
      const result = await window.electronAPI.gemini.authStart();
      if (result.success) {
        setAuthStatus(true);
      } else {
        console.error('Auth failed:', result.error);
      }
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!isElectron) return;
    
    setActionLoading(true);
    try {
      await window.electronAPI.gemini.authLogout();
      setAuthStatus(false);
      setShowTooltip(false);
    } catch (error) {
      console.error('Logout error:', error);
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

  if (authLoading) {
    return (
      <button className="gemini-auth-button loading" disabled>
        <LoadingSpinner />
      </button>
    );
  }

  return (
    <div className="gemini-auth-container">
      <button
        className={`gemini-auth-button ${isAuthenticated ? 'authenticated' : ''}`}
        onClick={handleClick}
        disabled={actionLoading}
        title={isAuthenticated ? 'Gemini 연결됨' : 'Gemini 로그인'}
      >
        {actionLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <Gemini.Color size={20} />
            {isAuthenticated && <span className="auth-indicator" />}
          </>
        )}
      </button>
      
      {showTooltip && isAuthenticated && (
        <div className="auth-tooltip" onClick={(e) => e.stopPropagation()}>
          <div className="auth-tooltip-status">
            <span className="status-dot" />
            <span>Gemini 연결됨</span>
          </div>
          <button className="logout-button" onClick={handleLogout} disabled={actionLoading}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
