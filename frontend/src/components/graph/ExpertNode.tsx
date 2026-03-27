import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CheckCircle, AlertCircle, Clock, RefreshCw, Loader } from 'lucide-react';
import type { PhaseStatus } from '../../types/pipeline';
import { PHASE_DISPLAY_NAMES } from '../../types/pipeline';
import type { ModelAssignment } from '../../store';

interface NodeData {
  phase_key: string;
  status: PhaseStatus;
  iteration: number;
  isActive: boolean;
  modelAssignment: ModelAssignment | null;
  [key: string]: unknown;
}

const statusConfig: Record<PhaseStatus, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
  pending:         { bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-300 dark:border-slate-600', icon: <Clock size={14} className="text-slate-400" />, label: 'Pending' },
  running:         { bg: 'bg-indigo-50 dark:bg-indigo-950', border: 'border-indigo-400', icon: <Loader size={14} className="text-indigo-500 animate-spin" />, label: 'Running' },
  awaiting_choice: { bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-400', icon: <Clock size={14} className="text-amber-500" />, label: 'Awaiting Choice' },
  complete:        { bg: 'bg-emerald-50 dark:bg-emerald-950', border: 'border-emerald-400', icon: <CheckCircle size={14} className="text-emerald-500" />, label: 'Complete' },
  rolled_back:     { bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-400', icon: <RefreshCw size={14} className="text-orange-500" />, label: 'Rolled Back' },
  error:           { bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-400', icon: <AlertCircle size={14} className="text-red-500" />, label: 'Error' },
};

function modelBadgeText(a: ModelAssignment): string {
  const { provider, model } = a;
  if (provider === 'anthropic') {
    if (model.includes('opus'))   return 'C·Opus';
    if (model.includes('sonnet')) return 'C·Sonnet';
    if (model.includes('haiku'))  return 'C·Haiku';
    return 'C·?';
  }
  if (model.includes('3.1-pro'))       return 'G·3.1 Pro';
  if (model.includes('3-flash'))       return 'G·3 Flash';
  if (model.includes('3.1-flash'))     return 'G·3.1 Lite';
  if (model.includes('2.5-pro'))       return 'G·2.5 Pro';
  if (model.includes('2.5-flash'))     return 'G·2.5 Flash';
  return 'G·?';
}

export function ExpertNode({ data }: NodeProps) {
  const nodeData = data as NodeData;
  const cfg = statusConfig[nodeData.status] ?? statusConfig.pending;
  const name = PHASE_DISPLAY_NAMES[nodeData.phase_key] ?? nodeData.phase_key;
  const isActive = nodeData.isActive;

  return (
    <div
      className={`
        relative px-3 py-2 rounded-lg border-2 text-sm font-medium min-w-[140px] text-center
        transition-all duration-300
        ${cfg.bg} ${cfg.border}
        ${isActive ? 'shadow-lg shadow-indigo-200 dark:shadow-indigo-900 scale-105' : 'shadow-sm'}
      `}
    >
      {isActive && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-500 animate-ping" />
      )}
      <Handle type="target" position={Position.Top} className="!bg-slate-300 dark:!bg-slate-600" />
      <div className="flex items-center gap-1.5 justify-center">
        {cfg.icon}
        <span className="text-slate-700 dark:text-slate-200">{name}</span>
      </div>
      {nodeData.iteration > 1 && (
        <span className="text-xs text-slate-400 dark:text-slate-500">v{nodeData.iteration}</span>
      )}
      {nodeData.modelAssignment && (
        <span className={`
          text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 inline-block font-medium
          ${nodeData.modelAssignment.provider === 'anthropic'
            ? 'bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300'
            : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300'
          }
        `}>
          {modelBadgeText(nodeData.modelAssignment)}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-300 dark:!bg-slate-600" />
    </div>
  );
}
