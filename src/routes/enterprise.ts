import { FastifyInstance } from 'fastify';
import { LongitudinalService } from '../services/longitudinal.service';
import * as crypto from 'crypto';

export default async function enterpriseRoutes(fastify: FastifyInstance) {
  // 1. Register an Enterprise Partner
  fastify.post('/v1/enterprise/partners', async (request, reply) => {
    const { name, type, consentScopes } = request.body as {
      name: string;
      type: 'HEALTHCARE' | 'INSURANCE' | 'GOVERNMENT';
      consentScopes: string[];
    };

    if (!name || !type || !consentScopes) {
      return reply.code(400).send({ error: 'Missing name, type, or consentScopes' });
    }

    // Generate random API key and store its SHA-256 hash
    const apiKey = `he_partner_${crypto.randomBytes(16).toString('hex')}`;
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const partner = await fastify.prisma.enterprisePartner.create({
      data: {
        name,
        type,
        apiKeyHash,
        consentScopes,
        isActive: true
      }
    });

    return reply.code(201).send({
      id: partner.id,
      name: partner.name,
      type: partner.type,
      consentScopes: partner.consentScopes,
      apiKey // Return plain key once for onboarding client setup
    });
  });

  // 2. GET FHIR observations (FHIR Mapping Digital Handoff API)
  fastify.get<{ Params: { id: string } }>('/v1/enterprise/property/:id/fhir-observations', async (request, reply) => {
    const { id } = request.params;
    
    // Extract headers
    const partnerId = request.headers['x-partner-id'] as string;
    const consentHeader = request.headers['x-homeowner-consent'] as string;
    const consentGranted = consentHeader === 'true';

    if (!partnerId) {
      return reply.code(401).send({ error: 'Unauthorized: Missing x-partner-id header' });
    }

    try {
      const fhirBundle = await LongitudinalService.getFhirObservations(id, partnerId, consentGranted);
      return fhirBundle;
    } catch (err: any) {
      request.log.error(err);
      if (err.message.includes('not active') || err.message.includes('consent')) {
        return reply.code(403).send({ error: err.message });
      }
      if (err.message.includes('not found')) {
        return reply.code(404).send({ error: err.message });
      }
      return reply.code(500).send({ error: err.message });
    }
  });

  // 3. GET property health-score (recalculates on demand)
  fastify.get<{ Params: { id: string } }>('/v1/properties/:id/health-score', async (request, reply) => {
    const { id } = request.params;
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    if (!userId || !userRole) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Authorization checks
    let hasAccess = false;
    if (userRole === 'admin') {
      hasAccess = true;
    } else if (userRole === 'homeowner') {
      const property = await fastify.prisma.property.findUnique({
        where: { id }
      });
      if (property && property.ownerId === userId) {
        hasAccess = true;
      }
    } else if (userRole === 'contractor') {
      // Access if they purchased any lead for a report associated with this property
      const lead = await fastify.prisma.lead.findFirst({
        where: {
          contractorId: userId,
          status: 'SOLD',
          report: {
            propertyId: id
          }
        }
      });
      if (lead) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      // Recalculate score before sending back
      const score = await LongitudinalService.updatePropertyHealthScore(id);
      if (!score) {
        return reply.code(404).send({ error: 'No reports or health history available for this property' });
      }

      // Log access audit
      await LongitudinalService.recordAccessAudit(userId, id, 'READ_HEALTH_SCORE');

      return score;
    } catch (err: any) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to retrieve property health score' });
    }
  });

  // 4. POST modification ledger entry (completed by contractor/admin)
  fastify.post<{ Params: { id: string } }>('/v1/properties/:id/modifications', async (request, reply) => {
    const { id } = request.params;
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    const { actionTaken, verificationMedia, leadId } = request.body as {
      actionTaken: string;
      verificationMedia: string[];
      leadId?: string;
    };

    if (!userId || !userRole) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (!actionTaken || !verificationMedia) {
      return reply.code(400).send({ error: 'Missing actionTaken or verificationMedia' });
    }

    // Verify user can record modifications (admin, or contractor who bought the lead)
    let canRecord = false;
    if (userRole === 'admin') {
      canRecord = true;
    } else if (userRole === 'contractor') {
      const lead = await fastify.prisma.lead.findFirst({
        where: {
          id: leadId,
          contractorId: userId,
          status: 'SOLD',
          report: {
            propertyId: id
          }
        }
      });
      if (lead) {
        canRecord = true;
      }
    }

    if (!canRecord) {
      return reply.code(403).send({ error: 'Forbidden: Only authorized contractors or admins can record modifications' });
    }

    try {
      // Create modification ledger entry
      const ledgerEntry = await fastify.prisma.modificationLedger.create({
        data: {
          propertyId: id,
          leadId: leadId || null,
          actionTaken,
          verificationMedia,
          verifiedBy: userId,
          completedAt: new Date()
        }
      });

      // Recalculate the safety score with mitigation credit automatically!
      const updatedScore = await LongitudinalService.updatePropertyHealthScore(id);

      // Log the action audit
      await LongitudinalService.recordAccessAudit(userId, ledgerEntry.id, 'CREATE_MODIFICATION_LEDGER');

      return {
        ledgerEntry,
        updatedScore
      };
    } catch (err: any) {
      request.log.error(err);
      return reply.code(500).send({ error: err.message || 'Failed to record modification' });
    }
  });

  // 5. GET property Signed Certificate (JSON-LD)
  fastify.get<{ Params: { id: string } }>('/v1/properties/:id/certificate', async (request, reply) => {
    const { id } = request.params;
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    if (!userId || !userRole) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Only homeowner or admin can download/view Signed Property Certificate
    let hasAccess = false;
    if (userRole === 'admin') {
      hasAccess = true;
    } else if (userRole === 'homeowner') {
      const property = await fastify.prisma.property.findUnique({
        where: { id }
      });
      if (property && property.ownerId === userId) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const signedCert = await LongitudinalService.generateSignedCertificate(id);
      
      // Log access audit
      await LongitudinalService.recordAccessAudit(userId, id, 'GENERATE_SIGNED_CERTIFICATE');

      return signedCert;
    } catch (err: any) {
      request.log.error(err);
      return reply.code(500).send({ error: err.message || 'Failed to generate signed certificate' });
    }
  });
}
