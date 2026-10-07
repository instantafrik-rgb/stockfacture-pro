/**
 * StockFacture Pro - Backup & Restore Management Section
 * 
 * Provides:
 * - Create Cloud Backup (associated with Google Auth account)
 * - Restore Cloud Backup
 * - Download full JSON backup file
 * - Restore from JSON file with validation & preview
 * - Display last backup date & detailed backup health status
 * - Automatic safety restore point created prior to any restoration
 */

import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  FileJson,
  ArrowDownToLine,
  Database,
  Sparkles,
  Info,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import backupService from '../../services/backupService';
import { FullBackupPayload, BackupMetadata, AppState } from '../../types';

interface BackupRestoreSectionProps {
  onNotifyChange?: () => void;
}

export const BackupRestoreSection: React.FC<BackupRestoreSectionProps> = () => {
  const { state, importBackup, updateSettings } = useApp();
  const { user } = useAuth();

  // Status and information
  const [cloudBackupMeta, setCloudBackupMeta] = useState<BackupMetadata | null>(null);
  const [isCheckingCloud, setIsCheckingCloud] = useState(false);
  const [isCreatingCloud, setIsCreatingCloud] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Restore preview modal state
  const [pendingRestore, setPendingRestore] = useState<{
    source: 'cloud' | 'json';
    payload: FullBackupPayload;
    extractedState: AppState;
    stats: BackupMetadata['stats'];
    metadata?: BackupMetadata;
  } | null>(null);

  // Load last cloud backup status on mount or when user changes
  useEffect(() => {
    if (user) {
      checkCloudBackup();
    }
  }, [user]);

  const checkCloudBackup = async () => {
    if (!user) return;
    setIsCheckingCloud(true);
    try {
      const res = await backupService.getLatestCloudBackup(user.uid);
      if (res.exists && res.metadata) {
        setCloudBackupMeta(res.metadata);
      } else {
        setCloudBackupMeta(null);
      }
    } catch {
      // ignore
    } finally {
      setIsCheckingCloud(false);
    }
  };

  // 1. Create Cloud Backup
  const handleCreateCloudBackup = async () => {
    if (!user) {
      setActionMessage({
        type: 'error',
        text: 'Veuillez vous connecter avec votre compte Google ci-dessus pour activer la sauvegarde Cloud.',
      });
      return;
    }

    setIsCreatingCloud(true);
    setActionMessage(null);

    try {
      const res = await backupService.saveCloudBackup(state);
      if (res.success && res.metadata) {
        setCloudBackupMeta(res.metadata);
        await updateSettings({
          lastBackupDate: res.metadata.createdAt,
          lastBackupType: 'cloud',
        });
        setActionMessage({
          type: 'success',
          text: `Sauvegarde Cloud créée avec succès le ${new Date(res.metadata.createdAt).toLocaleString('fr-FR')} !`,
        });
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Erreur lors de la création de la sauvegarde Cloud.',
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Erreur inattendue.',
      });
    } finally {
      setIsCreatingCloud(false);
    }
  };

  // 2. Prepare Cloud Restore
  const handlePrepareCloudRestore = async () => {
    if (!user) return;
    setIsRestoring(true);
    setActionMessage(null);

    try {
      const res = await backupService.getLatestCloudBackup(user.uid);
      if (!res.exists || !res.payload) {
        setActionMessage({
          type: 'error',
          text: 'Aucune sauvegarde Cloud trouvée pour ce compte Google.',
        });
        return;
      }

      const validation = backupService.validateBackup(res.payload);
      if (!validation.isValid || !validation.extractedState) {
        setActionMessage({
          type: 'error',
          text: validation.error || 'La sauvegarde Cloud trouvée est invalide ou corrompue.',
        });
        return;
      }

      setPendingRestore({
        source: 'cloud',
        payload: res.payload,
        extractedState: validation.extractedState,
        stats: validation.stats || res.metadata?.stats || {
          productsCount: 0,
          categoriesCount: 0,
          clientsCount: 0,
          invoicesCount: 0,
          quotesCount: 0,
          paymentsCount: 0,
          movementsCount: 0,
          closuresCount: 0,
          totalRevenue: 0,
        },
        metadata: res.metadata,
      });
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Impossible de charger la sauvegarde Cloud.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // 3. Download JSON Backup
  const handleDownloadJson = () => {
    backupService.downloadJsonBackup(state);
    updateSettings({
      lastBackupDate: new Date().toISOString(),
      lastBackupType: 'json',
    });
    setActionMessage({
      type: 'success',
      text: 'Fichier de sauvegarde JSON complet téléchargé avec succès !',
    });
  };

  // 4. Handle JSON File Selection & Verification
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = JSON.parse(event.target?.result as string);
        const validation = backupService.validateBackup(rawJson);

        if (!validation.isValid || !validation.extractedState) {
          setActionMessage({
            type: 'error',
            text: validation.error || 'Fichier de sauvegarde JSON non valide.',
          });
          return;
        }

        setPendingRestore({
          source: 'json',
          payload: rawJson,
          extractedState: validation.extractedState,
          stats: validation.stats || {
            productsCount: 0,
            categoriesCount: 0,
            clientsCount: 0,
            invoicesCount: 0,
            quotesCount: 0,
            paymentsCount: 0,
            movementsCount: 0,
            closuresCount: 0,
            totalRevenue: 0,
          },
          metadata: validation.metadata,
        });
      } catch {
        setActionMessage({
          type: 'error',
          text: 'Erreur lors de la lecture du fichier JSON (syntaxe non reconnue).',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 5. Execute Confirmed Restore
  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    setIsRestoring(true);

    try {
      // 1. Create a local safety point of current state before overwriting
      backupService.createSafetyRestorePoint(state);

      // 2. Perform restoration
      const ok = await importBackup(pendingRestore.extractedState);
      if (ok) {
        await updateSettings({
          lastBackupDate: pendingRestore.metadata?.createdAt || new Date().toISOString(),
        });
        setActionMessage({
          type: 'success',
          text: 'Restauration complète réussie ! Toutes les données ont été rétablies et synchronisées avec le Cloud.',
        });
        setPendingRestore(null);
      } else {
        setActionMessage({
          type: 'error',
          text: 'Échec de la restauration des données.',
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Erreur lors de la restauration.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Evaluate backup status & health
  const lastDate = state.settings.lastBackupDate || cloudBackupMeta?.createdAt;
  const backupStatus = backupService.getBackupStatus(lastDate);

  return (
    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Sauvegarde et Restauration Complète
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Sécurisez l'intégralité de vos données commerciales sur le Cloud Google et en fichier JSON
            </p>
          </div>
        </div>

        {/* Health status badge */}
        <div className="flex items-center gap-2">
          {backupStatus.state === 'up-to-date' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{backupStatus.label}</span>
            </span>
          )}
          {backupStatus.state === 'warning' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{backupStatus.label}</span>
            </span>
          )}
          {(backupStatus.state === 'critical' || backupStatus.state === 'none') && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{backupStatus.label}</span>
            </span>
          )}
        </div>
      </div>

      {/* Action Feedback Message */}
      {actionMessage && (
        <div
          className={`flex items-start gap-2.5 p-3.5 rounded-2xl text-xs font-semibold border animate-in fade-in ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : actionMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">{actionMessage.text}</div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Backup Status Overview Card */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Dernière sauvegarde enregistrée :</span>
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {lastDate ? new Date(lastDate).toLocaleString('fr-FR') : 'Aucune date enregistrée'}
          </span>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          {backupStatus.details}
        </div>

        {cloudBackupMeta && (
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl">
              <span className="text-slate-400 block">Produits</span>
              <span className="font-bold text-slate-800 dark:text-white">{cloudBackupMeta.stats.productsCount}</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl">
              <span className="text-slate-400 block">Clients</span>
              <span className="font-bold text-slate-800 dark:text-white">{cloudBackupMeta.stats.clientsCount}</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl">
              <span className="text-slate-400 block">Factures</span>
              <span className="font-bold text-slate-800 dark:text-white">{cloudBackupMeta.stats.invoicesCount}</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl">
              <span className="text-slate-400 block">Mouvements</span>
              <span className="font-bold text-slate-800 dark:text-white">{cloudBackupMeta.stats.movementsCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Grid: 1. Cloud Backup & Restore / 2. JSON File Backup & Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Cloud Google Backup */}
        <div className="p-4 rounded-2xl border border-indigo-100 dark:border-indigo-950 bg-gradient-to-br from-indigo-50/40 to-white dark:from-indigo-950/20 dark:to-slate-900 space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Sauvegarde Cloud Google
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Liée à votre compte Google ({user?.email || 'non connecté'}). Permet de restaurer instantanément votre commerce sur un nouveau téléphone ou PC.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={handleCreateCloudBackup}
              disabled={isCreatingCloud || !user}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-transform active:scale-95"
            >
              {isCreatingCloud ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              <span>{isCreatingCloud ? 'Sauvegarde...' : 'Créer sauvegarde Cloud'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrepareCloudRestore}
              disabled={isRestoring || !user}
              className="flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-50 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all active:scale-95"
            >
              {isRestoring ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="w-4 h-4" />
              )}
              <span>Restaurer Cloud</span>
            </button>
          </div>
        </div>

        {/* Card 2: JSON File Export / Import */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Export / Import Fichier JSON
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Conservez une copie physique autonome de votre base sur votre disque dur ou clé USB, sans dépendre du réseau.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition-transform active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger JSON</span>
            </button>

            <label className="flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-all active:scale-95">
              <Upload className="w-4 h-4" />
              <span>Restaurer JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Safety point notice */}
      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
        <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>
          Sécurité garantie : un point de restauration local automatique est généré avant chaque restauration pour prévenir tout incident.
        </span>
      </div>

      {/* Modal: Pre-Restore Verification & Confirmation */}
      {pendingRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Confirmation de Restauration
                </h4>
                <p className="text-xs text-slate-500">
                  Source : {pendingRestore.source === 'cloud' ? 'Sauvegarde Cloud Google' : 'Fichier JSON local'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              La sauvegarde a été vérifiée et est 100% conforme. Voici le récapitulatif des données qui seront rétablies :
            </p>

            {/* Stats preview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Produits</span>
                <span className="font-bold text-slate-900 dark:text-white">{pendingRestore.stats.productsCount}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Clients</span>
                <span className="font-bold text-slate-900 dark:text-white">{pendingRestore.stats.clientsCount}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Factures</span>
                <span className="font-bold text-slate-900 dark:text-white">{pendingRestore.stats.invoicesCount}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Devis</span>
                <span className="font-bold text-slate-900 dark:text-white">{pendingRestore.stats.quotesCount}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Paiements</span>
                <span className="font-bold text-slate-900 dark:text-white">{pendingRestore.stats.paymentsCount}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Mouvements</span>
                <span className="font-bold text-slate-900 dark:text-white">{pendingRestore.stats.movementsCount}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Clôtures</span>
                <span className="font-bold text-slate-900 dark:text-white">{pendingRestore.stats.closuresCount}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Chiffre d'aff.</span>
                <span className="font-bold text-emerald-600">{pendingRestore.stats.totalRevenue.toLocaleString('fr-FR')}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-[11px] leading-relaxed border border-amber-200 dark:border-amber-800/60">
              <span className="font-bold">Attention :</span> Les données de cette sauvegarde remplaceront l'état actuel de votre appareil et seront resynchronisées avec votre compte Cloud Google. Un point de sauvegarde de sécurité local sera automatiquement créé avant l'application.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                disabled={isRestoring}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm"
              >
                {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{isRestoring ? 'Restauration en cours...' : 'Confirmer et Restaurer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
