import type { FastifyInstance } from 'fastify';
import {
  createKnowledgeCommentSchema,
  createKnowledgePageSchema,
  createKnowledgeSpaceSchema,
  knowledgePageListQuerySchema,
  knowledgeReferenceTypeSchema,
  knowledgeSearchQuerySchema,
  updateKnowledgeCommentSchema,
  updateKnowledgePageSchema,
  updateKnowledgeSpaceSchema,
  verifyKnowledgePageSchema
} from '@taskara/shared';
import { z } from 'zod';
import { getRequestActor } from '../services/actor';
import {
  archiveKnowledgePage,
  createKnowledgePage,
  createKnowledgePageAttachment,
  createKnowledgePageComment,
  createKnowledgeSpace,
  findKnowledgeSpace,
  getKnowledgePage,
  listKnowledgePageComments,
  listKnowledgePageVersions,
  listKnowledgePages,
  listKnowledgeReferencesForTarget,
  listKnowledgeSpaces,
  removeKnowledgePageVerification,
  revertKnowledgePageVersion,
  searchKnowledgePages,
  subscribeKnowledgePage,
  unsubscribeKnowledgePage,
  updateKnowledgePage,
  updateKnowledgePageComment,
  updateKnowledgeSpace,
  verifyKnowledgePage
} from '../services/knowledge';
import { normalizeUploadedMediaInput, uploadedMediaInputSchema } from '../services/media';

const pageParamsSchema = z.object({ id: z.string().min(1) });
const spaceParamsSchema = z.object({ idOrKey: z.string().min(1) });
const commentParamsSchema = z.object({ id: z.string().min(1), commentId: z.string().min(1) });
const versionParamsSchema = z.object({
  id: z.string().min(1),
  version: z.coerce.number().int().min(1)
});
const referenceQuerySchema = z.object({
  type: knowledgeReferenceTypeSchema,
  targetId: z.string().min(1).optional(),
  url: z.string().url().optional()
}).refine((value) => value.targetId || value.url, {
  message: 'targetId or url is required'
});

export async function registerKnowledgeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/knowledge/spaces', async (request) => {
    const actor = await getRequestActor(request);
    return listKnowledgeSpaces(actor);
  });

  app.post('/knowledge/spaces', async (request, reply) => {
    const actor = await getRequestActor(request);
    const input = createKnowledgeSpaceSchema.parse(request.body);
    const space = await createKnowledgeSpace(actor, input);
    return reply.code(201).send(space);
  });

  app.get('/knowledge/spaces/:idOrKey', async (request, reply) => {
    const actor = await getRequestActor(request);
    const { idOrKey } = spaceParamsSchema.parse(request.params);
    const space = await findKnowledgeSpace(actor, idOrKey);
    if (!space) return reply.code(404).send({ message: 'Knowledge space not found' });
    return space;
  });

  app.patch('/knowledge/spaces/:idOrKey', async (request) => {
    const actor = await getRequestActor(request);
    const { idOrKey } = spaceParamsSchema.parse(request.params);
    const input = updateKnowledgeSpaceSchema.parse(request.body);
    return updateKnowledgeSpace(actor, idOrKey, input);
  });

  app.get('/knowledge/search', async (request) => {
    const actor = await getRequestActor(request);
    const query = knowledgeSearchQuerySchema.parse(request.query);
    return searchKnowledgePages(actor, query);
  });

  app.get('/knowledge/references', async (request) => {
    const actor = await getRequestActor(request);
    const query = referenceQuerySchema.parse(request.query);
    return listKnowledgeReferencesForTarget(actor, query);
  });

  app.get('/knowledge/pages', async (request) => {
    const actor = await getRequestActor(request);
    const query = knowledgePageListQuerySchema.parse(request.query);
    return listKnowledgePages(actor, query);
  });

  app.post('/knowledge/pages', async (request, reply) => {
    const actor = await getRequestActor(request);
    const input = createKnowledgePageSchema.parse(request.body);
    const page = await createKnowledgePage(actor, input);
    return reply.code(201).send(page);
  });

  app.post('/knowledge/pages/:id/verify', async (request) => {
    const actor = await getRequestActor(request);
    const { id } = pageParamsSchema.parse(request.params);
    const input = verifyKnowledgePageSchema.parse(request.body || {});
    return verifyKnowledgePage(actor, id, input);
  });

  app.delete('/knowledge/pages/:id/verify', async (request) => {
    const actor = await getRequestActor(request);
    const { id } = pageParamsSchema.parse(request.params);
    return removeKnowledgePageVerification(actor, id);
  });

  app.get('/knowledge/pages/:id/versions', async (request) => {
    const actor = await getRequestActor(request);
    const { id } = pageParamsSchema.parse(request.params);
    return listKnowledgePageVersions(actor, id);
  });

  app.post('/knowledge/pages/:id/versions/:version/revert', async (request) => {
    const actor = await getRequestActor(request);
    const { id, version } = versionParamsSchema.parse(request.params);
    return revertKnowledgePageVersion(actor, id, version);
  });

  app.get('/knowledge/pages/:id/comments', async (request) => {
    const actor = await getRequestActor(request);
    const { id } = pageParamsSchema.parse(request.params);
    return listKnowledgePageComments(actor, id);
  });

  app.post('/knowledge/pages/:id/comments', async (request, reply) => {
    const actor = await getRequestActor(request);
    const { id } = pageParamsSchema.parse(request.params);
    const input = createKnowledgeCommentSchema.parse(request.body);
    const comment = await createKnowledgePageComment(actor, id, input);
    return reply.code(201).send(comment);
  });

  app.patch('/knowledge/pages/:id/comments/:commentId', async (request) => {
    const actor = await getRequestActor(request);
    const { id, commentId } = commentParamsSchema.parse(request.params);
    const input = updateKnowledgeCommentSchema.parse(request.body);
    return updateKnowledgePageComment(actor, id, commentId, input);
  });

  app.post('/knowledge/pages/:id/attachments', async (request, reply) => {
    const actor = await getRequestActor(request);
    const { id } = pageParamsSchema.parse(request.params);
    const media = normalizeUploadedMediaInput(uploadedMediaInputSchema.parse(request.body));
    const attachment = await createKnowledgePageAttachment(actor, id, media);
    return reply.code(201).send(attachment);
  });

  app.post('/knowledge/pages/:id/subscribe', async (request) => {
    const actor = await getRequestActor(request);
    const { id } = pageParamsSchema.parse(request.params);
    return subscribeKnowledgePage(actor, id);
  });

  app.delete('/knowledge/pages/:id/subscribe', async (request) => {
    const actor = await getRequestActor(request);
    const { id } = pageParamsSchema.parse(request.params);
    return unsubscribeKnowledgePage(actor, id);
  });

  app.get('/knowledge/pages/:id', async (request, reply) => {
    const actor = await getRequestActor(request);
    const { id } = pageParamsSchema.parse(request.params);
    const page = await getKnowledgePage(actor, id);
    if (!page) return reply.code(404).send({ message: 'Knowledge page not found' });
    return page;
  });

  app.patch('/knowledge/pages/:id', async (request) => {
    const actor = await getRequestActor(request);
    const { id } = pageParamsSchema.parse(request.params);
    const input = updateKnowledgePageSchema.parse(request.body);
    return updateKnowledgePage(actor, id, input);
  });

  app.delete('/knowledge/pages/:id', async (request, reply) => {
    const actor = await getRequestActor(request);
    const { id } = pageParamsSchema.parse(request.params);
    await archiveKnowledgePage(actor, id);
    return reply.code(204).send();
  });

}
