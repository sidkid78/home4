# Project-Specific Agent Instructions
<!-- This file is loaded as the AI agent's system instruction. Keep it concise. -->

**Project:** HOMEase
**Version:** 1.0.0

---

## Project Context

HOMEase is a platform that uses AI to assess home safety for the aging population. The architecture supports a 6-step workflow: Capture, Assess, Report, Prioritize, Match, and Execute. It transitions from a lead marketplace to a longitudinal property intelligence platform. Key focus areas include AI-driven risk identification, secure data handling, and marketplace unit economics.

---

## Project-Specific Rules

### 1. Tech Stack

- Framework: React (Frontend), Fastify/Node.js (Backend)
- Language: TypeScript
- Database: PostgreSQL (with Prisma)
- Services: Supabase (Auth/RLS/Storage), Google Gemini (AI), Stripe Connect (Payments)

### 2. Architecture Patterns

- **Orchestrator-Workers Pattern**: Used to separate tasks into specialized domains.
- **Service-Oriented Approach**: Clean separation between user-facing API and asynchronous AI/payment orchestration.
- **State Machine Workflow**: Deterministic state machine approach for the "Capture-to-Execute" workflow (Pending -> Captured -> Assessing -> Reported -> Matched -> Executed).
- **Security**: Strict Row-Level Security (RLS) via Supabase for "least-privilege" access.

### 3. File & Directory Conventions

- Frontend: `src/components/`, `src/hooks/`, `src/machines/`, `src/types/`
- Backend: `src/schemas/`, `src/routes/`, `src/services/`
- Output: `./`

### 4. Critical Conventions

- **Schema Validation**: High-speed JSON schema validation (e.g., Ajv with Fastify) to ensure AI gets structured data.
- **AI Integration**: Multimodal pipeline using Gemini 1.5 Pro with a "Certified Aging-in-Place Specialist (CAPS)" persona. Uses JSONB for flexible storage.
- **Human-in-the-Loop (HITL)**: Automated triggers for expert review if AI confidence scores are < 0.75, or for high-risk ambiguities.
- **Privacy First**: PII is isolated at the Property level. Leads act as a secure proxy. Contractors only see full data upon successful Stripe payment.

---

## Common Workflows

- **Guided Space Capture**: Mobile-first React app with a Finite State Machine (XState) to ensure capture quality and valid state progression before AI analysis.
- **Capture to Report**: Media Upload -> Capture DB Record (Pending) -> Async Queue -> Gemini AI Analysis -> Assessment/Report DB Creation -> Lead Creation.
- **Lead Purchase**: Contractor buys available lead via Stripe checkout -> Stripe Webhook -> Lead status changes to 'Sold' -> RLS allows contractor full report access.
