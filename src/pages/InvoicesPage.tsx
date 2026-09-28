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
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Invoice, InvoiceStatus, PaymentMethod } from '../types';
import { formatCurrency, formatDate, getPaymentMethodLabel } from '../utils/formatters';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { PaymentModal } from '../components/modals/PaymentModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { generateInvoicePdf } from '../pdf/documentPdf';

type StatusFilterKey = 'all' | 'paid' | 'partial' | 'unpaid' | 'cancelled';

export const InvoicesPage: React.FC = () => {
  const { state, navigate, selectedItemId, setSelectedItemId, cancelInvoice, updateInvoice } = useApp();
  const { currency, currencyPosition } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);

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

  // Counts for status filters
  const filterCounts = useMemo(() => {
    return {
      all: state.invoices.length,
      paid: state.invoices.filter((i) => i.status === 'paid' || i.remainingAmount <= 0).length,
      partial: state.invoices.filter((i) => i.status === 'partial' && i.remainingAmount > 0).length,
      unpaid: state.invoices.filter((i) => i.status === 'unpaid').length,
      cancelled: state.invoices.filter((i) => i.status === 'cancelled').length,
    };
  }, [state.invoices]);

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
      await cancelInvoice(invoiceToCancel.id);
      setInvoiceToCancel(null);
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
    await updateInvoice(editingInvoice.id, {
      dueDate: editDueDate || editingInvoice.date,
      clientPhone: editClientPhone.trim() || undefined,
      clientAddress: editClientAddress.trim() || undefined,
      notes: editNotes.trim() || undefined,
    });
    setEditingInvoice(null);
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

      {/* 5. Cartes des Factures */}
      {filteredInvoices.length === 0 ? (
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
            return (
              <div
                key={inv.id}
                onClick={() => setSelectedItemId(inv.id)}
                className="p-4 sm:p-5 flex flex-col justify-between gap-3 bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] rounded-[24px] shadow-sm hover:border-orange-300 dark:hover:border-orange-800 transition-all cursor-pointer group"
              >
                {/* Ligne 1 : Numéro & Statut (Payée / Partielle / Impayée / Annulée) */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono font-black text-orange-600 dark:text-orange-400 group-hover:underline">
                    Facture #{inv.number}
                  </span>
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
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-[#14213D] dark:text-white truncate">{item.designation}</div>
                        <div className="text-[#64748B] dark:text-slate-400">
                          {item.quantity} {item.unit || ''} × {curr(item.unitPrice)}
                          {item.discountPercent ? ` (-${item.discountPercent}%)` : ''}
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
            </div>

            {/* Footer Actions : PDF, Partager, Régler, Annuler */}
            <div className="p-4 border-t border-[#E8EDF2] dark:border-[#22304E] bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
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
    </div>
  );
};
