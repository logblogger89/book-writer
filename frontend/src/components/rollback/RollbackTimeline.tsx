import { useState } from 'react';
import { useStore } from '../../store';
import { PHASE_ORDER, PHASE_DISPLAY_NAMES } from '../../types/pipeline';
import { RollbackModal } from './RollbackModal';
import { CheckCircle, Clock, Loader, RotateCcw, AlertCircle, RefreshCw } from 'lucide-react';

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'complete': return <CheckCircle size={12} className="text-emerald-500" />;
    case 'running': return <Loader size={12} className="text-indigo-500 animate-spin" />;
    case 'rolled_back': return <RefreshCw size={12} className="text-orange-500" />;
    case 'error': return <AlertCircle size={12} className="text-red-500" />;
    default: return <Clock size={12} className="text-slate-300 dark:text-slate-600" />;
  }
};

export function RollbackTimeline() {
  const phases = useStore(s => s.phases);
  const [rollbackPhase, setRollbackPhase] = useState<string | null>(null);

  return (
    <div className="px-3 py-2">
      <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
        Phase Timeline
      </h3>
      <div className="space-y-1">
        {PHASE_ORDER.map(key => {
          const phase = phases[key];
          const status = phase?.status ?? 'pending';
          const canRollback = status === 'complete' || status === 'rolled_back';

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-1 py-1"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <StatusIcon status={status} />
                <span className={`text-xs truncate ${status === 'pending' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                  {PHASE_DISPLAY_NAMES[key]}
                </span>
              </div>
              {canRollback && (
                <button
                  onClick={() => setRollbackPhase(key)}
                  className="p-0.5 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 text-slate-400 hover:text-orange-500 transition-colors flex-shrink-0"
                  title={`Roll back to ${PHASE_DISPLAY_NAMES[key]}`}
                >
                  <RotateCcw size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {rollbackPhase && (
        <RollbackModal
          phaseKey={rollbackPhase}
          onClose={() => setRollbackPhase(null)}
        />
      )}
    </div>
  );
}
