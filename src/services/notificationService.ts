/**
 * StockFacture Pro - Daily Notifications & Backup Reminders Service
 * 
 * Manages:
 * - Browser / PWA Notification permissions
 * - Daily Backup Reminder (default 20:00): "🔐 Rappel : pensez à sauvegarder vos données StockFacture Pro."
 * - Daily Activity Report (default 20:00): "📊 Rapport journalier StockFacture Pro"
 * - Summarizes revenue, transactions, collected cash, new clients, and stock movements breakdown
 * - Immediate test triggers for PC & Android verification
 */

import { AppState, CompanySettings, StockMovementReason } from '../types';
import { toLocalDateString, getTodayDateString } from '../utils/formatters';

export interface DailySummaryStats {
  date: string;
  revenue: number;
  salesCount: number;
  collectedAmount: number;
  paymentsCount: number;
  newClientsCount: number;
  movementsCount: number;
  stockOutReasons: {
    sale: number;
    donation: number;
    defective: number;
    loss: number;
    breakage: number;
    other: number;
  };
  topProducts: { name: string; quantity: number }[];
  cashClosureInfo?: string;
}

class NotificationService {
  private timerId: any = null;
  private stateGetter: (() => AppState) | null = null;
  private onNavigateToReports: (() => void) | null = null;

  /**
   * Check if Notification API is supported by the current browser/device
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Current notification permission state
   */
  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Request user permission for notifications
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const perm = await Notification.requestPermission();
      return perm;
    } catch (err) {
      console.warn('[NotificationService] Request permission error:', err);
      return 'denied';
    }
  }

  /**
   * Register state getter and navigation callback
   */
  public initialize(stateGetter: () => AppState, onNavigateToReports?: () => void) {
    this.stateGetter = stateGetter;
    this.onNavigateToReports = onNavigateToReports || null;

    // Start background checking loop
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => this.checkAndTriggerDailySchedules(), 45000);

    // Initial check after 3 seconds
    setTimeout(() => this.checkAndTriggerDailySchedules(), 3000);
  }

  /**
   * Stop background checking loop
   */
  public cleanup() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Calculate detailed summary stats for a given day (defaults to today)
   */
  public computeDailySummary(state: AppState, targetDateStr?: string): DailySummaryStats {
    const today = targetDateStr || getTodayDateString();

    // 1. Invoices / Sales of today
    const invoicesToday = (state.invoices || []).filter((inv) => {
      const invDate = toLocalDateString(inv.date || inv.createdAt);
      return invDate === today && inv.status !== 'cancelled';
    });

    const salesCount = invoicesToday.length;
    const revenue = invoicesToday.reduce((sum, inv) => sum + (inv.total || 0), 0);

    // 2. Payments collected today
    const paymentsToday = (state.payments || []).filter((p) => {
      const payDate = toLocalDateString(p.date || p.createdAt);
      return payDate === today;
    });

    const collectedAmount = paymentsToday.reduce((sum, p) => sum + (p.amount || 0), 0);

    // 3. New clients registered today
    const newClientsCount = (state.clients || []).filter((c) => {
      const cDate = toLocalDateString(c.createdAt);
      return cDate === today;
    }).length;

    // 4. Stock movements today
    const movementsToday = (state.movements || []).filter((m) => {
      const mDate = toLocalDateString(m.createdAt);
      return mDate === today;
    });

    const stockOutReasons = {
      sale: 0,
      donation: 0,
      defective: 0,
      loss: 0,
      breakage: 0,
      other: 0,
    };

    movementsToday.forEach((m) => {
      if (m.type === 'out') {
        const qty = m.quantity || 0;
        const reason = (m.reason || 'other') as StockMovementReason;
        if (reason === 'sale') stockOutReasons.sale += qty;
        else if (reason === 'donation') stockOutReasons.donation += qty;
        else if (reason === 'defective') stockOutReasons.defective += qty;
        else if (reason === 'loss') stockOutReasons.loss += qty;
        else if (reason === 'breakage') stockOutReasons.breakage += qty;
        else stockOutReasons.other += qty;
      }
    });

    // 5. Top selling products today
    const productSalesMap = new Map<string, { name: string; quantity: number }>();
    invoicesToday.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const key = item.productId || item.designation;
        const existing = productSalesMap.get(key) || { name: item.designation, quantity: 0 };
        existing.quantity += item.quantity || 1;
        productSalesMap.set(key, existing);
      });
    });

    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);

    // 6. Cash register closure today if available
    let cashClosureInfo: string | undefined;
    const closureToday = (state.closures || []).find((cl) => {
      const clDate = (cl.date || cl.closedAt || '').slice(0, 10);
      return clDate === today;
    });
    if (closureToday) {
      cashClosureInfo = `Caisse clôturée (${closureToday.closureNumber}) : ${closureToday.actualCashInDrawer.toLocaleString('fr-FR')} ${state.settings.currency}`;
    }

    return {
      date: today,
      revenue,
      salesCount,
      collectedAmount,
      paymentsCount: paymentsToday.length,
      newClientsCount,
      movementsCount: movementsToday.length,
      stockOutReasons,
      topProducts,
      cashClosureInfo,
    };
  }

  /**
   * Low-level helper to trigger a system/browser notification with fallback
   */
  public async sendNotification(
    title: string,
    options: {
      body: string;
      tag?: string;
      icon?: string;
      badge?: string;
      data?: any;
      onClick?: () => void;
    }
  ): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      console.log('[NotificationService] Notification not granted or not supported:', title, options.body);
      return false;
    }

    const iconUrl = options.icon || `${import.meta.env.BASE_URL}icon.svg`;

    try {
      // 1. Check if ServiceWorker registration is available (Best for PWA / Android)
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && 'showNotification' in reg) {
          await reg.showNotification(title, {
            body: options.body,
            icon: iconUrl,
            badge: iconUrl,
            tag: options.tag || 'stockfacture-alert',
            data: options.data || { url: window.location.href },
          });
          return true;
        }
      }

      // 2. Direct Window Notification fallback
      const notification = new Notification(title, {
        body: options.body,
        icon: iconUrl,
        tag: options.tag || 'stockfacture-alert',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) {
          options.onClick();
        } else if (this.onNavigateToReports) {
          this.onNavigateToReports();
        }
      };

      return true;
    } catch (err) {
      console.warn('[NotificationService] Error displaying notification:', err);
      // Fallback
      try {
        const notification = new Notification(title, {
          body: options.body,
          icon: iconUrl,
        });
        notification.onclick = () => {
          window.focus();
          if (options.onClick) options.onClick();
        };
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Trigger the Daily Backup Reminder
   */
  public async sendBackupReminder(lastBackupDate?: string): Promise<boolean> {
    const rawDate = lastBackupDate || localStorage.getItem('stockfacture_last_backup_date');
    let isUrgent = false;

    if (!rawDate) {
      isUrgent = true;
    } else {
      const diffHours = (Date.now() - new Date(rawDate).getTime()) / (1000 * 60 * 60);
      if (diffHours >= 48) isUrgent = true;
    }

    const title = isUrgent
      ? '⚠️ Sauvegarde recommandée StockFacture Pro'
      : '🔐 Rappel : pensez à sauvegarder vos données StockFacture Pro.';

    const body = isUrgent
      ? 'Aucune sauvegarde récente détectée. Pensez à sécuriser vos données (Cloud Google ou fichier JSON).'
      : 'Sécurisez vos ventes, clients et stock du jour en créant une sauvegarde Cloud ou JSON.';

    return await this.sendNotification(title, {
      body,
      tag: 'stockfacture-backup-reminder',
      onClick: () => {
        window.focus();
        window.location.hash = '#settings';
      },
    });
  }

  /**
   * Trigger the Daily Activity Report notification
   */
  public async sendDailyReport(state: AppState): Promise<boolean> {
    const stats = this.computeDailySummary(state);
    const curr = state.settings.currency || 'FCFA';

    const formattedRev = stats.revenue.toLocaleString('fr-FR');
    const formattedPaid = stats.collectedAmount.toLocaleString('fr-FR');

    let body = `Aujourd'hui : ${stats.salesCount} vente(s) (${formattedRev} ${curr}), encaissé : ${formattedPaid} ${curr}`;
    if (stats.newClientsCount > 0) {
      body += ` • +${stats.newClientsCount} client(s)`;
    }

    // Include top outputs if any
    const totalOut =
      stats.stockOutReasons.sale +
      stats.stockOutReasons.donation +
      stats.stockOutReasons.defective +
      stats.stockOutReasons.loss;

    if (totalOut > 0) {
      body += ` • ${totalOut} art. sortis`;
    }

    body += ' • Cliquez pour consulter le rapport détaillé.';

    return await this.sendNotification('📊 Rapport journalier StockFacture Pro', {
      body,
      tag: 'stockfacture-daily-report',
      onClick: () => {
        window.focus();
        if (this.onNavigateToReports) {
          this.onNavigateToReports();
        } else {
          window.location.hash = '#reports';
        }
      },
    });
  }

  /**
   * Scheduled background checker
   */
  private checkAndTriggerDailySchedules() {
    if (!this.stateGetter) return;
    const state = this.stateGetter();
    if (!state || !state.settings) return;

    if (this.getPermission() !== 'granted') return;

    const now = new Date();
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayStr = now.toISOString().slice(0, 10);

    const settings: CompanySettings = state.settings;

    // 1. Backup Reminder
    const reminderEnabled = settings.backupReminderEnabled ?? true;
    const targetReminderTime = settings.backupReminderTime || '20:00';
    const lastReminderDate = localStorage.getItem('stockfacture_last_reminder_fired_date');

    if (reminderEnabled && lastReminderDate !== todayStr) {
      // Fire if current time is equal or past the target time (e.g. >= 20:00)
      if (currentHourMin >= targetReminderTime) {
        localStorage.setItem('stockfacture_last_reminder_fired_date', todayStr);
        this.sendBackupReminder(settings.lastBackupDate);
      }
    }

    // 2. Daily Report
    const reportEnabled = settings.dailyReportEnabled ?? true;
    const targetReportTime = settings.dailyReportTime || '20:00';
    const lastReportDate = localStorage.getItem('stockfacture_last_report_fired_date');

    if (reportEnabled && lastReportDate !== todayStr) {
      if (currentHourMin >= targetReportTime) {
        localStorage.setItem('stockfacture_last_report_fired_date', todayStr);
        this.sendDailyReport(state);
      }
    }
  }
}

export const notificationService = new NotificationService();
