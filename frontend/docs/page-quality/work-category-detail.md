# Administrator category detail — local acceptance

Route `/admin/service-categories/[categoryId]`. Admin and Super Admin. Gate 55, 13 October 2026. The application-wide goal and deployed acceptance remain open.

## Changes and contract

The direct route previously returned the public 404. Three fresh [desktop/mobile/state concepts and the pre-implementation specification](work-category-detail-oct-concepts/spec.md) preceded implementation.

The new page presents the category name in its heading and breadcrumb, an ink visibility/URL-name summary, ruled record facts with Lagos timestamps, the complete description and conditional public-grouping guidance. A working link opens the administrator service catalogue filtered by category, including inactive categories. Catalogue names now link to their detail routes; existing inline editing remains available.

Reloadable `?view=edit` reuses the accepted four-field category editor and review dialog. Cancellation writes nothing. The existing revision check and atomic API update reject stale edits. Owner-scoped drafts and pending markers support explicit reconciliation after uncertain saves; no automatic replay occurs. Transient refresh failures preserve drafts and block writes. Denied/missing reads remove private content; malformed and mismatched direct responses fail closed. The shared dashboard suppresses its generic breadcrumb only for this detail route, leaving one named breadcrumb.

The existing [administrator category contract](../../../backend/docs/admin-service-categories.md) covers all required behavior. No backend endpoint, permission, schema or migration was added. Creation receipts remain optional ADM-05 work; this detail page does not add a creation workflow.

## Verification

- All 83 production-browser cases passed: 21 new category-detail cases, 19 category-list regressions, 20 service-detail regressions and 23 shared navigation cases. They cover direct reads outside the list page, navigation/history/reload, complete review and cancellation, a single versioned write, pre-save conflicts, committed/uncommitted uncertain saves, explicit recovery, denied/missing/malformed/mismatched responses, background failure, permission loss, inactive/null-description records, role boundaries and long-content accessibility at 320, 390, 768 and 1467px. Sidebar permissions, search, collapse, mobile navigation and short-height reachability also passed.
- Eighteen frontend unit cases passed: five category boundary/query/form, five resource-refresh and eight form-draft cases. Full frontend lint, TypeScript, production build and standalone asset preparation passed. The first unit command matched only the category file because two helper filenames were incorrect; the correct resource/draft filenames were then run and all 13 cases passed.
- All five changed production source hashes match the tested snapshot. The build includes the workspace's concurrent private-testing changes; these were preserved.
- Twenty-seven production captures passed overflow, Axe and page-error checks: 13 widths (320, 360, 375, 390, 430, 768, 844, 1024, 1280, 1440, 1467, 1505 and 1920px), including 844x390 landscape and 1467x1072 native desktop, plus loading, empty description/inactive, error, denied, missing, malformed, mismatch, stale, edit, validation, review, conflict, uncertain and long-content states. Console network errors occurred only for intentionally failed requests.
- Real production-browser/API/PostgreSQL checks passed: direct category beyond page one and reload, navigation to its actual filtered service list, cancellation with zero mutation/audit, one audited deactivation, preservation of the linked active service, stale-version 409, missing-CSRF 403, committed-response loss followed by reload and explicit recovery without a repeated PATCH/audit, and owner/Admin/Staff/Customer/anonymous boundaries. No browser page error occurred.

## Database safety evidence

A newly created isolated PostgreSQL 18 database, `allied_category_detail_20261013_test`, ran at `127.0.0.1:55440` in the existing isolated local test cluster. The helper verified the actual host, port, database and cluster data directory before creating it, then confirmed the exact test database before fixture writes. All 58 migrations replayed through the supported empty-database exception; `db:check` verified history/checksums/schema with no drift. No applied migration was edited.

A separate restricted runtime role performed application tests. Verification found no superuser, database/role creation, replication, bypass-RLS, schema CREATE, table TRUNCATE or owned relations. Provisioning granted only access to this new database; application/shared/staging/production data and existing grants were unchanged. Synthetic fixtures remain isolated and test sessions were cleaned up. No backup, restore rehearsal, off-device recovery verification or deployment was performed. These release prerequisites remain open.

## Final visual comparison

All three local concepts and final desktop, phone, long-content and review screenshots were inspected with the image viewer after the final build.

| Fidelity point | Final result and documented correction |
| --- | --- |
| Brand and shell | Actual Allied wordmark, existing permitted navigation and Quicksand preserved. Generated alternate brand lettering/header styling was excluded as specified. |
| Composition | Named breadcrumb and restrained title/actions precede the ink summary and approximately 1.8:1 record/guidance grid. Panels stack on narrower screens. |
| Summary | Equal desktop visibility/URL groups with dividing rule become two readable phone rows. Long slugs wrap without overflow. |
| Facts and description | Ruled name/created/updated rows, explicit Lagos labels and complete description. Phone labels stack to keep dates readable. Empty descriptions say Not provided. |
| Type and controls | Established compact 28/24px title, 18px section and 13px body scale, 44px controls and restrained corners replace oversized lettering and pill buttons from the generated state sheet. |
| Guidance and action | All three conditional grouping paragraphs appear with the real filtered-services link. No count, media or public-visibility claim is invented. |
| Editor and recovery | Existing bordered fields, complete four-field review, focus handling, cancellation, stale blocking and explicit interrupted-save actions remain intact. Review buttons stack cleanly on phones. |

Above-the-fold wording matches the specification. Synthetic QA names and dates illustrate actual API fields. No photography was introduced. No local visual blocker remains.

## Evidence and remaining work

Playwright with installed Edge provided browser automation and Axe scans because the browser plugin was unavailable. Private local evidence lives under `C:/Users/PC/.codex/`: `work-category-detail-before.png`, `work-category-detail-browser.log`, `work-category-detail-nav.log`, `work-category-detail-final-captures.json`, `work-category-detail-final-*.png`, `work-category-detail-source-hashes.json`, `work-category-detail-real.log`, `work-category-detail-migrations.log` and `work-category-detail-dbcheck.log`. The isolated build and its log are under the repository's ignored `.codex/work-category-detail-*` paths.

Deploy ADM-04 before this frontend and verify the target environment. Remaining backend implementation and release work is recorded in [Remaining Backend Work](../../../BACKEND_REMAINING_WORK.md). The next page audit is the administrator product catalogue `/admin/products`, currently served by the generic resource route; its detail flow remains a separate gate.
