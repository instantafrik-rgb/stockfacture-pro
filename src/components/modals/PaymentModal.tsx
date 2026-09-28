import React, { useState } from 'react';
import { X, CreditCard, Banknote, Smartphone, CheckCircle, FileText, Share2, Calendar, Building } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Invoice, PaymentMethod } from '../../types';
import { formatCurrency, getTodayDateString, getPaymentMethodLabel } from '../../utils/formatters';
import { generateReceiptPdf } from '../../pdf/documentPdf';

interface PaymentModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ invoice, isOpen, onClose }) => {
  const { state, addPaymentToInvoice } = useApp();
  const { currency, currencyPosition } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  const [amount, setAmount] = useState<number>(invoice.remainingAmount);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [note, setNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [recordedPayment, setRecordedPayment] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const safeAmount = Number(amount) || 0;
    if (safeAmount <= 0) {
      setErrorMsg('Veuillez saisir un montant supérieur à zéro.');
      return;
    }

    if (safeAmount > invoice.remainingAmount) {
      setErrorMsg(
        `Le montant saisi (${curr(safeAmount)}) dépasse le reste à payer (${curr(invoice.remainingAmount)}).`
      );
      return;
    }

    setIsSubmitting(true);
    const res = await addPaymentToInvoice({
      invoiceId: invoice.id,
      amount: safeAmount,
      method,
      note: note.trim() || undefined,
      date,
    });
    setIsSubmitting(false);

    if (res.success && res.payment) {
      setRecordedPayment(res.payment);
      setIsSuccess(true);
    } else {
      setErrorMsg(res.error || 'Erreur lors de l’enregistrement du paiement.');
    }
  };

  const handleDownloadReceipt = () => {
    if (!recordedPayment) return;
    generateReceiptPdf(recordedPayment, invoice, state.settings, 'download');
  };

  const handleShareReceipt = () => {
    if (!recordedPayment) return;
    generateReceiptPdf(recordedPayment, invoice, state.settings, 'share');
  };

  const newBalance = Math.max(0, invoice.remainingAmount - (Number(amount) || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-[#131B2E] rounded-[28px] shadow-2xl border border-[#E8EDF2] dark:border-[#22304E] overflow-hidden animate-in zoom-in-95">
        {/* Success Screen */}
        {isSuccess ? (
          <div className="p-6 sm:p-7 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border-2 border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold mb-2">
                ✓ Règlement enregistré
              </span>
              <h3 className="text-xl font-black text-[#14213D] dark:text-white">
                Facture #{invoice.number}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                Client : <strong className="text-[#14213D] dark:text-white">{invoice.clientName}</strong>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[#64748B] dark:text-slate-400 font-semibold">Montant versé :</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {curr(amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B] dark:text-slate-400 font-semibold">Mode de paiement :</span>
                <span className="font-bold text-[#14213D] dark:text-white">
                  {getPaymentMethodLabel(method)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#E8EDF2] dark:border-slate-700">
                <span className="text-[#64748B] dark:text-slate-400 font-semibold">Nouveau reste à payer :</span>
                <span
                  className={`font-mono font-black text-sm ${
                    newBalance <= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {newBalance <= 0 ? '0 (Facture SOLDÉE)' : curr(newBalance)}
                </span>
              </div>
            </div>

            {/* Actions for Receipt */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownloadReceipt}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-[#14213D] hover:bg-[#26354F] text-white text-xs font-bold transition-all active:scale-95 shadow-xs"
              >
                <FileText className="w-4 h-4" />
                <span>Reçu de paiement</span>
              </button>
              <button
                type="button"
                onClick={handleShareReceipt}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border border-[#E8EDF2] dark:border-slate-700 text-[#14213D] dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>Partager</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 cursor-pointer"
            >
              Fermer
            </button>
          </div>
        ) : (
          /* Payment Form */
          <>
            <div className="p-5 border-b border-[#E8EDF2] dark:border-[#22304E] flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-[#14213D] dark:text-white">
                  Enregistrer un règlement
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                  Facture <strong className="font-mono text-orange-600">#{invoice.number}</strong> • {invoice.clientName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
                  {errorMsg}
                </div>
              )}

              {/* Reste actuel banner */}
              <div className="p-3 rounded-2xl bg-orange-50/70 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-between text-xs">
                <span className="font-bold text-orange-900 dark:text-orange-200">Reste à payer actuel :</span>
                <span className="font-mono font-black text-sm text-orange-600 dark:text-orange-400">
                  {curr(invoice.remainingAmount)}
                </span>
              </div>

              {/* Amount to pay */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#14213D] dark:text-slate-300">
                    Montant du versement ({currency}) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmount(invoice.remainingAmount)}
                    className="text-xs font-bold text-orange-600 hover:underline"
                  >
                    Régler la totalité ({curr(invoice.remainingAmount)})
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    max={invoice.remainingAmount}
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full h-12 px-4 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-lg font-mono font-black text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                    required
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    {currency}
                  </div>
                </div>
                {amount > 0 && amount < invoice.remainingAmount && (
                  <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1">
                    Reliquat restant après ce paiement : <strong>{curr(invoice.remainingAmount - amount)}</strong>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1.5">
                  Mode de règlement
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'Espèces', icon: Banknote },
                    { id: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
                    { id: 'bank_transfer', label: 'Virement', icon: Building },
                    { id: 'card', label: 'Carte', icon: CreditCard },
                    { id: 'check', label: 'Chèque', icon: CreditCard },
                    { id: 'other', label: 'Autre', icon: CreditCard },
                  ].map((m) => {
                    const isSelected = method === m.id;
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id as PaymentMethod)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shadow-xs ring-1 ring-orange-500'
                            : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="truncate w-full text-center">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Date d'encaissement</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Note / Reference */}
              <div>
                <label className="block text-xs font-bold text-[#64748B] dark:text-slate-400 mb-1.5">
                  Référence / Observation (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Reçu Wave #8812, chèque n° 4492, solde acompte..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8EDF2] dark:border-[#22304E]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-[#64748B] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-3 text-xs sm:text-sm font-extrabold text-white bg-orange-500 hover:bg-orange-600 rounded-xl shadow-md shadow-orange-500/20 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Validation...' : 'Valider le règlement'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
