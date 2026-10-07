import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight, ArrowUpRight, Sliders, AlertCircle, Info, Calendar, User, BellRing } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { StockMovementReason, StockMovementType } from '../../types';
import { getTodayDateString } from '../../utils/formatters';
import { auth } from '../../services/firebase';
import { RestockRequestsDrawer } from './RestockRequestsDrawer';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProductId?: string;
  defaultType?: StockMovementType;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  isOpen,
  onClose,
  defaultProductId,
  defaultType = 'in',
}) => {
  const { state, recordStockMovement } = useApp();

  const [productId, setProductId] = useState<string>(defaultProductId || '');
  const [type, setType] = useState<StockMovementType>(defaultType);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<StockMovementReason>('purchase');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [note, setNote] = useState<string>('');
  const [referenceId, setReferenceId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [showRestockDrawer, setShowRestockDrawer] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultProductId) setProductId(defaultProductId);
    if (defaultType) {
      setType(defaultType);
      if (defaultType === 'in') {
        setReason('purchase');
      } else if (defaultType === 'out') {
        setReason('sale');
      } else {
        setReason('correction');
      }
    }
    setDate(getTodayDateString());
    setErrorMsg(null);
    // Initialize operator user name
    const currentUser = auth.currentUser;
    const defaultUser =
      currentUser?.displayName ||
      currentUser?.email ||
      state.settings.name ||
      'Responsable Stock';
    setUserName(defaultUser);
  }, [defaultProductId, defaultType, isOpen, state.settings.name]);

  // Set default product if none selected
  useEffect(() => {
    if (!productId && state.products.length > 0) {
      setProductId(state.products[0].id);
    }
  }, [productId, state.products]);

  if (!isOpen) return null;

  const selectedProduct = state.products.find((p) => p.id === productId);
  const prevStock = selectedProduct ? selectedProduct.stockQuantity : 0;

  let resultingStock = prevStock;
  const numQty = Math.max(0, Number(quantity) || 0);

  if (type === 'in') {
    resultingStock = prevStock + numQty;
  } else if (type === 'out') {
    resultingStock = prevStock - numQty;
  } else if (type === 'adjustment') {
    resultingStock = numQty;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedProduct) {
      setErrorMsg('Veuillez sélectionner un produit.');
      return;
    }

    if (quantity <= 0 || isNaN(quantity)) {
      setErrorMsg('La quantité doit être supérieure à zéro.');
      return;
    }

    if (type === 'out' && !state.settings.allowNegativeStock && numQty > prevStock) {
      setErrorMsg(
        `Stock insuffisant : vous tentez de sortir ${numQty} ${selectedProduct.unit}, mais seulement ${prevStock} sont disponibles.`
      );
      return;
    }

    setIsSubmitting(true);
    const result = await recordStockMovement({
      productId: selectedProduct.id,
      type,
      quantity: numQty,
      reason,
      note: note.trim() || undefined,
      referenceId: referenceId.trim() || undefined,
      userName: userName.trim() || undefined,
      date,
    });
    setIsSubmitting(false);

    if (result.success) {
      if (type === 'in' && waitingClients.length > 0) {
        setShowRestockDrawer(true);
      } else {
        onClose();
      }
    } else {
      setErrorMsg(result.error || 'Erreur lors de l’enregistrement du mouvement.');
    }
  };

  const waitingClients = (state.restockRequests || []).filter(
    (r) => r.productId === productId && (r.status === 'pending' || r.status === 'available')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#131B2E] rounded-3xl shadow-2xl border border-[#E8EDF2] dark:border-[#22304E] overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-[#E8EDF2] dark:border-[#22304E] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2.5 rounded-2xl ${
                type === 'in'
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : type === 'out'
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                  : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400'
              }`}
            >
              {type === 'in' && <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />}
              {type === 'out' && <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />}
              {type === 'adjustment' && <Sliders className="w-5 h-5 stroke-[2.5]" />}
            </div>
            <div>
              <h3 className="text-base font-black text-[#14213D] dark:text-white">
                {type === 'in'
                  ? 'Entrée en stock'
                  : type === 'out'
                  ? 'Sortie de stock'
                  : 'Ajustement de stock'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                {type === 'out'
                  ? 'Sorties autorisées : Vente, Don, Article défectueux, Perte'
                  : 'Mise à jour en temps réel des quantités disponibles'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Type selector (Entrée, Sortie, Ajustement) */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F4F6F8] dark:bg-slate-800/80 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setType('in');
                setReason('purchase');
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                type === 'in'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-[#64748B] dark:text-slate-400 hover:text-[#14213D]'
              }`}
            >
              + Entrée
            </button>
            <button
              type="button"
              onClick={() => {
                setType('out');
                setReason('sale');
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                type === 'out'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-[#64748B] dark:text-slate-400 hover:text-[#14213D]'
              }`}
            >
              - Sortie
            </button>
            <button
              type="button"
              onClick={() => {
                setType('adjustment');
                setReason('correction');
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                type === 'adjustment'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-[#64748B] dark:text-slate-400 hover:text-[#14213D]'
              }`}
            >
              Ajustement
            </button>
          </div>

          {/* Produit */}
          <div>
            <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1.5">
              Sélectionner le produit *
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              required
            >
              {state.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock actuel : {p.stockQuantity} {p.unit})
                </option>
              ))}
            </select>

            {type === 'in' && waitingClients.length > 0 && (
              <div className="mt-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <BellRing className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>{waitingClients.length} client(s)</strong> attendent ce produit en réassort !
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRestockDrawer(true)}
                  className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-xs"
                >
                  Voir clients
                </button>
              </div>
            )}
          </div>

          {/* Motif du mouvement : pour sortie, UNIQUEMENT Vente, Don, Article défectueux, Perte */}
          <div>
            <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1.5">
              Motif du mouvement *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as StockMovementReason)}
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
            >
              {type === 'out' && (
                <>
                  <option value="sale">Vente</option>
                  <option value="donation">Don</option>
                  <option value="defective">Article défectueux</option>
                  <option value="loss">Perte</option>
                </>
              )}
              {type === 'in' && (
                <>
                  <option value="purchase">Entrée / Approvisionnement</option>
                  <option value="customer_return">Retour client</option>
                  <option value="correction">Correction / Inventaire</option>
                  <option value="other">Autre entrée</option>
                </>
              )}
              {type === 'adjustment' && (
                <>
                  <option value="correction">Inventaire physique</option>
                  <option value="other">Autre ajustement</option>
                </>
              )}
            </select>

            {type === 'out' && reason !== 'sale' && (
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/40 text-orange-800 dark:text-orange-300 text-xs">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" />
                <span>
                  Ce motif (<strong>{reason === 'donation' ? 'Don' : reason === 'defective' ? 'Article défectueux' : 'Perte'}</strong>) met à jour le stock immédiatement sans générer de facture commerciale.
                </span>
              </div>
            )}
          </div>

          {/* Date & Quantité */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date du mouvement *</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1.5">
                {type === 'adjustment' ? 'Nouveau stock exact *' : 'Quantité *'}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-black text-[#14213D] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>
          </div>

          {/* Stock avant / après preview */}
          <div className="p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider block">
                Stock avant
              </span>
              <span className="text-sm font-mono font-bold text-[#14213D] dark:text-white">
                {prevStock} {selectedProduct?.unit || ''}
              </span>
            </div>

            <div className="text-center font-mono font-black text-sm text-slate-400">
              {type === 'in' ? `+${numQty}` : type === 'out' ? `-${numQty}` : '→'}
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider block">
                Stock après
              </span>
              <span
                className={`text-base font-mono font-black ${
                  resultingStock < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {resultingStock} {selectedProduct?.unit || ''}
              </span>
            </div>
          </div>

          {/* Référence & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#64748B] dark:text-slate-400 mb-1.5">
                Réf / N° Bon / Pièce (optionnel)
              </label>
              <input
                type="text"
                placeholder="Ex: BON-SORTIE-04, FAC-1002..."
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#64748B] dark:text-slate-400 mb-1.5">
                Remarque / Précision (optionnel)
              </label>
              <input
                type="text"
                placeholder="Ex: Don école, connecteur cassé..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Opérateur / Utilisateur responsable */}
          <div>
            <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Opérateur / Utilisateur responsable *</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Responsable Stock, Caissier..."
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8EDF2] dark:border-[#22304E]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-[#64748B] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-3 text-xs sm:text-sm font-extrabold text-white rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50 cursor-pointer ${
                type === 'in'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  : type === 'out'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
              }`}
            >
              {isSubmitting
                ? 'Enregistrement...'
                : type === 'in'
                ? 'Valider l\'entrée'
                : type === 'out'
                ? 'Valider la sortie'
                : 'Valider l\'ajustement'}
            </button>
          </div>
        </form>
      </div>

      {/* Restock Requests Drawer */}
      {showRestockDrawer && (
        <RestockRequestsDrawer
          isOpen={showRestockDrawer}
          onClose={() => {
            setShowRestockDrawer(false);
            onClose();
          }}
          defaultProductId={productId}
        />
      )}
    </div>
  );
};
