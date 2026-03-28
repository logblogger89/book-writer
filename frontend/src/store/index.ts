import { create } from 'zustand';
import type { PhaseState, PhaseStatus, ProjectStatus, StreamMessage } from '../types/pipeline';
import { PHASE_ORDER } from '../types/pipeline';
import type { ChoiceOption } from '../types/events';

interface PendingChoice {
  choice_id: string;
  phase_key: string;
  options: ChoiceOption[];
}

export interface ModelAssignment {
  provider: 'gemini' | 'anthropic';
  model: string;
}

interface AppStore {
  // Project
  projectId: string | null;
  projectTitle: string;
  projectStatus: ProjectStatus;
  autoPilot: boolean;
  setProject: (id: string, title: string) => void;
  clearProject: () => void;
  setProjectStatus: (status: ProjectStatus) => void;
  setAutoPilot: (val: boolean) => void;

  // Phases
  phases: Record<string, PhaseState>;
  activePhase: string | null;
  initPhases: (phases: Array<{ phase_key: string; status: string; iteration: number; artifact_id: string | null }>) => void;
  setPhaseStatus: (key: string, status: PhaseStatus, iteration?: number) => void;
  setActivePhase: (key: string | null) => void;
  appendStreamChunk: (phase_key: string, chunk: string, message_id: string) => void;
  finalizeStream: (phase_key: string, message_id: string, full_content: string) => void;
  addMessage: (msg: StreamMessage) => void;

  // Artifacts
  artifacts: Record<string, { id: string; type: string; version: number; content: unknown }>;
  setArtifact: (type: string, id: string, version: number, content: unknown) => void;
  updateArtifactContent: (type: string, content: unknown, version: number) => void;

  // Choice
  pendingChoice: PendingChoice | null;
  setPendingChoice: (choice: PendingChoice | null) => void;

  // Rate limit
  rateLimitWaiting: { seconds: number; phase_key: string } | null;
  setRateLimitWaiting: (info: { seconds: number; phase_key: string } | null) => void;

  // Dark mode
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Messages (all, cross-phase feed)
  allMessages: StreamMessage[];

  // Active artifact tab
  activeArtifactTab: string;
  setActiveArtifactTab: (tab: string) => void;

  // Per-expert model config
  modelConfig: Record<string, ModelAssignment>;
  setModelConfig: (config: Record<string, ModelAssignment>) => void;
  setPhaseModel: (phase_key: string, assignment: ModelAssignment) => void;

  // Chapter generation progress
  chapterProgress: { currentChapter: number; totalChapters: number; activePhase: string | null } | null;
  setChapterProgress: (p: { currentChapter: number; totalChapters: number; activePhase: string | null } | null) => void;
  viewingChapter: number;
  setViewingChapter: (n: number) => void;
}

const defaultPhaseState = (phase_key: string): PhaseState => ({
  phase_key,
  status: 'pending',
  iteration: 1,
  artifact_id: null,
  streamBuffer: '',
  messages: [],
});

export const useStore = create<AppStore>((set) => ({
  projectId: null,
  projectTitle: '',
  projectStatus: 'idle',
  autoPilot: false,
  setProject: (id, title) => set({
    projectId: id,
    projectTitle: title,
    projectStatus: 'idle',
    autoPilot: false,
    phases: Object.fromEntries(PHASE_ORDER.map(k => [k, defaultPhaseState(k)])),
    activePhase: null,
    artifacts: {},
    allMessages: [],
    pendingChoice: null,
    rateLimitWaiting: null,
    activeArtifactTab: 'logline',
    modelConfig: {},
    chapterProgress: null,
    viewingChapter: 1,
  }),
  clearProject: () => set({
    projectId: null,
    projectTitle: '',
    projectStatus: 'idle',
    autoPilot: false,
    phases: Object.fromEntries(PHASE_ORDER.map(k => [k, defaultPhaseState(k)])),
    activePhase: null,
    artifacts: {},
    allMessages: [],
    pendingChoice: null,
    rateLimitWaiting: null,
    activeArtifactTab: 'logline',
    modelConfig: {},
    chapterProgress: null,
    viewingChapter: 1,
  }),
  setProjectStatus: (status) => set({ projectStatus: status }),
  setAutoPilot: (val) => set({ autoPilot: val }),

  phases: Object.fromEntries(PHASE_ORDER.map(k => [k, defaultPhaseState(k)])),
  activePhase: null,
  initPhases: (phases) => {
    const map: Record<string, PhaseState> = {};
    for (const p of phases) {
      map[p.phase_key] = {
        ...defaultPhaseState(p.phase_key),
        status: p.status as PhaseStatus,
        iteration: p.iteration,
        artifact_id: p.artifact_id,
      };
    }
    set({ phases: map });
  },
  setPhaseStatus: (key, status, iteration) =>
    set(state => ({
      phases: {
        ...state.phases,
        [key]: {
          ...state.phases[key],
          status,
          iteration: iteration ?? state.phases[key]?.iteration ?? 1,
          streamBuffer: status === 'running' ? '' : state.phases[key]?.streamBuffer ?? '',
        },
      },
    })),
  setActivePhase: (key) => set({ activePhase: key }),

  appendStreamChunk: (phase_key, chunk, _message_id) =>
    set(state => ({
      phases: {
        ...state.phases,
        [phase_key]: {
          ...state.phases[phase_key],
          streamBuffer: (state.phases[phase_key]?.streamBuffer ?? '') + chunk,
        },
      },
    })),

  finalizeStream: (phase_key, message_id, full_content) => {
    const msg: StreamMessage = {
      id: message_id,
      role: 'agent',
      content: full_content,
      is_interrupt: false,
      phase_key,
      timestamp: Date.now(),
    };
    set(state => ({
      phases: {
        ...state.phases,
        [phase_key]: {
          ...state.phases[phase_key],
          streamBuffer: '',
          messages: [...(state.phases[phase_key]?.messages ?? []), msg],
        },
      },
      allMessages: [...state.allMessages, msg],
    }));
  },

  addMessage: (msg) =>
    set(state => ({ allMessages: [...state.allMessages, msg] })),

  artifacts: {},
  setArtifact: (type, id, version, content) =>
    set(state => ({
      artifacts: { ...state.artifacts, [type]: { id, type, version, content } },
    })),
  updateArtifactContent: (type, content, version) =>
    set(state => {
      const existing = state.artifacts[type];
      if (!existing) return state;
      return { artifacts: { ...state.artifacts, [type]: { ...existing, content, version } } };
    }),

  pendingChoice: null,
  setPendingChoice: (choice) => set({ pendingChoice: choice }),

  rateLimitWaiting: null,
  setRateLimitWaiting: (info) => set({ rateLimitWaiting: info }),

  darkMode: localStorage.getItem('darkMode') === 'true',
  toggleDarkMode: () =>
    set(state => {
      const next = !state.darkMode;
      localStorage.setItem('darkMode', String(next));
      return { darkMode: next };
    }),

  allMessages: [],

  activeArtifactTab: 'logline',
  setActiveArtifactTab: (tab) => set({ activeArtifactTab: tab }),

  modelConfig: {},
  setModelConfig: (config) => set({ modelConfig: config }),
  setPhaseModel: (phase_key, assignment) =>
    set(state => ({ modelConfig: { ...state.modelConfig, [phase_key]: assignment } })),

  chapterProgress: null,
  setChapterProgress: (p) => set({ chapterProgress: p }),
  viewingChapter: 1,
  setViewingChapter: (n) => set({ viewingChapter: n }),
}));
