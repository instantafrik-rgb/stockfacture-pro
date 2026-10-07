import React, { useState, useMemo } from 'react';
import {
  BadgeAlert,
  CreditCard,
  Search,
  Users,
  Calendar,
  AlertCircle,
  Clock,
  Phone,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  Receipt,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Invoice } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { PaymentModal } from '../components/modals/PaymentModal';
import { GlobalClientPaymentModal } from '../components/modals/GlobalClientPaymentModal';
import { ThermalReceiptModal } from '../components/modals/ThermalReceiptModal';
import {
  calculateAgingBalance,
  groupReceivablesByClient,
  isInvoiceOverdue,
  getDaysDifference,
  generatePaymentReminderMessage,
} from '../utils/receivables';

export const ReceivablesPage: React.FC = () => {
  const { state, navigate } = useApp();
  const { currency, currencyPosition, name: companyName } = state.settings;
  const curr = (val: number) => formatCurrency(val, currency, currencyPosition);

  const [activeTab, setActiveTab] = useState<'invoices' | 'clients'>('invoices');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);
  const [globalPaymentClient, setGlobalPaymentClient] = useState<{ clientId?: string; clientName: string } | null>(null);
  const [showGlobalPaymentModal, setShowGlobalPaymentModal] = useState(false);
  const [thermalInvoice, setThermalInvoice] = useState<Invoice | null>(null);

  // All unpaid or partial invoices that are not cancelled
  const receivableInvoices = useMemo(() => {
    return state.invoices.filter(
      (inv) => (inv.status === 'unpaid' || inv.status === 'partial') && inv.remainingAmount > 0
    );
  }, [state.invoices]);

  // Aging report
  const agingReport = useMemo(() => {
    return calculateAgingBalance(receivableInvoices);
  }, [receivableInvoices]);

  // Grouped by client
  const clientSummaries = useMemo(() => {
    return groupReceivablesByClient(receivableInvoices);
  }, [receivableInvoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return receivableInvoices.filter((inv) => {
      const isOverdue = isInvoiceOverdue(inv);
      if (filterOverdueOnly && !isOverdue) return false;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        inv.number.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        (inv.clientPhone && inv.clientPhone.toLowerCase().includes(q))
      );
    });
  }, [receivableInvoices, filterOverdueOnly, searchQuery]);

  // Filtered client summaries
  const filteredClientSummaries = useMemo(() => {
    return clientSummaries.filter((client) => {
      if (filterOverdueOnly && !client.hasOverdue) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        client.clientName.toLowerCase().includes(q) ||
        (client.clientPhone && client.clientPhone.toLowerCase().includes(q))
      );
    });
  }, [clientSummaries, filterOverdueOnly, searchQuery]);

  // Handle WhatsApp reminder
  const handleSendWhatsApp = (inv: Invoice) => {
    if (!inv.clientPhone) return;
    const cleanPhone = inv.clientPhone.replace(/[^0-9]/g, '');
    const message = generatePaymentReminderMessage(inv, companyName || 'Notre boutique', currency, {
      tone: isInvoiceOverdue(inv) ? 'firm' : 'courteous',
    });
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleCopyReminder = (inv: Invoice) => {
    const message = generatePaymentReminderMessage(inv, companyName || 'Notre boutique', currency, {
      tone: isInvoiceOverdue(inv) ? 'firm' : 'courteous',
    });
    navigator.clipboard.writeText(message);
    setCopiedInvoiceId(inv.id);
    setTimeout(() => setCopiedInvoiceId(null), 2500);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#14213D] dark:text-white tracking-tight">
            Créances & Recouvrement
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
            Échéancier, balance âgée des impayés, relances clients & encaissements partiels
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => {
              setGlobalPaymentClient(null);
              setShowGlobalPaymentModal(true);
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-amber-600/20 transition-transform active:scale-95 min-h-[44px] cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Régler une créance (Global)</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('invoices')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-transform active:scale-95 min-h-[44px]"
          >
            <span>Toutes les factures</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Aging Balance Cards (4 Buckets + Total) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Receivables Card */}
        <div className="col-span-2 sm:col-span-1 p-4 rounded-3xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Créances</span>
            <BadgeAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-950 dark:text-amber-200">
              {curr(agingReport.totalDue)}
            </div>
            <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
              {agingReport.totalInvoicesCount} facture(s) • {clientSummaries.length} client(s)
            </div>
          </div>
        </div>

        {/* Bucket 1: Not Due Yet */}
        <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">À Échoir (Dans les temps)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black font-mono text-slate-900 dark:text-white">
              {curr(agingReport.notDue.amount)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {agingReport.notDue.count} dossier(s) non échus
            </div>
          </div>
        </div>

        {/* Bucket 2: 1-30 Days Overdue */}
        <div className="p-4 rounded-3xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Retard 1 à 30 j</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black font-mono text-amber-900 dark:text-amber-300">
              {curr(agingReport.overdue1to30.amount)}
            </div>
            <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
              {agingReport.overdue1to30.count} dossier(s) à relancer
            </div>
          </div>
        </div>

        {/* Bucket 3: 31-60 Days Overdue */}
        <div className="p-4 rounded-3xl bg-orange-500/10 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-orange-700 dark:text-orange-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Retard 31 à 60 j</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black font-mono text-orange-900 dark:text-orange-300">
              {curr(agingReport.overdue31to60.amount)}
            </div>
            <div className="text-[10px] text-orange-700/80 dark:text-orange-400/80 mt-0.5">
              {agingReport.overdue31to60.count} relance(s) ferme(s)
            </div>
          </div>
        </div>

        {/* Bucket 4: > 60 Days Overdue (Critical) */}
        <div className="p-4 rounded-3xl bg-rose-500/10 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Retard &gt; 60 j</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black font-mono text-rose-900 dark:text-rose-300">
              {curr(agingReport.overdueOver60.amount)}
            </div>
            <div className="text-[10px] text-rose-700/80 dark:text-rose-400/80 mt-0.5">
              {agingReport.overdueOver60.count} contentieux / critique
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search Bar, Tabs & Quick Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'invoices'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Vue Factures ({receivableInvoices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clients')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'clients'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Vue Débiteurs ({clientSummaries.length})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'invoices' ? 'N° facture, client...' : 'Nom client, tél...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterOverdueOnly(!filterOverdueOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              filterOverdueOnly
                ? 'bg-rose-500 text-white border-rose-500'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            Retards seuls ({agingReport.totalOverdue > 0 ? curr(agingReport.totalOverdue) : '0'})
          </button>
        </div>
      </div>

      {/* 4. Tab 1: Invoices View */}
      {activeTab === 'invoices' && (
        <>
          {filteredInvoices.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Aucune créance correspondante
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {filterOverdueOnly
                  ? 'Aucune facture en retard d’échéance pour ce filtre.'
                  : 'Toutes les factures sont soldées ou aucun résultat trouvé.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((inv) => {
                const daysOverdue = getDaysDifference(inv.dueDate);
                const isOverdue = daysOverdue > 0;

                return (
                  <div
                    key={inv.id}
                    className={`p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      isOverdue
                        ? daysOverdue > 60
                          ? 'border-rose-400 dark:border-rose-800 bg-rose-500/5'
                          : 'border-amber-300 dark:border-amber-800 bg-amber-500/5'
                        : 'border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {inv.number}
                        </span>
                        <StatusBadge status={inv.status} />

                        {isOverdue ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/60 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Retard de {daysOverdue} jour{daysOverdue > 1 ? 's' : ''}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Échéance dans {-daysOverdue} jour{-daysOverdue > 1 ? 's' : ''}</span>
                          </span>
                        )}
                      </div>

                      <h4
                        onClick={() => navigate('invoices', inv.id)}
                        className="text-base font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 transition-colors"
                      >
                        {inv.clientName}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        {inv.clientPhone && <span>Tél : {inv.clientPhone}</span>}
                        <span>Émise le {formatDate(inv.date)}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Échéance : {formatDate(inv.dueDate)}
                        </span>
                      </div>
                    </div>

                    {/* Financial Summary & Actions */}
                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800 shrink-0">
                      <div className="text-left lg:text-right">
                        <div className="text-xs text-slate-400">
                          Total : {curr(inv.total)} • Acompte : {curr(inv.amountPaid)}
                        </div>
                        <div className="text-lg font-mono font-black text-rose-600 dark:text-rose-400 mt-0.5">
                          Reste à régler : {curr(inv.remainingAmount)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {inv.clientPhone && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSendWhatsApp(inv)}
                              title="Envoyer une relance par WhatsApp"
                              className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>

                            <a
                              href={`tel:${inv.clientPhone}`}
                              title="Appeler le client"
                              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopyReminder(inv)}
                          title="Copier le message de relance"
                          className="px-2.5 py-2 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors min-h-[44px] flex items-center gap-1"
                        >
                          <span>{copiedInvoiceId === inv.id ? 'Copié !' : 'Relance'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setThermalInvoice(inv)}
                          title="Imprimer le ticket de caisse thermique"
                          className="p-2.5 rounded-xl border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/40 hover:bg-orange-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceForPayment(inv)}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 min-h-[44px]"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Encaisser</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 5. Tab 2: Clients Summary View */}
      {activeTab === 'clients' && (
        <div className="space-y-3">
          {filteredClientSummaries.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <Users className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Aucun client débiteur trouvé
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredClientSummaries.map((client, idx) => (
                <div
                  key={client.clientName + idx}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {client.clientName}
                        </h4>
                        {client.hasOverdue && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            En retard
                          </span>
                        )}
                      </div>
                      {client.clientPhone && (
                        <p className="text-xs text-slate-500 mt-0.5">Tél : {client.clientPhone}</p>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400">Total dû</div>
                      <div className="text-lg font-mono font-black text-rose-600 dark:text-rose-400">
                        {curr(client.totalRemaining)}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                    <div>
                      <span className="font-bold">{client.invoicesCount}</span> facture(s) impayée(s)
                    </div>
                    <div>
                      Plus ancienne échéance : <span className="font-bold">{formatDate(client.oldestDueDate)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    {client.clientPhone && (
                      <a
                        href={`tel:${client.clientPhone}`}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Appeler</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery(client.clientName);
                        setActiveTab('invoices');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-1.5"
                    >
                      <span>Factures</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setGlobalPaymentClient({
                          clientId: client.clientId,
                          clientName: client.clientName,
                        });
                        setShowGlobalPaymentModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold transition-all active:scale-95 shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Régler la créance</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {selectedInvoiceForPayment && (
        <PaymentModal
          invoice={selectedInvoiceForPayment}
          isOpen={Boolean(selectedInvoiceForPayment)}
          onClose={() => setSelectedInvoiceForPayment(null)}
        />
      )}

      {/* Global Client Debt Settlement Modal (FIFO) */}
      {showGlobalPaymentModal && (
        <GlobalClientPaymentModal
          isOpen={showGlobalPaymentModal}
          onClose={() => {
            setShowGlobalPaymentModal(false);
            setGlobalPaymentClient(null);
          }}
          defaultClientId={globalPaymentClient?.clientId}
          defaultClientName={globalPaymentClient?.clientName}
        />
      )}

      {/* Thermal POS Receipt Modal */}
      {thermalInvoice && (
        <ThermalReceiptModal
          isOpen={Boolean(thermalInvoice)}
          onClose={() => setThermalInvoice(null)}
          invoice={thermalInvoice}
        />
      )}
    </div>
  );
};
