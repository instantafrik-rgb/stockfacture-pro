import React, { useState, useMemo } from 'react';
import { X, Printer, Download, Share2, MessageSquare, Check, Sparkles } from 'lucide-react';
import { Invoice, PaymentRecord } from '../../types';
import { useApp } from '../../store/AppContext';
import { formatCurrency, formatDateTime, getPaymentMethodLabel } from '../../utils/formatters';
import { generateThermalReceiptPdf } from '../../pdf/documentPdf';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  payments?: PaymentRecord[];
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  invoice,
  payments = [],
}) => {
  const { state } = useApp();
  const { settings } = state;
  const [format, setFormat] = useState<'58mm' | '80mm'>('80mm');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const curr = (n: number) => formatCurrency(n, settings.currency, settings.currencyPosition);

  // Filter payments associated with this invoice
  const invoicePayments = useMemo(() => {
    if (payments && payments.length > 0) return payments;
    return state.payments.filter((p) => p.invoiceId === invoice.id);
  }, [payments, state.payments, invoice.id]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await generateThermalReceiptPdf(invoice, settings, invoicePayments, format, 'download');
    } catch (e) {
      console.error('Error generating thermal PDF:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      await generateThermalReceiptPdf(invoice, settings, invoicePayments, format, 'share');
    } catch (e) {
      console.error('Error sharing thermal PDF:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareWhatsApp = () => {
    let msg = `*TICKET DE CAISSE - ${(settings.name || 'Commerce').toUpperCase()}*\n`;
    msg += `Ticket : ${invoice.number}\n`;
    msg += `Date : ${formatDateTime(invoice.date || invoice.createdAt)}\n`;
    if (invoice.clientName && invoice.clientName !== 'Client comptant') {
      msg += `Client : ${invoice.clientName}\n`;
    }
    msg += `--------------------------------\n`;
    invoice.items.forEach((item) => {
      msg += `${item.designation} (${item.quantity} x ${curr(item.unitPrice)}) = *${curr(item.total)}*\n`;
    });
    msg += `--------------------------------\n`;
    if (invoice.discountTotal > 0) {
      msg += `Sous-total : ${curr(invoice.subtotal)}\n`;
      msg += `Remise : -${curr(invoice.discountTotal)}\n`;
    }
    msg += `*TOTAL NET : ${curr(invoice.total)}*\n`;
    msg += `Encaissé : ${curr(invoice.amountPaid)}\n`;
    if (invoice.remainingAmount > 0) {
      msg += `*Reste à payer : ${curr(invoice.remainingAmount)}*\n`;
    }
    msg += `--------------------------------\n`;
    msg += `${settings.invoiceFooterNote || 'Merci pour votre fidélité !'}`;

    if (invoice.clientPhone) {
      const cleanPhone = invoice.clientPhone.replace(/[^0-9]/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    } else {
      navigator.clipboard?.writeText(msg).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
      });
    }
  };

  const is58 = format === '58mm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      {/* Container */}
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[92vh]">
        
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Printer className="w-5 h-5 text-orange-500" />
              <span>Ticket de Caisse Thermique</span>
            </h3>
            <p className="text-xs text-slate-500">
              Format professionnel pour imprimantes rouleaux 58 mm et 80 mm
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper format selector bar */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Format d'impression :</span>
          <div className="inline-flex p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <button
              type="button"
              onClick={() => setFormat('58mm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                is58
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              58 mm (Standard Mobile)
            </button>
            <button
              type="button"
              onClick={() => setFormat('80mm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                !is58
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              80 mm (Grand Format POS)
            </button>
          </div>
        </div>

        {/* Visual Ticket Scrollable Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950/60 flex justify-center">
          {/* Printable Ticket Container */}
          <div
            id="printable-thermal-receipt"
            className={`bg-white text-slate-900 shadow-xl rounded-sm p-4 border border-slate-200 font-mono transition-all duration-200 selection:bg-orange-200 ${
              is58 ? 'w-[280px] text-[11px]' : 'w-[360px] text-[12px]'
            }`}
            style={{
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1), 0 2px 6px -1px rgba(0,0,0,0.06)',
            }}
          >
            {/* 1. Header (Logo / Name / Info) */}
            <div className="text-center space-y-1 pb-2">
              {settings.logoUrl && (
                <div className="flex justify-center mb-1">
                  <img
                    src={settings.logoUrl}
                    alt="Logo"
                    className="max-h-12 max-w-[120px] object-contain grayscale"
                  />
                </div>
              )}
              <h4 className="font-black text-sm sm:text-base uppercase tracking-tight text-slate-950">
                {settings.name || 'StockFacture Pro'}
              </h4>
              {settings.address && (
                <p className="text-[10px] sm:text-[11px] leading-tight text-slate-700">
                  {settings.address}
                </p>
              )}
              {settings.phone && (
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-800">
                  Tél : {settings.phone}
                </p>
              )}
              {settings.taxId && (
                <p className="text-[9px] text-slate-600">NIF/RCCM : {settings.taxId}</p>
              )}
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-slate-400 my-2" />

            {/* 2. Metadata */}
            <div className="text-[10px] sm:text-[11px] space-y-0.5">
              <div className="flex justify-between font-black text-slate-900">
                <span>TICKET N° :</span>
                <span>{invoice.number}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Date :</span>
                <span>{formatDateTime(invoice.date || invoice.createdAt)}</span>
              </div>
              {invoice.clientName && invoice.clientName !== 'Client comptant' && (
                <div className="flex justify-between text-slate-700 pt-0.5">
                  <span className="font-bold">Client :</span>
                  <span className="font-bold truncate max-w-[170px]">{invoice.clientName}</span>
                </div>
              )}
              {invoice.clientPhone && (
                <div className="flex justify-between text-slate-600">
                  <span>Tél client :</span>
                  <span>{invoice.clientPhone}</span>
                </div>
              )}
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-slate-400 my-2" />

            {/* 3. Items list */}
            <div className="space-y-1.5 text-[10px] sm:text-[11px]">
              <div className="flex justify-between font-bold text-slate-500 uppercase text-[9px] border-b border-slate-200 pb-1">
                <span>Désignation</span>
                <span>Total</span>
              </div>

              {invoice.items.map((item, idx) => (
                <div key={item.id || idx} className="space-y-0.5">
                  <div className="font-bold text-slate-900 leading-tight">
                    {item.designation}
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>
                      {item.quantity}{item.unit ? ` ${item.unit}` : ''} x {curr(item.unitPrice)}
                      {(item.discountPercent || 0) > 0 ? ` (-${item.discountPercent}%)` : ''}
                    </span>
                    <span className="font-bold text-slate-900">{curr(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-slate-400 my-2" />

            {/* 4. Financial totals */}
            <div className="space-y-1 text-[10px] sm:text-[11px]">
              {invoice.discountTotal > 0 && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Sous-total brut :</span>
                    <span>{curr(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Remise globale :</span>
                    <span>-{curr(invoice.discountTotal)}</span>
                  </div>
                </>
              )}

              {invoice.vatAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>TVA ({invoice.vatRate}%) :</span>
                  <span>{curr(invoice.vatAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm sm:text-base font-black text-slate-950 pt-1 border-t border-slate-300">
                <span>TOTAL NET :</span>
                <span>{curr(invoice.total)}</span>
              </div>

              <div className="flex justify-between text-slate-800 font-bold pt-1">
                <span>Montant Encaissé :</span>
                <span className="text-emerald-700">{curr(invoice.amountPaid)}</span>
              </div>

              {invoice.remainingAmount > 0 && (
                <div className="flex justify-between text-rose-700 font-black">
                  <span>Reste à Payer :</span>
                  <span>{curr(invoice.remainingAmount)}</span>
                </div>
              )}
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-slate-400 my-2" />

            {/* 5. Payments & Modes */}
            <div className="text-[10px] space-y-0.5 text-slate-700">
              <span className="font-bold text-slate-500 uppercase text-[9px] block">Règlement :</span>
              {invoicePayments.length > 0 ? (
                invoicePayments.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span>Mode : {getPaymentMethodLabel(p.method)}</span>
                    <span className="font-bold">{curr(p.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between">
                  <span>Paiement comptant</span>
                  <span>{curr(invoice.amountPaid)}</span>
                </div>
              )}
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-slate-400 my-2" />

            {/* 6. Footer */}
            <div className="text-center pt-1 text-[9px] sm:text-[10px] text-slate-600 leading-tight space-y-1">
              <p>{settings.invoiceFooterNote || 'Merci pour votre confiance ! À bientôt.'}</p>
              <p className="font-bold text-[8px] text-slate-400 tracking-wider">
                *** LOGICIEL STOCKFACTURE PRO ***
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer Ticket</span>
            </button>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 font-bold text-xs sm:text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Génération...' : 'PDF'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95"
              title={invoice.clientPhone ? 'Envoyer au client sur WhatsApp' : 'Copier le texte du ticket'}
            >
              {copySuccess ? <Check className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              <span>{copySuccess ? 'Copié !' : 'WhatsApp'}</span>
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleShare}
                className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                title="Partager le ticket"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Scoped print styling for thermal printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-thermal-receipt,
          #printable-thermal-receipt * {
            visibility: visible !important;
          }
          #printable-thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${is58 ? '58mm' : '80mm'} !important;
            margin: 0 !important;
            padding: ${is58 ? '2mm' : '4mm'} !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
};
