import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Users,
  FileText,
  BadgeAlert,
  ClipboardList,
  BarChart3,
  Settings,
  Package,
  Lock,
  LogOut,
} from 'lucide-react';
import { useApp, ActiveView } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { BrandLogo } from '../common/BrandLogo';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const Sidebar: React.FC = () => {
  const { activeView, navigate, state, lockApp } = useApp();
  const { user, signOutUser } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const activeReceivablesCount = state.invoices.filter(
    (i) => (i.status === 'unpaid' || i.status === 'partial') && i.remainingAmount > 0
  ).length;

  const mainNavigation: Array<{
    view: ActiveView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    badgeColor?: string;
  }> = [
    { view: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    { view: 'sales', label: 'Nouvelle vente', icon: ShoppingCart },
    { view: 'invoices', label: 'Mes ventes', icon: FileText, badge: state.invoices.length },
    { view: 'products', label: 'Mes produits', icon: Package, badge: state.products.length },
    { view: 'stock', label: 'Stock & Flux', icon: Boxes, badge: state.movements.length },
    { view: 'clients', label: 'Clients & Contacts', icon: Users, badge: state.clients.length },
    {
      view: 'receivables',
      label: 'À encaisser',
      icon: BadgeAlert,
      badge: activeReceivablesCount > 0 ? activeReceivablesCount : undefined,
      badgeColor: 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/60 dark:text-rose-300',
    },
    { view: 'quotes', label: 'Devis & Chiffrages', icon: ClipboardList, badge: state.quotes.length },
    { view: 'reports', label: 'Rapports & Marges', icon: BarChart3 },
  ];

  const handleLogout = async () => {
    await signOutUser();
    setShowLogoutConfirm(false);
  };

  return (
    <>
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white dark:bg-[#131B2E] border-r border-[#E8EDF2] dark:border-[#22304E] shrink-0 h-screen sticky top-0 overflow-y-auto">
        {/* Brand Header */}
        <div className="p-5 border-b border-[#E8EDF2] dark:border-[#22304E] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" />
            <div className="min-w-0">
              <h1 className="text-base font-extrabold text-[#14213D] dark:text-white leading-tight truncate">
                StockFacture Pro
              </h1>
              <p className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold truncate">
                Votre gestion, partout, tout le temps.
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 truncate max-w-[140px] mt-0.5">
                {state.settings.name || 'Commerce'}
              </p>
            </div>
          </div>

          {state.settings.pinEnabled && (
            <button
              onClick={lockApp}
              title="Verrouiller l'application"
              className="p-2 rounded-xl text-slate-400 hover:text-orange-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation links */}
        <nav className="p-3.5 space-y-1 flex-1">
          <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400">
            Navigation Principale
          </div>

          {mainNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all active:scale-[0.98] ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-[#14213D] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : item.badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer with Settings, Logout & PWA */}
        <div className="p-4 border-t border-[#E8EDF2] dark:border-[#22304E] space-y-2">
          <button
            onClick={() => navigate('settings')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              activeView === 'settings'
                ? 'bg-[#14213D] text-white dark:bg-white dark:text-[#14213D] shadow-xs'
                : 'text-[#64748B] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Paramètres Entreprise</span>
          </button>

          {/* Bouton de déconnexion */}
          {user && (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          )}

          <PWAInstallButton />

          <div className="text-[10px] text-center text-[#64748B] dark:text-slate-500">
            StockFacture Pro • 100% Hors-Ligne
          </div>
        </div>
      </aside>

      {/* Dialogue de confirmation de déconnexion */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Se déconnecter ?"
        message={`Vous allez être déconnecté de ${user?.email || 'votre compte Google'}. Vos données restent synchronisées dans le cloud et vous pourrez vous reconnecter à tout moment.`}
        confirmLabel="Se déconnecter"
        cancelLabel="Annuler"
        isDestructive
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
};