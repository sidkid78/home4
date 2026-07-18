import { FastifyInstance } from 'fastify';

/**
 * Development-only helpers to make the capture UI usable end-to-end without a
 * real auth/onboarding flow. Returns a stable demo Property (creating a demo
 * Homeowner + Property on first call) so the frontend has a valid propertyId
 * to attach captures to.
 */
export default async function devRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/dev/demo-property', async (_request, reply) => {
    // Reuse an existing demo property if one is already present.
    let property = await fastify.prisma.property.findFirst({
      where: { address: 'Demo Property' },
    });

    if (!property) {
      const owner = await fastify.prisma.user.upsert({
        where: { email: 'demo-homeowner@homease.local' },
        update: {},
        create: { email: 'demo-homeowner@homease.local', role: 'HOMEOWNER' },
      });

      property = await fastify.prisma.property.create({
        data: {
          ownerId: owner.id,
          address: 'Demo Property',
          metadata: { demo: true },
        },
      });
    }

    return reply.send({
      propertyId: property.id,
      ownerId: property.ownerId,
    });
  });
}
