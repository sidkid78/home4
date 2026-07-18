-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('HOMEOWNER', 'CONTRACTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('AVAILABLE', 'PENDING_PAYMENT', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('HEALTHCARE', 'INSURANCE', 'GOVERNMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'HOMEOWNER',
    "stripe_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "captures" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "room_type" TEXT NOT NULL,
    "media_urls" TEXT[],
    "status" "CaptureStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "capture_id" TEXT NOT NULL,
    "room_type" TEXT,
    "user_mobility_level" TEXT,
    "risks" JSONB NOT NULL,
    "recommendations" JSONB,
    "measurements" JSONB NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "human_validated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "priority" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "priority_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "estimated_value" DECIMAL(10,2) NOT NULL,
    "roi_value" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "material_count" INTEGER NOT NULL DEFAULT 0,
    "pdf_url" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_high_value_lead" BOOLEAN NOT NULL DEFAULT false,
    "boq_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "contractor_id" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'AVAILABLE',
    "price" DECIMAL(10,2) NOT NULL DEFAULT 125.00,
    "stripe_session_id" TEXT,
    "purchased_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "stripe_charge_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "net_amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_health_scores" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "mobility_score" INTEGER NOT NULL,
    "fall_risk_score" INTEGER NOT NULL,
    "change_delta" INTEGER,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modification_ledger" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "action_taken" TEXT NOT NULL,
    "verification_media" TEXT[],
    "verified_by" TEXT,
    "completed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modification_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartnerType" NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "webhook_url" TEXT,
    "consent_scopes" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "enterprise_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_audit" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "reports_assessment_id_key" ON "reports"("assessment_id");

-- CreateIndex
CREATE INDEX "reports_priority_score_idx" ON "reports"("priority_score");

-- CreateIndex
CREATE INDEX "reports_is_high_value_lead_idx" ON "reports"("is_high_value_lead");

-- CreateIndex
CREATE UNIQUE INDEX "leads_report_id_key" ON "leads"("report_id");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_stripe_charge_id_key" ON "transactions"("stripe_charge_id");

-- CreateIndex
CREATE INDEX "property_health_scores_property_id_recorded_at_idx" ON "property_health_scores"("property_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "modification_ledger_lead_id_key" ON "modification_ledger"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_partners_api_key_hash_key" ON "enterprise_partners"("api_key_hash");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "captures" ADD CONSTRAINT "captures_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_capture_id_fkey" FOREIGN KEY ("capture_id") REFERENCES "captures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_health_scores" ADD CONSTRAINT "property_health_scores_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modification_ledger" ADD CONSTRAINT "modification_ledger_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modification_ledger" ADD CONSTRAINT "modification_ledger_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
