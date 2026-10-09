import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Plus,
  CreditCard,
  Ban,
  TrendingUp,
  Coins,
  BadgeAlert,
  Printer,
  Share2,
  X,
  Calendar,
  Clock,
  ArrowLeft,
  Edit2,
  Phone,
  MapPin,
  CheckCircle,
  Eye,
  Receipt,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  Package,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useToast } from '../store/ToastContext';
import { Invoice, InvoiceStatus, PaymentMethod } from '../types';
import { formatCurrency, formatDate, getPaymentMethodLabel } from '../utils/formatters';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { PaymentModal } from '../components/modals/PaymentModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { generateInvoicePdf } from '../pdf/documentPdf';
import { ThermalReceiptModal } from '../components/modals/ThermalReceiptModal';
import { SaleReturnModal } from '../components/modals/SaleReturnModal';
import { ProductThumbnail } from '../components/common/ProductThumbnail';

type StatusFilterKey = 'all' | 'paid' | 'partial' | 'unpaid' | 'cancelled' | 'returns';

export const InvoicesPage: React.FC = () => {
  const { state, navigate, selectedItemId, setSelectedItemId, cancelInvoice, updateInvoice } = useApp();
  const toast = useToast();
  const { currency, currencyPosition } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [thermalInvoice, setThermalInvoice] = useState<Invoice | null>(null);
  const [returnInvoice, setReturnInvoice] = useState<Invoice | null>(null);
  const [showReturnSelector, setShowReturnSelector] = useState<boolean>(false);
  const [selectorSearchQuery, setSelectorSearchQuery] = useState<string>('');

  // Edit Invoice state
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editClientAddress, setEditClientAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Metrics calculated from real app data
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayInvoices = state.invoices.filter((i) => i.date === todayStr && i.status !== 'cancelled');
  const todayRevenue = todayInvoices.reduce((sum, i) => sum + i.total, 0);
  const todayCollected = todayInvoices.reduce((sum, i) => sum + i.amountPaid, 0);
  const totalReceivables = state.invoices
    .filter((i) => (i.status === 'unpaid' || i.status === 'partial') && i.remainingAmount > 0)
    .reduce((sum, i) => sum + i.remainingAmount, 0);

  // Selected invoice for detail view
  const selectedInvoice = useMemo(() => {
    if (!selectedItemId) return null;
    return state.invoices.find((i) => i.id === selectedItemId) || null;
  }, [state.invoices, selectedItemId]);

  const invoicePayments = useMemo(() => {
    if (!selectedInvoice) return [];
    return state.payments
      .filter((p) => p.invoiceId === selectedInvoice.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.payments, selectedInvoice]);

  const invoiceReturns = useMemo(() => {
    if (!selectedInvoice) return [];
    return (state.returns || []).filter((r) => r.invoiceId === selectedInvoice.id);
  }, [state.returns, selectedInvoice]);

  // Counts for status filters
  const filterCounts = useMemo(() => {
    return {
      all: state.invoices.length,
      paid: state.invoices.filter((i) => i.status === 'paid' || i.remainingAmount <= 0).length,
      partial: state.invoices.filter((i) => i.status === 'partial' && i.remainingAmount > 0).length,
      unpaid: state.invoices.filter((i) => i.status === 'unpaid').length,
      cancelled: state.invoices.filter((i) => i.status === 'cancelled').length,
      returns: (state.returns || []).length,
    };
  }, [state.invoices, state.returns]);

  // Filter returns
  const filteredReturns = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (state.returns || []).filter((r) => {
      if (!q) return true;
      return (
        r.returnNumber.toLowerCase().includes(q) ||
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        (r.userName && r.userName.toLowerCase().includes(q))
      );
    });
  }, [state.returns, searchQuery]);

  // Filter invoices with number, clientName, and clientPhone
  const filteredInvoices = useMemo(() => {
    return state.invoices.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.number.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        (inv.clientPhone && inv.clientPhone.toLowerCase().includes(q));

      let matchesStatus = true;
      if (statusFilter === 'paid') {
        matchesStatus = inv.status === 'paid' || inv.remainingAmount <= 0;
      } else if (statusFilter === 'partial') {
        matchesStatus = inv.status === 'partial' && inv.remainingAmount > 0;
      } else if (statusFilter === 'unpaid') {
        matchesStatus = inv.status === 'unpaid';
      } else if (statusFilter === 'cancelled') {
        matchesStatus = inv.status === 'cancelled';
      }

      return matchesSearch && matchesStatus;
    });
  }, [state.invoices, searchQuery, statusFilter]);

  const handleCancelConfirm = async () => {
    if (invoiceToCancel) {
      const invNumber = invoiceToCancel.number;
      try {
        await cancelInvoice(invoiceToCancel.id);
        setInvoiceToCancel(null);
        toast.success('Facture annulée', `La facture #${invNumber} a été annulée et le stock réintégré.`);
      } catch (err: any) {
        toast.error('Erreur', err?.message || "Impossible d'annuler la facture.");
      }
    }
  };

  const openEditModal = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditDueDate(inv.dueDate || inv.date);
    setEditClientPhone(inv.clientPhone || '');
    setEditClientAddress(inv.clientAddress || '');
    setEditNotes(inv.notes || '');
  };

  const handleSaveInvoiceEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    try {
      await updateInvoice(editingInvoice.id, {
        dueDate: editDueDate || editingInvoice.date,
        clientPhone: editClientPhone.trim() || undefined,
        clientAddress: editClientAddress.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      const invNumber = editingInvoice.number;
      setEditingInvoice(null);
      toast.success('Facture modifiée', `La facture #${invNumber} a été mise à jour.`);
    } catch (err: any) {
      toast.error('Erreur', err?.message || 'Impossible de modifier la facture.');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 max-w-4xl mx-auto pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+36px)] md:pb-8">
      {/* 1. Header : ← Mes ventes    [ Facture manuelle ]  [ + Vendre ] */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('dashboard')}
          className="inline-flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#14213D] dark:text-white hover:text-orange-600 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-[#64748B] group-hover:text-orange-600 transition-colors" />
          <span>Mes ventes</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowReturnSelector(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/80 font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 min-h-[42px] cursor-pointer"
            title="Enregistrer un retour d'articles, avoir client ou échange"
          >
            <RotateCcw className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Retour / Avoir</span>
            <span className="sm:hidden">Retour</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('manual_invoice')}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] text-[#14213D] dark:text-slate-200 hover:text-orange-600 font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 min-h-[42px] cursor-pointer"
          >
            <FileText className="w-4 h-4 text-orange-500" />
            <span className="hidden sm:inline">Facture manuelle</span>
            <span className="sm:hidden">Manuelle</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('sales')}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 min-h-[42px] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Vendre</span>
          </button>
        </div>
      </div>

      {/* Titre & Sous-titre */}
      <div className="space-y-0.5">
        <h2 className="text-xl sm:text-2xl font-black text-[#14213D] dark:text-white tracking-tight">
          Factures & Règlements
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400">
          {state.invoices.length} facture{state.invoices.length > 1 ? 's' : ''} émise{state.invoices.length > 1 ? 's' : ''} • Paiements partiels, soldes et reçus
        </p>
      </div>

      {/* 2. Statistiques en direct */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Ventes aujourd'hui"
          value={curr(todayRevenue)}
          subtitle={`${todayInvoices.length} commande(s)`}
          icon={TrendingUp}
          iconColor="orange"
        />

        <StatCard
          label="Encaissé aujourd'hui"
          value={curr(todayCollected)}
          subtitle="En caisse & banques"
          icon={Coins}
          iconColor="emerald"
        />

        <StatCard
          label="Reste à recouvrer"
          value={curr(totalReceivables)}
          subtitle="Créances clients"
          icon={BadgeAlert}
          iconColor="rose"
        />

        <StatCard
          label="Total factures"
          value={state.invoices.length}
          subtitle="Émises au total"
          icon={FileText}
          iconColor="blue"
        />
      </div>

      {/* 3. Recherche instantanée : n° de facture, nom du client ou téléphone */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par n° de facture, nom du client ou téléphone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-12 pl-12 pr-10 rounded-2xl border border-[#E8EDF2] dark:border-[#22304E] bg-white dark:bg-[#131B2E] text-xs sm:text-sm text-[#14213D] dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500 shadow-xs transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 4. Filtres : Toutes / Payées / Partielles / Impayées / Annulées */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { key: 'all', label: `Toutes (${filterCounts.all})` },
          { key: 'paid', label: `Payées (${filterCounts.paid})`, color: 'text-emerald-600' },
          { key: 'partial', label: `Partielles (${filterCounts.partial})`, color: 'text-amber-600' },
          { key: 'unpaid', label: `Impayées (${filterCounts.unpaid})`, color: 'text-rose-600' },
          { key: 'cancelled', label: `Annulées (${filterCounts.cancelled})`, color: 'text-slate-500' },
          { key: 'returns', label: `Retours & Avoirs (${filterCounts.returns})`, color: 'text-indigo-600' },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key as StatusFilterKey)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === f.key
                ? 'bg-[#14213D] text-white shadow-xs'
                : 'bg-white dark:bg-[#131B2E] text-[#64748B] dark:text-slate-400 border border-[#E8EDF2] dark:border-[#22304E] hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 5. Cartes des Factures ou Historique des Retours */}
      {statusFilter === 'returns' ? (
        filteredReturns.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-dashed border-[#E8EDF2] dark:border-[#22304E] space-y-3 bg-white dark:bg-[#131B2E]">
            <RotateCcw className="w-12 h-12 text-indigo-300 dark:text-indigo-600 mx-auto" />
            <h3 className="text-base font-bold text-[#14213D] dark:text-white">
              Aucun retour enregistré
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? `Aucun retour ne correspond à "${searchQuery}".`
                : 'Les retours de marchandises, avoirs clients et échanges validés s\'afficheront ici.'}
            </p>
            <button
              type="button"
              onClick={() => setShowReturnSelector(true)}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              + Enregistrer un retour
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReturns.map((ret) => (
              <div
                key={ret.id}
                className="p-4 sm:p-5 flex flex-col justify-between gap-3 bg-white dark:bg-[#131B2E] border border-indigo-100 dark:border-indigo-950/60 rounded-[24px] shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
              >
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-black text-indigo-600 dark:text-indigo-400">
                      #{ret.returnNumber}
                    </span>
                    <span className="text-xs text-[#64748B] dark:text-slate-400">
                      sur Facture <strong className="font-mono text-[#14213D] dark:text-slate-200">#{ret.invoiceNumber}</strong>
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      ret.actionType === 'refund'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                        : ret.actionType === 'credit_note'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {ret.actionType === 'refund'
                      ? 'Remboursement'
                      : ret.actionType === 'credit_note'
                      ? 'Avoir client'
                      : 'Échange'}
                  </span>
                </div>

                {/* Client & Date */}
                <div className="space-y-0.5">
                  <h4 className="text-sm sm:text-base font-extrabold text-[#14213D] dark:text-white truncate">
                    Client : {ret.clientName}
                  </h4>
                  <div className="text-xs text-[#64748B] dark:text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>Date : {formatDate(ret.date)}</span>
                    <span>•</span>
                    <span>Motif : <strong className="text-slate-700 dark:text-slate-300">{ret.reason}</strong></span>
                    {ret.userName && (
                      <>
                        <span>•</span>
                        <span>Opérateur : {ret.userName}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Returned Items */}
                <div className="p-3 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/50 border border-[#E8EDF2] dark:border-slate-700/60 space-y-1.5 text-xs">
                  <div className="font-bold text-[#64748B] dark:text-slate-400 text-[11px] uppercase tracking-wider">
                    Articles retournés ({ret.items.length})
                  </div>
                  {ret.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between flex-wrap gap-2 text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <ProductThumbnail
                          imageUrl={state.products.find((p) => p.id === it.productId)?.imageUrl}
                          name={it.designation}
                          size="xs"
                          roundedClassName="rounded-lg"
                        />
                        <span className="font-semibold">{it.quantity}x {it.designation}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            it.restock
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {it.restock ? '📦 Remis en stock' : '❌ Non remis'}
                        </span>
                      </div>
                      <span className="font-mono font-bold">{curr(it.total)}</span>
                    </div>
                  ))}

                  {ret.actionType === 'exchange' && ret.exchangeProduct && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300 font-semibold">
                      <div className="flex items-center gap-2">
                        <ProductThumbnail
                          imageUrl={state.products.find((p) => p.id === ret.exchangeProduct?.productId)?.imageUrl}
                          name={ret.exchangeProduct.designation}
                          size="xs"
                          roundedClassName="rounded-lg"
                        />
                        <span>Échangé contre : {ret.exchangeProduct.quantity}x {ret.exchangeProduct.designation}</span>
                      </div>
                      <span className="font-mono font-bold">{curr(ret.exchangeProduct.total)}</span>
                    </div>
                  )}
                </div>

                {/* Footer of Return card */}
                <div className="pt-2 border-t border-[#E8EDF2] dark:border-[#22304E] flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xs text-[#64748B] dark:text-slate-400 block font-semibold">Montant retourné</span>
                    <span className="text-base sm:text-lg font-black font-financial text-indigo-600 dark:text-indigo-400">
                      {curr(ret.totalReturnedAmount)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedItemId(ret.invoiceId)}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] text-[#14213D] dark:text-slate-200 hover:text-indigo-600 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Consulter la facture</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredInvoices.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-[#E8EDF2] dark:border-[#22304E] space-y-3 bg-white dark:bg-[#131B2E]">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-[#14213D] dark:text-white">
            Aucune facture trouvée
          </h3>
          <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `Aucune facture ne correspond à "${searchQuery}".`
              : 'Enregistrez votre première vente ou créez une facture manuelle.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('sales')}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            + Vendre
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((inv) => {
            const hasRemaining = inv.remainingAmount > 0 && inv.status !== 'cancelled';
            const invReturnsCount = (state.returns || []).filter((r) => r.invoiceId === inv.id).length;
            return (
              <div
                key={inv.id}
                onClick={() => setSelectedItemId(inv.id)}
                className="p-4 sm:p-5 flex flex-col justify-between gap-3 bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] rounded-[24px] shadow-sm hover:border-orange-300 dark:hover:border-orange-800 transition-all cursor-pointer group"
              >
                {/* Ligne 1 : Numéro & Statut (Payée / Partielle / Impayée / Annulée) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-black text-orange-600 dark:text-orange-400 group-hover:underline">
                      Facture #{inv.number}
                    </span>
                    {invReturnsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" />
                        <span>{invReturnsCount} retour{invReturnsCount > 1 ? 's' : ''}</span>
                      </span>
                    )}
                  </div>
                  <StatusBadge status={inv.status} />
                </div>

                {/* Ligne 2 : Client & Téléphone */}
                <div className="space-y-0.5">
                  <h4 className="text-sm sm:text-base font-extrabold text-[#14213D] dark:text-white truncate">
                    Client : {inv.clientName}
                  </h4>
                  <div className="text-xs text-[#64748B] dark:text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>{inv.items.length} article{inv.items.length > 1 ? 's' : ''}</span>
                    {inv.clientPhone && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-orange-500" />
                          <span>{inv.clientPhone}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Ligne 3 : Total, Montant payé, Reste à payer, Date & Raccourci Régler / PDF */}
                <div className="pt-2 border-t border-[#E8EDF2] dark:border-[#22304E] flex items-end justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-xs text-[#64748B] dark:text-slate-400 font-semibold">
                      Total facture
                    </div>
                    <div className="text-base sm:text-lg font-black font-financial text-[#14213D] dark:text-white">
                      {curr(inv.total)}
                    </div>

                    {inv.status === 'partial' || (inv.amountPaid > 0 && inv.remainingAmount > 0) ? (
                      <div className="text-xs space-y-0.5 mt-0.5">
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold block">
                          Payé : {curr(inv.amountPaid)}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 font-bold block">
                          Reste à payer : {curr(inv.remainingAmount)}
                        </span>
                      </div>
                    ) : inv.status === 'unpaid' ? (
                      <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                        Reste à payer : {curr(inv.remainingAmount || inv.total)}
                      </div>
                    ) : inv.status === 'paid' ? (
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Payée intégralement ({curr(inv.amountPaid)})
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-slate-400 mt-0.5 line-through">
                        Facture annulée
                      </div>
                    )}
                  </div>

                  <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[11px] text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{formatDate(inv.date)}</span>
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {inv.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => setReturnInvoice(inv)}
                          className="px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Enregistrer un retour, avoir client ou échange"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retour</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setThermalInvoice(inv)}
                        className="px-2.5 py-1.5 rounded-xl border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/40 hover:bg-orange-100 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        title="Ticket de caisse thermique (58/80 mm)"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Ticket</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => generateInvoicePdf(inv, state.settings, state.payments, 'download')}
                        className="px-2.5 py-1.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 text-[#14213D] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        title="Télécharger la facture PDF"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        <span className="hidden sm:inline">PDF</span>
                      </button>

                      {hasRemaining && (
                        <button
                          type="button"
                          onClick={() => setPaymentInvoice(inv)}
                          className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 text-xs font-extrabold border border-orange-200/80 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Régler</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Invoice Detail Drawer / Modal (OUVRIR, MODIFIER, HISTORIQUE DES PAIEMENTS, PDF) */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white dark:bg-[#131B2E] rounded-[28px] border border-[#E8EDF2] dark:border-[#22304E] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-[#E8EDF2] dark:border-[#22304E] flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 flex items-center justify-center border border-orange-200 dark:border-orange-900">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-[#14213D] dark:text-white font-mono">
                      #{selectedInvoice.number}
                    </h3>
                    <StatusBadge status={selectedInvoice.status} />
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Émise le {formatDate(selectedInvoice.date)} • Échéance : {formatDate(selectedInvoice.dueDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {selectedInvoice.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedInvoice)}
                    className="p-2 rounded-xl text-slate-400 hover:text-orange-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Modifier la facture"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedItemId(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Financial Highlight : Total, Payé, Reste */}
              <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60">
                <div>
                  <span className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider block">
                    Total Facture
                  </span>
                  <div className="text-xs sm:text-sm font-black font-financial text-[#14213D] dark:text-white truncate mt-0.5">
                    {curr(selectedInvoice.total)}
                  </div>
                </div>

                <div className="text-center">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    Montant Payé
                  </span>
                  <div className="text-xs sm:text-sm font-black font-financial text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                    {curr(selectedInvoice.amountPaid)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                    Reste à Payer
                  </span>
                  <div className="text-xs sm:text-sm font-black font-financial text-rose-600 dark:text-rose-400 truncate mt-0.5">
                    {curr(selectedInvoice.remainingAmount)}
                  </div>
                </div>
              </div>

              {/* Client Info */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1B263E] border border-[#E8EDF2] dark:border-[#22304E] space-y-1">
                <div className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                  Client facturé
                </div>
                <div className="font-extrabold text-sm text-[#14213D] dark:text-white">
                  {selectedInvoice.clientName}
                </div>
                {selectedInvoice.clientPhone && (
                  <div className="text-xs text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-orange-500" />
                    <span>Tél : {selectedInvoice.clientPhone}</span>
                  </div>
                )}
                {selectedInvoice.clientAddress && (
                  <div className="text-xs text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>Adresse : {selectedInvoice.clientAddress}</span>
                  </div>
                )}
                {selectedInvoice.notes && (
                  <div className="pt-1.5 mt-1.5 border-t border-[#E8EDF2] dark:border-slate-800 text-xs italic text-slate-500">
                    "{selectedInvoice.notes}"
                  </div>
                )}
              </div>

              {/* Articles Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                  Articles facturés ({selectedInvoice.items.length})
                </div>
                <div className="rounded-2xl border border-[#E8EDF2] dark:border-[#22304E] divide-y divide-[#E8EDF2] dark:divide-[#22304E] overflow-hidden">
                  {selectedInvoice.items.map((item, idx) => (
                    <div key={item.id || idx} className="p-3 bg-white dark:bg-[#131B2E] flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <ProductThumbnail
                          imageUrl={state.products.find((p) => p.id === item.productId)?.imageUrl}
                          name={item.designation}
                          size="sm"
                          roundedClassName="rounded-xl"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-[#14213D] dark:text-white truncate">{item.designation}</div>
                          <div className="text-[#64748B] dark:text-slate-400">
                            {item.quantity} {item.unit || ''} × {curr(item.unitPrice)}
                            {item.discountPercent ? ` (-${item.discountPercent}%)` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="font-black font-financial text-[#14213D] dark:text-white shrink-0">
                        {curr(item.total)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Multiple successive payments history */}
              <div className="space-y-2 pt-1 border-t border-[#E8EDF2] dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                    Règlements reçus ({invoicePayments.length})
                  </div>
                  {selectedInvoice.remainingAmount > 0 && selectedInvoice.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => setPaymentInvoice(selectedInvoice)}
                      className="text-xs font-bold text-orange-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter un règlement</span>
                    </button>
                  )}
                </div>

                {invoicePayments.length === 0 ? (
                  <div className="p-4 text-center rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/40 border border-[#E8EDF2] dark:border-slate-700/60 text-xs text-[#64748B]">
                    Aucun versement enregistré pour le moment.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#E8EDF2] dark:border-[#22304E] divide-y divide-[#E8EDF2] dark:divide-[#22304E] overflow-hidden text-xs">
                    {invoicePayments.map((p) => (
                      <div key={p.id} className="p-3 bg-white dark:bg-[#131B2E] flex justify-between items-center">
                        <div>
                          <div className="font-black font-mono font-financial text-emerald-600 dark:text-emerald-400">
                            +{curr(p.amount)}
                          </div>
                          <div className="text-[#64748B] dark:text-slate-400 mt-0.5">
                            {formatDate(p.date)} • Mode : <strong>{getPaymentMethodLabel(p.method)}</strong>
                            {p.note ? ` • "${p.note}"` : ''}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full shrink-0">
                          Encaissé
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historique des Retours & Avoirs sur cette vente */}
              {invoiceReturns.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-[#E8EDF2] dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retours & Avoirs associés ({invoiceReturns.length})</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/60 divide-y divide-indigo-50 dark:divide-indigo-900/40 overflow-hidden text-xs bg-indigo-50/20 dark:bg-indigo-950/20">
                    {invoiceReturns.map((ret) => (
                      <div key={ret.id} className="p-3 space-y-1.5 bg-white dark:bg-[#131B2E]">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-indigo-700 dark:text-indigo-300">
                            #{ret.returnNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                            {ret.actionType === 'refund' ? 'Remboursement' : ret.actionType === 'credit_note' ? 'Avoir client' : 'Échange'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatDate(ret.date)} • Motif : <strong>{ret.reason}</strong> {ret.userName ? `• Par ${ret.userName}` : ''}
                        </div>
                        <div className="space-y-1 pt-1">
                          {ret.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[11px] text-slate-600 dark:text-slate-300">
                              <span>
                                • {it.quantity}x {it.designation} {it.restock ? '(📦 remis en stock)' : '(❌ non remis)'}
                              </span>
                              <span className="font-mono font-bold">{curr(it.total)}</span>
                            </div>
                          ))}
                          {ret.actionType === 'exchange' && ret.exchangeProduct && (
                            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold pt-0.5">
                              Échangé contre : {ret.exchangeProduct.quantity}x {ret.exchangeProduct.designation} ({curr(ret.exchangeProduct.total)})
                              {ret.exchangePriceDifference !== undefined && ret.exchangePriceDifference !== 0 && (
                                <span> • Différence : {curr(ret.exchangePriceDifference)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions : PDF, Partager, Régler, Annuler */}
            <div className="p-4 border-t border-[#E8EDF2] dark:border-[#22304E] bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setThermalInvoice(selectedInvoice)}
                  className="px-3.5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-xs"
                  title="Imprimer le ticket de caisse thermique (58/80 mm)"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Ticket Caisse</span>
                </button>
                <button
                  type="button"
                  onClick={() => generateInvoicePdf(selectedInvoice, state.settings, invoicePayments, 'download')}
                  className="px-3.5 py-2.5 rounded-xl bg-[#14213D] text-white dark:bg-white dark:text-[#14213D] text-xs font-bold hover:opacity-90 flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Facture PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => generateInvoicePdf(selectedInvoice, state.settings, invoicePayments, 'share')}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Partager</span>
                </button>

                {selectedInvoice.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => setReturnInvoice(selectedInvoice)}
                    className="px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/40 text-xs font-bold flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-xs"
                    title="Enregistrer un retour, avoir ou échange"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retour / Avoir</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedInvoice.remainingAmount > 0 && selectedInvoice.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => setPaymentInvoice(selectedInvoice)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-transform active:scale-95 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Régler</span>
                  </button>
                )}

                {selectedInvoice.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => setInvoiceToCancel(selectedInvoice)}
                    className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal de modification de facture */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#131B2E] rounded-[28px] shadow-2xl border border-[#E8EDF2] dark:border-[#22304E] overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-[#E8EDF2] dark:border-[#22304E] flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-[#14213D] dark:text-white">
                  Modifier la facture #{editingInvoice.number}
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Client : {editingInvoice.clientName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoiceEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                  Date d'échéance
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                  Téléphone du client
                </label>
                <input
                  type="tel"
                  placeholder="Ex: +225 07 00 00 00 00"
                  value={editClientPhone}
                  onChange={(e) => setEditClientPhone(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                  Adresse du client
                </label>
                <input
                  type="text"
                  placeholder="Ex: Abidjan, Cocody..."
                  value={editClientAddress}
                  onChange={(e) => setEditClientAddress(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                  Notes / Mentions spécifiques
                </label>
                <textarea
                  rows={2}
                  placeholder="Garantie, conditions de livraison..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8EDF2] dark:border-[#22304E]">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="px-4 py-2.5 text-xs font-bold text-[#64748B] hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-orange-500 hover:bg-orange-600 rounded-xl shadow-md transition-transform active:scale-95"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Payment Modal for Total or Partial Payments */}
      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          isOpen={Boolean(paymentInvoice)}
          onClose={() => setPaymentInvoice(null)}
        />
      )}

      {/* 9. Confirm Cancel Invoice Dialog */}
      <ConfirmDialog
        isOpen={Boolean(invoiceToCancel)}
        title="Annuler cette facture ?"
        message={`Êtes-vous sûr de vouloir annuler la facture #${invoiceToCancel?.number} d'un montant de ${invoiceToCancel ? curr(invoiceToCancel.total) : ''} ? Les articles de stock du catalogue seront automatiquement réintégrés dans l'inventaire.`}
        confirmLabel="Annuler la facture"
        isDestructive
        onConfirm={handleCancelConfirm}
        onCancel={() => setInvoiceToCancel(null)}
      />

      {/* 10. Thermal POS Receipt Modal */}
      {thermalInvoice && (
        <ThermalReceiptModal
          isOpen={Boolean(thermalInvoice)}
          onClose={() => setThermalInvoice(null)}
          invoice={thermalInvoice}
        />
      )}

      {/* 11. Modal Gestion des Retours, Avoirs & Échanges */}
      {returnInvoice && (
        <SaleReturnModal
          isOpen={Boolean(returnInvoice)}
          onClose={() => setReturnInvoice(null)}
          invoice={returnInvoice}
        />
      )}

      {/* 12. Modal Sélection d'une facture pour initier un retour */}
      {showReturnSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#131B2E] rounded-3xl shadow-2xl border border-[#E8EDF2] dark:border-[#22304E] flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-[#E8EDF2] dark:border-[#22304E] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#14213D] dark:text-white">
                    Sélectionner la vente à retourner
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Choisissez la facture concernée par le retour d'article ou l'avoir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReturnSelector(false);
                  setSelectorSearchQuery('');
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-[#E8EDF2] dark:border-[#22304E]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par n° de facture, client, téléphone..."
                  value={selectorSearchQuery}
                  onChange={(e) => setSelectorSearchQuery(e.target.value)}
                  className="w-full h-10 pl-10 pr-8 rounded-xl border border-[#E8EDF2] dark:border-[#22304E] bg-white dark:bg-slate-900 text-xs text-[#14213D] dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
                {selectorSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSelectorSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {state.invoices
                .filter((inv) => {
                  if (inv.status === 'cancelled') return false;
                  const q = selectorSearchQuery.toLowerCase().trim();
                  if (!q) return true;
                  return (
                    inv.number.toLowerCase().includes(q) ||
                    inv.clientName.toLowerCase().includes(q) ||
                    (inv.clientPhone && inv.clientPhone.toLowerCase().includes(q))
                  );
                })
                .slice(0, 30)
                .map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      setReturnInvoice(inv);
                      setShowReturnSelector(false);
                      setSelectorSearchQuery('');
                    }}
                    className="p-3 rounded-2xl border border-[#E8EDF2] dark:border-[#22304E] hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-[#131B2E] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400 group-hover:underline">
                          #{inv.number}
                        </span>
                        <span className="text-xs font-bold text-[#14213D] dark:text-white">
                          {inv.clientName}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                        {formatDate(inv.date)} • {inv.items.length} article(s) • Total : <strong>{curr(inv.total)}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 group-hover:bg-orange-500 group-hover:text-white text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:group-hover:bg-orange-500 text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      Choisir
                    </button>
                  </div>
                ))}

              {state.invoices.filter((inv) => inv.status !== 'cancelled').length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  Aucune vente enregistrée pour le moment.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};