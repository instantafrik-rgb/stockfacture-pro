import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Coins,
  DollarSign,
  Calendar,
  Package,
  Users,
  Award,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Filter,
  CreditCard,
  Percent,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { formatCurrency, formatDate, getTodayDateString } from '../utils/formatters';
import { calculateStockValue } from '../utils/calculations';
import {
  calculateFinancialMetrics,
  calculatePaymentBreakdown,
  calculateProductPerformances,
} from '../utils/reportsAnalytics';
import { CashClosureModal } from '../components/modals/CashClosureModal';
import { Phase5TestModal } from '../components/modals/Phase5TestModal';
import { CashRegisterClosure } from '../types';

export const ReportsPage: React.FC = () => {
  const { state, navigate } = useApp();
  const { currency, currencyPosition, name: companyName } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  // Period state
  const [period, setPeriod] = useState<'today' | '7' | '30' | 'this_month' | 'this_year' | 'all' | 'custom'>('30');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(() => getTodayDateString());

  // Top products sort
  const [productSortBy, setProductSortBy] = useState<'revenue' | 'volume' | 'profit'>('revenue');

  // Modals
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [localClosures, setLocalClosures] = useState<CashRegisterClosure[]>(() => state.closures || []);

  // Filter invoices according to selected period
  const filteredInvoices = useMemo(() => {
    const today = getTodayDateString();
    return state.invoices.filter((inv) => {
      if (inv.status === 'cancelled') return false;

      if (period === 'all') return true;

      if (period === 'today') {
        return inv.date === today;
      }

      if (period === '7') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return inv.date >= d.toISOString().slice(0, 10);
      }

      if (period === '30') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return inv.date >= d.toISOString().slice(0, 10);
      }

      if (period === 'this_month') {
        const monthPrefix = today.slice(0, 7); // YYYY-MM
        return inv.date.startsWith(monthPrefix);
      }

      if (period === 'this_year') {
        const yearPrefix = today.slice(0, 4); // YYYY
        return inv.date.startsWith(yearPrefix);
      }

      if (period === 'custom') {
        return inv.date >= customStartDate && inv.date <= customEndDate;
      }

      return true;
    });
  }, [state.invoices, period, customStartDate, customEndDate]);

  // Filter payments according to selected period
  const filteredPayments = useMemo(() => {
    const today = getTodayDateString();
    return state.payments.filter((p) => {
      if (period === 'all') return true;
      if (period === 'today') return p.date === today;
      if (period === '7') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return p.date >= d.toISOString().slice(0, 10);
      }
      if (period === '30') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return p.date >= d.toISOString().slice(0, 10);
      }
      if (period === 'this_month') {
        return p.date.startsWith(today.slice(0, 7));
      }
      if (period === 'this_year') {
        return p.date.startsWith(today.slice(0, 4));
      }
      if (period === 'custom') {
        return p.date >= customStartDate && p.date <= customEndDate;
      }
      return true;
    });
  }, [state.payments, period, customStartDate, customEndDate]);

  // Core analytics metrics
  const financialMetrics = useMemo(() => {
    return calculateFinancialMetrics(filteredInvoices);
  }, [filteredInvoices]);

  // Payment breakdown
  const paymentBreakdown = useMemo(() => {
    return calculatePaymentBreakdown(filteredPayments);
  }, [filteredPayments]);

  // Product performances
  const productPerformances = useMemo(() => {
    const list = calculateProductPerformances(filteredInvoices);
    if (productSortBy === 'volume') {
      return [...list].sort((a, b) => b.unitsSold - a.unitsSold);
    }
    if (productSortBy === 'profit') {
      return [...list].sort((a, b) => b.grossProfit - a.grossProfit);
    }
    return list; // default revenue
  }, [filteredInvoices, productSortBy]);

  // Stock valuation stats
  const stockValuation = useMemo(() => {
    return calculateStockValue(state.products);
  }, [state.products]);

  const handleSaveClosure = (closure: CashRegisterClosure) => {
    setLocalClosures((prev) => [closure, ...prev]);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#14213D] dark:text-white tracking-tight">
            Rapports & Marges Réelles
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
            Rentabilité, marges brutes, top ventes & clôtures de caisse journalières (Z)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setShowClosureModal(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 min-h-[44px]"
          >
            <Coins className="w-4 h-4" />
            <span>Clôture Z de Caisse</span>
          </button>
        </div>
      </div>

      {/* 2. Period Selector & Range Filters */}
      <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                period === 'today'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => setPeriod('7')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                period === '7'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              7 derniers jours
            </button>
            <button
              type="button"
              onClick={() => setPeriod('30')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                period === '30'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              30 derniers jours
            </button>
            <button
              type="button"
              onClick={() => setPeriod('this_month')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                period === 'this_month'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Ce mois-ci
            </button>
            <button
              type="button"
              onClick={() => setPeriod('this_year')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                period === 'this_year'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Cette année
            </button>
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                period === 'all'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Tout l'historique
            </button>
            <button
              type="button"
              onClick={() => setPeriod('custom')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                period === 'custom'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Personnalisé
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            {filteredInvoices.length} vente(s) analysée(s)
          </div>
        </div>

        {period === 'custom' && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500 font-bold">Du</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <span className="text-slate-500 font-bold">au</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* 3. Financial KPI Dashboard (CA, COGS, Marge Brute, Panier Moyen) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* KPI 1: Chiffre d'Affaires Facturé */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Chiffre d'Affaires</span>
            <DollarSign className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
              {curr(financialMetrics.totalBilled)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Encaissé : <strong className="text-emerald-600">{curr(financialMetrics.totalCollected)}</strong></span>
              {financialMetrics.totalReceivables > 0 && (
                <span>Dû : <strong className="text-amber-600">{curr(financialMetrics.totalReceivables)}</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* KPI 2: Coût d'Achat des Marchandises (COGS) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Coût des Ventes (COGS)</span>
            <Package className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
              {curr(financialMetrics.totalCostOfGoodsSold)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Dépenses d'achat des {financialMetrics.itemsSoldTotal} unité(s) vendue(s)
            </div>
          </div>
        </div>

        {/* KPI 3: Marge Brute Réelle & Taux de Marge */}
        <div className="p-5 rounded-3xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Marge Brute Réelle</span>
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-emerald-950 dark:text-emerald-200 tracking-tight">
                {curr(financialMetrics.grossProfit)}
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                {financialMetrics.marginRate}%
              </span>
            </div>
            <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-1">
              Bénéfice net brut avant charges fixes
            </div>
          </div>
        </div>

        {/* KPI 4: Panier Moyen */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Panier Moyen</span>
            <BarChart3 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
              {curr(financialMetrics.averageBasket)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Sur {financialMetrics.transactionsCount} transaction(s) réalisée(s)
            </div>
          </div>
        </div>
      </div>

      {/* 4. Middle Section: Modes de Règlement & Valorisation Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Payment Methods Breakdown */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Encaissements par Mode de Paiement
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {filteredPayments.length} paiement(s)
            </span>
          </div>

          {paymentBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Aucun règlement enregistré sur cette période
            </div>
          ) : (
            <div className="space-y-3">
              {paymentBreakdown.map((item) => (
                <div key={item.method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {curr(item.total)} ({item.percentage}%)
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock Valuation & Health */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Valorisation Globale du Stock
              </h3>
            </div>
            <button
              type="button"
              onClick={() => navigate('stock')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Gérer stock
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Valeur d'achat (Coût)</div>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                {curr(stockValuation.purchaseValue)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Capital immobilisé</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Valeur marchande (Vente)</div>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                {curr(stockValuation.sellingValue)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">CA potentiel maximal</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between">
            <div>
              <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                Marge bénéficiaire latente en rayon :
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                Sur les {state.products.length} référence(s) du catalogue
              </span>
            </div>
            <div className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
              +{curr(Math.max(0, stockValuation.sellingValue - stockValuation.purchaseValue))}
            </div>
          </div>
        </div>

      </div>

      {/* 5. Top Products & Profitability Ranking Table */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Classement & Rentabilité des Produits
              </h3>
              <p className="text-xs text-slate-500">
                Performance unitaire des ventes et contribution à la marge brute
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setProductSortBy('revenue')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                productSortBy === 'revenue'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Par CA
            </button>
            <button
              type="button"
              onClick={() => setProductSortBy('volume')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                productSortBy === 'volume'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Par Volume
            </button>
            <button
              type="button"
              onClick={() => setProductSortBy('profit')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                productSortBy === 'profit'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Par Marge
            </button>
          </div>
        </div>

        {productPerformances.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Aucune vente enregistrée sur la période sélectionnée
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3">Produit / Désignation</th>
                  <th className="py-3 px-3 text-center">Quantités</th>
                  <th className="py-3 px-3 text-right">CA Réalisé</th>
                  <th className="py-3 px-3 text-right">Coût Achat</th>
                  <th className="py-3 px-3 text-right">Marge Brute</th>
                  <th className="py-3 px-3 text-center">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {productPerformances.map((prod, idx) => (
                  <tr key={prod.designation + idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          idx === 0
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : idx === 1
                            ? 'bg-slate-300 dark:bg-slate-700 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-700/60 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {prod.designation}
                          </span>
                          {prod.reference && (
                            <span className="text-[10px] font-mono text-slate-400">{prod.reference}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-bold font-mono">
                      {prod.unitsSold}
                    </td>
                    <td className="py-3 px-3 text-right font-bold font-mono text-slate-900 dark:text-white">
                      {curr(prod.revenue)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">
                      {curr(prod.cost)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      +{curr(prod.grossProfit)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                        {prod.marginRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cash Closure Modal */}
      <CashClosureModal
        isOpen={showClosureModal}
        onClose={() => setShowClosureModal(false)}
        onSaveClosure={handleSaveClosure}
      />

      {/* Phase 5 Test Modal */}
      <Phase5TestModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
      />
    </div>
  );
};
