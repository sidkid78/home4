import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';

const STRIPE_API_KEY = process.env.STRIPE_API_KEY || 'sk_test_mock';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock';
// Where Stripe sends the buyer after checkout — back into the SPA.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize Stripe. We use apiVersion bypass if exact type mismatches, but standard init is fine.
const stripe = new Stripe(STRIPE_API_KEY);

export default async function leadRoutes(fastify: FastifyInstance) {
  // 0. Marketplace: browse AVAILABLE leads with sanitized teaser data only.
  //    Full risks/measurements stay behind the paywall (GET /v1/reports/:id).
  fastify.get('/v1/leads', async (_request, reply) => {
    const leads = await fastify.prisma.lead.findMany({
      where: { status: 'AVAILABLE' },
      orderBy: { createdAt: 'desc' },
      include: { report: { include: { assessment: true } } },
    });

    const teasers = leads.map((lead) => {
      const risks = Array.isArray(lead.report?.assessment?.risks)
        ? (lead.report!.assessment!.risks as any[])
        : [];
      return {
        id: lead.id,
        price: Number(lead.price),
        priority: lead.report?.priority ?? 'MEDIUM',
        roomType: lead.report?.assessment?.roomType ?? 'UNKNOWN',
        estimatedValue: Number(lead.report?.estimatedValue ?? 0),
        roiValue: Number(lead.report?.roiValue ?? 0),
        materialCount: lead.report?.materialCount ?? 0,
        isHighValueLead: lead.report?.isHighValueLead ?? false,
        riskCount: risks.length,
        reportId: lead.report?.id,
      };
    });

    return reply.send(teasers);
  });

  // 0b. Lead status — polled after returning from Stripe checkout to detect
  //     when the webhook has settled the purchase (AVAILABLE/PENDING/SOLD).
  fastify.get<{ Params: { id: string } }>('/v1/leads/:id/status', async (request, reply) => {
    const lead = await fastify.prisma.lead.findUnique({
      where: { id: request.params.id },
      select: { id: true, status: true, reportId: true, contractorId: true },
    });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });
    return reply.send(lead);
  });

  // 1. Onboard Contractor
  fastify.post('/v1/contractors/onboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const contractorId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    if (!contractorId || userRole !== 'contractor') {
      return reply.code(403).send({ error: 'Only contractors can onboard via this endpoint' });
    }

    try {
      if (STRIPE_API_KEY === 'sk_test_mock' || !process.env.STRIPE_API_KEY) {
        return reply.send({ url: 'https://connect.stripe.com/mock-onboarding-link' });
      }

      // Create an Express account
      const account = await stripe.accounts.create({
        type: 'express',
        metadata: { contractorId },
      });

      // Optionally save account.id to the contractor's User record here.
      // await fastify.prisma.user.update({ where: { id: contractorId }, data: { stripeCustomerId: account.id } });

      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboard/refresh`,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboard/return`,
        type: 'account_onboarding',
      });

      return reply.send({ url: accountLink.url });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate onboarding link' });
    }
  });

  // 2. Checkout (Atomic)
  fastify.post<{ Params: { id: string } }>('/v1/leads/:id/checkout', async (request, reply) => {
    const contractorId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    if (!contractorId || userRole !== 'contractor') {
      return reply.code(403).send({ error: 'Only contractors can purchase leads' });
    }

    const { id } = request.params;

    try {
      const result = await fastify.prisma.$transaction(async (tx) => {
        // Atomic update: only update if status is currently AVAILABLE
        const updatedLead = await tx.lead.updateMany({
          where: { id, status: 'AVAILABLE' },
          data: { status: 'PENDING_PAYMENT' } // Temporary lock
        });

        if (updatedLead.count === 0) {
          throw new Error('Lead is not available for purchase or does not exist');
        }

        const lead = await tx.lead.findUnique({ where: { id } });
        if (!lead) throw new Error('Lead not found after lock');

        let url = 'https://checkout.stripe.com/mock-checkout';
        let sessionId = 'cs_mock_123';

        if (STRIPE_API_KEY !== 'sk_test_mock' && process.env.STRIPE_API_KEY) {
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
              {
                price_data: {
                  currency: 'usd',
                  product_data: { name: `Home Assessment Lead: ${lead.id}` },
                  unit_amount: 12500, // $125.00
                },
                quantity: 1,
              },
            ],
            mode: 'payment',
            success_url: `${FRONTEND_URL}/?checkout=success&lead=${lead.id}`,
            cancel_url: `${FRONTEND_URL}/?checkout=cancel&lead=${lead.id}`,
            metadata: {
              leadId: lead.id,
              contractorId: contractorId,
            },
          });
          url = session.url || url;
          sessionId = session.id;
        }

        // Save session ID for correlation
        await tx.lead.update({
          where: { id },
          data: { stripeSession: sessionId },
        });

        return { url, sessionId };
      });

      return reply.send({ url: result.url, sessionId: result.sessionId });
    } catch (error: any) {
      if (error.message.includes('not available')) {
        return reply.code(400).send({ error: error.message });
      }
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal server error during checkout' });
    }
  });

  // 3. Stripe Webhook
  fastify.post('/v1/webhooks/stripe', async (request, reply) => {
    let event: Stripe.Event;

    // Fastify parses body by default. For real Stripe signature validation we need raw body.
    // Assuming standard raw payload is stored in request.rawBody if configured, otherwise fallback to request.body.
    const signature = request.headers['stripe-signature'];
    const payload = (request as any).rawBody || JSON.stringify(request.body);

    if (STRIPE_API_KEY === 'sk_test_mock' || !STRIPE_WEBHOOK_SECRET) {
      // Mock event validation fallback
      event = request.body as Stripe.Event;
    } else {
      try {
        if (!signature) throw new Error('No signature provided');
        event = stripe.webhooks.constructEvent(
          payload,
          signature,
          STRIPE_WEBHOOK_SECRET
        );
      } catch (err: any) {
        request.log.warn(`⚠️  Webhook signature verification failed: ${err.message}`);
        return reply.code(400).send(`Webhook Error: ${err.message}`);
      }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const leadId = session.metadata?.leadId;
      const contractorId = session.metadata?.contractorId;

      if (!leadId || !contractorId) {
        request.log.error('Webhook missing metadata');
        return reply.code(400).send('Webhook missing metadata');
      }

      const chargeId = session.payment_intent as string || `mock_charge_${Date.now()}`;
      const amountTotal = session.amount_total || 12500; // in cents
      const amountDec = amountTotal / 100;

      try {
        await fastify.prisma.$transaction(async (tx) => {
          // Update lead
          await tx.lead.update({
            where: { id: leadId },
            data: {
              status: 'SOLD',
              contractorId: contractorId,
              purchasedAt: new Date(),
            },
          });

          // Create transaction
          await tx.transaction.create({
            data: {
              leadId: leadId,
              stripeChargeId: chargeId,
              amount: amountDec,
              netAmount: amountDec, // simple 0 fee assumed here
              currency: session.currency || 'usd',
            },
          });
        });
      } catch (dbErr: any) {
        request.log.error(`Database error during webhook processing: ${dbErr.message}`);
        return reply.code(500).send('Internal Server Error');
      }
    }

    return reply.send({ received: true });
  });
}
