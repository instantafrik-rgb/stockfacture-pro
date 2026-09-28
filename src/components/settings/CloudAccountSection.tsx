/**
 * StockFacture Pro - Cloud Account & Firestore Sync Settings Card
 * 
 * Allows users to:
 * - Connect their Google account (Firebase Auth)
 * - View real-time synchronization state (Online / Offline / Syncing)
 * - Sign out cleanly
 * - Trigger manual / initial synchronization to Cloud
 */

import React, { useState } from 'react';
import {
  Cloud,
  CloudCheck,
  CloudOff,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { formatDate } from '../../utils/formatters';

export const CloudAccountSection: React.FC = () => {
  const {
    user,
    isLoadingAuth,
    syncStatus,
    signInWithGoogle,
    signOutUser,
    migrateLocalDataToCloud,
    isMigrating,
    authError,
  } = useAuth();

  const { state } = useApp();
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      console.warn('Sign-in cancelled or failed', e);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleManualSync = async () => {
    if (!user) return;
    const ok = await migrateLocalDataToCloud();
    if (ok) {
      setSyncSuccessMsg('Toutes vos données ont été synchronisées avec succès !');
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              Synchronisation Multi-Appareils (Firebase Cloud)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Synchronisez vos données en continu entre téléphone, PC et tablette
            </p>
          </div>
        </div>

        {/* Sync Status Badge */}
        {user ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Connecté au Cloud</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <CloudOff className="w-3.5 h-3.5" />
            <span>Mode Local / Hors ligne</span>
          </div>
        )}
      </div>

      {authError && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      {syncSuccessMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncSuccessMsg}</span>
        </div>
      )}

      {/* When Logged In */}
      {user ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Utilisateur'}
                  className="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow-xs"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-orange-500 text-white font-black text-lg flex items-center justify-center">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {user.displayName || 'Compte Google'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {user.email}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  ID sécurisé : <span className="font-mono">{user.uid.slice(0, 10)}...</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={signOutUser}
              className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/40 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Se déconnecter</span>
            </button>
          </div>

          {/* Sync Stats Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center">
              <span className="block text-lg font-black text-slate-900 dark:text-white">
                {state.products.length}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Produits</span>
            </div>
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center">
              <span className="block text-lg font-black text-slate-900 dark:text-white">
                {state.invoices.length}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Factures</span>
            </div>
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center">
              <span className="block text-lg font-black text-slate-900 dark:text-white">
                {state.clients.length}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Clients</span>
            </div>
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center">
              <span className="block text-lg font-black text-slate-900 dark:text-white">
                {state.payments.length}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Paiements</span>
            </div>
          </div>

          {/* Actions & Offline Information */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Smartphone className="w-4 h-4 text-orange-500" />
              <span>Téléphone</span>
              <span>↔</span>
              <Laptop className="w-4 h-4 text-indigo-500" />
              <span>PC en temps réel</span>
            </div>

            <button
              type="button"
              disabled={isMigrating}
              onClick={handleManualSync}
              className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synchronisation en cours...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Forcer la synchronisation Cloud</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* When NOT Logged In */
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Activez la synchronisation automatique
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
                Connectez votre compte Google pour retrouver vos factures, stocks et clients à la fois sur votre ordinateur au bureau et sur votre smartphone sur le terrain. Vos données restent 100% disponibles hors ligne même sans réseau.
              </p>
            </div>

            <button
              type="button"
              disabled={isSigningIn || isLoadingAuth}
              onClick={handleSignIn}
              className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-extrabold border border-slate-300 dark:border-slate-600 shadow-xs transition-all active:scale-95 flex items-center justify-center gap-3 shrink-0 cursor-pointer min-h-[44px]"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Se connecter avec Google</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sécurité certifiée : Chaque utilisateur accède uniquement à ses propres données (Règles Firestore strictes).</span>
          </div>
        </div>
      )}
    </div>
  );
};
