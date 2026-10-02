/**
 * StockFacture Pro - Type Definitions
 */

export type CurrencyPosition = 'after' | 'before';

export type InvoiceStatus = 'draft' | 'unpaid' | 'partial' | 'paid' | 'cancelled';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

export type RestockRequestStatus = 'pending' | 'contacted' | 'available' | 'cancelled';

export type StockMovementType = 'in' | 'out' | 'adjustment';

export type StockMovementReason =
  | 'purchase'
  | 'sale'
  | 'donation'
  | 'defective'
  | 'loss'
  | 'customer_return'
  | 'breakage'
  | 'theft'
  | 'correction'
  | 'other';

export type PaymentMethod =
  | 'cash'
  | 'mobile_money'
  | 'bank_transfer'
  | 'card'
  | 'check'
  | 'other';

export interface CompanySettings {
  name: string;
  logoUrl?: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  taxId?: string; // NIF / RCCM / SIRET / TVA Intracommunautaire
  currency: string; // e.g. "FCFA", "EUR", "USD"
  currencyPosition: CurrencyPosition;
  invoicePrefix: string; // e.g. "FAC-2026-"
  nextInvoiceNumber: number; // e.g. 1
  quotePrefix: string; // e.g. "DEV-2026-"
  nextQuoteNumber: number;
  vatEnabled: boolean;
  vatRate: number; // e.g. 18 (%)
  paymentTerms: string;
  invoiceFooterNote: string;
  allowNegativeStock: boolean;
  pinEnabled: boolean;
  pinCode?: string; // 4 to 6 digit hashed or plain PIN
  theme: 'light' | 'dark' | 'system';
  hasCompletedOnboarding?: boolean;
  // Backup & Notifications settings
  backupReminderEnabled?: boolean; // default: true
  backupReminderTime?: string; // default: "20:00"
  dailyReportEnabled?: boolean; // default: true
  dailyReportTime?: string; // default: "20:00"
  lastBackupDate?: string; // ISO string of last completed backup
  lastBackupType?: 'cloud' | 'json' | 'local';
}

export interface BackupMetadata {
  id: string;
  createdAt: string;
  appVersion: string;
  userEmail?: string;
  userId?: string;
  stats: {
    productsCount: number;
    categoriesCount: number;
    clientsCount: number;
    invoicesCount: number;
    quotesCount: number;
    paymentsCount: number;
    movementsCount: number;
    closuresCount: number;
    restockRequestsCount?: number;
    returnsCount?: number;
    totalRevenue: number;
  };
}

export interface FullBackupPayload {
  format: 'STOCKFACTURE_PRO_BACKUP';
  version: '1.0';
  app: 'StockFacture Pro';
  metadata: BackupMetadata;
  data: {
    settings: CompanySettings;
    categories: Category[];
    products: Product[];
    movements: StockMovement[];
    clients: Client[];
    invoices: Invoice[];
    payments: PaymentRecord[];
    quotes: Quote[];
    closures?: CashRegisterClosure[];
    restockRequests?: RestockRequest[];
    returns?: SaleReturn[];
  };
}

export interface Category {
  id: string;
  name: string;
  color?: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  categoryId?: string;
  purchasePrice: number; // Prix d'achat
  sellingPrice: number;  // Prix de vente
  stockQuantity: number;
  minStockAlert: number;
  unit: string; // "pcs", "kg", "carton", "mètre", "paquet", etc.
  description?: string;
  imageUrl?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number; // Positive quantity moved
  previousStock: number;
  newStock: number;
  reason: StockMovementReason;
  referenceId?: string; // invoiceId or manual note
  note?: string;
  userName?: string; // Utilisateur / caissier ayant enregistré l'opération
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  productId?: string; // undefined if free line (ligne libre)
  isFreeLine: boolean;
  designation: string;
  reference?: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  purchasePrice?: number; // for profit calculation if known
  discountPercent?: number; // 0-100
  total: number; // computed
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  note?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  number: string; // e.g. FAC-2026-0001
  date: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  clientTaxId?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountTotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  remainingAmount: number;
  status: InvoiceStatus;
  paymentTerms?: string;
  notes?: string;
  quoteId?: string; // If converted from quote
  createdAt: string;
  updatedAt: string;
}

export interface QuoteItem {
  id: string;
  productId?: string;
  isFreeLine: boolean;
  designation: string;
  reference?: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent?: number;
  total: number;
}

export interface Quote {
  id: string;
  number: string; // e.g. DEV-2026-0001
  date: string;
  expiryDate: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  items: QuoteItem[];
  subtotal: number;
  discountTotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  status: QuoteStatus;
  notes?: string;
  convertedInvoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  productId?: string;
  isFreeLine: boolean;
  designation: string;
  reference?: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  purchasePrice?: number;
  discountPercent: number;
  availableStock?: number;
  imageUrl?: string;
}

export interface CashRegisterClosure {
  id: string;
  closureNumber: string; // e.g. Z-2026-09-24-001
  date: string; // YYYY-MM-DD
  closedAt: string; // ISO string
  cashierName?: string;
  openingCash: number; // Fond de caisse de départ
  cashSales: number; // Ventes encaissées en espèces
  mobileMoneySales: number; // Ventes encaissées en Mobile Money
  cardSales: number; // Ventes carte bancaire
  otherSales: number; // Autres modes (virement, chèque)
  totalSales: number; // Total du CA de la session
  transactionsCount: number; // Nombre de transactions
  expectedCashInDrawer: number; // openingCash + cashSales
  actualCashInDrawer: number; // Comptage physique réel des espèces
  cashDifference: number; // actualCashInDrawer - expectedCashInDrawer
  notes?: string;
}

export interface RestockRequest {
  id: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  productId: string;
  productName: string;
  desiredQuantity: number;
  requestDate: string; // YYYY-MM-DD
  note?: string;
  status: RestockRequestStatus; // 'pending' | 'contacted' | 'available' | 'cancelled'
  contactedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReturnActionType = 'refund' | 'credit_note' | 'exchange';

export interface ReturnItem {
  invoiceItemId: string;
  productId?: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  total: number;
  restock: boolean; // Remettre en stock physique (si revendable)
  condition?: 'resellable' | 'defective';
}

export interface ExchangeProduct {
  productId: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SaleReturn {
  id: string;
  returnNumber: string; // e.g. "RET-2026-0001"
  invoiceId: string;
  invoiceNumber: string;
  clientId?: string;
  clientName: string;
  items: ReturnItem[];
  actionType: ReturnActionType; // 'refund' | 'credit_note' | 'exchange'
  refundMethod?: PaymentMethod;
  totalReturnedAmount: number;
  exchangeProduct?: ExchangeProduct;
  exchangePriceDifference?: number; // >0 client pays extra, <0 shop refunds difference, 0 equal
  reason: string; // "Article défectueux", "Erreur taille/ref", "Ne convient pas", etc.
  date: string; // YYYY-MM-DD
  userName?: string;
  notes?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface AppState {
  settings: CompanySettings;
  categories: Category[];
  products: Product[];
  movements: StockMovement[];
  clients: Client[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  quotes: Quote[];
  closures?: CashRegisterClosure[];
  restockRequests?: RestockRequest[];
  returns?: SaleReturn[];
  isLocked: boolean; // PIN lock
  hasCompletedOnboarding: boolean;
}
