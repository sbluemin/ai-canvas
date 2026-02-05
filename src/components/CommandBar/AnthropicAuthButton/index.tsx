import { useEffect, useState, useCallback } from 'react';
import { Claude } from '@lobehub/icons';
import { useStore } from '../../../store/useStore';
import './AnthropicAuthButton.css';

function LoadingSpinner() {
  return (
    <svg className="anthropic-auth-spinner" width="16" height="16" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
    </svg>
  );
}

export function AnthropicAuthButton() {
  const { isAnthropicAuthenticated, anthropicAuthLoading, setAnthropicAuthStatus, setAnthropicAuthLoading } = useStore();
  const [showTooltip, setShowTooltip] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  const checkAuthStatus = useCallback(async () => {
    if (!isElectron) {
      setAnthropicAuthLoading(false);
      return;
    }
    
    try {
      const status = await window.electronAPI.anthropic.authStatus();
      setAnthropicAuthStatus(status.isAuthenticated);
    } catch (error) {
      console.error('Failed to check Anthropic auth status:', error);
      setAnthropicAuthStatus(false);
    } finally {
      setAnthropicAuthLoading(false);
    }
  }, [isElectron, setAnthropicAuthStatus, setAnthropicAuthLoading]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleClick = async () => {
    if (!isElectron) return;
    
    if (isAnthropicAuthenticated) {
      setShowTooltip(true);
      return;
    }
    
    setActionLoading(true);
    try {
      const result = await window.electronAPI.anthropic.authStart();
      if (result.success) {
        setAnthropicAuthStatus(true);
      } else {
        console.error('Anthropic auth failed:', result.error);
      }
    } catch (error) {
      console.error('Anthropic auth error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!isElectron) return;
    
    setActionLoading(true);
    try {
      await window.electronAPI.anthropic.authLogout();
      setAnthropicAuthStatus(false);
      setShowTooltip(false);
    } catch (error) {
      console.error('Anthropic logout error:', error);
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

  if (anthropicAuthLoading) {
    return (
      <button className="anthropic-auth-button loading" disabled>
        <LoadingSpinner />
      </button>
    );
  }

  return (
    <div className="anthropic-auth-container">
      <button
        className={`anthropic-auth-button ${isAnthropicAuthenticated ? 'authenticated' : ''}`}
        onClick={handleClick}
        disabled={actionLoading}
        title={isAnthropicAuthenticated ? 'Claude 연결됨' : 'Claude 로그인'}
      >
        {actionLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <Claude.Avatar size={20} />
            {isAnthropicAuthenticated && <span className="anthropic-auth-indicator" />}
          </>
        )}
      </button>
      
      {showTooltip && isAnthropicAuthenticated && (
        <div className="anthropic-auth-tooltip" onClick={(e) => e.stopPropagation()}>
          <div className="anthropic-auth-tooltip-status">
            <span className="anthropic-status-dot" />
            <span>Claude 연결됨</span>
          </div>
          <button className="anthropic-logout-button" onClick={handleLogout} disabled={actionLoading}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
