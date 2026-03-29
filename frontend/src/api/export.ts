import api from './client';

export async function exportNovel(projectId: string, format: 'pdf' | 'docx'): Promise<void> {
  const res = await api.get(`/projects/${projectId}/export/${format}`, {
    responseType: 'blob',
  });
  const disposition = res.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="(.+?)"/);
  const filename = match?.[1] ?? `novel.${format}`;
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
