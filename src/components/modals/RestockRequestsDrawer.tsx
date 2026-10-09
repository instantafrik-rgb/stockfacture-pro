import React, { useState, useMemo } from 'react';
import {
  X,
  BellRing,
  Search,
  Phone,
  MessageSquare,
  CheckCircle2,
  Trash2,
  Sparkles,
  Package,
  Calendar,
  AlertCircle,
  Plus,
  Check,
  Ban,
  Clock,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { RestockRequest, RestockRequestStatus } from '../../types';
import { formatDate } from '../../utils/formatters';
import { RestockRequestModal } from './RestockRequestModal';

interface RestockRequestsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProductId?: string;
}

export const RestockRequestsDrawer: React.FC<RestockRequestsDrawerProps> = ({
  isOpen,
  onClose,
  defaultProductId,
}) => {
  const { state, updateRestockRequestStatus, deleteRestockRequest } = useApp();
  const { name: companyName } = state.settings;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RestockRequestStatus>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalProductId, setAddModalProductId] = useState<string | undefined>(defaultProductId);

  const requests = useMemo(() => {
    return state.restockRequests || [];
  }, [state.restockRequests]);

  // Map product stock for instant lookup
  const productStockMap = useMemo(() => {
    const map = new Map<string, { stockQuantity: number; unit: string }>();
    state.products.forEach((p) => {
      map.set(p.id, { stockQuantity: p.stockQuantity, unit: p.unit });
    });
    return map;
  }, [state.products]);

  // Counts
  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      available: requests.filter((r) => {
        const prod = productStockMap.get(r.productId);
        return r.status === 'available' || (r.status === 'pending' && prod && prod.stockQuantity > 0);
      }).length,
      contacted: requests.filter((r) => r.status === 'contacted').length,
      cancelled: requests.filter((r) => r.status === 'cancelled').length,
    };
  }, [requests, productStockMap]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const prod = productStockMap.get(r.productId);
      const isActuallyAvailable = prod && prod.stockQuantity > 0;

      if (statusFilter === 'available') {
        if (r.status !== 'available' && !(r.status === 'pending' && isActuallyAvailable)) {
          return false;
        }
      } else if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }

      if (defaultProductId && r.productId !== defaultProductId) {
        return false;
      }

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        r.clientName.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        (r.clientPhone && r.clientPhone.toLowerCase().includes(q)) ||
        (r.note && r.note.toLowerCase().includes(q))
      );
    });
  }, [requests, statusFilter, defaultProductId, searchQuery, productStockMap]);

  if (!isOpen) return null;

  // Manual WhatsApp trigger (User action strictly required)
  const handleSendWhatsApp = (req: RestockRequest) => {
    if (!req.clientPhone) return;
    const cleanPhone = req.clientPhone.replace(/[^0-9]/g, '');
    const prod = productStockMap.get(req.productId);
    const stockQty = prod ? prod.stockQuantity : 0;

    let msg = `Bonjour ${req.clientName}, `;
    if (stockQty > 0 || req.status === 'available') {
      msg += `bonne nouvelle ! Le produit "${req.productName}" que vous attendiez est de nouveau disponible en magasin chez ${companyName || 'notre boutique'} (Quantité souhaitée : ${req.desiredQuantity}). Souhaitez-vous que nous vous le réservions ?`;
    } else {
      msg += `nous faisons suite à votre demande concernant "${req.productName}". Nous attendons le réassort très prochainement et vous tiendrons informé en priorité !`;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleStatusChange = async (req: RestockRequest, newStatus: RestockRequestStatus) => {
    await updateRestockRequestStatus(req.id, newStatus);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Voulez-vous supprimer cette demande de relance ?')) {
      await deleteRestockRequest(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[92vh]">
        
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Clients à Relancer (Ruptures & Réassorts)
                </h3>
                {counts.available > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse">
                    {counts.available} dispo en stock !
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Liste des clients en attente d'un article en rupture de stock
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setAddModalProductId(defaultProductId);
                setShowAddModal(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Ajouter</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar & Search */}
        <div className="p-3.5 sm:px-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par client, article, téléphone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 shadow-xs"
            />
          </div>

          {/* Status filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Tous ({counts.all})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('available')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'available'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>De retour en stock ({counts.available})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              À relancer ({counts.pending})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('contacted')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                statusFilter === 'contacted'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Contacté ({counts.contacted})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                statusFilter === 'cancelled'
                  ? 'bg-slate-500 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Clôturé ({counts.cancelled})
            </button>
          </div>
        </div>

        {/* Requests list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Aucune demande trouvée
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `Aucun résultat pour "${searchQuery}".`
                  : 'Aucun client en attente pour ce filtre. Vous pouvez noter un client dès qu’un article manque.'}
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const prod = productStockMap.get(req.productId);
              const currentStock = prod ? prod.stockQuantity : 0;
              const unit = prod ? prod.unit : 'pcs';
              const isInStockNow = currentStock > 0;

              return (
                <div
                  key={req.id}
                  className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border shadow-xs transition-all space-y-3 ${
                    isInStockNow && req.status !== 'contacted' && req.status !== 'cancelled'
                      ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-500/5 ring-1 ring-emerald-400/40'
                      : req.status === 'pending'
                      ? 'border-amber-300/80 dark:border-amber-900/60'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Top row: Product info & Stock alert */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                          {req.productName}
                        </span>

                        {isInStockNow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>En rayon ({currentStock} {unit})</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/60">
                            En rupture (0 {unit})
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                        <span>Quantité souhaitée : <strong className="text-slate-800 dark:text-slate-200">{req.desiredQuantity} {unit}</strong></span>
                        <span>•</span>
                        <span>Demande reçue le {formatDate(req.requestDate)}</span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-black shrink-0 ${
                        req.status === 'available' || (isInStockNow && req.status === 'pending')
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : req.status === 'contacted'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                          : req.status === 'cancelled'
                          ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                      }`}
                    >
                      {req.status === 'available' || (isInStockNow && req.status === 'pending')
                        ? '🟢 Produit disponible'
                        : req.status === 'contacted'
                        ? '💬 Contacté'
                        : req.status === 'cancelled'
                        ? '⚪ Clôturé'
                        : '⏳ À relancer'}
                    </span>
                  </div>

                  {/* Middle row: Client info & note */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {req.clientName}
                      </span>
                      {req.clientPhone && (
                        <span className="text-slate-500 ml-2">({req.clientPhone})</span>
                      )}
                      {req.note && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 italic mt-0.5">
                          "{req.note}"
                        </p>
                      )}
                    </div>

                    {/* Contact Actions (strictly user-initiated) */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                      {req.clientPhone ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSendWhatsApp(req)}
                            className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors flex items-center gap-1 text-[11px] font-bold"
                            title="Envoyer un message WhatsApp au client"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </button>

                          <a
                            href={`tel:${req.clientPhone}`}
                            className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors flex items-center gap-1 text-[11px] font-bold"
                            title="Appeler le client"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Appeler</span>
                          </a>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Sans numéro</span>
                      )}
                    </div>
                  </div>

                  {/* Bottom row: status switcher & delete */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-400 font-bold">Changer état :</span>

                      {req.status !== 'contacted' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(req, 'contacted')}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-100"
                        >
                          Marquer "Contacté"
                        </button>
                      )}

                      {req.status !== 'available' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(req, 'available')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-100"
                        >
                          Marquer "Disponible"
                        </button>
                      )}

                      {req.status !== 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(req, 'pending')}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold hover:bg-amber-100"
                        >
                          Remettre "À relancer"
                        </button>
                      )}

                      {req.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(req, 'cancelled')}
                          className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                        >
                          Clôturer
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(req.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-auto"
                      title="Supprimer la demande"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Add Request Modal */}
      {showAddModal && (
        <RestockRequestModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          defaultProductId={addModalProductId}
        />
      )}
    </div>
  );
};
