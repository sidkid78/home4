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
  await app.register(devRoutes);

  return app;
}