import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type RuntimeAuthProvider,
  type RuntimeAuthProviderId,
  type RuntimeAuthSnapshot,
} from '../api';
import { useStore } from '../store/useStore';
import { GearIcon, CpuIcon, CloseIcon } from './Icons';
import './SettingsModal.css';

type SettingsTab = 'general' | 'runtime';

const AUTH_PROVIDER_ORDER: RuntimeAuthProviderId[] = ['anthropic', 'openai-codex', 'github-copilot'];

export function SettingsModal() {
  const {
    isSettingsOpen,
    closeSettings,
    settings,
    setTheme,
    projectPath,
    runtimeStatus,
    runtimeBusy,
    runtimeError,
    setRuntimeBusy,
    setRuntimeError,
    setRuntimeStatus,
  } = useStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [providers, setProviders] = useState<RuntimeAuthProvider[]>([]);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<RuntimeAuthProviderId, string>>({
    anthropic: '',
    'openai-codex': '',
    'github-copilot': '',
  });

  const orderedProviders = useMemo(() => {
    const byId = new Map((providers ?? []).map((provider) => [provider.id, provider]));
    return AUTH_PROVIDER_ORDER.map((id) => byId.get(id)).filter((provider): provider is NonNullable<typeof provider> => Boolean(provider));
  }, [providers]);

  const syncFromSnapshot = useCallback((snapshot: RuntimeAuthSnapshot | undefined) => {
    if (!snapshot) return;
    setProviders(snapshot.providers);
    setRuntimeStatus(snapshot.status);
  }, [setRuntimeStatus]);

  const loadProviders = useCallback(async () => {
    setRuntimeBusy(true);
    setRuntimeError(null);
    try {
      const result = await api.runtimeListAuthProviders(projectPath);
      if (result.success && result.data) {
        syncFromSnapshot(result.data);
        return;
      }
      setRuntimeError(result.error ?? '인증 provider 상태를 불러오지 못했습니다');
    } finally {
      setRuntimeBusy(false);
    }
  }, [projectPath, setRuntimeBusy, setRuntimeError, syncFromSnapshot]);

  useEffect(() => {
    if (!isSettingsOpen || activeTab !== 'runtime') return;
    void loadProviders();
  }, [isSettingsOpen, activeTab, loadProviders]);

  if (!isSettingsOpen) return null;

  const saveApiKey = async (providerId: RuntimeAuthProviderId) => {
    setRuntimeBusy(true);
    setRuntimeError(null);
    try {
      const key = apiKeyInputs[providerId] ?? '';
      const result = await api.runtimeSetApiKey(providerId, key, projectPath);
      if (result.success && result.data) {
        syncFromSnapshot(result.data);
        return;
      }
      setRuntimeError(result.error ?? 'API Key 저장에 실패했습니다');
    } finally {
      setRuntimeBusy(false);
    }
  };

  const loginOAuth = async (providerId: RuntimeAuthProviderId) => {
    setRuntimeBusy(true);
    setRuntimeError(null);
    try {
      const result = await api.runtimeLoginOAuth(providerId, projectPath);
      if (result.success && result.data) {
        syncFromSnapshot(result.data);
        return;
      }
      setRuntimeError(result.error ?? 'OAuth 로그인에 실패했습니다');
    } finally {
      setRuntimeBusy(false);
    }
  };

  const logoutProvider = async (providerId: RuntimeAuthProviderId) => {
    setRuntimeBusy(true);
    setRuntimeError(null);
    try {
      const result = await api.runtimeLogoutProvider(providerId, projectPath);
      if (result.success && result.data) {
        syncFromSnapshot(result.data);
        return;
      }
      setRuntimeError(result.error ?? '로그아웃에 실패했습니다');
    } finally {
      setRuntimeBusy(false);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <GearIcon /> },
    { id: 'runtime', label: 'AI Runtime', icon: <CpuIcon /> },
  ];

  return (
    <div className="settings-overlay">
      <button
        type="button"
        className="settings-backdrop"
        onClick={closeSettings}
        aria-label="Close settings"
      />
      <div className="settings-modal">
        <aside className="settings-sidebar">
          <div className="sidebar-header">
            <h3>Settings</h3>
          </div>
          <nav className="sidebar-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="settings-content">
          <header className="content-header">
            <h4 className="content-title">{tabs.find((t) => t.id === activeTab)?.label}</h4>
            <button type="button" className="close-button" onClick={closeSettings} aria-label="Close settings">
              <CloseIcon />
            </button>
          </header>
          <div className="content-body">
            {activeTab === 'general' && (
              <div className="settings-section">
                <div className="setting-row">
                  <div className="setting-label">
                    <span className="setting-name">Theme</span>
                    <span className="setting-description">Choose the app appearance theme</span>
                  </div>
                  <select
                    id="theme-select"
                    value={settings.theme}
                    onChange={(e) => setTheme(e.target.value as 'dark' | 'light' | 'system')}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'runtime' && (
              <div className="settings-section">
                <div className="setting-row vertical">
                  <div className="setting-label">
                    <span className="setting-name">Runtime Auth</span>
                    <span className="setting-description">
                      API Key 또는 OAuth를 연결하면 모델 목록과 채팅이 활성화됩니다.
                    </span>
                  </div>

                  <div className="settings-runtime-status-row">
                    <span className={`settings-runtime-dot ${runtimeStatus?.activeRuntime === 'none' ? 'missing' : 'ready'}`} />
                    <span className="settings-runtime-status-text">
                      {runtimeStatus?.activeRuntime === 'none' ? 'Auth Required' : 'Runtime Ready'}
                    </span>
                    <button
                      type="button"
                      className="settings-runtime-refresh-btn"
                      onClick={loadProviders}
                      disabled={runtimeBusy}
                    >
                      {runtimeBusy ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>

                  <div className="settings-runtime-provider-list">
                    {orderedProviders.map((provider) => (
                      <div key={provider.id} className={`settings-runtime-provider-card ${provider.connected ? 'connected' : 'idle'}`}>
                        <div className="settings-runtime-provider-head">
                          <span className="settings-runtime-provider-name">{provider.label}</span>
                          <span className={`settings-runtime-provider-badge ${provider.connected ? 'connected' : 'idle'}`}>
                            {provider.connected
                              ? provider.credentialType === 'oauth'
                                ? 'Connected (OAuth)'
                                : 'Connected (API Key)'
                              : 'Not Connected'}
                          </span>
                        </div>

                        {provider.apiKeySupported && (
                          <div className="settings-runtime-provider-actions">
                            <input
                              type="password"
                              className="settings-runtime-input"
                              placeholder="Enter API Key"
                              value={apiKeyInputs[provider.id]}
                              onChange={(event) =>
                                setApiKeyInputs((prev) => ({
                                  ...prev,
                                  [provider.id]: event.target.value,
                                }))
                              }
                              disabled={runtimeBusy}
                            />
                            <button
                              type="button"
                              className="settings-runtime-action-btn"
                              onClick={() => saveApiKey(provider.id)}
                              disabled={runtimeBusy}
                            >
                              Save API Key
                            </button>
                          </div>
                        )}

                        {provider.oauthSupported && (
                          <div className="settings-runtime-provider-actions">
                            <button
                              type="button"
                              className="settings-runtime-action-btn"
                              onClick={() => loginOAuth(provider.id)}
                              disabled={runtimeBusy}
                            >
                              Login with OAuth
                            </button>
                          </div>
                        )}

                        {provider.connected && (
                          <div className="settings-runtime-provider-actions">
                            <button
                              type="button"
                              className="settings-runtime-action-btn danger"
                              onClick={() => logoutProvider(provider.id)}
                              disabled={runtimeBusy}
                            >
                              Logout
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {runtimeError && <p className="settings-runtime-error">{runtimeError}</p>}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
