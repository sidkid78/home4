import { FastifyInstance } from 'fastify';

/**
 * Development-only helpers to make the app usable end-to-end without a real
 * auth/onboarding flow. Returns stable demo actors (a Homeowner who owns a
 * demo Property, and a Contractor who can buy leads) so the frontend has valid
 * ids to drive the full capture -> report -> marketplace loop.
 */
export default async function devRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/dev/demo-property', async (_request, reply) => {
    const owner = await fastify.prisma.user.upsert({
      where: { email: 'demo-homeowner@homease.local' },
      update: {},
      create: { email: 'demo-homeowner@homease.local', role: 'HOMEOWNER' },
    });

    const contractor = await fastify.prisma.user.upsert({
      where: { email: 'demo-contractor@homease.local' },
      update: {},
      create: { email: 'demo-contractor@homease.local', role: 'CONTRACTOR' },
    });

    let property = await fastify.prisma.property.findFirst({
      where: { address: 'Demo Property', ownerId: owner.id },
    });

    if (!property) {
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
      ownerId: owner.id,
      contractorId: contractor.id,
    });
  });

  // Settle a lead purchase without a live Stripe session. Mirrors the atomic
  // lock + settlement the real checkout/webhook flow performs, so the frontend
  // can complete the marketplace loop in one call.
  fastify.post<{ Body: { leadId: string; contractorId: string } }>(
    '/v1/dev/purchase-lead',
    async (request, reply) => {
      const { leadId, contractorId } = request.body ?? {};
      if (!leadId || !contractorId) {
        return reply.code(400).send({ error: 'leadId and contractorId are required' });
      }

      try {
        const result = await fastify.prisma.$transaction(async (tx) => {
          const locked = await tx.lead.updateMany({
            where: { id: leadId, status: 'AVAILABLE' },
            data: { status: 'SOLD', contractorId, purchasedAt: new Date() },
          });
          if (locked.count === 0) {
            throw new Error('Lead is not available for purchase');
          }

          await tx.transaction.create({
            data: {
              leadId,
              stripeChargeId: `dev_charge_${Date.now()}`,
              amount: 125.0,
              netAmount: 125.0,
              currency: 'usd',
            },
          });

          return tx.lead.findUnique({ where: { id: leadId } });
        });

        return reply.send({ leadId, status: result?.status, contractorId });
      } catch (err: any) {
        if (err.message?.includes('not available')) {
          return reply.code(409).send({ error: err.message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: 'Failed to settle purchase' });
      }
    }
  );
}
