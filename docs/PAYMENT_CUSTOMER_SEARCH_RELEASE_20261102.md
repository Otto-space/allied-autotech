# Payment customer search release — 2 November 2026

Published frontend c44d7d687787de5d3e754d943acb82242807d012 as
 dpl_A1QVEcajpqZYnHTiE4pC5GL47Cy6. Both apex/www independently verified;
www redirects to apex. Backend f0402b67 / 36b4283f-63fc-401b-abbe-03b8bf9ccf2c
is unchanged. Compatible preceding frontend: dfd69bd1 /
dpl_Acehf69pBzE1vxdycA3GXq7MmoCs.

## Task improvement

Before: filtering payments for a customer required carrying a profile reference
from another page. Now: expand Find a customer, search by name/email, choose the
named customer and apply. The existing directory returns CustomerProfile IDs, not
user-account IDs; source projection and payment contract were inspected together.
The search is debounced, paginated and ephemeral; names/emails are not put in the
URL. The selected name resolves after reload and survives search-page changes.
A specialist manual-reference fallback remains available through disclosure.
Invalid collapsed reference input reopens and receives focus. Failed lookup has a
retry; denied directory/detail access hides named choices. Existing verified admin
identity and backend permissions remain authoritative. No payment write, financial
review, idempotency, price, policy or activation behavior changed.

Files: frontend/app/components/customer-filter-picker.tsx and its CSS;
frontend/app/components/staff-payments.tsx; frontend/tests/e2e/work-payments.spec.ts.
Existing customer query, strict parsers, useResource and cursor pagination reused.
Expanded search now occupies its own filter row so other desktop controls stay
aligned; mobile remains stacked. Help definitions do not describe this specific
filter; existing guide v13 targets, eligibility and payment-review guidance remain
unchanged, with the content register updated.

## Actual verification

- Prior deployed manual-filter baseline passed. Local scoped lint/types/format passed.
- Exact-master CI: frontend 41398690245 (job 125125622387), backend 41398690430,
  secrets 41398690011 passed. 1,312 frontend units passed; 12 existing skips.
  Build/type/lint/format passed; production audit zero vulnerabilities. Existing
  development-inclusive installation audit: 22 (21 moderate, one high).
- Initial hosted payment matrix: 41 passed, two failed. Customer recovery failure
  was a test reload before route navigation completed; corrected navigation wait
  passed. This gives 42 distinct passing payment journeys across those runs.
  Private-evidence storage.invalid URL was rejected by the production allowlist;
  the same test fails on the preceding release. This acceptance gap is retained,
  not counted as a pass; no storage security setting was relaxed.
- The first new lookup/capture fixtures omitted required response message metadata.
  Strict client validation correctly rejected them. Fixed synthetic envelopes;
  corrected lookup and capture reruns passed. Failures remain in Temp evidence.
- Final source: six hosted payment cases passed, no failures/skips/flakes: original
  filter pagination/reload/Back, seven-width full-dialog accessibility, named search
  paging/reload, failure retry/access revocation, staff denial and invalid-reference
  focus. Four additional open-search captures at 320/414/768/1440 passed scoped Axe
  and page-overflow assertions. Final 320/1440 screenshots visually inspected.
- Two final-candidate public checks and four live checks passed at 390/1440 across
  apex/www: Learn refresh, Help, Services, booking gate, no page errors/overflow.
  These are synthetic role fixtures and real public read-only checks, not real
  production financial or signed-in staff acceptance. No actual customer/payment
  record or approval was created or modified.

Safe screenshots: C:/Users/PC/.codex/visualizations/2026/10/27/
01a17c67-8a90-7763-ab26-1dd4fbcc77ce/mobile-fitment-20261101/
payment-customer-search-{320,414,768,1440}.png. Earlier desktop alignment retained
as payment-customer-search-before-layout-1440.png. Private receipts use
customer-filter and customer-filter-final prefixes; normal Windows Temp contains
browser results. Browser plugin absent; reused Playwright/Edge for fixtures.

## Safety and unfinished scope

Read-only production verification refreshed at 06:17 UTC: strict TLS, 85-migration
compatibility, runtime least privilege and eight healthy workers passed; temporary
IP access removed and verified. Provider identities/digests and aliases rechecked
immediately before promotion. Eight managed backups, latest 2 November 05:22:11 UTC.
Reused 1 November 17:59 UTC populated restore rehearsal for unchanged schema. No
new migration, restore, grant or financial transaction was performed.

Computer Use is now connected and the real /admin/fitment route was inspected:
it redirects to sign-in. Owner explicitly reports no current access. Do not keep
asking for sign-in; real-role fitment recheck remains pending until access changes.
Physical mobile keyboard, full screen-reader and unsampled role acceptance remain
unverified. Storage-dependent upload/private-evidence fixtures need their isolated
allowlist environment. No production storage or permissions bypass is authorised.

Purchasing/deposits stay gated. Verified Tax ID/CAC, invoice identifier snapshot/
rendering support, accountant applicability and rounding approval, separate service
invoice timing, controlled policy provenance/publication and merchant acceptance
remain outstanding. See backend/docs/finance-review-20261101.md and the exact
operational/fulfilment/cancellation decision inventory in
MOBILE_FITMENT_SIMPLIFICATION_20261101.md. Broader requirement/state coverage audit
and independent invoice identifier support remain unfinished; this is a completed
release batch, not full-goal completion.

No Docker resources created or removed. Retention review: 97 images, 13 stopped
containers, 14 volumes, 306 cache records retained with other worktrees, database
and rollback resources. Final C: 25.40 GiB free. Existing untracked shared
node_modules and Desktop's unrelated dirty work preserved. Browser test processes
completed and closed their contexts. Disk preflight is not a machine-wide guarantee.