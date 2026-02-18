import { useState } from 'react';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { GearIcon, CpuIcon, CloseIcon } from './Icons';
import './SettingsModal.css';

type SettingsTab = 'general' | 'runtime';

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
  } = useStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  if (!isSettingsOpen) return null;

  const handleRuntimeLogin = async () => {
    setRuntimeBusy(true);
    setRuntimeError(null);
    try {
      const result = await api.runtimeOpenAuthTerminal(projectPath);
      if (!result.success) {
        setRuntimeError(result.error ?? '터미널 실행에 실패했습니다');
      }
    } finally {
      setRuntimeBusy(false);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <GearIcon /> },
    { id: 'runtime', label: 'AI Runtime', icon: <CpuIcon /> },
  ];

  return (
    <div className="settings-overlay" onClick={closeSettings}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
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
                    <span className="setting-description">앱의 외관 테마를 선택합니다</span>
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
                    <span className="setting-name">OPENCODE_CONFIG_DIR</span>
                    <span className="setting-description">OpenCode 런타임 설정 디렉토리</span>
                  </div>
                  <p className="settings-runtime-path">{runtimeStatus?.configDir || '사용 안 함 (Global Runtime)'}</p>
                </div>
                <div className="setting-row vertical">
                  <div className="setting-label">
                    <span className="setting-name">로그인</span>
                    <span className="setting-description">AI 모델 연결이 필요하면 아래 버튼으로 로그인하세요</span>
                  </div>
                  <button
                    type="button"
                    className="settings-runtime-login-btn"
                    onClick={handleRuntimeLogin}
                    disabled={runtimeBusy || runtimeStatus?.activeRuntime === 'none'}
                  >
                    터미널에서 로그인
                  </button>
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
