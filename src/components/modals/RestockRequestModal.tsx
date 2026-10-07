import React, { useState, useEffect } from 'react';
import { X, UserPlus, Package, Calendar, Phone, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { getTodayDateString } from '../../utils/formatters';

interface RestockRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProductId?: string;
  defaultClientId?: string;
}

export const RestockRequestModal: React.FC<RestockRequestModalProps> = ({
  isOpen,
  onClose,
  defaultProductId,
  defaultClientId,
}) => {
  const { state, addRestockRequest, addClient } = useApp();

  const [productId, setProductId] = useState<string>(defaultProductId || '');
  const [clientMode, setClientMode] = useState<'existing' | 'manual'>('existing');
  const [selectedClientId, setSelectedClientId] = useState<string>(defaultClientId || '');
  const [manualClientName, setManualClientName] = useState<string>('');
  const [manualClientPhone, setManualClientPhone] = useState<string>('');
  const [saveClientToDirectory, setSaveClientToDirectory] = useState<boolean>(true);
  const [desiredQuantity, setDesiredQuantity] = useState<number>(1);
  const [requestDate, setRequestDate] = useState<string>(getTodayDateString());
  const [note, setNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (defaultProductId) setProductId(defaultProductId);
    if (defaultClientId) {
      setSelectedClientId(defaultClientId);
      setClientMode('existing');
    } else if (state.clients.length === 0) {
      setClientMode('manual');
    }
    setRequestDate(getTodayDateString());
    setErrorMsg(null);
  }, [defaultProductId, defaultClientId, state.clients, isOpen]);

  if (!isOpen) return null;

  const selectedProduct = state.products.find((p) => p.id === productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedProduct) {
      setErrorMsg('Veuillez sélectionner un article.');
      return;
    }

    if (desiredQuantity <= 0 || isNaN(desiredQuantity)) {
      setErrorMsg('La quantité souhaitée doit être supérieure à zéro.');
      return;
    }

    let finalClientId: string | undefined = undefined;
    let finalClientName = '';
    let finalClientPhone: string | undefined = undefined;

    if (clientMode === 'existing') {
      const foundClient = state.clients.find((c) => c.id === selectedClientId);
      if (!foundClient) {
        setErrorMsg('Veuillez sélectionner un client dans la liste.');
        return;
      }
      finalClientId = foundClient.id;
      finalClientName = foundClient.name;
      finalClientPhone = foundClient.phone;
    } else {
      if (!manualClientName.trim()) {
        setErrorMsg('Veuillez indiquer le nom du client.');
        return;
      }
      finalClientName = manualClientName.trim();
      finalClientPhone = manualClientPhone.trim() || undefined;

      // Optionally save to permanent client directory
      if (saveClientToDirectory) {
        try {
          const newC = await addClient({
            name: finalClientName,
            phone: finalClientPhone,
          });
          finalClientId = newC.id;
        } catch {
          // ignore directory add failure
        }
      }
    }

    setIsSubmitting(true);
    try {
      await addRestockRequest({
        clientId: finalClientId,
        clientName: finalClientName,
        clientPhone: finalClientPhone,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        desiredQuantity: Math.max(1, desiredQuantity),
        requestDate: requestDate || getTodayDateString(),
        note: note.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      console.error('Error saving restock request:', err);
      setErrorMsg(err?.message || 'Erreur lors de l’enregistrement de la demande.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden">
        
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Noter un client à relancer
              </h3>
              <p className="text-xs text-slate-500">
                Alerte de réassort & réservation pour produit en rupture
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Article demandé */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Article en rupture demandé *
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Sélectionner un produit...</option>
              {state.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock actuel : {p.stockQuantity} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Client Mode Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Client intéressé *
              </label>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setClientMode('existing')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    clientMode === 'existing'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Client existant
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode('manual')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    clientMode === 'manual'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Nouveau / Manuel
                </button>
              </div>
            </div>

            {clientMode === 'existing' ? (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                required={clientMode === 'existing'}
              >
                <option value="">Sélectionner un client dans le carnet...</option>
                {state.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <input
                  type="text"
                  placeholder="Nom complet du client *"
                  value={manualClientName}
                  onChange={(e) => setManualClientName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  required={clientMode === 'manual'}
                />
                <input
                  type="tel"
                  placeholder="Téléphone / WhatsApp (ex: +225 07 00 00 00)"
                  value={manualClientPhone}
                  onChange={(e) => setManualClientPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
                <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={saveClientToDirectory}
                    onChange={(e) => setSaveClientToDirectory(e.target.checked)}
                    className="rounded text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                  />
                  <span>Enregistrer aussi ce client dans le répertoire</span>
                </label>
              </div>
            )}
          </div>

          {/* 3. Quantité souhaitée & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Quantité souhaitée *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={desiredQuantity}
                onChange={(e) => setDesiredQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Date de la demande *
              </label>
              <input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>
          </div>

          {/* 4. Note éventuelle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Remarque / Note (optionnel)
            </label>
            <input
              type="text"
              placeholder="Ex : Préfère le modèle noir, prêt à payer d'avance, appeler matin..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer dans la liste des relances'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
