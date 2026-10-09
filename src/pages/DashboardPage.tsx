import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Coins,
  BadgeAlert,
  ShoppingCart,
  BarChart3,
  AlertTriangle,
  FileText,
  ArrowRight,
  Plus,
  ArrowDownRight,
  CheckCircle2,
  Calendar,
  Clock,
  Award,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
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

  // ============================================
  // CALCULS
  // ============================================

  // 1. Chiffre d'affaires du jour
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
  const averageTicket = todaySalesCount > 0 ? Math.round(todayRevenue / todaySalesCount) : 0;

  // 2. Chiffre d'affaires d'hier (comparaison)
  const yesterdayStr = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [now]);
  const yesterdayRevenue = useMemo(
    () =>
      state.invoices
        .filter((i) => i.status !== 'cancelled' && i.date === yesterdayStr)
        .reduce((sum, i) => sum + i.total, 0),
    [state.invoices, yesterdayStr]
  );
  const revenueVariation = useMemo(() => {
    if (yesterdayRevenue === 0) return todayRevenue > 0 ? 100 : 0;
    return Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100);
  }, [todayRevenue, yesterdayRevenue]);

  // 3. Graphique 7 derniers jours
  const last7Days = useMemo(() => {
    const days: Array<{ date: string; label: string; revenue: number }> = [];
    const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayRevenue = state.invoices
        .filter((inv) => inv.status !== 'cancelled' && inv.date === dateStr)
        .reduce((sum, inv) => sum + inv.total, 0);
      days.push({ date: dateStr, label: dayLabels[d.getDay()], revenue: dayRevenue });
    }
    return days;
  }, [state.invoices, now]);

  const maxRevenue7Days = useMemo(
    () => Math.max(...last7Days.map((d) => d.revenue), 1),
    [last7Days]
  );
  const weekTotalRevenue = useMemo(
    () => last7Days.reduce((sum, d) => sum + d.revenue, 0),
    [last7Days]
  );

  // 4. Top 3 produits (7 derniers jours)
  const topProducts = useMemo(() => {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();
    state.invoices
      .filter((inv) => inv.status !== 'cancelled' && inv.date >= sevenDaysAgoStr)
      .forEach((inv) => {
        inv.items.forEach((item) => {
          if (item.isFreeLine) return;
          const key = item.productId || item.designation;
          const existing = productStats.get(key) || { name: item.designation, quantity: 0, revenue: 0 };
          existing.quantity += item.quantity;
          existing.revenue += item.total;
          productStats.set(key, existing);
        });
      });

    return Array.from(productStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
  }, [state.invoices, now]);

  // 5. Créances
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

  // 6. Stock faible
  const lowStockProducts = useMemo(
    () => state.products.filter((p) => p.stockQuantity <= p.minStockAlert),
    [state.products]
  );
  const lowStockCount = lowStockProducts.length;

  // 7. Activité récente
  const recentInvoices = useMemo(
    () => state.invoices.filter((i) => i.status !== 'cancelled').slice(0, 5),
    [state.invoices]
  );

  const currentHour = now.getHours();
  const greeting = currentHour < 12 ? 'Bonjour' : currentHour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-5 animate-in fade-in duration-200 max-w-4xl mx-auto pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+36px)] md:pb-8">
      {/* ============================================ */}
      {/* 1. HEADER */}
      {/* ============================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#14213D] dark:text-white tracking-tight">
              {greeting}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
            {companyName || 'StockFacture Pro'} • {formatDate(now)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('sales')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 self-start sm:self-auto min-h-[44px] cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nouvelle vente</span>
        </button>
      </div>

      {/* ============================================ */}
      {/* 2. CARTE VEDETTE : C.A. DU JOUR (minimaliste) */}
      {/* ============================================ */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm relative overflow-hidden">
        {/* Liseré orange fin en haut (accent subtil) */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-transparent" />

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 flex items-center justify-center border border-orange-200/60 dark:border-orange-900/40">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              C.A. du jour
            </span>
          </div>

          {(yesterdayRevenue > 0 || todayRevenue > 0) && (
            <div
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black border ${
                revenueVariation > 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                  : revenueVariation < 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                  : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
            >
              {revenueVariation > 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : revenueVariation < 0 ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              <span>
                {revenueVariation > 0 ? '+' : ''}
                {revenueVariation}% vs hier
              </span>
            </div>
          )}
        </div>

        <div className="text-3xl sm:text-4xl font-black font-financial text-[#14213D] dark:text-white tracking-tight">
          {curr(todayRevenue)}
        </div>

        <div className="flex items-center gap-3 mt-3 text-xs text-[#64748B] dark:text-slate-400 font-semibold flex-wrap">
          <span>{todaySalesCount} vente{todaySalesCount > 1 ? 's' : ''} aujourd'hui</span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span>Ticket moyen {curr(averageTicket)}</span>
        </div>
      </div>

      {/* ============================================ */}
      {/* 3. KPI SECONDAIRES (5 cartes) */}
      {/* ============================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Encaissé */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Encaissé
            </span>
            <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-black font-financial text-emerald-600 dark:text-emerald-400">
            {curr(todayCollected)}
          </div>
          <span className="text-[10px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
            Caisse / banques
          </span>
        </div>

        {/* Reste à encaisser */}
        <div
          onClick={() => navigate('invoices')}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm cursor-pointer hover:border-rose-300 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Reste dû
            </span>
            <BadgeAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-base sm:text-lg font-black font-financial text-rose-600 dark:text-rose-400">
            {curr(totalReceivables)}
          </div>
          <span className="text-[10px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
            Créances clients
          </span>
        </div>

        {/* Nb ventes */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Ventes
            </span>
            <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-[#14213D] dark:text-white">
            {todaySalesCount}
          </div>
          <span className="text-[10px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
            Aujourd'hui
          </span>
        </div>

        {/* Stock faible */}
        <div
          onClick={() => navigate('stock')}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm cursor-pointer hover:border-amber-300 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Stock faible
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
            {lowStockCount}
          </div>
          <span className="text-[10px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
            À réapprovisionner
          </span>
        </div>

        {/* Impayées */}
        <div
          onClick={() => navigate('invoices')}
          className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm cursor-pointer hover:border-rose-300 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Impayées
            </span>
            <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
            {unpaidInvoicesCount}
          </div>
          <span className="text-[10px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
            Factures
          </span>
        </div>
      </div>

      {/* ============================================ */}
      {/* 4. GRAPHIQUE 7 JOURS */}
      {/* ============================================ */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/40">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#14213D] dark:text-white">
                Ventes des 7 derniers jours
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Total : <strong className="font-financial text-orange-600 dark:text-orange-400">{curr(weekTotalRevenue)}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-1.5 sm:gap-2.5 h-32 pt-2">
          {last7Days.map((day, idx) => {
            const heightPercent = maxRevenue7Days > 0 ? (day.revenue / maxRevenue7Days) * 100 : 0;
            const isToday = day.date === todayStr;
            const hasRevenue = day.revenue > 0;

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-[#14213D] dark:bg-white text-white dark:text-[#14213D] text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none z-10">
                  {curr(day.revenue)}
                </div>

                <div className="flex-1 w-full flex items-end">
                  <div
                    className={`w-full rounded-t-xl transition-all duration-300 ${
                      isToday
                        ? 'bg-gradient-to-t from-orange-500 to-orange-400'
                        : hasRevenue
                        ? 'bg-gradient-to-t from-slate-300 to-slate-200 dark:from-slate-600 dark:to-slate-500'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                    style={{
                      height: `${Math.max(heightPercent, 4)}%`,
                      minHeight: '4px',
                    }}
                  />
                </div>

                <span
                  className={`text-[10px] sm:text-xs font-bold ${
                    isToday
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-[#64748B] dark:text-slate-500'
                  }`}
                >
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 pt-2 border-t border-[#E8EDF2] dark:border-[#22304E] text-[10px] text-[#64748B] dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-orange-500 to-orange-400" />
            Aujourd'hui
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />
            Jours précédents
          </span>
        </div>
      </div>

      {/* ============================================ */}
      {/* 5. TOP 3 PRODUITS */}
      {/* ============================================ */}
      {topProducts.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-900/40">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#14213D] dark:text-white">
                  Top 3 produits de la semaine
                </h3>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                  Vos meilleures ventes des 7 derniers jours
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('reports')}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Rapports</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {topProducts.map((prod, idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{medals[idx]}</span>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-extrabold text-[#14213D] dark:text-white truncate">
                        {prod.name}
                      </div>
                      <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {prod.quantity} unité{prod.quantity > 1 ? 's' : ''} vendue{prod.quantity > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-black font-financial text-orange-600 dark:text-orange-400">
                      {curr(prod.revenue)}
                    </div>
                    <div className="text-[10px] text-[#64748B] dark:text-slate-400">
                      C.A. généré
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* 6. ACTIVITÉ RÉCENTE */}
      {/* ============================================ */}
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

      {/* ============================================ */}
      {/* 7. STOCK FAIBLE */}
      {/* ============================================ */}
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