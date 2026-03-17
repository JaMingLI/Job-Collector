import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'jobs.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_no TEXT UNIQUE NOT NULL,
    job_name TEXT,
    cust_name TEXT,
    cust_no TEXT,
    co_industry TEXT,
    description TEXT,
    area TEXT,
    address TEXT,
    salary_low INTEGER,
    salary_high INTEGER,
    job_link TEXT,
    cust_link TEXT,
    skills TEXT,
    appear_date TEXT,
    apply_cnt INTEGER,
    period INTEGER,
    remote_work TEXT,
    employee_count TEXT,
    lat REAL,
    lon REAL,
    is_applied INTEGER DEFAULT 0,
    is_saved INTEGER DEFAULT 0,
    search_keyword TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS search_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT,
    area TEXT,
    page INTEGER,
    total_pages INTEGER,
    total_jobs INTEGER,
    jobs_in_page INTEGER,
    intercepted_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_job_no ON jobs(job_no);
  CREATE INDEX IF NOT EXISTS idx_jobs_keyword ON jobs(search_keyword);
  CREATE INDEX IF NOT EXISTS idx_jobs_area ON jobs(area);
  CREATE INDEX IF NOT EXISTS idx_jobs_salary ON jobs(salary_low);
  CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
  CREATE INDEX IF NOT EXISTS idx_jobs_appear_date ON jobs(appear_date);
`);

// Prepared statements
const stmts = {
  findByJobNo: db.prepare('SELECT id FROM jobs WHERE job_no = ?'),

  insertJob: db.prepare(`
    INSERT INTO jobs (
      job_no, job_name, cust_name, cust_no, co_industry, description,
      area, address, salary_low, salary_high, job_link, cust_link,
      skills, appear_date, apply_cnt, period, remote_work,
      employee_count, lat, lon, is_applied, is_saved, search_keyword
    ) VALUES (
      @job_no, @job_name, @cust_name, @cust_no, @co_industry, @description,
      @area, @address, @salary_low, @salary_high, @job_link, @cust_link,
      @skills, @appear_date, @apply_cnt, @period, @remote_work,
      @employee_count, @lat, @lon, @is_applied, @is_saved, @search_keyword
    )
  `),

  updateJob: db.prepare(`
    UPDATE jobs SET
      updated_at = datetime('now'),
      appear_date = @appear_date,
      apply_cnt = @apply_cnt,
      salary_low = @salary_low,
      salary_high = @salary_high,
      is_applied = @is_applied,
      is_saved = @is_saved
    WHERE job_no = @job_no
  `),

  insertSearchLog: db.prepare(`
    INSERT INTO search_logs (keyword, area, page, total_pages, total_jobs, jobs_in_page, intercepted_at)
    VALUES (@keyword, @area, @page, @total_pages, @total_jobs, @jobs_in_page, @intercepted_at)
  `),

  countJobs: db.prepare('SELECT COUNT(*) as total FROM jobs'),
};

export { db, stmts };
