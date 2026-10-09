import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  RotateCcw,
  RefreshCw,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
  User,
  Calendar,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Invoice, PaymentMethod, ReturnActionType, Product } from '../../types';
import { formatCurrency, formatDate, getTodayDateString, getPaymentMethodLabel } from '../../utils/formatters';
import { auth } from '../../services/firebase';
import { ProductThumbnail } from '../common/ProductThumbnail';

interface SaleReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
}

interface ItemReturnSelection {
  invoiceItemId: string;
  selected: boolean;
  quantity: number;
  maxReturnable: number;
  restock: boolean;
}

export const SaleReturnModal: React.FC<SaleReturnModalProps> = ({
  isOpen,
  onClose,
  invoice,
}) => {
  const { state, processSaleReturn } = useApp();
  const { currency, currencyPosition, name: companyName } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  // Calculate previously returned quantities for each invoice item
  const previouslyReturnedMap = useMemo(() => {
    const map = new Map<string, number>();
    const invoiceReturns = (state.returns || []).filter((r) => r.invoiceId === invoice.id);
    invoiceReturns.forEach((ret) => {
      ret.items.forEach((it) => {
        const current = map.get(it.invoiceItemId) || 0;
        map.set(it.invoiceItemId, current + it.quantity);
      });
    });
    return map;
  }, [state.returns, invoice.id]);

  // Selections per item
  const [selections, setSelections] = useState<Record<string, ItemReturnSelection>>({});
  const [actionType, setActionType] = useState<ReturnActionType>('refund');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash');
  const [reason, setReason] = useState<string>('Article défectueux');
  const [customReason, setCustomReason] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [userName, setUserName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Exchange state
  const [exchangeProductId, setExchangeProductId] = useState<string>('');
  const [exchangeQuantity, setExchangeQuantity] = useState<number>(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ returnNumber: string } | null>(null);

  // Initialize selections
  useEffect(() => {
    const initialMap: Record<string, ItemReturnSelection> = {};
    invoice.items.forEach((it) => {
      const returnedAlready = previouslyReturnedMap.get(it.id) || 0;
      const maxReturnable = Math.max(0, it.quantity - returnedAlready);
      initialMap[it.id] = {
        invoiceItemId: it.id,
        selected: false,
        quantity: Math.min(1, maxReturnable),
        maxReturnable,
        restock: true,
      };
    });
    setSelections(initialMap);
    setDate(getTodayDateString());
    setErrorMsg(null);
    setSuccessResult(null);

    const currentUser = auth.currentUser;
    setUserName(
      currentUser?.displayName ||
        currentUser?.email ||
        state.settings.name ||
        'Responsable'
    );

    if (state.products.length > 0) {
      setExchangeProductId(state.products[0].id);
    }
  }, [invoice, previouslyReturnedMap, state.settings.name, state.products, isOpen]);

  // Selected items to return
  const selectedReturnItems = useMemo(() => {
    return invoice.items
      .filter((it) => selections[it.id]?.selected && selections[it.id]?.quantity > 0)
      .map((it) => {
        const sel = selections[it.id];
        const qty = Math.min(sel.quantity, sel.maxReturnable);
        return {
          invoiceItemId: it.id,
          productId: it.productId,
          designation: it.designation,
          quantity: qty,
          unitPrice: it.unitPrice,
          total: qty * it.unitPrice,
          restock: sel.restock,
          condition: (sel.restock ? 'resellable' : 'defective') as 'resellable' | 'defective',
        };
      });
  }, [invoice.items, selections]);

  // Total returned amount
  const totalReturnedAmount = useMemo(() => {
    return selectedReturnItems.reduce((acc, it) => acc + it.total, 0);
  }, [selectedReturnItems]);

  // Exchange replacement product object & calculation
  const exchangeProductObj = useMemo(() => {
    if (actionType !== 'exchange' || !exchangeProductId) return null;
    const prod = state.products.find((p) => p.id === exchangeProductId);
    if (!prod) return null;
    const qty = Math.max(1, exchangeQuantity || 1);
    const total = qty * prod.sellingPrice;
    return {
      productId: prod.id,
      designation: prod.name,
      quantity: qty,
      unitPrice: prod.sellingPrice,
      total,
    };
  }, [actionType, exchangeProductId, exchangeQuantity, state.products]);

  // Price difference for exchange
  const exchangeDifference = useMemo(() => {
    if (!exchangeProductObj) return 0;
    return exchangeProductObj.total - totalReturnedAmount;
  }, [exchangeProductObj, totalReturnedAmount]);

  if (!isOpen) return null;

  const handleToggleItem = (itemId: string) => {
    setSelections((prev) => {
      const current = prev[itemId];
      if (!current || current.maxReturnable <= 0) return prev;
      return {
        ...prev,
        [itemId]: {
          ...current,
          selected: !current.selected,
          quantity: current.quantity || 1,
        },
      };
    });
  };

  const handleQuantityChange = (itemId: string, qty: number) => {
    setSelections((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      const safeQty = Math.max(1, Math.min(qty, current.maxReturnable));
      return {
        ...prev,
        [itemId]: {
          ...current,
          quantity: safeQty,
        },
      };
    });
  };

  const handleRestockToggle = (itemId: string) => {
    setSelections((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return {
        ...prev,
        [itemId]: {
          ...current,
          restock: !current.restock,
        },
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (selectedReturnItems.length === 0) {
      setErrorMsg('Veuillez cocher au moins un article à retourner.');
      return;
    }

    if (actionType === 'exchange' && !exchangeProductObj) {
      setErrorMsg('Veuillez sélectionner un article d\'échange valide.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalReason = reason === 'Autre motif' ? customReason.trim() || 'Autre' : reason;
      const res = await processSaleReturn({
        invoiceId: invoice.id,
        items: selectedReturnItems,
        actionType,
        refundMethod,
        exchangeProduct: exchangeProductObj || undefined,
        reason: finalReason,
        date,
        userName,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.saleReturn) {
        setSuccessResult({ returnNumber: res.saleReturn.returnNumber });
      } else {
        setErrorMsg(res.error || 'Erreur lors du traitement du retour.');
      }
    } catch (err: any) {
      console.error('Error processing return:', err);
      setErrorMsg(err?.message || 'Erreur inattendue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Retour d'Articles & Avoirs
              </h3>
              <p className="text-xs text-slate-500">
                Facture #{invoice.number} • Client : <strong>{invoice.clientName}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Confirmation View */}
        {successResult ? (
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Retour Enregistré avec Succès !
              </h4>
              <p className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                Bon N° {successResult.returnNumber}
              </p>
              <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
                Le stock a été actualisé en temps réel, l'historique original de la vente est conservé et les écritures financières ont été synchronisées.
              </p>
            </div>

            <div className="pt-4 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-transform active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Articles de la facture à retourner */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  1. Sélectionner les articles retournés
                </span>
                <span className="text-xs text-slate-400">
                  {selectedReturnItems.length} article(s) coché(s)
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden text-xs">
                {invoice.items.map((it) => {
                  const returnedAlready = previouslyReturnedMap.get(it.id) || 0;
                  const sel = selections[it.id] || {
                    invoiceItemId: it.id,
                    selected: false,
                    quantity: 1,
                    maxReturnable: Math.max(0, it.quantity - returnedAlready),
                    restock: true,
                  };
                  const isExhausted = sel.maxReturnable <= 0;

                  return (
                    <div
                      key={it.id}
                      className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        sel.selected
                          ? 'bg-indigo-50/50 dark:bg-indigo-950/20'
                          : isExhausted
                          ? 'opacity-40 bg-slate-50 dark:bg-slate-900/40'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          disabled={isExhausted}
                          checked={sel.selected}
                          onChange={() => handleToggleItem(it.id)}
                          className="mt-1.5 w-4 h-4 rounded text-indigo-600 focus:ring-orange-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <ProductThumbnail
                          imageUrl={state.products.find((p) => p.id === it.productId)?.imageUrl}
                          name={it.designation}
                          size="sm"
                          roundedClassName="rounded-xl mt-0.5"
                        />
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white leading-tight">
                            {it.designation}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Vendu : {it.quantity} {it.unit || ''} x {curr(it.unitPrice)}
                            {returnedAlready > 0 && (
                              <span className="ml-1 text-amber-600 font-semibold">
                                ({returnedAlready} déjà retourné)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stepper + Restock toggle if selected */}
                      {!isExhausted && (
                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {sel.selected && (
                            <>
                              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                <span className="text-[10px] text-slate-400 font-bold px-1">Qté :</span>
                                <input
                                  type="number"
                                  min="1"
                                  max={sel.maxReturnable}
                                  value={sel.quantity}
                                  onChange={(e) => handleQuantityChange(it.id, parseInt(e.target.value, 10) || 1)}
                                  className="w-12 h-7 text-center font-mono font-bold text-xs bg-transparent border-0 focus:outline-hidden text-slate-900 dark:text-white"
                                />
                                <span className="text-[10px] text-slate-400 pr-1">/ {sel.maxReturnable}</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRestockToggle(it.id)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                                  sel.restock
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                }`}
                                title={sel.restock ? 'L\'article sera réintégré dans le stock physique' : 'L\'article ne sera pas remis en stock (défectueux/perdu)'}
                              >
                                {sel.restock ? '📦 Remis en stock' : '❌ Non réintégrable'}
                              </button>
                            </>
                          )}

                          <div className="text-right min-w-[70px]">
                            <span className="font-mono font-black text-slate-900 dark:text-white block">
                              {curr((sel.selected ? sel.quantity : 0) * it.unitPrice)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedReturnItems.length > 0 && (
                <div className="p-3 mt-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-indigo-900 dark:text-indigo-200">
                    Valeur des articles retournés :
                  </span>
                  <span className="text-base font-black font-mono text-indigo-700 dark:text-indigo-300">
                    {curr(totalReturnedAmount)}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Modalité du retour : Remboursement / Avoir / Échange */}
            <div>
              <span className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                2. Traitement du retour
              </span>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActionType('refund')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    actionType === 'refund'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-white ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className="w-5 h-5 text-indigo-600 mb-1" />
                  <div className="font-extrabold text-xs">Remboursement</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Restitution d'argent au client
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActionType('credit_note')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    actionType === 'credit_note'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-white ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-5 h-5 text-indigo-600 mb-1" />
                  <div className="font-extrabold text-xs">Avoir client</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Crédit ou déduction de dette
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActionType('exchange')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    actionType === 'exchange'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-white ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <RefreshCw className="w-5 h-5 text-indigo-600 mb-1" />
                  <div className="font-extrabold text-xs">Échange</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Remplacement par un article
                  </div>
                </button>
              </div>

              {/* Mode-specific configuration */}
              {actionType === 'refund' && (
                <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Mode de remboursement :</span>
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)}
                      className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="cash">Espèces</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="bank_transfer">Virement bancaire</option>
                      <option value="card">Carte bancaire</option>
                      <option value="check">Chèque</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Le montant de <strong>{curr(totalReturnedAmount)}</strong> sera enregistré comme remboursement et déduit du montant encaissé de la facture sans altérer les lignes de vente d'origine.
                  </p>
                </div>
              )}

              {actionType === 'credit_note' && (
                <div className="mt-3 p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200">
                  <p>
                    Un avoir officiel de <strong>{curr(totalReturnedAmount)}</strong> sera généré pour <strong>{invoice.clientName}</strong>. Si la facture présente encore un solde dû, il sera automatiquement allégé à due concurrence.
                  </p>
                </div>
              )}

              {actionType === 'exchange' && (
                <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">
                    Sélectionner le produit de remplacement en rayon :
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Article d'échange</label>
                      <select
                        value={exchangeProductId}
                        onChange={(e) => setExchangeProductId(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        {state.products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({curr(p.sellingPrice)} • Stock : {p.stockQuantity} {p.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Quantité remise</label>
                      <input
                        type="number"
                        min="1"
                        value={exchangeQuantity}
                        onChange={(e) => setExchangeQuantity(parseInt(e.target.value, 10) || 1)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white text-center"
                      />
                    </div>
                  </div>

                  {exchangeProductObj && (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <ProductThumbnail
                          imageUrl={state.products.find((p) => p.id === exchangeProductObj.productId)?.imageUrl}
                          name={exchangeProductObj.designation}
                          size="sm"
                          roundedClassName="rounded-xl"
                        />
                        <div className="truncate">
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white block truncate">
                            {exchangeProductObj.quantity}x {exchangeProductObj.designation}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {curr(exchangeProductObj.unitPrice)} / unité
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Total de l'article de remplacement :</span>
                        <span className="font-mono font-bold">{curr(exchangeProductObj.total)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Moins valeur du retour :</span>
                        <span className="font-mono text-emerald-600 font-bold">-{curr(totalReturnedAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-extrabold pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>Différence financière :</span>
                        <span
                          className={`font-mono ${
                            exchangeDifference > 0
                              ? 'text-rose-600'
                              : exchangeDifference < 0
                              ? 'text-emerald-600'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {exchangeDifference > 0
                            ? `+${curr(exchangeDifference)} (Client paie le supplément)`
                            : exchangeDifference < 0
                            ? `${curr(exchangeDifference)} (Magasin rembourse la différence)`
                            : '0 (Échange à valeur égale)'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Motif, Date, Opérateur & Remarques */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motif du retour *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="Article défectueux">Article défectueux / Panne</option>
                  <option value="Erreur de modèle ou taille">Erreur de modèle, taille ou référence</option>
                  <option value="Changement d'avis client">Changement d'avis du client</option>
                  <option value="Non-conformité produit">Non-conformité produit</option>
                  <option value="Autre motif">Autre motif (préciser)</option>
                </select>
                {reason === 'Autre motif' && (
                  <input
                    type="text"
                    placeholder="Préciser le motif..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full h-10 px-3 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Date de l'opération *</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Opérateur responsable *</span>
                </label>
                <input
                  type="text"
                  placeholder="Nom de l'opérateur ou caissier"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Remarque / Note interne (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Emballage ouvert mais propre, testé ok..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={isSubmitting || selectedReturnItems.length === 0}
                className="px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Traitement...'
                    : actionType === 'refund'
                    ? 'Valider le Remboursement'
                    : actionType === 'credit_note'
                    ? 'Émettre l\'Avoir Client'
                    : 'Valider l\'Échange'}
                </span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
