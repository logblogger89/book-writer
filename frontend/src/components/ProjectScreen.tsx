import { useState, useEffect, useRef } from 'react';
import { listProjects, createProject, deleteProject, updateProjectTitle, suggestLoglines } from '../api/projects';
import type { LoglineOption } from '../api/projects';
import { useStore } from '../store';
import type { Project } from '../types/pipeline';
import { BookOpen, Plus, Trash2, ArrowRight, Sparkles, Pencil, Check, X, RefreshCw, Sun, Moon } from 'lucide-react';

const SF_SUBGENRES = [
  'Hard Science Fiction',
  'Space Opera',
  'Cyberpunk',
  'Solarpunk',
  'Biopunk',
  'Military Science Fiction',
  'First Contact',
  'Post-Apocalyptic',
  'Time Travel',
  'Dystopian',
  'Utopian',
  'Colonization / Terraforming',
  'AI & Robotics',
  'Climate Fiction (Cli-Fi)',
  'Cosmic Horror',
];

const GEMINI_MODELS = [
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

const ANTHROPIC_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
];

export function ProjectScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [subGenre, setSubGenre] = useState('');
  const [customSubGenre, setCustomSubGenre] = useState('');
  const [chapterCount, setChapterCount] = useState<number | null>(null);
  const [loglineOptions, setLoglineOptions] = useState<LoglineOption[]>([]);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [loglineProvider, setLoglineProvider] = useState<'gemini' | 'anthropic'>('gemini');
  const [loglineModel, setLoglineModel] = useState('gemini-3.1-flash-lite-preview');
  const [creating, setCreating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const setProject = useStore(s => s.setProject);
  const darkMode = useStore(s => s.darkMode);
  const toggleDarkMode = useStore(s => s.toggleDarkMode);

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);
  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const loadProjects = async () => {
    const { data } = await listProjects();
    setProjects(data);
  };

  const fetchLoglines = async (
    genre?: string,
    provider?: 'gemini' | 'anthropic',
    model?: string,
  ) => {
    setSuggesting(true);
    setLoglineOptions([]);
    setSelectedOptionIdx(null);
    try {
      const resolvedGenre = (genre ?? subGenre) === '__custom__'
        ? customSubGenre.trim() || undefined
        : (genre ?? subGenre) || undefined;
      const { data } = await suggestLoglines(
        resolvedGenre,
        provider ?? loglineProvider,
        model ?? loglineModel,
      );
      if (data.options?.length) {
        setLoglineOptions(data.options);
        setSelectedOptionIdx(0);
        if (data.options[0].title) setTitle(data.options[0].title);
      }
    } finally {
      setSuggesting(false);
    }
  };

  const handleProviderChange = (p: 'gemini' | 'anthropic') => {
    const defaultModel = p === 'gemini' ? 'gemini-3.1-flash-lite-preview' : 'claude-haiku-4-5-20251001';
    setLoglineProvider(p);
    setLoglineModel(defaultModel);
    fetchLoglines(subGenre, p, defaultModel);
  };

  const handleModelChange = (m: string) => {
    setLoglineModel(m);
    fetchLoglines(subGenre, loglineProvider, m);
  };

  const handleCreate = async () => {
    if (!title.trim() || selectedOptionIdx === null) return;
    setCreating(true);
    try {
      const resolvedGenre = subGenre === '__custom__' ? customSubGenre.trim() : subGenre;
      const { data } = await createProject(
        title.trim(),
        loglineOptions[selectedOptionIdx],
        resolvedGenre || undefined,
        chapterCount ?? undefined,
      );
      setProject(data.id, data.title);
    } finally {
      setCreating(false);
    }
  };

  const resetCreate = () => {
    setShowCreate(false);
    setTitle('');
    setLoglineOptions([]);
    setSelectedOptionIdx(null);
    setSubGenre('');
    setCustomSubGenre('');
    setChapterCount(null);
    setSuggesting(false);
    setLoglineProvider('gemini');
    setLoglineModel('gemini-3.1-flash-lite-preview');
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const handleOpen = (p: Project) => {
    if (editingId === p.id) return;
    setProject(p.id, p.title);
  };

  const startEdit = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(p.id);
    setEditTitle(p.title);
  };

  const saveEdit = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const trimmed = editTitle.trim();
    if (!trimmed) { cancelEdit(); return; }
    setProjects(prev => prev.map(p => p.id === id ? { ...p, title: trimmed } : p));
    setEditingId(null);
    try {
      await updateProjectTitle(id, trimmed);
    } catch {
      await loadProjects();
    }
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') saveEdit(id);
    if (e.key === 'Escape') cancelEdit();
  };

  const activeModels = loglineProvider === 'gemini' ? GEMINI_MODELS : ANTHROPIC_MODELS;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Dark mode toggle — fixed top-right */}
      <button
        onClick={toggleDarkMode}
        className="fixed top-4 right-4 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors z-10"
        title="Toggle dark mode"
      >
        {darkMode ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <div className="w-full max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
              <BookOpen size={24} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nova Writer</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            AI-powered sci-fi novel writing with expert collaboration
          </p>
        </div>

        {/* Create new */}
        {!showCreate ? (
          <button
            onClick={() => { setShowCreate(true); fetchLoglines(); }}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors mb-4 font-medium text-sm"
          >
            <Plus size={16} />
            New Novel
          </button>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-4 shadow-sm">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-500" />
                Start your novel
              </h2>
              <button
                onClick={() => fetchLoglines()}
                disabled={suggesting}
                className="flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 disabled:opacity-40 transition-colors"
              >
                <RefreshCw size={11} className={suggesting ? 'animate-spin' : ''} />
                {suggesting ? 'Generating…' : 'Regenerate'}
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Novel title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={suggesting ? 'Generating…' : 'e.g. The Fracture Line'}
                  disabled={suggesting}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 disabled:cursor-wait"
                  autoFocus
                />
              </div>

              {/* Sub-genre */}
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                  Sub-genre <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <select
                  value={subGenre}
                  onChange={e => { setSubGenre(e.target.value); if (e.target.value !== '__custom__') setCustomSubGenre(''); }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">— Choose a sub-genre —</option>
                  {SF_SUBGENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="__custom__">Other (type your own)…</option>
                </select>
                {subGenre === '__custom__' && (
                  <input
                    type="text"
                    value={customSubGenre}
                    onChange={e => setCustomSubGenre(e.target.value)}
                    placeholder="e.g. Nanopunk, Gaslamp SF, Hopepunk…"
                    className="w-full mt-1.5 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    autoFocus
                  />
                )}
              </div>

              {/* Model selector */}
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                  Logline model
                </label>
                <div className="flex gap-1.5 mb-2">
                  {(['gemini', 'anthropic'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => handleProviderChange(p)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        loglineProvider === p
                          ? 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-700'
                          : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      {p === 'gemini' ? 'Gemini' : 'Anthropic'}
                    </button>
                  ))}
                </div>
                <select
                  value={loglineModel}
                  onChange={e => handleModelChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {activeModels.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>

              {/* Logline options */}
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                  Logline
                </label>
                {suggesting ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg h-20" />
                    ))}
                  </div>
                ) : loglineOptions.length > 0 ? (
                  <div className="space-y-2">
                    {loglineOptions.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setSelectedOptionIdx(idx); setTitle(opt.title); }}
                        className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${
                          selectedOptionIdx === idx
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-semibold italic text-slate-800 dark:text-slate-100 leading-tight">
                            {opt.title}
                          </p>
                          {idx === 0 && (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                              ★ Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{opt.logline}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {opt.tone && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                              {opt.tone}
                            </span>
                          )}
                          {opt.thematic_pillars.slice(0, 2).map((pillar, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                              {pillar}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                    No suggestions yet — click Regenerate
                  </div>
                )}
              </div>

              {/* Chapter count stepper */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Chapters <span className="font-normal text-slate-400 dark:text-slate-500">(optional · max 40)</span>
                  </label>
                  {chapterCount !== null && (
                    <button
                      onClick={() => setChapterCount(null)}
                      className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      Let AI decide
                    </button>
                  )}
                </div>
                {chapterCount === null ? (
                  <button
                    onClick={() => setChapterCount(20)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <span className="text-base leading-none">+</span> Set a specific chapter count
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setChapterCount(c => Math.max(1, (c ?? 1) - 1))}
                      disabled={chapterCount <= 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-base font-medium transition-colors flex-shrink-0"
                    >−</button>
                    <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40">
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={chapterCount ?? ''}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) setChapterCount(Math.min(40, Math.max(1, val)));
                        }}
                        onBlur={e => {
                          const val = parseInt(e.target.value, 10);
                          if (isNaN(val) || val < 1) setChapterCount(1);
                        }}
                        className="text-base font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums w-10 text-center bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-xs text-indigo-500 dark:text-indigo-400">chapter{chapterCount !== 1 ? 's' : ''}</span>
                    </div>
                    <button
                      onClick={() => setChapterCount(c => Math.min(40, (c ?? 40) + 1))}
                      disabled={chapterCount >= 40}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-base font-medium transition-colors flex-shrink-0"
                    >+</button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={resetCreate}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || suggesting || !title.trim() || selectedOptionIdx === null}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {creating ? 'Creating…' : 'Create & Open'}
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Existing projects */}
        {projects.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Your Novels
            </h3>
            <div className="space-y-2">
              {projects.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleOpen(p)}
                  className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-all group shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    {editingId === p.id ? (
                      <input
                        ref={editInputRef}
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => handleEditKeyDown(e, p.id)}
                        onBlur={() => saveEdit(p.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-full px-2 py-0.5 text-sm font-medium rounded-lg border border-indigo-400 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    ) : (
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{p.title}</p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {p.initial_premise.slice(0, 80)}{p.initial_premise.length > 80 ? '…' : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === 'complete' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' :
                      p.status === 'running'  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' :
                      'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {p.status}
                    </span>

                    {editingId === p.id ? (
                      <>
                        <button onClick={e => saveEdit(p.id, e)} className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-500 transition-colors" title="Save">
                          <Check size={13} />
                        </button>
                        <button onClick={cancelEdit} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors" title="Cancel">
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={e => startEdit(p, e)}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
                        title="Rename"
                      >
                        <Pencil size={13} />
                      </button>
                    )}

                    <button
                      onClick={e => handleDelete(p.id, e)}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
