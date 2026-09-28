import React, { useState } from 'react';
import { Lock, Delete } from 'lucide-react';
import { useApp } from '../../store/AppContext';

export const PinLockModal: React.FC = () => {
  const { state, unlockWithPin } = useApp();
  const [enteredPin, setEnteredPin] = useState('');
  const [hasError, setHasError] = useState(false);

  if (!state.isLocked) return null;

  const handleDigit = (digit: string) => {
    if (enteredPin.length >= 6) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    setHasError(false);

    // Auto submit if matches length of set PIN
    const targetLength = state.settings.pinCode?.length || 4;
    if (nextPin.length === targetLength) {
      const ok = unlockWithPin(nextPin);
      if (!ok) {
        setHasError(true);
        setTimeout(() => setEnteredPin(''), 400);
      }
    }
  };

  const handleDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setHasError(false);
  };

  const targetLength = state.settings.pinCode?.length || 4;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white p-6 select-none">
      <div className="w-full max-w-xs flex flex-col items-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
          <Lock className="w-8 h-8" />
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold tracking-tight">StockFacture Pro</h2>
          <p className="text-xs text-slate-400">Entrez votre code secret pour déverrouiller</p>
        </div>

        {/* PIN dots */}
        <div className="flex items-center gap-3 my-2">
          {Array.from({ length: targetLength }).map((_, idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                idx < enteredPin.length
                  ? hasError
                    ? 'bg-rose-500 scale-110'
                    : 'bg-indigo-400 scale-110'
                  : 'border-2 border-slate-600 bg-transparent'
              }`}
            />
          ))}
        </div>

        {hasError && (
          <p className="text-xs font-semibold text-rose-400 animate-shake">
            Code PIN incorrect. Veuillez réessayer.
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-16 rounded-2xl bg-slate-800 hover:bg-slate-700/80 active:bg-indigo-600 active:scale-95 text-xl font-bold transition-all flex items-center justify-center border border-slate-700/60"
            >
              {digit}
            </button>
          ))}
          <div className="h-16" />
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-slate-800 hover:bg-slate-700/80 active:bg-indigo-600 active:scale-95 text-xl font-bold transition-all flex items-center justify-center border border-slate-700/60"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-slate-800 hover:bg-slate-700/80 active:bg-slate-700 active:scale-95 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-slate-700/60"
            aria-label="Effacer"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
