import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>('/v1/reports/:id', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    if (!userId || !userRole) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;
    
    const report = await fastify.prisma.report.findUnique({
      where: { id },
      include: { assessment: true }
    });

    if (!report) {
      return reply.code(404).send({ error: 'Report not found' });
    }

    let hasAccess = false;

    if (userRole === 'admin') {
      hasAccess = true;
    } else if (userRole === 'homeowner') {
      const property = await fastify.prisma.property.findUnique({
        where: { id: report.propertyId }
      });
      if (property && property.ownerId === userId) {
        hasAccess = true;
      }
    } else if (userRole === 'contractor') {
      const lead = await fastify.prisma.lead.findFirst({
        where: { reportId: report.id, contractorId: userId, status: 'SOLD' }
      });
      if (lead) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return {
      id: report.id,
      priority: report.priority,
      estimatedValue: report.estimatedValue,
      roiValue: report.roiValue,
      pdfUrl: report.pdfUrl,
      assessment: report.assessment ? {
        risks: report.assessment.risks,
        measurements: report.assessment.measurements,
        confidenceScore: report.assessment.confidenceScore,
        humanValidated: report.assessment.humanValidated
      } : null
    };
  });
}