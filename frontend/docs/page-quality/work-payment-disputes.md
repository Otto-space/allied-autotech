# Payment disputes overview — gate 85

Route `/admin/payment-disputes`. Locally accepted 18 October 2026. The separate
dispute work queue `/admin/payment-disputes/work` is next. Deployment and
application-wide acceptance remain open.

## Behavior and scope

The overview now uses a compact heading/filter strip, a ruled comparison list and
complete expandable provider/source facts. Wide rows compare provider/reference,
friendly status/category, disputed amount, confirmed chargeback, response deadline
and evidence availability. Smaller layouts use balanced facts grids. Exact money
no longer inherits the retail price strikethrough. Missing chargebacks remain
“Not confirmed”; evidence recorded does not imply submission or provider acceptance.
No balance, aggregate, provider action or financial mutation is invented.

Current active Admin/Super Admin access is confirmed before protected reads. The
work-queue destination requires the current `DISPUTE_MANAGE` capability; overview
inspection does not. Staff/Customer do not fetch the administrator overview. Denial
clears records and the management destination; a temporary refresh failure labels
retained records as the previous successful result.

Supported status/category filters, cursor history and expanded reference persist in
the URL. UI expansion/history are never forwarded as API filters. Disclosures do not
refetch the queue; an expanded reference outside the page is honestly identified as
outside that loaded result set. Paging remains live/newest-first with page-only
counts. Unsupported/duplicate parameters fail closed. The existing profile/resource,
cursor, exact money/date and provider-facts utilities are reused. Handling actions
remain in the separate work queue.

## Visual review

[Audit, specification, concepts, prompts and correction ledger](work-payment-disputes-oct-concepts/audit.md)
preceded implementation. Fresh built-in ImageGen references were inspected at native
1468 × 1071 desktop and 1024 × 1536 mobile dimensions. Generated branding, eight cramped
columns, page numbers/totals, invented deadlines, simplified money and an incorrect
evidence-submission explanation were corrected before implementation.

Final production viewport images at 1440 × 1050 and 430 × 1050 were viewed, alongside
1280px, expanded mobile and native maximum-money record screenshots. Private captures,
state scans and measurements are retained under `C:/Users/PC/.codex/work-payment-disputes-*`.

| Fidelity point         | Measured production result                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real shell and spacing | At 1440px, content x292/width1112/right margin36. Mobile content has 16px margins.                                                                                                             |
| Typography             | Computed Quicksand, 14px interface base, 30px desktop/24px mobile heading.                                                                                                                     |
| Comparison structure   | Ink header and rows align on approximately233/233/186/186/168px tracks with16px gaps; merged provider/status/category avoids the generated eight-column squeeze.                               |
| Mobile facts           | Record width396px inside the398px surface; two174px facts columns with16px gap. Full references wrap.                                                                                          |
| Exact money            | Maximum-bigint disputed amount renders `NGN 92,233,720,368,547,758.07` separately from `NGN 50,000.00` confirmed chargeback; no truncation or text decoration. Native record images inspected. |
| Visible controls       | Mobile filters have visible grey borders, 178×48px dimensions and16px input text; disclosure controls are44px high.                                                                            |
| Complete facts         | Friendly category/status, clear unknowns, compact deadline and precise Lagos timestamps/provider review warning in the labelled disclosure.                                                    |
| Responsive states      | Seven widths320/375/430/768/1280/1440/1920 and12 state captures have no horizontal overflow or page error.                                                                                     |

## Verification

- **26 distinct production browser scenarios** have passing evidence:25 new overview
  cases and one adapted operations regression. The new suite passed25/25. The legacy
  selector initially matched both visible and hidden deadline facts; scoping it to
  the visible deadline passed its focused rerun without rebuilding unchanged runtime.
- **Three frontend unit cases** pass for URL/history boundaries, exact nullable money
  facts and strict private-field/date/order/filter/cursor validation.
- **Two API/database scenarios** pass for private safe/audited pagination, strict
  supported filters, Admin/Super Admin and Staff/Customer/anonymous/MFA boundaries,
  and unchanged existing financial records.
- **19 new-page Axe scans** pass:seven responsive browser checks and12 production
  state captures. No serious/critical violation, page overflow or page error. The
  adapted legacy case also passes its320px WCAG scan.
- Frontend/backend TypeScript, affected ESLint/oxlint, formatting and the production
  build pass. A CSS formatting warning was fixed and the targeted check passed.
  **20 frontend source/dependency hashes** match the tested snapshot, including the
  adapted test copied into the snapshot without rebuilding runtime code.
- Existing route/OpenAPI evidence is reused because no endpoint or schema changed:
  301 paths,355 documented operations and four infrastructure routes.

Connected production Edge/API/PostgreSQL verified actual25+1 cursor paging, reload,
Previous, disclosure without another request, capability-based handling navigation,
Admin/Super Admin reads and Staff/Customer/anonymous API boundaries. It made **zero
UI POSTs, five overview GETs and five READ audits**. All26 synthetic fixture disputes
and all38 payments/38 attempts/31 refunds/37 invoices/eight ledger rows remained
unchanged. The target had no pre-existing disputes before the26 paging fixtures were
added; no claim of preserving a nonempty original dispute population is made. Page
errors were zero and all four owned temporary sessions were removed.

## Backend and database boundaries

The sole backend behavior change adds `private, no-store` to the existing overview
response. Safe projection, minimal READ auditing, strict filters, provider accounting
and role/capability rules remain authoritative. See the [contract](../../../backend/docs/administrator-payment-disputes-overview.md).

API tests and the connected run confirmed the restricted isolated target
`127.0.0.1:55480`, `allied_work_aftercare_20261017_test`, before writes. Synthetic
paging fixtures are retained; cleanup removes only owned temporary sessions. Existing
60-migration compatibility evidence was reused. No application/shared database,
schema/migration, grant, backup/restore, external provider/storage, push or deployment
operation ran. This page gate did not verify off-device backups or a restore rehearsal.
