import { useState } from 'react';
import { useStore } from '../../store';
import { rollback } from '../../api/pipeline';
import { PHASE_DISPLAY_NAMES } from '../../types/pipeline';
import { getDownstreamPhases } from '../../utils/phaseUtils';
import { AlertTriangle, X, RotateCcw } from 'lucide-react';

interface Props {
  phaseKey: string;
  onClose: () => void;
}

export function RollbackModal({ phaseKey, onClose }: Props) {
  const projectId = useStore(s => s.projectId);
  const [newContext, setNewContext] = useState('');
  const [loading, setLoading] = useState(false);
  const downstream = getDownstreamPhases(phaseKey);

  const handleConfirm = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      await rollback(projectId, phaseKey, newContext.trim() || undefined);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4 p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw size={18} className="text-orange-500" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              Roll back to {PHASE_DISPLAY_NAMES[phaseKey]}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {downstream.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle size={14} className="text-orange-500" />
              <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                These phases will be invalidated and re-run:
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {downstream.map(key => (
                <span key={key} className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
                  {PHASE_DISPLAY_NAMES[key]}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            New context / direction (optional)
          </label>
          <textarea
            value={newContext}
            onChange={e => setNewContext(e.target.value)}
            placeholder={`Describe what you'd like to change in ${PHASE_DISPLAY_NAMES[phaseKey]}...`}
            className="w-full p-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            rows={4}
            autoFocus
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium flex items-center gap-1.5"
          >
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Rolling back…' : 'Confirm Rollback'}
          </button>
        </div>
      </div>
    </div>
  );
}
