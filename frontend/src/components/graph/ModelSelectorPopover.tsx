import { useEffect, useRef, useState } from 'react';
import { updatePhaseModel } from '../../api/projects';
import { useStore, type ModelAssignment } from '../../store';
import { PHASE_DISPLAY_NAMES } from '../../types/pipeline';

interface Props {
  projectId: string;
  phaseKey: string;
  currentAssignment: ModelAssignment | null;
  anchorPos: { x: number; y: number };
  onClose: () => void;
}

const GEMINI_MODELS = [
  { id: 'gemini-3.1-pro-preview',    label: 'Gemini 3.1 Pro' },
  { id: 'gemini-3-flash-preview',    label: 'Gemini 3 Flash' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash' },
];

const ANTHROPIC_MODELS = [
  { id: 'claude-opus-4-6',            label: 'Claude Opus' },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet' },
  { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku' },
];

export function ModelSelectorPopover({ projectId, phaseKey, currentAssignment, anchorPos, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'gemini' | 'anthropic'>(
    currentAssignment?.provider === 'anthropic' ? 'anthropic' : 'gemini'
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    currentAssignment?.model ?? 'gemini-3.1-flash-lite-preview'
  );
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setPhaseModel = useStore(s => s.setPhaseModel);

  // Clamp position to viewport
  const left = Math.min(anchorPos.x + 10, window.innerWidth - 230);
  const top  = Math.min(anchorPos.y + 10, window.innerHeight - 320);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onClose]);

  const switchTab = (tab: 'gemini' | 'anthropic') => {
    setActiveTab(tab);
    setSelectedModel(tab === 'gemini' ? 'gemini-3.1-flash-lite-preview' : ANTHROPIC_MODELS[1].id);
  };

  const handleApply = async () => {
    setSaving(true);
    try {
      await updatePhaseModel(projectId, phaseKey, activeTab, selectedModel);
      setPhaseModel(phaseKey, { provider: activeTab, model: selectedModel });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const models = activeTab === 'gemini' ? GEMINI_MODELS : ANTHROPIC_MODELS;

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 9999 }}
      className="w-52 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2.5"
    >
      {/* Header */}
      <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        {PHASE_DISPLAY_NAMES[phaseKey] ?? phaseKey}
      </p>

      {/* Provider tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => switchTab('gemini')}
          className={`flex-1 py-1 text-xs rounded-lg font-medium transition-colors
            ${activeTab === 'gemini'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
        >
          Gemini
        </button>
        <button
          onClick={() => switchTab('anthropic')}
          className={`flex-1 py-1 text-xs rounded-lg font-medium transition-colors
            ${activeTab === 'anthropic'
              ? 'bg-violet-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
        >
          Anthropic
        </button>
      </div>

      {/* Model pills */}
      <div className="flex flex-col gap-1">
        {models.map(m => (
          <button
            key={m.id}
            onClick={() => setSelectedModel(m.id)}
            className={`py-1.5 px-2.5 text-xs rounded-lg text-left transition-colors
              ${selectedModel === m.id
                ? activeTab === 'gemini'
                  ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800'
                  : 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-semibold border border-violet-200 dark:border-violet-800'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'
              }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Apply button */}
      <button
        onClick={handleApply}
        disabled={saving}
        className="py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors disabled:opacity-50 mt-0.5"
      >
        {saving ? 'Saving…' : 'Apply'}
      </button>
    </div>
  );
}
