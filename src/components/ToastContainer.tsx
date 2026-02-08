import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import './ToastContainer.css';

export function ToastContainer() {
  const { toasts, removeToast } = useStore();

  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = window.setTimeout(() => {
      removeToast(toasts[0].id);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item ${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
