# Complaint policy — local acceptance, milestone 94

Accepted locally on 19 October 2026 for `/admin/complaint-policy`. The full application goal remains active. Next separate page: `/admin/dispute-policy`.

## Result

Current effective policy, next scheduled change and latest recorded version now have separate meanings. An authoritative backend read selects current/next independently of the bounded history. Desktop pairs current facts/history with the approval form; narrow screens put state before the form. Current Super Admin profile checks gate private data and publication.

Contact search uses the existing staff query and cursor contract, preserves selection across pages and verifies the selected account. Fixed ordinary/urgent targets remain explanatory text. Classifications and holidays pair on desktop and stack on phones. Calendar confirmation, effective time and written approval are explicit; sources/evidence start empty for a new version.

Refresh retains mounted drafts and their original base version. Saved context preserves that base across reload. A newer version blocks review until an explicit action-field reload, which also clears persisted fields. A confirmed receipt remains authoritative for the form's base if the following refresh fails; publication stays disabled until fresh state is available.

Fresh profile/version/contact checks precede publication. Strict receipt validation checks actor, Q11 provenance, exact settings, metadata and effective time. Minimal actor-bound uncertainty storage survives reload. Recovery requires authorized inspection and independent reconciliation; a stale draft then requires explicit reload. It never resends publication or treats current state as proof of the original outcome.

Shared changes are limited to opt-in contact search/readable selected identity, refresh eligibility protection, recovery redaction and the route breadcrumb. Dispute/retention defaults remain intact. No dependency, schema or migration was added. See [backend contract](../../../backend/docs/complaint-policy-workspace.md).

## Design comparison

[Audit](work-complaint-policy-oct-concepts/audit.md), [specification](work-complaint-policy-oct-concepts/spec.md), [corrections](work-complaint-policy-oct-concepts/corrections.md) and [prompts](work-complaint-policy-oct-concepts/prompts.md) precede runtime edits. Fresh built-in ImageGen [desktop](work-complaint-policy-oct-concepts/desktop.png), [mobile overview](work-complaint-policy-oct-concepts/mobile-overview.png) and [mobile form](work-complaint-policy-oct-concepts/mobile-form.png) concepts are retained. The corrected mobile form supersedes unsupported editable targets in the overview.

Four native baselines and final production captures were inspected at 430, 768, 1280 and 1440 pixels, plus the full desktop page and a phone form viewport. Final metadata records no overflow or page errors at all four widths.

| Comparison point    | Final implementation                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hierarchy           | Compact heading/Refresh, semantic breadcrumb and slim effective-time notice.                                                                                                      |
| Desktop composition | Approximately 38/62 state/form columns, retaining the unequal split and adjacent operational context.                                                                             |
| Policy meaning      | Separate current, scheduled and latest versions; server check time; honest incomplete/draft history.                                                                              |
| Contact workflow    | Real search/paging, retained selection, full readable identity and neutral secondary actions.                                                                                     |
| Form anatomy        | Three semantic groups, visible borders, paired desktop fields, full-width evidence and explicit calendar confirmation.                                                            |
| History             | Native outer/per-version disclosures retain settings, dates, source and evidence without expanding everything.                                                                    |
| Mobile/tablet       | Single-column state then form, wrapping dates/emails, labels above fields, 48px inputs and accessible paging; no horizontal page scrolling.                                       |
| Brand/accessibility | Existing Allied shell/Quicksand, restrained red review action, keyboard review/focus behavior and readable contrast; generated decorative steps and unsupported controls omitted. |

Evidence: `C:/Users/PC/.codex/work-complaint-policy-baseline-*`, `work-complaint-policy-final-*` and `work-complaint-policy-source-hashes.json` (16 matching runtime files).

## Verification

- **25 distinct production browser scenarios:** 22 dedicated complaint cases plus the complaint/dispute/retention owner workflows. The final focused run passed 14/14 after the final display/CSS fixes; unchanged passing checks were reused. All 29 operational-policy regression cases have passing evidence across development/production, giving 51 distinct browser cases across both files.
- **Seven widths:** 320, 375, 430, 768, 1280, 1440 and 1920. Fourteen final Axe scans cover current/history/form and review at every width. Empty/error/denied states also passed Axe. Tests cover contact search/paging, stale profile/contact/version, draft preservation/reset/reload, invalid data, receipt mismatch, storage failure, uncertainty recovery and role denial.
- **Five frontend units:** independent current selection, contradictory envelopes, exact receipt provenance/settings and minimal actor-bound recovery storage/failure/redaction.
- **Six isolated API scenarios:** effective current outside 100-version history; private audited reads; role/MFA/query/CSRF boundaries; revoked-session read/publication checks; stale version/contact rejection; exact publication/duplicate rejection; concurrent authenticated reads. Passing evidence spans the original run and focused continuations.
- **Static/build:** frontend/backend type checks, targeted frontend lint, backend lint, affected-file formatting, OpenAPI validation (307 paths), mounted coverage (361 operations plus four infrastructure routes), generated declarations, production build/standalone packaging and 16 source hashes.

Logs/artifacts under the Codex evidence directory: `work-complaint-policy-production-tests`, `work-complaint-policy-final-tests`, `work-complaint-policy-api-tests.log`, `work-complaint-policy-api-continuation.log`, `work-complaint-policy-api-concurrent.log`, `work-complaint-policy-api-preservation.json`, `work-complaint-policy-build.log` and `work-complaint-policy-real.json`.

## Findings and corrections

Product fixes found during verification: breadcrumb contrast; clearing persisted fields on explicit reload; preserving the draft base across reload; preventing an older draft-base offer after a confirmed approval/failed refresh; and bounded retry of database-aborted read transactions when authenticated requests touch the same session concurrently. Four concurrent-read rounds returned twelve successful responses with exactly eight policy READ audits and no publication.

Harness corrections: the contact fixture cursor now follows the UUID contract; audit queries use persisted `userId`; strict-query rejection expects 422. The original API publication and duplicate rejection had already occurred, so continuation inspected the retained version without another publication. Overlapping Playwright output directories caused trace-artifact failures, and simultaneous browser processes caused a cold navigation/capture timeout. Final runs used dedicated output directories and sequential browser processes. Failed attempts are not counted as passing evidence.

## Connected verification and safety

Production Edge/Express/PostgreSQL completed two future approvals with exactly two publication audits. The first receipt succeeded before refresh failed; the saved row/audit were verified without replay. The second response was deliberately lost after commit. Reload retained the lock; inspection, independent reconciliation and explicit draft reload restored a valid form without another publication. Five continuation current-policy requests matched five READ audits by request ID. No page errors occurred.

Actual target verified before writes: `127.0.0.1:55480/allied_work_staff_workforce_20261019_test`, environment `test`, restricted runtime credentials. API preservation covered 59 users, 52 staff profiles, 13 policy versions, 375 audit rows, 38 branches and empty complaint/payment/invoice/refund tables. Connected verification preserved all 116 policy versions present at its starting boundary, 60 users, 53 staff profiles and empty complaint/financial tables. Original hashes matched, the effective current policy stayed unchanged during the future approvals, and zero temporary sessions remained. Synthetic fixtures are retained.

No application/shared database, schema/migration, existing grant, worker/provider, backup/restore, push or deployment operation ran. Unchanged migration replay and runtime privilege evidence from the workforce gate were reused; no new restore rehearsal is claimed. Synthetic approvals do not constitute business approval. Deployed verification, off-device recovery evidence and application-wide regression remain separate.

ADM-62 is implemented locally. ADM-63 records optional durable original-request publication receipts; the current reconciliation UI does not provide such a receipt.

## Breadcrumb requirement follow-up

The next objective audit caught a missed explicit requirement: the breadcrumb lacked an ordered list and the project chevron. The route now uses an ordered list, Lucide ChevronRight, current-page semantics and a 44px Overview target. A rebuilt production run passed all seven responsive/current-review accessibility cases (14 Axe scans), four native captures and 16 refreshed source hashes. Phone and desktop screenshots were inspected. Approval/backend checks remain applicable; no mutation was repeated. Evidence: `work-complaint-policy-breadcrumb-tests` and the refreshed final/build/hash artifacts.
