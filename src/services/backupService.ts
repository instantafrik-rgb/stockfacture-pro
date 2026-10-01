/**
 * StockFacture Pro - Backup & Restore Service
 * 
 * Provides:
 * - Comprehensive Cloud Backups tied to the authenticated Google account
 * - Standalone formatted JSON file export and import
 * - Pre-restore validation and schema check
 * - Automatic safety restore points created before any restoration
 * - Preservation of IDs, relations, dates, amounts, quantities, and cash closures
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { AppState, FullBackupPayload, BackupMetadata } from '../types';
import { sanitizeForFirestore } from './data/FirestoreSyncService';
import { APP_VERSION } from '../version';

const SAFETY_POINT_KEY = 'stockfacture_safety_restore_point';

class BackupService {
  /**
   * Builds a complete, standardized backup payload containing all business data
   */
  public createBackupPayload(state: AppState, userEmail?: string, userId?: string): FullBackupPayload {
    const now = new Date().toISOString();
    const backupId = `bkp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const totalRevenue = (state.invoices || [])
      .filter((i) => i.status !== 'cancelled')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const metadata: BackupMetadata = {
      id: backupId,
      createdAt: now,
      appVersion: APP_VERSION,
      userEmail: userEmail || auth.currentUser?.email || undefined,
      userId: userId || auth.currentUser?.uid || undefined,
      stats: {
        productsCount: (state.products || []).length,
        categoriesCount: (state.categories || []).length,
        clientsCount: (state.clients || []).length,
        invoicesCount: (state.invoices || []).length,
        quotesCount: (state.quotes || []).length,
        paymentsCount: (state.payments || []).length,
        movementsCount: (state.movements || []).length,
        closuresCount: (state.closures || []).length,
        restockRequestsCount: (state.restockRequests || []).length,
        returnsCount: (state.returns || []).length,
        totalRevenue,
      },
    };

    return {
      format: 'STOCKFACTURE_PRO_BACKUP',
      version: '1.0',
      app: 'StockFacture Pro',
      metadata,
      data: {
        settings: state.settings,
        categories: state.categories || [],
        products: state.products || [],
        movements: state.movements || [],
        clients: state.clients || [],
        invoices: state.invoices || [],
        payments: state.payments || [],
        quotes: state.quotes || [],
        closures: state.closures || [],
        restockRequests: state.restockRequests || [],
        returns: state.returns || [],
      },
    };
  }

  /**
   * Save a full snapshot backup to Firebase Firestore under the user's account
   */
  public async saveCloudBackup(
    state: AppState
  ): Promise<{ success: boolean; metadata?: BackupMetadata; error?: string }> {
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        error: 'Veuillez vous connecter avec votre compte Google pour créer une sauvegarde Cloud.',
      };
    }

    try {
      const payload = this.createBackupPayload(state, user.email || undefined, user.uid);
      const sanitized = sanitizeForFirestore(payload);

      // Save as latest backup
      const latestRef = doc(db, 'users', user.uid, 'cloud_backups', 'latest');
      await setDoc(latestRef, sanitized);

      // Also record in history
      const historyRef = doc(db, 'users', user.uid, 'cloud_backups_history', payload.metadata.id);
      await setDoc(historyRef, sanitized);

      // Save locally to record timestamp
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('stockfacture_last_backup_date', payload.metadata.createdAt);
        localStorage.setItem('stockfacture_last_backup_type', 'cloud');
      }

      return { success: true, metadata: payload.metadata };
    } catch (err: any) {
      console.error('[BackupService] Cloud backup error:', err);
      return {
        success: false,
        error: err?.message || 'Erreur lors de la sauvegarde sur le Cloud Google.',
      };
    }
  }

  /**
   * Retrieve the latest cloud backup from Firestore
   */
  public async getLatestCloudBackup(
    targetUserId?: string
  ): Promise<{ exists: boolean; payload?: FullBackupPayload; metadata?: BackupMetadata; error?: string }> {
    const user = auth.currentUser;
    const uid = targetUserId || user?.uid;
    if (!uid) {
      return { exists: false, error: 'Compte Google non connecté' };
    }

    try {
      const ref = doc(db, 'users', uid, 'cloud_backups', 'latest');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return { exists: false };
      }

      const data = snap.data() as FullBackupPayload;
      return {
        exists: true,
        payload: data,
        metadata: data.metadata,
      };
    } catch (err: any) {
      console.warn('[BackupService] Error fetching cloud backup:', err);
      return {
        exists: false,
        error: err?.message || 'Impossible de récupérer la sauvegarde Cloud.',
      };
    }
  }

  /**
   * Export the entire application state into a formatted JSON download file
   */
  public downloadJsonBackup(state: AppState): void {
    const payload = this.createBackupPayload(state);
    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const d = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stockfacture_pro_backup_${d}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('stockfacture_last_backup_date', new Date().toISOString());
      localStorage.setItem('stockfacture_last_backup_type', 'json');
    }
  }

  /**
   * Creates an automatic local safety restore point before applying any restore operation
   */
  public createSafetyRestorePoint(currentState: AppState): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const safetyPayload = this.createBackupPayload(currentState);
        localStorage.setItem(SAFETY_POINT_KEY, JSON.stringify(safetyPayload));
      }
    } catch (e) {
      console.warn('[BackupService] Could not create safety point:', e);
    }
  }

  /**
   * Retrieves the safety restore point if available
   */
  public getSafetyRestorePoint(): FullBackupPayload | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = localStorage.getItem(SAFETY_POINT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Deep validation of a backup object before importing
   */
  public validateBackup(rawJson: any): {
    isValid: boolean;
    error?: string;
    extractedState?: AppState;
    stats?: BackupMetadata['stats'];
    metadata?: BackupMetadata;
  } {
    if (!rawJson || typeof rawJson !== 'object') {
      return { isValid: false, error: 'Format invalide (le fichier ne contient pas un objet JSON valide)' };
    }

    // Check if wrapped in FullBackupPayload or raw AppState
    let dataSection: any;
    let meta: BackupMetadata | undefined;

    if (rawJson.format === 'STOCKFACTURE_PRO_BACKUP' && rawJson.data) {
      dataSection = rawJson.data;
      meta = rawJson.metadata;
    } else if (rawJson.settings && Array.isArray(rawJson.products)) {
      // Legacy or raw AppState format
      dataSection = rawJson;
    } else {
      return {
        isValid: false,
        error: 'Le fichier ne contient pas une structure de données StockFacture Pro reconnue.',
      };
    }

    // Verify critical entities
    if (!dataSection.settings || typeof dataSection.settings !== 'object') {
      return { isValid: false, error: 'Paramètres entreprise manquants dans la sauvegarde.' };
    }

    if (!Array.isArray(dataSection.products)) {
      return { isValid: false, error: 'Liste des produits invalide ou corrompue.' };
    }

    // Normalize state
    const normalizedState: AppState = {
      settings: {
        ...dataSection.settings,
        name: dataSection.settings.name || 'Commerce',
        currency: dataSection.settings.currency || 'FCFA',
      },
      categories: Array.isArray(dataSection.categories) ? dataSection.categories : [],
      products: Array.isArray(dataSection.products) ? dataSection.products : [],
      clients: Array.isArray(dataSection.clients) ? dataSection.clients : [],
      invoices: Array.isArray(dataSection.invoices) ? dataSection.invoices : [],
      quotes: Array.isArray(dataSection.quotes) ? dataSection.quotes : [],
      payments: Array.isArray(dataSection.payments) ? dataSection.payments : [],
      movements: Array.isArray(dataSection.movements) ? dataSection.movements : [],
      closures: Array.isArray(dataSection.closures) ? dataSection.closures : [],
      restockRequests: Array.isArray(dataSection.restockRequests) ? dataSection.restockRequests : [],
      returns: Array.isArray(dataSection.returns) ? dataSection.returns : [],
      isLocked: false,
      hasCompletedOnboarding: true,
    };

    const totalRevenue = normalizedState.invoices
      .filter((i) => i.status !== 'cancelled')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const stats: BackupMetadata['stats'] = meta?.stats || {
      productsCount: normalizedState.products.length,
      categoriesCount: normalizedState.categories.length,
      clientsCount: normalizedState.clients.length,
      invoicesCount: normalizedState.invoices.length,
      quotesCount: normalizedState.quotes.length,
      paymentsCount: normalizedState.payments.length,
      movementsCount: normalizedState.movements.length,
      closuresCount: (normalizedState.closures || []).length,
      restockRequestsCount: (normalizedState.restockRequests || []).length,
      returnsCount: (normalizedState.returns || []).length,
      totalRevenue,
    };

    return {
      isValid: true,
      extractedState: normalizedState,
      stats,
      metadata: meta,
    };
  }

  /**
   * Evaluates the health status of backups based on last saved date
   */
  public getBackupStatus(lastBackupDate?: string): {
    state: 'up-to-date' | 'warning' | 'critical' | 'none';
    label: string;
    details: string;
    hoursSince?: number;
  } {
    const rawDate =
      lastBackupDate ||
      (typeof window !== 'undefined' && window.localStorage
        ? localStorage.getItem('stockfacture_last_backup_date')
        : undefined);
    if (!rawDate) {
      return {
        state: 'none',
        label: 'Aucune sauvegarde',
        details: 'Vos données ne disposent pas encore de sauvegarde de sécurité.',
      };
    }

    try {
      const backupTime = new Date(rawDate).getTime();
      if (isNaN(backupTime)) {
        return { state: 'none', label: 'Inconnue', details: 'Date de sauvegarde non reconnue.' };
      }

      const diffMs = Date.now() - backupTime;
      const hoursSince = Math.floor(diffMs / (1000 * 60 * 60));

      if (hoursSince < 24) {
        return {
          state: 'up-to-date',
          label: 'À jour',
          details: `Sauvegarde effectuée il y a ${hoursSince === 0 ? 'moins d\'une heure' : `${hoursSince} h`}.`,
          hoursSince,
        };
      }

      if (hoursSince < 48) {
        return {
          state: 'warning',
          label: 'Sauvegarde recommandée',
          details: `Dernière sauvegarde il y a ${Math.floor(hoursSince / 24)} jour(s). Pensez à sécuriser vos données du jour.`,
          hoursSince,
        };
      }

      return {
        state: 'critical',
        label: 'Sauvegarde en retard',
        details: `Attention : Aucune sauvegarde depuis plus de ${Math.floor(hoursSince / 24)} jours.`,
        hoursSince,
      };
    } catch {
      return { state: 'none', label: 'Inconnue', details: '' };
    }
  }
}

export const backupService = new BackupService();
