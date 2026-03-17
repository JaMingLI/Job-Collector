import type { JobLevel, JobSource, JobStatus } from '@/domain/constants/job.constants';

export interface JobDto {
  id: string;
  companyName: string;
  industry: string;
  jobTitle: string;
  level: JobLevel;
  status: JobStatus;
  salary: string;
  skills: string[];
  source: JobSource;
  postedDate: string;
  url: string;
}

export interface DashboardStatsDto {
  total: number;
  pending: number;
  applied: number;
  interview: number;
  accepted: number;
}
