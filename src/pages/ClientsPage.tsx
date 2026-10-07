import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  FileText,
  ShoppingCart,
  Edit2,
  Trash2,
  X,
  CreditCard,
  Building,
  Calendar,
  AlertCircle,
  ArrowUpDown,
  ExternalLink,
  Receipt,
  UserCheck,
  CheckCircle2,
  Clock,
  Ban,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Client, Invoice } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { pickContactNative } from '../services/contactPicker';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { StatusBadge } from '../components/common/StatusBadge';

type SortKey = 'name_asc' | 'name_desc' | 'debt_desc' | 'debt_asc';
type DebtFilterKey = 'all' | 'with_debt' | 'no_debt';

export const ClientsPage: React.FC = () => {
  const {
    state,
    addClient,
    updateClient,
    deleteClient,
    navigate,
    selectedItemId,
    setSelectedItemId,
  } = useApp();
  const { currency, currencyPosition } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  // Search & Filter & Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [debtFilter, setDebtFilter] = useState<DebtFilterKey>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name_asc');

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formTaxId, setFormTaxId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Client stats mapping: totalPurchased, totalPaid, totalDebt, invoiceCount, lastDate
  const clientStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalPurchased: number;
        totalPaid: number;
        totalDebt: number;
        invoiceCount: number;
        lastDate?: string;
      }
    >();

    for (const c of state.clients) {
      map.set(c.id, {
        totalPurchased: 0,
        totalPaid: 0,
        totalDebt: 0,
        invoiceCount: 0,
      });
    }

    for (const inv of state.invoices) {
      if (inv.clientId && inv.status !== 'cancelled') {
        const current = map.get(inv.clientId) || {
          totalPurchased: 0,
          totalPaid: 0,
          totalDebt: 0,
          invoiceCount: 0,
        };
        current.totalPurchased += inv.total;
        current.totalPaid += inv.amountPaid;
        current.totalDebt += inv.remainingAmount;
        current.invoiceCount += 1;
        if (!current.lastDate || inv.date > current.lastDate) {
          current.lastDate = inv.date;
        }
        map.set(inv.clientId, current);
      }
    }
    return map;
  }, [state.clients, state.invoices]);

  // Filter & Sort clients
  const processedClients = useMemo(() => {
    // 1. Filter
    const filtered = state.clients.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.taxId && c.taxId.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q));

      const stats = clientStatsMap.get(c.id);
      const debt = stats?.totalDebt || 0;

      let matchesDebt = true;
      if (debtFilter === 'with_debt') matchesDebt = debt > 0;
      if (debtFilter === 'no_debt') matchesDebt = debt <= 0;

      return matchesSearch && matchesDebt;
    });

    // 2. Sort
    return filtered.sort((a, b) => {
      const statsA = clientStatsMap.get(a.id);
      const statsB = clientStatsMap.get(b.id);
      const debtA = statsA?.totalDebt || 0;
      const debtB = statsB?.totalDebt || 0;

      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
        case 'name_desc':
          return b.name.localeCompare(a.name, 'fr', { sensitivity: 'base' });
        case 'debt_desc':
          return debtB - debtA;
        case 'debt_asc':
          return debtA - debtB;
        default:
          return 0;
      }
    });
  }, [state.clients, searchQuery, debtFilter, sortBy, clientStatsMap]);

  // Total summary of all clients
  const summaryTotals = useMemo(() => {
    let totalAllDebt = 0;
    let clientsWithDebt = 0;
    for (const c of state.clients) {
      const debt = clientStatsMap.get(c.id)?.totalDebt || 0;
      if (debt > 0) {
        totalAllDebt += debt;
        clientsWithDebt += 1;
      }
    }
    return { totalAllDebt, clientsWithDebt };
  }, [state.clients, clientStatsMap]);

  // Active Fiche Client
  const detailClient = useMemo(() => {
    if (!selectedItemId) return null;
    return state.clients.find((c) => c.id === selectedItemId) || null;
  }, [selectedItemId, state.clients]);

  const detailStats = detailClient ? clientStatsMap.get(detailClient.id) : null;

  // Invoices for active client
  const clientInvoices = useMemo(() => {
    if (!detailClient) return [];
    return state.invoices
      .filter((i) => i.clientId === detailClient.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [detailClient, state.invoices]);

  // Modal open handlers
  const openAddModal = () => {
    setEditingClient(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormTaxId('');
    setFormNotes('');
    setFormError(null);
    setShowAddEditModal(true);
  };

  const openEditModal = (c: Client) => {
    setEditingClient(c);
    setFormName(c.name);
    setFormPhone(c.phone || '');
    setFormEmail(c.email || '');
    setFormAddress(c.address || '');
    setFormTaxId(c.taxId || '');
    setFormNotes(c.notes || '');
    setFormError(null);
    setShowAddEditModal(true);
  };

  // Import phone contact
  const handlePickNativeContact = async () => {
    const contact = await pickContactNative();
    if (contact) {
      setFormName(contact.name);
      if (contact.phone) setFormPhone(contact.phone);
      if (contact.email) setFormEmail(contact.email);
    } else {
      alert('Action annulée ou carnet d’adresses non supporté par ce navigateur.');
    }
  };

  // Save client
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Le nom du client est obligatoire.');
      return;
    }

    if (editingClient) {
      await updateClient(editingClient.id, {
        name: trimmedName,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        taxId: formTaxId.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    } else {
      await addClient({
        name: trimmedName,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        taxId: formTaxId.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    }
    setShowAddEditModal(false);
  };

  // Delete client
  const confirmDelete = async () => {
    if (clientToDelete) {
      await deleteClient(clientToDelete.id);
      if (selectedItemId === clientToDelete.id) {
        setSelectedItemId(null);
      }
      setClientToDelete(null);
    }
  };

  // Helper for invoice status badge
  const renderInvoiceStatus = (inv: Invoice) => {
    if (inv.status === 'paid' || inv.remainingAmount <= 0) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Payée
        </span>
      );
    }
    if (inv.status === 'partial' || (inv.amountPaid > 0 && inv.remainingAmount > 0)) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Partielle
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
        Impayée
      </span>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+36px)] md:pb-8">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#14213D] dark:text-white tracking-tight">
            Gestion des Clients
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400">
            {state.clients.length} client{state.clients.length > 1 ? 's' : ''} enregistrés • Fiches 360°, historique & créances
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 min-h-[44px] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Nouveau client</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 block mb-1">
            Total Clients
          </span>
          <div className="text-lg sm:text-xl font-black text-[#14213D] dark:text-white">
            {state.clients.length}
          </div>
          <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
            Contacts actifs
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 block mb-1">
            Clients Débiteurs
          </span>
          <div className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400">
            {summaryTotals.clientsWithDebt}
          </div>
          <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 block">
            Avec créances en cours
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3.5 sm:p-4 rounded-3xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/60 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 block mb-1">
            Montant restant dû global
          </span>
          <div className="text-lg sm:text-xl font-black font-financial text-rose-600 dark:text-rose-400">
            {curr(summaryTotals.totalAllDebt)}
          </div>
          <span className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-0.5 block">
            Total des créances clients
          </span>
        </div>
      </div>

      {/* 3. Search & Sort & Filters Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm space-y-3">
        {/* Search by name, phone or email */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, email, adresse ou NIF..."
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

        {/* Filter chips & Sort dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          {/* Debt Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setDebtFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                debtFilter === 'all'
                  ? 'bg-[#14213D] text-white shadow-xs'
                  : 'bg-[#FAFAF8] dark:bg-slate-800 text-[#64748B] dark:text-slate-400 border border-[#E8EDF2] dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              Tous ({state.clients.length})
            </button>
            <button
              type="button"
              onClick={() => setDebtFilter('with_debt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                debtFilter === 'with_debt'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-[#FAFAF8] dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50'
              }`}
            >
              Avec dette ({summaryTotals.clientsWithDebt})
            </button>
            <button
              type="button"
              onClick={() => setDebtFilter('no_debt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                debtFilter === 'no_debt'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-[#FAFAF8] dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50'
              }`}
            >
              À jour ({state.clients.length - summaryTotals.clientsWithDebt})
            </button>
          </div>

          {/* Sort By Dropdown (Nom A-Z, Nom Z-A, Dette décroissante, Dette croissante) */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="h-9 px-2.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
            >
              <option value="name_asc">Trier : Nom (A → Z)</option>
              <option value="name_desc">Trier : Nom (Z → A)</option>
              <option value="debt_desc">Trier : Dette (+ élevée)</option>
              <option value="debt_asc">Trier : Dette (- élevée)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Clients Cards List */}
      {processedClients.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#131B2E] border border-dashed border-[#E8EDF2] dark:border-[#22304E] space-y-3">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-black text-[#14213D] dark:text-white">
            Aucun client trouvé
          </h3>
          <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `Aucun résultat pour "${searchQuery}". Essayez un autre mot-clé.`
              : 'Ajoutez vos clients pour suivre leurs factures, règlements et créances.'}
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors shadow-xs"
          >
            + Créer un client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {processedClients.map((client) => {
            const stats = clientStatsMap.get(client.id);
            const totalDebt = stats?.totalDebt || 0;

            return (
              <div
                key={client.id}
                className="p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm hover:border-orange-300 dark:hover:border-orange-800 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div>
                  {/* Top: Avatar, Name & Debt Pill */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200/70 dark:border-orange-800/50 flex items-center justify-center font-black text-sm shrink-0">
                        {client.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4
                          onClick={() => setSelectedItemId(client.id)}
                          className="text-sm font-black text-[#14213D] dark:text-white truncate cursor-pointer hover:text-orange-600 transition-colors leading-tight"
                        >
                          {client.name}
                        </h4>

                        {/* Phone */}
                        {client.phone ? (
                          <a
                            href={`tel:${client.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-[#64748B] dark:text-slate-400 hover:text-orange-600 flex items-center gap-1 mt-0.5 truncate"
                          >
                            <Phone className="w-3 h-3 text-orange-500 shrink-0" />
                            <span className="truncate">{client.phone}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 block mt-0.5 italic">
                            Aucun numéro
                          </span>
                        )}

                        {/* Email */}
                        {client.email && (
                          <a
                            href={`mailto:${client.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-[#64748B] dark:text-slate-400 hover:text-orange-600 flex items-center gap-1 mt-0.5 truncate"
                          >
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{client.email}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Montant restant dû (dette) */}
                    {totalDebt > 0 ? (
                      <div className="text-right shrink-0">
                        <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                          Reste dû : {curr(totalDebt)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-right shrink-0">
                        <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                          À jour
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Summary row : Total facturé & Nb factures */}
                  <div className="mt-3 p-2.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-[#64748B] dark:text-slate-400 block font-bold uppercase tracking-wider">
                        Total facturé
                      </span>
                      <span className="font-black font-mono font-financial text-[#14213D] dark:text-white">
                        {curr(stats?.totalPurchased || 0)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#64748B] dark:text-slate-400 block font-bold uppercase tracking-wider">
                        Factures
                      </span>
                      <span className="font-black text-orange-600 dark:text-orange-400">
                        {stats?.invoiceCount || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions : Voir Fiche 360°, Modifier, Supprimer */}
                <div className="pt-2 border-t border-[#E8EDF2] dark:border-slate-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(client.id)}
                    className="text-xs font-black text-orange-600 dark:text-orange-400 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Fiche client</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(client)}
                      className="p-2 rounded-xl text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors"
                      title="Modifier les coordonnées"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientToDelete(client)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                      title="Supprimer ce client"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. FICHE CLIENT COMPLETE (DRAWER / MODAL) */}
      {detailClient && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-xl mx-auto bg-white dark:bg-[#131B2E] rounded-t-[32px] border-t border-[#E8EDF2] dark:border-[#22304E] p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
          >
            {/* Header Fiche Client */}
            <div className="flex items-start justify-between pb-3 border-b border-[#E8EDF2] dark:border-slate-800">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 text-[10px] font-black uppercase tracking-wider">
                    Fiche Client
                  </span>
                  {detailStats && detailStats.totalDebt > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-black">
                      Solde débiteur
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-black text-[#14213D] dark:text-white mt-1 leading-tight truncate">
                  {detailClient.name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] dark:text-slate-400 mt-1">
                  {detailClient.phone && (
                    <a
                      href={`tel:${detailClient.phone}`}
                      className="flex items-center gap-1 hover:text-orange-600"
                    >
                      <Phone className="w-3.5 h-3.5 text-orange-500" />
                      <span>{detailClient.phone}</span>
                    </a>
                  )}
                  {detailClient.email && (
                    <a
                      href={`mailto:${detailClient.email}`}
                      className="flex items-center gap-1 hover:text-orange-600"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{detailClient.email}</span>
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditModal(detailClient)}
                  className="p-2 rounded-xl text-slate-400 hover:text-orange-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Modifier"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemId(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Additional info tags (Adresse, NIF, Notes) */}
            {(detailClient.address || detailClient.taxId || detailClient.notes) && (
              <div className="p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 text-xs space-y-1.5">
                {detailClient.address && (
                  <div className="flex items-start gap-1.5 text-[#64748B] dark:text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <span>Adresse : <strong>{detailClient.address}</strong></span>
                  </div>
                )}
                {detailClient.taxId && (
                  <div className="flex items-start gap-1.5 text-[#64748B] dark:text-slate-300">
                    <Building className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <span>NIF / RCCM : <strong className="font-mono">{detailClient.taxId}</strong></span>
                  </div>
                )}
                {detailClient.notes && (
                  <div className="pt-1 border-t border-slate-200 dark:border-slate-700 text-[#64748B] dark:text-slate-400 italic">
                    "{detailClient.notes}"
                  </div>
                )}
              </div>
            )}

            {/* Financial Overview (Total achats, Total payé, Montant restant dû) */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60">
                <span className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider block">
                  Total achats
                </span>
                <span className="text-xs sm:text-sm font-black font-financial font-mono text-[#14213D] dark:text-white truncate block mt-0.5">
                  {curr(detailStats?.totalPurchased || 0)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/60">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  Total payé
                </span>
                <span className="text-xs sm:text-sm font-black font-financial font-mono text-emerald-700 dark:text-emerald-300 truncate block mt-0.5">
                  {curr(detailStats?.totalPaid || 0)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/60">
                <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider block">
                  Restant dû
                </span>
                <span className="text-xs sm:text-sm font-black font-financial font-mono text-rose-600 dark:text-rose-400 truncate block mt-0.5">
                  {curr(detailStats?.totalDebt || 0)}
                </span>
              </div>
            </div>

            {/* Permettre : [ Créer une nouvelle vente ] [ Créer une facture ] */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const targetId = detailClient.id;
                  setSelectedItemId(null);
                  navigate('sales', targetId);
                }}
                className="py-3 px-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 transition-transform active:scale-95 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
                <span>+ Nouvelle vente</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetId = detailClient.id;
                  setSelectedItemId(null);
                  navigate('manual_invoice', targetId);
                }}
                className="py-3 px-3 rounded-2xl bg-[#14213D] hover:bg-[#26354F] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>+ Créer facture</span>
              </button>
            </div>

            {/* Historique des Factures de ce Client */}
            <div className="space-y-2.5 pt-2 border-t border-[#E8EDF2] dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-orange-500" />
                  <span>Historique des factures ({clientInvoices.length})</span>
                </h4>
              </div>

              {clientInvoices.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/40 border border-[#E8EDF2] dark:border-slate-700/60 text-xs text-[#64748B]">
                  Aucune facture enregistrée pour ce client pour l'instant.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {clientInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => {
                        const targetInvId = inv.id;
                        setSelectedItemId(null);
                        navigate('invoices', targetInvId);
                      }}
                      className="p-3 sm:p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 hover:bg-orange-50/50 dark:hover:bg-slate-800 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-orange-600 dark:text-orange-400">
                            #{inv.number}
                          </span>
                          {renderInvoiceStatus(inv)}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1 flex items-center gap-2">
                          <span>{formatDate(inv.date)}</span>
                          <span>•</span>
                          <span>{inv.items.length} article{inv.items.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-black font-financial text-[#14213D] dark:text-white text-xs sm:text-sm">
                          {curr(inv.total)}
                        </div>
                        {inv.remainingAmount > 0 ? (
                          <span className="text-[10px] text-rose-600 font-bold block">
                            Reste : {curr(inv.remainingAmount)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-bold block">
                            Payée intégralement
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Add / Edit Client Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#131B2E] rounded-3xl shadow-2xl border border-[#E8EDF2] dark:border-[#22304E] overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E8EDF2] dark:border-[#22304E] flex items-center justify-between">
              <h3 className="text-base font-black text-[#14213D] dark:text-white">
                {editingClient ? 'Modifier le client' : 'Nouveau client'}
              </h3>
              <div className="flex items-center gap-2">
                {!editingClient && (
                  <button
                    type="button"
                    onClick={handlePickNativeContact}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Depuis répertoire</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveClient} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Nom * */}
              <div>
                <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                  Nom ou Raison Sociale *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Boutique Tech Plus, M. Diallo..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Téléphone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                    Numéro de téléphone
                  </label>
                  <input
                    type="tel"
                    placeholder="Ex: +225 05 12 34 56 78"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                    Adresse email
                  </label>
                  <input
                    type="email"
                    placeholder="Ex: contact@entreprise.ci"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Adresse & N° fiscal / ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                    Adresse physique / Ville
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Plateau, Av. Chardy, Abidjan"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                    N° fiscal / ID (NIF / RCCM)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: CI-ABJ-2026-B-991"
                    value={formTaxId}
                    onChange={(e) => setFormTaxId(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1">
                  Notes internes (optionnel)
                </label>
                <textarea
                  rows={2}
                  placeholder="Habitudes de règlement, réductions accordées, contacts secondaires..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8EDF2] dark:border-[#22304E]">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-[#64748B] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-orange-500 hover:bg-orange-600 rounded-xl shadow-md shadow-orange-500/20 transition-transform active:scale-95 cursor-pointer"
                >
                  {editingClient ? 'Enregistrer les modifications' : 'Créer le client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(clientToDelete)}
        title="Supprimer ce client ?"
        message={`Êtes-vous sûr de vouloir supprimer la fiche de "${clientToDelete?.name}" ? Ses factures et règlements passés resteront conservés dans vos ventes.`}
        confirmLabel="Supprimer"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setClientToDelete(null)}
      />
    </div>
  );
};
