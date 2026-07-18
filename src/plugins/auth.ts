import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { supabaseAdmin } from '../lib/supabaseAdmin';

/**
 * Verifies the Supabase access token (Authorization: Bearer <jwt>) on every
 * request. On success it upserts the app User (id = Supabase auth uid) and sets
 * the trusted `x-user-id` / `x-user-role` headers the routes already read.
 *
 * Client-supplied identity headers are always stripped first, so a caller can
 * never spoof identity — these values only ever come from a verified token.
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request) => {
    delete request.headers['x-user-id'];
    delete request.headers['x-user-role'];

    const header = request.headers['authorization'];
    if (!header || !header.startsWith('Bearer ') || !supabaseAdmin) return;

    const token = header.slice(7);
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return;

    const user = await fastify.prisma.user.upsert({
      where: { id: data.user.id },
      update: {},
      create: {
        id: data.user.id,
        email: data.user.email || `${data.user.id}@user.local`,
        role: 'HOMEOWNER',
      },
    });

    request.headers['x-user-id'] = user.id;
    request.headers['x-user-role'] = user.role.toLowerCase();
  });
};

export default fp(authPlugin);
