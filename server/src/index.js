import Fastify from 'fastify';
import cors from '@fastify/cors';
import healthRoutes from './routes/health.js';
import jobsRoutes from './routes/jobs.js';

const fastify = Fastify({
  logger: true,
  bodyLimit: 5 * 1024 * 1024,
});

await fastify.register(cors, { origin: true });
await fastify.register(healthRoutes);
await fastify.register(jobsRoutes);

try {
  await fastify.listen({ port: 3104, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
