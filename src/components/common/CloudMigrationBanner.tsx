/**
 * StockFacture Pro - Cloud Migration Banner
 * 
 * Prompts user on first Google login to migrate their existing local offline
 * data to Firestore so they can access it from mobile & desktop.
 */

import React from 'react';
import { Cloud, CloudUpload, X, Loader2, Check } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';

export const CloudMigrationBanner: React.FC = () => {
  const {
    hasLocalDataToMigrate,
    migrateLocalDataToCloud,
    dismissMigrationPrompt,
    isMigrating,
    user,
  } = useAuth();

  if (!hasLocalDataToMigrate || !user) return null;

  return (
    <div className="mx-4 sm:mx-6 mb-4 p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-slate-800 dark:to-slate-800/80 border border-orange-200 dark:border-orange-900/30 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/20">
          <CloudUpload className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-extrabold text-[#14213D] dark:text-white flex items-center gap-1.5">
            Synchronisation Cloud disponible
          </h4>
          <p className="text-xs text-[#64748B] dark:text-slate-300 mt-0.5">
            Des données locales existent sur cet appareil. Souhaitez-vous les envoyer vers votre compte Google (<strong>{user.email}</strong>) pour y accéder depuis votre téléphone et votre PC ?
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          type="button"
          disabled={isMigrating}
          onClick={migrateLocalDataToCloud}
          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          {isMigrating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Synchronisation...</span>
            </>
          ) : (
            <>
              <Cloud className="w-3.5 h-3.5" />
              <span>Synchroniser vers le Cloud</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={dismissMigrationPrompt}
          title="Ignorer"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
