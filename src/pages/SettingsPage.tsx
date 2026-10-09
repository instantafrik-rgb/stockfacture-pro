import React, { useState, useEffect } from 'react';
import {
  Building2,
  Receipt,
  Boxes,
  Lock,
  Moon,
  Sun,
  Database,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Trash2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { CurrencyPosition } from '../types';
import { dataRepository } from '../services/data';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CloudAccountSection } from '../components/settings/CloudAccountSection';
import { BackupRestoreSection } from '../components/settings/BackupRestoreSection';
import { DailyNotificationSection } from '../components/settings/DailyNotificationSection';
import { APP_VERSION } from '../version';

export const SettingsPage: React.FC = () => {
  const {
    state,
    updateSettings,
    setAppPin,
    removeAppPin,
    loadDemoData,
    clearDemoData,
    resetAllData,
    importBackup,
  } = useApp();

  const [savedSuccess, setSavedSuccess] = useState(false);

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

  // Keep form inputs synced when settings load from cache or Firestore
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

  // PIN settings
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Dialogs
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLoadDemoConfirm, setShowLoadDemoConfirm] = useState(false);
  const [showClearDemoConfirm, setShowClearDemoConfirm] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSetPin = async () => {
    setPinError(null);
    if (!/^\d{4,6}$/.test(pinInput)) {
      setPinError('Le code PIN doit comporter entre 4 et 6 chiffres.');
      return;
    }
    await setAppPin(pinInput);
    setPinInput('');
    setSavedSuccess(true);
  };

  const handleRemovePin = async () => {
    await removeAppPin();
    setPinInput('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Paramètres Généraux
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Personnalisation de votre commerce, devise, TVA, préfixes et sécurité locale
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Paramètres enregistrés avec succès !</span>
        </div>
      )}

      {/* Cloud Synchronization & Google Auth Section */}
      <CloudAccountSection />

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* 2. Coordonnées de l'entreprise */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Identité de l'entreprise (Sur les factures et reçus)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nom ou Enseigne commerciale *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Téléphone de contact *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Adresse email
              </label>
              <input
                type="email"
                placeholder="Ex: contact@moncommerce.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Site web
              </label>
              <input
                type="text"
                placeholder="Ex: www.moncommerce.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Identifiant fiscal (NIF / RCCM / SIRET)
              </label>
              <input
                type="text"
                placeholder="Ex: CI-ABJ-2026-B-1092"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Adresse physique & Ville
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* 3. Devise & Facturation */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Devise monétaire & Facturation
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Currency Symbol */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Symbole monétaire / Devise
              </label>
              <input
                type="text"
                required
                placeholder="Ex: FCFA, EUR, $, GNF..."
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* Currency Position */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Affichage de la devise
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrencyPosition('after')}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                    currencyPosition === 'after'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  100 000 {currency}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyPosition('before')}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                    currencyPosition === 'before'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {currency} 100 000
                </button>
              </div>
            </div>

            {/* Invoice Prefix */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Préfixe numérotation facture
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>

            {/* Quote Prefix */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Préfixe numérotation devis
              </label>
              <input
                type="text"
                value={quotePrefix}
                onChange={(e) => setQuotePrefix(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>

            {/* VAT Toggle & Rate */}
            <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Activer la Taxe sur la Valeur Ajoutée (TVA)
                </span>
                <span className="text-[11px] text-slate-500">
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
                      className="w-16 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setVatEnabled(!vatEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    vatEnabled ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      vatEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Payment terms & footer notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Conditions de règlement par défaut
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pied de page des documents
              </label>
              <input
                type="text"
                value={invoiceFooterNote}
                onChange={(e) => setInvoiceFooterNote(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* 4. Règle de Stock */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Boxes className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Gestion & Règles de Stock
            </h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Autoriser le stock négatif
              </span>
              <span className="text-[11px] text-slate-500">
                Si activé, vous pouvez vendre des produits même si le stock atteint zéro
              </span>
            </div>

            <button
              type="button"
              onClick={() => setAllowNegativeStock(!allowNegativeStock)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                allowNegativeStock ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  allowNegativeStock ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 5. Thème d'Affichage (Clair par défaut) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-[#E8EDF2] dark:border-[#22304E] shadow-[0_2px_8px_-2px_rgba(20,33,61,0.04)] space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E8EDF2] dark:border-[#22304E]">
            <Sun className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-sm font-extrabold text-[#14213D] dark:text-white">
                Thème d'affichage
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                L'application est optimisée en thème clair lumineux par défaut.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setTheme('light');
                updateSettings({ theme: 'light' });
              }}
              className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                theme === 'light'
                  ? 'border-orange-500 bg-[#FFF2DF] text-[#D97706] font-black shadow-xs ring-1 ring-orange-500'
                  : 'border-[#E8EDF2] dark:border-[#22304E] bg-white dark:bg-slate-800 text-[#14213D] dark:text-slate-300 font-bold hover:bg-slate-50'
              }`}
            >
              <span className="text-xl">☀️</span>
              <span className="text-xs">Clair (Défaut)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTheme('dark');
                updateSettings({ theme: 'dark' });
              }}
              className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
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
              className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                theme === 'system'
                  ? 'border-orange-500 bg-[#FFF2DF] text-[#D97706] font-black shadow-xs ring-1 ring-orange-500'
                  : 'border-[#E8EDF2] dark:border-[#22304E] bg-white dark:bg-slate-800 text-[#14213D] dark:text-slate-300 font-bold hover:bg-slate-50'
              }`}
            >
              <span className="text-xl">⚙️</span>
              <span className="text-xs">Système</span>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95"
          >
            Enregistrer les paramètres
          </button>
        </div>
      </form>

      {/* 5. Sécurité & Verrouillage PIN */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Sécurité & Verrouillage par code PIN
          </h3>
        </div>

        <p className="text-xs text-slate-500">
          Protégez l'accès à vos données financières lorsque vous prêtez votre téléphone ou laissez l'application ouverte.
        </p>

        {state.settings.pinEnabled ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Verrouillage PIN activé</span>
            </div>
            <button
              type="button"
              onClick={handleRemovePin}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-50"
            >
              Désactiver le PIN
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pinError && (
              <p className="text-xs text-rose-600 font-semibold">{pinError}</p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="password"
                maxLength={6}
                placeholder="Nouveau code PIN (4 à 6 chiffres)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-56 h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleSetPin}
                className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90"
              >
                Activer le PIN
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Notifications & Rappels Quotidiens */}
      <DailyNotificationSection />

      {/* 7. Sauvegarde et Restauration Complète (Cloud & Fichier JSON) */}
      <BackupRestoreSection />

      {/* 8. Données de Démo & Réinitialisation */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Database className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Jeux d'essai & Réinitialisation d'urgence
          </h3>
        </div>

        <p className="text-xs text-slate-500">
          Vous pouvez charger un ensemble de données factices pour tester l'application ou vider l'ensemble du stockage local en cas de besoin.
        </p>

        {/* Demo Data & Reset */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setShowLoadDemoConfirm(true)}
            className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Charger données démo</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClearDemoConfirm(true)}
            className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Vider les données démo</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>Réinitialiser tout</span>
          </button>
        </div>
      </div>

      {/* 5. À propos & Version */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-sm">
            SF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">StockFacture Pro</span>
              <span className="px-2 py-0.5 text-[11px] font-bold font-mono bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 rounded-full border border-orange-200 dark:border-orange-800">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              PWA installable • Mises à jour automatiques via GitHub Pages
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
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Vérifier les mises à jour</span>
        </button>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={showLoadDemoConfirm}
        title="Charger les données de démonstration ?"
        message="Cette action remplacera les données actuelles par le jeu de données d'exemple réaliste pour tester l'application."
        confirmLabel="Charger l'exemple"
        onConfirm={async () => {
          await loadDemoData();
          setShowLoadDemoConfirm(false);
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
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
};
