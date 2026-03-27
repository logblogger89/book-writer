import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

interface LoopGroupNodeData {
  label: string;
  progress?: string; // e.g. "Chapter 3 / 24"
  isActive?: boolean;
  [key: string]: unknown;
}

export const LoopGroupNode = memo(function LoopGroupNode({ data }: NodeProps) {
  const d = data as unknown as LoopGroupNodeData;
  return (
    <div
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      className={`
        rounded-xl border-2 border-dashed flex flex-col items-end justify-end p-1.5
        ${d.isActive
          ? 'border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/30'
          : 'border-slate-300 bg-slate-50/30 dark:border-slate-600 dark:bg-slate-800/20'
        }
      `}
    >
      <div className="flex items-center gap-1">
        {/* loop arrow icon */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={d.isActive ? 'text-indigo-400' : 'text-slate-400'}>
          <path
            d="M9 2.5A4.5 4.5 0 1 0 10.5 6"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          />
          <path
            d="M10.5 2.5V5.5H7.5"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        <span className={`text-[10px] font-semibold tracking-wide uppercase ${d.isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
          {d.label}
        </span>
        {d.progress && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-0.5">
            ({d.progress})
          </span>
        )}
      </div>
    </div>
  );
});
