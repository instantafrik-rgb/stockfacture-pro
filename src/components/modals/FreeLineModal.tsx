import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { CartItem } from '../../types';
import { calculateLineTotal } from '../../utils/calculations';
import { useApp } from '../../store/AppContext';
import { formatCurrency } from '../../utils/formatters';

interface FreeLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLine: (item: CartItem) => void;
}

export const FreeLineModal: React.FC<FreeLineModalProps> = ({ isOpen, onClose, onAddLine }) => {
  const { state } = useApp();

  const [designation, setDesignation] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('pièce');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const lineTotal = calculateLineTotal(quantity, unitPrice, discountPercent);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!designation.trim()) {
      setErrorMsg('La désignation est obligatoire.');
      return;
    }

    if (quantity <= 0) {
      setErrorMsg('La quantité doit être strictement supérieure à zéro.');
      return;
    }

    if (unitPrice < 0) {
      setErrorMsg('Le prix unitaire ne peut pas être négatif.');
      return;
    }

    const newItem: CartItem = {
      id: `free-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: undefined,
      isFreeLine: true,
      designation: designation.trim(),
      reference: reference.trim() || undefined,
      description: description.trim() || undefined,
      quantity,
      unit: unit.trim() || 'pièce',
      unitPrice,
      discountPercent,
    };

    onAddLine(newItem);
    // Reset form
    setDesignation('');
    setReference('');
    setDescription('');
    setQuantity(1);
    setUnitPrice(0);
    setDiscountPercent(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#131B2E] rounded-[28px] shadow-2xl border border-[#E8EDF2] dark:border-[#22304E] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#E8EDF2] dark:border-[#22304E] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FFF2DF] text-[#D97706] border border-[#FFE4BF]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#14213D] dark:text-white">
                Ajouter une ligne libre
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Article ou prestation hors catalogue (ne touche pas au stock)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900">
              {errorMsg}
            </div>
          )}

          {/* Designation */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Désignation de l'article / service *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Frais de livraison, Main d’œuvre, Article spécial..."
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Reference & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Référence (facultative)
              </label>
              <input
                type="text"
                placeholder="Ex: REF-DIV-01"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Unité
              </label>
              <input
                type="text"
                placeholder="pièce, heure, kg, forfait..."
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Quantity, Price & Discount */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Quantité *
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Prix unitaire *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Remise (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Description complémentaire (facultative)
            </label>
            <input
              type="text"
              placeholder="Détails supplémentaires pour la facture..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Line Total preview */}
          <div className="p-3.5 rounded-2xl bg-[#FFF2DF] dark:bg-orange-950/40 border border-[#FFE4BF] dark:border-orange-900/60 flex items-center justify-between">
            <span className="text-xs font-bold text-orange-950 dark:text-orange-200">
              Total de la ligne :
            </span>
            <span className="text-base font-extrabold text-[#D97706] dark:text-orange-400 font-mono">
              {formatCurrency(lineTotal, state.settings.currency, state.settings.currencyPosition)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-[#64748B] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-extrabold text-white bg-orange-500 hover:bg-orange-600 rounded-xl shadow-md shadow-orange-500/20 transition-transform active:scale-95"
            >
              Ajouter à la vente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
