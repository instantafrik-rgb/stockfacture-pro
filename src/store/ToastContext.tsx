/**
 * StockFacture Pro - Toast Context
 * 
 * Fournit une API simple pour afficher des notifications visuelles depuis
 * n'importe quel composant de l'application.
 * 
 * Usage :
 *   const { showToast } = useToast();
 *   showToast('success', 'Produit ajouté');
 *   showToast('error', 'Erreur', 'Détails de l'erreur…');
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import { Toast, ToastData, ToastType } from '../components/common/Toast';

interface ToastContextValue {
  showToast: (type: ToastType, message: string, description?: string, duration?: number) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, description?: string, duration?: number) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newToast: ToastData = { id, type, message, description, duration };
      setToasts((prev) => [...prev, newToast].slice(-3)); // max 3 toasts simultanés

      // Auto-dismiss après 3.5 secondes par défaut
      const autoDismissMs = duration ?? 3500;
      if (autoDismissMs > 0) {
        setTimeout(() => dismissToast(id), autoDismissMs);
      }
    },
    [dismissToast]
  );

  const success = useCallback((msg: string, desc?: string) => showToast('success', msg, desc), [showToast]);
  const error = useCallback((msg: string, desc?: string) => showToast('error', msg, desc), [showToast]);
  const warning = useCallback((msg: string, desc?: string) => showToast('warning', msg, desc), [showToast]);
  const info = useCallback((msg: string, desc?: string) => showToast('info', msg, desc), [showToast]);

  const value: ToastContextValue = {
    showToast,
    success,
    error,
    warning,
    info,
    dismissToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast Container — fixed en haut à droite sur desktop, en haut centré sur mobile */}
      <div
        className="fixed top-4 left-0 right-0 z-[9999] flex flex-col items-center sm:items-end sm:right-4 sm:left-auto gap-2 px-4 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}