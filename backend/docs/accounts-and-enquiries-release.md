# Accounts and enquiry requests — public release

Public activation verified 22 October 2026 at 22:35 UTC (23:35 Nigeria time).

Registration, customer account access and website enquiry/complaint intake are public at https://alliedautotech.com. Service/vehicle enquiries can include visit preferences requiring staff confirmation. Checkout, scheduled-booking writes, paid reservations and live payments remain closed.

## Scope authorised in this conversation

The owner requested expansion beyond the public catalogue. Michael then explicitly chose:

- Purchases remain enquiries for staff to confirm by phone/email. No manual-payment checkout is authorised.
- Service visits and vehicle inspections are requests requiring staff confirmation, with no payment, guaranteed appointment or vehicle hold.
- No additional purchases. Paystack is unavailable; both payment providers remain disabled.

Production runtime mode is `browse_enquiries`, not `full`. The existing backend mode permits registration, account features and public/customer support intake, while rejecting transaction writes. The matching frontend suppresses checkout, scheduled-booking and reservation pages. Do not set `full` to work around this boundary.

## Published changes

- Registration and support forms link to the privacy notice beside submission. Viewing it opens a separate tab to preserve the form.
- Service/vehicle enquiries can include a preferred date and time in Africa/Lagos. Invalid or past times are rejected; the complete message remains subject to the existing 4,000-character limit.
- Review shows the exact preference and the staff-confirmation requirement. Submission uses the existing support endpoint, routing, records and notification delivery; it does not create an order, booking allocation, inspection allocation or vehicle reservation.
- The accounts-and-enquiries notice adds account/profile/garage information, support intake, moderated reviews, browser drafts and the previously approved account retention rule. Catalogue mode continues to render its separate approved scope.
- The exact proposed notice is rendered in [the owner review copy](accounts-and-enquiries-privacy-review.html). Regenerate with `node frontend/scripts/render-accounts-privacy-review.cjs` from the repository root. The source hash identifies the reviewed page. Its effective date must be checked at actual publication.

## Staff handling

1. Open the enquiry from the dashboard/email alert and read the linked service or vehicle, handling branch and requested Nigeria-time preference.
2. Check workshop capacity or the actual vehicle's availability with the responsible team. A preferred time is a request, not an allocated slot.
3. Reply to the customer with the agreed arrangements, or propose alternatives. The support record does not automatically create a workshop-calendar entry or inspection booking. Record the confirmed arrangement in the company's appointment process and the support conversation.
4. A support status change is a case update, not appointment confirmation. Customer-visible replies can notify the customer; internal notes stay internal. Check visibility before confirming a reply.
5. For product/vehicle purchases, confirm price and availability through the enquiry. Do not call it a paid order, guaranteed hold or completed reservation. Website payment collection remains unavailable.
6. For Google Groups replies, use `support@alliedautotech.com` as From and verify the customer's address among recipients. Remove the notification sender where present. The owner has already verified receipt with the customer in Cc; there is no need to repeat that mailbox test.

## Release checks and remaining evidence

Before changing production settings, record the current app/deployment, preserve the current catalogue rollback target, verify the existing database backup/rehearsal evidence and run the read-only database check. There is no schema or migration change in this release.

Run the matching frontend build in `browse_enquiries` mode, keep private access disabled for the public custom domain, keep preview protection and signed proxy configuration, and preserve MFA, CSRF, branch/ownership checks and upload restrictions. Build without reused Vercel build cache so assets do not reference the old protected deployment.

Verify registration/email verification/login, support creation, review-before-submit, notification handling and rejection of transaction endpoints. Use a new isolated test database for database-backed tests; no tests against production. Synthetic browser fixtures demonstrate UI behaviour, not live email delivery.

Michael explicitly approved this expanded notice in the conversation on 22 October 2026 after receiving the review-copy path and scope. The approval does not certify the outstanding provider/overseas-processing assessment. The more detailed approved retention decisions are recorded in the policy workspace at `C:/Users/PC/.codex/worktrees/allied-launch-final-20261022/backend/docs/public-launch-policy-decisions.md`; do not re-ask settled periods or substitute the older abbreviated record.

The provider/overseas-processing assessment remains open in that workspace's `public-enquiry-privacy-review.md`. Google CDPA acceptance is user-reported; Resend supplied standard documents without resolving the scope question. Its [current DPA](https://resend.com/legal/dpa) was rechecked during this preparation: section 1.2 remains narrower than other definitions. This is not a finding of no protection or a requirement to buy Enterprise. Preserve the uncertainty for qualified assessment; do not claim owner wording approval certifies the transfer assessment. No terms were accepted or paid advice purchased by the agent.

The attempted read-only BitLocker check lacked Windows administrator access. Completion is still unverified; the previous user report was 51%. No encryption setting was changed.

## Later paid transaction release

Still needed: a configured/tested payment provider; approved invoice/finance publication; delivery zones, fees, timing and external courier collection; cancellation/returns and refund timing; assigned financial duties; and a versioned vehicle reservation agreement with deposit, hold, balance and refund rules. Request-only enquiries do not activate these policies. Customer-care hours do not define workshop capacity. Marketing remains a separate opt-in feature and is not authorised by registration.

## Validation evidence

- 25 frontend unit tests passed (launch boundary and visit preference validation).
- 53 backend launch-boundary unit tests passed, including preserved registration/support handlers and blocked transaction writes.
- Frontend TypeScript and changed-file ESLint checks passed. The final fresh Vercel production build passed with the scoped checkbox styling and preserved live branding.
- Two local browser flows passed at 390px and 1440px: review contains the Nigeria-time preference; no request is sent before confirmation; exactly one support submission after confirmation; receipt appears; no page errors or horizontal overflow. Synthetic network fixtures were used, not live production customer records or email.
- The first browser run used an incorrect confirmation-button locator; corrected to the actual `Send enquiry` label and rerun successfully. The mobile screenshot revealed an oversized checkbox inherited from generic input styling; a scoped style fixed it and both flows passed again.
- A fresh deployment observed during preparation (`dpl_FoJK2QoXpXPMw1c1TAFBrgVi3xfc`) contained logo/branding updates. Its account/intake/privacy source was verified against the pre-change source. Ten branding files were retrieved through the authenticated management API, hash-verified, reviewed and preserved in commit `c8ce55af` to avoid reverting live changes.
- Four additional local registration browser checks passed: mobile accessibility, password masking/storage exclusion, required-field constraints, and name/phone validation with focus/error association.
- All 61 migrations replayed into a newly created isolated PostgreSQL 18 test database; schema comparison reported no difference. An initial disk-backed run exceeded Vitest's five-second timeout in 14 tests. A fresh memory-backed test database with a 30-second test timeout passed all 28 integration tests: identity flow, support creation/replay/security, and support customer email/internal-note handling. No application assertions or production timeouts were changed. These tests do not certify production performance. Test containers were stopped; no application database was reset or used for the integration tests.
- The managed backup dated 22 October 2026 at 05:22:09 UTC was present among six backups. App-only firewall rules, exact production target and roles, strict TLS and the existing successful managed restore evidence were rechecked. Provider encryption/retention/PITR evidence remains in the earlier release records. No new restore cluster or rehearsal was purchased or run for this schema-unchanged release.
- Backend rollout `15a110c0-006c-49a6-82c6-34dcd67c4052` is ACTIVE. Only component `PUBLIC_LAUNCH_MODE` settings changed; existing images, credentials, sizes, disabled payments and read-only pre-deploy command were preserved. The job log states: "Database history and Prisma schema are compatible. No database changes were made."
- Frontend source `825562e2b6e31cf3aabe87412c29b0bcb0fd3f55`, deployment `dpl_2CyVGTPh6qti4zPJe15u3H1mjKeS`, was promoted to the existing project. Production-only `NEXT_PUBLIC_PUBLIC_LAUNCH_MODE=browse_enquiries` was persisted and verified. The public custom domains stay open and Vercel preview protection remains `all_except_custom_domains`. No additional resource or subscription was purchased.
- Anonymous live browser checks passed at 390px and 1440px for registration, privacy links, service/inspection preference fields, published notice, custom fonts and overflow. Staff sign-in remains available; customer profile access without authentication returned 401. Paid customer pages redirect to enquiries and transaction POST routes return 403. Empty registration/enquiry/complaint bodies returned 422 validation errors, demonstrating that intake reaches validation rather than the former launch block. These probes did not create customers, submit enquiries or send live email; ordinary operational request logs/rate-limit counters may change.
- Live service image and www access passed. No page errors or HTTP authentication challenges were observed. The existing owner-accepted production email workflow remains the live delivery evidence; this release used captured providers in isolated tests and did not send another production email.

Private receipts: `accounts-enquiries-*` under the original Desktop checkout's ignored `backend/ops/digitalocean/.private/production/`. Public screenshots are in the local temporary folder as `allied-accounts-live-*`. Source and migration files under `backend/src` and `backend/prisma` are unchanged.

## Rollback

The previous catalogue frontend was `dpl_FoJK2QoXpXPMw1c1TAFBrgVi3xfc`. If a rollback becomes necessary, inspect current state first, restore the production launch-mode setting to `catalogue`, promote that preserved catalogue frontend, and change only the backend component launch modes back to `catalogue`. Preserve newly collected accounts/enquiries and the database. No schema downgrade, data reset or restoration over production is authorised.
