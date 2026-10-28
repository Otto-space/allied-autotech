# W13: scoped financial aftercare (local checkpoint)

Branch `feat/workforce-scoped-aftercare-20261027`, based on W12 `e31af199`.
Reuse the authoritative worktree, dependencies and synthetic W7 CI database.
No publication, new role/template, migration, automatic refund or stock movement.

## Contract and fixture acceptance established before implementation

The legacy financial aftercare review requires FINANCE_POLICY_APPROVE, but managed
accounts cannot reach its broad legacy order APIs. A title must not recover that
access. The new financial workspace requires BOTH a current branch FINANCE_READ
assignment and the separate active FINANCE_POLICY_APPROVE grant. Reading payment
records alone does not grant a financial decision; the independent grant alone
does not grant another branch or general customer/order access. Other legitimate
legacy aftercare inspection/receiving and customer-owned workflows remain intact.

- GET `/staff/workforce/aftercare`: bounded scoped queue, literal order-reference
  search, kind/status filters and a checked cursor in the same filtered scope.
- GET `/staff/workforce/aftercare/:id`: minimal order/line/financial and request
  evidence, explicit unknown policy/item evidence, current access and an opaque
  review revision. No customer identity/contact, raw policy settings or broad order.
- POST `/staff/workforce/aftercare/:id/decision`: only APPROVED/REJECTED, explicit
  expected status/review revision and reviewed note/fee. Existing inspection, fee,
  pre-confirmation cancellation and audit rules remain in the shared transition core.
  Reject stale evidence even if status did not change. Serialize concurrent legacy
  and scoped decisions. Receipt binds the request/order/branch, actor and decision.

Native acceptance covers positive and absent-grant/absent-scope cases, enrolled
Staff/Admin, explicitly assigned other branch, foreign/inactive branch, stale facts,
revocation/expiry, MFA/CSRF/strict body, business rules, no stock/refund side effects,
checked pagination and concurrent decisions. Browser acceptance must separately
cover populated queues/details/review, keyboard/mobile, failure recovery and access
removal; backend acceptance alone does not complete the frontend journey.

This is an operational financial adapter, not a new policy approval mechanism or
authority to pay refunds. Missing business evidence must stay visible and unknown.
No actual provider call is authorised: W9's conservative allowance remains exhausted.
Granular Care authority, reviewed persisted handoff, gated shared staffed transport
and complete 106-route learning acceptance remain subsequent required work.

## Implemented and verified

The matching scoped queue/detail/review now uses the existing dashboard shell and
permissions registry. URL filters, clear/first/previous/next controls, keyboard review,
explicit customer-visible audience, editable note after rejection/refresh and minimal
uncertain-decision recovery are implemented. Internal inspection evidence is separate
and never copied into the decision note. A scoped grant removal discards the open
review, note and protected facts. A missing/unknown item or policy projection cannot
be approved by inventing evidence. Financial decisions do not receive or inspect
returns; those existing operational workflows remain separate.

The existing grant is labelled Approve financial policy. It already authorises
legacy aftercare financial decisions; this adapter intersects it with current branch
FINANCE_READ rather than turning it into broad order access. No new grant key, role,
position, template or application account change was introduced. Expected evidence
is bound by a purpose-separated server HMAC, including stored policy settings that
are excluded from the response. The HMAC is a freshness check, never authorisation.

- Ten focused scoped native cases passed. The final seven-suite native run passed
  **62 cases**, including existing aftercare API/replay/customer-privacy, independent
  grant, learning and W12 booking-confirmation regressions. Actual DB target identity,
  schema/migration history and restricted non-owning runtime were verified before
  fixture writes. No schema change or new migration is required.
- The first fixture run failed before endpoint checks because of an oversized order
  reference; that fixture was corrected, then nine cases reproduced the missing
  routes. Further fixture attempts confirmed immutable pricing and kind/status
  constraints. Tests now assert those safeguards rather than disabling them.
- Full frontend **1,130 cases / 169 files** passed. The final focused set passed
  **67 cases / five files**, covering new projections, receipt binding, URL/trails,
  minimal recovery, registry/overview, invalidation and API behaviour. A missing
  jsdom fixture environment and new destination ordering were corrected before
  acceptance. Backend guidance/provider-core units passed **60 cases**. These are
  local provider-mocked checks, not new real-provider evaluation.
- **21 Chromium fixture cases** passed at 320/390/768/1440 for Staff/Admin: populated
  queue/detail/review, keyboard, native-dialog/main Axe WCAG 2.2 tags, missing evidence,
  URL/empty/clear states, rejected/stale outcomes, refresh recovery, scope/grant removal,
  quota failure, free cancellation, long notes and lost/malformed response recovery
  through reload. No real customer data, message or inventory was used.
- **One actual browser/CSRF/API/restricted-CI-DB flow** passed without interception:
  persisted APPROVED decision, zero reviewed fee, one audit, unchanged stock and zero
  refunds. Native-dialog Axe and 390/1440 screenshots passed; 390px persisted readback
  was inspected. It proves this synthetic composition, not hosted role acceptance.
- OpenAPI validates **379 paths / 443 operations plus four infrastructure routes**;
  frontend types regenerated. Source/script/frontend types, dedicated strict native
  fixture/harness compile, lint, secret guard and one optimized cached frontend build
  passed. The reused Next16.3.8 cache is not exact-lock16.4.3 release acceptance.
- Screens: `%TEMP%/allied-aftercare-review-390.png`, `...-1440.png`,
  `allied-aftercare-native-review-390.png`, `...-1440.png`, and
  `allied-aftercare-native-recorded-390.png`. Native summary receipt is retained
  under the W7 CI evidence directory. The native API stopped gracefully, revoked
  the synthetic browser session and removed its owned local cookie file.

## Remaining boundaries

No deployed/public feature, provider call, external delivery, financial transfer or
stock adjustment is part of W13. The provider allowance from W9 remains exhausted;
the new gated written-help topic has no fresh actual-provider evaluation. No guide/
practice decision or full route completion is claimed. The matrix remains partial.
Granular Customer Care authority, canonical reviewed persisted handoff, shared
staffed/gated transport and complete 106-route learning acceptance remain required.

Reconcile later release work, deploy the compatible backend before exposing its new
frontend journey, verify the pending W7 migration/backups/restore gates, run exact-lock
CI and hosted/real-role/device/screen-reader acceptance before publication. Existing
legacy/customers aftercare and financial policies retain their contracts and guards.
C: about25.41GiB measured free; no new Docker resources, dependency installation,
worktree, archive or editor profile. Previously denied dev-folder cleanup was not
retried. Existing useful current/rollback/other-task resources remain preserved.

After the combined62 run, the final focused scoped suite passed **11 cases**: an
additional real enrolled-Admin positive decision stays blocked from the broad legacy
order API, and its customer-owned history returns the reviewed note while excluding
internal inspection notes and raw policy data. This is an additional acceptance case,
not a claim of73 unique tests. The 62-case combined run and11-case final focused run
are separate receipts. Read-only Docker review retained91 image references (13.16GB),
200 cache entries (9.519GB),14 volumes (1.012GB) and14 containers (one active). No
resource was proved redundant; other tasks/current/rollback/DB resources were preserved.
