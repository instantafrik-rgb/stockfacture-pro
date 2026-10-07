/**
 * StockFacture Pro - PWA Automatic Update Toast
 * 
 * Detects newly deployed service worker versions from GitHub Pages / Vite PWA,
 * checks proactively every 30 minutes and on app focus/reconnection,
 * and allows users to apply the update seamlessly without data loss.
 */

import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { APP_VERSION } from '../../version';

export const PWAUpdateToast: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        // Periodic check every 30 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);

        // Check on app regain focus
        window.addEventListener('focus', () => {
          registration.update().catch(() => {});
        });

        // Check on network regain
        window.addEventListener('online', () => {
          registration.update().catch(() => {});
        });
      }
    },
    onRegisterError(error) {
      console.warn('Erreur enregistrement Service Worker:', error);
    },
  });

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateServiceWorker(true);
    } catch (e) {
      console.warn('Update reload fallback:', e);
      window.location.reload();
    }
  };

  if (!needRefresh || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 left-5 sm:left-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-4 rounded-2xl bg-[#0f172a] text-white border border-slate-700 shadow-2xl flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                Mise à jour disponible
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-orange-500/30 text-orange-300 rounded-md">
                  v{APP_VERSION}
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Une nouvelle version de StockFacture Pro est prête. Cliquez pour l'appliquer sans perte de données.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            title="Ignorer pour l'instant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Plus tard
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={handleUpdate}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Actualisation...' : 'Actualiser maintenant'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
