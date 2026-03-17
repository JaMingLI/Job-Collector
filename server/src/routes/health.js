import { stmts } from '../db.js';

export default async function healthRoutes(fastify) {
  fastify.get('/health', async () => {
    const { total } = stmts.countJobs.get();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      totalJobs: total,
    };
  });
}
