# Form clarity release — 2 November 2026

Published frontend: dfd69bd1cd7488bd2b9dd8f62d9accaecb6bbb5d.
Deployment: dpl_Acehf69pBzE1vxdycA3GXq7MmoCs. Both alliedautotech.com and
www.alliedautotech.com point to this deployment; www redirects to apex.
Compatible prior frontend: 518dd13f / dpl_4qkD4d4C9r2gesMvh18SogvgVfv9.
Backend f0402b67 / 36b4283f-63fc-401b-abbe-03b8bf9ccf2c is unchanged.

## Change and preserved behavior

Twelve existing components now show readable status/review labels across inspections,
vehicle document assessment, vehicle sale/payment requests, staff payments/invoices,
customer activity and product classification. InvoiceSourcePicker describes search
in ordinary terms and keeps the human record label and branch visible. Its complete
reference is available through existing keyboard disclosure, copy and manual fallback.
Payload enums, status styling hooks, version checks, idempotency, eligibility,
permissions, stock, prices and financial activation gates are unchanged.

Files: frontend/app/components/{inspection-status-form,invoice-source-picker,
staff-invoice-detail,staff-payment-actions,staff-payments,vehicle-attachment-form,
vehicle-document-review,vehicle-evidence,vehicle-payment-requests,vehicle-sale-forms,
work-customer-detail,work-product-form}.tsx. Regression files: inspections.spec.ts,
vehicle-sales.spec.ts, vehicle-stock.spec.ts and work-invoices.spec.ts under
frontend/tests/e2e. Help guide v13 targets and server-side eligibility are unchanged.

## Actual verification

- Local scoped ESLint and TypeScript passed; formatting and diff checks passed.
- Three hosted baseline journeys passed before changes.
- Exact-master CI: frontend 41394976202, backend 41394976199 and secrets
  41394976252 passed. Frontend 1,312 units passed, 12 existing skips; build, types,
  lint and formatting passed. Production dependency audit: zero vulnerabilities.
  Installation/development-inclusive audit still reports 22 (21 moderate, one high).
- Initial candidate b6e54a6b: 56 hosted cases passed, two storage-dependent cases
  skipped, one inspection test failed only because it expected uppercase labels.
  Correcting that assertion passed its full journey. Runtime source is identical
  between b6e54a6b and dfd69bd1; only test assertion and tracker changed.
- Final candidate: six focused hosted cases passed with no skips, failures or flakes:
  inspection completion, document version/concurrent-draft review, source search,
  keyboard reference/copy, manual-copy fallback, and payment review across seven widths.
  Broader retained evidence covers 57 distinct passing journeys, including invoice
  creation/recovery/role boundaries, exact money and product review.
- Two candidate public checks and four post-promotion public checks passed at
  390/1440 across apex/www: Learn article refresh, Help, Services, booking gate,
  no page errors or horizontal overflow. No real application record was written.
- Two synthetic screenshots at 320/1440 were visually inspected on the identical
  b6e54a6b runtime. Paths: C:/Users/PC/.codex/visualizations/2026/10/27/
  01a17c67-8a90-7763-ab26-1dd4fbcc77ce/mobile-fitment-20261101/
  invoice-source-reference-320.png and invoice-source-reference-1440.png.
  The first temporary capture harness failed module resolution; its import was
  corrected and both captures passed. Browser plugin absent; existing Playwright/Edge used.

## Production safety and remaining limits

Read-only production check at 05:26 UTC passed strict TLS, 85-migration compatibility,
runtime least privilege and eight healthy workers. Temporary IP access was removed
and verified. Provider identities/digests were rechecked immediately before promotion.
Eight managed backups verified; latest 2 November 05:22:11 UTC. Reused the 1 November
17:59 UTC populated restore rehearsal for unchanged schema; no new migration, restore,
permission grant or production transaction occurred.

Two asset upload cases still require isolated storage allowlisting; no hosted upload
acceptance is claimed. Physical devices, full screen-reader coverage, unsampled roles
and fresh signed-in fitment acceptance remain open. Historical local service SSR fixture
preview was separately blocked; this batch does not resolve or bypass that limitation.

Purchasing remains gated: verified Tax ID/CAC identifiers, accountant applicability
and exact rounding approval, invoice identifier snapshot/rendering support, separate
service-invoice payment timing, controlled policy publication/provenance and merchant
NGN/reconciliation acceptance remain required. Operational capacity and remaining
fulfilment/cancellation-policy decisions remain as recorded in
MOBILE_FITMENT_SIMPLIFICATION_20261101.md and backend/docs/finance-review-20261101.md.
The wider brief and remaining form/wording audit are not claimed complete.

No Docker resources were created. Read-only retention review found the existing
13 stopped containers, 14 volumes, 97 images and 306 cache records; retained them,
other worktrees, current/rollback resources and Desktop's unrelated dirty edit.
Final C: reserve check: 25.43 GiB free. This is a preflight observation, not an OS quota.
Private receipts use form-clarity and form-clarity-final prefixes; public test reports
are in the normal Windows Temp directory. Documentation receipt is separate from
published runtime source.