/**
 * StockFacture Pro - Company Logo Upload
 * 
 * Permet d'uploader un logo pour l'entreprise (affiché sur les factures, devis et tickets).
 * Le logo est compressé et stocké en base64 dans CompanySettings.
 */

import React, { useRef, useState } from 'react';
import { Upload, Trash2, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useToast } from '../../store/ToastContext';
import { compressImageFile } from '../../utils/imageUtils';

export const CompanyLogoUpload: React.FC = () => {
  const { state, updateSettings } = useApp();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLogo = state.settings.companyLogo;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Vérification de la taille brute (max 5 Mo avant compression)
    if (file.size > 5 * 1024 * 1024) {
      const msg = 'Le fichier est trop volumineux (max 5 Mo).';
      setError(msg);
      toast.error('Fichier trop volumineux', msg);
      return;
    }

    // Vérification du type
    if (!file.type.startsWith('image/')) {
      const msg = 'Le fichier doit être une image (PNG, JPG, SVG...).';
      setError(msg);
      toast.error('Format invalide', msg);
      return;
    }

    try {
      setIsUploading(true);
      // Compression : max 400px de large, qualité 0.85
      // Objectif : garder le logo < 50 Ko en base64
      const compressed = await compressImageFile(file, 400, 0.85);
      await updateSettings({ companyLogo: compressed });
      toast.success('Logo enregistré', 'Votre logo apparaîtra sur vos factures et devis.');
    } catch (err: any) {
      const msg = err?.message || "Impossible de traiter l'image.";
      setError(msg);
      toast.error('Erreur', msg);
    } finally {
      setIsUploading(false);
      // Reset input pour permettre de re-uploader le même fichier
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateSettings({ companyLogo: undefined });
      toast.success('Logo supprimé', 'Le logo a été retiré de vos documents.');
    } catch (err: any) {
      toast.error('Erreur', err?.message || 'Impossible de supprimer le logo.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        {/* Aperçu du logo */}
        <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-[#E8EDF2] dark:border-slate-700 bg-[#FAFAF8] dark:bg-slate-800/60 flex items-center justify-center overflow-hidden shrink-0">
          {currentLogo ? (
            <img
              src={currentLogo}
              alt="Logo de l'entreprise"
              className="w-full h-full object-contain p-1.5"
            />
          ) : (
            <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 space-y-2">
          <div>
            <span className="text-xs font-bold text-[#14213D] dark:text-white block">
              Logo de l'entreprise
            </span>
            <span className="text-[11px] text-[#64748B] dark:text-slate-400">
              Apparaîtra en haut de vos factures, devis et tickets de caisse.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compression...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>{currentLogo ? 'Changer le logo' : 'Ajouter un logo'}</span>
                </>
              )}
            </button>

            {currentLogo && !isUploading && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>
            )}
          </div>

          <p className="text-[10px] text-[#64748B] dark:text-slate-500">
            Formats acceptés : PNG, JPG, SVG, WEBP • Max 5 Mo • Recommandé : carré, fond transparent
          </p>

          {error && (
            <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};