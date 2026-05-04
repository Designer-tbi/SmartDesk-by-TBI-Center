/**
 * Lightweight toast notification system — a drop-in replacement for
 * `react-hot-toast` that covers our 5-case surface without pulling a
 * 50KB dependency. Toasts are stored in a single subscribe-able
 * queue and rendered once by `<ToastHost />` mounted in App.tsx.
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  ttl: number;
}

type Listener = (toasts: ToastItem[]) => void;

const state: { toasts: ToastItem[]; listeners: Set<Listener>; counter: number } = {
  toasts: [],
  listeners: new Set(),
  counter: 0,
};

const emit = () => state.listeners.forEach((l) => l([...state.toasts]));

export const pushToast = (message: string, kind: ToastKind = 'info', ttl = 5000) => {
  const id = ++state.counter;
  state.toasts.push({ id, kind, message, ttl });
  emit();
  window.setTimeout(() => dismissToast(id), ttl);
  return id;
};

export const toast = {
  success: (m: string, ttl?: number) => pushToast(m, 'success', ttl),
  error: (m: string, ttl?: number) => pushToast(m, 'error', ttl),
  info: (m: string, ttl?: number) => pushToast(m, 'info', ttl),
};

export const dismissToast = (id: number) => {
  state.toasts = state.toasts.filter((t) => t.id !== id);
  emit();
};

/**
 * Global toast host — mount once near the root.
 */
export const ToastHost: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => {
    const l: Listener = (t) => setToasts(t);
    state.listeners.add(l);
    l(state.toasts);
    return () => {
      state.listeners.delete(l);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm"
      data-testid="toast-host"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle : t.kind === 'error' ? AlertCircle : Info;
        const theme =
          t.kind === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : t.kind === 'error'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-slate-50 border-slate-200 text-slate-800';
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-4 rounded-2xl border shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-right-5 ${theme}`}
            data-testid={`toast-${t.kind}`}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm font-semibold leading-snug">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className="p-1 hover:bg-black/5 rounded-lg shrink-0"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
