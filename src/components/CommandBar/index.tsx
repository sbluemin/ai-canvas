import './CommandBar.css';
import { ProjectSelector } from './ProjectSelector';
import { ModelSelector } from './ModelSelector';
import { ModelRefreshButton } from './ModelRefreshButton';
import { CodexAuthButton } from './CodexAuthButton';
import { AnthropicAuthButton } from './AnthropicAuthButton';
import { GeminiAuthButton } from './GeminiAuthButton';
import { useStore } from '../../store/useStore';

function AICanvasMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="AI Canvas">
      <defs>
        <linearGradient id="cb-grad" x1="5" y1="19" x2="20" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D8B4FE" />
          <stop offset="0.5" stopColor="#818CF8" />
          <stop offset="1" stopColor="#93C5FD" />
        </linearGradient>
        <filter id="cb-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.55" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <filter id="cb-sparkle" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.28" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* 캔버스 프레임 */}
      <g transform="translate(12 12) rotate(-8) translate(-12 -12)">
        <rect x="5.9" y="7.1" width="12.2" height="9.8" rx="2.6" fill="white" fillOpacity="0.10" stroke="white" strokeOpacity="0.22" strokeWidth="0.9" />
        <rect x="7.4" y="8.6" width="9.2" height="6.8" rx="2.0" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="0.7" />
      </g>

      {/* 메인 스트로크 + 하이라이트 */}
      <g filter="url(#cb-glow)">
        <path d="M6.4 16.2C8.5 13.6 10.6 13.0 13.4 11.3C15.0 10.4 16.2 9.5 17.5 8.2" stroke="url(#cb-grad)" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.7 16.5C8.8 13.9 10.9 13.3 13.7 11.6C15.3 10.7 16.5 9.8 17.8 8.5" stroke="white" strokeOpacity="0.3" strokeWidth="0.4" strokeLinecap="round" fill="none" style={{ mixBlendMode: 'overlay' as const }} />
      </g>

      {/* 스파클 포인트 */}
      <g transform="translate(18.4 7.4)" filter="url(#cb-sparkle)">
        <path d="M0 -2.25 C0.19 -0.75, 0.75 -0.19, 2.25 0 C0.75 0.19, 0.19 0.75, 0 2.25 C-0.19 0.75, -0.75 0.19, -2.25 0 C-0.75 -0.19, -0.19 -0.75, 0 -2.25Z" fill="#FFFFFF" />
        <circle r="0.56" fill="#D8B4FE" opacity="0.4" />
        <circle cx="-1.9" cy="1.4" r="0.28" fill="#93C5FD" opacity="0.9" />
        <circle cx="1.4" cy="1.9" r="0.38" fill="#D8B4FE" opacity="0.7" />
        <circle cx="1.9" cy="-0.9" r="0.19" fill="#FFFFFF" opacity="0.6" />
      </g>
    </svg>
  );
}

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
          <AICanvasMark />
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
