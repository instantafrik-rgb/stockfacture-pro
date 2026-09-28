import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  Coins,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Package,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { runPhase5Tests, Phase5SuiteReport } from '../../utils/phase5Tests';

interface Phase5TestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Phase5TestModal: React.FC<Phase5TestModalProps> = ({ isOpen, onClose }) => {
  const { navigate } = useApp();
  const [report, setReport] = useState<Phase5SuiteReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'Marges & Rentabilité' | 'Ventes & Panier Moyen' | 'Clôture de Caisse (Z)' | 'Stocks & Produits'>('all');

  const executeTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const res = runPhase5Tests();
      setReport(res);
      setIsRunning(false);
    }, 350);
  };

  useEffect(() => {
    if (isOpen && !report) {
      executeTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredTests = report
    ? report.tests.filter((t) => selectedFilter === 'all' || t.category === selectedFilter)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Vérification & Tests • PHASE 5
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300">
                  Rapports, Marges & Clôtures Z
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Validation automatisée du CA, des marges réelles, du panier moyen et de la clôture de caisse
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Score & Summary Banner */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-indigo-500/10 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-xs ${
                report?.overallStatus === 'PASSED'
                  ? 'bg-cyan-600 text-white shadow-cyan-600/30'
                  : 'bg-rose-500 text-white'
              }`}>
                {report ? `${report.successRate}%` : '...'}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Statut de Conformité Phase 5
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  {report?.overallStatus === 'PASSED' ? (
                    <>
                      <span className="text-cyan-600 dark:text-cyan-400">100% Conforme & Validé</span>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </>
                  ) : (
                    <span>En cours de test...</span>
                  )}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  {report?.passedCount || 0} sur {report?.totalTests || 10} assertions validées avec succès
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={isRunning}
              onClick={executeTests}
              className="px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-2 self-start sm:self-auto"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Exécution...' : 'Relancer les tests'}</span>
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="px-5 pt-3 pb-2 flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 dark:border-slate-800 no-scrollbar">
          {(['all', 'Marges & Rentabilité', 'Ventes & Panier Moyen', 'Clôture de Caisse (Z)', 'Stocks & Produits'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedFilter === cat
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? 'Tous les tests' : cat}
            </button>
          ))}
        </div>

        {/* Tests List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {filteredTests.map((test) => (
            <div
              key={test.id}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <div className="mt-0.5">
                {test.passed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {test.name}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {test.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {test.durationMs}ms
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {test.message}
                </p>

                {test.details && (
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1 bg-white/60 dark:bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
                    {test.details}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-500" />
            <span>Phase 5 validée par le moteur de test</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-bold transition-colors"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('reports');
              }}
              className="px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <span>Accéder aux Rapports</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
