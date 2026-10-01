import React, { useState, useMemo } from 'react';
import {
  Boxes,
  ArrowDownRight,
  ArrowUpRight,
  Sliders,
  Search,
  Filter,
  AlertTriangle,
  History,
  TrendingUp,
  Calendar,
  Gift,
  AlertOctagon,
  FileText,
  X,
  Package,
  Layers,
  ChevronRight,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { StockMovement, StockMovementType, StockMovementReason } from '../types';
import { formatCurrency, formatDateTime, getStockReasonLabel, getTodayDateString } from '../utils/formatters';
import { calculateStockValue } from '../utils/calculations';
import { StatusBadge } from '../components/common/StatusBadge';
import { StockMovementModal } from '../components/modals/StockMovementModal';

type MovementFilterKey = 'all' | 'in' | 'sale' | 'donation' | 'defective' | 'loss' | 'adjustment' | 'return';
type PeriodFilterKey = 'all' | 'today' | 'week' | 'month' | 'custom';

export const StockPage: React.FC = () => {
  const { state, navigate } = useApp();
  const { currency, currencyPosition } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');

  // Filters for Movement History
  const [movementFilter, setMovementFilter] = useState<MovementFilterKey>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterKey>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalType, setStockModalType] = useState<StockMovementType>('in');
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);

  // Inventory valuation
  const stockStats = useMemo(() => calculateStockValue(state.products), [state.products]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return state.movements.filter((m) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.productName.toLowerCase().includes(q) ||
        (m.referenceId && m.referenceId.toLowerCase().includes(q)) ||
        (m.note && m.note.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // 2. Product Filter
      if (productFilter !== 'all' && m.productId !== productFilter) {
        return false;
      }

      // 3. Movement Type / Reason Filter
      if (movementFilter === 'in' && m.type !== 'in') return false;
      if (movementFilter === 'sale' && (m.type !== 'out' || m.reason !== 'sale')) return false;
      if (movementFilter === 'donation' && (m.type !== 'out' || m.reason !== 'donation')) return false;
      if (
        movementFilter === 'defective' &&
        (m.type !== 'out' || (m.reason !== 'defective' && m.reason !== 'breakage'))
      ) {
        return false;
      }
      if (
        movementFilter === 'loss' &&
        (m.type !== 'out' || (m.reason !== 'loss' && m.reason !== 'theft'))
      ) {
        return false;
      }
      if (
        movementFilter === 'adjustment' &&
        m.type !== 'adjustment' &&
        m.reason !== 'correction'
      ) {
        return false;
      }
      if (movementFilter === 'return' && m.reason !== 'customer_return') {
        return false;
      }

      // 4. Period Filter
      if (periodFilter === 'today') {
        const todayStr = getTodayDateString();
        return m.createdAt.startsWith(todayStr);
      }
      if (periodFilter === 'week') {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - 7);
        return new Date(m.createdAt) >= dateLimit;
      }
      if (periodFilter === 'month') {
        const now = new Date();
        const mDate = new Date(m.createdAt);
        return (
          mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear()
        );
      }
      if (periodFilter === 'custom') {
        const mDateStr = m.createdAt.slice(0, 10);
        if (customStartDate && mDateStr < customStartDate) return false;
        if (customEndDate && mDateStr > customEndDate) return false;
      }

      return true;
    });
  }, [
    state.movements,
    searchQuery,
    productFilter,
    movementFilter,
    periodFilter,
    customStartDate,
    customEndDate,
  ]);

  // Movement counts for summary pills
  const counts = useMemo(() => {
    return {
      all: state.movements.length,
      in: state.movements.filter((m) => m.type === 'in').length,
      sale: state.movements.filter((m) => m.type === 'out' && m.reason === 'sale').length,
      donation: state.movements.filter((m) => m.type === 'out' && m.reason === 'donation').length,
      defective: state.movements.filter(
        (m) => m.type === 'out' && (m.reason === 'defective' || m.reason === 'breakage')
      ).length,
      loss: state.movements.filter(
        (m) => m.type === 'out' && (m.reason === 'loss' || m.reason === 'theft')
      ).length,
      adjustment: state.movements.filter(
        (m) => m.type === 'adjustment' || m.reason === 'correction'
      ).length,
      return: state.movements.filter((m) => m.reason === 'customer_return').length,
    };
  }, [state.movements]);

  // Reset filters helper
  const handleResetFilters = () => {
    setSearchQuery('');
    setMovementFilter('all');
    setProductFilter('all');
    setPeriodFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const isFiltered =
    movementFilter !== 'all' ||
    productFilter !== 'all' ||
    periodFilter !== 'all' ||
    Boolean(searchQuery);

  return (
    <div className="space-y-5 animate-in fade-in duration-200 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+36px)] md:pb-8">
      {/* 1. Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#14213D] dark:text-white tracking-tight">
            Gestion du Stock
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400">
            Entrées, sorties certifiées (Vente, Don, Défectueux, Perte) et traçabilité des flux
          </p>
        </div>

        {/* Action Buttons : + Entrée, - Sortie, Ajustement */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => {
              setStockModalType('in');
              setSelectedProductId(undefined);
              setShowStockModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-transform active:scale-95 min-h-[42px] cursor-pointer"
          >
            <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
            <span>+ Entrée</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStockModalType('out');
              setSelectedProductId(undefined);
              setShowStockModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-rose-600/20 transition-transform active:scale-95 min-h-[42px] cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            <span>- Sortie</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStockModalType('adjustment');
              setSelectedProductId(undefined);
              setShowStockModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] text-[#14213D] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 min-h-[42px] cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-orange-500" />
            <span className="hidden sm:inline">Ajustement</span>
          </button>
        </div>
      </div>

      {/* 2. Valuation & Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 block mb-1">
            Valeur vente potentielle
          </span>
          <div className="text-lg sm:text-xl font-black font-financial text-orange-600 dark:text-orange-400">
            {curr(stockStats.sellingValue)}
          </div>
          <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1 block">
            {stockStats.totalUnits} pièces en rayon
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 block mb-1">
            Coût d'achat total
          </span>
          <div className="text-lg sm:text-xl font-black font-financial text-[#14213D] dark:text-white">
            {curr(stockStats.purchaseValue)}
          </div>
          <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1 block">
            Capital immobilisé
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-200 dark:border-amber-900/60 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1">
            Stock faible
          </span>
          <div className="text-lg sm:text-xl font-black font-financial text-amber-600 dark:text-amber-400">
            {stockStats.lowStockCount} article{stockStats.lowStockCount > 1 ? 's' : ''}
          </div>
          <span className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 block">
            Seuil critique atteint
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-200 dark:border-rose-900/60 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block mb-1">
            Rupture totale
          </span>
          <div className="text-lg sm:text-xl font-black font-financial text-rose-600 dark:text-rose-400">
            {stockStats.outOfStockCount} article{stockStats.outOfStockCount > 1 ? 's' : ''}
          </div>
          <span className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 block">
            À commander d'urgence
          </span>
        </div>
      </div>

      {/* 3. Section Switcher Tabs : [ État des stocks ] vs [ Historique complet des mouvements ] */}
      <div className="flex items-center gap-2 border-b border-[#E8EDF2] dark:border-[#22304E] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all ${
            activeTab === 'inventory'
              ? 'bg-[#14213D] text-white dark:bg-white dark:text-[#14213D] shadow-sm'
              : 'text-[#64748B] dark:text-slate-400 hover:text-[#14213D] hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>État des stocks ({state.products.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all ${
            activeTab === 'movements'
              ? 'bg-[#14213D] text-white dark:bg-white dark:text-[#14213D] shadow-sm'
              : 'text-[#64748B] dark:text-slate-400 hover:text-[#14213D] hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Historique des flux ({state.movements.length})</span>
        </button>
      </div>

      {/* 4. TAB 1: INVENTORY (ÉTAT DES STOCKS) */}
      {activeTab === 'inventory' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {state.products.map((p) => {
              const isOut = p.stockQuantity <= 0;
              const isLow = p.stockQuantity > 0 && p.stockQuantity <= p.minStockAlert;

              return (
                <div
                  key={p.id}
                  className="p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm flex flex-col justify-between space-y-3 hover:border-orange-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-[#64748B] dark:text-slate-400">
                        {p.sku || (p.barcode ? `Réf: ${p.barcode}` : 'SANS-REF')}
                      </span>
                      <h4 className="text-sm font-black text-[#14213D] dark:text-white leading-tight truncate">
                        {p.name}
                      </h4>
                    </div>

                    <StatusBadge
                      status={isOut ? 'out_of_stock' : isLow ? 'low' : 'in_stock'}
                    />
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#64748B] dark:text-slate-400 block font-semibold">
                        Stock disponible
                      </span>
                      <span
                        className={`text-lg font-mono font-financial font-black ${
                          isOut
                            ? 'text-rose-600 dark:text-rose-400'
                            : isLow
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[#14213D] dark:text-white'
                        }`}
                      >
                        {p.stockQuantity} {p.unit}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#64748B] dark:text-slate-400 block font-semibold">
                        Seuil alerte
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        min {p.minStockAlert}
                      </span>
                    </div>
                  </div>

                  {/* Actions directes par produit */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setStockModalType('in');
                        setShowStockModal(true);
                      }}
                      className="flex-1 py-2 px-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>+ Entrée</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setStockModalType('out');
                        setShowStockModal(true);
                      }}
                      className="flex-1 py-2 px-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>- Sortie</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProductFilter(p.id);
                        setActiveTab('movements');
                      }}
                      className="p-2 rounded-xl bg-[#FAFAF8] dark:bg-slate-800 text-[#64748B] hover:text-[#14213D] hover:bg-slate-100 transition-colors"
                      title="Voir historique de cet article"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB 2: HISTORIQUE COMPLET DES MOUVEMENTS */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* A. Search & Controls */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm space-y-3.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par produit, référence, n° facture ou motif..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-10 rounded-2xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Pills : Type & Motifs autorisés (Tous, Entrées, Vente, Don, Article défectueux, Perte, Ajustements) */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                Filtrer par type & motif
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { key: 'all', label: `Tous (${counts.all})` },
                  { key: 'in', label: `Entrées (${counts.in})`, color: 'text-emerald-600' },
                  { key: 'sale', label: `Vente (${counts.sale})`, color: 'text-orange-600' },
                  { key: 'donation', label: `Don (${counts.donation})`, color: 'text-purple-600' },
                  { key: 'defective', label: `Article défectueux (${counts.defective})`, color: 'text-amber-600' },
                  { key: 'loss', label: `Perte (${counts.loss})`, color: 'text-rose-600' },
                  { key: 'adjustment', label: `Ajustements (${counts.adjustment})`, color: 'text-indigo-600' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setMovementFilter(f.key as MovementFilterKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      movementFilter === f.key
                        ? 'bg-[#14213D] text-white shadow-xs'
                        : 'bg-[#FAFAF8] dark:bg-slate-800 text-[#64748B] dark:text-slate-400 border border-[#E8EDF2] dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary Filters : Produit & Période */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#E8EDF2] dark:border-[#22304E]">
              {/* Product selector */}
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                  Filtrer par produit
                </label>
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">Tous les produits ({state.products.length})</option>
                  {state.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period selector */}
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                  Période
                </label>
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value as PeriodFilterKey)}
                  className="w-full h-10 px-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">Toutes les dates</option>
                  <option value="today">Aujourd'hui</option>
                  <option value="week">7 derniers jours</option>
                  <option value="month">Ce mois-ci</option>
                  <option value="custom">Période personnalisée</option>
                </select>
              </div>
            </div>

            {/* Custom Date Inputs if custom period */}
            {periodFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-2.5 pt-2 animate-in fade-in">
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                    Date début
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                    Date fin
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Reset Filters button if active */}
            {isFiltered && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réinitialiser les filtres</span>
                </button>
              </div>
            )}
          </div>

          {/* B. Mouvements List */}
          {filteredMovements.length === 0 ? (
            <div className="p-10 text-center rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] text-[#64748B] dark:text-slate-400 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-bold">Aucun mouvement ne correspond aux filtres appliqués.</p>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs text-orange-600 font-bold hover:underline"
                >
                  Effacer les filtres
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1 text-xs text-[#64748B] dark:text-slate-400 font-bold">
                <span>{filteredMovements.length} mouvement(s) trouvé(s)</span>
                <span>Quantités et stocks avant/après certifiés</span>
              </div>

              {filteredMovements.map((m) => {
                // Determine motif badge appearance
                const isOut = m.type === 'out';
                const isIn = m.type === 'in';
                const isAdj = m.type === 'adjustment';

                let badgeColor =
                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200';
                let reasonText = getStockReasonLabel(m.reason);
                let IconComponent = Sliders;

                if (isIn) {
                  if (m.reason === 'customer_return') {
                    badgeColor =
                      'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/40';
                    IconComponent = RotateCcw;
                    reasonText = 'Retour';
                  } else {
                    badgeColor =
                      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/40';
                    IconComponent = ArrowDownRight;
                    reasonText = 'Entrée';
                  }
                } else if (isOut) {
                  if (m.reason === 'sale') {
                    badgeColor =
                      'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200/70 dark:border-orange-800/40';
                    IconComponent = ArrowUpRight;
                    reasonText = 'Vente';
                  } else if (m.reason === 'donation') {
                    badgeColor =
                      'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200/70 dark:border-purple-800/40';
                    IconComponent = Gift;
                    reasonText = 'Don';
                  } else if (m.reason === 'defective' || m.reason === 'breakage') {
                    badgeColor =
                      'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/40';
                    IconComponent = AlertTriangle;
                    reasonText = 'Article défectueux';
                  } else if (m.reason === 'loss' || m.reason === 'theft') {
                    badgeColor =
                      'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200/70 dark:border-rose-800/40';
                    IconComponent = AlertOctagon;
                    reasonText = 'Perte';
                  } else {
                    badgeColor =
                      'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200/70 dark:border-rose-800/40';
                    IconComponent = ArrowUpRight;
                  }
                } else if (isAdj) {
                  badgeColor =
                    'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/40';
                  IconComponent = Sliders;
                  reasonText = 'Ajustement';
                }

                // Check if reference is an invoice
                const isInvoiceRef = m.referenceId && m.referenceId.startsWith('FAC-');

                return (
                  <div
                    key={m.id}
                    className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                  >
                    {/* Left: Icon, Product, Date & Motif badge */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${badgeColor}`}
                      >
                        <IconComponent className="w-5 h-5 stroke-[2.5]" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-[#14213D] dark:text-white leading-tight">
                            {m.productName}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black border uppercase tracking-wider ${badgeColor}`}
                          >
                            {reasonText}
                          </span>
                        </div>

                        {/* Date, Reason & Reference/Facture */}
                        <div className="text-[11px] text-[#64748B] dark:text-slate-400 flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{formatDateTime(m.createdAt)}</span>
                          </span>

                          {m.referenceId && (
                            <>
                              <span>•</span>
                              {isInvoiceRef ? (
                                <button
                                  type="button"
                                  onClick={() => navigate('invoices')}
                                  className="inline-flex items-center gap-1 font-mono font-bold text-orange-600 dark:text-orange-400 hover:underline"
                                  title="Consulter la facture"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>{m.referenceId}</span>
                                </button>
                              ) : (
                                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                  Réf: {m.referenceId}
                                </span>
                              )}
                            </>
                          )}

                          {m.note && (
                            <>
                              <span>•</span>
                              <span className="italic text-slate-500">"{m.note}"</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quantity & Stock avant / après */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-[#E8EDF2] dark:border-slate-800 shrink-0">
                      <div
                        className={`text-base sm:text-lg font-black font-mono font-financial ${
                          isIn
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isOut
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {isIn ? `+${m.quantity}` : isOut ? `-${m.quantity}` : m.quantity}
                      </div>

                      <div className="text-xs font-mono font-bold text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                        <span>Stock :</span>
                        <span className="text-[#14213D] dark:text-white">{m.previousStock}</span>
                        <span className="text-slate-400">→</span>
                        <span
                          className={`font-black ${
                            m.newStock <= 0
                              ? 'text-rose-600'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {m.newStock}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Movement Modal (+ Entrée, - Sortie, Ajustement) */}
      <StockMovementModal
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        defaultType={stockModalType}
        defaultProductId={selectedProductId}
      />
    </div>
  );
};
