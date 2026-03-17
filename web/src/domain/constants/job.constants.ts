export const JOB_STATUS = {
  PENDING: 'pending',
  APPLIED: 'applied',
  INTERVIEW: 'interview',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  UNSET: 'unset',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export type JobLevel = 'junior' | 'mid' | 'senior' | 'lead' | null;

export type JobSource = 'linkedin' | '104' | 'yourator' | 'cakeresume' | 'other';
