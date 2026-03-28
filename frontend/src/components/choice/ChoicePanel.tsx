import { useState } from 'react';
import { useStore } from '../../store';
import { resolveChoice } from '../../api/pipeline';
import { PHASE_DISPLAY_NAMES } from '../../types/pipeline';
import { Sparkles, ChevronRight, Wand2, Pencil, ArrowLeft, Plus, Minus } from 'lucide-react';

export function ChoicePanel() {
  const pendingChoice = useStore(s => s.pendingChoice);
  const projectId = useStore(s => s.projectId);
  const setPendingChoice = useStore(s => s.setPendingChoice);
  const [selected, setSelected] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!pendingChoice || !projectId) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (editMode ? !customText.trim() : !selected) return;
    setSubmitting(true);
    try {
      await resolveChoice(
        projectId,
        pendingChoice.choice_id,
        editMode ? undefined : selected ?? undefined,
        editMode ? customText : undefined,
      );
      setPendingChoice(null);
    } finally {
      setSubmitting(false);
      setSelected(null);
      setExpandedIds(new Set());
      setCustomText('');
      setEditMode(false);
      setEditLabel('');
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

  const enterEdit = (label: string, text: string) => {
    setEditLabel(label);
    setCustomText(text);
    setEditMode(true);
    setSelected(null);
  };

  return (
    <div className="h-full flex flex-col bg-amber-50 dark:bg-amber-950/30 p-4">

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <Sparkles size={16} className="text-amber-500" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Choose a direction for {PHASE_DISPLAY_NAMES[pendingChoice.phase_key] ?? pendingChoice.phase_key}
        </span>
      </div>

      {editMode ? (
        /* ── EDIT MODE ─────────────────────────────────────────────── */
        <div className="flex flex-col flex-1 min-h-0">
          <button
            onClick={() => setEditMode(false)}
            className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors mb-2 self-start"
          >
            <ArrowLeft size={11} />
            {editLabel}
          </button>

          <textarea
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder="Describe your creative direction..."
            className="flex-1 w-full p-3 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
            autoFocus
          />

          <div className="flex gap-2 justify-end flex-shrink-0">
            <button
              onClick={() => setEditMode(false)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !customText.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Confirm
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      ) : (
        /* ── SELECT MODE ────────────────────────────────────────────── */
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-col gap-1.5 mb-3 overflow-y-auto flex-1 min-h-0">
            {pendingChoice.options.map(opt => {
              const isExpanded = expandedIds.has(opt.id);
              const isSelected = selected === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSelected(prev => prev === opt.id ? null : opt.id)}
                  className={`
                    group relative text-left rounded-lg border-2 transition-all flex-shrink-0
                    ${isSelected
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }
                  `}
                >
                  {/* Row header */}
                  <div className="flex items-center gap-2 px-3 py-2 pr-8">
                    {/* Expand toggle */}
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); toggleExpand(opt.id); }}
                      className={`
                        flex-shrink-0 p-0.5 rounded transition-colors
                        ${isExpanded
                          ? 'text-indigo-500 dark:text-indigo-400'
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                        }
                      `}
                    >
                      {isExpanded ? <Minus size={10} /> : <Plus size={10} />}
                    </span>

                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex-1 min-w-0">
                      {opt.label}
                    </span>

                    {opt.is_recommended && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-1.5 py-0.5 rounded-full shrink-0">
                        ★ Recommended
                      </span>
                    )}
                  </div>

                  {/* Expanded summary */}
                  {isExpanded && (
                    <p className="text-slate-500 dark:text-slate-400 px-3 pb-2.5 text-xs leading-relaxed pl-8 pr-8">
                      {opt.summary}
                    </p>
                  )}

                  {/* Edit icon — hover only */}
                  <span
                    role="button"
                    onClick={e => {
                      e.stopPropagation();
                      enterEdit(opt.label, `${opt.label}\n${opt.summary}`);
                    }}
                    className="absolute top-2 right-2 p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-all"
                    title="Edit this suggestion"
                  >
                    <Pencil size={11} />
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => enterEdit('Custom direction', '')}
              className="text-left px-3 py-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-xs text-slate-500 dark:text-slate-400 flex-shrink-0"
            >
              ✏️ Custom direction...
            </button>
          </div>

          <div className="flex gap-2 justify-end flex-shrink-0">
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
              disabled={submitting || !selected}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Confirm
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
