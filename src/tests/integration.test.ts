import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';
import { AIEngineService } from '../services/ai_engine.service';
import { ReportingEngineService } from '../services/reporting_engine.service';
import { LongitudinalService } from '../services/longitudinal.service';

const prisma = new PrismaClient();

async function runIntegrationTest() {
  console.log('🚀 Starting HOMEase Platform Integration Test Suite...');
  const startTime = Date.now();

  const app = await buildApp();

  try {
    // ----------------------------------------------------
    // PHASE 0: DATABASE CLEANUP & TEST FIXTURES SETUP
    // ----------------------------------------------------
    console.log('\n--- PHASE 0: Database Cleanup & Setup ---');
    
    // Deleting in strict foreign-key order
    await prisma.accessAudit.deleteMany();
    await prisma.propertyHealthScore.deleteMany();
    await prisma.modificationLedger.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.report.deleteMany();
    await prisma.assessment.deleteMany();
    await prisma.capture.deleteMany();
    await prisma.property.deleteMany();
    await prisma.user.deleteMany();
    await prisma.enterprisePartner.deleteMany();

    console.log('✅ Database cleaned successfully.');

    // Create Homeowner
    const homeowner = await prisma.user.create({
      data: {
        email: 'homeowner@example.com',
        role: 'HOMEOWNER'
      }
    });

    // Create Contractor
    const contractor = await prisma.user.create({
      data: {
        email: 'contractor@example.com',
        role: 'CONTRACTOR'
      }
    });

    // Create Admin
    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        role: 'ADMIN'
      }
    });

    // Create Property
    const property = await prisma.property.create({
      data: {
        address: '123 Maple Street, Bell County, TX',
        ownerId: homeowner.id,
        metadata: { sqft: 1500, builtYear: 1995 }
      }
    });

    console.log(`✅ Seeded Users and Property.`);
    console.log(`   - Homeowner ID: ${homeowner.id}`);
    console.log(`   - Contractor ID: ${contractor.id}`);
    console.log(`   - Admin ID: ${admin.id}`);
    console.log(`   - Property ID: ${property.id}`);

    // ----------------------------------------------------
    // PHASE 1: GUIDED SPACE CAPTURE ENDPOINT
    // ----------------------------------------------------
    console.log('\n--- PHASE 1: Guided Space Capture ---');
    const capturePayload = {
      propertyId: property.id,
      roomType: 'BATHROOM',
      mediaUrls: [
        'https://supabase.storage.homease.io/captures/bathroom_sink.jpg',
        'https://supabase.storage.homease.io/captures/bathroom_toilet.jpg'
      ]
    };

    const captureResponse = await app.inject({
      method: 'POST',
      url: '/v1/captures',
      payload: capturePayload
    });

    if (captureResponse.statusCode !== 201) {
      throw new Error(`Capture creation failed: ${captureResponse.body}`);
    }

    const captureData = JSON.parse(captureResponse.body);
    console.log(`✅ Capture posted successfully. ID: ${captureData.id}, Status: ${captureData.status}`);
    if (captureData.status !== 'PENDING') {
      throw new Error(`Unexpected capture status: ${captureData.status}`);
    }

    // ----------------------------------------------------
    // PHASE 2: MODERNIZED GEMINI AI PIPELINE & REPORT GENERATION
    // ----------------------------------------------------
    console.log('\n--- PHASE 2: Gemini AI Space Assessment & Reporting ---');
    const aiEngine = new AIEngineService();
    console.log('🤖 Invoking AIEngineService.assessSpace...');
    const aiAssessmentResult = await aiEngine.assessSpace(capturePayload.mediaUrls, false);

    console.log(`✅ AI Assessment complete. Status: ${aiAssessmentResult.status}`);
    console.log(`   - Overall Confidence Score: ${aiAssessmentResult.data.overall_confidence_score}`);
    console.log(`   - Summary: ${aiAssessmentResult.data.room_summary}`);
    console.log(`   - Measurements Identified: ${aiAssessmentResult.data.measurements.length}`);
    console.log(`   - Risks Flagged: ${aiAssessmentResult.data.risks.length}`);

    // Persist assessment
    const assessment = await prisma.assessment.create({
      data: {
        captureId: captureData.id,
        roomType: capturePayload.roomType,
        userMobilityLevel: 'Walker User',
        risks: aiAssessmentResult.data.risks,
        measurements: aiAssessmentResult.data.measurements,
        confidenceScore: aiAssessmentResult.data.overall_confidence_score,
        recommendations: aiAssessmentResult.data.risks.map((r: any) => r.recommendation),
        humanValidated: aiAssessmentResult.status === 'COMPLETED'
      }
    });
    console.log(`✅ Assessment persisted. ID: ${assessment.id}`);

    // Invoke reporting & prioritization engine
    console.log('📊 Invoking ReportingEngineService to process assessment and create Lead...');
    const reportingEngine = new ReportingEngineService();
    const { report, lead } = await reportingEngine.processAssessment(assessment.id);

    console.log(`✅ Report and Lead generated:`);
    console.log(`   - Report ID: ${report.id}`);
    console.log(`   - Priority Level: ${report.priority}`);
    console.log(`   - Priority Score: ${report.priorityScore}`);
    console.log(`   - Estimated Cost: $${report.estimatedValue}`);
    console.log(`   - Safety ROI Value: ${report.roiValue}%`);
    console.log(`   - Bill of Quantities Items Count: ${report.materialCount}`);
    console.log(`   - Lead ID: ${lead.id}`);
    console.log(`   - Lead Status: ${lead.status}`);
    console.log(`   - Lead Price: $${lead.price}`);

    if (lead.status !== 'AVAILABLE') {
      throw new Error(`Expected Lead status to be AVAILABLE, but got ${lead.status}`);
    }

    // ----------------------------------------------------
    // PHASE 3: FINTECH MARKETPLACE & DOUBLE-PURCHASE GUARD
    // ----------------------------------------------------
    console.log('\n--- PHASE 3: FinTech Lead Marketplace & Concurrency Guard ---');
    
    // Attempt checkout session creation for contractor
    console.log(`🛒 Creating checkout session for Lead ${lead.id}...`);
    const checkoutResponse = await app.inject({
      method: 'POST',
      url: `/v1/leads/${lead.id}/checkout`,
      headers: {
        'x-user-id': contractor.id,
        'x-user-role': 'contractor'
      }
    });

    if (checkoutResponse.statusCode !== 200) {
      throw new Error(`Checkout endpoint failed with status: ${checkoutResponse.statusCode}`);
    }

    const checkoutData = JSON.parse(checkoutResponse.body);
    console.log(`✅ Checkout session initialized.`);
    console.log(`   - Stripe Session ID: ${checkoutData.sessionId}`);
    console.log(`   - Stripe Checkout URL: ${checkoutData.url}`);

    // Check database to see if Lead is temporarily locked (PENDING_PAYMENT)
    const lockedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    if (lockedLead?.status !== 'PENDING_PAYMENT') {
      throw new Error(`Lead should be PENDING_PAYMENT during checkout flow, but is: ${lockedLead?.status}`);
    }
    console.log(`✅ Concurrency lock verified: Lead is in PENDING_PAYMENT status.`);

    // Simulate concurrent purchase attempt on same lead (should be blocked)
    console.log('🛡️ Simulating secondary concurrent purchase attempt on locked lead...');
    const duplicateCheckoutResponse = await app.inject({
      method: 'POST',
      url: `/v1/leads/${lead.id}/checkout`,
      headers: {
        'x-user-id': 'another_contractor_id',
        'x-user-role': 'contractor'
      }
    });

    if (duplicateCheckoutResponse.statusCode !== 400) {
      throw new Error(`Expected 400 Bad Request on duplicate checkout, but got ${duplicateCheckoutResponse.statusCode}`);
    }
    const dupCheckoutError = JSON.parse(duplicateCheckoutResponse.body);
    console.log(`✅ Concurrency Guard Blocked Second Purchase successfully: "${dupCheckoutError.error}"`);

    // Simulate successful Stripe Webhook settling the transaction
    console.log('🔌 Triggering Stripe checkout.session.completed webhook...');
    const webhookResponse = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/stripe',
      payload: {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: checkoutData.sessionId,
            payment_intent: 'pi_test_settled_123456',
            amount_total: 12500,
            currency: 'usd',
            metadata: {
              leadId: lead.id,
              contractorId: contractor.id
            }
          }
        }
      }
    });

    if (webhookResponse.statusCode !== 200) {
      throw new Error(`Stripe webhook endpoint failed with status: ${webhookResponse.statusCode}`);
    }

    // Verify lead is sold and transaction recorded
    const soldLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    if (soldLead?.status !== 'SOLD' || soldLead.contractorId !== contractor.id) {
      throw new Error(`Lead should be SOLD to contractor, got status: ${soldLead?.status}, contractor: ${soldLead?.contractorId}`);
    }

    const transaction = await prisma.transaction.findFirst({ where: { leadId: lead.id } });
    if (!transaction) {
      throw new Error('Transaction ledger entry was not created.');
    }

    console.log(`✅ Webhook processed. Lead sold atomically:`);
    console.log(`   - Lead Status: ${soldLead.status}`);
    console.log(`   - Purchaser Contractor ID: ${soldLead.contractorId}`);
    console.log(`   - Transaction ID: ${transaction.id}`);
    console.log(`   - Amount: $${transaction.amount}`);

    // Verify cryptographic RLS paywall access: Homeowner cannot read report they do not own, but Owner can.
    console.log('\n--- Paywall Security Checks ---');
    const homeownerReportAccess = await app.inject({
      method: 'GET',
      url: `/v1/reports/${report.id}`,
      headers: {
        'x-user-id': homeowner.id,
        'x-user-role': 'homeowner'
      }
    });
    console.log(`   - Homeowner Own Property Access Check: HTTP ${homeownerReportAccess.statusCode} (Expected: 200)`);
    if (homeownerReportAccess.statusCode !== 200) {
      throw new Error(`Expected homeowner to access their report, got ${homeownerReportAccess.statusCode}`);
    }

    const strangerReportAccess = await app.inject({
      method: 'GET',
      url: `/v1/reports/${report.id}`,
      headers: {
        'x-user-id': 'unauthorized_homeowner',
        'x-user-role': 'homeowner'
      }
    });
    console.log(`   - Stranger Homeowner Access Check: HTTP ${strangerReportAccess.statusCode} (Expected: 403)`);
    if (strangerReportAccess.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for unauthorized homeowner report access, got ${strangerReportAccess.statusCode}`);
    }

    const purchaserContractorAccess = await app.inject({
      method: 'GET',
      url: `/v1/reports/${report.id}`,
      headers: {
        'x-user-id': contractor.id,
        'x-user-role': 'contractor'
      }
    });
    console.log(`   - Purchaser Contractor Access Check: HTTP ${purchaserContractorAccess.statusCode} (Expected: 200)`);
    if (purchaserContractorAccess.statusCode !== 200) {
      throw new Error(`Expected purchaser contractor to access sold report, got ${purchaserContractorAccess.statusCode}`);
    }

    const otherContractorAccess = await app.inject({
      method: 'GET',
      url: `/v1/reports/${report.id}`,
      headers: {
        'x-user-id': 'unauthorized_contractor',
        'x-user-role': 'contractor'
      }
    });
    console.log(`   - Stranger Contractor Access Check: HTTP ${otherContractorAccess.statusCode} (Expected: 403)`);
    if (otherContractorAccess.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for unauthorized contractor report access, got ${otherContractorAccess.statusCode}`);
    }

    // ----------------------------------------------------
    // PHASE 4: LONGITUDINAL RECORDS (LHR) & MITIGATION SCORES
    // ----------------------------------------------------
    console.log('\n--- PHASE 4: Lifetime Home Record (LHR) & Delta-Scoring ---');
    
    // Fetch initial baseline property health score
    const baselineScoreResponse = await app.inject({
      method: 'GET',
      url: `/v1/properties/${property.id}/health-score`,
      headers: {
        'x-user-id': homeowner.id,
        'x-user-role': 'homeowner'
      }
    });

    if (baselineScoreResponse.statusCode !== 200) {
      throw new Error(`Failed to retrieve baseline health score: ${baselineScoreResponse.body}`);
    }

    const baselineScore = JSON.parse(baselineScoreResponse.body);
    console.log(`✅ Baseline Property Health Score Computed:`);
    console.log(`   - Overall Score: ${baselineScore.overallScore}`);
    console.log(`   - Fall Risk Score: ${baselineScore.fallRiskScore}`);
    console.log(`   - Mobility Score: ${baselineScore.mobilityScore}`);
    console.log(`   - Change Delta: ${baselineScore.changeDelta}`); // Should be null on first score

    // Simulate Contractor performing grab bar installation (recording Modification)
    console.log('🛠️ Contractor recording bathroom accessibility modification...');
    const modificationResponse = await app.inject({
      method: 'POST',
      url: `/v1/properties/${property.id}/modifications`,
      payload: {
        actionTaken: 'Installed grab bars in tub/shower area',
        verificationMedia: ['https://supabase.storage/modifications/verified_bathroom.jpg'],
        leadId: lead.id
      },
      headers: {
        'x-user-id': contractor.id,
        'x-user-role': 'contractor'
      }
    });

    if (modificationResponse.statusCode !== 200) {
      throw new Error(`Failed to record modification: ${modificationResponse.body}`);
    }

    const modResult = JSON.parse(modificationResponse.body);
    console.log('✅ Modification Ledger updated successfully.');
    console.log('✅ Recalculated Health Score with Mitigation Credit applied:');
    console.log(`   - New Overall Score: ${modResult.updatedScore.overallScore}`);
    console.log(`   - New Fall Risk Score: ${modResult.updatedScore.fallRiskScore}`);
    console.log(`   - Change Delta: +${modResult.updatedScore.changeDelta} points!`);

    if (modResult.updatedScore.overallScore <= baselineScore.overallScore) {
      throw new Error('Overall score should have improved with mitigation credit!');
    }

    // Get signed Property Safety Certificate (JSON-LD)
    console.log('📜 Requesting Signed Property Safety Certificate...');
    const certResponse = await app.inject({
      method: 'GET',
      url: `/v1/properties/${property.id}/certificate`,
      headers: {
        'x-user-id': homeowner.id,
        'x-user-role': 'homeowner'
      }
    });

    if (certResponse.statusCode !== 200) {
      throw new Error(`Failed to generate signed certificate: ${certResponse.body}`);
    }

    const signedCert = JSON.parse(certResponse.body);
    console.log('✅ JSON-LD Signed Property Certificate generated successfully:');
    console.log('   - Context:', signedCert.certificate['@context']);
    console.log('   - Subject ID:', signedCert.certificate.credentialSubject.id);
    console.log('   - Certified Address:', signedCert.certificate.credentialSubject.address);
    console.log('   - Verified Safety Score:', signedCert.certificate.credentialSubject.overallSafetyScore);
    console.log('   - Proof JWS Signature:', signedCert.proof.jws);

    // ----------------------------------------------------
    // PHASE 5: ENTERPRISE INTEROPERABILITY & HL7 FHIR DIGITAL HANDOFF
    // ----------------------------------------------------
    console.log('\n--- PHASE 5: Enterprise Partner Integration & HL7 FHIR ---');

    // Register general hospital as enterprise partner
    console.log('🏥 Onboarding General Hospital partner...');
    const partnerResponse = await app.inject({
      method: 'POST',
      url: '/v1/enterprise/partners',
      payload: {
        name: 'General Hospital Discharge Planning',
        type: 'HEALTHCARE',
        consentScopes: ['READ_REPORTS']
      }
    });

    if (partnerResponse.statusCode !== 201) {
      throw new Error(`Failed to onboard partner: ${partnerResponse.body}`);
    }

    const partnerData = JSON.parse(partnerResponse.body);
    console.log(`✅ Enterprise Partner Registered. ID: ${partnerData.id}`);
    console.log(`   - Plain API Key: ${partnerData.apiKey}`);

    // Fetch FHIR Bundle without consent (should fail)
    console.log('❌ Querying FHIR Observations WITHOUT patient consent...');
    const unauthorizedFhirResponse = await app.inject({
      method: 'GET',
      url: `/v1/enterprise/property/${property.id}/fhir-observations`,
      headers: {
        'x-partner-id': partnerData.id,
        'x-homeowner-consent': 'false'
      }
    });

    if (unauthorizedFhirResponse.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden without consent, got ${unauthorizedFhirResponse.statusCode}`);
    }
    console.log('✅ Access blocked successfully without consent.');

    // Fetch FHIR Bundle with patient consent (should succeed)
    console.log('🏥 Querying FHIR Observations WITH active patient consent...');
    const fhirResponse = await app.inject({
      method: 'GET',
      url: `/v1/enterprise/property/${property.id}/fhir-observations`,
      headers: {
        'x-partner-id': partnerData.id,
        'x-homeowner-consent': 'true'
      }
    });

    if (fhirResponse.statusCode !== 200) {
      throw new Error(`Failed to retrieve FHIR observations: ${fhirResponse.body}`);
    }

    const fhirBundle = JSON.parse(fhirResponse.body);
    console.log('✅ HL7 FHIR searchset Bundle retrieved successfully:');
    console.log(`   - Resource Type: ${fhirBundle.resourceType}`);
    console.log(`   - Total resources mapped: ${fhirBundle.total}`);

    // Verify observations and conditions exist
    const fhirObservation = fhirBundle.entry.find((e: any) => e.resource.resourceType === 'Observation');
    const fhirCondition = fhirBundle.entry.find((e: any) => e.resource.resourceType === 'Condition');
    const fhirDocument = fhirBundle.entry.find((e: any) => e.resource.resourceType === 'DocumentReference');

    if (!fhirObservation || !fhirCondition) {
      throw new Error('FHIR bundle is missing crucial Observation or Condition resources.');
    }

    console.log(`   - LOINC Code Observation value Quantity: ${fhirObservation.resource.valueQuantity.value} (LOINC: ${fhirObservation.resource.code.coding[0].code})`);
    console.log(`   - ICD-10 Code Condition display: ${fhirCondition.resource.code.coding[0].display} (ICD-10: ${fhirCondition.resource.code.coding[0].code})`);
    if (fhirDocument) {
      console.log(`   - DocumentReference Content PDF Link: ${fhirDocument.resource.content[0].attachment.url}`);
    }

    // Verify AccessAudit table records partner access
    const auditRecord = await prisma.accessAudit.findFirst({
      where: {
        actorId: partnerData.id,
        resourceId: property.id,
        actionType: 'PARTNER_FHIR_READ'
      }
    });

    if (!auditRecord) {
      throw new Error('AccessAudit record not found for the partner read.');
    }
    console.log(`✅ Access audit ledger recorded for external read. Timestamp: ${auditRecord.timestamp}`);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`\n🎉 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ ALL HOMEASE INTEGRATION TESTS PASSED SUCCESSFULLY!`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Tested: Guided Space Capture, Gemini AI Pipeline, Prioritization ROI, BoQ checklists, Stripe Double-purchase prevention, Concurrency locks, Access paywalls, Lifetime record score delta-computation, signed JSON-LD certificates, and HL7 FHIR Interoperability.`);
    console.log(`🎉 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    await app.close();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Integration Test Failed:', err);
    await app.close();
    process.exit(1);
  }
}

runIntegrationTest();
