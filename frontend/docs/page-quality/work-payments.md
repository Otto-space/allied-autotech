# Administrator payment records — gate 80

Route `/admin/payments`. Locally accepted 18 October 2026. This gate includes inline payment
attempts, manual evidence/decisions and refund requests. Invoice, refund-decision,
exception and dispute pages remain separate gates.

## Implemented behavior

Ordered breadcrumbs, a compact named heading, grouped supported filters and complete
payment/attempt records replace loose paragraphs and oversized nested form spacing.
Status, provider, exact customer reference, cursor history and selected attempt
survive reload/Back. Provider matches any attempt and retains every attempt on matching
payments. Counts are page-local; an unloaded/failed page does not claim zero records.

Cards retain payment number, actual status/purpose, full UUID, exact NGN values and
precise Lagos created/updated/deadline/terminal timestamps. Real source UUID links
lead to orders, invoices, bookings and vehicle purchases. No missing customer names,
order numbers, global balances or remaining refundable balances are invented.
Every attempt keeps its reference, number/provider/method, recorded amount, status,
verification and precise dates. Manual payer/bank/transfer/submission/review facts,
recorded reviewer notes and available private evidence remain complete.

One selected manual/refund workspace places facts beside its form on desktop and
before it on mobile. Required clean notes/reasons use wrapping textareas while
preserving the backend's single-paragraph validation. Different-operator manual
eligibility comes from the safe staff projection and remains server-enforced. Full
confirmation includes payment/attempt/source references, evidence and exact submitted
values. Approval does not initiate a charge; requesting a refund does not return funds.

Current own active Admin/Super Admin identity gates private reads and preflight.
Fresh identity/current payment, a full snapshot, one parent request guard and backend
concurrency protect dispatch. Exact immutable scope, saved manual decision/note/dates
or refund actor/attempt/amount/reason validate responses before success. A competing
terminal decision stops before dispatch. Only the confirmed operation's scoped draft
is cleared; cancellation preserves its opener, fields and existing read count.

Minimal actor/role/payment/attempt/operation markers retain uncertain locks through
reload and redact references on session invalidation. Manual current-record recovery
does not resend or prove an original outcome. Refund recovery reads the existing
original request by its actor-bound key, validates the original body fingerprint and
shows its current status. Absence retains the lock and does not prove failure. Explicit
same-key retry uses either the immutable retained request or exact restored fields;
a changed body is stopped before dispatch. Unavailable/redacted references require
explicit manual reconciliation. Unrelated drafts are preserved.

Temporary failures retain labelled facts with changes/paging disabled. Denied profile,
collection, evidence and refund-recovery reads clear protected cards/forms/receipts.
Recovery does not depend on the selected record. Evidence retains explicit authorized
temporary access, allowlisted URLs, expiry and unavailable/error states; raw storage
keys/checksums are not displayed. Blocked pending storage prevents a write.

Backend implementation adds private audited current-payment reads, staff-only safe
reviewer-note/eligibility projections, exact atomic manual responses, requester-bound
refund replay, safe refund responses and read-only original-request recovery using
existing storage. OpenAPI/generated types are updated. No schema/migration or extra
permission is needed. See the [contract](../../../backend/docs/administrator-payments.md).
ADM-38 records implementation; ADM-39 records optional durable manual-decision receipts.

## Concepts and fidelity

All four baseline widths 430/768/1280/1440px, including full mobile/desktop continuation,
were captured/viewed before UI changes. Fresh built-in Image Gen
[desktop](work-payments-oct-concepts/desktop.png) and
[mobile](work-payments-oct-concepts/mobile.png) concepts were viewed before implementation.
The [audit](work-payments-oct-concepts/audit.md),
[specification/corrections](work-payments-oct-concepts/spec.md) and
[exact prompts](work-payments-oct-concepts/prompts.md) are retained. Browser plugin
tools were unavailable, so Playwright/Edge, production Next.js, Axe and native image
inspection supplied evidence. Generated imagery is not embedded in the application.

Native comparisons use actual PNG dimensions **1485 × 1059 desktop** and
**875 × 1798 mobile reference**. Actual narrow layouts are separately checked down
to 320px. Continuing factual records are retained below the reference canvas; modal
captures use native viewports instead of expanding the dialog with a full-page shot.

| Point                    | Final disposition                                                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition              | Compact filters, complete payment cards, inset attempt facts and one adjacent action workspace follow the concepts inside the existing Allied shell.                                   |
| Brand                    | Actual logo, ink navigation, white account strip and restrained red actions replace generated branding and excessive red secondary borders.                                            |
| Typography               | Quicksand with 30px wide/24px narrow heading, 18px payment titles, 16px sections and 13px body. Borders and controls remain visible and at least 44px high.                            |
| Density                  | Inline payment/status hierarchy, compact field margins and wrapping factual groups remove inherited oversized gaps without dropping evidence or source facts.                          |
| Data fidelity            | Full real UUIDs, actual NGN amounts, exact Lagos milliseconds and recorded dates replace fabricated order numbers, changed sample amounts and dates.                                   |
| Copy                     | Required one-paragraph reviewer notes, four-eye eligibility, private evidence access and original captured amounts retain their precise financial meaning.                             |
| States                   | Page-local/current-unloaded counts, honest failure/empty states and distinct current-read/original-request recovery replace invented outcomes or automatic retries.                    |
| Responsive/accessibility | Mobile facts/forms remain in reading order; native scrollable confirmations retain full values and keyboard cancellation. Save/recovery focus is explicitly verified separately below. |

## Verification

- **49 distinct production browser scenarios have passing evidence:** 39 focused
  payment cases and 10 existing finance/payment/evidence regressions. The 39 cases
  passed as 38 plus a focused repeat of the one machine-sleep-interrupted reload case;
  the 10 finance regressions passed in the same final 11-case continuation. No passing
  case was rerun merely to obtain an all-green combined count.
- **23 existing navigation regressions** passed against the development snapshot,
  covering all roles, private-route boundaries and responsive keyboard/navigation
  behavior. Their unchanged shell evidence is reused separately from production claims.
- **Seven unit cases** cover strict query/source/page validation, exact manual/refund
  receipts, minimal owner-bound fingerprints/markers, redaction, scoped draft clearing
  and blocked pending storage.
- **Six API/database scenarios** passed, with the expanded original-refund lookup
  assertions passing in a focused continuation using the original 28 fixtures. **14
  existing backend policy/schema/webhook/HTTP boundary cases** also passed.
- **28 distinct final new-page Axe scenarios:** seven responsive widths plus a full
  long-note confirmation, 18 native/state captures and two visible saved-result focus
  captures. All have zero violations;
  captured states and the connected real browser have no page errors.
- TypeScript, scoped lint/formatting, OpenAPI/route validation and production builds
  passed. The contract covers 273 paths/326 documented operations, plus four separately
  accounted infrastructure operations. **31 selected source/dependency hashes** match
  the final production snapshot, including the confirmation-focus refinement.

The final focus/copy refinement passed **17 focused production scenarios**, reusing
unaffected role/discovery, finance, API/database and unit evidence. Saved manual and
refund results receive keyboard focus and scroll into view; uncertain outcomes focus
the reconciliation heading, and current-record recovery focuses the loaded record.
Cancellation still restores its opener without an extra read. Two additional native
captures prove focused saved headings are fully in the viewport with zero Axe
violations. The four-eye confirmation now states unambiguously that reviewer and
submitter must be different operators.

The two initial functional-run failures were harness selectors: a generic alert also
matched Next's route announcer, and a busy confirmation is named Submitting rather
than Confirm change. Both focused corrections passed. Two legacy runs were interrupted
by machine sleep/Edge launch suspension; only affected cases were repeated. One old
approval assertion expected a collapsed refund opener while the selected attempt now
shows its refund fields; it now asserts those real fields. No product check was weakened.

The screenshot harness originally captured a native viewport after a full-page shot
changed the temporary viewport/scroll position. Native dialog capture and instant
scroll/paint synchronization corrected the affected images, without changing product
behavior or repeating API/database writes. Subsequent image inspection confirms the
actual dialog and complete receipt composition.

## Connected production acceptance and safety

Production Edge → real Express routes → restricted PostgreSQL reused all 28 original
paging fixtures and existing identities/branch. The then-current pending collection
also included one owned API four-eye fixture, so real paging was **25+4**, with reload,
Back and provider/customer/status filters verified; the earlier API collection check
verified 25+3 before the additional decision fixtures existed.

**Four UI writes** produced **three manual decisions and one refund request**, with
four matching UI mutation audits. A competing Super Admin decision produced the fourth
total manual-decision audit and stopped the next UI decision before dispatch. There
were **28 new administrator PAYMENT/REFUND READ audits**, measured against the actor's
pre-run baseline rather than a cumulative reused-actor total.

Manual approval produced **one CAPTURE ledger entry** and the linked order's paid
timestamp. The refund remained **REQUESTED**, with **one REFUND_REQUESTED audit** and
**zero refund-transfer ledger entries**. Customer responses excluded staff notes and
operator eligibility. Committed lost manual/refund responses each remained one write
through reload and the appropriate read recovery. Super Admin, Staff, Customer and
anonymous boundaries passed without page errors. Hashes of the customer profile and
all 24 untouched payment/order/attempt/manual-review snapshots matched. An independent
read-only check confirmed **zero owned temporary sessions remained** after cleanup.

The actual isolated target **127.0.0.1:55480 / allied_work_aftercare_20261017_test**
was verified before fixture/session writes. Existing owners/grants and financial
records were preserved. The initial new session fixture's timestamp ordering was
corrected before financial fixtures were created; no constraint was weakened or
database reseeded. Unchanged 59-migration replay, db:check and runtime privilege evidence
was reused. No application/shared database, schema/migration, existing grant,
backup/restore, commit, push or deployment operation occurred; no new restore rehearsal
is claimed.

Backend/environment evidence is reused for the final frontend focus-only refinement;
no financial write or database fixture is repeated for that UI change. Real provider
refund execution, deployed evidence storage, approved policy/worker delivery and
application-wide acceptance remain separate. Optional durable manual-decision receipts
remain ADM-39. Next separate page: administrator invoices `/admin/invoices`. The
overall goal remains active.
