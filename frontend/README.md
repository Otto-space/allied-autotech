# Allied AutoTech frontend

Next.js App Router and React frontend for Allied AutoTech's public website, customer account, and role-aware staff administration. It uses Quicksand throughout and the supplied workshop/equipment images. The backend is a separate package in `../backend`; the repository root is not an npm workspace.

## Local development

From the `frontend` directory:

```powershell
npm ci
```

Create `.env.local` using [`.env.example`](.env.example) as a guide, preserving any existing local configuration. Start the local API using the [backend instructions](../backend/README.md), then run:

```powershell
npm run dev
```

Open `http://localhost:3000`. Browser API requests use the same-origin `/api/v1` path; Next.js forwards them to the server-only `BACKEND_ORIGIN` (default `http://127.0.0.1:5000`). Database credentials and payment-provider secrets belong to the backend, never to public frontend variables.

Keep `SITE_INDEXING=disabled` and `SITE_ORIGIN` empty until the actual production domain is approved. Media and upload host allowlists are documented in `.env.example`. No additional environment setting is needed for delivery setup or checkout.

## Deploy to Vercel

Import the repository with **Root Directory `frontend`** and the **Next.js** preset.
The checked-in Vercel configuration uses `npm ci`, `npm run build`, and Node.js 24.
To see the frontend without a backend, leave `BACKEND_ORIGIN` unset in Vercel.
No API, database or tunnel is required. Keep `SITE_INDEXING=disabled`.
The public frontend renders; data-dependent sections show unavailable states, and
login, protected dashboards and saves require connecting a backend later.

See [Vercel deployment](docs/vercel-deployment.md) for environment variables,
backend authentication settings and verification. Vercel uses native Next.js
output; local and other Node-hosted builds keep the existing standalone server.

## Application flows

- Public discovery: `/`, `/services`, `/parts` (labelled Shop), `/vehicles`, `/about`, `/help` and `/contact`.
- Signed-in customers use `/dashboard`; staff, administrators and the protected owner use the permitted areas under `/admin`. Navigation derives from the authenticated role. Backend authorization remains authoritative.
- `/dashboard/cart` supports collection and approved delivery areas. The backend determines fees, tax, stock reservations and final totals. Creating an order does not initiate payment.
- `/admin/delivery-policy` is owner-only. Delivery requires approved effective areas and configured delivery-tax treatment. `/admin/finance-policy` requires an explicit finance approval permission to publish, including for the owner. The application does not invent or automatically approve business settings.
- `/admin/refund-timing` lets the owner record the approved bank refund start event and calendar. Publication does not move money or change deadlines already saved on refunds. Staff can separately acknowledge complaints from their permitted customer-care conversations without resolving them.
- `/dashboard/privacy` records customer privacy requests and displays review decisions. `/admin/privacy` requires explicit `PRIVACY_REVIEW` permission for every operational role; reviewers can record customer-visible decisions and manage retention holds. Approval does not execute deletion or anonymization.
- `/admin/complaint-policy`, `/admin/dispute-policy` and `/admin/retention-policy` let the owner record approved contacts, calendars and retention rules. Contact eligibility is rechecked by the backend. Publication does not perform deletion, resolve complaints/disputes or send provider evidence.
- To establish the sole owner, follow [initial owner provisioning](../backend/docs/initial-owner-provisioning.md). The bootstrap command inspects an existing verified account before any explicit promotion; it does not create an account.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

Run type checking and production builds sequentially because the build regenerates `.next/types`. A successful build packages standalone output; `npm start` serves that output. Building does not deploy the app.

The repository Playwright suite uses installed Edge on Windows. Point `PLAYWRIGHT_BASE_URL` at an authorized local test instance. The focused delivery suites intercept API requests with synthetic fixtures:

```powershell
npm run test:e2e -- tests/e2e/delivery-policy.spec.ts tests/e2e/delivery-checkout.spec.ts
npm run test:e2e -- tests/e2e/refund-timing.spec.ts tests/e2e/complaint-acknowledgement.spec.ts
npm run test:e2e -- tests/e2e/privacy.spec.ts
npm run test:e2e -- tests/e2e/operational-policies.spec.ts
```

See [local test instructions](docs/local-development.md) before running other suites; some own separate loopback fixtures or require explicit environment flags. Real provider payments and outgoing notifications are not part of browser-fixture testing.

The current development environment injects Console Ninja and produces WebSocket/CSP errors. Its private HTML cache header also differs from the production assertion. Strict checks remain enabled; these runs are not reported as fully passing. Detailed results and production-verification limitations are in the [September 24 handoff](docs/september-24-implementation.md).

## Contracts and implementation evidence

- [API inventory](docs/api-coverage.md): all documented operations, screens, contracts and verification status.
- [Architecture and integration](docs/architecture-and-integration.md): client boundaries, mutations, account isolation and feature-specific decisions.
- [Current implementation handoff](docs/september-24-implementation.md): completed increments, exact checks and remaining full-platform work.
- [Release blockers](docs/release-blockers.md): read alongside the current handoff; older phase results do not establish current production readiness.

After an intentional backend OpenAPI change, regenerate frontend declarations and inventory with `npm run api:types` and `npm run api:inventory`, then format the generated files and run the relevant checks. API coverage records implementation and evidence separately; an endpoint appearing in the inventory does not prove its workflow is complete.
