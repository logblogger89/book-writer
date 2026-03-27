import api from './client';
import type { Project } from '../types/pipeline';

export const suggestNovel = (sub_genre?: string): Promise<{ data: { title: string; premise: string } }> =>
  api.get('/projects/suggest', { params: sub_genre ? { sub_genre } : {} });

export const createProject = (
  title: string,
  initial_premise: string,
  sub_genre?: string,
  chapter_count?: number,
): Promise<{ data: Project }> =>
  api.post('/projects', { title, initial_premise, sub_genre: sub_genre || null, chapter_count: chapter_count ?? null });

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
