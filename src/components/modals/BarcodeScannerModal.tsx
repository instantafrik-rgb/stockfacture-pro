import React, { useState } from 'react';
import { X, ScanBarcode, Search } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Product } from '../../types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
}) => {
  const { state } = useApp();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searched, setSearched] = useState(false);
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcodeInput.trim().toLowerCase();
    if (!query) return;

    const prod = state.products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === query) ||
        (p.sku && p.sku.toLowerCase() === query) ||
        p.name.toLowerCase().includes(query)
    );

    setSearched(true);
    setFoundProduct(prod || null);

    if (prod) {
      // Direct fast select
      onSelectProduct(prod);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Scanner / Code-barres
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lecteur rapide de référence ou code produit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visual Simulated Scanner viewfinder */}
        <div className="relative h-36 bg-slate-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center border-2 border-dashed border-indigo-500/40">
          <div className="w-3/4 h-20 border-2 border-indigo-400/80 rounded-lg relative flex items-center justify-center">
            {/* Animated Laser Scan line */}
            <div className="absolute inset-x-0 h-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse" />
            <span className="text-[11px] font-mono text-indigo-300 bg-slate-900/80 px-2 py-0.5 rounded-sm">
              Viser le code-barres
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Entrez le code ou utilisez une douchette USB / Bluetooth
          </p>
        </div>

        {/* Manual code input */}
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="Code-barres ou référence SKU..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full h-12 pl-4 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {searched && !foundProduct && (
            <p className="text-xs text-rose-500 font-medium text-center">
              Aucun produit trouvé avec ce code.
            </p>
          )}

          {/* Quick select sample product chips */}
          <div className="pt-2">
            <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">
              Suggestions rapides du catalogue :
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {state.products.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectProduct(p);
                    onClose();
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 text-slate-700 dark:text-slate-300 font-medium transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
