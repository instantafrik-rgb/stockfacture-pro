/**
 * StockFacture Pro - Daily Notifications & Backup Reminder Settings Section
 * 
 * Provides:
 * - Request / View browser & PWA notification permissions
 * - Daily Backup Reminder toggle & time picker (Default 20:00)
 * - Daily Activity Report toggle & time picker (Default 20:00)
 * - Instant test buttons to verify notification delivery on PC & Android
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Calendar,
  BarChart3,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { notificationService } from '../../services/notificationService';

export const DailyNotificationSection: React.FC = () => {
  const { state, updateSettings } = useApp();

  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(true);
  const [testSentMessage, setTestSentMessage] = useState<string | null>(null);

  // Settings values
  const reminderEnabled = state.settings.backupReminderEnabled ?? true;
  const reminderTime = state.settings.backupReminderTime || '20:00';
  const reportEnabled = state.settings.dailyReportEnabled ?? true;
  const reportTime = state.settings.dailyReportTime || '20:00';

  useEffect(() => {
    setIsSupported(notificationService.isSupported());
    if (notificationService.isSupported()) {
      setPermission(notificationService.getPermission());
    }
  }, []);

  const handleRequestPermission = async () => {
    const res = await notificationService.requestPermission();
    setPermission(res);
    if (res === 'granted') {
      setTestSentMessage('Autorisation accordée ! Les notifications quotidiennes sont maintenant actives.');
      setTimeout(() => setTestSentMessage(null), 4000);
    }
  };

  const handleToggleReminder = async (enabled: boolean) => {
    await updateSettings({ backupReminderEnabled: enabled });
  };

  const handleChangeReminderTime = async (time: string) => {
    await updateSettings({ backupReminderTime: time });
  };

  const handleToggleReport = async (enabled: boolean) => {
    await updateSettings({ dailyReportEnabled: enabled });
  };

  const handleChangeReportTime = async (time: string) => {
    await updateSettings({ dailyReportTime: time });
  };

  // Immediate Test: Backup Reminder
  const handleTestBackupReminder = async () => {
    if (permission !== 'granted') {
      const p = await notificationService.requestPermission();
      setPermission(p);
      if (p !== 'granted') return;
    }
    const ok = await notificationService.sendBackupReminder(state.settings.lastBackupDate);
    if (ok) {
      setTestSentMessage('Notification de rappel de sauvegarde envoyée sur cet appareil !');
    } else {
      setTestSentMessage('Vérifiez les permissions de notification de votre navigateur.');
    }
    setTimeout(() => setTestSentMessage(null), 4000);
  };

  // Immediate Test: Daily Report
  const handleTestDailyReport = async () => {
    if (permission !== 'granted') {
      const p = await notificationService.requestPermission();
      setPermission(p);
      if (p !== 'granted') return;
    }
    const ok = await notificationService.sendDailyReport(state);
    if (ok) {
      setTestSentMessage('Notification du rapport journalier envoyée sur cet appareil !');
    } else {
      setTestSentMessage('Vérifiez les permissions de notification de votre navigateur.');
    }
    setTimeout(() => setTestSentMessage(null), 4000);
  };

  return (
    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Notifications & Rappels Quotidiens
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Rappels de sauvegarde et résumés de fin de journée pour Android et PC
            </p>
          </div>
        </div>

        {/* Permission status badge */}
        <div>
          {permission === 'granted' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Autorisées</span>
            </span>
          ) : permission === 'denied' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Bloquées</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleRequestPermission}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Activer les notifications</span>
            </button>
          )}
        </div>
      </div>

      {testSentMessage && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{testSentMessage}</span>
        </div>
      )}

      {/* Permission alert if not granted */}
      {permission !== 'granted' && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-amber-900 dark:text-amber-200">
              Autorisation requise pour les rappels automatiques
            </span>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Pour recevoir le rappel de 20h00 et le rapport journalier, autorisez les notifications du navigateur.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRequestPermission}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-xs"
          >
            Autoriser maintenant
          </button>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Daily Backup Reminder */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Rappel quotidien de sauvegarde
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => handleToggleReminder(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            « 🔐 Rappel : pensez à sauvegarder vos données StockFacture Pro. »
          </p>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-semibold">Heure d'envoi :</span>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => handleChangeReminderTime(e.target.value)}
                disabled={!reminderEnabled}
                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white disabled:opacity-50"
              />
            </div>

            <button
              type="button"
              onClick={handleTestBackupReminder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-all"
            >
              <Send className="w-3 h-3 text-orange-500" />
              <span>Tester</span>
            </button>
          </div>
        </div>

        {/* 2. Daily Activity Report */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Rapport journalier automatique
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={reportEnabled}
                onChange={(e) => handleToggleReport(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            « 📊 Rapport journalier StockFacture Pro » résumant CA, encaissements, clients et sorties de stock.
          </p>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-semibold">Heure d'envoi :</span>
              <input
                type="time"
                value={reportTime}
                onChange={(e) => handleChangeReportTime(e.target.value)}
                disabled={!reportEnabled}
                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white disabled:opacity-50"
              />
            </div>

            <button
              type="button"
              onClick={handleTestDailyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-all"
            >
              <Send className="w-3 h-3 text-emerald-500" />
              <span>Tester</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
        <Smartphone className="w-4 h-4 text-indigo-500 shrink-0" />
        <span>
          Sur Android et PC (PWA ou navigateur), les notifications sont transmises par le Service Worker. Cliquez sur une notification pour ouvrir directement le rapport.
        </span>
      </div>
    </div>
  );
};
