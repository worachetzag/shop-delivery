import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import './PopupProvider.css';

const PopupContext = createContext(null);
const POPUP_NOTIFY_EVENT = 'app-popup-notify';
let toastCounter = 1;

export const popupNotify = (message, options = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(POPUP_NOTIFY_EVENT, { detail: { message, ...options } }));
};

export const PopupProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message, options = {}) => {
    if (!message) return;
    const id = `toast-${toastCounter++}`;
    const type = options.type || 'info';
    const duration = Number(options.duration || 3000);
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => closeToast(id), duration);
  }, [closeToast]);

  const success = useCallback((message) => notify(message, { type: 'success' }), [notify]);
  const error = useCallback((message) => notify(message, { type: 'error' }), [notify]);
  const info = useCallback((message) => notify(message, { type: 'info' }), [notify]);

  const alert = useCallback((message, options = {}) => (
    new Promise((resolve) => {
      setDialog({
        mode: 'alert',
        title: options.title || 'แจ้งเตือน',
        message,
        okText: options.okText || 'ตกลง',
        resolve,
      });
    })
  ), []);

  const confirm = useCallback((message, options = {}) => (
    new Promise((resolve) => {
      setDialog({
        mode: 'confirm',
        title: options.title || 'ยืนยันการทำรายการ',
        message,
        confirmText: options.confirmText || 'ยืนยัน',
        cancelText: options.cancelText || 'ยกเลิก',
        tone: options.tone || 'primary',
        resolve,
      });
    })
  ), []);

  const closeDialog = useCallback((result) => {
    setDialog((current) => {
      if (current?.resolve) current.resolve(Boolean(result));
      return null;
    });
  }, []);

  useEffect(() => {
    const onNotify = (event) => {
      const { message, ...options } = event.detail || {};
      notify(message, options);
    };
    window.addEventListener(POPUP_NOTIFY_EVENT, onNotify);
    return () => window.removeEventListener(POPUP_NOTIFY_EVENT, onNotify);
  }, [notify]);

  const value = useMemo(() => ({
    notify,
    success,
    error,
    info,
    alert,
    confirm,
  }), [notify, success, error, info, alert, confirm]);

  return (
    <PopupContext.Provider value={value}>
      {children}

      <div className="popup-toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`popup-toast popup-toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => closeToast(toast.id)}>×</button>
          </div>
        ))}
      </div>

      {dialog && (
        <div className="popup-dialog-backdrop">
          <div className="popup-dialog">
            <div className="popup-dialog-header">{dialog.title}</div>
            <div className="popup-dialog-body">{dialog.message}</div>
            <div className="popup-dialog-actions">
              {dialog.mode === 'confirm' && (
                <button type="button" className="popup-btn popup-btn-cancel" onClick={() => closeDialog(false)}>
                  {dialog.cancelText}
                </button>
              )}
              <button
                type="button"
                className={`popup-btn ${dialog.tone === 'danger' ? 'popup-btn-danger' : 'popup-btn-confirm'}`}
                onClick={() => closeDialog(true)}
              >
                {dialog.mode === 'confirm' ? dialog.confirmText : dialog.okText}
              </button>
            </div>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  );
};

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within PopupProvider');
  }
  return context;
};
