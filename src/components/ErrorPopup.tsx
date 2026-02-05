import { useStore } from '../store/useStore';
import './ErrorPopup.css';

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function ErrorPopup() {
  const { errorPopup, clearError } = useStore();

  if (!errorPopup) return null;

  return (
    <div className="error-popup-overlay" onClick={clearError}>
      <div className="error-popup" onClick={(e) => e.stopPropagation()}>
        <div className="error-popup-header">
          <div className="error-icon">
            <ErrorIcon />
          </div>
          <span className="error-title">{errorPopup.title}</span>
          <button className="error-close-btn" onClick={clearError}>
            <CloseIcon />
          </button>
        </div>
        <div className="error-popup-content">
          <p className="error-message">{errorPopup.message}</p>
          {errorPopup.details && (
            <details className="error-details">
              <summary>상세 정보</summary>
              <pre>{errorPopup.details}</pre>
            </details>
          )}
        </div>
        <div className="error-popup-footer">
          <button className="error-confirm-btn" onClick={clearError}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
