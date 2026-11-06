"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.type}`} role="alert">
            <span className="inline-flex items-center justify-center shrink-0" aria-hidden="true">
              {toast.type === "success" && <CheckCircle2 size={16} className="text-emerald-500" />}
              {toast.type === "error" && <XCircle size={16} className="text-rose-500" />}
              {toast.type === "warning" && <AlertTriangle size={16} className="text-amber-500" />}
              {toast.type === "info" && <Info size={16} className="text-[#216A85]" />}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0.25rem",
                color: "var(--text-muted)",
                minWidth: "var(--touch-target-min, 2.75rem)",
                minHeight: "var(--touch-target-min, 2.75rem)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Close notification"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback if invoked outside ToastProvider
    return {
      showToast: (msg: string) => {
        if (typeof window !== "undefined") {
          console.log("[Toast fallback]:", msg);
        }
      },
    };
  }
  return ctx;
}
