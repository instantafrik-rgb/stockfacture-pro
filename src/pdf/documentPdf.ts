/**
 * StockFacture Pro - High-Fidelity PDF Generation (Invoices, Receipts, Quotes)
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, PaymentRecord, Quote, CompanySettings } from '../types';
import { formatCurrency, formatDate, formatDateTime, getPaymentMethodLabel } from '../utils/formatters';

// Format helper with settings
const getCurr = (val: number, s: CompanySettings) => formatCurrency(val, s.currency, s.currencyPosition);

/**
 * Generate and download or share an Invoice PDF with modern, light professional design
 */
export async function generateInvoicePdf(
  invoice: Invoice,
  settings: CompanySettings,
  payments: PaymentRecord[] = [],
  action: 'download' | 'share' | 'print' = 'download'
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 18;

  // 1. TOP HEADER (Pure White Background, Crisp Dark Typography)
  // Left: Company Information
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Deep Charcoal #0F172A
  doc.text(settings.name || 'StockFacture Pro', margin, y + 4);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // Slate #475569

  let compY = y + 10;
  if (settings.address) {
    doc.text(settings.address, margin, compY);
    compY += 4.5;
  }
  const phoneEmail = [settings.phone && `Tél : ${settings.phone}`, settings.email && `Email : ${settings.email}`]
    .filter(Boolean)
    .join('  •  ');
  if (phoneEmail) {
    doc.text(phoneEmail, margin, compY);
    compY += 4.5;
  }
  if (settings.taxId) {
    doc.text(`NIF / RCCM : ${settings.taxId}`, margin, compY);
    compY += 4.5;
  }

  // Right: Document Title & Metadata
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('FACTURE', pageWidth - margin, y + 5, { align: 'right' });

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(234, 88, 12); // Clean Amber/Orange #EA580C
  doc.text(`N° ${invoice.number}`, pageWidth - margin, y + 12, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Date d'émission : ${formatDate(invoice.date)}`, pageWidth - margin, y + 17.5, { align: 'right' });
  doc.text(`Date d'échéance : ${formatDate(invoice.dueDate)}`, pageWidth - margin, y + 22.5, { align: 'right' });

  // Subtle separator line below header
  y = Math.max(compY + 3, y + 27);
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  y += 7;

  // 2. CLIENT & STATUS BOXES (Side-by-side on clean light background)
  const colWidth = (pageWidth - margin * 2 - 8) / 2;

  // Box 1: Facturé à (Client)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, colWidth, 32, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('FACTURÉ À :', margin + 6, y + 6.5);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.clientName || 'Client de passage', margin + 6, y + 13);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  let cliY = y + 18.5;
  if (invoice.clientPhone) {
    doc.text(`Tél : ${invoice.clientPhone}`, margin + 6, cliY);
    cliY += 4.5;
  }
  if (invoice.clientAddress) {
    doc.text(`Adresse : ${invoice.clientAddress}`, margin + 6, cliY);
    cliY += 4.5;
  }
  if (invoice.clientTaxId) {
    doc.text(`NIF / ID : ${invoice.clientTaxId}`, margin + 6, cliY);
  }

  // Box 2: Règlement & Statut
  const rightX = margin + colWidth + 8;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightX, y, colWidth, 32, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('RÈGLEMENT & STATUT :', rightX + 6, y + 6.5);

  const isFullyPaid = invoice.status === 'paid' || invoice.remainingAmount <= 0;
  let statusBadgeText = 'IMPAYÉE';
  let badgeFillColor: [number, number, number] = [254, 242, 242]; // Rose-50
  let badgeBorderColor: [number, number, number] = [244, 63, 94]; // Rose-500
  let badgeTextColor: [number, number, number] = [190, 18, 60]; // Rose-700

  if (isFullyPaid) {
    statusBadgeText = 'PAYÉE / SOLDÉE';
    badgeFillColor = [240, 253, 244]; // Emerald-50
    badgeBorderColor = [34, 197, 94]; // Emerald-500
    badgeTextColor = [21, 128, 61]; // Emerald-700
  } else if (invoice.status === 'partial') {
    statusBadgeText = 'PARTIELLE';
    badgeFillColor = [254, 252, 232]; // Amber-50
    badgeBorderColor = [245, 158, 11]; // Amber-500
    badgeTextColor = [180, 83, 9]; // Amber-700
  } else if (invoice.status === 'cancelled') {
    statusBadgeText = 'ANNULÉE';
    badgeFillColor = [241, 245, 249];
    badgeBorderColor = [148, 163, 184];
    badgeTextColor = [100, 116, 139];
  }

  // Render Status Badge Inside Box 2
  doc.setFillColor(badgeFillColor[0], badgeFillColor[1], badgeFillColor[2]);
  doc.setDrawColor(badgeBorderColor[0], badgeBorderColor[1], badgeBorderColor[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightX + 6, y + 10, colWidth - 12, 9, 1.5, 1.5, 'FD');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(badgeTextColor[0], badgeTextColor[1], badgeTextColor[2]);
  doc.text(statusBadgeText, rightX + colWidth / 2, y + 16, { align: 'center' });

  // Quick summary line
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  if (isFullyPaid) {
    doc.text('Facture acquittée intégralement', rightX + colWidth / 2, y + 25.5, { align: 'center' });
  } else if (invoice.remainingAmount > 0) {
    doc.text(`Reste à payer : ${getCurr(invoice.remainingAmount, settings)}`, rightX + colWidth / 2, y + 25.5, {
      align: 'center',
    });
  }

  y += 38;

  // 3. ITEMS TABLE (Light professional theme, high contrast)
  const tableRows = invoice.items.map((it, idx) => [
    String(idx + 1),
    it.designation + (it.reference ? ` (${it.reference})` : ''),
    `${it.quantity} ${it.unit || ''}`.trim(),
    getCurr(it.unitPrice, settings),
    it.discountPercent ? `${it.discountPercent} %` : '-',
    getCurr(it.total, settings),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Désignation', 'Qté', 'P.U.', 'Remise', 'Total']],
    body: tableRows,
    theme: 'plain',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [248, 250, 252], // Very light gray-slate
      textColor: [30, 41, 59], // Dark charcoal text
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 3.5,
      lineWidth: 0.2,
      lineColor: [226, 232, 240],
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
      cellPadding: 3.5,
      lineWidth: 0.1,
      lineColor: [241, 245, 249],
    },
    alternateRowStyles: {
      fillColor: [253, 254, 255],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || y + 50;
  let totalsY = finalY + 8;

  // 4. FINANCIAL TOTALS BOX (Clean white card on the right)
  const totalsWidth = 86;
  const totalsX = pageWidth - margin - totalsWidth;
  const boxHeight = invoice.vatAmount > 0 || invoice.discountTotal > 0 ? 54 : 46;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(totalsX, totalsY, totalsWidth, boxHeight, 2, 2, 'FD');

  let curY = totalsY + 6.5;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text('Sous-total :', totalsX + 6, curY);
  doc.text(getCurr(invoice.subtotal, settings), totalsX + totalsWidth - 6, curY, { align: 'right' });
  curY += 5.5;

  if (invoice.discountTotal > 0) {
    doc.text('Remise globale :', totalsX + 6, curY);
    doc.text(`- ${getCurr(invoice.discountTotal, settings)}`, totalsX + totalsWidth - 6, curY, { align: 'right' });
    curY += 5.5;
  }

  if (invoice.vatAmount > 0) {
    doc.text(`TVA (${invoice.vatRate} %) :`, totalsX + 6, curY);
    doc.text(getCurr(invoice.vatAmount, settings), totalsX + totalsWidth - 6, curY, { align: 'right' });
    curY += 5.5;
  }

  // TOTAL line with clean separator
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(totalsX + 6, curY, totalsX + totalsWidth - 6, curY);
  curY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL :', totalsX + 6, curY);
  doc.text(getCurr(invoice.total, settings), totalsX + totalsWidth - 6, curY, { align: 'right' });
  curY += 6;

  // Montant payé
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(21, 128, 61); // Green
  doc.text('Montant payé :', totalsX + 6, curY);
  doc.text(getCurr(invoice.amountPaid, settings), totalsX + totalsWidth - 6, curY, { align: 'right' });
  curY += 5.5;

  // Reste à payer
  doc.setFont('helvetica', 'bold');
  if (invoice.remainingAmount > 0) {
    doc.setTextColor(225, 29, 72); // Rose
    doc.text('Reste à payer :', totalsX + 6, curY);
    doc.text(getCurr(invoice.remainingAmount, settings), totalsX + totalsWidth - 6, curY, { align: 'right' });
  } else {
    doc.setTextColor(21, 128, 61); // Green
    doc.text('Reste à payer :', totalsX + 6, curY);
    doc.text(getCurr(0, settings), totalsX + totalsWidth - 6, curY, { align: 'right' });
  }

  // Optional: Left side notes (only if provided, NO conditions de règlement, NO historique)
  if (invoice.notes) {
    const leftNotesWidth = totalsX - margin - 8;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, totalsY, leftNotesWidth, Math.min(boxHeight, 30), 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('NOTES / OBSERVATIONS :', margin + 6, totalsY + 6.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(invoice.notes, margin + 6, totalsY + 12, { maxWidth: leftNotesWidth - 12 });
  }

  // 5. FOOTER (Clean subtle note at bottom)
  const footerY = 282;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate-400
  const footerText = settings.invoiceFooterNote || 'Merci pour votre confiance ! - Facture générée avec StockFacture Pro';
  doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });

  // Output handling
  const filename = `${invoice.number}_${(invoice.clientName || 'Facture').replace(/\s+/g, '_')}.pdf`;

  if (action === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    return;
  }

  if (action === 'share' && navigator.share && navigator.canShare) {
    try {
      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Facture ${invoice.number}`,
          text: `Facture ${invoice.number} pour ${invoice.clientName} - Total: ${getCurr(invoice.total, settings)}`,
        });
        return;
      }
    } catch (e) {
      console.warn('Share not supported or cancelled, falling back to download', e);
    }
  }

  doc.save(filename);
}

/**
 * Generate and download or share a Payment Receipt PDF
 */
export async function generateReceiptPdf(
  payment: PaymentRecord,
  invoice: Invoice,
  settings: CompanySettings,
  action: 'download' | 'share' | 'print' = 'download'
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [148, 210], // A5 format for receipts
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = 14;

  // Header Box
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.name || 'StockFacture Pro', margin + 6, y + 10);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(settings.phone ? `Tél : ${settings.phone}` : 'Reçu de versement', margin + 6, y + 17);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(52, 211, 153); // Emerald
  doc.text('REÇU DE PAIEMENT', pageWidth - margin - 6, y + 10, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(formatDate(payment.date), pageWidth - margin - 6, y + 17, { align: 'right' });

  y += 32;

  // Receipt Body Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 90, 3, 3, 'FD');

  let curY = y + 10;
  const lineSpacing = 8;
  const labelX = margin + 8;
  const valX = pageWidth - margin - 8;

  const renderRow = (label: string, val: string, isBold: boolean = false, isAccent: boolean = false) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(label, labelX, curY);

    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    if (isAccent) {
      doc.setTextColor(16, 185, 129);
      doc.setFontSize(11);
    } else {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
    }
    doc.text(val, valX, curY, { align: 'right' });
    curY += lineSpacing;
  };

  renderRow('Client / Bénéficiaire :', invoice.clientName || 'Client de passage', true);
  renderRow('Facture concernée :', invoice.number);
  renderRow('Mode de paiement :', getPaymentMethodLabel(payment.method));
  if (payment.note) {
    renderRow('Référence / Note :', payment.note);
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, curY, valX, curY);
  curY += 6;

  renderRow('MONTANT ENCAISSÉ :', getCurr(payment.amount, settings), true, true);
  renderRow('Montant total facture :', getCurr(invoice.total, settings));
  renderRow('Total déjà versé :', getCurr(invoice.amountPaid, settings));
  renderRow('Reste à payer :', getCurr(invoice.remainingAmount, settings), true);

  // Signature Block
  const sigY = curY + 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Signature / Cachet :', valX - 40, sigY);
  doc.setDrawColor(148, 163, 184);
  doc.line(valX - 45, sigY + 18, valX, sigY + 18);

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Reçu délivré et certifié par StockFacture Pro', pageWidth / 2, 198, { align: 'center' });

  const filename = `Recu_${invoice.number}_${payment.id.slice(0, 6)}.pdf`;

  if (action === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    return;
  }

  if (action === 'share' && navigator.share && navigator.canShare) {
    try {
      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Reçu ${invoice.number}`,
          text: `Reçu de paiement pour la facture ${invoice.number} d'un montant de ${getCurr(payment.amount, settings)}`,
        });
        return;
      }
    } catch (e) {
      console.warn('Share cancelled or not supported', e);
    }
  }

  doc.save(filename);
}

/**
 * Generate and download or share a Quote (Devis) PDF
 */
export async function generateQuotePdf(
  quote: Quote,
  settings: CompanySettings,
  action: 'download' | 'share' | 'print' = 'download'
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 18;

  // Header Background bar (Indigo tone for quotes)
  doc.setFillColor(67, 56, 202); // Indigo-700
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.name || 'StockFacture Pro', margin + 8, y + 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(224, 231, 255);
  const companyContact = [settings.phone, settings.email, settings.address].filter(Boolean).join(' • ');
  doc.text(companyContact || 'Devis & Proposition commerciale', margin + 8, y + 19);

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('DEVIS', pageWidth - margin - 8, y + 11, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text(quote.number, pageWidth - margin - 8, y + 18, { align: 'right' });

  y += 36;

  // Client Details Box & Quote Meta Box
  const colWidth = (pageWidth - margin * 2 - 8) / 2;

  // Box 1: Destinataire
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, colWidth, 32, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DESTINATAIRE :', margin + 6, y + 7);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(quote.clientName || 'Client de passage', margin + 6, y + 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  if (quote.clientPhone) doc.text(`Tél : ${quote.clientPhone}`, margin + 6, y + 20);
  if (quote.clientAddress) doc.text(`Adresse : ${quote.clientAddress}`, margin + 6, y + 26);

  // Box 2: Meta info
  const rightX = margin + colWidth + 8;
  doc.roundedRect(rightX, y, colWidth, 32, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DÉTAILS DEVIS :', rightX + 6, y + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Date d'émission :`, rightX + 6, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(quote.date), rightX + colWidth - 6, y + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text(`Date de validité :`, rightX + 6, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(quote.expiryDate), rightX + colWidth - 6, y + 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text(`Statut :`, rightX + 6, y + 26);
  doc.setFont('helvetica', 'bold');
  doc.text(quote.status.toUpperCase(), rightX + colWidth - 6, y + 26, { align: 'right' });

  y += 40;

  // Items Table
  const tableRows = quote.items.map((it, idx) => [
    String(idx + 1),
    it.designation + (it.reference ? ` (${it.reference})` : ''),
    `${it.quantity} ${it.unit || ''}`.trim(),
    getCurr(it.unitPrice, settings),
    it.discountPercent ? `${it.discountPercent} %` : '-',
    getCurr(it.total, settings),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Désignation', 'Qté', 'P.U.', 'Remise', 'Total']],
    body: tableRows,
    theme: 'striped',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [67, 56, 202],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || y + 50;
  const totalsWidth = 85;
  const totalsX = pageWidth - margin - totalsWidth;
  const totalsY = finalY + 8;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(totalsX, totalsY, totalsWidth, quote.vatAmount > 0 ? 38 : 30, 2, 2, 'FD');

  let curY = totalsY + 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text('Sous-total :', totalsX + 6, curY);
  doc.text(getCurr(quote.subtotal, settings), totalsX + totalsWidth - 6, curY, { align: 'right' });
  curY += 6;

  if (quote.discountTotal > 0) {
    doc.text('Remise globale :', totalsX + 6, curY);
    doc.text(`- ${getCurr(quote.discountTotal, settings)}`, totalsX + totalsWidth - 6, curY, { align: 'right' });
    curY += 6;
  }

  if (quote.vatAmount > 0) {
    doc.text(`TVA (${quote.vatRate} %) :`, totalsX + 6, curY);
    doc.text(getCurr(quote.vatAmount, settings), totalsX + totalsWidth - 6, curY, { align: 'right' });
    curY += 6;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(totalsX + 6, curY, totalsX + totalsWidth - 6, curY);
  curY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL DEVIS :', totalsX + 6, curY);
  doc.text(getCurr(quote.total, settings), totalsX + totalsWidth - 6, curY, { align: 'right' });

  // Notes & Acceptance signature
  const sigY = Math.max(curY + 18, finalY + 22);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Bon pour accord (Signature et mention "Bon pour accord") :', margin, sigY);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, sigY + 4, 75, 25);

  const footerY = 282;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Proposition commerciale valable selon date de validité indiquée', pageWidth / 2, footerY, { align: 'center' });

  const filename = `${quote.number}_${quote.clientName.replace(/\s+/g, '_')}.pdf`;

  if (action === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    return;
  }

  if (action === 'share' && navigator.share && navigator.canShare) {
    try {
      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Devis ${quote.number}`,
          text: `Devis ${quote.number} pour ${quote.clientName} - Total: ${getCurr(quote.total, settings)}`,
        });
        return;
      }
    } catch (e) {
      console.warn('Share cancelled or not supported', e);
    }
  }

  doc.save(filename);
}

/**
 * Generate and download, share, or print a professional thermal POS receipt (Ticket de caisse 58 mm ou 80 mm)
 */
export async function generateThermalReceiptPdf(
  invoice: Invoice,
  settings: CompanySettings,
  payments: PaymentRecord[] = [],
  format: '58mm' | '80mm' = '80mm',
  action: 'download' | 'share' | 'print' = 'download'
): Promise<void> {
  const is58 = format === '58mm';
  const pageWidth = is58 ? 58 : 80;
  const margin = is58 ? 3.5 : 5;
  const contentWidth = pageWidth - margin * 2;

  // Calculate dynamic roll height
  const baseHeight = 90;
  const itemsHeight = invoice.items.length * (is58 ? 7.5 : 6.5);
  const paymentsHeight = Math.max(1, payments.length) * 5;
  const notesHeight = (invoice.notes ? 8 : 0) + (settings.invoiceFooterNote ? 12 : 0);
  const totalHeight = Math.max(100, Math.ceil(baseHeight + itemsHeight + paymentsHeight + notesHeight));

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, totalHeight],
  });

  const curr = (n: number) => formatCurrency(n, settings.currency, settings.currencyPosition);
  let y = 6;

  // 1. STORE HEADER (Centered)
  doc.setFont('courier', 'bold');
  doc.setFontSize(is58 ? 9.5 : 12);
  doc.setTextColor(0, 0, 0);
  doc.text((settings.name || 'StockFacture Pro').toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += is58 ? 4 : 5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(is58 ? 7 : 8);

  if (settings.address) {
    const splitAddr = doc.splitTextToSize(settings.address, contentWidth);
    doc.text(splitAddr, pageWidth / 2, y, { align: 'center' });
    y += splitAddr.length * (is58 ? 3.2 : 3.8);
  }

  if (settings.phone) {
    doc.text(`Tél : ${settings.phone}`, pageWidth / 2, y, { align: 'center' });
    y += is58 ? 3.2 : 3.8;
  }

  if (settings.taxId) {
    doc.text(`NIF/RCCM : ${settings.taxId}`, pageWidth / 2, y, { align: 'center' });
    y += is58 ? 3.2 : 3.8;
  }

  // Dashed separator
  const separator = '-'.repeat(is58 ? 31 : 44);
  doc.text(separator, pageWidth / 2, y, { align: 'center' });
  y += is58 ? 3.5 : 4.5;

  // 2. TICKET METADATA
  doc.setFont('courier', 'bold');
  doc.setFontSize(is58 ? 7.5 : 8.5);
  doc.text(`TICKET : ${invoice.number}`, margin, y);
  y += is58 ? 3.5 : 4;

  doc.setFont('courier', 'normal');
  doc.setFontSize(is58 ? 6.5 : 7.5);
  const formattedDateTime = formatDateTime(invoice.date || invoice.createdAt);
  doc.text(`Date : ${formattedDateTime}`, margin, y);
  y += is58 ? 3.5 : 4;

  if (invoice.clientName && invoice.clientName.trim() && invoice.clientName !== 'Client comptant') {
    doc.text(`Client : ${invoice.clientName}`, margin, y);
    y += is58 ? 3.5 : 4;
    if (invoice.clientPhone) {
      doc.text(`Tél : ${invoice.clientPhone}`, margin, y);
      y += is58 ? 3.5 : 4;
    }
  }

  // Dashed separator
  doc.text(separator, pageWidth / 2, y, { align: 'center' });
  y += is58 ? 3.5 : 4.5;

  // 3. ARTICLES HEADER
  doc.setFont('courier', 'bold');
  doc.setFontSize(is58 ? 7 : 8);
  doc.text('Article', margin, y);
  doc.text('Qté x P.U', pageWidth - margin - (is58 ? 16 : 22), y, { align: 'right' });
  doc.text('Total', pageWidth - margin, y, { align: 'right' });
  y += is58 ? 3 : 3.5;
  doc.setFont('courier', 'normal');
  doc.text(separator, pageWidth / 2, y, { align: 'center' });
  y += is58 ? 3.5 : 4;

  // 4. ITEMS LIST
  invoice.items.forEach((item) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(is58 ? 6.8 : 7.8);
    const designation = item.designation.slice(0, is58 ? 26 : 38);
    doc.text(designation, margin, y);
    y += is58 ? 3 : 3.5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(is58 ? 6.5 : 7.2);
    const qtyPrice = `${item.quantity}${item.unit ? ` ${item.unit}` : ''} x ${formatCurrency(item.unitPrice, settings.currency, settings.currencyPosition)}`;
    const lineTotal = formatCurrency(item.total, settings.currency, settings.currencyPosition);
    doc.text(qtyPrice, margin + 2, y);
    doc.text(lineTotal, pageWidth - margin, y, { align: 'right' });
    y += is58 ? 3.8 : 4.2;
  });

  // Dashed separator
  doc.text(separator, pageWidth / 2, y, { align: 'center' });
  y += is58 ? 3.5 : 4.5;

  // 5. FINANCIAL TOTALS
  doc.setFont('courier', 'normal');
  doc.setFontSize(is58 ? 7 : 8);

  if (invoice.discountTotal > 0) {
    doc.text('Sous-total brut :', margin, y);
    doc.text(curr(invoice.subtotal), pageWidth - margin, y, { align: 'right' });
    y += is58 ? 3.2 : 3.8;

    doc.text('Remise déduite :', margin, y);
    doc.text(`-${curr(invoice.discountTotal)}`, pageWidth - margin, y, { align: 'right' });
    y += is58 ? 3.2 : 3.8;
  }

  if (invoice.vatAmount > 0) {
    doc.text(`TVA (${invoice.vatRate}%) :`, margin, y);
    doc.text(curr(invoice.vatAmount), pageWidth - margin, y, { align: 'right' });
    y += is58 ? 3.2 : 3.8;
  }

  // TOTAL NET
  doc.setFont('courier', 'bold');
  doc.setFontSize(is58 ? 9 : 10.5);
  doc.text('TOTAL NET :', margin, y + 1);
  doc.text(curr(invoice.total), pageWidth - margin, y + 1, { align: 'right' });
  y += is58 ? 5.5 : 6.5;

  // AMOUNT PAID & REMAINING
  doc.setFont('courier', 'bold');
  doc.setFontSize(is58 ? 7.5 : 8.5);
  doc.text('Montant Encaissé :', margin, y);
  doc.text(curr(invoice.amountPaid), pageWidth - margin, y, { align: 'right' });
  y += is58 ? 3.8 : 4.5;

  if (invoice.remainingAmount > 0) {
    doc.text('Reste à Payer :', margin, y);
    doc.text(curr(invoice.remainingAmount), pageWidth - margin, y, { align: 'right' });
    y += is58 ? 3.8 : 4.5;
  }

  // 6. PAYMENT MODES
  doc.setFont('courier', 'normal');
  doc.setFontSize(is58 ? 6.5 : 7.5);
  if (payments.length > 0) {
    payments.forEach((p) => {
      const modeLabel = getPaymentMethodLabel(p.method);
      doc.text(`Mode : ${modeLabel}`, margin, y);
      doc.text(curr(p.amount), pageWidth - margin, y, { align: 'right' });
      y += is58 ? 3.2 : 3.8;
    });
  } else {
    doc.text('Règlement comptant', margin, y);
    y += is58 ? 3.2 : 3.8;
  }

  // 7. FOOTER & NOTES
  doc.text(separator, pageWidth / 2, y, { align: 'center' });
  y += is58 ? 3.5 : 4.5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(is58 ? 6.5 : 7.2);
  const footerNote = settings.invoiceFooterNote || 'Merci pour votre confiance ! À bientôt.';
  const splitFooter = doc.splitTextToSize(footerNote, contentWidth);
  doc.text(splitFooter, pageWidth / 2, y, { align: 'center' });
  y += splitFooter.length * (is58 ? 3 : 3.5) + 3;

  doc.setFontSize(is58 ? 6 : 6.8);
  doc.text('*** StockFacture Pro ***', pageWidth / 2, y, { align: 'center' });

  // Filename
  const filename = `Ticket_${invoice.number}_${format}.pdf`;

  if (action === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
    return;
  }

  if (action === 'share' && navigator.share && navigator.canShare) {
    try {
      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Ticket de caisse ${invoice.number}`,
          text: `Ticket de caisse ${invoice.number} - Total: ${curr(invoice.total)}`,
        });
        return;
      }
    } catch (e) {
      console.warn('Share cancelled or not supported', e);
    }
  }

  doc.save(filename);
}
