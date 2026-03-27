import { useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useStore } from '../../store';
import { useWebSocket } from '../../ws/useWebSocket';
import { LeftPanel } from './LeftPanel';
import { CenterPanel } from './CenterPanel';
import { RightPanel } from './RightPanel';
import { startPipeline, toggleAutoPilot } from '../../api/pipeline';
import { Sun, Moon, Play, Pause, Wand2, User, BookOpen } from 'lucide-react';

export function AppShell() {
  const projectId = useStore(s => s.projectId);
  const projectTitle = useStore(s => s.projectTitle);
  const projectStatus = useStore(s => s.projectStatus);
  const autoPilot = useStore(s => s.autoPilot);
  const darkMode = useStore(s => s.darkMode);
  const toggleDark = useStore(s => s.toggleDarkMode);
  const setAutoPilot = useStore(s => s.setAutoPilot);
  const clearProject = useStore(s => s.clearProject);

  const { send } = useWebSocket(projectId);

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

          {/* Status badge */}
          {projectStatus === 'complete' && (
            <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 px-2 py-1 rounded-full font-medium">
              ✓ Complete
            </span>
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
        <Panel defaultSize={22} minSize={15} maxSize={35}>
          <LeftPanel />
        </Panel>

        <PanelResizeHandle className="w-1 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors cursor-col-resize flex-shrink-0" />

        {/* Center: Streaming log + choice + interrupt */}
        <Panel defaultSize={55} minSize={30}>
          <CenterPanel onInterrupt={handleInterrupt} />
        </Panel>

        <PanelResizeHandle className="w-1 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors cursor-col-resize flex-shrink-0" />

        {/* Right: Artifact viewer */}
        <Panel defaultSize={23} minSize={15} maxSize={40}>
          <RightPanel />
        </Panel>
      </PanelGroup>
    </div>
  );
}
