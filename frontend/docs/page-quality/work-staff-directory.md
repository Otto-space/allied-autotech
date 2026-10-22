# Staff directory — local acceptance

Accepted locally on 18 October 2026, milestone 88. Route: `/admin/staff`. Next separate page: staff account detail `/admin/staff/[staffUserId]`. Application-wide and deployed acceptance remain open.

## Result

The directory now provides explicit name/email search, role/status/branch filters and compact ruled staff records. Search, filters and cursor history survive reload and browser navigation. Records distinguish role, account status, inactive or unassigned branch, verified email and the current account. Only the loaded page count is shown. The existing Allied shell, Quicksand, branch picker, feedback and account navigation are reused.

Current active Admin/Super Admin identity is checked before directory requests. Recoverable refresh failure labels retained records and disables paging; access loss clears records and account links. Invalid URLs, empty results, missing profiles and long identities have explicit handling. Account editing and invitation workflows retain separate gates. See the [backend contract](../../../backend/docs/staff-directory-workspace.md) and root gap ADM-53.

## Design and fidelity

Four baseline widths preceded fresh built-in ImageGen [desktop](work-staff-directory-oct-concepts/desktop.png) and [mobile](work-staff-directory-oct-concepts/mobile.png) concepts. Native inspection and the [audit](work-staff-directory-oct-concepts/audit.md), [specification](work-staff-directory-oct-concepts/spec.md), [prompts](work-staff-directory-oct-concepts/prompts.md) and [corrections](work-staff-directory-oct-concepts/corrections.md) preceded implementation.

| Comparison            | Rendered evidence                                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and hierarchy   | Real Allied navigation and breadcrumb; directory search remains distinct from shell page search. Promotions/invitations uses the existing destination.                                              |
| Typography and bounds | Quicksand, 30 px desktop/24 px mobile heading and 14px body. At 1440: x 292, width 1112; at 430: x 16, width 398.                                                                                   |
| Filters               | Four desktop columns with 16px gaps; mobile paired role/status and full-width search/branch. Filter region 174 px desktop and 344 px mobile.                                                        |
| Controls              | Search and selects 48px high,16px text, visible borders. Refresh and Clear filters share one mobile row. Account links have 44px minimum height.                                                    |
| Records               | Six desktop columns, first record about 96px high; mobile paired labelled facts, first record about 274px. Job title stays under identity, separate from account role.                              |
| Responsive detail     | Long identity/branch content wraps without hiding facts. Inactive branch remains distinct from account status. Email fallback supports absent profiles.                                             |
| States and focus      | Native final 1440/430 captures and earlier 768/1280 captures inspected, plus long-content, stale and access-error states. Keyboard search focuses results; clearing also discards unsubmitted text. |

## Verification

- 21 final production browser cases passed:20 new cases plus one adapted legacy directory regression. Seven widths 320/375/430/768/1280/1440/1920 cover responsive layout and accessibility.
- Three frontend unit tests and two backend API/database cases passed. API coverage includes case-insensitive full-name/email search, literal wildcard characters, combined filters,25+3 paging, safe fields, minimal audits, role denial, query validation and preservation of existing account data.
- Axe checks passed at seven responsive widths, initial error/denied/empty states and six additional mobile states: filtered, invalid, stale, long content, self and access error. Final four-width captures recorded no overflow, page errors or mutation requests.
- Production build, frontend/backend types, focused lint/formatting, OpenAPI export and generated types passed. Route coverage remains 304 paths/358 documented operations plus four infrastructure routes.
- Connected production Edge/API/PostgreSQL verified 25+3 server paging, reload/Previous, uppercase full-name search with role/status/branch, real account-detail navigation and Back restoring filters. Eight directory reads matched eight READ audits. Zero UI mutation requests or page errors occurred. Hashes preserved 470 users,317 staff profiles,47 capability grants and 122 branches; zero owned temporary sessions remained.

The initial connected attempt stopped on an ambiguous test selector because both branch and staff pagination expose Next. The helper was scoped to Staff directory pages and the read-only scenario passed without recreating fixtures. A development assertion was also scoped to the page instead of the permitted shell navigation. No application changes were needed for either selector correction.

Evidence under `C:/Users/PC/.codex/` uses the `work-staff-directory-` prefix: baseline/final/state captures, measurements, production results, API log, connected result and source hashes.

All nine tracked frontend runtime, contract and test source hashes match the final production snapshot. Documentation-only changes followed verification; no additional runtime build or database fixture run was needed.

## Limits and data safety

The actual isolated target 127.0.0.1:55480 / allied_work_aftercare_20261017_test was verified before writes, using restricted runtime credentials. Twenty-eight synthetic accounts/profiles are retained; connected writes were limited to owned temporary sessions and normal successful-read audits. No application/shared database, schema/migration, existing grant change, backup/restore rehearsal, external provider, push or deployment operation ran. Unchanged 60-migration evidence was reused. Search is bounded per response; large-directory performance has not been load-tested. The full goal remains active.
