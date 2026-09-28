/**
 * StockFacture Pro - Firestore Cloud Schema & Data Architecture Blueprint
 * 
 * This file serves as the definitive reference blueprint for future Firebase/Firestore integration.
 * It details the target collections, document keys, field structures, indexing, and multi-device
 * synchronization rules.
 * 
 * 1. MULTI-TENANCY PATTERN
 * Each company/business account is isolated under:
 *   /companies/{companyId}/
 * 
 * This ensures strict data segregation and secure Firestore security rules:
 *   match /companies/{companyId}/{document=**} {
 *     allow read, write: if request.auth != null && request.auth.token.companyId == companyId;
 *   }
 */

export const FIRESTORE_COLLECTIONS = {
  COMPANIES: 'companies',
  SETTINGS: 'settings', // /companies/{companyId}/settings/profile
  PRODUCTS: 'products', // /companies/{companyId}/products/{productId}
  STOCK_MOVEMENTS: 'stock_movements', // /companies/{companyId}/stock_movements/{movementId}
  CLIENTS: 'clients', // /companies/{companyId}/clients/{clientId}
  INVOICES: 'invoices', // /companies/{companyId}/invoices/{invoiceId}
  PAYMENTS: 'payments', // /companies/{companyId}/payments/{paymentId}
  QUOTES: 'quotes', // /companies/{companyId}/quotes/{quoteId}
  CATEGORIES: 'categories', // /companies/{companyId}/categories/{categoryId}
} as const;

/**
 * Expected Firestore document schemas:
 * 
 * 1. SETTINGS (/companies/{companyId}/settings/profile)
 * {
 *   name: string,
 *   address: string,
 *   phone: string,
 *   email: string,
 *   website?: string,
 *   taxId?: string,
 *   currency: string,
 *   currencyPosition: 'after' | 'before',
 *   invoicePrefix: string,
 *   nextInvoiceNumber: number,
 *   quotePrefix: string,
 *   nextQuoteNumber: number,
 *   vatEnabled: boolean,
 *   vatRate: number,
 *   paymentTerms: string,
 *   invoiceFooterNote: string,
 *   allowNegativeStock: boolean,
 *   updatedAt: Timestamp,
 *   _deviceId: string
 * }
 * 
 * 2. PRODUCTS (/companies/{companyId}/products/{productId})
 * {
 *   id: string,
 *   name: string,
 *   sku: string,
 *   barcode?: string,
 *   categoryId?: string,
 *   purchasePrice: number,
 *   sellingPrice: number,
 *   stockQuantity: number,
 *   minStockAlert: number,
 *   unit: string,
 *   description?: string,
 *   imageUrl?: string,
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp,
 *   _deleted?: boolean
 * }
 * Indexes recommended:
 *   - categoryId ASC, name ASC
 *   - stockQuantity ASC, minStockAlert ASC (for low stock queries)
 * 
 * 3. STOCK MOVEMENTS (/companies/{companyId}/stock_movements/{movementId})
 * {
 *   id: string,
 *   productId: string,
 *   productName: string,
 *   type: 'in' | 'out' | 'adjustment',
 *   quantity: number,
 *   previousStock: number,
 *   newStock: number,
 *   reason: string,
 *   referenceId?: string,
 *   note?: string,
 *   createdAt: Timestamp
 * }
 * Indexes recommended:
 *   - productId ASC, createdAt DESC
 * 
 * 4. CLIENTS (/companies/{companyId}/clients/{clientId})
 * {
 *   id: string,
 *   name: string,
 *   phone?: string,
 *   email?: string,
 *   address?: string,
 *   taxId?: string,
 *   notes?: string,
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp,
 *   _deleted?: boolean
 * }
 * Indexes recommended:
 *   - name ASC
 * 
 * 5. INVOICES (/companies/{companyId}/invoices/{invoiceId})
 * {
 *   id: string,
 *   number: string,
 *   date: string (YYYY-MM-DD),
 *   dueDate: string,
 *   clientId?: string,
 *   clientName: string,
 *   clientPhone?: string,
 *   clientAddress?: string,
 *   clientTaxId?: string,
 *   items: Array<InvoiceItem>,
 *   subtotal: number,
 *   discountTotal: number,
 *   vatRate: number,
 *   vatAmount: number,
 *   total: number,
 *   amountPaid: number,
 *   remainingAmount: number,
 *   status: 'draft' | 'unpaid' | 'partial' | 'paid' | 'cancelled',
 *   notes?: string,
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp,
 *   _deleted?: boolean
 * }
 * Indexes recommended:
 *   - date DESC, createdAt DESC
 *   - status ASC, date DESC
 *   - clientId ASC, date DESC
 * 
 * 6. PAYMENTS (/companies/{companyId}/payments/{paymentId})
 * {
 *   id: string,
 *   invoiceId: string,
 *   invoiceNumber: string,
 *   amount: number,
 *   date: Timestamp,
 *   method: 'cash' | 'mobile_money' | 'bank_transfer' | 'card' | 'check' | 'other',
 *   note?: string,
 *   createdAt: Timestamp
 * }
 * Indexes recommended:
 *   - invoiceId ASC, date DESC
 *   - date DESC
 * 
 * 7. QUOTES (/companies/{companyId}/quotes/{quoteId})
 * {
 *   id: string,
 *   number: string,
 *   date: string,
 *   expiryDate: string,
 *   clientId?: string,
 *   clientName: string,
 *   items: Array<QuoteItem>,
 *   subtotal: number,
 *   discountTotal: number,
 *   vatRate: number,
 *   vatAmount: number,
 *   total: number,
 *   status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted',
 *   notes?: string,
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp,
 *   _deleted?: boolean
 * }
 */
