import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Coins,
  DollarSign,
  Calendar,
  User,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { formatCurrency, formatDate, getTodayDateString } from '../../utils/formatters';
import { calculateCashClosure } from '../../utils/reportsAnalytics';
import { CashRegisterClosure } from '../../types';

interface CashClosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveClosure?: (closure: CashRegisterClosure) => void;
}

export const CashClosureModal: React.FC<CashClosureModalProps> = ({
  isOpen,
  onClose,
  onSaveClosure,
}) => {
  const { state } = useApp();
  const { currency, currencyPosition, name: companyName } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  const [closureDate, setClosureDate] = useState(() => getTodayDateString());
  const [cashierName, setCashierName] = useState('');
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [actualCash, setActualCash] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [savedClosure, setSavedClosure] = useState<CashRegisterClosure | null>(null);

  // Calculate live closure stats for selected date
  const calculation = useMemo(() => {
    return calculateCashClosure(
      closureDate,
      state.payments,
      state.invoices,
      openingCash || 0,
      actualCash || 0
    );
  }, [closureDate, state.payments, state.invoices, openingCash, actualCash]);

  if (!isOpen) return null;

  const handleValidateClosure = () => {
    const closure: CashRegisterClosure = {
      id: `closure-${Date.now()}`,
      closureNumber: `Z-${closureDate}-${Math.floor(100 + Math.random() * 900)}`,
      date: closureDate,
      closedAt: new Date().toISOString(),
      cashierName: cashierName.trim() || undefined,
      openingCash: calculation.openingCash,
      cashSales: calculation.cashSales,
      mobileMoneySales: calculation.mobileMoneySales,
      cardSales: calculation.cardSales,
      otherSales: calculation.otherSales,
      totalSales: calculation.totalSales,
      transactionsCount: calculation.transactionsCount,
      expectedCashInDrawer: calculation.expectedCashInDrawer,
      actualCashInDrawer: calculation.actualCashInDrawer,
      cashDifference: calculation.cashDifference,
      notes: notes.trim() || undefined,
    };

    setSavedClosure(closure);
    setIsSaved(true);
    if (onSaveClosure) {
      onSaveClosure(closure);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Clôture de Caisse (Rapport Z)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                  Fin de journée
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Arrêté des comptes, vérification du tiroir-caisse et calcul des écarts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {isSaved && savedClosure ? (
            /* Saved Success Ticket View */
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold text-sm">Clôture enregistrée avec succès !</div>
                  <div>Rapport n° {savedClosure.closureNumber} généré le {formatDate(savedClosure.date)}</div>
                </div>
              </div>

              {/* Printable Ticket Receipt */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs space-y-3 print:border-none print:shadow-none">
                <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-1">
                  <div className="font-black text-sm uppercase">{companyName || 'StockFacture Pro'}</div>
                  <div className="text-[11px] text-slate-500">RAPPORT Z DE CLÔTURE DE CAISSE</div>
                  <div className="text-[10px] text-slate-400">{savedClosure.closureNumber} • {formatDate(savedClosure.date)}</div>
                  {savedClosure.cashierName && (
                    <div className="text-[10px] text-slate-500">Responsable : {savedClosure.cashierName}</div>
                  )}
                </div>

                <div className="space-y-1.5 py-1 border-b border-dashed border-slate-300 dark:border-slate-700">
                  <div className="flex justify-between">
                    <span>Nombre de ventes :</span>
                    <span className="font-bold">{savedClosure.transactionsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ventes Espèces :</span>
                    <span className="font-bold">{curr(savedClosure.cashSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ventes Mobile Money :</span>
                    <span className="font-bold">{curr(savedClosure.mobileMoneySales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ventes Carte Bancaire :</span>
                    <span className="font-bold">{curr(savedClosure.cardSales)}</span>
                  </div>
                  {savedClosure.otherSales > 0 && (
                    <div className="flex justify-between">
                      <span>Autres encaissements :</span>
                      <span className="font-bold">{curr(savedClosure.otherSales)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-black text-sm text-slate-900 dark:text-white">
                    <span>TOTAL VENTES DU JOUR :</span>
                    <span>{curr(savedClosure.totalSales)}</span>
                  </div>
                </div>

                <div className="space-y-1.5 py-1 border-b border-dashed border-slate-300 dark:border-slate-700">
                  <div className="flex justify-between text-slate-500">
                    <span>Fond de caisse initial :</span>
                    <span>{curr(savedClosure.openingCash)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>+ Espèces encaissées :</span>
                    <span>{curr(savedClosure.cashSales)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span>TOTAL ESPÈCES THÉORIQUE :</span>
                    <span>{curr(savedClosure.expectedCashInDrawer)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-indigo-600 dark:text-indigo-400">
                    <span>ESPÈCES COMPTÉES EN CAISSE :</span>
                    <span>{curr(savedClosure.actualCashInDrawer)}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl text-center font-bold text-xs flex items-center justify-between">
                  <span>ÉCART DE CAISSE :</span>
                  <span className={
                    savedClosure.cashDifference === 0
                      ? 'text-emerald-600'
                      : savedClosure.cashDifference > 0
                      ? 'text-blue-600'
                      : 'text-rose-600'
                  }>
                    {savedClosure.cashDifference === 0
                      ? 'Équilibré (0 FCFA)'
                      : savedClosure.cashDifference > 0
                      ? `+${curr(savedClosure.cashDifference)} (Excédent)`
                      : `${curr(savedClosure.cashDifference)} (Manquant)`}
                  </span>
                </div>

                {savedClosure.notes && (
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-dashed border-slate-300 dark:border-slate-700">
                    Note : {savedClosure.notes}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer le ticket Z</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-300 transition-colors"
                >
                  Terminer
                </button>
              </div>
            </div>
          ) : (
            /* Closure Form View */
            <div className="space-y-4">
              
              {/* Form Controls: Date & Cashier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Date de clôture
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={closureDate}
                      onChange={(e) => setClosureDate(e.target.value)}
                      className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Caissier / Responsable
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Nom du responsable..."
                      value={cashierName}
                      onChange={(e) => setCashierName(e.target.value)}
                      className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Day Sales Theoretical Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>Ventes enregistrées du {formatDate(closureDate)}</span>
                  <span>{calculation.transactionsCount} transaction(s)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400">Espèces</div>
                    <div className="font-bold font-mono text-slate-900 dark:text-white text-xs sm:text-sm">
                      {curr(calculation.cashSales)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400">Mobile Money</div>
                    <div className="font-bold font-mono text-slate-900 dark:text-white text-xs sm:text-sm">
                      {curr(calculation.mobileMoneySales)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400">Carte bancaire</div>
                    <div className="font-bold font-mono text-slate-900 dark:text-white text-xs sm:text-sm">
                      {curr(calculation.cardSales)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-900/60">
                    <div className="text-[10px] text-amber-800 dark:text-amber-400 font-bold">Total Ventes</div>
                    <div className="font-black font-mono text-amber-950 dark:text-amber-200 text-xs sm:text-sm">
                      {curr(calculation.totalSales)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cash Reconciliation Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Fond de caisse initial (Départ)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={openingCash || ''}
                      onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                      {currency}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <span>Espèces comptées dans le tiroir</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={actualCash || ''}
                      onChange={(e) => setActualCash(parseFloat(e.target.value) || 0)}
                      className="w-full h-11 px-3 rounded-xl border-2 border-indigo-500/80 bg-white dark:bg-slate-800 text-sm font-mono font-black text-slate-900 dark:text-white focus:outline-hidden"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-500 font-bold">
                      {currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Discrepancy Status Card */}
              <div className="p-4 rounded-2xl border space-y-2 transition-all">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Espèces théoriques attendues :</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {curr(calculation.expectedCashInDrawer)} ({curr(calculation.openingCash)} fond + {curr(calculation.cashSales)} ventes)
                  </span>
                </div>

                <div className={`p-3 rounded-xl flex items-center justify-between ${
                  calculation.status === 'balanced'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : calculation.status === 'surplus'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {calculation.status === 'balanced' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : calculation.status === 'surplus' ? (
                      <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-black">
                        {calculation.status === 'balanced'
                          ? 'Caisse parfaitement équilibrée'
                          : calculation.status === 'surplus'
                          ? 'Excédent de caisse détecté'
                          : 'Manquant / Déficit de caisse détecté'}
                      </div>
                      <div className="text-[10px] opacity-80">
                        {calculation.status === 'balanced'
                          ? 'Le comptage physique correspond au centime près aux encaissements.'
                          : calculation.status === 'surplus'
                          ? 'Il y a plus d’espèces en caisse que le montant théorique enregistré.'
                          : 'Il manque des espèces par rapport au total des ventes déclarées.'}
                      </div>
                    </div>
                  </div>

                  <div className="font-mono font-black text-sm sm:text-base shrink-0">
                    {calculation.status === 'balanced'
                      ? '0 FCFA'
                      : calculation.status === 'surplus'
                      ? `+${curr(calculation.cashDifference)}`
                      : curr(calculation.cashDifference)}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Observations / Remarques de clôture
                </label>
                <textarea
                  rows={2}
                  placeholder="Remarques éventuelles sur la session (erreur de monnaie, incident, etc.)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleValidateClosure}
                  className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <Coins className="w-4 h-4" />
                  <span>Enregistrer la clôture Z</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
