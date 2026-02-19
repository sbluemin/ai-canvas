import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import './ToastContainer.css';

const TOAST_DURATION = 3000;

const ToastIcons = {
  success: (
    <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M20 6L9 17L4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function ToastContainer() {
  const { toasts, removeToast } = useStore();

  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = window.setTimeout(() => {
      removeToast(toasts[0].id);
    }, TOAST_DURATION);

    return () => window.clearTimeout(timer);
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item ${toast.type}`}>
          <div className="toast-icon-wrapper">
            {ToastIcons[toast.type]}
          </div>
          <div className="toast-content">
            {toast.message}
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => removeToast(toast.id)}
            aria-label="Close notification"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="toast-progress" />
        </div>
      ))}
    </div>
  );
}
