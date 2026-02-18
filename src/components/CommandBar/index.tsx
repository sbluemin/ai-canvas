import './CommandBar.css';
import { ProjectSelector } from './ProjectSelector';
import { ModelSelector } from './ModelSelector';
import { ModelRefreshButton } from './ModelRefreshButton';
import { RuntimeStatusBadge } from './RuntimeStatus';
import { useStore } from '../../store/useStore';

export function CommandBar() {
  const { toggleSettings, toggleExportModal, toggleWritingGoal, activeWritingGoal } = useStore();

  return (
    <div className="command-bar">
      <div className="command-bar-left">
        <ModelRefreshButton />
        <ModelSelector />
        <RuntimeStatusBadge />
      </div>
      <div className="command-bar-content">
        <ProjectSelector />
      </div>
      <div className="command-bar-right">
        <button
          type="button"
          className={`settings-btn${activeWritingGoal ? ' active-goal' : ''}`}
          onClick={toggleWritingGoal}
          title="Writing Goal"
        >
          <svg className="settings-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
          </svg>
          Goal
        </button>
        <button type="button" className="settings-btn" onClick={toggleExportModal} title="Export & Share">
          <svg className="settings-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 3H3" /><path d="M12 21V7" /><path d="m6 13 6-6 6 6" />
          </svg>
          Export
        </button>
        <div className="command-bar-divider" />
        <button type="button" className="settings-btn" onClick={toggleSettings} title="Settings (Ctrl+,)">
          <svg className="settings-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Settings
        </button>
      </div>
    </div>
  );
}
