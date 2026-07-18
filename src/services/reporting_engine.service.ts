import { PrismaClient, Assessment, Report, Lead, PriorityLevel } from '@prisma/client';

const prisma = new PrismaClient();

export class ReportingEngineService {
  public async processAssessment(assessmentId: string): Promise<{ report: Report; lead: Lead }> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { capture: true }
    });

    if (!assessment) {
      throw new Error(`Assessment with ID ${assessmentId} not found`);
    }

    // Default or dynamically determined values
    // Assume `assessment` has a `risks` JSON array or similar. We'll parse it.
    let risks: any[] = [];
    try {
      if (assessment.risks) {
        risks = typeof assessment.risks === 'string' ? JSON.parse(assessment.risks) : assessment.risks;
      }
    } catch (e) {
      risks = [];
    }

    let S = 5; // Default AI Severity
    if (risks.length > 0 && risks[0].severity) {
      const sev = String(risks[0].severity).toUpperCase();
      if (sev === 'HIGH') {
        S = 9;
      } else if (sev === 'MEDIUM') {
        S = 6;
      } else if (sev === 'LOW') {
        S = 3;
      } else {
        const parsedSev = Number(risks[0].severity);
        if (!isNaN(parsedSev)) {
          S = parsedSev;
        }
      }
    }

    // Room type impact weight (R)
    let R = 1.0;
    const roomType = (assessment.roomType || '').toUpperCase();
    if (roomType === 'BATHROOM') R = 1.5;
    else if (roomType === 'KITCHEN') R = 1.4;
    else if (roomType === 'ENTRANCE' || roomType === 'ENTRYWAY') R = 1.3;
    else if (roomType === 'LIVING_AREA' || roomType === 'LIVING_ROOM') R = 1.2;

    // User mobility level multiplier (M)
    let M = 1.5; // Default missing
    const mobility = (assessment.userMobilityLevel || '').toUpperCase();
    if (mobility.includes('WHEELCHAIR')) M = 2.0;
    else if (mobility.includes('WALKER') || mobility.includes('CANE')) M = 1.5;
    else if (mobility.includes('NO') || mobility.includes('NONE')) M = 1.0;

    // Calculate Priority Score
    const priorityScore = (S * 0.6 + R * 0.4) * M;

    // Categorize priority level
    let priorityLevel: PriorityLevel = PriorityLevel.LOW;
    if (priorityScore > 12.0) {
      priorityLevel = PriorityLevel.HIGH;
    } else if (priorityScore > 8.0) {
      priorityLevel = PriorityLevel.MEDIUM;
    }

    // Cost of Inaction (ROI)
    const baseInactionCost = 50000;
    let riskReductionFactor = 0.20; // Default LOW
    if (priorityLevel === PriorityLevel.HIGH) riskReductionFactor = 0.80;
    else if (priorityLevel === PriorityLevel.MEDIUM) riskReductionFactor = 0.50;

    const avoidedCost = baseInactionCost * riskReductionFactor;

    // Bill of Quantities (BoQ) mapping
    const recommendations: string[] = [];
    try {
      if (assessment.recommendations) {
        const parsed = typeof assessment.recommendations === 'string' ? JSON.parse(assessment.recommendations) : assessment.recommendations;
        if (Array.isArray(parsed)) recommendations.push(...parsed);
      }
    } catch (e) {
      // Ignored
    }

    let materialCost = 0;
    let materialCount = 0;
    const boqItems = [];

    if (recommendations.length === 0) {
      // default fallback
      boqItems.push({ name: 'Safety Hardware Pack', price: 150, qty: 1 });
    } else {
      for (const rec of recommendations) {
        const recLower = rec.toLowerCase();
        if (recLower.includes('toilet') || recLower.includes('raise height')) {
          boqItems.push({ name: 'Comfort-Height Toilet', price: 350, qty: 1 });
          boqItems.push({ name: 'Wax Ring & Bolts', price: 25, qty: 1 });
        } else if (recLower.includes('grab') || recLower.includes('bar')) {
          boqItems.push({ name: '24" Stainless Grab Bar', price: 120, qty: 2 });
          boqItems.push({ name: 'WingIt Anchors', price: 30, qty: 1 });
          boqItems.push({ name: 'Silicone Sealant', price: 15, qty: 1 });
        } else if (recLower.includes('widen') || recLower.includes('door')) {
          boqItems.push({ name: '36" Pre-hung Door', price: 450, qty: 1 });
          boqItems.push({ name: 'Shims & Trim Casing', price: 80, qty: 1 });
          boqItems.push({ name: 'Low-profile Threshold', price: 40, qty: 1 });
        } else {
          boqItems.push({ name: 'Safety Hardware Pack', price: 150, qty: 1 });
        }
      }
    }

    for (const item of boqItems) {
      materialCost += item.price * item.qty;
      materialCount += item.qty;
    }

    const laborCost = materialCount * 100; // arbitrary labor calc
    const projectCost = materialCost + laborCost;

    // ROI
    const roiValue = projectCost > 0 ? ((avoidedCost - projectCost) / projectCost) * 100 : 0;
    const isHighValueLead = priorityLevel === 'HIGH' && roiValue > 50;

    const propertyId = assessment.capture?.propertyId || 'temp-property-id';

    // Create Report
    const report = await prisma.report.create({
      data: {
        assessmentId: assessment.id,
        propertyId: propertyId,
        priority: priorityLevel,
        priorityScore,
        roiValue,
        materialCount,
        isHighValueLead,
        estimatedValue: projectCost,
        boqData: JSON.stringify(boqItems),
      },
    });

    // Create Lead
    const lead = await prisma.lead.create({
      data: {
        reportId: report.id,
        price: 125.00,
        status: 'AVAILABLE',
      },
    });

    return { report, lead };
  }
}
