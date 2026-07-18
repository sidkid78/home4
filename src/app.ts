import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

import prismaPlugin from './plugins/prisma';
import queuesPlugin from './plugins/queues';
import authPlugin from './plugins/auth';
import meRoutes from './routes/me';
import captureRoutes from './routes/capture';
import reportRoutes from './routes/report';
import leadRoutes from './routes/lead';
import enterpriseRoutes from './routes/enterprise';
import uploadRoutes from './routes/uploads';
import devRoutes from './routes/dev';

export async function buildApp(): Promise<FastifyInstance> {
  // 15MB body limit: capture uploads arrive as base64-encoded image frames.
  const app = Fastify({ logger: true, bodyLimit: 15 * 1024 * 1024 });

  // Preserve the raw JSON body on request.rawBody so the Stripe webhook can
  // verify signatures against the exact bytes Stripe sent (re-stringifying the
  // parsed object changes the bytes and breaks verification).
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      (_req as any).rawBody = body;
      if (!body || (body as Buffer).length === 0) return done(null, undefined);
      try {
        done(null, JSON.parse((body as Buffer).toString('utf8')));
      } catch (err: any) {
        err.statusCode = 400;
        done(err, undefined);
      }
    }
  );

  await app.register(cors);
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'supersecret' });

  await app.register(prismaPlugin);
  await app.register(queuesPlugin);
  await app.register(authPlugin); // verifies Bearer token -> trusted x-user-id/role

  await app.register(meRoutes);
  await app.register(captureRoutes);
  await app.register(reportRoutes);
  await app.register(leadRoutes);
  await app.register(enterpriseRoutes);
  await app.register(uploadRoutes);

  // Dev-only bootstrap/settlement helpers (demo-property, purchase-lead) let
  // anyone seed data and settle purchases, so they must never be open in a
  // real deployment. Enabled outside production, or explicitly via
  // ENABLE_DEV_ROUTES=true (needed to run the public demo).
  const devRoutesEnabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === 'true';
  if (devRoutesEnabled) {
    await app.register(devRoutes);
    app.log.warn('Dev routes enabled (/v1/dev/*) — do not use in a real production environment');
  }

  return app;
}