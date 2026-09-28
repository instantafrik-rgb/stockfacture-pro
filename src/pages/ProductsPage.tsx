import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Edit2,
  Trash2,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  X,
  AlertTriangle,
  Tag,
  Sparkles,
  Barcode,
  Layers,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Product, Category } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { StockMovementModal } from '../components/modals/StockMovementModal';
import { CategoryModal } from '../components/modals/CategoryModal';
import { Phase1TestModal } from '../components/modals/Phase1TestModal';

export const ProductsPage: React.FC = () => {
  const { state, addProduct, updateProduct, deleteProduct, selectedItemId, setSelectedItemId } =
    useApp();
  const { currency, currencyPosition } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'in_stock' | 'low' | 'out'>('all');

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalType, setStockModalType] = useState<'in' | 'out'>('in');
  const [targetProductForStock, setTargetProductForStock] = useState<Product | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPurchasePrice, setFormPurchasePrice] = useState<number>(0);
  const [formSellingPrice, setFormSellingPrice] = useState<number>(0);
  const [formStockQuantity, setFormStockQuantity] = useState<number>(0);
  const [formMinStockAlert, setFormMinStockAlert] = useState<number>(5);
  const [formUnit, setFormUnit] = useState('pièce');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Dynamic Margin Calculation for Form
  const formMargin = formSellingPrice - formPurchasePrice;
  const formMarginPercent =
    formSellingPrice > 0 ? Math.round((formMargin / formSellingPrice) * 100) : 0;
  const isFormLoss = formSellingPrice > 0 && formPurchasePrice > formSellingPrice;

  // Filter products
  const filteredProducts = useMemo(() => {
    return state.products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));

      const matchesCategory = filterCategory === 'all' || p.categoryId === filterCategory;

      let matchesStock = true;
      if (filterStockStatus === 'in_stock') {
        matchesStock = p.stockQuantity > p.minStockAlert;
      } else if (filterStockStatus === 'low') {
        matchesStock = p.stockQuantity > 0 && p.stockQuantity <= p.minStockAlert;
      } else if (filterStockStatus === 'out') {
        matchesStock = p.stockQuantity <= 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [state.products, searchQuery, filterCategory, filterStockStatus]);

  // Catalog Valuation KPIs
  const stats = useMemo(() => {
    const totalRefs = state.products.length;
    const totalUnits = state.products.reduce((acc, p) => acc + Math.max(0, p.stockQuantity), 0);
    const totalCostValue = state.products.reduce(
      (acc, p) => acc + Math.max(0, p.stockQuantity) * (p.purchasePrice || 0),
      0
    );
    const totalSellingValue = state.products.reduce(
      (acc, p) => acc + Math.max(0, p.stockQuantity) * (p.sellingPrice || 0),
      0
    );
    const totalPotentialProfit = totalSellingValue - totalCostValue;
    const lowStockCount = state.products.filter(
      (p) => p.stockQuantity > 0 && p.stockQuantity <= p.minStockAlert
    ).length;
    const outStockCount = state.products.filter((p) => p.stockQuantity <= 0).length;

    return {
      totalRefs,
      totalUnits,
      totalCostValue,
      totalSellingValue,
      totalPotentialProfit,
      lowStockCount,
      outStockCount,
      alertCount: lowStockCount + outStockCount,
    };
  }, [state.products]);

  // Selected product for 360° detail drawer
  const detailProduct = useMemo(() => {
    if (!selectedItemId) return null;
    return state.products.find((p) => p.id === selectedItemId) || null;
  }, [selectedItemId, state.products]);

  // Movements of detail product
  const productMovements = useMemo(() => {
    if (!detailProduct) return [];
    return state.movements.filter((m) => m.productId === detailProduct.id);
  }, [detailProduct, state.movements]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormSku('');
    setFormBarcode('');
    setFormCategoryId(state.categories[0]?.id || '');
    setFormPurchasePrice(0);
    setFormSellingPrice(0);
    setFormStockQuantity(0);
    setFormMinStockAlert(5);
    setFormUnit('pièce');
    setFormDescription('');
    setFormError(null);
    setShowAddEditModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormSku(p.sku || '');
    setFormBarcode(p.barcode || '');
    setFormCategoryId(p.categoryId || state.categories[0]?.id || '');
    setFormPurchasePrice(p.purchasePrice || 0);
    setFormSellingPrice(p.sellingPrice || 0);
    setFormStockQuantity(p.stockQuantity || 0);
    setFormMinStockAlert(p.minStockAlert || 5);
    setFormUnit(p.unit || 'pièce');
    setFormDescription(p.description || '');
    setFormError(null);
    setShowAddEditModal(true);
  };

  const generateRandomSku = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const prefix = formName
      ? formName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PRD')
      : 'PRD';
    setFormSku(`${prefix}-${rand}`);
  };

  const generateRandomBarcode = () => {
    // Generate valid 13-digit EAN style
    let code = '200' + Math.floor(100000000 + Math.random() * 900000000).toString().slice(0, 9);
    setFormBarcode(code);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Le nom du produit est obligatoire.');
      return;
    }

    if (formSellingPrice < 0 || isNaN(formSellingPrice)) {
      setFormError('Le prix de vente doit être supérieur ou égal à zéro.');
      return;
    }

    // Check duplicate SKU
    if (formSku.trim()) {
      const isDuplicate = state.products.some(
        (p) =>
          p.id !== editingProduct?.id &&
          p.sku &&
          p.sku.trim().toLowerCase() === formSku.trim().toLowerCase()
      );
      if (isDuplicate) {
        setFormError(`La référence SKU "${formSku.trim()}" est déjà utilisée par un autre produit.`);
        return;
      }
    }

    if (editingProduct) {
      // Update
      await updateProduct(editingProduct.id, {
        name: formName.trim(),
        sku: formSku.trim() || undefined,
        barcode: formBarcode.trim() || undefined,
        categoryId: formCategoryId || undefined,
        purchasePrice: Math.max(0, formPurchasePrice || 0),
        sellingPrice: Math.max(0, formSellingPrice || 0),
        minStockAlert: Math.max(0, formMinStockAlert || 0),
        unit: formUnit.trim() || 'pièce',
        description: formDescription.trim() || undefined,
      });
    } else {
      // Create new
      await addProduct({
        name: formName.trim(),
        sku: formSku.trim() || undefined,
        barcode: formBarcode.trim() || undefined,
        categoryId: formCategoryId || undefined,
        purchasePrice: Math.max(0, formPurchasePrice || 0),
        sellingPrice: Math.max(0, formSellingPrice || 0),
        stockQuantity: Math.max(0, formStockQuantity || 0),
        minStockAlert: Math.max(0, formMinStockAlert || 5),
        unit: formUnit.trim() || 'pièce',
        description: formDescription.trim() || undefined,
      });
    }

    setShowAddEditModal(false);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      await deleteProduct(productToDelete.id);
      if (selectedItemId === productToDelete.id) {
        setSelectedItemId(null);
      }
      setProductToDelete(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Catalogue Produits & Référentiel
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
              PHASE 1
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Gestion complète des articles, prix de vente, coûts d'achat, marges et alertes de stock
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95 min-h-[44px]"
          >
            <Tag className="w-4 h-4 text-indigo-500" />
            <span>Gérer Catégories</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-transform active:scale-95 min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Produit</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards (Stock Valuation & Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Références</span>
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">
            {stats.totalRefs}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            {stats.totalUnits} unités en stock
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Valeur Achat</span>
            <Layers className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 truncate">
            {curr(stats.totalCostValue)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Coût d'acquisition total
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Potentiel Vente</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {curr(stats.totalSellingValue)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Chiffre d'affaires max
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Bénéfice Prévu</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-1 truncate">
            {curr(stats.totalPotentialProfit)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Marge brute potentielle
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Alertes Stock</span>
            <AlertTriangle className={`w-4 h-4 ${stats.alertCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
          </div>
          <div className={`text-lg sm:text-xl font-black mt-1 ${
            stats.alertCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
          }`}>
            {stats.alertCount}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            {stats.lowStockCount} bas • {stats.outStockCount} rupture
          </div>
        </div>
      </div>

      {/* 3. Search & Filters Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, référence SKU ou code-barres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stock status filter buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setFilterStockStatus('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterStockStatus === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Tous ({state.products.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStockStatus('in_stock')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterStockStatus === 'in_stock'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              En stock
            </button>
            <button
              type="button"
              onClick={() => setFilterStockStatus('low')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterStockStatus === 'low'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Stock faible ({stats.lowStockCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStockStatus('out')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterStockStatus === 'out'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              En rupture ({stats.outStockCount})
            </button>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>Toutes les catégories</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              filterCategory === 'all' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'
            }`}>
              {state.products.length}
            </span>
          </button>

          {state.categories.map((cat: Category) => {
            const count = state.products.filter((p) => p.categoryId === cat.id).length;
            const isSelected = filterCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilterCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: cat.color || '#6366f1' }}
                />
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/20 dark:bg-slate-900/20' : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="px-3 py-1.5 rounded-full font-bold whitespace-nowrap text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 border border-dashed border-indigo-300 dark:border-indigo-800 flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle Catégorie</span>
          </button>
        </div>
      </div>

      {/* 4. Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Aucun produit ne correspond à ces critères
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Ajustez votre recherche ou ajoutez un nouvel article à votre référentiel.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-transform active:scale-95"
          >
            + Ajouter un produit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredProducts.map((p) => {
            const margin = (p.sellingPrice || 0) - (p.purchasePrice || 0);
            const marginPercent =
              p.sellingPrice > 0 ? Math.round((margin / p.sellingPrice) * 100) : 0;
            const category = state.categories.find((c) => c.id === p.categoryId);

            return (
              <div
                key={p.id}
                className="p-4 rounded-3xl bg-white dark:bg-[#131B2E] border border-[#E8EDF2] dark:border-[#22304E] shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div>
                  {/* Top Bar: Icon + SKU + Status */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800"
                        style={{
                          backgroundColor: `${category?.color || '#3b82f6'}15`,
                          color: category?.color || '#3b82f6',
                        }}
                      >
                        <Package className="w-5 h-5" />
                      </div>

                      <div className="truncate">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {p.sku || 'REF'}
                          </span>
                          {category && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1"
                              style={{
                                backgroundColor: `${category.color || '#3b82f6'}20`,
                                color: category.color || '#3b82f6',
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: category.color || '#3b82f6' }}
                              />
                              <span className="truncate max-w-[80px]">{category.name}</span>
                            </span>
                          )}
                        </div>
                        <h4
                          onClick={() => setSelectedItemId(p.id)}
                          className="text-sm font-extrabold text-[#14213D] dark:text-white truncate cursor-pointer hover:text-blue-600 leading-tight mt-1"
                        >
                          {p.name}
                        </h4>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {p.stockQuantity <= 0 ? (
                        <StatusBadge status="out_of_stock" />
                      ) : p.stockQuantity <= p.minStockAlert ? (
                        <StatusBadge status="low" />
                      ) : (
                        <StatusBadge status="in_stock" />
                      )}
                    </div>
                  </div>

                  {/* Pricing Breakdown & Margin Indicator */}
                  <div className="mt-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Prix de vente :
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {curr(p.sellingPrice)}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="text-slate-400">Coût d'achat :</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        {curr(p.purchasePrice || 0)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-400">Marge brute :</span>
                      <span className={`font-bold font-mono ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {curr(margin)} ({marginPercent}%)
                      </span>
                    </div>
                  </div>

                  {/* Stock Quantity */}
                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Disponible :
                    </span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">
                      {p.stockQuantity} {p.unit || 'pièce'}(s)
                    </span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetProductForStock(p);
                        setStockModalType('in');
                        setShowStockModal(true);
                      }}
                      className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1"
                      title="Entrée de stock"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>+ Entrée</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetProductForStock(p);
                        setStockModalType('out');
                        setShowStockModal(true);
                      }}
                      className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold flex items-center gap-1"
                      title="Sortie de stock"
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>- Sortie</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductToDelete(p)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Add / Edit Product Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {editingProduct ? 'Modifier le produit' : 'Créer un nouveau produit'}
                </h3>
                <p className="text-xs text-slate-500">
                  Définition des prix, codes, marges et seuils d'alerte (Phase 1)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nom ou Désignation du produit *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Riz Parfumé 5kg, Câble HDMI 2m..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Catégorie
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                  >
                    + Nouvelle catégorie
                  </button>
                </div>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Sans catégorie --</option>
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* SKU & Barcode with Generators */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Référence / SKU
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomSku}
                      className="text-[10px] text-indigo-600 font-bold hover:underline"
                    >
                      Générer auto
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: RIZ-5KG"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs sm:text-sm text-slate-900 dark:text-white uppercase"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Code-barres (EAN / UPC)
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomBarcode}
                      className="text-[10px] text-indigo-600 font-bold hover:underline"
                    >
                      Générer EAN
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: 6181100123456"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs sm:text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Pricing & Real-Time Margin Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tarification & Analyse de Marge
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Prix d'achat HT ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={formPurchasePrice || ''}
                      onChange={(e) => setFormPurchasePrice(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-sm text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Prix de vente ({currency}) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      placeholder="0"
                      value={formSellingPrice || ''}
                      onChange={(e) => setFormSellingPrice(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-sm text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                </div>

                {/* Dynamic Margin Indicator */}
                <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                  isFormLoss
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                }`}>
                  <div>
                    <span className="font-bold">
                      {isFormLoss ? '⚠️ Vente à perte' : 'Marge brute unitaire'} :
                    </span>{' '}
                    <span className="font-mono font-black">{curr(formMargin)}</span>
                  </div>
                  <span className="font-extrabold px-2 py-0.5 rounded-md bg-white/70 dark:bg-black/40">
                    Taux : {formMarginPercent}%
                  </span>
                </div>
              </div>

              {/* Stock initial, Seuil & Unité */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    {editingProduct ? 'Stock actuel' : 'Stock initial'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={Boolean(editingProduct)}
                    value={formStockQuantity}
                    onChange={(e) => setFormStockQuantity(parseInt(e.target.value, 10) || 0)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-60 text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Seuil alerte min
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinStockAlert}
                    onChange={(e) => setFormMinStockAlert(parseInt(e.target.value, 10) || 0)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Unité
                  </label>
                  <input
                    type="text"
                    placeholder="pièce, kg, sac..."
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Caractéristiques (Optionnel)
                </label>
                <textarea
                  rows={2}
                  placeholder="Informations complémentaires, fournisseur..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-transform active:scale-95"
                >
                  {editingProduct ? 'Enregistrer les modifications' : 'Créer le produit'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 6. Stock Movement Quick Modal */}
      {showStockModal && targetProductForStock && (
        <StockMovementModal
          isOpen={showStockModal}
          defaultType={stockModalType}
          defaultProductId={targetProductForStock.id}
          onClose={() => {
            setShowStockModal(false);
            setTargetProductForStock(null);
          }}
        />
      )}

      {/* 7. Category Management Modal */}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
      />

      {/* 8. Phase 1 Test & Validation Modal */}
      <Phase1TestModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
      />

      {/* 9. Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(productToDelete)}
        title="Supprimer le produit"
        message={`Êtes-vous sûr de vouloir supprimer définitivement "${productToDelete?.name}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Conserver"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
};
