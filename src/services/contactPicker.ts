/**
 * StockFacture Pro - Native Contact Picker Service (Mobile Web Contact API)
 */

export interface PickedContact {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export async function isContactPickerSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return 'contacts' in navigator && 'ContactsManager' in window;
}

export async function pickContactNative(): Promise<PickedContact | null> {
  try {
    if (!('contacts' in navigator) || !('ContactsManager' in window)) {
      return null;
    }

    const contactsManager = (navigator as unknown as {
      contacts: {
        select: (
          properties: string[],
          options?: { multiple?: boolean }
        ) => Promise<Array<{ name?: string[]; tel?: string[]; email?: string[]; address?: string[] }>>;
      };
    }).contacts;

    const props = ['name', 'tel', 'email'];
    const results = await contactsManager.select(props, { multiple: false });

    if (results && results.length > 0) {
      const contact = results[0];
      return {
        name: contact.name && contact.name[0] ? contact.name[0] : 'Client contact',
        phone: contact.tel && contact.tel[0] ? contact.tel[0] : undefined,
        email: contact.email && contact.email[0] ? contact.email[0] : undefined,
      };
    }
    return null;
  } catch (err) {
    console.warn('Contact picker was cancelled or failed:', err);
    return null;
  }
}
