import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { StreamMessageBubble } from './StreamMessage';
import { PHASE_DISPLAY_NAMES } from '../../types/pipeline';
import { Loader } from 'lucide-react';

export function StreamLog() {
  const allMessages = useStore(s => s.allMessages);
  const phases = useStore(s => s.phases);
  const activePhase = useStore(s => s.activePhase);
  const rateLimitWaiting = useStore(s => s.rateLimitWaiting);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, activePhase && phases[activePhase]?.streamBuffer]);

  const activeBuffer = activePhase ? phases[activePhase]?.streamBuffer : '';

  if (allMessages.length === 0 && !activeBuffer) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        <div className="text-center">
          <div className="text-4xl mb-3">✦</div>
          <p>Expert conversations will appear here</p>
          <p className="text-xs mt-1">Start the pipeline to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {allMessages.map(msg => (
        <StreamMessageBubble key={msg.id} msg={msg} />
      ))}

      {rateLimitWaiting && (
        <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
          <Loader size={14} className="animate-spin shrink-0" />
          Rate limit reached — waiting {rateLimitWaiting.seconds}s before resuming{rateLimitWaiting.phase_key ? ` (${PHASE_DISPLAY_NAMES[rateLimitWaiting.phase_key] ?? rateLimitWaiting.phase_key})` : ''}...
        </div>
      )}

      {activePhase && activeBuffer && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 flex items-center gap-1">
              <Loader size={10} className="animate-spin" />
              {PHASE_DISPLAY_NAMES[activePhase] ?? activePhase}
            </span>
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed streaming-cursor">
            {activeBuffer}
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
