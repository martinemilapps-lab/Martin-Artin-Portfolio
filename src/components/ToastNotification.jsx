import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastNotification = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const duration = toast.duration || 4000;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 size={18} className="toast-icon success" />,
    error: <AlertCircle size={18} className="toast-icon error" />,
    warning: <AlertTriangle size={18} className="toast-icon warning" />,
    info: <Info size={18} className="toast-icon info" />
  };

  return (
    <div className={`toast-container toast-${toast.type || 'info'}`} role="status" aria-live="polite">
      <div className="toast-content">
        {icons[toast.type || 'info']}
        <div className="toast-text-wrap">
          {toast.title && <div className="toast-title">{toast.title}</div>}
          <div className="toast-message">{toast.message}</div>
        </div>
      </div>
      <button className="toast-close-btn" onClick={onClose} aria-label="Close notification">
        <X size={14} />
      </button>
    </div>
  );
};
