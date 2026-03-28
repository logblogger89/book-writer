import api from './client';
import type { Project } from '../types/pipeline';

export interface LoglineOption {
  title: string;
  logline: string;
  thematic_pillars: string[];
  central_conflict: string;
  hook_elements: string[];
  tone: string;
  comparable_titles: string[];
}

export const suggestLoglines = (
  sub_genre?: string,
  provider?: string,
  model?: string,
): Promise<{ data: { options: LoglineOption[] } }> => {
  const params: Record<string, string> = {};
  if (sub_genre) params.sub_genre = sub_genre;
  if (provider) params.provider = provider;
  if (model) params.model = model;
  return api.get('/projects/suggest-loglines', { params });
};

export const createProject = (
  title: string,
  logline_artifact: object,
  sub_genre?: string,
  chapter_count?: number,
): Promise<{ data: Project }> =>
  api.post('/projects', { title, logline_artifact, sub_genre: sub_genre || null, chapter_count: chapter_count ?? null });

export const listProjects = (): Promise<{ data: Project[] }> =>
  api.get('/projects');

export const getProject = (id: string): Promise<{ data: Project }> =>
  api.get(`/projects/${id}`);

export const deleteProject = (id: string) =>
  api.delete(`/projects/${id}`);

export const updateProjectTitle = (id: string, title: string) =>
  api.patch(`/projects/${id}`, { title });

export const updatePhaseModel = (
  projectId: string,
  phase_key: string,
  provider: string,
  model: string,
) => api.patch(`/projects/${projectId}/model-config`, { phase_key, provider, model });
