import { useState, useEffect, useRef } from 'react';
import { listProjects, createProject, deleteProject, updateProjectTitle } from '../api/projects';
import { useStore } from '../store';
import type { Project } from '../types/pipeline';
import { BookOpen, Plus, Trash2, ArrowRight, Sparkles, Pencil, Check, X } from 'lucide-react';

export function ProjectScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [premise, setPremise] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const setProject = useStore(s => s.setProject);
  const darkMode = useStore(s => s.darkMode);

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

  const handleCreate = async () => {
    if (!title.trim() || !premise.trim()) return;
    setCreating(true);
    try {
      const { data } = await createProject(title.trim(), premise.trim());
      setProject(data.id, data.title);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const handleOpen = (p: Project) => {
    if (editingId === p.id) return; // don't open while editing
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
      await loadProjects(); // revert on error
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
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
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors mb-4 font-medium text-sm"
          >
            <Plus size={16} />
            New Novel
          </button>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-500" />
              Start your novel
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Novel title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. The Fracture Line"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Initial premise</label>
                <textarea
                  value={premise}
                  onChange={e => setPremise(e.target.value)}
                  placeholder="Describe your sci-fi concept… e.g. A colony ship carrying the last humans enters a galaxy where time flows backwards, and the crew must decide whether to complete their mission or return to an Earth that grows younger as they travel."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowCreate(false); setTitle(''); setPremise(''); }}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !title.trim() || !premise.trim()}
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
                        <button
                          onClick={e => saveEdit(p.id, e)}
                          className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-500 transition-colors"
                          title="Save"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                          title="Cancel"
                        >
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
