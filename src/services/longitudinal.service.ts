import { PrismaClient, PropertyHealthScore, ModificationLedger, AccessAudit } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export class LongitudinalService {
  /**
   * Records access to sensitive resources/PII for HIPAA/SOC2 compliance.
   */
  public static async recordAccessAudit(
    actorId: string,
    resourceId: string,
    actionType: string
  ): Promise<AccessAudit> {
    return await prisma.accessAudit.create({
      data: {
        actorId,
        resourceId,
        actionType,
        timestamp: new Date()
      }
    });
  }

  /**
   * Updates/calculates the Property Health Score, including trend analysis.
   */
  public static async updatePropertyHealthScore(propertyId: string): Promise<PropertyHealthScore | null> {
    // 1. Baseline Comparison: Fetch most recent health score
    const previousScore = await prisma.propertyHealthScore.findFirst({
      where: { propertyId },
      orderBy: { recordedAt: 'desc' }
    });

    // 2. Fetch reports & assessments for current property state
    const reports = await prisma.report.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      include: { assessment: true }
    });

    if (reports.length === 0) {
      return null;
    }

    const latestReport = reports[0];
    const latestAssessment = latestReport.assessment;

    // Default starting scores (perfect safety baseline)
    let overallScore = 100;
    let mobilityScore = 100;
    let fallRiskScore = 100;

    // Deduct based on risks in the latest assessment
    let risks: any[] = [];
    if (latestAssessment && latestAssessment.risks) {
      try {
        risks = typeof latestAssessment.risks === 'string'
          ? JSON.parse(latestAssessment.risks)
          : (latestAssessment.risks as any[]);
      } catch (e) {
        risks = [];
      }
    }

    if (Array.isArray(risks)) {
      for (const risk of risks) {
        // High severity risk: deduct 15 points overall and 20 risk points
        const severity = risk.severity || 5;
        if (severity >= 8) {
          overallScore -= 15;
          fallRiskScore -= 20;
        } else if (severity >= 5) {
          overallScore -= 10;
          fallRiskScore -= 10;
        } else {
          overallScore -= 5;
          fallRiskScore -= 5;
        }
      }
    }

    // Adjust mobility score based on assessment's user mobility level
    const mobility = (latestAssessment?.userMobilityLevel || '').toUpperCase();
    if (mobility.includes('WHEELCHAIR')) {
      mobilityScore = 50;
    } else if (mobility.includes('WALKER') || mobility.includes('CANE')) {
      mobilityScore = 75;
    } else {
      mobilityScore = 100;
    }

    // 3. Mitigation Credit: Check completed/verified modifications
    const modifications = await prisma.modificationLedger.findMany({
      where: { propertyId },
      orderBy: { completedAt: 'desc' }
    });

    // Restore 15 points per completed modification to reward accessibility improvements
    for (const mod of modifications) {
      overallScore += 15;
      fallRiskScore += 15;
    }

    // 4. Aging Decay
    // If the latest report is older than 12 months, apply confidence decay
    const ageInMs = Date.now() - new Date(latestReport.createdAt).getTime();
    const ageInMonths = ageInMs / (1000 * 60 * 60 * 24 * 30.4375);
    if (ageInMonths > 12) {
      const decayMonths = Math.floor(ageInMonths - 12);
      // Deduct 2 points per month beyond 12 months, max 20 points decay
      const decayPoints = Math.min(decayMonths * 2, 20);
      overallScore -= decayPoints;
      fallRiskScore -= decayPoints;
    }

    // Clamp scores to legal range [0, 100]
    overallScore = Math.max(0, Math.min(100, overallScore));
    mobilityScore = Math.max(0, Math.min(100, mobilityScore));
    fallRiskScore = Math.max(0, Math.min(100, fallRiskScore));

    // Calculate changeDelta
    const changeDelta = previousScore ? overallScore - previousScore.overallScore : null;

    // Create a new health score entry
    const newScore = await prisma.propertyHealthScore.create({
      data: {
        propertyId,
        overallScore,
        mobilityScore,
        fallRiskScore,
        changeDelta,
        recordedAt: new Date()
      }
    });

    return newScore;
  }

  /**
   * Generates a cryptographically signed/hashed JSON-LD Property Certificate.
   */
  public static async generateSignedCertificate(propertyId: string): Promise<any> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owner: true,
        healthScores: { orderBy: { recordedAt: 'desc' }, take: 1 },
        reports: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }

    const healthScore = property.healthScores[0];
    const latestReport = property.reports[0];

    // Build standard JSON-LD payload
    const certificatePayload = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://schema.homease.io/contexts/home-safety/v1"
      ],
      "id": `urn:uuid:${crypto.randomUUID()}`,
      "type": ["VerifiableCredential", "HomeSafetyCertificate"],
      "issuer": "did:web:homease.io",
      "issuanceDate": new Date().toISOString(),
      "credentialSubject": {
        "id": `urn:uuid:${propertyId}`,
        "address": property.address,
        "ownerEmail": property.owner.email,
        "overallSafetyScore": healthScore?.overallScore ?? 100,
        "mobilityAccessibilityScore": healthScore?.mobilityScore ?? 100,
        "fallRiskScore": healthScore?.fallRiskScore ?? 100,
        "assessmentCount": property.reports.length,
        "lastReportDate": latestReport?.createdAt.toISOString() ?? null
      }
    };

    // Sign the credential payload using HMAC SHA-256 (mock sign secret)
    const secret = process.env.JWT_SECRET || 'supersecret';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(certificatePayload));
    const signature = hmac.digest('hex');

    return {
      certificate: certificatePayload,
      proof: {
        type: "HmacSha256Verification",
        created: new Date().toISOString(),
        verificationMethod: "did:web:homease.io#key-1",
        proofPurpose: "assertionMethod",
        jws: signature
      }
    };
  }

  /**
   * Maps property safety data, risks and reports to FHIR standard resources (Bundle).
   */
  public static async getFhirObservations(
    propertyId: string,
    partnerId: string,
    consentGranted: boolean
  ): Promise<any> {
    // 1. Verify enterprise partner
    const partner = await prisma.enterprisePartner.findUnique({
      where: { id: partnerId }
    });

    if (!partner || !partner.isActive) {
      throw new Error(`Enterprise partner with ID ${partnerId} is not active or not found`);
    }

    if (!partner.consentScopes.includes('READ_REPORTS')) {
      throw new Error(`Partner does not have required READ_REPORTS scope`);
    }

    // 2. Check homeowner consent
    if (!consentGranted) {
      throw new Error(`Homeowner has not granted consent to share this record with ${partner.name}`);
    }

    // 3. Fetch Property & latest health scores / report
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        healthScores: { orderBy: { recordedAt: 'desc' }, take: 1 },
        reports: { orderBy: { createdAt: 'desc' }, take: 1, include: { assessment: true } }
      }
    });

    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }

    const latestHealthScore = property.healthScores[0];
    const latestReport = property.reports[0];

    // 4. Log the access in AccessAudit
    await this.recordAccessAudit(partnerId, propertyId, 'PARTNER_FHIR_READ');

    const fhirResources: any[] = [];

    // MAPPED: overallScore -> Observation
    if (latestHealthScore) {
      fhirResources.push({
        resourceType: "Observation",
        id: `obs-${crypto.randomUUID()}`,
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "survey",
                display: "Survey"
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "96753-9",
              display: "Residential Safety Assessment overall score"
            }
          ]
        },
        subject: {
          reference: `Patient/${property.ownerId}`
        },
        effectiveDateTime: latestHealthScore.recordedAt.toISOString(),
        valueQuantity: {
          value: latestHealthScore.overallScore,
          unit: "Score",
          system: "http://unitsofmeasure.org",
          code: "1"
        }
      });
    }

    // MAPPED: risks -> Conditions
    let risks: any[] = [];
    if (latestReport?.assessment?.risks) {
      try {
        risks = typeof latestReport.assessment.risks === 'string'
          ? JSON.parse(latestReport.assessment.risks)
          : (latestReport.assessment.risks as any[]);
      } catch (e) {
        risks = [];
      }
    }

    if (Array.isArray(risks)) {
      for (const risk of risks) {
        fhirResources.push({
          resourceType: "Condition",
          id: `cond-${crypto.randomUUID()}`,
          clinicalStatus: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
                code: "active"
              }
            ]
          },
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/condition-category",
                  code: "finding",
                  display: "Finding"
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: "http://hl7.org/fhir/sid/icd-10",
                code: risk.icd10 || "R29.6",
                display: risk.name || risk.risk || "Fall Risk"
              }
            ]
          },
          subject: {
            reference: `Patient/${property.ownerId}`
          }
        });
      }
    }

    // MAPPED: pdfUrl -> DocumentReference
    if (latestReport?.pdfUrl) {
      fhirResources.push({
        resourceType: "DocumentReference",
        id: `doc-${crypto.randomUUID()}`,
        status: "current",
        type: {
          coding: [
            {
              system: "http://loinc.org",
              code: "57133-1",
              display: "Home safety Assessment"
            }
          ]
        },
        subject: {
          reference: `Patient/${property.ownerId}`
        },
        content: [
          {
            attachment: {
              contentType: "application/pdf",
              url: latestReport.pdfUrl
            }
          }
        ]
      });
    }

    // Return FHIR Bundle
    return {
      resourceType: "Bundle",
      type: "searchset",
      total: fhirResources.length,
      entry: fhirResources.map(res => ({
        fullUrl: `urn:uuid:${res.id}`,
        resource: res
      }))
    };
  }
}
