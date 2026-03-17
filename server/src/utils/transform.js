import { formatSalary } from './salary.js';

export function toJobDto(row) {
  let skills = [];
  try { skills = JSON.parse(row.skills || '[]'); } catch { skills = []; }
  skills = skills.map(s => typeof s === 'string' ? s : (s.description || String(s)));

  return {
    id: String(row.id),
    companyName: row.cust_name || '',
    industry: row.co_industry || '',
    jobTitle: row.job_name || '',
    level: row.level || null,
    status: row.status || 'unset',
    salary: formatSalary(row.salary_low, row.salary_high),
    skills,
    source: row.source || '104',
    postedDate: row.appear_date || '',
    url: row.job_link || '',
  };
}
