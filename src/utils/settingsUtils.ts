/**
 * StockFacture Pro - Company Settings Utilities & Sanitization
 * 
 * Ensures user company settings remain strictly persistent and never get
 * contaminated or replaced by demo data upon reopening, refreshing, or syncing.
 */

import { CompanySettings } from '../types';
import { defaultSettings } from '../data/demoData';

/**
 * Returns true if the settings object matches the demo store profile.
 */
export function isDemoSettings(settings?: Partial<CompanySettings> | null): boolean {
  if (!settings) return false;
  return Boolean(
    settings.name === 'TechMobile & Informatique Pro' ||
    settings.email === 'contact@techmobile-pro.ci' ||
    settings.phone === '+225 07 88 99 00 11' ||
    settings.website === 'www.techmobile-pro.ci' ||
    (typeof settings.address === 'string' && settings.address.includes('Avenue des Télécoms')) ||
    settings.taxId === 'CI-ABJ-2026-B-4482' ||
    (typeof settings.invoiceFooterNote === 'string' && settings.invoiceFooterNote.includes('TechMobile'))
  );
}

/**
 * Checks if the settings object contains legitimate, user-entered company information.
 */
export function hasCustomUserSettings(settings?: Partial<CompanySettings> | null): boolean {
  if (!settings) return false;
  if (isDemoSettings(settings)) return false;
  return Boolean(
    (settings.name && settings.name.trim() !== '') ||
    (settings.phone && settings.phone.trim() !== '') ||
    (settings.email && settings.email.trim() !== '') ||
    (settings.address && settings.address.trim() !== '') ||
    (settings.website && settings.website.trim() !== '') ||
    (settings.taxId && settings.taxId.trim() !== '')
  );
}

/**
 * Sanitizes company settings by ensuring no demo residue can leak into the user's account.
 * If fallback contains legitimate user settings, it takes precedence over empty or demo data.
 */
export function cleanCompanySettings(
  settings?: Partial<CompanySettings> | null,
  fallback?: Partial<CompanySettings> | null
): CompanySettings {
  // If settings matches demo profile, check if fallback has real user data
  if (settings && isDemoSettings(settings)) {
    if (fallback && hasCustomUserSettings(fallback)) {
      return {
        ...defaultSettings,
        ...fallback,
        hasCompletedOnboarding: true,
      };
    }
    // No legitimate user fallback, sanitize to neutral defaultSettings
    return { ...defaultSettings };
  }

  if (!settings) {
    if (fallback && hasCustomUserSettings(fallback)) {
      return {
        ...defaultSettings,
        ...fallback,
      };
    }
    return { ...defaultSettings };
  }

  const isDemo = isDemoSettings(settings);

  return {
    ...defaultSettings,
    ...settings,
    name: isDemo || settings.name === 'TechMobile & Informatique Pro' ? '' : (settings.name || ''),
    email: isDemo || settings.email === 'contact@techmobile-pro.ci' ? '' : (settings.email || ''),
    phone: isDemo || settings.phone === '+225 07 88 99 00 11' ? '' : (settings.phone || ''),
    address: isDemo || (settings.address && settings.address.includes('Avenue des Télécoms')) ? '' : (settings.address || ''),
    website: isDemo || settings.website === 'www.techmobile-pro.ci' ? '' : (settings.website || ''),
    taxId: isDemo || settings.taxId === 'CI-ABJ-2026-B-4482' ? '' : (settings.taxId || ''),
    invoiceFooterNote:
      settings.invoiceFooterNote && settings.invoiceFooterNote.includes('TechMobile')
        ? 'Merci pour votre confiance !'
        : (settings.invoiceFooterNote || 'Merci pour votre confiance !'),
  };
}
