import './CommandBar.css';
import { ProjectSelector } from './ProjectSelector';

function AICanvasMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="AI Canvas">
      <defs>
        <linearGradient id="ps-accent" x1="5" y1="19" x2="20" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="0.5" stopColor="#818CF8" />
          <stop offset="1" stopColor="#C084FC" />
        </linearGradient>
        <linearGradient id="ps-accent2" x1="6" y1="20" x2="20" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="0.45" stopColor="#60A5FA" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>

      {/* 캔버스 프레임 */}
      <g transform="translate(12 12) rotate(-8) translate(-12 -12)">
        <rect x="5.9" y="7.1" width="12.2" height="9.8" rx="2.6" fill="white" fillOpacity="0.10" stroke="white" strokeOpacity="0.22" strokeWidth="0.9" />
        <rect x="7.4" y="8.6" width="9.2" height="6.8" rx="2.0" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="0.7" />
      </g>

      {/* AI 스트로크 */}
      <path d="M6.4 16.2C8.5 13.6 10.6 13.0 13.4 11.3C15.0 10.4 16.2 9.5 17.5 8.2" stroke="url(#ps-accent)" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.7 16.5C8.8 13.9 10.9 13.3 13.7 11.6C15.3 10.7 16.5 9.8 17.8 8.5" stroke="url(#ps-accent2)" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />

      {/* 스파클 */}
      <path d="M18.4 4.7L19.2 6.6L21.1 7.4L19.2 8.2L18.4 10.1L17.6 8.2L15.7 7.4L17.6 6.6Z" fill="white" fillOpacity="0.95" />
      <circle cx="17.7" cy="8.8" r="0.9" fill="url(#ps-accent)" />
    </svg>
  );
}

export function CommandBar() {
  return (
    <div className="command-bar">
      <div className="command-bar-content">
        <div className="logo-container">
          <AICanvasMark />
        </div>
        <ProjectSelector />
      </div>
    </div>
  );
}
