import React, { useState, useEffect } from 'react';
import {
  Building2,
  Receipt,
  Boxes,
  Sun,
  Database,
  Sparkles,
  Trash2,
  RefreshCw,
  Palette,
  Cloud,
  Bell,
  HardDriveDownload,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { CurrencyPosition } from '../types';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { SettingsSection } from '../components/settings/SettingsSection';
import { CloudAccountSection } from '../components/settings/CloudAccountSection';
import { BackupRestoreSection } from '../components/settings/BackupRestoreSection';
import { DailyNotificationSection } from '../components/settings/DailyNotificationSection';
import { APP_VERSION } from '../version';
import { useToast } from '../store/ToastContext';
import { CompanyLogoUpload } from '../components/settings/CompanyLogoUpload';

export const SettingsPage: React.FC = () => {
  const {
    state,
    updateSettings,
    loadDemoData,
    clearDemoData,
    resetAllData,
  } = useApp();
  const toast = useToast();

  // Accordion state : une seule section ouverte à la fois
  const [openSection, setOpenSection] = useState<string>('identity');

  // Dev zone (cachée)
  const [showDevZone, setShowDevZone] = useState(false);

  // Form State
  const [name, setName] = useState(state.settings.name);
  const [phone, setPhone] = useState(state.settings.phone);
  const [email, setEmail] = useState(state.settings.email);
  const [address, setAddress] = useState(state.settings.address);
  const [website, setWebsite] = useState(state.settings.website || '');
  const [taxId, setTaxId] = useState(state.settings.taxId || '');

  const [currency, setCurrency] = useState(state.settings.currency);
  const [currencyPosition, setCurrencyPosition] = useState<CurrencyPosition>(
    state.settings.currencyPosition
  );
  const [invoicePrefix, setInvoicePrefix] = useState(state.settings.invoicePrefix);
  const [quotePrefix, setQuotePrefix] = useState(state.settings.quotePrefix);
  const [vatEnabled, setVatEnabled] = useState(state.settings.vatEnabled);
  const [vatRate, setVatRate] = useState(state.settings.vatRate);
  const [paymentTerms, setPaymentTerms] = useState(state.settings.paymentTerms);
  const [invoiceFooterNote, setInvoiceFooterNote] = useState(state.settings.invoiceFooterNote);
  const [allowNegativeStock, setAllowNegativeStock] = useState(state.settings.allowNegativeStock);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(state.settings.theme || 'light');

  useEffect(() => {
    if (state.settings) {
      setName(state.settings.name || '');
      setPhone(state.settings.phone || '');
      setEmail(state.settings.email || '');
      setAddress(state.settings.address || '');
      setWebsite(state.settings.website || '');
      setTaxId(state.settings.taxId || '');
      setCurrency(state.settings.currency || 'FCFA');
      setCurrencyPosition(state.settings.currencyPosition || 'after');
      setInvoicePrefix(state.settings.invoicePrefix || 'FAC-2026-');
      setQuotePrefix(state.settings.quotePrefix || 'DEV-2026-');
      setVatEnabled(Boolean(state.settings.vatEnabled));
      setVatRate(state.settings.vatRate ?? 18);
      setPaymentTerms(state.settings.paymentTerms || '');
      setInvoiceFooterNote(state.settings.invoiceFooterNote || 'Merci pour votre confiance !');
      setAllowNegativeStock(Boolean(state.settings.allowNegativeStock));
      setTheme(state.settings.theme || 'light');
    }
  }, [state.settings]);

  // Dialogs
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLoadDemoConfirm, setShowLoadDemoConfirm] = useState(false);
  const [showClearDemoConfirm, setShowClearDemoConfirm] = useState(false);

  const toggleSection = (id: string) => {
    setOpenSection((prev) => (prev === id ? '' : id));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        website: website.trim(),
        taxId: taxId.trim(),
        currency: currency.trim() || 'FCFA',
        currencyPosition,
        invoicePrefix: invoicePrefix.trim() || 'FAC-2026-',
        quotePrefix: quotePrefix.trim() || 'DEV-2026-',
        vatEnabled,
        vatRate: Math.max(0, vatRate || 0),
        paymentTerms: paymentTerms.trim(),
        invoiceFooterNote: invoiceFooterNote.trim(),
        allowNegativeStock,
        theme,
      });
      toast.success('Paramètres enregistrés', 'Vos modifications ont été sauvegardées.');
    } catch (err: any) {
      toast.error('Erreur', err?.message || "Impossible d'enregistrer les paramètres.");
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto animate-in fade-in duration-200 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+36px)] md:pb-8">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-[#14213D] dark:text-white tracking-tight">
          Paramètres Généraux
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
          Personnalisez votre commerce, devise, facturation et sécurité.
        </p>
      </div>

      {/* ============================================ */}
      {/* 1. IDENTITÉ DE L'ENTREPRISE */}
      {/* ============================================ */}
      <SettingsSection
        id="identity"
        title="Identité de l'entreprise"
        description="Nom, contact, adresse figurant sur vos factures"
        icon={Building2}
        iconColor="indigo"
        isOpen={openSection === 'identity'}
        onToggle={toggleSection}
      >
        <form onSubmit={handleSaveSettings} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Logo de l'entreprise */}
          <div className="p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60">
            <CompanyLogoUpload />
          </div>
            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Nom ou Enseigne commerciale *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Téléphone de contact *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Adresse email
              </label>
              <input
                type="email"
                placeholder="Ex: contact@moncommerce.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Site web
              </label>
              <input
                type="text"
                placeholder="Ex: www.moncommerce.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Identifiant fiscal (NIF / RCCM / SIRET)
              </label>
              <input
                type="text"
                placeholder="Ex: CI-ABJ-2026-B-1092"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Adresse physique & Ville
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 cursor-pointer"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </SettingsSection>

      {/* ============================================ */}
      {/* 2. FACTURATION */}
      {/* ============================================ */}
      <SettingsSection
        id="billing"
        title="Facturation & Devise"
        description="Devise, TVA, préfixes de numérotation, mentions"
        icon={Receipt}
        iconColor="emerald"
        isOpen={openSection === 'billing'}
        onToggle={toggleSection}
      >
        <form onSubmit={handleSaveSettings} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Symbole monétaire / Devise
              </label>
              <input
                type="text"
                required
                placeholder="Ex: FCFA, EUR, $, GNF..."
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Affichage de la devise
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrencyPosition('after')}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    currencyPosition === 'after'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                      : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B]'
                  }`}
                >
                  100 000 {currency}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyPosition('before')}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    currencyPosition === 'before'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                      : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B]'
                  }`}
                >
                  {currency} 100 000
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Préfixe facture
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Préfixe devis
              </label>
              <input
                type="text"
                value={quotePrefix}
                onChange={(e) => setQuotePrefix(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* TVA */}
            <div className="sm:col-span-2 p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#14213D] dark:text-white block">
                  Activer la TVA
                </span>
                <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                  Calcule automatiquement la taxe sur chaque facture
                </span>
              </div>

              <div className="flex items-center gap-3">
                {vatEnabled && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={vatRate}
                      onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                      className="w-16 h-9 px-2 rounded-lg border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-[#14213D] dark:text-white"
                    />
                    <span className="text-xs font-bold text-[#64748B]">%</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setVatEnabled(!vatEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    vatEnabled ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                      vatEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Conditions de règlement par défaut
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Pied de page des documents
              </label>
              <input
                type="text"
                value={invoiceFooterNote}
                onChange={(e) => setInvoiceFooterNote(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 cursor-pointer"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </SettingsSection>

      {/* ============================================ */}
      {/* 3. APPARENCE */}
      {/* ============================================ */}
      <SettingsSection
        id="appearance"
        title="Apparence"
        description="Thème clair, sombre ou système"
        icon={Palette}
        iconColor="purple"
        isOpen={openSection === 'appearance'}
        onToggle={toggleSection}
      >
        <div className="grid grid-cols-3 gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              setTheme('light');
              updateSettings({ theme: 'light' });
            }}
            className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
              theme === 'light'
                ? 'border-orange-500 bg-[#FFF2DF] text-[#D97706] font-black shadow-xs ring-1 ring-orange-500'
                : 'border-[#E8EDF2] dark:border-[#22304E] bg-white dark:bg-slate-800 text-[#14213D] dark:text-slate-300 font-bold hover:bg-slate-50'
            }`}
          >
            <span className="text-xl">☀️</span>
            <span className="text-xs">Clair</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              updateSettings({ theme: 'dark' });
            }}
            className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
              theme === 'dark'
                ? 'border-orange-500 bg-[#FFF2DF] text-[#D97706] font-black shadow-xs ring-1 ring-orange-500'
                : 'border-[#E8EDF2] dark:border-[#22304E] bg-white dark:bg-slate-800 text-[#14213D] dark:text-slate-300 font-bold hover:bg-slate-50'
            }`}
          >
            <span className="text-xl">🌙</span>
            <span className="text-xs">Sombre</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('system');
              updateSettings({ theme: 'system' });
            }}
            className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
              theme === 'system'
                ? 'border-orange-500 bg-[#FFF2DF] text-[#D97706] font-black shadow-xs ring-1 ring-orange-500'
                : 'border-[#E8EDF2] dark:border-[#22304E] bg-white dark:bg-slate-800 text-[#14213D] dark:text-slate-300 font-bold hover:bg-slate-50'
            }`}
          >
            <span className="text-xl">⚙️</span>
            <span className="text-xs">Système</span>
          </button>
        </div>

        {/* Règles de stock */}
        <div className="mt-4 p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-[#14213D] dark:text-white block">
              Autoriser le stock négatif
            </span>
            <span className="text-[11px] text-[#64748B] dark:text-slate-400">
              Vendre même si le stock atteint zéro
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const newVal = !allowNegativeStock;
              setAllowNegativeStock(newVal);
              updateSettings({ allowNegativeStock: newVal });
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              allowNegativeStock ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                allowNegativeStock ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </SettingsSection>

      {/* ============================================ */}
      {/* 4. SYNCHRONISATION CLOUD */}
      {/* ============================================ */}
      <SettingsSection
        id="cloud"
        title="Synchronisation Cloud"
        description="Compte Google, synchronisation multi-appareils"
        icon={Cloud}
        iconColor="sky"
        isOpen={openSection === 'cloud'}
        onToggle={toggleSection}
      >
        <div className="pt-2">
          <CloudAccountSection />
        </div>
      </SettingsSection>

      {/* ============================================ */}
      {/* 5. NOTIFICATIONS */}
      {/* ============================================ */}
      <SettingsSection
        id="notifications"
        title="Notifications & Rappels"
        description="Rappels de sauvegarde et rapports quotidiens"
        icon={Bell}
        iconColor="amber"
        isOpen={openSection === 'notifications'}
        onToggle={toggleSection}
      >
        <div className="pt-2">
          <DailyNotificationSection />
        </div>
      </SettingsSection>

      {/* ============================================ */}
      {/* 6. SAUVEGARDE & RESTAURATION */}
      {/* ============================================ */}
      <SettingsSection
        id="backup"
        title="Sauvegarde & Restauration"
        description="Cloud Google et export/import JSON"
        icon={HardDriveDownload}
        iconColor="emerald"
        isOpen={openSection === 'backup'}
        onToggle={toggleSection}
      >
        <div className="pt-2">
          <BackupRestoreSection />
        </div>
      </SettingsSection>

      {/* ============================================ */}
      {/* 7. ZONE DANGEREUSE */}
      {/* ============================================ */}
      <SettingsSection
        id="danger"
        title="Zone dangereuse"
        description="Effacement de toutes les données"
        icon={AlertTriangle}
        iconColor="rose"
        isOpen={openSection === 'danger'}
        onToggle={toggleSection}
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-[#64748B] dark:text-slate-400">
            Ces actions sont <strong className="text-rose-600">irréversibles</strong>. Assurez-vous
            d'avoir sauvegardé vos données avant de continuer.
          </p>

          {/* Bouton "Tout effacer" principal */}
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-sm font-extrabold flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Tout effacer (factures, produits, clients…)</span>
          </button>

          {/* Zone développeur (cachée) */}
          <div className="pt-3 border-t border-[#E8EDF2] dark:border-[#22304E]">
            <button
              type="button"
              onClick={() => setShowDevZone(!showDevZone)}
              className="flex items-center gap-2 text-[11px] font-bold text-[#64748B] dark:text-slate-400 hover:text-[#14213D] dark:hover:text-white transition-colors cursor-pointer"
            >
              {showDevZone ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              <span>Zone développeur (tests)</span>
            </button>

            {showDevZone && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <button
                  type="button"
                  onClick={() => setShowLoadDemoConfirm(true)}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Charger démo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowClearDemoConfirm(true)}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>Vider démo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* ============================================ */}
      {/* 8. À PROPOS */}
      {/* ============================================ */}
      <SettingsSection
        id="about"
        title="À propos"
        description={`Version ${APP_VERSION} • Mises à jour`}
        icon={Info}
        iconColor="slate"
        isOpen={openSection === 'about'}
        onToggle={toggleSection}
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-sm">
              SF
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-extrabold text-[#14213D] dark:text-white">
                  StockFacture Pro
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 rounded-full border border-orange-200 dark:border-orange-800">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                PWA installable • Mises à jour automatiques
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((regs) => {
                  regs.forEach((r) => r.update().catch(() => {}));
                });
              }
              window.location.reload();
            }}
            className="w-full py-3 rounded-xl text-xs font-bold text-[#14213D] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Vérifier les mises à jour</span>
          </button>
        </div>
      </SettingsSection>

      {/* ============================================ */}
      {/* CONFIRMATION DIALOGS */}
      {/* ============================================ */}
      <ConfirmDialog
        isOpen={showLoadDemoConfirm}
        title="Charger les données de démonstration ?"
        message="Cette action remplacera les données actuelles par le jeu de données d'exemple réaliste pour tester l'application."
        confirmLabel="Charger l'exemple"
        onConfirm={async () => {
          await loadDemoData();
          setShowLoadDemoConfirm(false);
          toast.success('Données démo chargées', 'Le jeu de test a été installé.');
        }}
        onCancel={() => setShowLoadDemoConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showClearDemoConfirm}
        title="Effacer les données de démonstration ?"
        message="Voulez-vous réinitialiser le catalogue, factures et clients tout en conservant vos paramètres d'entreprise ?"
        confirmLabel="Effacer"
        isDestructive
        onConfirm={async () => {
          await clearDemoData();
          setShowClearDemoConfirm(false);
          toast.success('Données démo effacées', 'Le catalogue est vide.');
        }}
        onCancel={() => setShowClearDemoConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Réinitialiser complètement l'application ?"
        message="ATTENTION : Toutes vos factures, produits, mouvements de stock, devis et coordonnées seront définitivement supprimés de la mémoire locale de cet appareil."
        confirmLabel="TOUT SUPPRIMER"
        isDestructive
        onConfirm={async () => {
          await resetAllData();
          setShowResetConfirm(false);
          toast.warning('Application réinitialisée', 'Toutes les données ont été effacées.');
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
};