# Dispute policy — local acceptance, milestone 95

Accepted locally for `/admin/dispute-policy` on 19 October 2026. The application-wide goal remains active. Next separate route: `/admin/retention-policy`.

## Result

The dedicated workspace separates effective settings, the next scheduled version and the latest recorded version. A current-policy endpoint selects effective/scheduled records independently of the latest 100 history entries. Desktop places current facts/history beside the approval form; mobile stacks them in reading order. Searchable primary/backup selectors retain selection across pages, display full current identities and require independent active DISPUTE_MANAGE grants.

The working calendar uses compact full-name weekday checkboxes, paired opening/closing times, excluded dates and an unchecked explicit approval confirmation. Effective date and written provenance remain separate. Refresh preserves drafts and their original base; version changes require explicit reload. Fresh identity/policy/contact/grant checks precede POST. Exact Q9/actor/settings/effective-time receipt validation confirms a save; minimal persistent uncertainty locks require current inspection plus independent reconciliation without automatic replay.

Shared changes are limited to opt-in paired contacts, fail-closed grant refresh eligibility, recovery redaction and breadcrumb exclusion for this dedicated route. Complaint/retention owner flows and related regressions are included. Existing operational processing and provider deadlines retain their original behavior. See [backend contract](../../../backend/docs/dispute-policy-workspace.md).

## Design evidence

Four native baselines at 430/768/1280/1440 and the 2914px full desktop page were inspected before edits. Fresh built-in concepts, prompts and the contract-corrected specification precede implementation: [audit](work-dispute-policy-oct-concepts/audit.md), [specification](work-dispute-policy-oct-concepts/spec.md), [desktop](work-dispute-policy-oct-concepts/desktop.png), [mobile overview](work-dispute-policy-oct-concepts/mobile.png), [calendar detail](work-dispute-policy-oct-concepts/calendar-detail.png), [prompts](work-dispute-policy-oct-concepts/prompts.md). The Browser plugin was unavailable, so the existing Playwright/Edge fallback is used, with sequential browser processes and separate artifact directories.

## Checks already complete

- Development: 23 dedicated browser scenarios passed, including seven widths and current/history/form/review Axe checks; empty/error/denied states also passed Axe.
- Five frontend unit cases pass: authoritative current selection, contradictory envelopes, exact publication receipts and actor-bound uncertainty storage/failure/redaction.
- Seven isolated API scenarios pass: bounded history/current selection, concurrent audited reads, role/MFA/query/CSRF boundaries, revoked-session transaction checks, stale/contact rejection, contacts/calendar/grants validation and exact Q9 publication/duplicate rejection.
- Production build and standalone packaging passed. Backend type check, changed-file lint/format, OpenAPI validation (308 paths), mounted coverage (362 documented operations plus four infrastructure routes) and generated declarations/inventory passed. Sixteen runtime source hashes match the production snapshot.

API target was verified before writes: `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, environment test, restricted runtime. Original snapshots of 60 users, 53 staff profiles, 118 policy versions, 421 audits, 38 branches, one capability grant and existing dispute/financial tables remained unchanged. Temporary test sessions remaining: zero. New synthetic contacts/grants and policy fixtures are retained; existing grants were preserved.

No application/shared database, schema/migration, worker/provider, backup/restore, push or deployment operation ran. Unchanged migration replay/db:check evidence is reused. Synthetic approvals are not business approval. Deployed checks and application-wide regression remain open.

## Production and connected acceptance

All 53 production browser scenarios passed: 24 dedicated dispute-policy cases and 29 operational-policy regressions. The grant-refresh case was then strengthened to dispatch an actual background online revalidation; its focused repeat passed. This is 53 distinct cases, not 54. Seven widths (320/375/430/768/1280/1440/1920) cover current/history/form and review, giving 14 new-page responsive Axe scans plus three empty/error/denied scans. Existing owner/regression scans add affected-route coverage. Source/hash and successful mutation checks were not repeated after this test-only improvement.

Connected production Edge/Express/PostgreSQL passed both intended future approvals with exactly two POSTs and two publication CREATE audits. The first validated exact receipt, retired draft metadata and restored success focus. The second committed response was deliberately lost; reload retained the lock and fresh inspection plus independent reconciliation and explicit draft reload restored the form without another POST. All 221 original policy versions, 62 users, 55 staff profiles and existing financial/support/dispute snapshots were unchanged. Current effective policy remained unchanged, no page errors occurred, and zero temporary sessions remained. The run recorded 44 privileged READ audits across its supporting reads; this total is not a count of current-policy requests alone.

Evidence: `C:/Users/PC/.codex/work-dispute-policy-production-tests`, `work-dispute-policy-background-tests`, `work-dispute-policy-api-tests.log`, `work-dispute-policy-api-preservation.json`, `work-dispute-policy-build.log`, `work-dispute-policy-source-hashes.json`, `work-dispute-policy-final*.png/json` and `work-dispute-policy-real.json`. A capture command initially used an unsupported Windows ESM import path and failed before browser launch; using the existing backend tsx loader fixed the harness. No product change or successful mutation was repeated for that correction.

## Final visual comparison

The three concepts and final production screenshots were viewed directly in the same QA pass. Native 430/768/1280/1440 viewports, the full 1440 page, mobile calendar and mobile approval continuation all pass without overflow or page errors. The final full desktop screenshot is 2357px high with four history entries, compared with the 2914px baseline with one entry; different fixture content is explicit, so this is not a performance metric.

| Comparison point         | Concept and implemented result                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hierarchy and navigation | Compact title/Refresh, true ordered-list chevron breadcrumb, unchanged Allied shell and accurate impact strip.                                                                   |
| Desktop composition      | Unequal 38/62 state/editor columns; contact pair and paired time/approval fields follow the spec.                                                                                |
| Policy meaning           | Effective, next scheduled and latest recorded remain distinct; actual records replace generated sample dates/history.                                                            |
| Contacts                 | Explicit search/paging, readable full selected identities and neutral recheck actions. Existing accessible search wording is retained.                                           |
| Calendar                 | Full weekday labels and 44px checkbox rows wrap safely; dates and times retain supported semantics. Confirmation starts unchecked.                                               |
| Approval                 | Required source/evidence, optional future Lagos time and exact Review policy label correct generated optional-field/copy errors.                                                 |
| Mobile                   | State then form; stacked selectors/times/metadata, readable dates/emails and full-width review action.                                                                           |
| Visual system            | Existing Quicksand, 30/24px page headings, 20px sections, 16px/48px inputs, visible borders, restrained red and 6px surfaces. Neutral impact treatment follows the written spec. |

No unresolved visual or interaction mismatch remains against the contract-corrected specification. Optional durable original-request lookup and deployed verification remain separate backend/release work.
