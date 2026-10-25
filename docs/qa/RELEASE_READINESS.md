# Release readiness (current audit pass)

**Status: limited public copy release deployed; full transactional and all-role acceptance remains open.** This report records the 23-24 October 2026 audit. The user authorized production release of completed, verified work without another permission request. The two copy changes were deployed from the newer dashboard-quality source as `5e7deb6a`, Vercel `dpl_CMG2vPpWCQMvQdCWMZYsxbwproTZ`.

The current public accounts-and-enquiries mode remained responsive in the read-only checks: the frontend deployment was READY, API live/ready endpoints returned 200, core anonymous pages rendered at 320px, and protected payment/session endpoints denied anonymous access. Source review found requester, branch, CSRF, MFA, locking and no-repeat dispatch safeguards around refund operations; passing unit/API tests support those boundaries within their tested scope.

Before broader sign-off:

1. Financial isolated-database checks now include four refund suites (49 passed) and combined work-payments/reconciliation suites (22 passed), each after clean 62-migration replay and schema comparison on fresh `_test` targets. The latter used a direct shared-network target and a measured test-only timeout adjustment. Session access still needs authenticated role acceptance; payment sandbox/provider settlement remains open.
2. Verify customer, staff, admin and super-admin paths with authorized test accounts, including MFA, branch ownership, notifications and private documents.
3. Verify provider sandbox payments, signed webhook processing, reconciliation, refund uncertainty handling, durable storage and restore procedures. Paystack/Monnify remain disabled in public browse/enquiries mode.
4. Complete public and dashboard page-by-page browser, responsive, keyboard and accessibility regression at the brief's requested viewports, plus lint, TypeScript and production build on the final changes.
5. Keep owner policy and operational dependencies from `backend/docs/site-completion-tracker.md` open. Do not enable online payments without provider credentials and settlement checks or invent workshop capacity. Release completed, verified changes under the user's standing production authorization, then confirm actual custom-domain deployment IDs.

Current code changes: audit reports, a corrected header-session browser fixture, service-detail preparation copy, enquiry-mode Parts guidance and a test-only reconciliation timeout. No business rule, schema, API or interaction behavior changed in this pass. The historical `/shop` repair was verified live, not reimplemented.

The Parts page copy correction is live in browse/enquiries mode on both custom domains; the service-detail preparation copy is live too. Protected-deployment and public-domain checks confirmed their rendered text. This does not change the provider and authenticated-role gates above. Product data and fitment suggestions were unavailable in the earlier local browser check because the local API was not running; live catalogue search was checked read-only against an empty public catalogue.

The separate header-session browser fixture does not currently pass against the newer Help/session implementation (6 passed, 13 failed in a local run). Its edit was excluded from production; header/auth runtime code was untouched. The customer success toast and bounded session-probe expectations need focused follow-up. The repository-wide formatter in the older audit worktree flags a broad existing line-ending baseline; the changed release files passed targeted formatting and diff checks.

The pushed release branch's automatic Vercel preview was canceled before build because Vercel could not verify the commit signature; the preceding dashboard-quality branch has the same preview status. This is distinct from the CLI production build, which is READY and assigned to both custom domains. Keep commit verification enabled and establish a verified signing/identity path for Git-triggered previews.
