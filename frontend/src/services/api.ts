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

// ─── Explanation Types ────────────────────────────────────────────────────────

export interface SymbolExplanation {
  name: string;
  symbol_type: 'function' | 'class' | 'method';
  file_path: string;
  start_line: number;
  end_line: number;
  summary: string;
  inputs?: string;
  outputs?: string;
  side_effects?: string;
  edge_cases?: string;
  dependencies: string[];
  uncertainty?: string;
}

export interface FileExplanation {
  path: string;
  language: string;
  total_lines: number;
  summary: string;
  purpose?: string;
  key_exports: string[];
  dependencies: string[];
  symbols: SymbolExplanation[];
  uncertainty?: string;
  error?: string;
}

export interface ProjectExplanation {
  overview: string;
  languages: string[];
  total_files: number;
  total_lines: number;
  architecture_summary?: string;
  entry_points: string[];
  files: FileExplanation[];
  partial: boolean;
  error?: string;
}

// ─── API Client ───────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      ...options,
    });
  } catch (err: any) {
    if (err instanceof TypeError || err?.name === 'TypeError' || String(err?.message).includes('fetch')) {
      throw new Error(
        'Unable to reach backend service. Please check network connection, server status, and GEMINI_API_KEY configuration.'
      );
    }
    throw err;
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    const msg =
      typeof detail?.detail === 'string'
        ? detail.detail
        : detail?.detail?.message || detail?.message || `Request failed with status ${response.status}`;
    throw new Error(msg);
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

export async function fetchJobExplanation(jobId: string): Promise<ProjectExplanation> {
  return apiFetch<ProjectExplanation>(`/api/jobs/${jobId}/explain`);
}

// ─── Test Suite Types ─────────────────────────────────────────────────────────

export interface GeneratedTestFile {
  file_path: string;
  target_file: string;
  code: string;
  language: string;
}

export interface TestCaseResult {
  name: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration_seconds: number;
  message?: string;
}

export interface TestCoverageSummary {
  covered_lines: number;
  total_lines: number;
  coverage_percent: number;
  uncovered_lines_by_file: Record<string, number[]>;
}

export interface TestExecutionResult {
  status: 'passed' | 'failed' | 'error';
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  error_tests: number;
  duration_seconds: number;
  test_cases: TestCaseResult[];
  coverage?: TestCoverageSummary;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface JobTestResults {
  generated_files: GeneratedTestFile[];
  execution?: TestExecutionResult;
  retry_count?: number;
  target_reached?: boolean;
  coverage_history?: number[];
  error?: string;
}

export async function fetchJobTests(jobId: string): Promise<JobTestResults> {
  return apiFetch<JobTestResults>(`/api/jobs/${jobId}/tests`);
}

export async function retryJobTests(jobId: string): Promise<JobTestResults> {
  return apiFetch<JobTestResults>(`/api/jobs/${jobId}/retry-tests`, { method: 'POST' });
}

export async function deleteJob(jobId: string): Promise<void> {
  await apiFetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
}

// ─── Refactor Types ───────────────────────────────────────────────────────────

export interface BreakingChangeWarning {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  change_type: string;
  symbol: string;
  description: string;
  original_signature?: string;
  proposed_signature?: string;
  migration_hint: string;
}

export interface RefactoredFile {
  file_path: string;
  language: string;
  original_code: string;
  proposed_code: string;
  unified_diff: string;
  breaking_changes: BreakingChangeWarning[];
  high_count: number;
  medium_count: number;
  low_count: number;
  refactor_summary: string;
}

export interface ProjectRefactorProposal {
  total_files_refactored: number;
  total_warnings: number;
  high_warnings: number;
  medium_warnings: number;
  low_warnings: number;
  files: RefactoredFile[];
  error?: string;
}

export async function fetchJobRefactor(jobId: string): Promise<ProjectRefactorProposal> {
  return apiFetch<ProjectRefactorProposal>(`/api/jobs/${jobId}/refactor`);
}

