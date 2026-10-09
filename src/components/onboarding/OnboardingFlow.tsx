/**
 * StockFacture Pro - Onboarding Flow
 * 
 * Parcours de configuration initiale en 3 étapes :
 * 1. Nom du commerce
 * 2. Devise de facturation
 * 3. Paramètres TVA
 */

import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Store, Coins, Receipt, Sparkles } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';

interface OnboardingFlowProps {
  onComplete: (settings: { name: string; currency: string; vatEnabled: boolean; vatRate: number }) => Promise<void>;
}

interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
  flag: string;
}

const CURRENCIES: CurrencyOption[] = [
  { code: 'FCFA', symbol: 'FCFA', label: 'Franc CFA', flag: '🇹🇬' },
  { code: 'EUR', symbol: '€', label: 'Euro', flag: '🇪🇺' },
  { code: 'USD', symbol: '$', label: 'Dollar US', flag: '🇺🇸' },
];

const VAT_RATES = [5, 10, 18, 20];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('FCFA');
  const [customCurrency, setCustomCurrency] = useState('');
  const [useCustomCurrency, setUseCustomCurrency] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRate, setVatRate] = useState(18);

  const handleNext = () => {
    if (step === 1 && !name.trim()) return;
    if (step < 3) {
      setStep((step + 1) as 1 | 2 | 3);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onComplete({
        name: name.trim() || 'Mon Commerce',
        currency: useCustomCurrency ? (customCurrency.trim() || 'FCFA') : currency,
        vatEnabled,
        vatRate: vatEnabled ? vatRate : 0,
      });
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canContinue =
    step === 1
      ? name.trim().length > 0
      : step === 2
      ? useCustomCurrency
        ? customCurrency.trim().length > 0
        : true
      : true;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-[#E8EDF2] dark:border-slate-800 space-y-5 animate-in zoom-in-95">
          {/* Logo + Titre */}
          <div className="flex flex-col items-center text-center space-y-3">
            <BrandLogo size="xl" />
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-black text-[#14213D] dark:text-white">
                Bienvenue ! 👋
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400">
                Configurons votre espace en 30 secondes.
              </p>
            </div>
          </div>

          {/* Indicateur d'étapes */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-8 bg-orange-500'
                    : s < step
                    ? 'w-6 bg-orange-300 dark:bg-orange-700'
                    : 'w-6 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Contenu de l'étape */}
          <div className="min-h-[220px] flex flex-col justify-center">
            {/* ÉTAPE 1 : NOM */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto border border-orange-200/60 dark:border-orange-900/40">
                    <Store className="w-6 h-6" />
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-[#14213D] dark:text-white pt-2">
                    Comment s'appelle votre commerce ?
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Ce nom apparaîtra sur vos factures.
                  </p>
                </div>

                <input
                  type="text"
                  autoFocus
                  placeholder="Ex: Boutique Étoile, Nantor Electronics..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canContinue) handleNext();
                  }}
                  className="w-full h-12 px-4 rounded-2xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}

            {/* ÉTAPE 2 : DEVISE */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200/60 dark:border-emerald-900/40">
                    <Coins className="w-6 h-6" />
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-[#14213D] dark:text-white pt-2">
                    Choisissez votre devise
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Vous pourrez la modifier plus tard.
                  </p>
                </div>

                {!useCustomCurrency ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {CURRENCIES.map((c) => {
                      const isSelected = currency === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setCurrency(c.code)}
                          className={`p-3 rounded-2xl border-2 transition-all text-left cursor-pointer ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 shadow-sm'
                              : 'border-[#E8EDF2] dark:border-slate-700 hover:border-orange-200 bg-white dark:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-2xl">{c.flag}</span>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <div className="text-sm font-black text-[#14213D] dark:text-white">
                            {c.code}
                          </div>
                          <div className="text-[10px] text-[#64748B] dark:text-slate-400">
                            {c.label}
                          </div>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setUseCustomCurrency(true)}
                      className={`p-3 rounded-2xl border-2 border-dashed transition-all text-left cursor-pointer col-span-2 ${
                        useCustomCurrency
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40'
                          : 'border-[#E8EDF2] dark:border-slate-700 hover:border-orange-300 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div className="text-sm font-black text-[#14213D] dark:text-white">
                        Autre devise
                      </div>
                      <div className="text-[10px] text-[#64748B] dark:text-slate-400">
                        Saisir manuellement (GHS, NGN, MAD...)
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Ex: GHS, NGN, MAD..."
                      value={customCurrency}
                      onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canContinue) handleNext();
                      }}
                      className="w-full h-12 px-4 rounded-2xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setUseCustomCurrency(false);
                        setCustomCurrency('');
                      }}
                      className="text-xs text-[#64748B] dark:text-slate-400 hover:text-orange-600 font-bold flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Revenir aux devises courantes</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ÉTAPE 3 : TVA */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto border border-purple-200/60 dark:border-purple-900/40">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-[#14213D] dark:text-white pt-2">
                    Facturez-vous la TVA ?
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Vous pourrez l'activer ou la désactiver par facture.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVatEnabled(false)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      !vatEnabled
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 shadow-sm'
                        : 'border-[#E8EDF2] dark:border-slate-700 hover:border-orange-200 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="text-2xl mb-1.5">🚫</div>
                    <div className="text-sm font-black text-[#14213D] dark:text-white">
                      Non
                    </div>
                    <div className="text-[10px] text-[#64748B] dark:text-slate-400">
                      Sans TVA
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVatEnabled(true)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      vatEnabled
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 shadow-sm'
                        : 'border-[#E8EDF2] dark:border-slate-700 hover:border-orange-200 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="text-2xl mb-1.5">✅</div>
                    <div className="text-sm font-black text-[#14213D] dark:text-white">
                      Oui
                    </div>
                    <div className="text-[10px] text-[#64748B] dark:text-slate-400">
                      Avec TVA
                    </div>
                  </button>
                </div>

                {vatEnabled && (
                  <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-[11px] font-bold text-[#64748B] dark:text-slate-400">
                      Taux de TVA par défaut
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {VAT_RATES.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setVatRate(rate)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            vatRate === rate
                              ? 'bg-orange-500 text-white shadow-sm'
                              : 'bg-[#FAFAF8] dark:bg-slate-800 text-[#64748B] dark:text-slate-400 border border-[#E8EDF2] dark:border-slate-700 hover:border-orange-300'
                          }`}
                        >
                          {rate} %
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Boutons de navigation */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E8EDF2] dark:border-slate-800">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                step === 1
                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                  : 'text-[#64748B] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
              }`}
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" />
              Retour
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={!canContinue || isSubmitting}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-xs sm:text-sm transition-all cursor-pointer ${
                canContinue && !isSubmitting
                  ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 active:scale-95'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <span>Configuration...</span>
              ) : step === 3 ? (
                <>
                  <span>Terminer</span>
                  <Sparkles className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Continuer</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-[#64748B] dark:text-slate-500 mt-4">
          Étape {step} sur 3 • Vous pourrez tout modifier dans les Paramètres.
        </p>
      </div>
    </div>
  );
};