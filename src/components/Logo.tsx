import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="AI Canvas" {...props}>
      <defs>
        <linearGradient id="ai-canvas-logo-grad" x1="5" y1="19" x2="20" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D8B4FE" />
          <stop offset="0.5" stopColor="#818CF8" />
          <stop offset="1" stopColor="#93C5FD" />
        </linearGradient>
        <filter id="ai-canvas-logo-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.55" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <filter id="ai-canvas-logo-sparkle" x="-50%" y="-50%" width="200%" height="200%">
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
      <g filter="url(#ai-canvas-logo-glow)">
        <path d="M6.4 16.2C8.5 13.6 10.6 13.0 13.4 11.3C15.0 10.4 16.2 9.5 17.5 8.2" stroke="url(#ai-canvas-logo-grad)" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.7 16.5C8.8 13.9 10.9 13.3 13.7 11.6C15.3 10.7 16.5 9.8 17.8 8.5" stroke="white" strokeOpacity="0.3" strokeWidth="0.4" strokeLinecap="round" fill="none" style={{ mixBlendMode: 'overlay' as const }} />
      </g>

      {/* 스파클 포인트 */}
      <g transform="translate(18.4 7.4)" filter="url(#ai-canvas-logo-sparkle)">
        <path d="M0 -2.25 C0.19 -0.75, 0.75 -0.19, 2.25 0 C0.75 0.19, 0.19 0.75, 0 2.25 C-0.19 0.75, -0.75 0.19, -2.25 0 C-0.75 -0.19, -0.19 -0.75, 0 -2.25Z" fill="#FFFFFF" />
        <circle r="0.56" fill="#D8B4FE" opacity="0.4" />
        <circle cx="-1.9" cy="1.4" r="0.28" fill="#93C5FD" opacity="0.9" />
        <circle cx="1.4" cy="1.9" r="0.38" fill="#D8B4FE" opacity="0.7" />
        <circle cx="1.9" cy="-0.9" r="0.19" fill="#FFFFFF" opacity="0.6" />
      </g>
    </svg>
  );
}

export function DetailLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 512 512" fill="none" role="img" aria-label="AI Canvas Mark" {...props}>
      <defs>
        <linearGradient id="aic-grad-detail" x1="100" y1="400" x2="400" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D8B4FE"/>
          <stop offset="0.5" stopColor="#818CF8"/>
          <stop offset="1" stopColor="#93C5FD"/>
        </linearGradient>
        <filter id="aic-glow-detail" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <filter id="aic-sparkle-detail" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <g transform="translate(256 256) scale(1.15) translate(-256 -256)">
        {/* Canvas Frame */}
        <g transform="translate(256 256) rotate(-8) translate(-256 -256)">
          <rect x="132" y="156" width="260" height="208" rx="56" fill="white" fillOpacity="0.10" stroke="white" strokeOpacity="0.22" strokeWidth="10"/>
          <rect x="164" y="188" width="196" height="144" rx="44" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="8"/>
        </g>

        {/* Main Stroke + Highlight */}
        <g filter="url(#aic-glow-detail)">
          <path d="M 120 380 C 180 380, 180 280, 260 240 S 370 180, 400 130" stroke="url(#aic-grad-detail)" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M 130 370 C 185 370, 185 275, 260 235 S 360 175, 390 130" stroke="white" strokeOpacity="0.3" strokeWidth="8" strokeLinecap="round" fill="none" style={{ mixBlendMode: 'overlay' as const }}/>
        </g>

        {/* Sparkle Points */}
        <g transform="translate(410 110)" filter="url(#aic-sparkle-detail)">
          <path d="M 0 -48 C 4 -16, 16 -4, 48 0 C 16 4, 4 16, 0 48 C -4 16, -16 4, -48 0 C -16 -4, -4 -16, 0 -48 Z" fill="#FFFFFF"/>
          <circle r="12" fill="#D8B4FE" opacity="0.4"/>
          <circle cx="-40" cy="30" r="6" fill="#93C5FD" opacity="0.9"/>
          <circle cx="30" cy="40" r="8" fill="#D8B4FE" opacity="0.7"/>
          <circle cx="40" cy="-20" r="4" fill="#FFFFFF" opacity="0.6"/>
        </g>
      </g>
    </svg>
  );
}
