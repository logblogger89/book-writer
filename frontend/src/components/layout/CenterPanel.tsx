import { useState, useEffect } from 'react';
import { Loader, Sparkles } from 'lucide-react';
import { StreamLog } from '../stream/StreamLog';
import { ChoicePanel } from '../choice/ChoicePanel';
import { InterruptBar } from '../interrupt/InterruptBar';
import { useStore } from '../../store';
import { PHASE_DISPLAY_NAMES } from '../../types/pipeline';

interface Props {
  onInterrupt: (phaseKey: string, message: string) => void;
}

export function CenterPanel({ onInterrupt }: Props) {
  const pendingChoice = useStore(s => s.pendingChoice);
  const activePhase = useStore(s => s.activePhase);
  const allMessages = useStore(s => s.allMessages);
  const projectStatus = useStore(s => s.projectStatus);
  const [showLogs, setShowLogs] = useState(false);

  // When a choice arrives, always surface it (hide logs)
  useEffect(() => {
    if (pendingChoice) setShowLogs(false);
  }, [pendingChoice]);

  const hasLogs = allMessages.length > 0 || !!activePhase;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">

      {/* Slim header — always visible */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 h-10">

        {/* Left: context label */}
        {pendingChoice && !showLogs ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Sparkles size={11} />
            Choose a direction
          </span>
        ) : showLogs ? (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Logs</span>
        ) : activePhase ? (
          <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Loader size={10} className="animate-spin" />
            {PHASE_DISPLAY_NAMES[activePhase] ?? activePhase}
          </span>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {projectStatus === 'complete' ? '✓ Complete' : 'Pipeline idle'}
          </span>
        )}

        {/* Right: logs toggle */}
        {hasLogs && (
          <button
            onClick={() => setShowLogs(v => !v)}
            className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors px-1.5 py-0.5 rounded"
          >
            {showLogs ? 'Hide logs' : 'Logs'}
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {showLogs ? (
          <StreamLog />
        ) : pendingChoice ? (
          <ChoicePanel />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="text-2xl text-slate-200 dark:text-slate-700 select-none">✦</span>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {projectStatus === 'complete'
                ? 'Pipeline complete'
                : activePhase
                  ? 'Artifact will appear in the viewer'
                  : 'Start the pipeline to begin'}
            </p>
          </div>
        )}
      </div>

      {/* Always-visible interrupt bar */}
      <InterruptBar onSend={onInterrupt} />
    </div>
  );
}
