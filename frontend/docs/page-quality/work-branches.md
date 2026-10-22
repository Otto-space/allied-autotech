# Branch management — local acceptance

Accepted locally on 19 October 2026, milestone91. Route `/admin/branches`. The dedicated workspace replaces the generic resource rendering on this existing route. Application-wide and deployed acceptance remain open. Audit logs are the next separate gate.

## Result

The page now provides a searchable branch directory, active-status filtering, URL-preserved cursor history and selection, and a grouped editor. Branch name/code/location/contact/status are readable without a horizontally clipped action column. The editor fetches the selected branch directly, even when it is outside the current list page. Creation opens on demand. Country and appointment timezone follow the actual API contract; optional contacts can be cleared explicitly. The supplied Stadium Road landmark remains beside Kilimanjaro.

Current administrator identity gates private reads. Review shows every changed field, including explicit contact clearing and active/inactive status. Actor and record preflight, a server revision condition and exact receipt validation protect saves. Stale data retains the draft until the operator explicitly loads current details. A navigation transition guard preserves filters when pagination follows a filter change immediately.

Uncertain saves persist a minimal actor-bound lock across reload. Creation recovery uses the public branch code; update recovery uses the branch UUID. No address/contact/request body is stored in that marker. Fresh inspection and independent reconciliation are required before unlocking, and the original request is never replayed automatically. Unavailable storage prevents submission. This does not establish durable original-request receipts or cross-device idempotency.

## Design comparison

Four baseline widths and fresh built-in ImageGen [desktop](work-branches-oct-concepts/desktop.png)/[mobile](work-branches-oct-concepts/mobile.png) concepts preceded runtime edits. The [audit](work-branches-oct-concepts/audit.md), [specification](work-branches-oct-concepts/spec.md), [prompts](work-branches-oct-concepts/prompts.md) and [corrections](work-branches-oct-concepts/corrections.md) record the design gate.

| Area                    | Rendered comparison                                                                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and hierarchy     | Actual Allied wordmark, navigation, account facts and Quicksand remain. One semantic ordered breadcrumb replaces generic slash text. Generated avatar/operator facts are omitted.                                |
| Desktop composition     | Search/status/refresh align above ruled records and a larger grouped editor. A red leading rule identifies the selected record. The unselected directory uses the available width without an empty editor panel. |
| Mobile and tablet       | At430, fields stack inside16px page margins. At768, the editor pairs fields while hiding the directory/filter region behind Back to branch list. Closing restores the same URL filters and page.                 |
| Typography and controls | Compact30px/24px headings,14px interface copy,16px input text,48px fields and44px primary action targets preserve readable borders and visible focus. Long workshop names wrap rather than clip.                 |
| Field grouping          | Identity, location, public contact and active status follow the concept. City/state/timezone remain supported text fields instead of fabricated dropdown options. Country is read-only Nigeria.                  |
| Record density          | Ruled rows show useful actual contact/location facts, semantic status and loaded-page count. This is deliberately taller than the concept's abbreviated rows. No staff totals or unsupported metrics appear.     |
| Supporting information  | Active-staff deactivation guidance remains visible. Actual references and timestamps sit in the record disclosure; no invented Updated by identity is displayed. Mobile form actions stack.                      |

Final production selected-editor captures430/768/1280/1440 were inspected natively against the concepts and specification. They show no page overflow or page errors. Viewport captures are `C:/Users/PC/.codex/work-branches-final-*-viewport.png`. Full-page images are supplementary, not the basis for native fidelity claims.

## Verification completed

All20 production browser scenarios and six units pass. Coverage includes validation/normalization, changed-field requests, exact scope/paging/mutation receipts, persistent recovery identity/redaction/storage behavior, selection/reload/Back, filter/paging races, creation/update, stale actor/target, rejected deactivation, lost/malformed responses, unavailable storage, exact-code creation recovery and temporary/denied reads. Axe WCAG2A/AA,2.1AA and2.2AA checks pass on the directory at320/375/430/768/1280/1440/1920 and selected editor at430/1440. Development reruns are not counted again.

Four isolated API scenarios have passing evidence. Search/revision cases passed initially; two affected cases passed a focused continuation after correcting test-only public-route and validation-status assumptions. Retained synthetic fixtures were reused. Original55 users and33 branches, related profiles, invitations, outbox, grants and workforce records remained hash-unchanged. No existing application data was reset. See [backend contract and evidence](../../../backend/docs/branch-management-workspace.md).

Frontend/backend type checks, focused lint and OpenAPI export/validation/coverage pass:305 paths,359 operations plus four infrastructure routes. Generated declarations reflect the actual contract. Production build and standalone preparation pass. Eight runtime/generated source hashes match the production snapshot.

## Connected verification

Production Next.js, Edge, the real Express API and isolated PostgreSQL completed five domain writes on one new synthetic branch: creation, name/contact update, deactivation, reactivation and an update whose committed response was deliberately lost. Public read returned404 while inactive and200 after reactivation. Exact persisted fields and five mutation audits were checked.

At430, reload retained the uncertain-result lock. Fresh inspection and independent audit reconciliation unlocked the editor without replaying the committed update. The complete run sent exactly five domain requests, had no browser errors and no mobile overflow.

Whole-row hashes confirmed unchanged original57 users,7 customer profiles,52 staff profiles,37 branches,18 invitations,13 outbox events,1 capability grant,14 workforce-access rows and16 assignments. The one owned temporary session was removed and its remaining count was verified as zero. The new synthetic branch is retained. Evidence is under `C:/Users/PC/.codex/work-branches-{real,final,source-hashes,build,api-tests,api-continuation}*`.

## Limits

ADM-57 is implemented locally; ADM-58 records the optional durable branch-request receipt improvement. No schema/migration, existing grant, application/shared database, backup/restore, off-device recovery verification, external provider, push or deployment operation has run for this milestone. The retained isolated database's migration and runtime-privilege checks come from milestone89; current write phases reconfirmed the actual target/environment and non-elevated role. Audit logs, processing jobs, remaining owner policies, role regression and deployed acceptance remain in the overall active goal.
