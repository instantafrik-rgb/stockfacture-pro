import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Plus,
  Minus,
  Trash2,
  Users,
  CheckCircle,
  Share2,
  ArrowRight,
  ArrowLeft,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  AlertCircle,
  Package,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { CartItem, PaymentMethod } from '../types';
import { formatCurrency, getTodayDateString, generateDocumentNumber } from '../utils/formatters';
import {
  calculateLineTotal,
  calculateSubtotal,
  calculateDiscountTotal,
  calculateTax,
  calculateInvoiceTotal,
} from '../utils/calculations';
import { generateInvoicePdf } from '../pdf/documentPdf';

interface ManualLineItem {
  id: string;
  productId?: string;
  designation: string;
  reference?: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
}

export const ManualInvoicePage: React.FC = () => {
  const { state, createSale, navigate, selectedItemId } = useApp();
  const currency = state.settings.currency;
  const curr = (amt: number) => formatCurrency(amt, currency, state.settings.currencyPosition);

  // Invoice Meta
  const defaultInvoiceNumber = useMemo(
    () => generateDocumentNumber(state.settings.invoicePrefix, state.settings.nextInvoiceNumber),
    [state.settings.invoicePrefix, state.settings.nextInvoiceNumber]
  );
  const [invoiceNumber, setInvoiceNumber] = useState(defaultInvoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(getTodayDateString());
  const [dueDate, setDueDate] = useState(getTodayDateString());
  const [notes, setNotes] = useState('');

  // Client Selection
  const [clientMode, setClientMode] = useState<'manual' | 'existing' | 'walk_in'>('manual');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientTaxId, setClientTaxId] = useState('');
  const [saveToDirectory, setSaveToDirectory] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');

  // Pre-select client if navigated from client fiche
  useEffect(() => {
    if (selectedItemId) {
      const found = state.clients.find((c) => c.id === selectedItemId);
      if (found) {
        setClientMode('existing');
        setSelectedClientId(found.id);
      }
    } else if (clientMode === 'existing' && !selectedClientId && state.clients.length > 0) {
      setSelectedClientId(state.clients[0].id);
    }
  }, [selectedItemId, clientMode, selectedClientId, state.clients]);

  // Line items
  const [lines, setLines] = useState<ManualLineItem[]>([
    {
      id: `line-${Date.now()}-1`,
      designation: '',
      reference: '',
      quantity: 1,
      unit: 'pièce',
      unitPrice: 0,
      discountPercent: 0,
    },
  ]);

  // Payment
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'unpaid'>('paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);

  // Catalog picker modal
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);

  // Financial Calculations
  const cartItems: CartItem[] = useMemo(() => {
    return lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      isFreeLine: !l.productId,
      designation: l.designation || 'Article libre',
      reference: l.reference,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent,
    }));
  }, [lines]);

  const subtotal = useMemo(() => calculateSubtotal(cartItems), [cartItems]);
  const discountTotal = useMemo(() => calculateDiscountTotal(cartItems), [cartItems]);
  const vatAmount = useMemo(
    () => calculateTax(subtotal - discountTotal, state.settings.vatRate, state.settings.vatEnabled),
    [subtotal, discountTotal, state.settings.vatRate, state.settings.vatEnabled]
  );
  const total = useMemo(
    () => calculateInvoiceTotal(subtotal, discountTotal, vatAmount),
    [subtotal, discountTotal, vatAmount]
  );

  // Synchronize amountPaid when total changes or status changes
  const handlePaymentStatusChange = (status: 'paid' | 'partial' | 'unpaid') => {
    setPaymentStatus(status);
    if (status === 'paid') {
      setAmountPaid(total);
    } else if (status === 'unpaid') {
      setAmountPaid(0);
    } else {
      setAmountPaid(Math.round(total / 2));
    }
  };

  // Add line item
  const addManualLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        designation: '',
        reference: '',
        quantity: 1,
        unit: 'pièce',
        unitPrice: 0,
        discountPercent: 0,
      },
    ]);
  };

  // Add catalog item
  const addCatalogProduct = (product: any) => {
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: product.id,
        designation: product.name,
        reference: product.sku || product.barcode || '',
        quantity: 1,
        unit: product.unit || 'pièce',
        unitPrice: product.sellingPrice,
        discountPercent: 0,
      },
    ]);
    setShowCatalogPicker(false);
  };

  // Update line item
  const updateLine = (id: string, updates: Partial<ManualLineItem>) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  // Remove line item
  const removeLine = (id: string) => {
    if (lines.length <= 1) {
      setLines([
        {
          id: `line-${Date.now()}`,
          designation: '',
          reference: '',
          quantity: 1,
          unit: 'pièce',
          unitPrice: 0,
          discountPercent: 0,
        },
      ]);
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  // Submit manual invoice
  const handleCreateInvoice = async () => {
    setErrorMessage(null);

    // Validation
    const validLines = lines.filter((l) => l.designation.trim().length > 0 && l.unitPrice >= 0);
    if (validLines.length === 0) {
      setErrorMessage('Veuillez renseigner au moins une ligne d’article avec une désignation valide.');
      return;
    }

    let resolvedClient: any = { name: 'Client comptant' };
    if (clientMode === 'existing') {
      const found = state.clients.find((c) => c.id === selectedClientId);
      if (!found) {
        setErrorMessage('Veuillez sélectionner un client dans la liste.');
        return;
      }
      resolvedClient = {
        id: found.id,
        name: found.name,
        phone: found.phone,
        address: found.address,
        taxId: found.taxId,
      };
    } else if (clientMode === 'manual') {
      if (!clientName.trim()) {
        setErrorMessage('Veuillez indiquer le nom du client.');
        return;
      }
      resolvedClient = {
        name: clientName.trim(),
        phone: clientPhone.trim() || undefined,
        address: clientAddress.trim() || undefined,
        taxId: clientTaxId.trim() || undefined,
        saveToDb: saveToDirectory,
      };
    }

    setIsSubmitting(true);

    try {
      const itemsToCreate: CartItem[] = validLines.map((l) => ({
        id: l.id,
        productId: l.productId,
        isFreeLine: !l.productId,
        designation: l.designation.trim(),
        reference: l.reference?.trim() || undefined,
        quantity: Math.max(1, l.quantity),
        unit: l.unit || 'pièce',
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent || 0,
      }));

      const finalAmountPaid =
        paymentStatus === 'paid'
          ? total
          : paymentStatus === 'unpaid'
          ? 0
          : Math.min(total, Math.max(0, amountPaid));

      const res = await createSale({
        items: itemsToCreate,
        client: resolvedClient,
        paymentMethod,
        amountPaid: finalAmountPaid,
        notes: notes.trim() || undefined,
        dueDate,
        customInvoiceNumber: invoiceNumber.trim() || undefined,
        date: invoiceDate,
      });

      if (res.success && res.invoice) {
        setCreatedInvoice(res.invoice);
      } else {
        setErrorMessage(res.error || 'Erreur lors de la création de la facture.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur inattendue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setCreatedInvoice(null);
    setInvoiceNumber(
      generateDocumentNumber(state.settings.invoicePrefix, state.settings.nextInvoiceNumber)
    );
    setInvoiceDate(getTodayDateString());
    setDueDate(getTodayDateString());
    setNotes('');
    setClientMode('manual');
    setClientName('');
    setClientPhone('');
    setClientAddress('');
    setClientTaxId('');
    setSaveToDirectory(false);
    setLines([
      {
        id: `line-${Date.now()}`,
        designation: '',
        reference: '',
        quantity: 1,
        unit: 'pièce',
        unitPrice: 0,
        discountPercent: 0,
      },
    ]);
    setPaymentStatus('paid');
    setAmountPaid(0);
  };

  // SUCCESS SCREEN
  if (createdInvoice) {
    return (
      <div className="max-w-md mx-auto space-y-4 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+36px)] md:pb-8 animate-in zoom-in-95 duration-200">
        <div className="p-6 sm:p-8 bg-white dark:bg-[#131B2E] rounded-[28px] shadow-2xl border border-[#E8EDF2] dark:border-[#22304E] text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-[#E7F8F1] dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border-2 border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="w-9 h-9" />
          </div>

          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold mb-2">
              ✓ Facture manuelle créée avec succès
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#14213D] dark:text-white">
              Facture <span className="text-orange-600 dark:text-orange-400 font-mono">#{createdInvoice.number}</span>
            </h2>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
              Client : <strong className="text-[#14213D] dark:text-white">{createdInvoice.clientName}</strong>
            </p>
          </div>

          {/* 3 Tiles : Total, Payé, Reste */}
          <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60">
            <div className="text-left">
              <div className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">Total</div>
              <div className="text-xs sm:text-sm font-black font-financial text-[#14213D] dark:text-white truncate">
                {curr(createdInvoice.total)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Payé</div>
              <div className="text-xs sm:text-sm font-black font-financial text-emerald-600 dark:text-emerald-400 truncate">
                {curr(createdInvoice.amountPaid)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Reste</div>
              <div className="text-xs sm:text-sm font-black font-financial text-rose-600 dark:text-rose-400 truncate">
                {curr(createdInvoice.remainingAmount)}
              </div>
            </div>
          </div>

          {/* Actions : Nouvelle facture, Voir PDF, Retour aux ventes */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-orange-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>Créer une autre facture</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => generateInvoicePdf(createdInvoice, state.settings, state.payments, 'download')}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-[#14213D] hover:bg-[#26354F] text-white text-xs font-bold transition-all active:scale-95 shadow-xs"
              >
                <FileText className="w-4 h-4" />
                <span>Voir la facture</span>
              </button>

              <button
                type="button"
                onClick={() => generateInvoicePdf(createdInvoice, state.settings, state.payments, 'share')}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border border-[#E8EDF2] dark:border-slate-700 text-[#14213D] dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>Partager</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate('invoices', createdInvoice.id)}
              className="w-full py-2.5 rounded-xl text-[#64748B] hover:text-[#14213D] dark:text-slate-400 dark:hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Consulter dans "Mes ventes"</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+120px)] md:pb-8">
      {/* 0. Header : ← Facture manuelle */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('invoices')}
          className="inline-flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#14213D] dark:text-white hover:text-orange-600 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 text-[#64748B] group-hover:text-orange-600 transition-colors" />
          <span>Facture manuelle</span>
        </button>

        <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-3 py-1.5 rounded-xl border border-orange-200/60 dark:border-orange-900/40">
          #{invoiceNumber}
        </span>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. SECTION FACTURE & DATES */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-500" />
          <span>Informations Facture</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#14213D] dark:text-slate-300 mb-1">
              Numéro de facture
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-[#FAFAF8] dark:bg-slate-800 text-sm font-mono font-bold text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#14213D] dark:text-slate-300 mb-1">
              Date d'émission
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#14213D] dark:text-slate-300 mb-1">
              Date d'échéance
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>

      {/* 2. SECTION CLIENT */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm space-y-3.5">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400 flex items-center gap-2">
          <Users className="w-4 h-4 text-orange-500" />
          <span>Client & Coordonnées</span>
        </h3>

        {/* Client Mode selector */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setClientMode('manual')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
              clientMode === 'manual'
                ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shadow-xs ring-1 ring-orange-500'
                : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
            }`}
          >
            Saisie manuelle
          </button>
          <button
            type="button"
            onClick={() => setClientMode('existing')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
              clientMode === 'existing'
                ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shadow-xs ring-1 ring-orange-500'
                : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
            }`}
          >
            Client existant
          </button>
          <button
            type="button"
            onClick={() => {
              setClientMode('walk_in');
              setClientName('Client comptant');
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
              clientMode === 'walk_in'
                ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shadow-xs ring-1 ring-orange-500'
                : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
            }`}
          >
            Client comptant
          </button>
        </div>

        {clientMode === 'existing' && (
          <div className="pt-1">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Sélectionner un client...</option>
              {state.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {clientMode === 'manual' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#14213D] dark:text-slate-300 mb-1">
                  Nom ou Raison Sociale *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Boutique Tech Plus, M. Diallo..."
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#14213D] dark:text-slate-300 mb-1">
                  Numéro de téléphone
                </label>
                <input
                  type="tel"
                  placeholder="Ex: +225 07 00 00 00 00"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#14213D] dark:text-slate-300 mb-1">
                  Adresse (ville, quartier)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Cocody Angré 8ème Tranche"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#14213D] dark:text-slate-300 mb-1">
                  NIF / RCCM / Réf fiscale
                </label>
                <input
                  type="text"
                  placeholder="Ex: CI-ABJ-2026-X-99"
                  value={clientTaxId}
                  onChange={(e) => setClientTaxId(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={saveToDirectory}
                onChange={(e) => setSaveToDirectory(e.target.checked)}
                className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 border-slate-300"
              />
              <span className="text-xs text-[#14213D] dark:text-slate-300 font-medium">
                Enregistrer également ce client dans mon carnet d'adresses
              </span>
            </label>
          </div>
        )}
      </div>

      {/* 3. SECTION LIGNES D'ARTICLES SAISIES À LA MAIN */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400 flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-500" />
            <span>Articles & Lignes de Facture ({lines.length})</span>
          </h3>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCatalogPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAFAF8] dark:bg-slate-800 border border-[#E8EDF2] dark:border-slate-700 text-xs font-bold text-[#14213D] dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              <Package className="w-3.5 h-3.5 text-blue-500" />
              <span>Depuis catalogue</span>
            </button>
            <button
              type="button"
              onClick={addManualLine}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Ligne libre</span>
            </button>
          </div>
        </div>

        {/* Lines table / cards */}
        <div className="space-y-3">
          {lines.map((line, idx) => {
            const lineTotal = calculateLineTotal(line.quantity, line.unitPrice, line.discountPercent);
            return (
              <div
                key={line.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      placeholder="Désignation de l'article ou prestation *"
                      value={line.designation}
                      onChange={(e) => updateLine(line.id, { designation: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                    title="Supprimer la ligne"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Sub-inputs : Réf, Quantité, Unité, Prix, Remise, Total */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                      Réf / SKU
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: ACC-01"
                      value={line.reference || ''}
                      onChange={(e) => updateLine(line.id, { reference: e.target.value })}
                      className="w-full h-9 px-2.5 rounded-lg border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-[#14213D] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                      Quantité
                    </label>
                    <div className="flex items-center border border-[#E8EDF2] dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 overflow-hidden h-9">
                      <button
                        type="button"
                        onClick={() => updateLine(line.id, { quantity: Math.max(1, line.quantity - 1) })}
                        className="px-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 h-full flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                        }
                        className="w-full text-center font-bold text-xs bg-transparent border-0 text-[#14213D] dark:text-white focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => updateLine(line.id, { quantity: line.quantity + 1 })}
                        className="px-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 h-full flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                      Prix unitaire ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={line.unitPrice || ''}
                      placeholder="0"
                      onChange={(e) =>
                        updateLine(line.id, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })
                      }
                      className="w-full h-9 px-2.5 rounded-lg border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs text-[#14213D] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                      Remise (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={line.discountPercent || ''}
                      placeholder="0"
                      onChange={(e) =>
                        updateLine(line.id, {
                          discountPercent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                        })
                      }
                      className="w-full h-9 px-2.5 rounded-lg border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs text-[#14213D] dark:text-white"
                    />
                  </div>

                  <div className="text-right">
                    <label className="block text-[10px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                      Total Ligne
                    </label>
                    <div className="h-9 px-2.5 rounded-lg bg-orange-50/70 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-end font-mono font-black text-xs sm:text-sm text-orange-600 dark:text-orange-400">
                      {curr(lineTotal)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bouton rapide d'ajout de ligne */}
        <button
          type="button"
          onClick={addManualLine}
          className="w-full py-2.5 rounded-xl border border-dashed border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400 text-xs font-bold hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter une autre ligne d'article</span>
        </button>
      </div>

      {/* 4. SECTION RÈGLEMENT & PAIEMENT */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-orange-500" />
          <span>Statut & Mode de Règlement</span>
        </h3>

        {/* Payment Status selector */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handlePaymentStatusChange('paid')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
              paymentStatus === 'paid'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500'
                : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
            }`}
          >
            Payée intégralement
          </button>
          <button
            type="button"
            onClick={() => handlePaymentStatusChange('partial')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
              paymentStatus === 'partial'
                ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 shadow-xs ring-1 ring-amber-500'
                : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
            }`}
          >
            Acompte partiel
          </button>
          <button
            type="button"
            onClick={() => handlePaymentStatusChange('unpaid')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
              paymentStatus === 'unpaid'
                ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 shadow-xs ring-1 ring-rose-500'
                : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
            }`}
          >
            Non payée (créance)
          </button>
        </div>

        {paymentStatus !== 'unpaid' && (
          <div className="space-y-3 pt-1">
            {/* Amount Paid input if partial */}
            {paymentStatus === 'partial' && (
              <div>
                <label className="block text-[11px] font-bold text-[#14213D] dark:text-slate-300 mb-1">
                  Montant de l'acompte versé ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  max={total}
                  value={amountPaid || ''}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  className="w-full h-11 px-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/30 text-base font-mono font-black text-amber-700 dark:text-amber-300 focus:ring-2 focus:ring-orange-500"
                />
                <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1">
                  Reliquat restant dû : <strong>{curr(Math.max(0, total - (amountPaid || 0)))}</strong>
                </div>
              </div>
            )}

            {/* Payment Method selector */}
            <div>
              <label className="block text-[11px] font-bold text-[#14213D] dark:text-slate-300 mb-1.5">
                Mode de règlement
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'cash', label: 'Espèces', icon: Banknote },
                  { id: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
                  { id: 'bank_transfer', label: 'Virement', icon: Building },
                  { id: 'card', label: 'Carte Bancaire', icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === m.id
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500'
                          : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Optional notes */}
        <div>
          <label className="block text-[11px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
            Notes / Conditions spécifiques sur la facture (optionnel)
          </label>
          <input
            type="text"
            placeholder="Ex: Garantie 6 mois pièces et main d'œuvre, livraison incluse..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-[#14213D] dark:text-white"
          />
        </div>
      </div>

      {/* 5. SYNTHÈSE FINANCIÈRE */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#14213D] text-white shadow-xl space-y-2.5">
        <div className="flex justify-between text-xs text-slate-300">
          <span>Sous-total HT :</span>
          <span className="font-mono font-bold text-white">{curr(subtotal)}</span>
        </div>
        {discountTotal > 0 && (
          <div className="flex justify-between text-xs text-emerald-400">
            <span>Remises totales :</span>
            <span className="font-mono font-bold">- {curr(discountTotal)}</span>
          </div>
        )}
        {vatAmount > 0 && (
          <div className="flex justify-between text-xs text-slate-300">
            <span>TVA ({state.settings.vatRate}%) :</span>
            <span className="font-mono font-bold text-white">{curr(vatAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-slate-700/80 text-sm sm:text-base font-black">
          <span className="uppercase tracking-wider">TOTAL NET À PAYER :</span>
          <span className="font-mono text-xl sm:text-2xl text-orange-400 font-financial">
            {curr(total)}
          </span>
        </div>
      </div>

      {/* 6. DEDICATED STICKY ACTION BAR ABOVE MOBILE BOTTOM NAVIGATION */}
      <div
        className="fixed left-0 right-0 p-3 sm:p-4 z-40 max-w-xl mx-auto transition-all"
        style={{
          bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 8px)',
        }}
      >
        <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider truncate">
              {paymentStatus === 'paid'
                ? 'Facture réglée'
                : paymentStatus === 'partial'
                ? `Acompte : ${curr(amountPaid)}`
                : 'Facture à terme'}
            </div>
            <div className="text-base sm:text-xl font-black font-financial text-[#14213D] dark:text-white truncate">
              {curr(total)}
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting || lines.length === 0}
            onClick={handleCreateInvoice}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs sm:text-sm font-black tracking-wide shadow-md shadow-orange-500/30 transition-transform active:scale-95 cursor-pointer select-none"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>CRÉER LA FACTURE</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* CATALOG PICKER MODAL */}
      {showCatalogPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#131B2E] rounded-3xl border border-[#E8EDF2] dark:border-[#22304E] p-5 space-y-4 max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8EDF2] dark:border-[#22304E]">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                <h3 className="text-sm font-black text-[#14213D] dark:text-white">
                  Sélectionner un article du catalogue
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogPicker(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {state.products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addCatalogProduct(p)}
                  className="w-full p-3 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between text-left transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-[#14213D] dark:text-white truncate">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-[#64748B] dark:text-slate-400 font-mono">
                      {p.sku ? `SKU: ${p.sku}` : ''} • Stock : {p.stockQuantity}
                    </div>
                  </div>
                  <div className="font-mono font-black text-xs text-orange-600 dark:text-orange-400 shrink-0">
                    {curr(p.sellingPrice)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
