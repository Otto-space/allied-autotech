# Services, booking and commerce - 1 November 2026

## Release verdict

Source published and representative live journeys verified. **Full commerce
activation remains blocked** by the external prerequisites below.

Runtime: 53cdc8e1307bb23395b3e5e77bdee8f93be48139.
Both alliedautotech.com and www.alliedautotech.com resolve to
dpl_8Q1egBBsQNYYGVEC5Fh5XxgxQFdX. Backend
c5942ed9-51ec-4af6-b468-af8a703c3c2e is ACTIVE (16/16), with matching four image
digests. Domain and backend identities were verified after promotion.

Owner decisions: Saturday closes at 18:00 Africa/Lagos; Tyre Change NGN1,000.
No price, launch flag, inventory, approval, appointment or financial transaction
was fabricated or changed for verification.

## Requirement-to-evidence checklist

| Requirement                                                    | Status     | Source and evidence                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eight service destinations, distinct icons, counts and context | Done       | frontend/app/components/service-groups.tsx and services-catalogue.tsx; all eight destinations and contextual actions checked at 390/1440 with fixtures; live AC context checked on both domains at both widths.                                                                   |
| Structured group/job Service enquiries                         | Done       | backend/src/modules/support; additive service_enquiry_category migration; real isolated HTTP ownership, relationship, persistence and replay checks.                                                                                                                              |
| Signed-in and unlisted parts requests                          | Done       | Existing account-aware support creation/recovery reused; optional vehicle/part number, bounded quantity; isolated HTTP and rendered fixtures verify owned persistence and contextual prefills.                                                                                    |
| Immutable quotation to collection order                        | Done       | backend/src/modules/orders/parts-quotes.service.ts and parts-quotes.routes.ts; frontend/app/components/parts-quotations.tsx; revised/stale/expired/declined quotes, ownership, concurrent acceptance, snapshots, audit and no early stock changes covered in real isolated tests. |
| Cart/checkout entry points and compact favourites              | Done       | frontend/app/cart/page.tsx, frontend/app/checkout/page.tsx and product purchase components; existing server checkout reused; save/remove, refresh and failure recovery at 390/1440; transaction gates preserved.                                                                  |
| Booking request and staff confirmation implementation          | Done       | Existing concern/group booking and workforce confirmation suites included in 84-test isolated integration batch; capacity safeguards preserved; no fake published job or slot.                                                                                                    |
| History and support access                                     | Done       | Historical orders/bookings/payments remain readable in restricted mode; full-mode cart stays reachable; revoked conversation access has explicit fallback. Unit and browser fixtures passed.                                                                                      |
| Production purchasing/payment/booking activation               | Blocked    | Financial/fulfilment approvals, genuine eligible inventory/calendar and provider test acceptance remain prerequisites. No actual merchant test payment performed.                                                                                                                 |
| Responsive/dialog behaviour                                    | Done       | Customer quotation 360/768/1280, staff issuance, unlisted request, mobile layout, focus return, favourites and public services checks passed. Fixture and real public evidence are separate.                                                                                      |
| Comprehensive device/accessibility acceptance                  | Unverified | Physical phones, real role sessions across every dashboard state, 200% browser zoom and complete WCAG 2.2 AA audit are not established by this batch.                                                                                                                             |

## Actual verification

- Exact-master GitHub checks passed: Frontend release 41333397074; Backend
  database safety 41333397179; repository secrets 41333397155.
- Frontend CI: **1,309 passed, 12 skipped**, with clean build, types, lint,
  audit and formatting. Backend CI passed migration replay/schema, type/lint,
  startup/backup safety and integration stages.
- Fresh isolated local database: **84 tests across eight integration files**
  passed after 85-migration replay and db:check. Additional corrected legacy
  cases: 14 tests across four files passed. Quotation audit rerun: four passed.
  These overlapping batches must not be summed as unique cases.
- Backend learning/launch checks: 62 passed; canonical OpenAPI: 414 paths.
- Final packaged artifacts: nine image checks and one isolated database
  replay/restore/drift-rejection check passed.
- Candidate hosted browser: **5/5 intercepted-fixture cases**, plus **2/2 real
  public-content checks** at 390/1440.
- After promotion: **4/4 real public-content checks**, apex/www at 390/1440.
  Verified homepage story placement, contained moderate service/vehicle images,
  removal of the story from Tyre Change, eight service groups, contextual AC
  question fields and restricted booking fallback. No page errors/overflow.
  No enquiry or real transaction was submitted.
- Earlier failures were corrected before release: three outdated frontend
  history assertions, two older backend unlisted-request assertions and a
  quotation-dialog focus-return regression. Failed runs are not counted as passes.
- Payment tests use an injected provider mock; they prove application contracts,
  not Paystack merchant test-mode or real charge acceptance.

## Database and release safety

Migrations 20261101180000_service_enquiry_category and
20261101190000_parts_quotations were applied through guarded db:migrate after
fresh verified backup and populated isolated restore rehearsal from 83 to 85.
The rehearsal retained original-column hashes/counts. Production db:check passed
at 85 migrations; runtime least privilege, strict TLS, four component digests and
all eight workers passed after rollout. Temporary firewall access was removed.
Eight managed backup dates were checked; this does not claim a new managed PITR
restore or a new off-device restore. Existing encrypted off-device/PITR policy
evidence is retained.

Order was backup/rehearsal, additive migrations, backend health, held frontend
candidate, promotion, both-domain identity and rendered live checks.
Rollback retains the additive schema/data and restores compatible prior
application artifacts; never delete customer records to reverse these migrations.

## Exact remaining production activation prerequisites

1. Record approved finance policy and collection configuration through the
   existing authorised workflow. Delivery remains disabled without separate
   approved zones, fees and operational policy.
2. Supply genuine eligible prices/on-hand inventory for ordinary purchases, and
   authorised branch closures, capacity and appointment slots. Do not fabricate
   stock or technician availability. Saturday closing and Tyre Change price
   already have owner approval and require no further decision.
3. Configure server PAYSTACK_SECRET_KEY and PAYSTACK_MODE=test with merchant NGN
   eligibility; PAYSTACK_CALLBACK_URL=https://alliedautotech.com/payments/complete;
   signed webhook https://api.alliedautotech.com/api/v1/webhooks/paystack.
   Verify actual test success/cancel/failure, delayed/duplicate webhook,
   browser-close recovery, wrong amount/currency/reference rejection and
   reconciliation. Keys remain private.
4. Verify PAYMENT_RECONCILIATION_ENABLED and worker readiness before activation.
   Keep PAYSTACK_LIVE_ENABLED=false until separate live approval. Preserve
   PUBLIC_LAUNCH_MODE and NEXT_PUBLIC_PUBLIC_LAUNCH_MODE=browse_enquiries until
   operational prerequisites and activation review pass.
5. Complete real authorised-role and physical-device acceptance; 200% browser
   zoom and comprehensive accessibility coverage remain unverified.
   No unrelated AI/live-chat capability was enabled.

## Screenshots and local resources

Safe screenshots are in the task visualizations folder
services-commerce-20261101: quotation-review-360.png,
quotation-accepted-360.png, staff-parts-quotation.png,
unlisted-parts-request.png, and live public-page captures.
Quotation/staff screenshots use synthetic fixtures. Live public captures contain
public content only. No pre-implementation screenshot was captured; these are
interaction-state and final-state evidence, not a claimed before/after pair.

Task test databases and scoped Docker credentials were removed after use;
populated restore evidence, current/rollback images, unrelated resources,
session stores and useful caches are retained. Last disk preflight: 26.63 GiB
free with 20 GiB reserve; this is not a machine-wide guarantee.
