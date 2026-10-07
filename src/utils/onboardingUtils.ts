/**
 * StockFacture Pro - Onboarding State & Storage Utilities
 * 
 * Ensures robust, unbreakable onboarding tracking:
 * - Persisted in Firestore + IndexedDB + React state
 * - Uses Firebase UID-specific LocalStorage key + generic fallback
 * - Never relies solely on settings/company existence
 * - Automatically grants access to existing accounts with any business data
 * - Never resets hasCompletedOnboarding once completed
 */

import { AppState } from '../types';

/**
 * Returns the UID-specific LocalStorage key for onboarding completion.
 */
export function getOnboardingStorageKey(uid?: string | null): string {
  return uid ? `stockfacture_onboarding_completed_${uid}` : 'stockfacture_onboarding_completed';
}

/**
 * Checks whether the current user or state has completed onboarding.
 * Automatically treats existing accounts with data as already completed.
 */
export function isUserOnboarded(uid?: string | null, state?: AppState | null): boolean {
  if (typeof window !== 'undefined') {
    // 1. Check UID-specific LocalStorage key
    if (uid && localStorage.getItem(`stockfacture_onboarding_completed_${uid}`) === 'true') {
      return true;
    }
    // 2. Check generic LocalStorage key
    if (localStorage.getItem('stockfacture_onboarding_completed') === 'true') {
      return true;
    }
  }

  if (!state) return false;

  // 3. Check AppState flags
  if (Boolean(state.hasCompletedOnboarding)) return true;
  if (Boolean(state.settings?.hasCompletedOnboarding)) return true;

  // 4. Automatically preserve access for any existing account with data
  if (state.products && state.products.length > 0) return true;
  if (state.invoices && state.invoices.length > 0) return true;
  if (state.clients && state.clients.length > 0) return true;
  if (state.movements && state.movements.length > 0) return true;
  if (state.quotes && state.quotes.length > 0) return true;
  if (state.closures && state.closures.length > 0) return true;
  if (state.returns && state.returns.length > 0) return true;
  if (state.payments && state.payments.length > 0) return true;
  if (state.restockRequests && state.restockRequests.length > 0) return true;

  return false;
}

/**
 * Marks onboarding as completed locally in LocalStorage for both the UID and fallback keys.
 */
export function markUserOnboardedLocally(uid?: string | null): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('stockfacture_onboarding_completed', 'true');
      if (uid) {
        localStorage.setItem(`stockfacture_onboarding_completed_${uid}`, 'true');
      }
    } catch (e) {
      console.warn('LocalStorage onboarding save error:', e);
    }
  }
}
