import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { CaptureCreateSchema, CaptureCreate } from '../schemas/capture.schema';

export default async function captureRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CaptureCreate }>('/v1/captures', {
    schema: {
      body: CaptureCreateSchema,
      response: {
        201: Type.Object({
          id: Type.String(),
          status: Type.String(),
        })
      }
    }
  }, async (request, reply) => {
    const { propertyId, roomType, mediaUrls } = request.body;

    const capture = await fastify.prisma.capture.create({
      data: {
        propertyId,
        roomType,
        mediaUrls,
        status: 'PENDING'
      }
    });

    await fastify.queues.assessmentQueue.add('analyze-capture', {
      captureId: capture.id
    });

    return reply.code(201).send({ id: capture.id, status: capture.status });
  });
}