# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

HOMEase — an AI platform that assesses home safety for aging-in-place. It drives a 6-stage workflow (Capture → Assess → Report → Prioritize → Match → Execute) that starts as a contractor lead marketplace and extends into a longitudinal "Lifetime Home Record." Backend is Fastify/TypeScript over PostgreSQL (Prisma), with a React capture client, Google Gemini for vision, and Stripe Connect for payments.

## Commands

```bash
npm run dev          # run the API server (ts-node; listens on 0.0.0.0:3000)
npm test             # run the full end-to-end integration suite (see caveat below)
npm run build        # type-check / compile to dist/
npm start            # run the compiled dist/server.js (requires build first)

npm run db:generate  # regenerate Prisma client after editing schema.prisma
npm run db:migrate   # create + apply a migration (prisma migrate dev)
npm run db:studio    # inspect the DB
```

`src/tests/integration.test.ts` is a single script (not a Jest/Vitest suite) that boots the app with `app.inject()` and exercises every phase in order. It **wipes the database** (`deleteMany` on all tables) on each run, so point `DATABASE_URL` at a disposable DB. There is no way to run a single test in isolation — edit the phases directly if you need to narrow scope.

## Environment & mock fallbacks

The app is designed to run with **no external services**. Each integration degrades to a mock when its env var is absent — useful for local dev, but means a missing key fails silently instead of erroring:

- `DATABASE_URL` — required (the only var in `.env`); Prisma/PostgreSQL.
- `GEMINI_API_KEY` — absent → `AIEngineService` returns deterministic mock assessments (`src/services/ai_engine.service.ts`). Also falls back to mock on any API error.
- `REDIS_URL` — absent → `queuesPlugin` uses an in-memory no-op queue instead of BullMQ/IORedis (`src/plugins/queues.ts`).
- `STRIPE_API_KEY` — defaults to `sk_test_mock` → Stripe calls are stubbed with fake URLs/session IDs (`src/routes/lead.ts`). `STRIPE_WEBHOOK_SECRET` gates signature verification.
- `JWT_SECRET` — used both by the `@fastify/jwt` plugin and to sign JSON-LD property certificates in `LongitudinalService`.

## Architecture

`buildApp()` (`src/app.ts`) is the composition root: it registers CORS, JWT, the Prisma and queues plugins, then the four route modules. `src/server.ts` only calls `buildApp()`, `listen()`, and wires graceful shutdown.

**Plugins decorate the Fastify instance** (via `fastify-plugin`), so routes reach shared state through `fastify.prisma` and `fastify.queues.assessmentQueue` rather than importing singletons.

**The core pipeline** (see the integration test for the canonical flow):

1. `POST /v1/captures` creates a `Capture` (PENDING) and enqueues an `analyze-capture` job.
2. `AIEngineService.assessSpace(mediaUrls)` → structured `RoomAnalysisResponse` (risks + measurements + confidence). The caller persists it as an `Assessment`.
3. `ReportingEngineService.processAssessment(assessmentId)` computes priority/ROI/BoQ, writes a `Report`, and creates an AVAILABLE `Lead`.
4. `POST /v1/leads/:id/checkout` → Stripe checkout; the Stripe webhook flips the lead to SOLD and writes a `Transaction`.
5. Longitudinal layer (`src/routes/enterprise.ts`) recomputes `PropertyHealthScore` after each `ModificationLedger` entry, issues signed JSON-LD certificates, and maps data to HL7 FHIR bundles for enterprise partners.

**Service instantiation is inconsistent, by design** — `AIEngineService` and `ReportingEngineService` are classes you `new`; `LongitudinalService` is all static methods. Match the existing style when extending a service.

**Human-in-the-Loop (HITL):** `AIEngineService.evaluateHITL` routes an assessment to `NEEDS_REVIEW` when `overall_confidence_score < 0.75` or any measurement has `confidence_interval === 'low'`. Preserve this threshold logic when touching the AI path.

**Gemini models:** the code uses `gemini-3.5-flash` (default) and `gemini-3.1-pro-preview` (advanced flag) with `responseSchema` + `responseMimeType: application/json` for structured output — not the `gemini-1.5-pro` mentioned in the older spec docs.

## Auth & access control — important

There are **two parallel, mostly disconnected** auth stories; know which one a given route uses:

- **Route-level authorization is header-based, not JWT.** Handlers read `x-user-id` and `x-user-role` headers and check ownership manually in TypeScript (see `src/routes/report.ts`, `enterprise.ts`). Role strings in these checks are **lowercase** (`'homeowner'`, `'contractor'`, `'admin'`) — distinct from the Prisma `UserRole` enum, which is **UPPERCASE** (`HOMEOWNER`, etc.). Don't conflate them.
- **`prisma/rls_policies.sql`** defines Supabase Row-Level Security policies keyed on `auth.uid()`. These are the intended production enforcement layer but are **not** what the current Fastify handlers rely on. The `@fastify/jwt` plugin is registered but routes don't yet verify tokens.
- Enterprise partners authenticate via a separate `x-partner-id` header plus an `x-homeowner-consent` gate; API keys are stored as SHA-256 hashes (`apiKeyHash`), returned in plaintext only once at creation.

**Lead purchase concurrency:** checkout uses a Prisma `$transaction` with an `updateMany({ where: { status: 'AVAILABLE' }, data: { status: 'PENDING_PAYMENT' } })` guard — a count of 0 means another buyer won the race. Keep this atomic-lock pattern for any purchase-path changes.

## Data model notes (`prisma/schema.prisma`)

- All columns are snake_cased via `@map`; models are `@@map`ed to plural table names. AI outputs (`risks`, `measurements`, `recommendations`) are stored as `Json` for schema flexibility.
- `Assessment ↔ Report ↔ Lead` are 1:1 (`@unique` FKs). A `Lead` links back to a single `Report`; a `Report` snapshots one `Assessment`.
- `AccessAudit` is an append-only ledger written by `LongitudinalService.recordAccessAudit` on every sensitive read (health score, certificate, partner FHIR read).

## Repo layout gotcha

`specs/`, `runs/`, `workers/`, and `.gemini-agent/` are **not application code** — they are input/output artifacts from a Gemini orchestrator-workers agent that generated this architecture. The runnable app lives entirely under `src/` and `prisma/`. `.gemini-agent/agent_instructions.md` is that agent's system prompt, useful as a product-context summary.
