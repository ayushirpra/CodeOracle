export interface HealthResponse {
  status: string;
  app: string;
  environment: string;
  timestamp: string;
  phase: number;
}

export interface FileStats {
  path: string;
  language: string;
  extension: string;
  lines: number;
  full_path: string;
}

export interface UploadStats {
  root_dir: string;
  total_files: number;
  total_lines: number;
  languages: string[];
  files: FileStats[];
  dependencies_summary?: Record<string, string[]>;
}

export interface JobResponse {
  job_id: string;
  status: 'processing' | 'completed' | 'failed';
  stage: string;
  source_type: string;
  source_info: string;
  created_at: string;
  updated_at: string;
  stats: UploadStats | null;
  error: string | null;
  stage_error: string | null;
}

export interface GraphNode {
  id: string;
  label: string;
  language: string;
  path: string;
  total_lines: number;
  num_functions: number;
  num_classes: number;
  num_imports: number;
  num_exports: number;
  has_parse_error: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  module: string;
  is_relative: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  total_nodes: number;
  total_edges: number;
  dependents_map: Record<string, string[]>;
  dependencies_map: Record<string, string[]>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(detail?.detail?.message || detail?.detail || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/health');
}

export async function uploadZip(file: File): Promise<JobResponse> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_BASE_URL}/api/projects/upload`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: { message: response.statusText } }));
    throw new Error(detail?.detail?.message || detail?.detail || `Upload failed: ${response.status}`);
  }
  return response.json();
}

export async function ingestGitHub(url: string): Promise<JobResponse> {
  const response = await fetch(`${API_BASE_URL}/api/projects/github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: { message: response.statusText } }));
    throw new Error(detail?.detail?.message || detail?.detail || `GitHub ingestion failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchJobGraph(jobId: string): Promise<GraphData> {
  return apiFetch<GraphData>(`/api/jobs/${jobId}/graph`);
}

export async function deleteJob(jobId: string): Promise<void> {
  await apiFetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
}
