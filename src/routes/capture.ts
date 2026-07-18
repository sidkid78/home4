import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { Type } from '@sinclair/typebox';
import { CaptureCreateSchema, CaptureCreate } from '../schemas/capture.schema';
import { AIEngineService } from '../services/ai_engine.service';
import { ReportingEngineService } from '../services/reporting_engine.service';
import { LongitudinalService } from '../services/longitudinal.service';

const aiEngine = new AIEngineService();
const reportingEngine = new ReportingEngineService();

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

  // Run the full intelligence pipeline for a capture:
  //   capture -> Gemini assessment -> Assessment record -> Report + Lead.
  // Returns everything the assessment report screen renders.
  fastify.post<{ Params: { id: string } }>('/v1/captures/:id/process', async (request, reply) => {
    const { id } = request.params;

    const capture = await fastify.prisma.capture.findUnique({ where: { id } });
    if (!capture) {
      return reply.code(404).send({ error: 'Capture not found' });
    }

    // 1. AI assessment (falls back to deterministic mock without GEMINI_API_KEY).
    const ai = await aiEngine.assessSpace(capture.mediaUrls);

    // 2. Persist the assessment.
    const assessment = await fastify.prisma.assessment.create({
      data: {
        captureId: capture.id,
        roomType: capture.roomType,
        risks: ai.data.risks as unknown as Prisma.InputJsonValue,
        measurements: ai.data.measurements as unknown as Prisma.InputJsonValue,
        recommendations: ai.data.risks.map((r) => r.recommendation),
        confidenceScore: ai.data.overall_confidence_score,
        humanValidated: ai.status === 'COMPLETED',
      },
    });

    await fastify.prisma.capture.update({
      where: { id: capture.id },
      data: { status: 'PROCESSED' },
    });

    // 3. Prioritization + ROI + BoQ -> Report + Lead.
    const { report, lead } = await reportingEngine.processAssessment(assessment.id);

    // 4. Record a baseline health score for the Lifetime Home Record.
    const baseline = await LongitudinalService.updatePropertyHealthScore(capture.propertyId);

    let boq: Array<{ name: string; price: number; qty: number }> = [];
    try {
      boq = report.boqData ? JSON.parse(report.boqData) : [];
    } catch {
      boq = [];
    }

    return reply.send({
      captureId: capture.id,
      hitlStatus: ai.status,
      health: baseline
        ? {
            overallScore: baseline.overallScore,
            mobilityScore: baseline.mobilityScore,
            fallRiskScore: baseline.fallRiskScore,
            changeDelta: baseline.changeDelta,
          }
        : null,
      report: {
        id: report.id,
        priority: report.priority,
        priorityScore: Number(report.priorityScore),
        estimatedValue: Number(report.estimatedValue),
        roiValue: Number(report.roiValue),
        materialCount: report.materialCount,
        isHighValueLead: report.isHighValueLead,
      },
      lead: {
        id: lead.id,
        price: Number(lead.price),
        status: lead.status,
      },
      assessment: {
        roomSummary: ai.data.room_summary,
        confidenceScore: ai.data.overall_confidence_score,
        humanValidated: assessment.humanValidated,
        risks: ai.data.risks,
        measurements: ai.data.measurements,
      },
      boq,
    });
  });
}
