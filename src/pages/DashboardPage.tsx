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
  PieChart,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { formatCurrency, formatDate, formatRelativeDate } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { StockMovementModal } from '../components/modals/StockMovementModal';

export const DashboardPage: React.FC = () => {
  const { state, navigate } = useApp();
  const { currency, currencyPosition, name: companyName } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // ============================================
  // CALCULS
  // ============================================

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

  // 7 derniers jours
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

  // ============================================
  // SPARKLINE (Amélioration 1)
  // ============================================
  const sparklineData = useMemo(() => {
    const width = 300;
    const height = 40;
    const max = Math.max(...last7Days.map((d) => d.revenue), 1);
    const step = width / (last7Days.length - 1);

    const points = last7Days.map((day, i) => {
      const x = i * step;
      const y = height - (day.revenue / max) * (height - 4) - 2;
      return { x, y };
    });

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `${path} L${width},${height} L0,${height} Z`;

    return { path, areaPath, points, width, height };
  }, [last7Days]);

  // ============================================
  // DONUT CHART (Amélioration 3)
  // ============================================
  const categoriesData = useMemo(() => {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

    const stats = new Map<string, { name: string; revenue: number; color: string }>();

    state.invoices
      .filter((inv) => inv.status !== 'cancelled' && inv.date >= sevenDaysAgoStr)
      .forEach((inv) => {
        inv.items.forEach((item) => {
          if (item.isFreeLine) return;
          const product = state.products.find((p) => p.id === item.productId);
          const cat = state.categories.find((c) => c.id === product?.categoryId);
          const key = cat?.id || 'uncategorized';
          const existing = stats.get(key) || {
            name: cat?.name || 'Sans catégorie',
            revenue: 0,
            color: cat?.color || '#64748B',
          };
          existing.revenue += item.total;
          stats.set(key, existing);
        });
      });

    return Array.from(stats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [state.invoices, state.products, state.categories, now]);

  const donutSegments = useMemo(() => {
    const total = categoriesData.reduce((sum, c) => sum + c.revenue, 0);
    if (total === 0) return [];

    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return categoriesData.map((cat) => {
      const percentage = cat.revenue / total;
      const dashLength = percentage * circumference;
      const segment = {
        ...cat,
        percentage: Math.round(percentage * 100),
        dashLength,
        dashOffset: -offset,
        radius,
        circumference,
      };
      offset += dashLength;
      return segment;
    });
  }, [categoriesData]);

  // ============================================
  // AUTRES
  // ============================================

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

    return Array.from(productStats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  }, [state.invoices, now]);

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

  const lowStockProducts = useMemo(
    () => state.products.filter((p) => p.stockQuantity <= p.minStockAlert),
    [state.products]
  );
  const lowStockCount = lowStockProducts.length;

  const recentInvoices = useMemo(
    () => state.invoices.filter((i) => i.status !== 'cancelled').slice(0, 5),
    [state.invoices]
  );

  const currentHour = now.getHours();
  const greeting = currentHour < 12 ? 'Bonjour' : currentHour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-5 animate-in fade-in duration-200 max-w-4xl mx-auto pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+36px)] md:pb-8">
      {/* HEADER */}
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
      {/* KPI HÉROS AVEC SPARKLINE */}
      {/* ============================================ */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm relative overflow-hidden">
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
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black border transition-all ${
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

        {/* Sparkline SVG */}
        {sparklineData.points.length > 0 && (
          <div className="mt-3 -mx-1">
            <svg
              viewBox={`0 0 ${sparklineData.width} ${sparklineData.height}`}
              className="w-full h-12"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={sparklineData.areaPath} fill="url(#sparkline-gradient)" />
              <path
                d={sparklineData.path}
                fill="none"
                stroke="#F97316"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 1000,
                  strokeDashoffset: 1000,
                  animation: 'drawSparkline 1.5s ease-out forwards',
                }}
              />
            </svg>
          </div>
        )}

        <div className="flex items-center gap-3 mt-3 text-xs text-[#64748B] dark:text-slate-400 font-semibold flex-wrap">
          <span>{todaySalesCount} vente{todaySalesCount > 1 ? 's' : ''} aujourd'hui</span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span>Ticket moyen {curr(averageTicket)}</span>
        </div>
      </div>

      {/* ============================================ */}
      {/* KPI SECONDAIRES */}
      {/* ============================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'Encaissé',
            value: curr(todayCollected),
            sub: 'Caisse / banques',
            color: 'emerald',
            icon: Coins,
            onClick: undefined,
          },
          {
            label: 'Reste dû',
            value: curr(totalReceivables),
            sub: 'Créances clients',
            color: 'rose',
            icon: BadgeAlert,
            onClick: () => navigate('invoices'),
          },
          {
            label: 'Ventes',
            value: todaySalesCount.toString(),
            sub: "Aujourd'hui",
            color: 'blue',
            icon: ShoppingCart,
            onClick: undefined,
          },
          {
            label: 'Stock faible',
            value: lowStockCount.toString(),
            sub: 'À réapprovisionner',
            color: 'amber',
            icon: AlertTriangle,
            onClick: () => navigate('stock'),
          },
          {
            label: 'Impayées',
            value: unpaidInvoicesCount.toString(),
            sub: 'Factures',
            color: 'rose',
            icon: FileText,
            onClick: () => navigate('invoices'),
          },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          const colors = {
            emerald: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40',
            rose: 'text-rose-700 dark:text-rose-400 bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40',
            blue: 'text-blue-700 dark:text-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/40',
            amber: 'text-amber-700 dark:text-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
          };
          const [labelColor, iconBg] = colors[kpi.color as keyof typeof colors].split(' ').reduce(
            (acc, cls, i) => {
              if (i < 2) acc[0] += cls + ' ';
              else acc[1] += cls + ' ';
              return acc;
            },
            ['', '']
          );

          return (
            <div
              key={idx}
              onClick={kpi.onClick}
              className={`p-3.5 rounded-2xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm transition-all duration-200 ${
                kpi.onClick ? 'cursor-pointer hover:border-orange-300 hover:-translate-y-0.5' : ''
              }`}
              style={{
                animation: `fadeSlideUp 0.4s ease-out ${idx * 0.05}s both`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>
                  {kpi.label}
                </span>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${iconBg}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className={`text-base sm:text-lg font-black font-financial ${labelColor}`}>
                {kpi.value}
              </div>
              <span className="text-[10px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
                {kpi.sub}
              </span>
            </div>
          );
        })}
      </div>

      {/* ============================================ */}
      {/* GRAPHIQUE 7 JOURS */}
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
                      animation: `growBar 0.6s ease-out ${idx * 0.05}s both`,
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
      {/* DONUT CHART : RÉPARTITION PAR CATÉGORIE */}
      {/* ============================================ */}
      {donutSegments.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 flex items-center justify-center border border-purple-200/60 dark:border-purple-900/40">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#14213D] dark:text-white">
                Répartition par catégorie
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Sur les 7 derniers jours
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Donut SVG */}
            <div className="relative shrink-0">
              <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth="20"
                  className="dark:stroke-slate-800"
                />
                {donutSegments.map((seg, idx) => (
                  <circle
                    key={idx}
                    cx="80"
                    cy="80"
                    r={seg.radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="20"
                    strokeDasharray={`${seg.dashLength} ${seg.circumference}`}
                    strokeDashoffset={seg.dashOffset}
                    strokeLinecap="butt"
                    style={{
                      animation: `drawDonut 0.8s ease-out ${idx * 0.1}s both`,
                    }}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  Total
                </span>
                <span className="text-xs sm:text-sm font-black font-financial text-[#14213D] dark:text-white">
                  {curr(weekTotalRevenue)}
                </span>
              </div>
            </div>

            {/* Légende */}
            <div className="flex-1 w-full space-y-2">
              {donutSegments.map((seg, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 text-xs"
                  style={{
                    animation: `fadeSlideUp 0.4s ease-out ${idx * 0.08}s both`,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="font-bold text-[#14213D] dark:text-white truncate">
                      {seg.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-black text-[#14213D] dark:text-white">
                      {seg.percentage}%
                    </span>
                    <span className="text-[#64748B] dark:text-slate-400 font-semibold hidden sm:inline">
                      {curr(seg.revenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* TOP 3 PRODUITS */}
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
                  className="p-3 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-sm"
                  style={{
                    animation: `fadeSlideUp 0.4s ease-out ${idx * 0.1}s both`,
                  }}
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
      {/* ACTIVITÉ RÉCENTE */}
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
            {recentInvoices.map((inv, idx) => (
              <div
                key={inv.id}
                onClick={() => navigate('invoices', inv.id)}
                className="p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 hover:bg-orange-50/40 dark:hover:bg-slate-800 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs transition-all cursor-pointer group"
                style={{
                  animation: `fadeSlideUp 0.4s ease-out ${idx * 0.06}s both`,
                }}
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
      {/* STOCK FAIBLE */}
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
            {lowStockProducts.slice(0, 6).map((product, idx) => {
              const isOut = product.stockQuantity <= 0;
              return (
                <div
                  key={product.id}
                  className="p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs transition-all duration-200 hover:shadow-sm"
                  style={{
                    animation: `fadeSlideUp 0.4s ease-out ${idx * 0.06}s both`,
                  }}
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

      {/* ============================================ */}
      {/* ANIMATIONS CSS (injectées dans le DOM) */}
      {/* ============================================ */}
      <style>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes growBar {
          from {
            transform: scaleY(0);
            transform-origin: bottom;
          }
          to {
            transform: scaleY(1);
            transform-origin: bottom;
          }
        }

        @keyframes drawSparkline {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes drawDonut {
          from {
            stroke-dasharray: 0 999;
          }
        }
      `}</style>
    </div>
  );
};