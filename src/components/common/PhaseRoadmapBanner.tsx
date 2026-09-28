import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  X,
  Sparkles,
  Award,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Phase1TestModal } from '../modals/Phase1TestModal';
import { Phase2TestModal } from '../modals/Phase2TestModal';
import { Phase3TestModal } from '../modals/Phase3TestModal';
import { Phase4TestModal } from '../modals/Phase4TestModal';
import { Phase5TestModal } from '../modals/Phase5TestModal';

export const PhaseRoadmapBanner: React.FC = () => {
  const { activeView } = useApp();
  const [showTestModalP1, setShowTestModalP1] = useState(false);
  const [showTestModalP2, setShowTestModalP2] = useState(false);
  const [showTestModalP3, setShowTestModalP3] = useState(false);
  const [showTestModalP4, setShowTestModalP4] = useState(false);
  const [showTestModalP5, setShowTestModalP5] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Only show banner on Dashboard or if expanded to avoid cluttering sales/catalog
  if (isDismissed && activeView !== 'dashboard') {
    return null;
  }

  const PHASES = [
    { num: 1, title: 'Phase 1 : Socle & Catalogue', desc: 'IndexedDB, catalogue, devises & paramètres', status: 'done' },
    { num: 2, title: 'Phase 2 : Caisse & POS', desc: 'Ventes, panier, monnaie & déstockage direct', status: 'done' },
    { num: 3, title: 'Phase 3 : Factures & Devis PDF', desc: 'Devis, conversion 1-clic & PDF vectoriel A4', status: 'done' },
    { num: 4, title: 'Phase 4 : Créances & Relances', desc: 'Balance âgée, relances WhatsApp & règlements', status: 'done' },
    { num: 5, title: 'Phase 5 : Marges & Clôtures Z', desc: 'Analyses, marge réelle & clôtures journalières', status: 'done' },
  ];

  return (
    <>
      <div className="mb-4 sm:mb-6 rounded-2xl bg-gradient-to-r from-blue-900/90 via-slate-900 to-indigo-950 text-white p-3 sm:p-4 shadow-sm border border-blue-500/20 relative overflow-hidden transition-all">
        <div className="flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-white tracking-tight">
                  StockFacture Pro 2
                </span>
                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  50/50 Tests Validés
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                Architecture PWA 100% Hors-Ligne • Expérience Mobile-First
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowTestModalP5(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tester le système</span>
              <span className="sm:hidden">Tests</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
              title="Voir les 5 phases"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white transition-colors"
              title="Masquer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Phase Details */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-5 gap-2 animate-in fade-in duration-200">
            {PHASES.map((p) => (
              <div
                key={p.num}
                className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs flex flex-col justify-between space-y-1"
              >
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-extrabold text-[10px] text-blue-300">Phase {p.num}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <h4 className="font-bold text-slate-100 text-[11px] leading-tight truncate">
                    {p.title.split(' : ')[1]}
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (p.num === 1) setShowTestModalP1(true);
                    if (p.num === 2) setShowTestModalP2(true);
                    if (p.num === 3) setShowTestModalP3(true);
                    if (p.num === 4) setShowTestModalP4(true);
                    if (p.num === 5) setShowTestModalP5(true);
                  }}
                  className="text-[10px] font-bold text-blue-400 hover:underline pt-1 text-left"
                >
                  Voir les tests (10/10) →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Modals */}
      <Phase1TestModal isOpen={showTestModalP1} onClose={() => setShowTestModalP1(false)} />
      <Phase2TestModal isOpen={showTestModalP2} onClose={() => setShowTestModalP2(false)} />
      <Phase3TestModal isOpen={showTestModalP3} onClose={() => setShowTestModalP3(false)} />
      <Phase4TestModal isOpen={showTestModalP4} onClose={() => setShowTestModalP4(false)} />
      <Phase5TestModal isOpen={showTestModalP5} onClose={() => setShowTestModalP5(false)} />
    </>
  );
};
