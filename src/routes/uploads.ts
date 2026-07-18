import { FastifyInstance } from 'fastify';
import { supabaseAdmin, CAPTURES_BUCKET } from '../lib/supabaseAdmin';

interface UploadBody {
  propertyId: string;
  roomType: string;
  images: Array<{ id: string; dataBase64: string }>;
}

/**
 * Server-side image upload. The browser sends captured frames (base64); the
 * backend writes them to Supabase Storage with the service_role key (bypasses
 * Storage RLS) and returns public URLs the AI engine can fetch.
 */
export default async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: UploadBody }>('/v1/uploads', async (request, reply) => {
    const { propertyId, roomType, images } = request.body ?? ({} as UploadBody);

    const admin = supabaseAdmin;
    if (!admin) {
      return reply.code(503).send({ error: 'Storage not configured (SUPABASE_SERVICE_ROLE_KEY missing)' });
    }
    if (!propertyId || !roomType || !Array.isArray(images) || images.length === 0) {
      return reply.code(400).send({ error: 'propertyId, roomType and images[] are required' });
    }

    try {
      const urls = await Promise.all(
        images.map(async (img) => {
          const bytes = Buffer.from(img.dataBase64, 'base64');
          const path = `${propertyId}/${roomType}/${img.id}.jpg`;
          const { error } = await admin.storage
            .from(CAPTURES_BUCKET)
            .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
          if (error) throw new Error(error.message);
          const { data } = admin.storage.from(CAPTURES_BUCKET).getPublicUrl(path);
          return data.publicUrl;
        })
      );
      return reply.send({ urls });
    } catch (err: any) {
      request.log.error(err);
      return reply.code(500).send({ error: `Upload failed: ${err.message}` });
    }
  });
}
