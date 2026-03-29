import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useStore } from '../../store';
import { useWebSocket } from '../../ws/useWebSocket';
import { LeftPanel } from './LeftPanel';
import { CenterPanel } from './CenterPanel';
import { RightPanel } from './RightPanel';
import { startPipeline, toggleAutoPilot, runFinalReview } from '../../api/pipeline';
import { exportNovel } from '../../api/export';
import { Sun, Moon, Play, Pause, Wand2, User, BookOpen, Download, Search } from 'lucide-react';

export function AppShell() {
  const projectId = useStore(s => s.projectId);
  const projectTitle = useStore(s => s.projectTitle);
  const projectStatus = useStore(s => s.projectStatus);
  const autoPilot = useStore(s => s.autoPilot);
  const darkMode = useStore(s => s.darkMode);
  const toggleDark = useStore(s => s.toggleDarkMode);
  const setAutoPilot = useStore(s => s.setAutoPilot);
  const clearProject = useStore(s => s.clearProject);
  const reviewStatus = useStore(s => s.reviewStatus);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);

  const { send } = useWebSocket(projectId);

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!projectId) return;
    if (format === 'pdf') setExportingPdf(true);
    else setExportingDocx(true);
    try {
      await exportNovel(projectId, format);
    } finally {
      if (format === 'pdf') setExportingPdf(false);
      else setExportingDocx(false);
    }
  };

  // Apply dark class to html element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const handlePipelineControl = async () => {
    if (!projectId) return;
    if (projectStatus === 'idle') {
      await startPipeline(projectId);
    } else if (projectStatus === 'running') {
      send({ event: 'pause_pipeline' });
    } else if (projectStatus === 'paused') {
      await startPipeline(projectId); // handles both live-pause and server-restart recovery
    }
  };

  const handleAutoPilotToggle = async () => {
    if (!projectId) return;
    const next = !autoPilot;
    await toggleAutoPilot(projectId, next);
    setAutoPilot(next);
    send({ event: 'toggle_auto_pilot', enabled: next });
  };

  const handleInterrupt = (phaseKey: string, message: string) => {
    send({ event: 'inject_interrupt', phase_key: phaseKey, message });
  };

  const pipelineButtonLabel = () => {
    if (projectStatus === 'idle') return 'Start';
    if (projectStatus === 'running') return 'Pause';
    if (projectStatus === 'paused') return 'Resume';
    if (projectStatus === 'complete') return 'Complete';
    return projectStatus;
  };

  const pipelineButtonIcon = () => {
    if (projectStatus === 'running') return <Pause size={14} />;
    return <Play size={14} />;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={clearProject}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            title="Back to home"
          >
            <BookOpen size={18} className="text-indigo-500" />
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">Nova Writer</span>
          </button>
          {projectTitle && (
            <>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{projectTitle}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-pilot toggle */}
          {projectId && (
            <button
              onClick={handleAutoPilotToggle}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                ${autoPilot
                  ? 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-700'
                  : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
                }
              `}
              title={autoPilot ? 'Switch to Co-Pilot mode' : 'Switch to Auto-Pilot mode'}
            >
              {autoPilot ? <Wand2 size={12} /> : <User size={12} />}
              {autoPilot ? 'Auto-Pilot' : 'Co-Pilot'}
            </button>
          )}

          {/* Pipeline control */}
          {projectId && projectStatus !== 'complete' && (
            <button
              onClick={handlePipelineControl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              {pipelineButtonIcon()}
              {pipelineButtonLabel()}
            </button>
          )}

          {/* Status badge + export buttons */}
          {projectStatus === 'complete' && (
            <>
              <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 px-2 py-1 rounded-full font-medium">
                ✓ Complete
              </span>
              <button
                onClick={() => projectId && runFinalReview(projectId)}
                disabled={reviewStatus === 'running' || reviewStatus === 'fixing'}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                  ${reviewStatus === 'running' || reviewStatus === 'fixing'
                    ? 'bg-cyan-100 text-cyan-600 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-400 dark:border-cyan-700 cursor-wait'
                    : reviewStatus === 'complete' || reviewStatus === 'fix_complete'
                      ? 'bg-cyan-50 text-cyan-700 border-cyan-300 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-700 dark:hover:bg-cyan-900'
                      : 'bg-cyan-50 text-cyan-700 border-cyan-300 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-700 dark:hover:bg-cyan-900'
                  }
                  disabled:opacity-50
                `}
                title="Review final draft for inconsistencies"
              >
                {reviewStatus === 'running' ? (
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Search size={12} />
                )}
                {reviewStatus === 'running' ? 'Reviewing…' : reviewStatus === 'fixing' ? 'Fixing…' : 'Review'}
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={exportingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                title="Download PDF"
              >
                <Download size={12} />
                {exportingPdf ? 'Exporting…' : 'PDF'}
              </button>
              <button
                onClick={() => handleExport('docx')}
                disabled={exportingDocx}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                title="Download DOCX"
              >
                <Download size={12} />
                {exportingDocx ? 'Exporting…' : 'DOCX'}
              </button>
            </>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle dark mode"
          >
            {darkMode ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-400" />}
          </button>
        </div>
      </header>

      {/* 3-panel resizable layout */}
      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left: Expert graph + timeline */}
        <Panel defaultSize={20} minSize={15} maxSize={35}>
          <LeftPanel />
        </Panel>

        <PanelResizeHandle className="w-1 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors cursor-col-resize flex-shrink-0" />

        {/* Center: Artifact viewer (info-dense, moved to center) */}
        <Panel defaultSize={55} minSize={30}>
          <RightPanel />
        </Panel>

        <PanelResizeHandle className="w-1 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors cursor-col-resize flex-shrink-0" />

        {/* Right: Streaming log + choice + interrupt */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <CenterPanel onInterrupt={handleInterrupt} />
        </Panel>
      </PanelGroup>
    </div>
  );
}
