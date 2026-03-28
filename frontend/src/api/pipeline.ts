import api from './client';

export const startPipeline = (projectId: string) =>
  api.post(`/projects/${projectId}/start`);

export const pausePipeline = (projectId: string) =>
  api.post(`/projects/${projectId}/pause`);

export const resumePipeline = (projectId: string) =>
  api.post(`/projects/${projectId}/resume`);

export const rollback = (projectId: string, to_phase_key: string, new_context?: string) =>
  api.post(`/projects/${projectId}/rollback`, { to_phase_key, new_context: new_context || null });

export const toggleAutoPilot = (projectId: string, enabled: boolean) =>
  api.post(`/projects/${projectId}/auto-pilot`, { enabled });

export const getPhases = (projectId: string) =>
  api.get(`/projects/${projectId}/phases`);

export const getArtifacts = (projectId: string) =>
  api.get(`/projects/${projectId}/artifacts`);

export const resolveChoice = (projectId: string, choiceId: string, chosen_option_id?: string, custom_text?: string) =>
  api.post(`/projects/${projectId}/choices/${choiceId}/resolve`, { chosen_option_id, custom_text });

export const getPendingChoice = (projectId: string) =>
  api.get(`/projects/${projectId}/choices/pending`);

export const updateArtifact = (projectId: string, artifactId: string, contentJson: unknown) =>
  api.patch(`/projects/${projectId}/artifacts/${artifactId}`, { content_json: contentJson });
