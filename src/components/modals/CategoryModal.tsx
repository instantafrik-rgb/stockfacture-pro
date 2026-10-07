import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, Tag } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Category } from '../../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_PALETTE = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#84cc16', // Lime
  '#eab308', // Yellow
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#a855f7', // Purple
  '#64748b', // Slate
];

export const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, onClose }) => {
  const { state, addCategory, deleteCategory, persistState } = useApp() as any;
  const [newCatName, setNewCatName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState(COLOR_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate product count per category
  const getProductCount = (catId: string) => {
    return state.products.filter((p: any) => p.categoryId === catId).length;
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newCatName.trim()) {
      setError('Veuillez saisir un nom de catégorie.');
      return;
    }

    // Check duplicate
    if (state.categories.some((c: Category) => c.name.toLowerCase() === newCatName.trim().toLowerCase())) {
      setError('Une catégorie avec ce nom existe déjà.');
      return;
    }

    await addCategory({
      name: newCatName.trim(),
      color: selectedColor,
    });

    setNewCatName('');
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditingName(cat.name);
    setEditingColor(cat.color || COLOR_PALETTE[0]);
  };

  const handleSaveEdit = async () => {
    if (!editingCatId || !editingName.trim()) return;

    const updatedCategories = state.categories.map((c: Category) =>
      c.id === editingCatId ? { ...c, name: editingName.trim(), color: editingColor } : c
    );

    if (persistState) {
      await persistState({ ...state, categories: updatedCategories });
    }
    setEditingCatId(null);
  };

  const handleDelete = async (cat: Category) => {
    const count = getProductCount(cat.id);
    if (count > 0) {
      if (!confirm(`Cette catégorie contient ${count} produit(s). Les produits ne seront pas supprimés mais n'auront plus de catégorie assignée. Confirmer ?`)) {
        return;
      }
    }
    await deleteCategory(cat.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Gestion des Catégories
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Organisez vos produits par famille ou rayon
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

        {/* Add Category Form */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <form onSubmit={handleAddCategory} className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Ajouter une nouvelle catégorie
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ex: Épicerie, Outillage, Parfums..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-transform active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter</span>
              </button>
            </div>

            {/* Color Palette */}
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                Couleur de repère :
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center ${
                      selectedColor === color ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-110'
                    }`}
                  >
                    {selectedColor === color && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-500 font-medium">{error}</p>
            )}
          </form>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Catégories existantes ({state.categories.length})
          </div>

          {state.categories.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">
              Aucune catégorie configurée.
            </p>
          ) : (
            state.categories.map((cat: Category) => {
              const count = getProductCount(cat.id);
              const isEditing = editingCatId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: cat.color || '#6366f1' }}
                    />
                    
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white flex-1"
                        />
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="p-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="truncate">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate block">
                          {cat.name}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {count} produit{count > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Modifier"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
