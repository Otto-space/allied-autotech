# Promotions list

Locally accepted 17 October 2026 — milestone 65. Route `/admin/promotions`.

## Implemented experience

The list now has a named breadcrumb, compact heading/actions, persistent name/code,
configuration and discount-type filters, reloadable cursor navigation and complete
five-column records. Mobile uses a single Filters disclosure and labelled white
record surfaces. Names, full codes, exact discount values, minimum/cap, precise Lagos
starts/ends, enabled setting and both configured limits remain visible. Null limits
say Not set; a null code is not presented as an automatically applied discount.

The page deliberately distinguishes configuration from checkout eligibility and
does not invent redemption counts or remaining uses. Admin/Super Admin access is
required before list requests or creation links appear; the backend independently
enforces role/MFA. Invalid or duplicate query fields block API reads. Malformed,
duplicate, inconsistent or mismatched records are rejected. Temporary refresh errors
retain clearly labelled prior facts with pagination blocked; denied reads remove
cached records. Changing filters resets paging; browser back and reload preserve
applied query state. Known page information is shown without fabricated totals.

The list was extracted from the shared promotion-pages module while keeping its
existing export. Creation/detail components and the customer preview workflow retain
their behaviour and remain separate page audits. The list exposes no inline enable,
delete or bulk mutation controls.

## Concepts and fidelity

Fresh [desktop](work-promotions-oct-concepts/desktop.png) and
[mobile](work-promotions-oct-concepts/mobile.png) concepts preceded UI code. One
mobile generation failed on connection; a built-in retry supplied the retained
concept. The [extracted specification](work-promotions-oct-concepts/spec.md) records
actual copy, tokens and intentional corrections to generated content. Browser plugin
was unavailable; verification used Playwright/Edge, Axe and direct `view_image`
comparison of concepts and final desktop/mobile renders.

| Comparison       | Verified result                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell/navigation | Real Allied branding, authorised navigation and named breadcrumb replace generated navigation. Actual name links open the corresponding record.                      |
| Copy/counts      | Exact heading/subtitle/actions and factual eligibility guidance; actual promotions-on-page count replaces fabricated total/page counts.                              |
| Type/palette     | Established Quicksand scale, pale canvas, white table heading/surfaces, blue guidance and brand-red primary controls. Configuration labels are neutral.              |
| Filters          | Compact labelled desktop row; complete mobile disclosure. Existing visible borders, focus and 44px controls are retained.                                            |
| Records          | Five desktop meanings and all stored facts; precise timestamps and existing percentage/currency formatting preserve the actual data rather than copying mock values. |
| Mobile           | Complete labelled record surfaces avoid the generated cramped multi-column facts. Full names/codes/dates remain available; controls and pagination do not overflow.  |

The native desktop viewport was 1435×1096. Above-the-fold copy matches the extracted
specification; actual record values and required error/loading copy vary by state.
Real shell/branding, controlled typography, neutral configuration labels, red primary
controls and stacked mobile facts are documented intentional differences from the
generated images. Desktop and mobile were faithfully verified against that
specification; no material visual mismatches remain in the checked renders.

## Verification evidence

- **22 distinct browser scenarios have passing evidence:** 18 new discovery cases
  and four selected existing list/access regressions. The combined run passed 19;
  three Staff cases passed after their legacy assertions were scoped to privileged
  promotion reads, excluding the dashboard's permitted own-profile lookup. No
  production access check was weakened and the complete suite was not repeated.
- Coverage includes Admin/Super Admin controls, Customer/Staff denial, exact facts
  and absent invented eligibility, persistent combined search/configuration/type
  filters, cursor reload/back, literal percent/underscore search, invalid links,
  empty/error/denied/malformed/duplicate/mismatched data, stale refresh behaviour,
  named detail navigation, distinct loading and long responsive content.
- **Four frontend unit cases and three backend cases passed.** Units cover exact
  percent/fixed display, nulls, invalid windows/discounts/limits, duplicate IDs,
  encoded scope and invalid query/trail handling. Backend and real-API scope is in
  the [contract report](../../../backend/docs/promotion-discovery.md).
- **17 responsive/state captures and seven dedicated Axe scans passed:** widths
  320, 375, 390, 430, 768, 900, 1024, 1440, 1467 and 1920px; native desktop; mobile,
  empty, error, denied, fixed-type and landscape states. The long-content browser
  case checks six widths with Axe. No checked page overflow, browser errors or Axe
  violations. Full-page captures begin at scroll position zero.
- **Real browser/Express/PostgreSQL passed:** 25+3 paging and stable reload, combined
  filters, literal name/case-insensitive code lookup, exact 12.34%/fixed amount and
  sub-minute dates, named detail/back navigation, private no-store responses, denied
  refresh clearing cached records and Staff/Customer/anonymous rejection. Promotion
  rows remained unchanged; zero promotion writes, usages, promotion audits or browser
  errors were observed.
- Scoped lint/format, TypeScript/production build, backend lint/typecheck and
  generated OpenAPI/types checks passed: 269 paths and 322 operations. Seven exact source/dependency hashes match the tested production snapshot;
  the CSS differs only by verified output from the existing formatter. This
  formatting-only cleanup required no workflow or production-build repetition. A final browser probe
  confirmed URL/title, meaningful content, no framework overlay, zero console
  warnings/errors and page errors, Quicksand 28px heading and 44px input geometry.

## Data and release boundary

Only the preceding gates' isolated local
`allied_work_aftercare_20261017_test` at `127.0.0.1:55480` was used. Actual targets
were checked before helper writes. The existing 58-migration replay, db:check and
restricted runtime evidence were reused because no database schema changed. Domain
fixtures remain preserved; only helper-owned synthetic sessions were removed.

No application/shared/staging/production data or grants changed. No new endpoint,
database schema migration, backup operation, restore rehearsal, off-device recovery
verification or deployment occurred. Deploy the additive search/type query contract
before this frontend. Deployed access/cache/search/paging acceptance remains open;
no production-volume benchmark is claimed. ADM-15 and owner-policy boundaries remain
open. Private evidence is under `C:/Users/PC/.codex/work-promotions-*`; credentials
are excluded from repository reports.

Next separate gate: promotion creation `/admin/promotions/new`, then promotion detail.
The full application goal remains active.
