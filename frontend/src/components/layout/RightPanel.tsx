import { ArtifactViewer } from '../artifacts/ArtifactViewer';

export function RightPanel() {
  return (
    <div className="flex flex-col h-full border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <ArtifactViewer />
    </div>
  );
}
