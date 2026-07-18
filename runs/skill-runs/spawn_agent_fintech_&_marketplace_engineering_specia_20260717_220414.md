---
skill: spawn_agent
agent_role: FinTech & Marketplace Engineering Specialist
status: SUCCESS
generated: 2026-07-17T22:05:58.014420
---

# spawn_agent Run: FinTech & Marketplace Engineering Specialist

## Task
```
Build the complete FinTech marketplace layer with Stripe Connect, atomic checkout locks, ledger recording, and webhooks.
Tasks:
1. Enhance and update 'src/routes/lead.ts' (and integrate with app.ts if necessary) to implement:
   - 'POST /v1/contractors/onboard': Generates a Stripe Connect onboarding link using 'stripe.accounts.create' (with Express type) and 'stripe.accountLinks.create'. Provide a mock fallback link if STRIPE_API_KEY is not configured in the environment.
   - 'POST /v1/leads/:id/checkout': Implements the atomic lead checkout process. To prevent dual contractor purchase race conditions (lead sniping), execute this within a Prisma transaction ('prisma.$transaction') that locks the row or uses select-for-update (or equivalent concurrency control), then creates a Stripe Checkout Session with 'leadId' and 'contractorId' in its 'metadata'.
   - 'POST /v1/webhooks/stripe': Processes incoming Stripe webhook events (specifically 'checkout.session.completed'). When a checkout session completes:
     - Atomically update the Lead status to 'SOLD' and assign the 'contractorId'.
     - Create a 'Transaction' record in the database recording 'leadId', 'stripeChargeId' (from session or mock), 'amount' (125.00), 'netAmount' (amount after any mock platform fee, default 125.00), and 'currency' ('usd').
     - Gracefully handle Stripe webhook signature verification (utilizing STRIPE_WEBHOOK_SECRET, and falling back safely if missing).
2. Ensure everything compiles perfectly with tsc --noEmit and has zero type errors.

```

## Generated System Prompt
```
You are an Elite FinTech & Marketplace Engineering Specialist. Your role is to architect, design, and provide production-grade best practices for building highly secure, scalable, and compliant financial technology solutions and online marketplaces.

### CORE RESPONSIBILITIES:
1.  **Architecture & Scalability:** Design complex distributed systems capable of handling high concurrency with zero-fault tolerance.
2.  **Security & Compliance:** Enforce stringent security measures, data protection, and regulatory compliance (e.g., PCI-DSS, SOC2).
3.  **Transactional Integrity:** Guarantee data consistency, prevent race conditions, and implement robust idempotency for all financial transactions.
4.  **Modern Implementation:** Utilize current (2024-2025) coding patterns, particularly with modern frameworks like Next.js and Tailwind CSS.
5.  **API Integrations:** Architect reliable integrations with financial APIs (e.g., Stripe, Plaid, Adyen) including webhook lifecycle management.

### RULES AND GUIDELINES:
-   **Zero Hallucination Policy:** If utilizing specific framework features (e.g., Next.js App Router caching), ensure patterns reflect the latest official 2024-2025 documentation. (Assume access to `google:search` tool to verify the latest docs if needed).
-   **Security First:** Never compromise security for development speed. Always highlight potential vulnerabilities in suggested architectures.
-   **Idempotency is Mandatory:** Any code or architecture dealing with money movement must explicitly include idempotency keys and retry mechanisms.

### INPUT VARIABLES:
-   **Project Description:** {{project_description}}
-   **Tech Stack:** {{tech_stack}}
-   **Compliance Requirements:** {{compliance_requirements}}
-   **Specific Challenge:** {{specific_challenge}}

### REQUIRED OUTPUT FORMAT:
Provide a comprehensive technical brief structured as follows:

1.  **Executive Architecture Summary:** High-level overview of the proposed solution.
2.  **Data & Transactional Integrity Model:** How the database and application will handle high concurrency and prevent race conditions (e.g., row-level locking, optimistic concurrency).
3.  **Security & Compliance Strategy:** Explicit steps to meet the {{compliance_requirements}}.
4.  **Integration Blueprint:** Strategy for third-party APIs (Stripe, Plaid, etc.), focusing on idempotency and webhooks.
5.  **Implementation Guide & Code Snippets:** Actionable code examples addressing the {{specific_challenge}} using {{tech_stack}}.

### EXAMPLE:
*User Prompt:* "Design a digital wallet top-up system using Next.js and Node/Postgres. Challenge: preventing double-charging during network drops."
*Expected Output Snippet:* (Would include detailed explanation of Idempotency Keys in the API route, Postgres `SELECT ... FOR UPDATE` row-level locking for the wallet balance, and Stripe webhook handling with event signature verification, complete with modern TypeScript code snippets).
```

## Execution Log
```
────────────────────────────────────────────────────────────
spawn_agent: FinTech & Marketplace Engineering Specialist
────────────────────────────────────────────────────────────
  → Phase 1: PromptArchitect analyzing role...
  Analysis complete — level: expert, model: gemini-3.1-pro-preview
  → Phase 2: Generating expert system prompt...
  Prompt generated — FinTech & Marketplace Engineering Specialist
  → Phase 3: Spawning specialist on gemini-3.1-pro-preview
────────────────────────────────────────────────────────────
  Specialist complete — 13 iterations, 12 tool calls
```

### [1] bash
**Args:** `{"command": "cat prisma/schema.prisma || echo \"No schema.prisma found\""}`
**Result:** {'success': True, 'stdout': '"No schema.prisma found"\n', 'stderr': "'cat' is not recognized as an internal or external command,\noperable program or batch file.\n", 'returncode': 0, 'truncated': False, 'message': None}

### [2] list_directory
**Args:** `{"recursive": true, "path": "."}`
**Result:** {'success': False, 'error': 'Too many files (501+). Maximum: 500. Use more specific path or pattern.'}

### [3] bash
**Args:** `{"command": "dir /s schema.prisma"}`
**Result:** {'success': True, 'stdout': ' Volume in drive C is Windows-SSD\n Volume Serial Number is 90BC-D6B4\n\n Directory of C:\\Users\\sidki\\source\\repos\\homease4\\node_modules\\.prisma\\client\n\n07/17/2026  10:02 PM             6,444 schema.prisma\n               1 File(s)          6,444 bytes\n\n Dire

### [4] read_file
**Args:** `{"path": "prisma/schema.prisma"}`
**Result:** {'success': True, 'path': 'C:\\Users\\sidki\\source\\repos\\homease4\\prisma\\schema.prisma', 'content': 'generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\nenum UserRole {\n  HOMEOWNER\n  CONTRACTOR\n  ADMIN\n

### [5] read_file
**Args:** `{"path": "src/routes/lead.ts"}`
**Result:** {'success': True, 'path': 'C:\\Users\\sidki\\source\\repos\\homease4\\src\\routes\\lead.ts', 'content': "import { FastifyInstance } from 'fastify';\n\nexport default async function leadRoutes(fastify: FastifyInstance) {\n  fastify.post<{ Params: { id: string } }>('/v1/leads/:id/purchase', async (req

### [6] bash
**Args:** `{"command": "cat package.json | grep stripe"}`
**Result:** {'success': False, 'stdout': '', 'stderr': "'cat' is not recognized as an internal or external command,\noperable program or batch file.\n", 'returncode': 255, 'truncated': False, 'message': None}

### [7] bash
**Args:** `{"command": "node -e \"console.log(require('./package.json').dependencies)\""}`
**Result:** {'success': True, 'stdout': "{\n  '@fastify/cors': '^11.3.0',\n  '@fastify/jwt': '^10.2.0',\n  '@google/genai': '^2.12.0',\n  '@prisma/client': '^6.19.3',\n  '@sinclair/typebox': '^0.34.52',\n  '@xstate/react': '^6.1.0',\n  acorn: '^8.17.0',\n  'acorn-walk': '^8.3.5',\n  ajv: '^8.20.0',\n  arg: '^4.

### [8] bash
**Args:** `{"command": "node -e \"console.log(require('fs').readFileSync('src/routes/lead.ts', 'utf8'))\""}`
**Result:** {'success': True, 'stdout': "import { FastifyInstance } from 'fastify';\n\nexport default async function leadRoutes(fastify: FastifyInstance) {\n  fastify.post<{ Params: { id: string } }>('/v1/leads/:id/purchase', async (request, reply) => {\n    const contractorId = request.headers['x-user-id'] as 

### [9] bash
**Args:** `{"command": "node -e \"console.log(require('fs').readFileSync('src/app.ts', 'utf8'))\""}`
**Result:** {'success': True, 'stdout': "import Fastify, { FastifyInstance } from 'fastify';\nimport cors from '@fastify/cors';\nimport jwt from '@fastify/jwt';\n\nimport prismaPlugin from './plugins/prisma';\nimport queuesPlugin from './plugins/queues';\nimport captureRoutes from './routes/capture';\nimport re

### [10] update_file
**Args:** `{"content": "import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';\nimport Stripe from 'stripe';\n\nconst STRIPE_API_KEY = process.env.STRIPE_API_KEY || 'sk_test_mock';\nconst STRIP`
**Result:** {'success': True, 'path': 'C:\\Users\\sidki\\source\\repos\\homease4\\src\\routes\\lead.ts'}

### [11] bash
**Args:** `{"command": "npx tsc --noEmit"}`
**Result:** {'success': True, 'stdout': '', 'stderr': '', 'returncode': 0, 'truncated': False, 'message': None}

### [12] bash
**Args:** `{"command": "mkdir -p runs/skill-runs"}`
**Result:** {'success': False, 'stdout': '', 'stderr': 'The syntax of the command is incorrect.\n', 'returncode': 1, 'truncated': False, 'message': None}

## Final Response

I have successfully implemented the FinTech marketplace layer with Stripe Connect in `src/routes/lead.ts`. 

Here is a summary of the implemented features:
1. **Contractor Onboarding (`POST /v1/contractors/onboard`)**: 
   - Dynamically generates a Stripe Express account and returns an `accountLinks` URL for the contractor to complete KYC onboarding. 
   - A mock fallback URL is served if the `STRIPE_API_KEY` is not present or set to a mock value, enabling local testing.
2. **Atomic Lead Checkout (`POST /v1/leads/:id/checkout`)**: 
   - Protects against lead sniping race conditions using Prisma's `updateMany` (optimistic locking) inside a `$transaction`. It only progresses if the lead is in the `AVAILABLE` state and locks it by updating the status to `PENDING_PAYMENT`.
   - Generates a Stripe Checkout session with `leadId` and `contractorId` safely injected into the `metadata` object.
3. **Robust Stripe Webhooks (`POST /v1/webhooks/stripe`)**: 
   - Intercepts `checkout.session.completed` events and verifies the webhook payload signature securely.
   - Executes an atomic database transaction that updates the Lead status to `SOLD`, assigns the `contractorId`, and creates a secure `Transaction` ledger record capturing the `amount`, `netAmount`, and `stripeChargeId`.

I also ran `npx tsc --noEmit` and confirmed there are absolutely zero TypeScript errors. The architecture effectively applies FinTech idempotency and data consistency requirements.
