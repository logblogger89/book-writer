export type PhaseStatus = 'pending' | 'running' | 'awaiting_choice' | 'complete' | 'rolled_back' | 'error';
export type ProjectStatus = 'idle' | 'running' | 'paused' | 'awaiting_choice' | 'complete' | 'error' | 'rate_limited';

export interface PhaseState {
  phase_key: string;
  status: PhaseStatus;
  iteration: number;
  artifact_id: string | null;
  streamBuffer: string;
  messages: StreamMessage[];
}

export interface StreamMessage {
  id: string;
  role: 'agent' | 'user' | 'system';
  content: string;
  is_interrupt: boolean;
  phase_key: string;
  timestamp: number;
}

export interface Project {
  id: string;
  title: string;
  initial_premise: string;
  sub_genre: string | null;
  chapter_count: number | null;
  status: ProjectStatus;
  auto_pilot: boolean;
  created_at: string;
  updated_at: string;
}

export const PHASE_ORDER = [
  'logline_creator',
  'world_builder',
  'scientific_advisor',
  'persona_creator',
  'chapter_beats_creator',
  'scene_outliner',
  'prose_writer',
  'continuity_editor',
  'literary_editor',
  'final_draft_reviewer',
] as const;

export type PhaseKey = typeof PHASE_ORDER[number];

export const PHASE_DISPLAY_NAMES: Record<string, string> = {
  logline_creator: 'Logline Creator',
  world_builder: 'World Builder',
  scientific_advisor: 'Scientific Advisor',
  persona_creator: 'Persona Creator',
  chapter_beats_creator: 'Chapter Beats',
  scene_outliner: 'Scene Outliner',
  prose_writer: 'Prose Writer',
  continuity_editor: 'Continuity Editor',
  literary_editor: 'Literary Editor',
  final_draft_reviewer: 'Draft Reviewer',
};

export const PHASE_DEPENDENCIES: Record<string, string[]> = {
  logline_creator: [],
  world_builder: ['logline_creator'],
  scientific_advisor: ['world_builder'],
  persona_creator: ['world_builder'],
  chapter_beats_creator: ['persona_creator', 'scientific_advisor'],
  scene_outliner: ['chapter_beats_creator'],
  prose_writer: ['scene_outliner'],
  continuity_editor: ['prose_writer'],
  literary_editor: ['continuity_editor'],
  final_draft_reviewer: ['literary_editor'],
};
