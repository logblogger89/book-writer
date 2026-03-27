import { useStore } from '../../store';

const PHASE_LABELS: Record<string, string> = {
  prose_writer: 'Writing Prose',
  continuity_editor: 'Checking Continuity',
  literary_editor: 'Literary Edit',
};

export function ChapterProgressBar() {
  const chapterProgress = useStore(s => s.chapterProgress);

  if (!chapterProgress) return null;

  const { currentChapter, totalChapters, activePhase } = chapterProgress;
  const pct = totalChapters > 0 ? Math.round((currentChapter / totalChapters) * 100) : 0;
  const subLabel = activePhase ? PHASE_LABELS[activePhase] ?? activePhase : 'Processing';

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2.5 flex-shrink-0 bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Chapter {currentChapter} / {totalChapters}
        </span>
        <span className="text-[10px] text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse inline-block" />
          {subLabel}…
        </span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
