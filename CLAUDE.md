# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

HOMEase — an AI platform that assesses home safety for aging-in-place. A Fastify/TypeScript API over PostgreSQL (Prisma/Supabase) plus a Vite/React SPA. The SPA has **three personas** (a switcher at the top of the page):

- **Homeowner** — guided camera capture → AI assessment → report (risks, ADA measurements, ROI, materials) → contractor lead → modification → signed JSON-LD certificate.
- **Contractor** — browse a lead marketplace (teaser only) → buy → the paywall unlocks the full report.
- **Enterprise** — register a healthcare/insurance partner → consent-gated HL7 FHIR export (LOINC/ICD-10) → access-audit trail.

Deployed on Vercel (static SPA + Fastify as a serverless function) against hosted Supabase.

## Commands

```bash
npm run dev          # backend API (tsx) on :3010  (PORT env overrides)
npm run web          # Vite frontend on :5173, proxies /v1 -> backend (API_PROXY env overrides target)
npm test             # full end-to-end integration script (WIPES the DB — see below)
npm run build        # tsc compile to dist/
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate dev
npm run db:studio    # inspect the DB

# Vercel (project linked to team scope shauns-projects-b67126da)
vercel deploy -y --no-wait --scope shauns-projects-b67126da          # preview
vercel deploy --prod -y --no-wait --scope shauns-projects-b67126da   # production
```

Run **both** `npm run dev` and `npm run web` (two terminals) for local work; open **http://localhost:5173** (not `0.0.0.0`, and not `:3010` — that's the JSON API, its `/` is 404 by design).

`src/tests/integration.test.ts` is a single script (not Jest/Vitest) that boots the app with `app.inject()` and `deleteMany`s every table on each run — point it at a disposable DB only.

## Frontend (`src/`, built by Vite)

- Entry: `index.html` → `src/main.tsx` → `src/Root.tsx` (the app root export is named `App`, but the file is `Root.tsx` — **not `App.tsx`**, because on Windows' case-insensitive FS that collides with the backend `src/app.ts` and Vite resolves `.ts` before `.tsx`).
- `Root.tsx` fetches demo actors from `/v1/dev/demo-property`, holds the persona state, and renders `CaptureContainer` / `ContractorMarketplace` / `EnterpriseConsole`.
- Capture flow is an XState machine (`src/machines/captureMachine.ts`) driving `CaptureContainer`; camera-denied has a "use sample" fallback (`SKIP`).
- Styling is Tailwind v4 via `@tailwindcss/vite` (`@import "tailwindcss"` in `src/index.css`). Backend files under `src/` are never bundled — Vite only follows the import graph from `main.tsx`.

## Backend architecture

`buildApp()` (`src/app.ts`) is the composition root: registers CORS, JWT, the Prisma + queues plugins, then the route modules. Plugins decorate the instance, so routes use `fastify.prisma` / `fastify.queues.assessmentQueue`. `src/server.ts` (used by `npm run dev`) calls `buildApp().listen()`; `api/index.ts` (used by Vercel) wraps the same `buildApp()` as a serverless handler.

**The pipeline is wired through the API** (not just the test): `POST /v1/captures/:id/process` runs `AIEngineService.assessSpace` → persists an `Assessment` → `ReportingEngineService.processAssessment` (priority/ROI/BoQ → `Report` + AVAILABLE `Lead`) → records a baseline `PropertyHealthScore`. `POST /v1/captures` alone just creates the row and enqueues a (mock) job — it does **not** run the pipeline.

Key routes: `capture.ts` (create + process), `report.ts` (paywalled GET), `lead.ts` (marketplace list, real Stripe checkout/webhook), `enterprise.ts` (FHIR, health-score, modifications, certificate, audit), `dev.ts` (demo bootstrap + settlement — gated, see below).

**Service instantiation is inconsistent, by design** — `AIEngineService`/`ReportingEngineService` are `new`'d; `LongitudinalService` is all static. Match the existing style.

**HITL:** `AIEngineService.evaluateHITL` → `NEEDS_REVIEW` when `overall_confidence_score < 0.75` or any measurement `confidence_interval === 'low'`.

## Environment & what's real vs mocked

`.env` locally, Vercel env vars in prod. Every external integration degrades to a mock when unconfigured:

- `DATABASE_URL` — **required.** Supabase **Supavisor pooler**, transaction mode `:6543` with `?pgbouncer=true` (needed on serverless — without it you get Postgres `42P05 prepared statement already exists`). Tables live in the **`public`** schema (no `schema=` param). The direct `db.<ref>.supabase.co` host is IPv6-only and unreachable from IPv4 — always use the pooler.
- `DIRECT_URL` — required by `schema.prisma` (`directUrl`); session mode `:5432`. Used by `prisma migrate`, not at runtime.
- `GEMINI_API_KEY` — set, but **the AI still runs mock** in practice: uploads are `mock://…` URLs, so `AIEngineService` fails to fetch the image and gracefully falls back to a canned assessment. Real analysis needs real image URLs (Supabase Storage — not yet wired).
- `STRIPE_API_KEY` / `STRIPE_WEBHOOK_SECRET` — set (real Stripe mode). But the marketplace UI settles via `POST /v1/dev/purchase-lead`, **not** the real checkout+webhook (a signed Stripe event can't be simulated from the browser). The real `/v1/leads/:id/checkout` + `/v1/webhooks/stripe` path exists and is exercised by the integration test.
- `REDIS_URL` — absent → in-memory no-op queue; the BullMQ worker is a stub.
- `JWT_SECRET` — `@fastify/jwt` + signs JSON-LD certificates.
- `ENABLE_DEV_ROUTES` — `/v1/dev/*` (demo-property, purchase-lead) register only outside production **or** when this is `"true"`. The hosted demo needs `true`; a real prod deploy should leave it unset. Enforced in `app.ts`.

## Auth & access control

- **Route auth is header-based, not JWT.** Handlers read `x-user-id` / `x-user-role` and check ownership in TS. Role strings there are **lowercase** (`'homeowner'`, `'contractor'`, `'admin'`), distinct from the Prisma `UserRole` enum which is **UPPERCASE**. `@fastify/jwt` is registered but unused.
- **`prisma/rls_policies.sql`** (Supabase RLS on `auth.uid()`) is the intended prod layer but is **not applied** and not what handlers rely on.
- Enterprise partners auth via `x-partner-id` + `x-homeowner-consent`; API keys stored as SHA-256 hashes, returned plaintext once at creation.
- **Lead purchase concurrency:** the real checkout uses a `$transaction` + `updateMany({ where: { status: 'AVAILABLE' }, data: { status: 'PENDING_PAYMENT' } })` guard (count 0 = lost the race). Keep this atomic-lock pattern.

## Deployment (Vercel)

- `api/index.ts` wraps `buildApp()` as a serverless function and normalises the `/v1` path so Fastify routes match.
- `vercel.json`: `buildCommand: prisma generate && vite build`, output `dist/`, and a `/v1/(.*) -> /api` rewrite so the SPA's relative API calls are same-origin (no CORS, no dev proxy in prod).
- `schema.prisma` has `binaryTargets = ["native", "rhel-openssl-3.0.x"]` for Vercel's runtime.
- **TypeScript is pinned to 5.x on purpose.** The native-preview `typescript@7` breaks tooling that runs `tsc` — it broke ts-node (hence `tsx` for dev) and Vercel's `@vercel/node` function build (`Cannot read properties of undefined (reading 'readFile')`). Don't bump to 7.
- The Vercel project is git-connected: pushing to `main` triggers a production build. Preview URLs are behind Vercel Deployment Protection (need login).

## Data model (`prisma/schema.prisma`)

- snake_cased columns via `@map`; plural `@@map` table names. AI outputs (`risks`, `measurements`, `recommendations`) are `Json` — when writing them via Prisma, cast typed arrays: `x as unknown as Prisma.InputJsonValue` (see `capture.ts`; TS 5.9 rejects the bare assignment).
- `Assessment ↔ Report ↔ Lead` are 1:1 (`@unique` FKs).
- `AccessAudit` is an append-only ledger written by `LongitudinalService.recordAccessAudit` on every sensitive read.

## Repo layout gotcha

`specs/`, `runs/`, `workers/`, `.gemini-agent/` are **not application code** — they're artifacts from a Gemini orchestrator agent that generated the architecture. The runnable app is `src/`, `api/`, and `prisma/`.
