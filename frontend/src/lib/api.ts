/**
 * Typed API client for the WorkTrace backend.
 * All requests go directly to the FastAPI backend — no Next.js API routes.
 */

import type {
  UploadResponse,
  RunLocalResponse,
  PipelineOutput,
  CopilotOutput,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { detail?: string; error?: string };
      message = body.detail ?? body.error ?? message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function checkHealth(): Promise<{ status: string }> {
  return request('/api/health');
}

export async function runLocalAnalysis(maxFiles = 3): Promise<RunLocalResponse> {
  return request<RunLocalResponse>(
    `/api/run-local?max_files=${maxFiles}`,
    { method: 'POST' }
  );
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  return request<UploadResponse>('/api/upload', {
    method: 'POST',
    body: form,
  });
}

export async function runPipeline(processId: string): Promise<{ status: string }> {
  return request(`/api/process/${processId}/run-pipeline`, { method: 'POST' });
}

export async function runAnalysis(processId: string): Promise<CopilotOutput> {
  const res = await request<{ result: CopilotOutput } | CopilotOutput>(
    `/api/process/${processId}/analyze`,
    { method: 'POST' }
  );
  return 'result' in res ? res.result : res;
}

export async function getPipelineOutput(processId: string): Promise<PipelineOutput> {
  return request<PipelineOutput>(`/api/process/${processId}`);
}

export async function getCopilotOutput(processId: string): Promise<CopilotOutput> {
  return request<CopilotOutput>(`/api/process/${processId}/copilot`);
}

export async function getBpmnXml(processId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/process/${processId}/bpmn`, {
    headers: { Accept: 'application/xml, text/xml, */*' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function askProcess(processId: string, question: string): Promise<{ answer: string }> {
  return request<{ answer: string }>(`/api/process/${processId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
}

export async function getReferenceBpmn(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/reference-bpmn`, {
    headers: { Accept: 'application/xml, text/xml, */*' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
