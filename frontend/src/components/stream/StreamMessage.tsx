import { PHASE_DISPLAY_NAMES } from '../../types/pipeline';
import type { StreamMessage as Msg } from '../../types/pipeline';

const PHASE_COLORS: Record<string, string> = {
  logline_creator:       'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  world_builder:         'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  scientific_advisor:    'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  persona_creator:       'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  chapter_beats_creator: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  scene_outliner:        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  prose_writer:          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  continuity_editor:     'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  literary_editor:       'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
};

interface Props {
  msg: Msg;
  isStreaming?: boolean;
}

export function StreamMessageBubble({ msg, isStreaming }: Props) {
  const isUser = msg.role === 'user' || msg.is_interrupt;
  const isSystem = msg.role === 'system';
  const agentColor = PHASE_COLORS[msg.phase_key] ?? 'bg-slate-100 text-slate-700';

  if (isSystem) {
    return (
      <div className="flex justify-center my-1">
        <span className="text-xs text-slate-400 dark:text-slate-500 italic px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[80%] px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">You — interrupt</div>
          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${agentColor}`}>
          {PHASE_DISPLAY_NAMES[msg.phase_key] ?? msg.phase_key}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className={`text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed ${isStreaming ? 'streaming-cursor' : ''}`}>
        {msg.content}
      </div>
    </div>
  );
}
