/**
 * StockFacture Pro - Main Application Entrypoint
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import { CloudMigrationBanner } from './components/common/CloudMigrationBanner';
import { PWAUpdateToast } from './components/common/PWAUpdateToast';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { SalePage } from './pages/SalePage';
import { ProductsPage } from './pages/ProductsPage';
import { StockPage } from './pages/StockPage';
import { ClientsPage } from './pages/ClientsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ReceivablesPage } from './pages/ReceivablesPage';
import { QuotesPage } from './pages/QuotesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ManualInvoicePage } from './pages/ManualInvoicePage';
import { Sparkles, ArrowRight, Building2, CheckCircle2 } from 'lucide-react';
import { notificationService } from './services/notificationService';
import { isUserOnboarded } from './utils/onboardingUtils';

const MainView: React.FC = () => {
  const { activeView, isLoading, state, completeOnboarding, navigate } = useApp();
  const { isLoadingAuth, user } = useAuth();
  const [onboardingName, setOnboardingName] = useState(state.settings.name);
  const [onboardingCurrency, setOnboardingCurrency] = useState(state.settings.currency);

  // Initialize background notification scheduler with state access and reports navigation
  React.useEffect(() => {
    notificationService.initialize(
      () => state,
      () => navigate('reports')
    );
    return () => notificationService.cleanup();
  }, [state, navigate]);

  if (isLoading || isLoadingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAF8] text-[#14213D] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center animate-pulse shadow-md shadow-orange-500/20">
          <span className="font-extrabold text-xl">SF</span>
        </div>
        <p className="text-sm font-bold text-[#64748B]">Chargement de StockFacture Pro...</p>
      </div>
    );
  }

  // Lightweight Onboarding modal on first run ONLY for truly brand-new accounts with zero data
  const hasCompletedOnboarding = isUserOnboarded(user?.uid, state);

  if (!hasCompletedOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-[#E8EDF2] dark:border-slate-800 space-y-5 animate-in zoom-in-95">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF2DF] text-[#D97706] border border-[#FFE4BF] flex items-center justify-center shadow-xs mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-[#14213D] dark:text-white">
              Bienvenue sur StockFacture Pro
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400">
              Votre gestion commerciale simple, rapide et claire.
            </p>
          </div>

          <div className="space-y-3.5 pt-2">
            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Nom de votre commerce ou entreprise
              </label>
              <input
                type="text"
                placeholder="Ex: Boutique Étoile, Mon Commerce..."
                value={onboardingName}
                onChange={(e) => setOnboardingName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                Devise de facturation
              </label>
              <input
                type="text"
                placeholder="Ex: FCFA, EUR, USD..."
                value={onboardingCurrency}
                onChange={(e) => setOnboardingCurrency(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-[#14213D] dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={async () => {
                await completeOnboarding({
                  name: onboardingName.trim() || 'Mon Commerce',
                  currency: onboardingCurrency.trim() || 'FCFA',
                });
              }}
              className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Démarrer maintenant</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <CloudMigrationBanner />
      <PWAUpdateToast />
      {activeView === 'dashboard' && <DashboardPage />}
      {activeView === 'sales' && <SalePage />}
      {activeView === 'products' && <ProductsPage />}
      {activeView === 'stock' && <StockPage />}
      {activeView === 'clients' && <ClientsPage />}
      {activeView === 'invoices' && <InvoicesPage />}
      {activeView === 'receivables' && <ReceivablesPage />}
      {activeView === 'quotes' && <QuotesPage />}
      {activeView === 'reports' && <ReportsPage />}
      {activeView === 'settings' && <SettingsPage />}
      {activeView === 'manual_invoice' && <ManualInvoicePage />}
    </AppShell>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <MainView />
      </AuthProvider>
    </AppProvider>
  );
}
