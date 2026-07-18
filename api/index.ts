import type { IncomingMessage, ServerResponse } from 'http';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

// Build the Fastify app once per warm serverless instance.
let appReady: Promise<FastifyInstance> | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!appReady) {
    appReady = (async () => {
      const app = await buildApp();
      await app.ready();
      return app;
    })();
  }
  return appReady;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();

  // The `/v1/*` rewrite may deliver the path with or without an `/api` prefix
  // depending on how Vercel forwards it — normalise so Fastify's `/v1/...`
  // routes always match.
  if (req.url) {
    if (req.url === '/api' || req.url === '/api/') req.url = '/';
    else if (req.url.startsWith('/api/')) req.url = req.url.slice(4);
  }

  app.server.emit('request', req, res);
}
