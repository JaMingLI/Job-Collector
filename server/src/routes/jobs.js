import { db, stmts } from '../db.js';
import { getSalaryBucket } from '../utils/salary.js';
import { toJobDto } from '../utils/transform.js';

const VALID_STATUSES = ['pending', 'applied', 'interview', 'accepted', 'rejected', 'unset'];
const VALID_LEVELS = ['junior', 'mid', 'senior', 'lead', null];

export default async function jobsRoutes(fastify) {
  // POST /api/jobs
  fastify.post('/api/jobs', async (request, reply) => {
    const { jobs = [], searchContext = {}, interceptedAt } = request.body || {};

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return reply.code(400).send({ success: false, error: 'No jobs provided' });
    }

    let newCount = 0;
    let duplicateCount = 0;

    const upsertJobs = db.transaction(() => {
      for (const job of jobs) {
        const jobNo = String(job.jobNo || job.job_no || '');
        if (!jobNo) continue;

        const existing = stmts.findByJobNo.get(jobNo);

        const params = {
          job_no: jobNo,
          job_name: job.jobName || job.job_name || null,
          cust_name: job.custName || job.cust_name || null,
          cust_no: job.custNo || job.cust_no || null,
          co_industry: job.coIndustry || job.co_industry || null,
          description: job.description || job.jobContent || null,
          area: job.jobAddrNoDesc || job.area || null,
          address: job.jobAddress || job.address || null,
          salary_low: job.salaryLow ?? job.salary_low ?? null,
          salary_high: job.salaryHigh ?? job.salary_high ?? null,
          job_link: job.link?.job ? `https:${job.link.job}` : job.job_link || null,
          cust_link: job.link?.cust ? `https:${job.link.cust}` : job.cust_link || null,
          skills: Array.isArray(job.pcSkills) ? JSON.stringify(job.pcSkills.map(s => s.description || s)) : (job.skills || '[]'),
          appear_date: job.appearDate || job.appear_date || null,
          apply_cnt: job.applyCnt ?? job.apply_cnt ?? null,
          period: job.period ?? null,
          remote_work: job.remoteWork || job.remote_work || null,
          employee_count: job.employeeCount || job.employee_count || null,
          lat: job.lat ?? null,
          lon: job.lon ?? null,
          is_applied: job.isApplied ?? job.is_applied ?? 0,
          is_saved: job.isSaved ?? job.is_saved ?? 0,
          search_keyword: searchContext.keyword || null,
          source: '104',
        };

        if (existing) {
          stmts.updateJob.run({
            job_no: params.job_no,
            appear_date: params.appear_date,
            apply_cnt: params.apply_cnt,
            salary_low: params.salary_low,
            salary_high: params.salary_high,
            is_applied: params.is_applied,
            is_saved: params.is_saved,
          });
          duplicateCount++;
        } else {
          stmts.insertJob.run(params);
          newCount++;
        }
      }

      // Log the search
      stmts.insertSearchLog.run({
        keyword: searchContext.keyword || null,
        area: searchContext.area || null,
        page: searchContext.page ?? null,
        total_pages: searchContext.totalPages ?? null,
        total_jobs: searchContext.totalJobs ?? null,
        jobs_in_page: jobs.length,
        intercepted_at: interceptedAt || new Date().toISOString(),
      });
    });

    upsertJobs();

    const { total } = stmts.countJobs.get();

    return {
      success: true,
      newCount,
      duplicateCount,
      totalInDB: total,
    };
  });

  // GET /api/jobs
  fastify.get('/api/jobs', async (request) => {
    const {
      page = 1,
      limit,
      pageSize,
      keyword,
      search,
      skills,
      area,
      salary_min,
      status,
      level,
      source,
      sort = 'created_at',
      order = 'DESC',
    } = request.query;

    const effectiveLimit = pageSize || limit || 20;
    const effectiveKeyword = search || keyword;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(effectiveLimit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clauses
    const conditions = [];
    const params = {};

    if (effectiveKeyword) {
      conditions.push('(job_name LIKE @kw OR cust_name LIKE @kw OR description LIKE @kw)');
      params.kw = `%${effectiveKeyword}%`;
    }
    if (skills) {
      conditions.push('skills LIKE @skills');
      params.skills = `%${skills}%`;
    }
    if (area) {
      conditions.push('area LIKE @area');
      params.area = `%${area}%`;
    }
    if (salary_min) {
      conditions.push('salary_low >= @salary_min');
      params.salary_min = parseInt(salary_min, 10);
    }
    if (status) {
      conditions.push('status = @status');
      params.status = status;
    }
    if (level) {
      conditions.push('level = @level');
      params.level = level;
    }
    if (source) {
      conditions.push('source = @source');
      params.source = source;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Whitelist sort columns
    const allowedSorts = ['created_at', 'appear_date', 'salary_low', 'apply_cnt', 'job_name', 'status', 'level', 'source'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM jobs ${whereClause}`).get(params);
    const total = countRow.total;

    const rows = db.prepare(
      `SELECT * FROM jobs ${whereClause} ORDER BY ${sortCol} ${sortOrder} LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit: limitNum, offset });

    return {
      success: true,
      data: rows.map(toJobDto),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });

  // GET /api/jobs/stats
  fastify.get('/api/jobs/stats', async () => {
    const { total: totalJobs } = stmts.countJobs.get();

    const byKeyword = db.prepare(
      'SELECT search_keyword as keyword, COUNT(*) as count FROM jobs WHERE search_keyword IS NOT NULL GROUP BY search_keyword ORDER BY count DESC'
    ).all();

    const byArea = db.prepare(
      'SELECT area, COUNT(*) as count FROM jobs WHERE area IS NOT NULL GROUP BY area ORDER BY count DESC LIMIT 20'
    ).all();

    // Top skills - parse JSON skills arrays and count frequencies
    const allSkills = db.prepare("SELECT skills FROM jobs WHERE skills IS NOT NULL AND skills != '[]'").all();
    const skillFreq = {};
    for (const row of allSkills) {
      try {
        const arr = JSON.parse(row.skills);
        for (const s of arr) {
          const name = typeof s === 'string' ? s : s.description || String(s);
          if (name) skillFreq[name] = (skillFreq[name] || 0) + 1;
        }
      } catch { /* skip malformed */ }
    }
    const topSkills = Object.entries(skillFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([skill, count]) => ({ skill, count }));

    const salaryDistribution = db.prepare(`
      SELECT
        SUM(CASE WHEN salary_low IS NULL AND salary_high IS NULL THEN 1 ELSE 0 END) as undisclosed,
        SUM(CASE WHEN COALESCE(salary_low, salary_high, 0) > 0 AND COALESCE(salary_low, salary_high) < 40000 THEN 1 ELSE 0 END) as under40k,
        SUM(CASE WHEN COALESCE(salary_low, salary_high) >= 40000 AND COALESCE(salary_low, salary_high) < 60000 THEN 1 ELSE 0 END) as "40k_60k",
        SUM(CASE WHEN COALESCE(salary_low, salary_high) >= 60000 AND COALESCE(salary_low, salary_high) < 80000 THEN 1 ELSE 0 END) as "60k_80k",
        SUM(CASE WHEN COALESCE(salary_low, salary_high) >= 80000 AND COALESCE(salary_low, salary_high) < 100000 THEN 1 ELSE 0 END) as "80k_100k",
        SUM(CASE WHEN COALESCE(salary_low, salary_high) >= 100000 THEN 1 ELSE 0 END) as above100k
      FROM jobs
    `).get();

    const timeStats = db.prepare('SELECT MIN(created_at) as collectedSince, MAX(updated_at) as lastUpdated FROM jobs').get();

    // Dashboard status counts
    const statusCounts = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied,
        SUM(CASE WHEN status = 'interview' THEN 1 ELSE 0 END) as interview,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted
      FROM jobs
    `).get();

    return {
      success: true,
      totalJobs,
      total: statusCounts.total,
      pending: statusCounts.pending,
      applied: statusCounts.applied,
      interview: statusCounts.interview,
      accepted: statusCounts.accepted,
      byKeyword,
      byArea,
      topSkills,
      salaryDistribution,
      collectedSince: timeStats.collectedSince,
      lastUpdated: timeStats.lastUpdated,
    };
  });

  // GET /api/jobs/:id — must be registered AFTER /api/jobs/stats
  fastify.get('/api/jobs/:id', async (request, reply) => {
    const { id } = request.params;
    const row = stmts.getJobById.get(id);

    if (!row) {
      return reply.code(404).send({ success: false, error: 'Job not found' });
    }

    return { success: true, data: toJobDto(row) };
  });

  // PATCH /api/jobs/:id
  fastify.patch('/api/jobs/:id', async (request, reply) => {
    const { id } = request.params;
    const { status, level } = request.body || {};

    const row = stmts.getJobById.get(id);
    if (!row) {
      return reply.code(404).send({ success: false, error: 'Job not found' });
    }

    const updates = [];
    const params = { id };

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return reply.code(400).send({ success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      updates.push('status = @status');
      params.status = status;

      // Sync is_applied
      updates.push('is_applied = @is_applied');
      params.is_applied = status === 'applied' ? 1 : 0;
    }

    if (level !== undefined) {
      if (level !== null && !VALID_LEVELS.includes(level)) {
        return reply.code(400).send({ success: false, error: `Invalid level. Must be one of: ${VALID_LEVELS.filter(Boolean).join(', ')}, or null` });
      }
      updates.push('level = @level');
      params.level = level;
    }

    if (updates.length === 0) {
      return reply.code(400).send({ success: false, error: 'No valid fields to update' });
    }

    updates.push("updated_at = datetime('now')");

    db.prepare(`UPDATE jobs SET ${updates.join(', ')} WHERE id = @id`).run(params);

    const updated = stmts.getJobById.get(id);
    return { success: true, data: toJobDto(updated) };
  });

  // DELETE /api/jobs/:id
  fastify.delete('/api/jobs/:id', async (request, reply) => {
    const { id } = request.params;
    const result = stmts.deleteJobById.run(id);

    if (result.changes === 0) {
      return reply.code(404).send({ success: false, error: 'Job not found' });
    }

    return { success: true };
  });
}
