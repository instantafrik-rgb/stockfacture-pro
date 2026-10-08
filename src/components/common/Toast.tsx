/**
 * StockFacture Pro - Toast Component
 * 
 * Notification visuelle temporaire pour confirmer une action utilisateur.
 * Supporte 4 types : success, error, warning, info.
 */

import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onClose: (id: string) => void;
}

const typeStyles: Record<ToastType, {
  bg: string;
  border: string;
  iconColor: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    Icon: CheckCircle2,
  },
  error: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    iconColor: 'text-rose-600',
    Icon: XCircle,
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-600',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    iconColor: 'text-sky-600',
    Icon: Info,
  },
};

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const style = typeStyles[toast.type];
  const Icon = style.Icon;

  useEffect(() => {
    const duration = toast.duration ?? 3500;
    if (duration <= 0) return;

    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 w-full sm:w-auto sm:min-w-[320px] sm:max-w-md p-4 rounded-2xl border ${style.border} ${style.bg} shadow-lg animate-in slide-in-from-top-2 fade-in duration-200`}
      role="alert"
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#14213D] leading-tight">
          {toast.message}
        </p>
        {toast.description && (
          <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-white/60 transition-colors"
        aria-label="Fermer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};