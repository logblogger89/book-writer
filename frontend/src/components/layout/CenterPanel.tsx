import { useState, useEffect } from 'react';
import { StreamLog } from '../stream/StreamLog';
import { ChoicePanel } from '../choice/ChoicePanel';
import { InterruptBar } from '../interrupt/InterruptBar';
import { useStore } from '../../store';

interface Props {
  onInterrupt: (phaseKey: string, message: string) => void;
}

type ActiveTab = 'choices' | 'stream';

function TabBtn({ active, onClick, label, accent }: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent: 'amber' | 'indigo';
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 py-2 text-xs font-medium border-b-2 transition-colors
        ${active && accent === 'amber'
          ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
          : active
          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
          : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
        }
      `}
    >
      {label}
    </button>
  );
}

export function CenterPanel({ onInterrupt }: Props) {
  const pendingChoice = useStore(s => s.pendingChoice);
  const [activeTab, setActiveTab] = useState<ActiveTab>('choices');

  // Auto-switch to choices tab whenever a new choice arrives
  useEffect(() => {
    if (pendingChoice) setActiveTab('choices');
  }, [pendingChoice]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Tab bar — only shown when a choice is pending */}
      {pendingChoice && (
        <div className="flex border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <TabBtn active={activeTab === 'choices'} onClick={() => setActiveTab('choices')} label="Choices" accent="amber" />
          <TabBtn active={activeTab === 'stream'} onClick={() => setActiveTab('stream')} label="Stream" accent="indigo" />
        </div>
      )}

      {/* StreamLog: always mounted to preserve scroll/state, hidden when showing Choices tab */}
      <div className={`min-h-0 ${pendingChoice && activeTab === 'choices' ? 'hidden' : 'flex-1 flex flex-col'}`}>
        <StreamLog />
      </div>

      {/* ChoicePanel: shown in Choices tab, scrollable */}
      {pendingChoice && activeTab === 'choices' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ChoicePanel />
        </div>
      )}

      {/* Always-visible interrupt bar */}
      <InterruptBar onSend={onInterrupt} />
    </div>
  );
}
