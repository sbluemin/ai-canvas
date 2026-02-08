import { useStore } from '../store/useStore';
import './SettingsModal.css';

export function SettingsModal() {
  const { isSettingsOpen, closeSettings, settings, setTheme } = useStore();

  if (!isSettingsOpen) return null;

  return (
    <div className="settings-overlay" onClick={closeSettings}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Settings</h3>
          <button type="button" onClick={closeSettings} aria-label="Close settings">Close</button>
        </div>
        <div className="settings-body">
          <label htmlFor="theme-select">Theme</label>
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
    </div>
  );
}
