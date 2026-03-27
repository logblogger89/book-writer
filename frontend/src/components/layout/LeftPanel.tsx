import { ExpertGraph } from '../graph/ExpertGraph';
import { RollbackTimeline } from '../rollback/RollbackTimeline';
import { ChapterProgressBar } from '../chapters/ChapterProgressBar';

export function LeftPanel() {
  return (
    <div className="flex flex-col h-full border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      {/* Expert Graph */}
      <div className="flex-1 min-h-0">
        <ExpertGraph />
      </div>
      {/* Chapter generation progress */}
      <ChapterProgressBar />
      {/* Phase Timeline */}
      <div className="border-t border-slate-200 dark:border-slate-700 flex-shrink-0 overflow-y-auto max-h-52">
        <RollbackTimeline />
      </div>
    </div>
  );
}
