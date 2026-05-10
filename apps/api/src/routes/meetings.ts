import type { FastifyInstance } from 'fastify';
import { prisma, type Prisma } from '@taskara/db';
import { createMeetingSchema, createMeetingTasksSchema, meetingListQuerySchema, updateMeetingSchema } from '@taskara/shared';
import { getRequestActor, isWorkspaceAdminRole } from '../services/actor';
import { assertActorCanAccessTeamSlug } from '../services/team-access';
import {
  buildMeetingAccessWhere,
  createMeeting,
  createTasksFromMeeting,
  meetingInclude,
  resolveMeetingAccessScope,
  sendMeetingSms,
  updateMeeting
} from '../services/meetings';

export async function registerMeetingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/meetings', async (request) => {
    const actor = await getRequestActor(request);
    const query = meetingListQuerySchema.parse(request.query);
    const isAdmin = isWorkspaceAdminRole(actor.role);
    const accessScope = await resolveMeetingAccessScope(actor);

    const where: Prisma.MeetingWhereInput = {
      workspaceId: actor.workspace.id,
      status: query.status
    };

    if (query.teamId !== 'all') {
      if (!isAdmin) await assertActorCanAccessTeamSlug(actor, query.teamId);
      where.team = { workspaceId: actor.workspace.id, slug: query.teamId };
    }

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      buildMeetingAccessWhere(actor, accessScope, { mineOnly: query.mine })
    ];

    if (query.q) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } }
          ]
        }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        include: meetingInclude,
        orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
        take: query.limit,
        skip: query.offset
      }),
      prisma.meeting.count({ where })
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  });

  app.post('/meetings', async (request, reply) => {
    const actor = await getRequestActor(request);
    const input = createMeetingSchema.parse(request.body);
    const meeting = await createMeeting(actor, input);
    return reply.code(201).send(meeting);
  });

  app.get('/meetings/:id', async (request, reply) => {
    const actor = await getRequestActor(request);
    const accessScope = await resolveMeetingAccessScope(actor);
    const { id } = request.params as { id: string };
    const meeting = await prisma.meeting.findFirst({
      where: {
        id,
        workspaceId: actor.workspace.id,
        AND: [buildMeetingAccessWhere(actor, accessScope)]
      },
      include: meetingInclude
    });
    if (!meeting) return reply.code(404).send({ message: 'Meeting not found' });
    return meeting;
  });

  app.patch('/meetings/:id', async (request) => {
    const actor = await getRequestActor(request);
    const { id } = request.params as { id: string };
    const input = updateMeetingSchema.parse(request.body);
    return updateMeeting(actor, id, input);
  });

  app.post('/meetings/:id/tasks', async (request, reply) => {
    const actor = await getRequestActor(request);
    const { id } = request.params as { id: string };
    const input = createMeetingTasksSchema.parse(request.body);
    const result = await createTasksFromMeeting(actor, id, input);
    return reply.code(201).send(result);
  });

  app.post('/meetings/:id/sms', async (request) => {
    const actor = await getRequestActor(request);
    const { id } = request.params as { id: string };
    return sendMeetingSms(actor, id);
  });
}
