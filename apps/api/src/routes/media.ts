import type { FastifyInstance } from 'fastify';
import { buildMediaUrl } from '../services/media';

export async function registerMediaRoutes(app: FastifyInstance): Promise<void> {
  app.get('/media/*', async (request, reply) => {
    const params = request.params as { '*': string };
    const object = params['*'];
    return reply.redirect(buildMediaUrl(object));
  });
}
