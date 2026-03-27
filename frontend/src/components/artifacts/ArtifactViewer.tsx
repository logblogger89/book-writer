import { useStore } from '../../store';

// Tabs that generate one artifact per chapter (stored as base_key_N)
const CHAPTER_TAB_KEYS = new Set(['scene_outline', 'prose_chapter', 'continuity_report', 'edited_chapter']);

const TABS = [
  { key: 'logline', label: 'Logline' },
  { key: 'world_doc', label: 'World' },
  { key: 'character_sheet', label: 'Characters' },
  { key: 'science_notes', label: 'Science' },
  { key: 'chapter_beats', label: 'Beats' },
  { key: 'scene_outline', label: 'Scenes' },
  { key: 'prose_chapter', label: 'Prose' },
  { key: 'continuity_report', label: 'Continuity' },
  { key: 'edited_chapter', label: 'Edited' },
];

export function ArtifactViewer() {
  const artifacts = useStore(s => s.artifacts);
  const activeTab = useStore(s => s.activeArtifactTab);
  const setActiveTab = useStore(s => s.setActiveArtifactTab);
  const viewingChapter = useStore(s => s.viewingChapter);
  const setViewingChapter = useStore(s => s.setViewingChapter);
  const chapterProgress = useStore(s => s.chapterProgress);

  // For chapter tabs, look up the chapter-namespaced artifact key
  const resolvedKey = CHAPTER_TAB_KEYS.has(activeTab)
    ? `${activeTab}_${viewingChapter}`
    : activeTab;

  const current = artifacts[resolvedKey];

  // Determine available chapter range for navigation
  const maxChapter = chapterProgress?.currentChapter ?? viewingChapter;
  const hasAnyChapters = Object.keys(artifacts).some(k => k.startsWith('edited_chapter_'));

  const isChapterTab = CHAPTER_TAB_KEYS.has(activeTab);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-700 px-2 pt-2 gap-1 flex-shrink-0">
        {TABS.map(tab => {
          // For chapter tabs, check if any chapter artifact of this type exists
          const hasData = CHAPTER_TAB_KEYS.has(tab.key)
            ? Object.keys(artifacts).some(k => k.startsWith(`${tab.key}_`))
            : !!artifacts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex-shrink-0 px-2.5 py-1.5 text-xs rounded-t-lg font-medium transition-colors border-b-2 -mb-px
                ${activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }
                ${!hasData ? 'opacity-40' : ''}
              `}
            >
              {tab.label}
              {hasData && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              )}
            </button>
          );
        })}
      </div>

      {/* Chapter navigator — shown when a chapter tab is active and chapters exist */}
      {isChapterTab && hasAnyChapters && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex-shrink-0">
          <button
            onClick={() => setViewingChapter(Math.max(1, viewingChapter - 1))}
            disabled={viewingChapter <= 1}
            className="text-xs px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ‹ Prev
          </button>
          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Chapter {viewingChapter}
            {maxChapter > 0 ? ` / ${maxChapter}` : ''}
          </span>
          <button
            onClick={() => setViewingChapter(Math.min(maxChapter, viewingChapter + 1))}
            disabled={viewingChapter >= maxChapter}
            className="text-xs px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next ›
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {!current ? (
          <div className="text-center text-slate-400 dark:text-slate-500 text-sm mt-8">
            <div className="text-2xl mb-2">○</div>
            <p>No {TABS.find(t => t.key === activeTab)?.label ?? activeTab} yet
              {isChapterTab ? ` for Chapter ${viewingChapter}` : ''}
            </p>
          </div>
        ) : (
          <ArtifactContent type={activeTab} content={current.content} version={current.version} />
        )}
      </div>
    </div>
  );
}

function ArtifactContent({ type, content, version }: { type: string; content: unknown; version: number }) {
  const data = content as Record<string, unknown>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400 dark:text-slate-500">Version {version}</span>
      </div>
      <ArtifactBody type={type} data={data} />
    </div>
  );
}

function ArtifactBody({ type, data }: { type: string; data: Record<string, unknown> }) {
  // Strip chapter suffix (_1, _2, …) to get the base type for routing
  const baseType = type.replace(/_\d+$/, '');
  if (baseType === 'logline') return <LoglineView data={data} />;
  if (baseType === 'world_doc') return <WorldView data={data} />;
  if (baseType === 'character_sheet') return <CharacterView data={data} />;
  if (baseType === 'science_notes') return <ScienceView data={data} />;
  if (baseType === 'chapter_beats') return <BeatsView data={data} />;
  if (baseType === 'prose_chapter' || baseType === 'edited_chapter') return <ProseView data={data} />;
  if (baseType === 'scene_outline') return <SceneView data={data} />;
  if (baseType === 'continuity_report') return <ContinuityView data={data} />;
  // Default: pretty JSON
  return (
    <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded-lg p-3 overflow-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function LoglineView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-3 border border-indigo-100 dark:border-indigo-900">
        <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100 leading-relaxed italic">
          "{String(data.logline ?? '')}"
        </p>
      </div>
      {!!data.tone && <InfoRow label="Tone" value={String(data.tone)} />}
      {!!data.central_conflict && <InfoRow label="Core Conflict" value={String(data.central_conflict)} />}
      {Array.isArray(data.thematic_pillars) && (
        <div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Thematic Pillars</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {(data.thematic_pillars as string[]).map((p, i) => (
              <span key={i} className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">{p}</span>
            ))}
          </div>
        </div>
      )}
      {Array.isArray(data.comparable_titles) && (
        <div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Comparable Titles</span>
          <div className="mt-1 space-y-0.5">
            {(data.comparable_titles as string[]).map((t, i) => (
              <p key={i} className="text-xs text-slate-600 dark:text-slate-300">• {t}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorldView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      {!!data.world_name && <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{String(data.world_name)}</h3>}
      {!!data.era && <InfoRow label="Era" value={String(data.era)} />}
      {!!data.elevator_pitch && <InfoRow label="Overview" value={String(data.elevator_pitch)} />}
      {!!data.social_structure && <InfoRow label="Social Structure" value={String(data.social_structure)} />}
      {!!data.central_tension && <InfoRow label="Central Tension" value={String(data.central_tension)} />}
      {Array.isArray(data.factions) && (
        <Section title="Factions">
          {(data.factions as any[]).map((f, i) => (
            <Card key={i} title={f.name} body={f.ideology} />
          ))}
        </Section>
      )}
      {Array.isArray(data.core_technologies) && (
        <Section title="Technologies">
          {(data.core_technologies as any[]).map((t, i) => (
            <Card key={i} title={t.name} body={t.description} note={t.narrative_purpose} />
          ))}
        </Section>
      )}
      {Array.isArray(data.key_locations) && (
        <Section title="Locations">
          {(data.key_locations as any[]).map((l, i) => (
            <Card key={i} title={l.name} body={l.description} note={l.atmosphere} />
          ))}
        </Section>
      )}
    </div>
  );
}

function CharacterView({ data }: { data: Record<string, unknown> }) {
  const chars = Array.isArray(data.characters) ? data.characters as any[] : [];
  if (chars.length === 0 && data.raw) {
    return <RawFallback label="Characters" raw={String(data.raw)} />;
  }
  return (
    <div className="space-y-4">
      {chars.map((c, i) => (
        <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{c.name}</h4>
              {(c.occupation || c.faction_affiliation) && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {[c.occupation, c.faction_affiliation].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${
              c.role === 'protagonist' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' :
              c.role === 'antagonist' ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300' :
              c.role === 'supporting'  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300' :
              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}>{c.role}</span>
          </div>

          <div className="px-3 py-2.5 space-y-2">
            {/* Physical description */}
            {c.physical_description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">{c.physical_description}</p>
            )}

            {/* Background */}
            {c.background && (
              <div>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Background</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{c.background}</p>
              </div>
            )}

            {/* Core psychology */}
            <div className="grid grid-cols-1 gap-1">
              {c.core_wound && <InfoRow label="Core wound" value={c.core_wound} />}
              {c.motivation && <InfoRow label="Wants" value={c.motivation} />}
              {c.fear && <InfoRow label="Fears" value={c.fear} />}
              {c.arc && <InfoRow label="Arc" value={c.arc} />}
            </div>

            {/* Contradictions */}
            {Array.isArray(c.contradictions) && c.contradictions.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Contradictions</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(c.contradictions as string[]).map((con: string, j: number) => (
                    <span key={j} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">{con}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Voice profile */}
            {c.voice_profile && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 space-y-0.5">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Voice</span>
                {c.voice_profile.speech_style && <p className="text-xs text-slate-600 dark:text-slate-300">{c.voice_profile.speech_style}</p>}
                {c.voice_profile.vocabulary_level && <p className="text-xs text-slate-500 dark:text-slate-400">Vocab: {c.voice_profile.vocabulary_level}</p>}
                {c.voice_profile.emotional_register && <p className="text-xs text-slate-500 dark:text-slate-400 italic">{c.voice_profile.emotional_register}</p>}
                {Array.isArray(c.voice_profile.verbal_tics) && c.voice_profile.verbal_tics.length > 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">"{c.voice_profile.verbal_tics.join('", "')}"</p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function BeatsView({ data }: { data: Record<string, unknown> }) {
  const acts = Array.isArray(data.acts) ? data.acts as any[] : [];
  if (acts.length === 0 && data.raw) {
    return <RawFallback label="Chapter Beats" raw={String(data.raw)} />;
  }
  return (
    <div className="space-y-4">
      {acts.map((act, i) => (
        <div key={i}>
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Act {act.act_number}: {act.title}
          </h4>
          <div className="space-y-1.5">
            {(act.chapters ?? []).map((ch: any, j: number) => (
              <div key={j} className="flex gap-2 text-xs">
                <span className="text-slate-400 dark:text-slate-500 w-8 flex-shrink-0">Ch {ch.chapter_number}</span>
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{ch.title}</span>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">{ch.beat}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProseView({ data }: { data: Record<string, unknown> }) {
  const text = String(data.edited_prose ?? data.prose_text ?? '');
  return (
    <div>
      {!!data.word_count && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{Number(data.word_count).toLocaleString()} words</p>
      )}
      <div className="prose-content text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {text.split('\n\n').map((para, i) => (
          para.trim() ? <p key={i} className="mb-4">{para}</p> : null
        ))}
      </div>
    </div>
  );
}

function ScienceView({ data }: { data: Record<string, unknown> }) {
  const techs = Array.isArray(data.technology_annotations) ? data.technology_annotations as any[] : [];
  const details = Array.isArray(data.recommended_details) ? data.recommended_details as string[] : [];
  const opportunities = Array.isArray(data.scientific_plot_opportunities) ? data.scientific_plot_opportunities as any[] : [];

  const plausibilityConfig: Record<string, { label: string; cls: string }> = {
    hard:        { label: 'Hard SF',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' },
    soft:        { label: 'Soft SF',      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' },
    speculative: { label: 'Speculative',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300' },
    fantasy:     { label: 'Fantasy',      cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300' },
  };

  return (
    <div className="space-y-4">
      {/* Physics consistency */}
      {!!data.world_physics_consistency && (
        <div className="bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900 rounded-lg p-3">
          <p className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1">Physics Assessment</p>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{String(data.world_physics_consistency)}</p>
        </div>
      )}

      {/* Technology cards */}
      {techs.length > 0 && (
        <Section title="Technologies">
          {techs.map((tech, i) => {
            const rating = String(tech.plausibility_rating ?? '').toLowerCase();
            const badge = plausibilityConfig[rating] ?? { label: rating, cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
            return (
              <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{tech.tech_name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
                </div>
                {tech.real_science_basis && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Basis: </span>{tech.real_science_basis}
                  </p>
                )}
                {tech.how_it_could_work && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{tech.how_it_could_work}</p>
                )}
                {tech.narrative_tensions && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Story tension: </span>{tech.narrative_tensions}
                  </p>
                )}
                {tech.author_notes && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic">Note: {tech.author_notes}</p>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {/* Recommended prose details */}
      {details.length > 0 && (
        <Section title="Prose Details">
          <div className="space-y-1">
            {details.map((d, i) => (
              <div key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="text-cyan-400 dark:text-cyan-600 flex-shrink-0 mt-0.5">›</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Plot opportunities */}
      {opportunities.length > 0 && (
        <Section title="Story Opportunities">
          <div className="space-y-2">
            {opportunities.map((o, i) => {
              if (typeof o === 'string') {
                return (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="text-slate-400 dark:text-slate-500 flex-shrink-0 font-medium w-4">{i + 1}.</span>
                    <span className="text-slate-600 dark:text-slate-300">{o}</span>
                  </div>
                );
              }
              // Object shape: {opportunity, description, conflict_driver}
              return (
                <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 space-y-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{i + 1}. {o.opportunity}</p>
                  {o.description && <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{o.description}</p>}
                  {o.conflict_driver && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                      <span className="font-medium not-italic text-slate-500 dark:text-slate-400">Conflict: </span>{o.conflict_driver}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function SceneView({ data }: { data: Record<string, unknown> }) {
  const chapters = Array.isArray(data.chapters) ? data.chapters as any[] : [];
  if (chapters.length === 0 && data.raw) {
    return <RawFallback label="Scene Outline" raw={String(data.raw)} />;
  }
  return (
    <div className="space-y-5">
      {chapters.map((ch: any, ci: number) => (
        <div key={ci}>
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Ch {ch.chapter_number}: {ch.title}
          </h4>
          <div className="space-y-2">
            {(ch.scenes ?? []).map((sc: any, si: number) => (
              <div key={si} className="border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Scene {sc.scene_number}{sc.location ? ` — ${sc.location}` : ''}
                  </span>
                  {sc.time_of_day && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{sc.time_of_day}</span>
                  )}
                </div>
                {sc.pov_character_id && (
                  <p className="text-[10px] text-indigo-500 dark:text-indigo-400">POV: {sc.pov_character_id}</p>
                )}
                {sc.scene_goal && <InfoRow label="Goal" value={sc.scene_goal} />}
                {sc.conflict && <InfoRow label="Conflict" value={sc.conflict} />}
                {sc.outcome && <InfoRow label="Outcome" value={sc.outcome} />}
                {sc.emotional_arc && <InfoRow label="Emotional arc" value={sc.emotional_arc} />}
                {Array.isArray(sc.sensory_anchors) && sc.sensory_anchors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(sc.sensory_anchors as string[]).map((a: string, ai: number) => (
                      <span key={ai} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContinuityView({ data }: { data: Record<string, unknown> }) {
  const conflicts = Array.isArray(data.conflicts) ? data.conflicts as any[] : [];
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions as string[] : [];
  if (conflicts.length === 0 && suggestions.length === 0 && data.raw) {
    return <RawFallback label="Continuity Report" raw={String(data.raw)} />;
  }
  return (
    <div className="space-y-4">
      {conflicts.length > 0 && (
        <Section title="Continuity Issues">
          <div className="space-y-2">
            {conflicts.map((c: any, i: number) => (
              <div key={i} className="border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 bg-amber-50 dark:bg-amber-950/30">
                {typeof c === 'string' ? (
                  <p className="text-xs text-slate-700 dark:text-slate-300">{c}</p>
                ) : (
                  <>
                    {c.issue && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{c.issue}</p>}
                    {c.location && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.location}</p>}
                    {c.suggestion && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 italic">{c.suggestion}</p>}
                  </>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
      {conflicts.length === 0 && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
          <span className="text-emerald-500 text-sm">✓</span>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">No continuity issues found</p>
        </div>
      )}
      {suggestions.length > 0 && (
        <Section title="Suggestions">
          <div className="space-y-1">
            {suggestions.map((s: string, i: number) => (
              <div key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="text-indigo-400 dark:text-indigo-500 flex-shrink-0 mt-0.5">›</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

const RawFallback = ({ label, raw }: { label: string; raw: string }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
      <span className="text-amber-500 text-sm">⚠</span>
      <p className="text-xs text-amber-700 dark:text-amber-300">
        {label} — structured view unavailable (AI returned unstructured text)
      </p>
    </div>
    <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded-lg p-3 overflow-auto max-h-96">
      {raw}
    </pre>
  </div>
);

// Helpers
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}: </span>
    <span className="text-xs text-slate-700 dark:text-slate-200">{value}</span>
  </div>
);

import type { ReactNode } from 'react';
interface SectionProps { title: string; children: ReactNode }
const Section = ({ title, children }: SectionProps) => (
  <div>
    <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{title}</h5>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const Card = ({ title, body, note }: { title: string; body: string; note?: string }) => (
  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{title}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{body}</p>
    {note && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 italic">{note}</p>}
  </div>
);
