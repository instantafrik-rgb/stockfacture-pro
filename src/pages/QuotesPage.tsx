import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  Plus,
  ArrowRight,
  Download,
  Share2,
  Printer,
  CheckCircle2,
  Trash2,
  X,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Quote, QuoteStatus, CartItem } from '../types';
import { formatCurrency, formatDate, getTodayDateString } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { generateQuotePdf } from '../pdf/documentPdf';
import { FreeLineModal } from '../components/modals/FreeLineModal';

export const QuotesPage: React.FC = () => {
  const {
    state,
    createQuote,
    updateQuote,
    deleteQuote,
    convertQuoteToInvoice,
    navigate,
    selectedItemId,
    setSelectedItemId,
  } = useApp();
  const { currency, currencyPosition } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');

  // New Quote Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFreeLineModal, setShowFreeLineModal] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);

  // Quote Create form
  const [clientType, setClientType] = useState<'existing' | 'manual'>('manual');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [quoteItems, setQuoteItems] = useState<CartItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Filtered quotes
  const filteredQuotes = useMemo(() => {
    return state.quotes.filter((q) => {
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
      const term = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !term ||
        q.number.toLowerCase().includes(term) ||
        q.clientName.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [state.quotes, statusFilter, searchQuery]);

  // Selected Detail Quote
  const detailQuote = useMemo(() => {
    if (!selectedItemId) return null;
    return state.quotes.find((q) => q.id === selectedItemId) || null;
  }, [selectedItemId, state.quotes]);

  // Handle Add Item to quote
  const addCatalogProductToQuote = (productId: string) => {
    const p = state.products.find((prod) => prod.id === productId);
    if (!p) return;

    setQuoteItems((prev) => {
      const existing = prev.find((it) => it.productId === p.id);
      if (existing) {
        return prev.map((it) => (it.productId === p.id ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [
        ...prev,
        {
          id: `qi-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          productId: p.id,
          isFreeLine: false,
          designation: p.name,
          reference: p.sku,
          description: p.description,
          quantity: 1,
          unit: p.unit || 'pièce',
          unitPrice: p.sellingPrice,
          purchasePrice: p.purchasePrice,
          discountPercent: 0,
        },
      ];
    });
  };

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (quoteItems.length === 0) {
      setFormError('Ajoutez au moins un article au devis.');
      return;
    }

    let finalName = clientName.trim() || 'Client de passage';
    let finalPhone = clientPhone.trim() || undefined;
    let finalAddress = clientAddress.trim() || undefined;
    let finalClientId = undefined;

    if (clientType === 'existing') {
      const cl = state.clients.find((c) => c.id === selectedClientId);
      if (cl) {
        finalClientId = cl.id;
        finalName = cl.name;
        finalPhone = cl.phone;
        finalAddress = cl.address;
      }
    }

    const res = await createQuote({
      client: {
        id: finalClientId,
        name: finalName,
        phone: finalPhone,
        address: finalAddress,
      },
      items: quoteItems,
      expiryDate,
      notes: notes.trim() || undefined,
    });

    if (res.success && res.quote) {
      setShowCreateModal(false);
      setQuoteItems([]);
      setClientName('');
      setClientPhone('');
      setSelectedItemId(res.quote.id);
    } else {
      setFormError(res.error || 'Erreur lors de la création du devis.');
    }
  };

  const handleConvert = async (quoteId: string) => {
    const res = await convertQuoteToInvoice(quoteId);
    if (res.success && res.invoice) {
      setSelectedItemId(res.invoice.id);
      navigate('invoices', res.invoice.id);
    } else {
      alert(res.error || 'Erreur lors de la conversion en facture.');
    }
  };

  const confirmDelete = async () => {
    if (quoteToDelete) {
      await deleteQuote(quoteToDelete.id);
      if (selectedItemId === quoteToDelete.id) {
        setSelectedItemId(null);
      }
      setQuoteToDelete(null);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Devis & Estimations
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {state.quotes.length} devis émis • Conversion directe en facture
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => {
              setQuoteItems([]);
              setShowCreateModal(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Créer un devis</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par n° de devis ou client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Tous ({state.quotes.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('sent')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'sent'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 text-blue-600 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Envoyés
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('accepted')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'accepted'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-slate-900 text-emerald-600 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Acceptés
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('converted')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'converted'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-900 text-indigo-600 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Convertis
          </button>
        </div>
      </div>

      {/* 3. Quotes List */}
      {filteredQuotes.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Aucun devis trouvé
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Créez une proposition commerciale chiffrée pour vos prospects.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs"
          >
            + Nouveau devis
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredQuotes.map((q) => (
            <div
              key={q.id}
              className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs hover:border-purple-300 dark:hover:border-purple-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
              onClick={() => setSelectedItemId(q.id)}
            >
              <div className="flex items-center gap-3 truncate">
                <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                      {q.number}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      • {formatDate(q.date)}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {q.clientName}
                  </h4>
                  <div className="text-[11px] text-slate-400">
                    Valable jusqu'au {formatDate(q.expiryDate)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                <div className="sm:text-right">
                  <div className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
                    {curr(q.total)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={q.status} />

                  {q.status !== 'converted' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConvert(q.id);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 flex items-center gap-1 shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Facturer</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Quote Detail Drawer */}
      {detailQuote && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-mono font-extrabold text-purple-600 dark:text-purple-400">
                    {detailQuote.number}
                  </span>
                  <StatusBadge status={detailQuote.status} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Émis le {formatDate(detailQuote.date)} • Valable jusqu'au : {formatDate(detailQuote.expiryDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemId(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions (PDF, Share, Convert) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => generateQuotePdf(detailQuote, state.settings, 'download')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-700 text-white text-xs font-bold hover:bg-purple-800 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF Devis</span>
              </button>

              <button
                type="button"
                onClick={() => generateQuotePdf(detailQuote, state.settings, 'share')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Partager</span>
              </button>

              {detailQuote.status !== 'converted' ? (
                <button
                  type="button"
                  onClick={() => handleConvert(detailQuote.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold ml-auto shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Convertir en Facture</span>
                </button>
              ) : (
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 ml-auto flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Déjà converti en facture
                </span>
              )}
            </div>

            {/* Client info */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Destinataire
              </span>
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {detailQuote.clientName}
              </div>
              {detailQuote.clientPhone && <div>Tél : {detailQuote.clientPhone}</div>}
              {detailQuote.clientAddress && <div>Adresse : {detailQuote.clientAddress}</div>}
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Articles chiffrés ({detailQuote.items.length})
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {detailQuote.items.map((it) => (
                  <div key={it.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {it.designation}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {it.quantity} {it.unit} x {curr(it.unitPrice)}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {curr(it.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Sous-total :</span>
                <span className="font-mono font-semibold">{curr(detailQuote.subtotal)}</span>
              </div>
              {detailQuote.vatAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">TVA ({detailQuote.vatRate}%) :</span>
                  <span className="font-mono font-semibold">{curr(detailQuote.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white">
                <span>TOTAL DEVIS :</span>
                <span className="font-mono text-base font-extrabold text-purple-600 dark:text-purple-400">
                  {curr(detailQuote.total)}
                </span>
              </div>
            </div>

            {/* Delete Quote */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setQuoteToDelete(detailQuote)}
                className="px-3.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Supprimer ce devis</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Create Quote Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Créer un nouveau devis
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="p-5 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
                  {formError}
                </div>
              )}

              {/* Client Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Client destinataire
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setClientType('manual')}
                    className={`py-1.5 text-xs font-bold rounded-xl border ${
                      clientType === 'manual'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Saisie directe
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientType('existing')}
                    className={`py-1.5 text-xs font-bold rounded-xl border ${
                      clientType === 'existing'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Client existant
                  </button>
                </div>

                {clientType === 'existing' ? (
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="">Sélectionner un client...</option>
                    {state.clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nom du client / Entreprise *"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    />
                    <input
                      type="tel"
                      placeholder="Téléphone"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date de validité du devis
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Articles du devis ({quoteItems.length})
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFreeLineModal(true)}
                      className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>+ Ligne libre</span>
                    </button>
                  </div>
                </div>

                {/* Quick Add from Catalogue */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addCatalogProductToQuote(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">+ Ajouter un produit du catalogue...</option>
                  {state.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({curr(p.sellingPrice)})
                    </option>
                  ))}
                </select>

                {/* Items preview */}
                {quoteItems.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-2 space-y-2 max-h-40 overflow-y-auto">
                    {quoteItems.map((it, idx) => (
                      <div
                        key={it.id}
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs"
                      >
                        <div className="truncate mr-2">
                          <span className="font-bold text-slate-900 dark:text-white block truncate">
                            {it.designation}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {it.quantity} {it.unit} x {curr(it.unitPrice)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">
                            {curr(it.quantity * it.unitPrice)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setQuoteItems((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Conditions particulières / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Délai de livraison sous 48h, acompte de 30% requis..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  Enregistrer le devis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Free Line Modal */}
      <FreeLineModal
        isOpen={showFreeLineModal}
        onClose={() => setShowFreeLineModal(false)}
        onAddLine={(item) => setQuoteItems((prev) => [...prev, item])}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={Boolean(quoteToDelete)}
        title="Supprimer ce devis ?"
        message={`Voulez-vous supprimer définitivement le devis ${quoteToDelete?.number} ?`}
        confirmLabel="Supprimer"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setQuoteToDelete(null)}
      />
    </div>
  );
};
