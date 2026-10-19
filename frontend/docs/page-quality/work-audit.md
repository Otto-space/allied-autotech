# Audit log — local acceptance

Accepted locally on19 October2026. Route `/admin/audit`, milestone92. Application-wide and deployed acceptance remain open. Processing jobs `/admin/processing-jobs` is the next separate gate.

## Result

The former seven-field form and repeated large event panels now use a compact filter surface and ruled history. Action and record type remain visible; optional exact references and Lagos date bounds open on demand. Invalid hidden fields expand and receive focus. Explicit Apply/Clear preserve existing query semantics and in-page cursor history. Private references remain out of browser URLs.

Each event shows its action, record type, full business date and actor's current role. Event details expose secondary references, supported current-record links and the existing lazy Before/After JSON. Opening either disclosure sends no request. Recorded values remain escaped, keyboard-scrollable and explicit about selected-field limitations. Null, false, zero and empty strings retain their meaning.

Current administrator identity gates private reads. Strict validation checks safe DTOs, exact submitted scope, ordering, duplicate identities and cursor consistency. Session/access loss clears protected history. Loading, empty, rejected and retry states remain explicit; background failures label previously loaded data and block paging. The backend now rechecks the actor/session, reads the page and appends its minimal READ event in one transaction.

## Design comparison

Four baseline widths and fresh built-in ImageGen [desktop](work-audit-oct-concepts/desktop.png)/[mobile](work-audit-oct-concepts/mobile.png) concepts preceded runtime edits. The [baseline audit](work-audit-oct-concepts/audit.md), [specification](work-audit-oct-concepts/spec.md), [prompts](work-audit-oct-concepts/prompts.md) and [corrections](work-audit-oct-concepts/corrections.md) preserve the design gate.

| Area                 | Rendered comparison                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell and hierarchy  | Real Allied branding, navigation and Quicksand remain. One ordered semantic breadcrumb replaces the generic slash trail and redundant Back link. Compact heading and secondary Refresh follow the concept.                                       |
| Filter composition   | Action/Record type pair on desktop and tablet, stacking on mobile. Advanced references/date fields use one disclosure. Visible borders,48px fields and44px actions preserve the established form language.                                       |
| History density      | A loaded-page count and ruled rows replace repeated oversized detail sections. At1440 the first event begins around568px, and at430 around790px. Current-role wording avoids invented historical identity.                                       |
| Detail hierarchy     | Event details reveals a definition list and the separate Recorded values disclosure. There is one event expander, without the generated redundant title/chevrons. Actual UUIDs wrap safely; generated compact pseudo-references are not used.    |
| Desktop inspection   | At1280/1440, references and Before/After regions pair across the available width. Complete dates and each role label remain legible alongside Event details. Actual multiline JSON makes the expanded event taller than the abbreviated concept. |
| Mobile and tablet    | At430, Refresh wraps, dates and role facts take separate lines, references and JSON stack. At768, filters/references pair while JSON retains the existing stacked tablet behavior. No horizontal page scrolling occurs.                          |
| Supporting treatment | Pale-gray canvas, white form/history surfaces, restrained red Apply and slim read-audit notice follow the specification. Existing secondary buttons and literal JSON replace generated copy controls and syntax highlighting.                    |

Final production viewport captures at430/768/1280/1440 were inspected natively against both concepts. Supplemental full-page430/768 captures confirm the lower recorded-value panels and pagination. No page overflow or browser errors occurred. Evidence: `C:/Users/PC/.codex/work-audit-final-*-viewport.png` and `work-audit-final.json`.

## Verification

All19 production browser scenarios pass, alongside eight focused units, frontend/backend type checks and focused lint. The ten new browser scenarios cover seven widths320/375/430/768/1280/1440/1920,14 Axe WCAG2A/AA,2.1AA and2.2AA expanded-detail/filter states, exact combined scope and25+3 paging, hidden invalid-field focus and current-access denial. Nine adapted existing scenarios retain Staff/MFA denial, all supported enums, retry, one-sided Lagos dates,90-day validation, escaped literal JSON, keyboard scrolling, safe current-record links and session-change cleanup. Development and production reruns are not counted as separate scenarios.

Both new isolated API scenarios passed: strict safe/private DTOs, tied-time25+3 paging, combined exact scope, exact READ audits, invalid inputs and stale actor/session denial. Original business/audit rows remained hash-unchanged; new synthetic fixtures are retained. See the [backend contract and safety evidence](../../../backend/docs/audit-log-workspace.md).

Production build and standalone preparation pass. Eight runtime/dependency source hashes match the production snapshot. The endpoint/query/DTO/schema are unchanged, so existing OpenAPI/generated-contract and migration evidence were reused without regeneration or another replay.

## Connected verification

Production Next.js, Edge, the real Express API and isolated PostgreSQL verified initial history, all combined exact filters,25+3 tied-time pages, Previous, request-free disclosures and mobile refresh. Five collection requests produced exactly five minimal READ audits. The page sent zero domain mutation requests, exposed no private URL filters and had no page errors or mobile overflow.

Whole-row hashes confirmed unchanged58 users,7 customer profiles,52 staff profiles,38 branches,18 invitations,13 outbox events,1 capability grant,14 workforce-access rows,16 assignments and all305 original audit rows. One owned temporary session was removed and its remaining count verified as zero. Connected evidence is `C:/Users/PC/.codex/work-audit-real.json`; build/hash/API artifacts share the `work-audit-` prefix.

## Files and remaining scope

Runtime files: `app/admin/audit/page.tsx`, new `app/admin/audit/audit.css`, `app/components/audit-log.tsx`, `app/components/dashboard-shell.tsx`, new `lib/admin/work-audit.ts`, and backend `audit.repository.ts`/`audit.service.ts`. Focused fixture/browser/unit/API tests and these design/verification records accompany the changes. `AuditValues`, filter constraints and current-record mapping are reused.

No new endpoint or storage capability is required for this page. No application/shared database, schema/migration, existing grant, backup/restore, off-device recovery verification, external provider, push or deployment operation ran. Actual isolated target/environment and non-elevated runtime flags were reconfirmed before test writes. Milestone89 migration/ownership/schema/TRUNCATE evidence remains applicable. Processing jobs, remaining Super Admin policies, broader role regression and deployed verification remain in the active full goal.
