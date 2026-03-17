import { apiClient } from '@/lib/axios';
import type { JobDto, DashboardStatsDto } from '@/domain/services';

// --- Types for API params/responses ---
export interface FetchJobsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  level?: string;
  source?: string;
}

export interface FetchJobsResponse {
  success: boolean;
  data: JobDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FetchStatsResponse extends DashboardStatsDto {
  success: boolean;
}

// --- API functions ---
export async function fetchJobs(params: FetchJobsParams): Promise<FetchJobsResponse> {
  const { data } = await apiClient.get('/jobs', { params });
  return data;
}

export async function fetchJobStats(): Promise<FetchStatsResponse> {
  const { data } = await apiClient.get('/jobs/stats');
  return data;
}

export async function updateJob(id: string, body: { status?: string; level?: string | null }) {
  const { data } = await apiClient.patch(`/jobs/${id}`, body);
  return data;
}

export async function deleteJob(id: string) {
  const { data } = await apiClient.delete(`/jobs/${id}`);
  return data;
}
