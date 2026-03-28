import { useEffect, useRef, useState } from 'react';

export interface CharacterData {
  id?: string;
  name: string;
  role: string;
  age?: number | string;
  occupation?: string;
  faction_affiliation?: string;
  background?: string;
  core_wound?: string;
  motivation?: string;
  fear?: string;
  arc?: string;
  contradictions?: string[];
  voice_profile?: {
    speech_style?: string;
    vocabulary_level?: string;
    verbal_tics?: string[];
    emotional_register?: string;
  };
  physical_description?: string;
  relationships?: Record<string, string>;
}

interface Props {
  character: CharacterData;
  onSave: (updated: CharacterData) => Promise<void>;
  onClose: () => void;
}

const ROLES = ['protagonist', 'antagonist', 'supporting', 'minor'];

const roleAccent: Record<string, string> = {
  protagonist: 'bg-blue-400',
  antagonist: 'bg-red-400',
  supporting: 'bg-violet-400',
  minor: 'bg-slate-300',
};

export function CharacterEditModal({ character, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<CharacterData>(() => JSON.parse(JSON.stringify(character)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tag input state
  const [contradictionInput, setContradictionInput] = useState('');
  const [ticInput, setTicInput] = useState('');
  const [relKey, setRelKey] = useState('');
  const [relVal, setRelVal] = useState('');

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Trap focus inside modal
  useEffect(() => { panelRef.current?.focus(); }, []);

  function set<K extends keyof CharacterData>(key: K, value: CharacterData[K]) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  function setVoice(key: keyof NonNullable<CharacterData['voice_profile']>, value: string | string[]) {
    setDraft(d => ({ ...d, voice_profile: { ...(d.voice_profile ?? {}), [key]: value } }));
  }

  function addContradiction() {
    const val = contradictionInput.trim();
    if (!val) return;
    set('contradictions', [...(draft.contradictions ?? []), val]);
    setContradictionInput('');
  }

  function removeContradiction(i: number) {
    set('contradictions', (draft.contradictions ?? []).filter((_, idx) => idx !== i));
  }

  function addTic() {
    const val = ticInput.trim();
    if (!val) return;
    setVoice('verbal_tics', [...(draft.voice_profile?.verbal_tics ?? []), val]);
    setTicInput('');
  }

  function removeTic(i: number) {
    setVoice('verbal_tics', (draft.voice_profile?.verbal_tics ?? []).filter((_, idx) => idx !== i));
  }

  function addRelationship() {
    if (!relKey.trim()) return;
    setDraft(d => ({
      ...d,
      relationships: { ...(d.relationships ?? {}), [relKey.trim()]: relVal.trim() },
    }));
    setRelKey('');
    setRelVal('');
  }

  function removeRelationship(key: string) {
    setDraft(d => {
      const rels = { ...(d.relationships ?? {}) };
      delete rels[key];
      return { ...d, relationships: rels };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const accentClass = roleAccent[draft.role] ?? roleAccent.minor;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative ml-auto w-full max-w-xl h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col outline-none animate-slide-in-right"
      >
        {/* Role accent bar */}
        <div className={`h-1 w-full flex-shrink-0 ${accentClass}`} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Editing character</p>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">{character.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="ml-3 flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Basic Info */}
          <Section title="Identity">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <input
                  className={inputCls}
                  value={draft.name}
                  onChange={e => set('name', e.target.value)}
                />
              </Field>
              <Field label="Role">
                <select
                  className={inputCls}
                  value={draft.role}
                  onChange={e => set('role', e.target.value)}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Age">
                <input
                  className={inputCls}
                  type="number"
                  value={draft.age ?? ''}
                  onChange={e => set('age', e.target.value ? Number(e.target.value) : '')}
                />
              </Field>
              <Field label="Occupation">
                <input
                  className={inputCls}
                  value={draft.occupation ?? ''}
                  onChange={e => set('occupation', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Faction / Affiliation">
              <input
                className={inputCls}
                value={draft.faction_affiliation ?? ''}
                onChange={e => set('faction_affiliation', e.target.value)}
              />
            </Field>
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <Field label="Physical Description">
              <textarea
                className={`${inputCls} h-20 resize-none`}
                value={draft.physical_description ?? ''}
                onChange={e => set('physical_description', e.target.value)}
              />
            </Field>
          </Section>

          {/* Psychology */}
          <Section title="Psychology">
            <Field label="Background">
              <textarea
                className={`${inputCls} h-20 resize-none`}
                value={draft.background ?? ''}
                onChange={e => set('background', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Core Wound">
                <textarea
                  className={`${inputCls} h-16 resize-none`}
                  value={draft.core_wound ?? ''}
                  onChange={e => set('core_wound', e.target.value)}
                />
              </Field>
              <Field label="Motivation (Wants)">
                <textarea
                  className={`${inputCls} h-16 resize-none`}
                  value={draft.motivation ?? ''}
                  onChange={e => set('motivation', e.target.value)}
                />
              </Field>
              <Field label="Fear">
                <textarea
                  className={`${inputCls} h-16 resize-none`}
                  value={draft.fear ?? ''}
                  onChange={e => set('fear', e.target.value)}
                />
              </Field>
              <Field label="Arc">
                <textarea
                  className={`${inputCls} h-16 resize-none`}
                  value={draft.arc ?? ''}
                  onChange={e => set('arc', e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Contradictions */}
          <Section title="Contradictions">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(draft.contradictions ?? []).map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-900/60 px-2 py-0.5 rounded-full">
                  {c}
                  <button
                    onClick={() => removeContradiction(i)}
                    className="ml-0.5 text-pink-400 hover:text-pink-600 dark:hover:text-pink-200 leading-none"
                    aria-label="Remove"
                  >×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className={`${inputCls} flex-1`}
                placeholder="Add contradiction..."
                value={contradictionInput}
                onChange={e => setContradictionInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addContradiction(); } }}
              />
              <button onClick={addContradiction} className={addBtnCls}>Add</button>
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice Profile">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Speech Style">
                <input
                  className={inputCls}
                  value={draft.voice_profile?.speech_style ?? ''}
                  onChange={e => setVoice('speech_style', e.target.value)}
                />
              </Field>
              <Field label="Vocabulary Level">
                <input
                  className={inputCls}
                  value={draft.voice_profile?.vocabulary_level ?? ''}
                  onChange={e => setVoice('vocabulary_level', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Emotional Register">
              <input
                className={inputCls}
                value={draft.voice_profile?.emotional_register ?? ''}
                onChange={e => setVoice('emotional_register', e.target.value)}
              />
            </Field>
            <Field label="Verbal Tics">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(draft.voice_profile?.verbal_tics ?? []).map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                    "{t}"
                    <button
                      onClick={() => removeTic(i)}
                      className="ml-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 leading-none"
                      aria-label="Remove"
                    >×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder='Add verbal tic...'
                  value={ticInput}
                  onChange={e => setTicInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTic(); } }}
                />
                <button onClick={addTic} className={addBtnCls}>Add</button>
              </div>
            </Field>
          </Section>

          {/* Relationships */}
          {(draft.relationships !== undefined || true) && (
            <Section title="Relationships">
              <div className="space-y-1.5 mb-2">
                {Object.entries(draft.relationships ?? {}).map(([charId, desc]) => (
                  <div key={charId} className="flex items-start gap-2 group">
                    <div className="flex-1 bg-slate-50 dark:bg-slate-800/60 rounded px-2.5 py-1.5 min-w-0">
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">{charId}</p>
                      <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-snug">{desc}</p>
                    </div>
                    <button
                      onClick={() => removeRelationship(charId)}
                      className="mt-1.5 text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none flex-shrink-0"
                      aria-label="Remove"
                    >×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className={`${inputCls} w-36 flex-shrink-0`}
                  placeholder="Character name"
                  value={relKey}
                  onChange={e => setRelKey(e.target.value)}
                />
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Relationship description"
                  value={relVal}
                  onChange={e => setRelVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRelationship(); } }}
                />
                <button onClick={addRelationship} className={addBtnCls}>Add</button>
              </div>
            </Section>
          )}

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          {error && <p className="text-xs text-red-500 dark:text-red-400 flex-1">{error}</p>}
          {!error && <div className="flex-1" />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition-colors disabled:opacity-60 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Saving…
                </>
              ) : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Shared style strings
const inputCls = `
  w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700
  bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100
  px-2.5 py-1.5 outline-none
  focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 focus:border-transparent
  placeholder-slate-300 dark:placeholder-slate-600
  transition-shadow
`.replace(/\s+/g, ' ').trim();

const addBtnCls = `
  flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg
  border border-slate-200 dark:border-slate-700
  text-slate-500 dark:text-slate-400
  hover:text-slate-700 dark:hover:text-slate-200
  hover:bg-slate-50 dark:hover:bg-slate-800
  transition-colors
`.replace(/\s+/g, ' ').trim();

// Sub-components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
