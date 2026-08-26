import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, X, ExternalLink } from 'lucide-react';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  method?: string;
  pathname?: string;
  status?: number;
  timestamp: number;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  showToast: () => {},
  removeToast: () => {},
  clearAllToasts: () => {}
});

type ToastListener = (toast: Omit<ToastItem, 'id' | 'timestamp'>) => void;
const listeners = new Set<ToastListener>();

export const notifyApiError = (detail: {
  method: string;
  pathname: string;
  message: string;
  status?: number;
}) => {
  const toastData: Omit<ToastItem, 'id' | 'timestamp'> = {
    type: 'error',
    title: detail.status ? `API Error (${detail.status})` : 'Network Error',
    message: detail.message || 'Failed to communicate with server',
    method: detail.method,
    pathname: detail.pathname,
    status: detail.status,
    duration: 6000
  };

  listeners.forEach((listener) => listener(toastData));
};

export const notifyApiSuccess = (detail: {
  method: string;
  pathname: string;
  message?: string;
  title?: string;
}) => {
  const toastData: Omit<ToastItem, 'id' | 'timestamp'> = {
    type: 'success',
    title: detail.title || 'Request Successful',
    message: detail.message || `Successfully processed ${detail.method} ${detail.pathname}`,
    method: detail.method,
    pathname: detail.pathname,
    duration: 4000
  };

  listeners.forEach((listener) => listener(toastData));
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback((toastInput: Omit<ToastItem, 'id' | 'timestamp'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = {
      ...toastInput,
      id,
      timestamp: Date.now()
    };

    setToasts((prev) => [newToast, ...prev].slice(0, 5));

    const duration = toastInput.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  useEffect(() => {
    const handleGlobalToast = (toastInput: Omit<ToastItem, 'id' | 'timestamp'>) => {
      showToast(toastInput);
    };

    listeners.add(handleGlobalToast);
    return () => {
      listeners.delete(handleGlobalToast);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, clearAllToasts }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

function ToastContainer({
  toasts,
  removeToast
}: {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-card border border-border shadow-2xl rounded-2xl p-4 flex gap-3 items-start animate-fadeIn transition-all duration-300 hover:border-primary/40 group backdrop-blur-xl"
        >
          {/* Icon */}
          <div className="shrink-0 mt-0.5">
            {toast.type === 'error' && (
              <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            {toast.type === 'success' && (
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle className="w-5 h-5" />
              </div>
            )}
            {toast.type === 'warning' && (
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            {toast.type === 'info' && (
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Info className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-black tracking-wide text-white uppercase">{toast.title}</h4>
              <span className="text-[10px] font-mono text-muted">
                {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-medium leading-relaxed break-words">
              {toast.message}
            </p>

            {toast.method && toast.pathname && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-bold">
                  {toast.method} {toast.pathname}
                </span>
                {toast.type === 'error' && (
                  <a
                    href="/diagnostics"
                    className="text-[10px] text-muted hover:text-white flex items-center gap-1 underline underline-offset-2 transition-colors ml-auto"
                  >
                    <span>Diagnostics</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => removeToast(toast.id)}
            className="text-muted hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
