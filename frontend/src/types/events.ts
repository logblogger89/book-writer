export interface ChoiceOption {
  id: string;
  label: string;
  summary: string;
  is_recommended: boolean;
}

export interface WsEvent {
  event: string;
  project_id?: string;
  phase_key?: string;
  [key: string]: unknown;
}

export interface StreamChunkEvent extends WsEvent {
  event: 'stream_chunk';
  phase_key: string;
  chunk: string;
  message_id: string;
}

export interface StreamEndEvent extends WsEvent {
  event: 'stream_end';
  phase_key: string;
  message_id: string;
  full_content: string;
}

export interface ChoiceReadyEvent extends WsEvent {
  event: 'choice_ready';
  phase_key: string;
  choice_id: string;
  options: ChoiceOption[];
}

export interface StateSyncEvent extends WsEvent {
  event: 'state_sync';
  project_id: string;
  phases: Array<{ phase_key: string; status: string; iteration: number; artifact_id: string | null }>;
  active_phase: string | null;
  pipeline_status: string;
  auto_pilot: boolean;
}
