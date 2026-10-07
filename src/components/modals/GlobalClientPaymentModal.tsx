import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Layers,
  Clock,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Invoice, PaymentMethod } from '../../types';
import { formatCurrency, formatDate, getTodayDateString, getPaymentMethodLabel } from '../../utils/formatters';

interface GlobalClientPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClientId?: string;
  defaultClientName?: string;
}

export const GlobalClientPaymentModal: React.FC<GlobalClientPaymentModalProps> = ({
  isOpen,
  onClose,
  defaultClientId,
  defaultClientName,
}) => {
  const { state, payClientReceivablesGlobally } = useApp();
  const { currency, currencyPosition } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  // Group all unpaid/partial invoices by client
  const debtorClients = useMemo(() => {
    const map = new Map<string, { clientId?: string; clientName: string; clientPhone?: string; totalRemaining: number; count: number }>();
    state.invoices
      .filter((inv) => (inv.status === 'unpaid' || inv.status === 'partial') && inv.remainingAmount > 0)
      .forEach((inv) => {
        const key = (inv.clientId || inv.clientName).trim().toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.totalRemaining += inv.remainingAmount;
          existing.count += 1;
        } else {
          map.set(key, {
            clientId: inv.clientId,
            clientName: inv.clientName,
            clientPhone: inv.clientPhone,
            totalRemaining: inv.remainingAmount,
            count: 1,
          });
        }
      });
    return Array.from(map.values()).sort((a, b) => b.totalRemaining - a.totalRemaining);
  }, [state.invoices]);

  const [selectedClientKey, setSelectedClientKey] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    totalApplied: number;
    affectedInvoices: { invoice: Invoice; amountApplied: number }[];
  } | null>(null);

  // Initialize selected client
  useEffect(() => {
    if (defaultClientId || defaultClientName) {
      const match = debtorClients.find(
        (c) =>
          (defaultClientId && c.clientId === defaultClientId) ||
          (defaultClientName && c.clientName.trim().toLowerCase() === defaultClientName.trim().toLowerCase())
      );
      if (match) {
        setSelectedClientKey(match.clientId || match.clientName);
        setAmount(match.totalRemaining);
        return;
      }
    }
    if (debtorClients.length > 0 && !selectedClientKey) {
      const first = debtorClients[0];
      setSelectedClientKey(first.clientId || first.clientName);
      setAmount(first.totalRemaining);
    }
  }, [debtorClients, defaultClientId, defaultClientName, isOpen]);

  // Selected client object
  const currentClient = useMemo(() => {
    return debtorClients.find((c) => (c.clientId || c.clientName) === selectedClientKey);
  }, [debtorClients, selectedClientKey]);

  // Outstanding invoices for the selected client (sorted FIFO: oldest first)
  const clientInvoices = useMemo(() => {
    if (!currentClient) return [];
    return state.invoices
      .filter((inv) => {
        if (inv.status === 'cancelled' || inv.remainingAmount <= 0) return false;
        if (currentClient.clientId && inv.clientId === currentClient.clientId) return true;
        return inv.clientName.trim().toLowerCase() === currentClient.clientName.trim().toLowerCase();
      })
      .sort((a, b) => (a.date || a.createdAt).localeCompare(b.date || b.createdAt));
  }, [state.invoices, currentClient]);

  // Real-time FIFO allocation simulation
  const allocationSimulation = useMemo(() => {
    let unallocated = Math.max(0, Number(amount) || 0);
    return clientInvoices.map((inv) => {
      const needed = inv.remainingAmount;
      const applied = Math.min(unallocated, needed);
      unallocated = Math.max(0, unallocated - applied);
      const remainingAfter = Math.max(0, needed - applied);
      const isFullyPaid = remainingAfter <= 0;
      return {
        invoice: inv,
        applied,
        remainingAfter,
        isFullyPaid,
      };
    });
  }, [clientInvoices, amount]);

  if (!isOpen) return null;

  const handleClientChange = (newKey: string) => {
    setSelectedClientKey(newKey);
    const target = debtorClients.find((c) => (c.clientId || c.clientName) === newKey);
    if (target) {
      setAmount(target.totalRemaining);
    }
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentClient) {
      setErrorMsg('Veuillez sélectionner un client.');
      return;
    }

    if (amount <= 0 || isNaN(amount)) {
      setErrorMsg('Veuillez saisir un montant valide supérieur à 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await payClientReceivablesGlobally({
        clientId: currentClient.clientId,
        clientName: currentClient.clientName,
        amount,
        method,
        date,
        note: note.trim() || undefined,
      });

      if (res.success) {
        setSuccessResult({
          totalApplied: res.totalApplied,
          affectedInvoices: res.affectedInvoices,
        });
      } else {
        setErrorMsg(res.error || 'Erreur lors du traitement du règlement global.');
      }
    } catch (err: any) {
      console.error('Error paying global receivables:', err);
      setErrorMsg(err?.message || 'Erreur inattendue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    setSuccessResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[92vh]">
        
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Règlement Global Créances (FIFO)
              </h3>
              <p className="text-xs text-slate-500">
                Ventilation automatique sur les factures les plus anciennes en priorité
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

        {/* Content */}
        {successResult ? (
          /* Success Screen */
          <div className="p-6 sm:p-8 text-center space-y-5 overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border-2 border-emerald-200 dark:border-emerald-800 animate-in zoom-in">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold mb-2">
                ✓ Règlement validé
              </span>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">
                {curr(successResult.totalApplied)} encaissés
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Client : <strong>{currentClient?.clientName}</strong> • {successResult.affectedInvoices.length} facture(s) mise(s) à jour
              </p>
            </div>

            {/* List of affected invoices */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-left space-y-2.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Détail de la ventilation FIFO appliquée :
              </div>
              <div className="space-y-2 divide-y divide-slate-200/60 dark:divide-slate-700/60">
                {successResult.affectedInvoices.map(({ invoice, amountApplied }) => (
                  <div key={invoice.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {invoice.number}
                      </span>
                      <span className="text-slate-500 ml-2">({formatDate(invoice.date)})</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {invoice.remainingAmount === 0 ? (
                          <span className="text-emerald-600 font-bold">Soldée à 100%</span>
                        ) : (
                          <span>Reste dû : {curr(invoice.remainingAmount)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      +{curr(amountApplied)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3.5 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              Terminer & fermer
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Client selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Client débiteur *
              </label>
              <select
                value={selectedClientKey}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                required
              >
                {debtorClients.map((c, idx) => (
                  <option key={(c.clientId || c.clientName) + idx} value={c.clientId || c.clientName}>
                    {c.clientName} — Dû : {curr(c.totalRemaining)} ({c.count} facture{c.count > 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            </div>

            {/* Client summary badge */}
            {currentClient && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-amber-900 dark:text-amber-200 block">
                    Créance totale cumulée :
                  </span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400">
                    Sur {clientInvoices.length} facture(s) impayée(s)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-base sm:text-lg font-black font-mono text-rose-600 dark:text-rose-400">
                    {curr(currentClient.totalRemaining)}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Amount and presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Montant total à encaisser *
                </label>
                {currentClient && (
                  <button
                    type="button"
                    onClick={() => setAmount(currentClient.totalRemaining)}
                    className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                  >
                    Tout solder ({curr(currentClient.totalRemaining)})
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={amount || ''}
                  onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="Montant du versement global"
                  className="w-full h-12 pl-4 pr-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-lg font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {currency}
                </span>
              </div>

              {/* Amount exceeding debt warning */}
              {currentClient && amount > currentClient.totalRemaining && (
                <div className="text-[11px] text-amber-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>
                    Le montant saisi dépasse le solde dû. Le surplus ({curr(amount - currentClient.totalRemaining)}) sera ignoré ou à imputer comme avance.
                  </span>
                </div>
              )}
            </div>

            {/* 3. Method & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mode de règlement *
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                >
                  <option value="cash">Espèces</option>
                  <option value="mobile_money">Mobile Money (Orange, Wave, MTN, Moov)</option>
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="card">Carte bancaire</option>
                  <option value="check">Chèque</option>
                  <option value="other">Autre mode</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Date du paiement *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
            </div>

            {/* 4. Optional note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Note / Référence (optionnel)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex : Virement groupé ref TRX-8849, chèque n° 449..."
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* 5. Live FIFO Allocation Simulation */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Simulation de ventilation FIFO (Priorité ancienneté) :</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {clientInvoices.length} facture(s)
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-200/80 dark:border-slate-700/80">
                {allocationSimulation.map(({ invoice, applied, remainingAfter, isFullyPaid }, idx) => (
                  <div
                    key={invoice.id}
                    className={`p-2.5 rounded-xl transition-colors text-xs flex items-center justify-between ${
                      applied > 0
                        ? isFullyPaid
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800'
                        : 'bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          #{invoice.number}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          du {formatDate(invoice.date)}
                        </span>
                        {idx === 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                            1ère priorité
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Reste actuel : {curr(invoice.remainingAmount)}
                      </div>
                    </div>

                    <div className="text-right">
                      {applied > 0 ? (
                        <>
                          <div className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                            +{curr(applied)}
                          </div>
                          <div className="text-[10px] font-bold">
                            {isFullyPaid ? (
                              <span className="text-emerald-700 dark:text-emerald-300">✓ Soldée</span>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-300">Reste {curr(remainingAfter)}</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Non couverte</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 sticky bottom-0 bg-white dark:bg-slate-900">
              <button
                type="submit"
                disabled={isSubmitting || amount <= 0}
                className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-amber-600/30 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-5 h-5" />
                <span>
                  {isSubmitting ? 'Traitement en cours...' : `Confirmer le règlement global (${curr(amount)})`}
                </span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
