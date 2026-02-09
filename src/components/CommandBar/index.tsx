import './CommandBar.css';
import { ProjectSelector } from './ProjectSelector';
import { ModelSelector } from './ModelSelector';
import { ModelRefreshButton } from './ModelRefreshButton';
import { CodexAuthButton } from './CodexAuthButton';
import { AnthropicAuthButton } from './AnthropicAuthButton';
import { GeminiAuthButton } from './GeminiAuthButton';
import { useStore } from '../../store/useStore';
import { Logo } from '../Logo';

export function CommandBar() {
  const { toggleSettings, toggleExportModal, activeProvider } = useStore();

  return (
    <div className="command-bar">
      <div className="command-bar-left">
        <GeminiAuthButton />
        <CodexAuthButton />
        <AnthropicAuthButton />
        <ModelRefreshButton />
        <ModelSelector provider={activeProvider} />
      </div>
      <div className="command-bar-content">
        <div className="logo-container">
          <Logo />
        </div>
        <ProjectSelector />
      </div>
      <div className="command-bar-right">
        <button type="button" className="settings-btn" onClick={toggleExportModal} title="Export &amp; Share">
          Export
        </button>
        <div className="divider" style={{ width: 1, height: 16, background: 'var(--border-color)', margin: '0 8px' }} />
        <button type="button" className="settings-btn" onClick={toggleSettings} title="Settings (Ctrl+,)">
          Settings
        </button>
      </div>
    </div>
  );
}
