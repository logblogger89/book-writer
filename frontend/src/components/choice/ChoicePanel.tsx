import { useState } from 'react';
import { useStore } from '../../store';
import { resolveChoice } from '../../api/pipeline';
import { PHASE_DISPLAY_NAMES } from '../../types/pipeline';
import { Sparkles, ChevronRight, Wand2 } from 'lucide-react';

export function ChoicePanel() {
  const pendingChoice = useStore(s => s.pendingChoice);
  const projectId = useStore(s => s.projectId);
  const setPendingChoice = useStore(s => s.setPendingChoice);
  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!pendingChoice || !projectId) return null;

  const handleSubmit = async () => {
    if (!selected && !customText.trim()) return;
    setSubmitting(true);
    try {
      await resolveChoice(
        projectId,
        pendingChoice.choice_id,
        useCustom ? undefined : selected ?? undefined,
        useCustom ? customText : undefined,
      );
      setPendingChoice(null);
    } finally {
      setSubmitting(false);
      setSelected(null);
      setCustomText('');
      setUseCustom(false);
    }
  };

  const handleAiDecide = async () => {
    const recommended = pendingChoice.options.find(o => o.is_recommended);
    if (!recommended) return;
    setSubmitting(true);
    try {
      await resolveChoice(projectId, pendingChoice.choice_id, recommended.id);
      setPendingChoice(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-950/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-amber-500" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Choose a direction for {PHASE_DISPLAY_NAMES[pendingChoice.phase_key] ?? pendingChoice.phase_key}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 mb-3">
        {pendingChoice.options.map(opt => (
          <button
            key={opt.id}
            onClick={() => { setSelected(opt.id); setUseCustom(false); }}
            className={`
              text-left p-3 rounded-lg border-2 transition-all text-sm
              ${selected === opt.id && !useCustom
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{opt.label}</span>
              {opt.is_recommended && (
                <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                  ★ Recommended
                </span>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs leading-relaxed">{opt.summary}</p>
          </button>
        ))}

        <button
          onClick={() => { setUseCustom(true); setSelected(null); }}
          className={`
            text-left p-3 rounded-lg border-2 transition-all text-sm
            ${useCustom
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
              : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-300'
            }
          `}
        >
          <span className="font-semibold text-slate-500 dark:text-slate-400">✏️ Custom direction...</span>
        </button>
      </div>

      {useCustom && (
        <textarea
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          placeholder="Describe your creative direction..."
          className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 resize-none mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          rows={3}
          autoFocus
        />
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={handleAiDecide}
          disabled={submitting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Wand2 size={12} />
          AI Decides
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || (!selected && !customText.trim())}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Confirm
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
