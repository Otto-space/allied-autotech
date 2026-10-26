# Help, Learn & Practice: repository discovery

26 October 2026. Base: actual released cart-clear source `76377d43`. Reused
`allied-shop-vehicles-r2-20261025`; the completed, unreleased responsive work remains
on `fix/customer-table-responsive-20261026`, without being bundled into this task.
Main checkout's dirty tracker and every other worktree are preserved.

## Authority and architecture

- Next App Router / React 19 / TypeScript; Express 5 / Zod / Prisma / PostgreSQL.
  Existing public `/help` and `/help/[slug]` use the repository-managed FAQ corpus.
  Keep them and the verified support contacts. Extend the existing Quick help control.
- Identity roles: CUSTOMER, STAFF, ADMIN, SUPER_ADMIN. Non-customer content requires
  existing MFA assurance. `authenticate`, `lockAccessActor`, `workforceSnapshot` and
  the managed-workforce boundary remain authoritative; client roles are never input.
- Workforce templates and effective actions below are defined in
  `backend/src/modules/organization/workforce.policy.ts`. Assignments are time,
  branch and resource scoped. A position/title does not add permissions.
- Runtime launch: `browse_enquiries`. Customer checkout/payments/booking writes and
  paid vehicle reservations remain restricted. `/parts`, `/vehicles`, `/services`,
  `/contact` and owned support workflows are available. Public fitment distinguishes
  confirmed, incompatible and unknown evidence. Existing drafts/review are retained.
- Policies: `backend/docs/public-launch-policy-decisions.md`, current completion
  tracker, `frontend/lib/business.ts`, public-launch middleware and domain routes.
  Collection-only launch and enquiry/inspection direction are confirmed. Do not
  publish new response, appointment, delivery, warranty or refund guarantees.

## Access and learning coverage

| Actual responsibility                 | Existing actions / surface                                                              | Learning scope                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Visitor                               | Public discovery/contact/help                                                           | Search, fitment evidence, enquiry vs commitment; fictional fitment practice                                         |
| CUSTOMER                              | Own `/dashboard/support`, profile/security                                              | Own conversations and request review; fictional enquiry preparation                                                 |
| All verified workforce / legacy STAFF | Own `/admin/security`, assigned workspace                                               | Access boundaries, MFA and safe handover; no implied operational rights                                             |
| OPERATIONS                            | BOOKINGS_READ, ORDERS_READ, ORDERS_PREPARE                                              | Mixed-queue interpretation; additional care/sales guidance only with actual additional assignments                  |
| CUSTOMER_SERVICE                      | BOOKINGS_READ, CUSTOMER_ENQUIRIES, COMPLAINTS, ORDERS_READ                              | Scoped care queue, public replies/delivery truth; fictional triage                                                  |
| SALES_SUPERVISOR                      | SALES_ENQUIRIES, ENQUIRIES_ASSIGN, ORDERS_READ                                          | Scoped sales enquiries and assignment review; unknown-fitment decision                                              |
| SALES_CASHIER                         | SALES_ENQUIRIES, ASSIGNED                                                               | Assigned sales enquiries; shared safe product-information practice                                                  |
| ACCOUNTANT                            | FINANCE_READ                                                                            | `/admin/workforce/finance`, documentation/fictional discrepancy interpretation; no payment confirmation tool        |
| WORKSHOP_LEAD                         | JOBS_READ, JOBS_ASSIGN, JOBS_UPDATE, QUALITY_APPROVE                                    | Scoped work, assignment/quality boundaries; fictional assignment review                                             |
| ELECTRICAL_TECHNICIAN                 | JOBS_READ, JOBS_UPDATE, ASSIGNED                                                        | Assigned findings/handover practice                                                                                 |
| MECHANICAL_TECHNICIAN (both people)   | Same actions/scope as above                                                             | Same guide/scenario; no invented individual privileges                                                              |
| CEO_MD position                       | Existing overview, only actually assigned actions                                       | Scope/freshness interpretation; no job-title-based global access                                                    |
| ADMIN                                 | Global legacy administration only when not enrolled; delegated managed access otherwise | Account/invitation review only under current capability checks                                                      |
| SUPER_ADMIN                           | Existing privileged administration                                                      | Approved governance/recovery reading and fictional safe-procedure decision; no secrets or executable recovery tools |

## Chosen boundaries

Content lives on the backend, filtered before search/direct responses. Private
article bodies, titles, guide definitions and fixtures are not frontend imports.
Local simulator is a pure adapter: read definitions, edit fictional state, review,
reset and finish locally. It owns no live IDs, cookies, CSRF tokens or mutation client.
Progress stores only definition/version/step/status under a server-derived access
key; entered form content is never tutorial progress. No training backend/schema,
AI, live account lookup, transcripts, individual staff reports or new analytics.

Test stack: Vitest/Supertest with newly created exact-loopback `_ci` PostgreSQL,
React unit tests, Playwright/installed Edge and Axe. Browser plugin unavailable.
Existing dependencies are reused. Current provider read verified backend ACTIVE
`98401193-fb85-48d9-8c51-462dcadd6d19`; last recorded frontend is
`dpl_JD4ffNmmmo2W7dgrzBHN4evwNd6u`. Current frontend management access was previously
403; this task does not require production changes.

## Decisions and deferred dependencies

Product instructions can be reviewed against code; new policy publication remains
with the owner. No content CMS/publication privilege is added. Policy details still
awaiting approval remain absent, with a contact link. Booking/order/payment customer
practice is deferred while launch restrictions apply. Full training, manager reports,
mandatory training and AI are later, separately scoped phases. No new staff assignment
is inferred from Operations' interim title or from the brief's candidate table.
