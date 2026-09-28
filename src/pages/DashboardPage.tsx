import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Coins,
  BadgeAlert,
  ShoppingCart,
  BarChart3,
  AlertTriangle,
  FileText,
  Boxes,
  ArrowRight,
  Plus,
  ArrowDownRight,
  CheckCircle2,
  Calendar,
  Clock,
  Package,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Product } from '../types';
import { formatCurrency, formatDate, formatRelativeDate } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { StockMovementModal } from '../components/modals/StockMovementModal';

export const DashboardPage: React.FC = () => {
  const { state, navigate } = useApp();
  const { currency, currencyPosition, name: companyName } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  // Stock movement modal for quick replenishment
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // 1. Chiffre d'affaires du jour & Montant encaissé & Ventes
  const todayInvoices = useMemo(
    () => state.invoices.filter((i) => i.status !== 'cancelled' && i.date === todayStr),
    [state.invoices, todayStr]
  );
  const todayRevenue = useMemo(
    () => todayInvoices.reduce((sum, i) => sum + i.total, 0),
    [todayInvoices]
  );
  const todayCollected = useMemo(
    () => todayInvoices.reduce((sum, i) => sum + i.amountPaid, 0),
    [todayInvoices]
  );
  const todaySalesCount = todayInvoices.length;

  // 2. Ticket moyen
  const averageTicket = todaySalesCount > 0 ? Math.round(todayRevenue / todaySalesCount) : 0;

  // 3. Montant restant à encaisser & Factures impayées
  const unpaidInvoices = useMemo(
    () =>
      state.invoices.filter(
        (inv) => (inv.status === 'unpaid' || inv.status === 'partial') && inv.remainingAmount > 0
      ),
    [state.invoices]
  );
  const totalReceivables = useMemo(
    () => unpaidInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0),
    [unpaidInvoices]
  );
  const unpaidInvoicesCount = unpaidInvoices.length;

  // 4. Produits en stock faible (seuil d'alerte ou rupture)
  const lowStockProducts = useMemo(
    () => state.products.filter((p) => p.stockQuantity <= p.minStockAlert),
    [state.products]
  );
  const lowStockCount = lowStockProducts.length;

  // 5. Activité récente (dernières factures / ventes)
  const recentInvoices = useMemo(
    () =>
      state.invoices
        .filter((i) => i.status !== 'cancelled')
        .slice(0, 5),
    [state.invoices]
  );

  const currentHour = now.getHours();
  const greeting = currentHour < 12 ? 'Bonjour' : currentHour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-5 animate-in fade-in duration-200 max-w-4xl mx-auto pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+36px)] md:pb-8">
      {/* 1. HEADER DU DASHBOARD */}
      {/* Conserver AU MAXIMUM un seul bouton "Nouvelle vente" sur tout l'écran */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#14213D] dark:text-white tracking-tight">
              {greeting} 👋
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              EN DIRECT
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
            {companyName || 'StockFacture Pro'} • {formatDate(now)}
          </p>
        </div>

        {/* L'UNIQUE bouton "Nouvelle vente" de l'écran Accueil */}
        <button
          type="button"
          onClick={() => navigate('sales')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 self-start sm:self-auto min-h-[44px] cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nouvelle vente</span>
        </button>
      </div>

      {/* 2. CHIFFRES CLÉS EN PRIORITÉ (7 KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* KPI 1 : Chiffre d'affaires du jour */}
        <div className="col-span-2 sm:col-span-1 p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              C.A. du jour
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 flex items-center justify-center border border-orange-200/60 dark:border-orange-900/40">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-financial text-[#14213D] dark:text-white">
              {curr(todayRevenue)}
            </div>
            <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
              Ventes d'aujourd'hui
            </span>
          </div>
        </div>

        {/* KPI 2 : Montant encaissé */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Montant encaissé
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-900/40">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-financial text-emerald-600 dark:text-emerald-400">
              {curr(todayCollected)}
            </div>
            <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
              En caisse / banques
            </span>
          </div>
        </div>

        {/* KPI 3 : Montant restant à encaisser */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Reste à encaisser
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-900/40">
              <BadgeAlert className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-financial text-rose-600 dark:text-rose-400">
              {curr(totalReceivables)}
            </div>
            <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
              Créances à recouvrer
            </span>
          </div>
        </div>

        {/* KPI 4 : Nombre de ventes */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Nombre de ventes
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/40">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-[#14213D] dark:text-white">
              {todaySalesCount}
            </div>
            <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
              Commandes traitées
            </span>
          </div>
        </div>

        {/* KPI 5 : Ticket moyen */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Ticket moyen
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 flex items-center justify-center border border-purple-200/60 dark:border-purple-900/40">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-financial text-[#14213D] dark:text-white">
              {curr(averageTicket)}
            </div>
            <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
              Par transaction
            </span>
          </div>
        </div>

        {/* KPI 6 : Nombre de produits en stock faible */}
        <div
          onClick={() => navigate('stock')}
          className="p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm flex flex-col justify-between cursor-pointer hover:border-amber-300 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Stock faible
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-900/40">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              {lowStockCount}
            </div>
            <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
              Produit{lowStockCount > 1 ? 's' : ''} à réapprovisionner
            </span>
          </div>
        </div>

        {/* KPI 7 : Nombre de factures impayées */}
        <div
          onClick={() => navigate('invoices')}
          className="col-span-2 sm:col-span-1 p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm flex flex-col justify-between cursor-pointer hover:border-rose-300 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Factures impayées
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-900/40">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {unpaidInvoicesCount}
            </div>
            <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
              Facture{unpaidInvoicesCount > 1 ? 's' : ''} avec reliquat
            </span>
          </div>
        </div>
      </div>

      {/* 3. SECTION "ACTIVITÉ RÉCENTE" */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 flex items-center justify-center border border-orange-200/60 dark:border-orange-900/40">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#14213D] dark:text-white">
                Activité récente
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Dernières ventes et factures enregistrées
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('invoices')}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Toutes les ventes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/40 border border-[#E8EDF2] dark:border-slate-700/60 text-xs text-[#64748B] dark:text-slate-400">
            Aucune vente enregistrée pour le moment.
          </div>
        ) : (
          <div className="space-y-2">
            {recentInvoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => navigate('invoices', inv.id)}
                className="p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 hover:bg-orange-50/40 dark:hover:bg-slate-800 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group"
              >
                {/* Numéro, Client & Date */}
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-orange-600 dark:text-orange-400 group-hover:underline">
                      #{inv.number}
                    </span>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div className="text-xs font-bold text-[#14213D] dark:text-white truncate mt-1">
                    Client : {inv.clientName}
                  </div>
                  <div className="text-[10px] text-[#64748B] dark:text-slate-400 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{formatRelativeDate(inv.createdAt || inv.date)}</span>
                  </div>
                </div>

                {/* Montant */}
                <div className="text-right shrink-0">
                  <div className="text-sm sm:text-base font-black font-financial text-[#14213D] dark:text-white">
                    {curr(inv.total)}
                  </div>
                  {inv.remainingAmount > 0 ? (
                    <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                      Reste : {curr(inv.remainingAmount)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                      Payée
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. SECTION "STOCK FAIBLE" */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-900/40">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#14213D] dark:text-white">
                Stock faible & Alertes ({lowStockCount})
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Articles sous le seuil d'alerte nécessitant un réapprovisionnement
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('stock')}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Gérer le stock</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="p-6 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Tous les niveaux de stock sont optimaux. Aucun produit sous le seuil d'alerte.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {lowStockProducts.slice(0, 6).map((product) => {
              const isOut = product.stockQuantity <= 0;
              return (
                <div
                  key={product.id}
                  className="p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-[10px] font-mono text-slate-400 block truncate">
                      {product.sku || 'SANS-REF'}
                    </span>
                    <h4 className="font-extrabold text-[#14213D] dark:text-white truncate mt-0.5">
                      {product.name}
                    </h4>
                    <div className="text-[11px] mt-1 flex items-center gap-2">
                      <span
                        className={`font-black font-mono ${
                          isOut ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      >
                        {product.stockQuantity} {product.unit} en rayon
                      </span>
                      <span className="text-slate-400">• Seuil min: {product.minStockAlert}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductId(product.id);
                      setShowStockModal(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-transform active:scale-95 shrink-0 cursor-pointer"
                    title="Ajouter une entrée en stock pour ce produit"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>+ Entrée</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Stock Replenishment Modal */}
      <StockMovementModal
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        defaultType="in"
        defaultProductId={selectedProductId}
      />
    </div>
  );
};
