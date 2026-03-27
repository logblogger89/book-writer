import { useState } from 'react';
import { useStore } from '../../store';
import { PHASE_DISPLAY_NAMES } from '../../types/pipeline';
import { MessageSquarePlus } from 'lucide-react';

interface Props {
  onSend: (phaseKey: string, message: string) => void;
}

export function InterruptBar({ onSend }: Props) {
  const activePhase = useStore(s => s.activePhase);
  const projectStatus = useStore(s => s.projectStatus);
  const [text, setText] = useState('');

  const isActive = projectStatus === 'running' && activePhase;

  const handleSend = () => {
    if (!text.trim() || !activePhase) return;
    onSend(activePhase, text.trim());
    setText('');
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <div className="flex gap-2 items-center">
        <MessageSquarePlus size={16} className={isActive ? 'text-indigo-400' : 'text-slate-300 dark:text-slate-600'} />
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={!isActive}
          placeholder={
            isActive
              ? `Add your thoughts to ${PHASE_DISPLAY_NAMES[activePhase!] ?? activePhase}...`
              : 'Start the pipeline to inject your thoughts'
          }
          className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button
          onClick={handleSend}
          disabled={!isActive || !text.trim()}
          className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Inject
        </button>
      </div>
    </div>
  );
}
