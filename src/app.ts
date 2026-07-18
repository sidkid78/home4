import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

import prismaPlugin from './plugins/prisma';
import queuesPlugin from './plugins/queues';
import captureRoutes from './routes/capture';
import reportRoutes from './routes/report';
import leadRoutes from './routes/lead';
import enterpriseRoutes from './routes/enterprise';
import devRoutes from './routes/dev';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors);
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'supersecret' });

  await app.register(prismaPlugin);
  await app.register(queuesPlugin);

  await app.register(captureRoutes);
  await app.register(reportRoutes);
  await app.register(leadRoutes);
  await app.register(enterpriseRoutes);

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