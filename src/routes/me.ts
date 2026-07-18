import { FastifyInstance } from 'fastify';

const ROLE_MAP: Record<string, 'HOMEOWNER' | 'CONTRACTOR' | 'ADMIN'> = {
  homeowner: 'HOMEOWNER',
  contractor: 'CONTRACTOR',
  admin: 'ADMIN',
};

/**
 * Authenticated-user context. Replaces the dev demo-actor bootstrap: the logged
 * in user is the actor. For the single-login demo, owner and contractor are the
 * same user id (so one account can capture and also buy to show the paywall).
 */
export default async function meRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/me/context', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string | undefined;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const user = await fastify.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(401).send({ error: 'Unknown user' });

    let property = await fastify.prisma.property.findFirst({ where: { ownerId: user.id } });
    if (!property) {
      property = await fastify.prisma.property.create({
        data: { ownerId: user.id, address: 'My Home', metadata: {} },
      });
    }

    return {
      propertyId: property.id,
      ownerId: user.id,
      contractorId: user.id,
      role: user.role.toLowerCase(),
      email: user.email,
    };
  });

  fastify.post<{ Body: { role: string } }>('/v1/me/role', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string | undefined;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const dbRole = ROLE_MAP[request.body?.role];
    if (!dbRole) return reply.code(400).send({ error: 'Invalid role' });

    const user = await fastify.prisma.user.update({
      where: { id: userId },
      data: { role: dbRole },
    });
    return { role: user.role.toLowerCase() };
  });
}
