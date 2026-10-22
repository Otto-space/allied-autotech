# Administrator review moderation — gate 79

Route `/admin/reviews`. Locally accepted 18 October 2026. This queue includes inline
review decisions; there is no separate staff review detail route. Public feedback
and customer review history keep their existing privacy boundaries.

## Implemented behavior

Named breadcrumbs, grouped supported status/type/exact-reference filters and
complete review records replace the generic moderation list. Oldest-first cursor
pages, filters and the selected form survive reload and browser Back. Counts apply
only to the current page. All five source types retain full names, references and
actual links where the API supplies a valid destination. Overall-experience reviews
do not imply a verified purchase. No customer profile link is fabricated.

Cards retain full feedback, actual customer name, rating, numeric version and exact
Lagos timestamps. One expanded decision workspace places source/feedback beside
the form on desktop and before it on mobile. Approved/rejected records are read-only.
The moderation note is customer-visible in the account, excluded from public review
text; rejection requires a reason. Approval with an omitted note clears an old note.

Current own Admin/Super Admin identity and verified MFA gate private access; Staff
and Customer cannot moderate. Fresh identity/current-review reads precede a reviewed
single-flight write. Full immutable feedback/source, expected version, exact saved
decision/note, version increment and moderated timestamp validate the response.
Competing decisions stop preflight; backend compare-and-swap remains authoritative.
Cancellation preserves focus/drafts without an additional queue read. Only the
confirmed form's scoped draft is cleared.

Minimal owner/role/review/version markers lock uncertain decisions through reload.
Session invalidation redacts values while retaining the lock. Explicit **Load current
review** rechecks access and reads current facts without replay or proof of the
original outcome. A review that moved outside the selected status remains available
as a complete read-only current record. Definite rejection differs from an unsent
preflight. Temporary failures retain labelled facts with decisions disabled; denied
reads clear private feedback/forms and support independent queue-access recovery.

Backend changes add an optional exact review filter and an administrator direct
read with private no-store responses and privileged READ audits. Moderation returns
its safe receipt inside the transaction containing the decision, audit and customer
notification. OpenAPI/generated types are updated; no schema, migration or permission
expansion is required. See the [contract](../../../backend/docs/workshop-review-moderation.md).
ADM-36 records implementation; ADM-37 records optional durable original-request recovery.

## Concepts and fidelity

All four baseline widths (430/768/1280/1440px) were captured and viewed before fresh
built-in Image Gen [desktop](work-review-moderation-oct-concepts/desktop.png) and
[mobile](work-review-moderation-oct-concepts/mobile.png) concepts. Both concepts were
viewed before UI edits. The [audit](work-review-moderation-oct-concepts/audit.md),
[specification and corrections](work-review-moderation-oct-concepts/spec.md) and
[exact prompts](work-review-moderation-oct-concepts/prompts.md) are retained.
Browser plugin tools were unavailable; production Next.js, Playwright/Edge, Axe and
native image inspection supplied verification. Generated imagery is not embedded.

Final native comparison uses the actual reference dimensions: **1486 × 1059 desktop**
and **876 × 1796 mobile reference**. Narrow layouts are separately verified down to
320px. Full-page captures preserve continuing cards/forms beyond the reference canvas.

| Point              | Final disposition                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Composition        | Compact heading, grouped filters, complete cards and one adjacent decision panel follow the concepts using the actual Allied dashboard shell.                            |
| Typography         | Quicksand; 30px desktop/24px narrow heading, 18px card titles, 16px sections and 13px body. No distressed substitute font.                                               |
| Brand and controls | Actual logo/ink sidebar, white account strip, cool canvas, restrained red actions, 12px panels and controls at least 44px high replace generated branding/blue actions.  |
| Source fidelity    | Real source names/full UUIDs and precise timestamps replace invented codes, dates, avatars and customer destinations. Rating/version values come from the record.        |
| Counts and states  | Page-local oldest-first counts replace invented global totals/Page 1 of 1. One supported status per result replaces the concept's mixed-status sample.                   |
| Copy and privacy   | Customer-visible account note is explicitly distinct from public feedback; overall experience makes no purchase-verification claim. Terminal decisions remain read-only. |
| Responsive review  | Paired wrapping facts, stacked mobile workspace and scrollable full confirmation retain exact feedback/source/note. Native modal cancellation restores focus.            |
| Accessibility      | Semantic rating labels, real ordered breadcrumbs, visible labels/errors, keyboard review/cancel and zero Axe violations across the final scans.                          |

## Verification

- **38 production browser cases:** 32 focused moderation cases and six existing
  moderation/public-feedback regressions. Includes all five sources, role/profile
  boundaries, 25+3 paging/reload/Back, selection, filters, cancel focus, required
  rejection note, single-flight, full receipt validation, competing decisions,
  definite rejection, six uncertain-result variants, reload/current-read recovery,
  access revocation/recovery and unavailable pending storage.
- **Six unit cases:** strict query/source/page validation, full exact receipts,
  actor-scoped pending markers/redaction, draft isolation and blocked storage.
- **Five API/database scenarios:** scoped collection/direct reads, access/MFA/CSRF,
  atomic receipts/null-note behavior, public-field exclusion, concurrent one-winner
  decisions, required rejection notes and terminal-state enforcement.
- **21 final Axe scans:** seven responsive widths plus a full confirmation dialog,
  and 13 native/state captures. No violations or captured page errors.
- Scoped TypeScript, lint, formatting, exported OpenAPI validation, route coverage
  and the final production build passed. The contract covers 271 paths and 324
  documented operations, with four infrastructure operations separately accounted.
  **21 exact source/dependency hashes** match the production snapshot.

Connected production Edge → Express → restricted PostgreSQL verified 25+3 paging,
reload/Back, exact filters/selection and **three real UI decisions with three matching
administrator mutation audits**. One additional competing Super Admin decision gave
**four total decision audits and four notification records**. That terminal change
stopped the next UI action before dispatch. There were **31 recorded administrator
READ audits across the reused actor's API/browser verification**, a cumulative count,
not 31 new browser-only reads. Exact customer notes and public exclusion passed.
A committed lost response remained one write through reload/current-read recovery.
Hashes of all 28 customer profiles and 24 untouched reviews remained unchanged.
Super Admin, Staff, Customer and anonymous boundaries passed without page errors.

The API test's initial public-read assertion used an unsupported limit of 100; it
was corrected to the existing maximum 50. Continuation reused all original 28 paging
fixtures and identities without reseeding. A development-only rating ARIA failure
was corrected with its semantic role before the passing final production checks.
Formatting the generated multi-megabyte API declaration was unnecessarily expensive;
it is now excluded from Prettier and validated by generation/TypeScript instead.
Passed verification was reused; documentation-only completion needs no rebuild.

## Database safety and remaining work

The actual isolated target **127.0.0.1:55480 / allied_work_aftercare_20261017_test**
and restricted runtime were verified before fixture/session writes. Existing synthetic
fixtures, owners and grants were preserved; owned temporary sessions were removed.
Unchanged 59-migration replay, db:check and runtime privilege evidence was reused.
No application/shared database, schema, migration, existing grant, backup/restore,
commit, push or deployment operation occurred. No new restore test is claimed.

Durable original-request moderation receipts remain an optional separate capability.
Current-record recovery does not prove an original outcome. Deployed role/provider
notification delivery, release safeguards and application-wide acceptance remain
open. Next separate page gate: administrator payments `/admin/payments`; the overall
goal remains active.
