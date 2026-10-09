import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ScanBarcode,
  Sparkles,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Users,
  CheckCircle,
  FileText,
  Share2,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  Phone,
  Banknote,
  Smartphone,
  CreditCard,
  X,
  AlertCircle,
  ShieldCheck,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useToast } from '../store/ToastContext';
import { CartItem, Invoice, PaymentMethod, Product } from '../types';
import { formatCurrency, formatDate, getTodayDateString } from '../utils/formatters';
import {
  calculateLineTotal,
  calculateSubtotal,
  calculateDiscountTotal,
  calculateTax,
  calculateInvoiceTotal,
} from '../utils/calculations';
import { FreeLineModal } from '../components/modals/FreeLineModal';
import { BarcodeScannerModal } from '../components/modals/BarcodeScannerModal';
import { ThermalReceiptModal } from '../components/modals/ThermalReceiptModal';
import { SaleReturnModal } from '../components/modals/SaleReturnModal';
import { ProductThumbnail } from '../components/common/ProductThumbnail';
import { pickContactNative, isContactPickerSupported } from '../services/contactPicker';
import { generateInvoicePdf } from '../pdf/documentPdf';

export const SalePage: React.FC = () => {
  const { state, createSale, navigate, selectedItemId } = useApp();
  const toast = useToast();
  const { currency, currencyPosition, vatEnabled, vatRate, allowNegativeStock } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals
  const [showFreeLineModal, setShowFreeLineModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showThermalModal, setShowThermalModal] = useState(false);
  const [returnInvoice, setReturnInvoice] = useState<Invoice | null>(null);
  const [showSelectInvoiceForReturnModal, setShowSelectInvoiceForReturnModal] = useState<boolean>(false);
  const [returnSearchQuery, setReturnSearchQuery] = useState<string>('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Checkout info
  const [clientType, setClientType] = useState<'walk_in' | 'existing' | 'new' | 'manual'>('walk_in');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientTaxId, setNewClientTaxId] = useState('');
  const [saveNewClientToDb, setSaveNewClientToDb] = useState(true);

  // If navigated to SalePage with a specific client ID, pre-select them
  useEffect(() => {
    if (selectedItemId) {
      const found = state.clients.find((c) => c.id === selectedItemId);
      if (found) {
        setClientType('existing');
        setSelectedClientId(found.id);
      }
    } else if (clientType === 'existing' && !selectedClientId && state.clients.length > 0) {
      setSelectedClientId(state.clients[0].id);
    }
  }, [selectedItemId, clientType, selectedClientId, state.clients]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState<string>(getTodayDateString());

  // Result state
  const [completedInvoice, setCompletedInvoice] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtered products (by name, SKU, barcode, or category name)
  const filteredProducts = useMemo(() => {
    return state.products.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;

      const categoryObj = state.categories.find((c) => c.id === p.categoryId);
      const categoryName = categoryObj ? categoryObj.name.toLowerCase() : '';

      const matchesSearch =
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        categoryName.includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [state.products, state.categories, selectedCategory, searchQuery]);

  // Cart totals
  const subtotal = useMemo(() => calculateSubtotal(cart), [cart]);
  const discountTotal = useMemo(() => calculateDiscountTotal(cart), [cart]);
  const vatAmount = useMemo(
    () => calculateTax(subtotal - discountTotal, vatRate, vatEnabled),
    [subtotal, discountTotal, vatRate, vatEnabled]
  );
  const total = useMemo(
    () => calculateInvoiceTotal(subtotal, discountTotal, vatAmount),
    [subtotal, discountTotal, vatAmount]
  );
  const remaining = Math.max(0, total - (amountPaid || 0));

  // Add catalog product to cart
  const addToCart = (product: Product) => {
    if (!allowNegativeStock && product.stockQuantity <= 0) {
      toast.warning('Rupture de stock', `"${product.name}" n'est plus disponible.`);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      if (existingIndex > -1) {
        const item = prev[existingIndex];
        const nextQty = item.quantity + 1;
        if (!allowNegativeStock && product.stockQuantity < nextQty) {
          toast.warning('Stock insuffisant', `Seulement ${product.stockQuantity} unité(s) disponible(s).`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...item, quantity: nextQty };
        return updated;
      } else {
        const newItem: CartItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          productId: product.id,
          isFreeLine: false,
          designation: product.name,
          reference: product.sku,
          description: product.description,
          quantity: 1,
          unit: product.unit || 'pièce',
          unitPrice: product.sellingPrice,
          purchasePrice: product.purchasePrice,
          discountPercent: 0,
          availableStock: product.stockQuantity,
          imageUrl: product.imageUrl,
        };
        return [...prev, newItem];
      }
    });
  };

  // Add Free Line (Ligne libre)
  const handleAddFreeLine = (item: CartItem) => {
    setCart((prev) => [...prev, item]);
    toast.success('Ligne libre ajoutée', `"${item.designation}" a été ajouté au panier.`);
  };

  // Update Cart Item quantity
  const updateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          if (!it.isFreeLine && !allowNegativeStock && (it.availableStock ?? 999999) < newQty) {
            toast.warning('Stock insuffisant', `Maximum disponible : ${it.availableStock}`);
            return it;
          }
          return { ...it, quantity: newQty };
        }
        return it;
      })
    );
  };

  // Update Cart Item discount %
  const updateDiscount = (itemId: string, discount: number) => {
    const safe = Math.min(100, Math.max(0, discount));
    setCart((prev) => prev.map((it) => (it.id === itemId ? { ...it, discountPercent: safe } : it)));
  };

  // Update Cart Item unit price
  const updateUnitPrice = (itemId: string, newPrice: number) => {
    const safe = Math.max(0, newPrice);
    setCart((prev) => prev.map((it) => (it.id === itemId ? { ...it, unitPrice: safe } : it)));
  };

  // Remove item
  const removeItem = (itemId: string) => {
    setCart((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setIsCartOpen(false);
    setIsCheckoutOpen(false);
    toast.info('Panier vidé', 'Tous les articles ont été retirés.');
  };

  // Contact Picker
  const handlePickNativeContact = async () => {
    const contact = await pickContactNative();
    if (contact) {
      setClientType('new');
      setNewClientName(contact.name);
      setNewClientPhone(contact.phone || '');
      toast.success('Contact importé', `"${contact.name}" a été ajouté.`);
    } else {
      toast.info('Action annulée', 'Le carnet d\'adresses n\'est pas accessible.');
    }
  };

  // Open checkout & initialize full amount
  const handleProceedToCheckout = () => {
    setAmountPaid(total);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  // Validate sale
  const handleConfirmSale = async () => {
    setErrorMessage(null);

    // Resolve client
    let clientData: { id?: string; name: string; phone?: string; address?: string; taxId?: string; saveToDb?: boolean } = {
      name: 'Client de passage',
    };

    if (clientType === 'existing') {
      const c = state.clients.find((cl) => cl.id === selectedClientId);
      if (c) {
        clientData = {
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          taxId: c.taxId,
        };
      } else {
        setErrorMessage('Veuillez sélectionner un client dans la liste.');
        toast.warning('Client requis', 'Veuillez sélectionner un client.');
        return;
      }
    } else if (clientType === 'new') {
      if (!newClientName.trim()) {
        setErrorMessage('Veuillez saisir le nom du nouveau client.');
        toast.warning('Nom obligatoire', 'Veuillez saisir le nom du nouveau client.');
        return;
      }
      clientData = {
        name: newClientName.trim(),
        phone: newClientPhone.trim(),
        address: newClientAddress.trim(),
        taxId: newClientTaxId.trim(),
        saveToDb: saveNewClientToDb,
      };
    } else if (clientType === 'manual') {
      if (!newClientName.trim()) {
        setErrorMessage('Veuillez saisir le nom du client.');
        toast.warning('Nom obligatoire', 'Veuillez saisir le nom du client.');
        return;
      }
      clientData = {
        name: newClientName.trim(),
        phone: newClientPhone.trim() || undefined,
        address: newClientAddress.trim() || undefined,
        taxId: newClientTaxId.trim() || undefined,
        saveToDb: false,
      };
    }

    const res = await createSale({
      items: cart,
      client: clientData,
      paymentMethod,
      amountPaid: amountPaid || 0,
      notes,
      dueDate,
    });

    if (res.success && res.invoice) {
      setCompletedInvoice(res.invoice);
      setIsCheckoutOpen(false);
      setCart([]);
      toast.success('Vente enregistrée', `Facture ${res.invoice.number} créée avec succès.`);
    } else {
      const errMsg = res.error || 'Erreur lors de la validation de la vente.';
      setErrorMessage(errMsg);
      toast.error('Erreur', errMsg);
    }
  };

  // Start another sale
  const handleNewSaleReset = () => {
    setCompletedInvoice(null);
    setCart([]);
    setAmountPaid(0);
    setNotes('');
    setClientType('walk_in');
    setNewClientName('');
    setNewClientPhone('');
    setNewClientAddress('');
    setNewClientTaxId('');
  };

  // If sale was just completed, show Success Screen (garanti 100% visible sans jamais être caché sous la navigation)
  if (completedInvoice) {
    return (
      <div className="max-w-md mx-auto space-y-4 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+36px)] md:pb-8 animate-in zoom-in-95 duration-200">
        <div className="p-6 sm:p-8 bg-white dark:bg-[#131B2E] rounded-[28px] shadow-2xl border border-[#E8EDF2] dark:border-[#22304E] text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-[#E7F8F1] dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border-2 border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="w-9 h-9" />
          </div>

          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold mb-2">
              ✓ Vente enregistrée
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#14213D] dark:text-white">
              Facture <span className="text-orange-600 dark:text-orange-400 font-mono">#{completedInvoice.number}</span>
            </h2>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
              Client : <strong className="text-[#14213D] dark:text-white">{completedInvoice.clientName}</strong>
            </p>
          </div>

          {/* 3 Tiles : Total, Payé, Reste */}
          <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60">
            <div className="text-left">
              <div className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">Total</div>
              <div className="text-xs sm:text-sm font-black font-financial text-[#14213D] dark:text-white truncate">
                {curr(completedInvoice.total)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Payé</div>
              <div className="text-xs sm:text-sm font-black font-financial text-emerald-600 dark:text-emerald-400 truncate">
                {curr(completedInvoice.amountPaid)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Reste</div>
              <div className="text-xs sm:text-sm font-black font-financial text-rose-600 dark:text-rose-400 truncate">
                {curr(completedInvoice.remainingAmount)}
              </div>
            </div>
          </div>

          {/* Action Buttons : Nouvelle vente, Voir la facture, Retour aux ventes */}
          <div className="space-y-2.5 pt-1">
            {/* Primary Action : NOUVELLE VENTE */}
            <button
              type="button"
              onClick={handleNewSaleReset}
              className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-orange-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>Nouvelle vente</span>
            </button>

            {/* Action Ticket de Caisse Thermique (58 mm / 80 mm) */}
            <button
              type="button"
              onClick={() => setShowThermalModal(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#14213D] hover:bg-[#26354F] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4 text-orange-400" />
              <span>Imprimer Ticket de Caisse (58 / 80 mm)</span>
            </button>

            {/* Action Retour / Échange */}
            <button
              type="button"
              onClick={() => setReturnInvoice(completedInvoice)}
              className="w-full py-3 px-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 border border-indigo-200/80 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-indigo-600" />
              <span>Retour / Échange sur cette vente</span>
            </button>

            {/* Secondary Actions : Voir la facture (PDF) & Partager */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => generateInvoicePdf(completedInvoice, state.settings, state.payments, 'download')}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-[#14213D] hover:bg-[#26354F] text-white text-xs font-bold transition-all active:scale-95 shadow-xs"
              >
                <FileText className="w-4 h-4" />
                <span>Voir la facture</span>
              </button>

              <button
                type="button"
                onClick={() => generateInvoicePdf(completedInvoice, state.settings, state.payments, 'share')}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border border-[#E8EDF2] dark:border-slate-700 text-[#14213D] dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>Partager</span>
              </button>
            </div>

            {/* Tertiary Action : Retour aux ventes */}
            <button
              type="button"
              onClick={() => navigate('invoices', completedInvoice.id)}
              className="w-full py-2.5 rounded-xl text-[#64748B] hover:text-[#14213D] dark:text-slate-400 dark:hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Retour aux ventes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Thermal Receipt Modal */}
        <ThermalReceiptModal
          isOpen={showThermalModal}
          onClose={() => setShowThermalModal(false)}
          invoice={completedInvoice}
        />

        {/* Sale Return Modal on Completed Sale */}
        {returnInvoice && (
          <SaleReturnModal
            isOpen={Boolean(returnInvoice)}
            onClose={() => setReturnInvoice(null)}
            invoice={returnInvoice}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+120px)] md:pb-8">
      {/* 0. Header : ← Nouvelle vente */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('invoices')}
          className="inline-flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#14213D] dark:text-white hover:text-orange-600 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 text-[#64748B] group-hover:text-orange-600 transition-colors" />
          <span>Nouvelle vente</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Retour / Avoir button */}
          <button
            type="button"
            onClick={() => setShowSelectInvoiceForReturnModal(true)}
            className="flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/80 text-xs font-bold transition-all active:scale-95 whitespace-nowrap shadow-xs cursor-pointer"
            title="Enregistrer un retour d'articles, avoir client ou échange"
          >
            <RotateCcw className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Retour / Avoir</span>
            <span className="sm:hidden">Retour</span>
          </button>

          {/* Barcode scanner button */}
          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-2xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] text-[#14213D] dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-xs whitespace-nowrap"
            title="Scanner code-barres"
          >
            <ScanBarcode className="w-4 h-4 text-orange-500" />
            <span className="hidden sm:inline">Scanner</span>
          </button>

          {/* Ligne libre button */}
          <button
            type="button"
            onClick={() => setShowFreeLineModal(true)}
            className="flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-2xl bg-[#FFF2DF] text-[#D97706] border border-[#FFE4BF] text-xs font-bold hover:bg-[#FFE4BF] transition-all active:scale-95 whitespace-nowrap shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
            <span>+ Ligne libre</span>
          </button>
        </div>
      </div>

      {/* 1. Zone de recherche produit très visible */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="🔍 Rechercher un produit..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-12 pl-12 pr-10 rounded-2xl border border-[#E8EDF2] dark:border-[#22304E] bg-white dark:bg-[#131B2E] text-sm text-[#14213D] dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500 shadow-xs transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Filtres de catégories */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedCategory === 'all'
              ? 'bg-[#14213D] text-white shadow-xs'
              : 'bg-white dark:bg-[#131B2E] text-[#64748B] dark:text-slate-400 border border-[#E8EDF2] dark:border-[#22304E] hover:bg-slate-50'
          }`}
        >
          Tous les articles ({state.products.length})
        </button>

        {state.categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-white dark:bg-[#131B2E] text-[#64748B] dark:text-slate-400 border border-[#E8EDF2] dark:border-[#22304E] hover:bg-slate-50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 3. Grille des produits compacts */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-[24px] bg-white dark:bg-[#131B2E] border border-dashed border-[#E8EDF2] dark:border-[#22304E] space-y-3">
          <p className="text-sm font-semibold text-[#14213D] dark:text-slate-300">
            Aucun produit ne correspond à votre recherche.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowFreeLineModal(true)}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs"
            >
              + Ajouter une ligne libre
            </button>
            <button
              type="button"
              onClick={() => navigate('products')}
              className="px-4 py-2 rounded-xl border border-[#E8EDF2] dark:border-slate-700 text-xs font-bold hover:bg-slate-50 text-[#14213D] dark:text-slate-300"
            >
              Créer un produit dans le catalogue
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map((p) => {
            const isOutOfStock = p.stockQuantity <= 0;
            const inCart = cart.find((it) => it.productId === p.id);

            return (
              <div
                key={p.id}
                onClick={() => addToCart(p)}
                className={`p-3.5 rounded-[22px] border transition-all active:scale-[0.98] cursor-pointer select-none relative flex items-center gap-3.5 bg-white dark:bg-[#131B2E] border-[#E8EDF2] dark:border-[#22304E] shadow-[0_2px_8px_-2px_rgba(20,33,61,0.04)] hover:border-orange-300 dark:hover:border-orange-600 ${
                  inCart
                    ? 'ring-2 ring-orange-500 bg-orange-50/30 dark:bg-orange-950/20'
                    : isOutOfStock && !allowNegativeStock
                    ? 'opacity-60 bg-slate-50 dark:bg-slate-900/60'
                    : ''
                }`}
              >
                {/* Photo / Thumbnail */}
                <div className="relative shrink-0">
                  <ProductThumbnail
                    imageUrl={p.imageUrl}
                    name={p.name}
                    categoryColor={state.categories.find((c) => c.id === p.categoryId)?.color}
                    size="lg"
                    roundedClassName="rounded-2xl"
                  />
                  {inCart && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-mono font-bold flex items-center justify-center shadow-md ring-2 ring-white dark:ring-[#131B2E]">
                      {inCart.quantity}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-extrabold text-[#14213D] dark:text-white truncate leading-tight">
                    {p.name}
                  </h4>

                  <div className="text-[11px] font-mono text-[#64748B] dark:text-slate-400 truncate mt-0.5">
                    {p.sku ? `SKU: ${p.sku}` : (p.barcode ? `Réf: ${p.barcode}` : 'Sans SKU')}
                  </div>

                  <div className="text-sm font-black font-financial text-[#14213D] dark:text-white mt-1">
                    {curr(p.sellingPrice)}
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span
                      className={`text-[11px] font-bold ${
                        p.stockQuantity <= 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : p.stockQuantity <= p.minStockAlert
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      Stock : {p.stockQuantity} {p.unit || ''}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(p);
                      }}
                      className="w-8 h-8 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center font-black text-sm shadow-xs shadow-orange-500/20 transition-transform active:scale-90"
                      title="Ajouter au panier"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Bottom Sticky Cart Action Bar (Docked securely ABOVE the bottom navigation) */}
      {cart.length > 0 && (
        <div
          className="fixed left-0 right-0 p-3 sm:p-4 z-40 max-w-xl mx-auto transition-all"
          style={{
            bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 8px)',
          }}
        >
          <div className="p-3.5 rounded-2xl bg-[#14213D] text-white shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 border border-slate-700/60 animate-in slide-in-from-bottom duration-200">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-3 text-left min-w-0"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center relative shrink-0 shadow-md shadow-orange-500/30">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-[10px] font-mono font-bold flex items-center justify-center ring-2 ring-[#14213D]">
                  {cart.reduce((s, it) => s + it.quantity, 0)}
                </span>
              </div>
              <div className="truncate">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Total ({cart.reduce((s, it) => s + it.quantity, 0)} art.)
                </div>
                <div className="text-base sm:text-lg font-black font-financial text-white leading-tight truncate">
                  {curr(total)}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
              >
                Panier
              </button>
              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-black tracking-wide shadow-md shadow-orange-500/30 transition-transform active:scale-95"
              >
                <span>ENCAISSER</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Cart Drawer (Full details, steppers, direct input, discounts) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl mx-auto bg-white dark:bg-[#131B2E] rounded-t-[28px] border-t border-[#E8EDF2] dark:border-[#22304E] p-5 space-y-4 max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E8EDF2] dark:border-[#22304E]">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-orange-500" />
                <h3 className="text-base font-extrabold text-[#14213D] dark:text-white">
                  Panier ({cart.reduce((s, it) => s + it.quantity, 0)} articles)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFreeLineModal(true)}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-lg"
                >
                  + Ligne libre
                </button>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ProductThumbnail
                        imageUrl={item.imageUrl}
                        name={item.designation}
                        size="sm"
                        roundedClassName="rounded-xl"
                      />
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-extrabold text-[#14213D] dark:text-white leading-tight truncate">
                          {item.designation}
                        </div>
                        {item.isFreeLine ? (
                          <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold bg-[#F1EDFF] dark:bg-purple-950/40 px-1.5 py-0.5 rounded-md mt-1 inline-block border border-purple-200/60">
                            Ligne libre
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#64748B] dark:text-slate-400 font-mono">
                            {item.reference || 'Article catalogue'}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                      title="Supprimer la ligne"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E8EDF2] dark:border-slate-700/40">
                    {/* Stepper avec saisie directe de quantité */}
                    <div className="flex items-center gap-1 bg-white dark:bg-[#131B2E] rounded-xl p-1 border border-[#E8EDF2] dark:border-[#22304E] shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#26354F] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) updateQuantity(item.id, val);
                        }}
                        className="w-12 h-7 text-center font-mono font-black text-xs text-[#14213D] dark:text-white bg-transparent border-0 focus:outline-hidden focus:ring-1 focus:ring-orange-500 rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#26354F] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Remise par ligne */}
                    <div className="flex items-center gap-1 bg-white dark:bg-[#131B2E] px-2 py-1 rounded-xl border border-[#E8EDF2] dark:border-[#22304E] text-xs">
                      <span className="text-[10px] text-[#64748B] font-semibold">Remise :</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discountPercent || ''}
                        placeholder="0"
                        onChange={(e) => updateDiscount(item.id, parseFloat(e.target.value) || 0)}
                        className="w-9 text-right font-mono font-bold text-xs bg-transparent border-0 text-[#14213D] dark:text-white focus:outline-hidden"
                      />
                      <span className="text-[10px] text-[#64748B]">%</span>
                    </div>

                    {/* Prix unitaire & Total de ligne */}
                    <div className="text-right">
                      <div className="text-[11px] text-[#64748B] dark:text-slate-400 font-mono">
                        {item.quantity} x {curr(item.unitPrice)}
                      </div>
                      <div className="text-sm font-black font-financial text-[#14213D] dark:text-white">
                        {curr(calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions dans le panier : + Ligne libre & Vider */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowFreeLineModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFF2DF] text-[#D97706] hover:bg-[#FFE4BF] text-xs font-bold border border-[#FFE4BF] transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ajouter une ligne libre</span>
              </button>

              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-rose-500 font-semibold hover:underline"
              >
                Vider le panier
              </button>
            </div>

            {/* Synthèse financière */}
            <div className="p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800 text-xs space-y-1.5 border border-[#E8EDF2] dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Sous-total :</span>
                <span className="font-mono font-semibold text-[#14213D] dark:text-white">{curr(subtotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Remises appliquées :</span>
                  <span className="font-mono">- {curr(discountTotal)}</span>
                </div>
              )}
              {vatAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">TVA ({vatRate}%) :</span>
                  <span className="font-mono font-semibold text-[#14213D] dark:text-white">{curr(vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-[#E8EDF2] dark:border-slate-700 text-sm font-black text-[#14213D] dark:text-white">
                <span>TOTAL :</span>
                <span className="font-mono font-financial text-orange-600 dark:text-orange-400 text-base">
                  {curr(total)}
                </span>
              </div>
            </div>

            {/* Bouton Encaisser (fixé avec marge de sécurité mobile) */}
            <div
              className="pt-2 sticky bottom-0 bg-white dark:bg-[#131B2E]"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
            >
              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Passer au règlement ({curr(total)})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Checkout Drawer (Client selection, payment mode, amount paid) */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl mx-auto bg-white dark:bg-[#131B2E] rounded-t-[28px] border-t border-[#E8EDF2] dark:border-[#22304E] p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E8EDF2] dark:border-[#22304E]">
              <h3 className="text-base font-extrabold text-[#14213D] dark:text-white">
                Règlement de la vente
              </h3>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Total Highlight */}
            <div className="p-4 rounded-2xl bg-[#14213D] text-white flex items-center justify-between shadow-md">
              <div>
                <span className="text-xs text-slate-300 uppercase tracking-wider font-semibold">Total à encaisser</span>
                <div className="text-2xl font-mono font-extrabold text-white">
                  {curr(total)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-300 font-semibold">Reste après versement</span>
                <div className={`text-base font-mono font-bold ${remaining > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {curr(remaining)}
                </div>
              </div>
            </div>

            {/* Client Selection Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#14213D] dark:text-slate-300 block">
                Client pour la facture
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setClientType('walk_in')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    clientType === 'walk_in'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shadow-xs ring-1 ring-orange-500'
                      : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
                  }`}
                >
                  Client comptant
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('existing')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    clientType === 'existing'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shadow-xs ring-1 ring-orange-500'
                      : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
                  }`}
                >
                  Client existant
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('new')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    clientType === 'new'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shadow-xs ring-1 ring-orange-500'
                      : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
                  }`}
                >
                  Nouveau client
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('manual')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    clientType === 'manual'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shadow-xs ring-1 ring-orange-500'
                      : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
                  }`}
                >
                  Client manuel
                </button>
              </div>

              {/* Existing Client dropdown */}
              {clientType === 'existing' && (
                <div className="pt-2">
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Sélectionner un client dans la liste...</option>
                    {state.clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Manual Client Form (Direct on invoice, not saved to client directory) */}
              {clientType === 'manual' && (
                <div className="space-y-2.5 p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60 animate-in fade-in">
                  <div className="text-xs font-bold text-[#14213D] dark:text-slate-300">
                    Saisie manuelle du client (sur cette facture uniquement)
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Nom du client *"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:ring-1 focus:ring-orange-500"
                  />
                  <input
                    type="tel"
                    placeholder="Téléphone (optionnel)"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              )}

              {/* New Client Form */}
              {clientType === 'new' && (
                <div className="space-y-2.5 p-3.5 rounded-2xl bg-[#FAFAF8] dark:bg-slate-800/60 border border-[#E8EDF2] dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#14213D] dark:text-slate-300">
                      Coordonnées du client
                    </span>
                    <button
                      type="button"
                      onClick={handlePickNativeContact}
                      className="flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Importer contact</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Nom ou Raison Sociale *"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:ring-1 focus:ring-orange-500"
                  />
                  <input
                    type="tel"
                    placeholder="Numéro de téléphone"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:ring-1 focus:ring-orange-500"
                  />
                  <input
                    type="text"
                    placeholder="Adresse (optionnelle)"
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#14213D] dark:text-white focus:ring-1 focus:ring-orange-500"
                  />
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveNewClientToDb}
                      onChange={(e) => setSaveNewClientToDb(e.target.checked)}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 border-slate-300"
                    />
                    <span className="text-xs text-[#26354F] dark:text-slate-300">
                      Enregistrer ce client dans ma base clients
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#14213D] dark:text-slate-300 block">
                Mode de paiement
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash', label: 'Espèces', icon: Banknote },
                  { id: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
                  { id: 'bank_transfer', label: 'Virement', icon: CreditCard },
                  { id: 'card', label: 'Carte', icon: CreditCard },
                  { id: 'check', label: 'Chèque', icon: CreditCard },
                  { id: 'other', label: 'Autre', icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shadow-xs ring-1 ring-orange-500'
                          : 'border-[#E8EDF2] dark:border-slate-700 text-[#64748B] hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="truncate w-full text-center">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount Paid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#14213D] dark:text-slate-300">
                  Montant encaissé aujourd'hui
                </label>
                <button
                  type="button"
                  onClick={() => setAmountPaid(total)}
                  className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
                >
                  Payé en totalité ({curr(total)})
                </button>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amountPaid || ''}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  className="w-full h-12 px-4 rounded-xl border border-[#E8EDF2] dark:border-slate-700 bg-white dark:bg-slate-800 text-lg font-mono font-bold text-[#14213D] dark:text-white focus:ring-2 focus:ring-orange-500"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {currency}
                </div>
              </div>

              {/* Quick Cash Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => setAmountPaid(total)}
                  className="px-2.5 py-1.5 rounded-xl font-bold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 whitespace-nowrap"
                >
                  Exact ({curr(total)})
                </button>
                {[500, 1000, 2000, 5000, 10000, 20000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountPaid(preset)}
                    className="px-2.5 py-1.5 rounded-xl font-bold bg-[#FAFAF8] dark:bg-slate-800 text-[#26354F] dark:text-slate-300 hover:bg-slate-200 border border-[#E8EDF2] dark:border-slate-700 whitespace-nowrap"
                  >
                    {preset.toLocaleString('fr-FR')} {currency}
                  </button>
                ))}
              </div>

              {/* Change or Remainder Display */}
              {amountPaid > total ? (
                <div className="p-3 rounded-2xl bg-[#E7F8F1] dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💰</span>
                    <div>
                      <span className="text-xs font-bold block">Monnaie à rendre au client</span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        Reçu {curr(amountPaid)} pour un total de {curr(total)}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-black text-lg text-emerald-700 dark:text-emerald-400">
                    {curr(amountPaid - total)}
                  </span>
                </div>
              ) : amountPaid === total && total > 0 ? (
                <div className="p-2.5 rounded-xl bg-[#FAFAF8] dark:bg-slate-800 text-[#26354F] dark:text-slate-300 text-xs font-bold flex items-center justify-between border border-[#E8EDF2] dark:border-slate-700">
                  <span>Règlement intégral</span>
                  <span className="text-emerald-600 dark:text-emerald-400">✅ Aucun reliquat</span>
                </div>
              ) : null}
            </div>

            {/* Due date if remainder */}
            {remaining > 0 && (
              <div className="p-3 rounded-2xl bg-[#FFF2DF] dark:bg-amber-950/40 border border-[#FFE4BF] dark:border-amber-900 space-y-1.5">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 block">
                  Date d'échéance du reliquat ({curr(remaining)})
                </span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs text-[#14213D] dark:text-white focus:ring-1 focus:ring-orange-500"
                />
              </div>
            )}

            {/* Confirm Sale Button */}
            <div
              className="pt-2 sticky bottom-0 bg-white dark:bg-[#131B2E]"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
            >
              <button
                type="button"
                onClick={handleConfirmSale}
                className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-orange-500/30 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Valider la vente ({curr(total)})</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Free Line Modal */}
      <FreeLineModal
        isOpen={showFreeLineModal}
        onClose={() => setShowFreeLineModal(false)}
        onAddLine={handleAddFreeLine}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onSelectProduct={addToCart}
      />

      {/* Sale Return Modal */}
      {returnInvoice && (
        <SaleReturnModal
          isOpen={Boolean(returnInvoice)}
          onClose={() => setReturnInvoice(null)}
          invoice={returnInvoice}
        />
      )}

      {/* Invoice Selector Modal for initiating return from Sale page */}
      {showSelectInvoiceForReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#131B2E] rounded-3xl shadow-2xl border border-[#E8EDF2] dark:border-[#22304E] flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-[#E8EDF2] dark:border-[#22304E] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#14213D] dark:text-white">
                    Gérer un retour ou avoir
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Sélectionnez la vente ou le ticket concerné par le retour
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSelectInvoiceForReturnModal(false);
                  setReturnSearchQuery('');
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-[#E8EDF2] dark:border-[#22304E]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par n° de facture, client, téléphone..."
                  value={returnSearchQuery}
                  onChange={(e) => setReturnSearchQuery(e.target.value)}
                  className="w-full h-10 pl-10 pr-8 rounded-xl border border-[#E8EDF2] dark:border-[#22304E] bg-white dark:bg-slate-900 text-xs text-[#14213D] dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
                {returnSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setReturnSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {state.invoices
                .filter((inv) => {
                  if (inv.status === 'cancelled') return false;
                  const q = returnSearchQuery.toLowerCase().trim();
                  if (!q) return true;
                  return (
                    inv.number.toLowerCase().includes(q) ||
                    inv.clientName.toLowerCase().includes(q) ||
                    (inv.clientPhone && inv.clientPhone.toLowerCase().includes(q))
                  );
                })
                .slice(0, 30)
                .map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      setReturnInvoice(inv);
                      setShowSelectInvoiceForReturnModal(false);
                      setReturnSearchQuery('');
                    }}
                    className="p-3 rounded-2xl border border-[#E8EDF2] dark:border-[#22304E] hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-[#131B2E] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400 group-hover:underline">
                          #{inv.number}
                        </span>
                        <span className="text-xs font-bold text-[#14213D] dark:text-white">
                          {inv.clientName}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                        {formatDate(inv.date)} • {inv.items.length} article(s) • Total : <strong>{curr(inv.total)}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 group-hover:bg-orange-500 group-hover:text-white text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:group-hover:bg-orange-500 text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      Retourner
                    </button>
                  </div>
                ))}

              {state.invoices.filter((inv) => inv.status !== 'cancelled').length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  Aucune vente enregistrée pour le moment.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};