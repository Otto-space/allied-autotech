# Managed workforce operational overview — milestone 103

Status: locally accepted on 19 October 2026. Route `/admin` for workforce-managed accounts, with `/admin/workforce` as its existing overview alias. The full application goal remains active.

## Outcome and scope

The overview replaces repeated oversized metric/responsibility cards with compact permitted-work rows, a dark access summary, personal account links and a complete responsibility table. The accountant has a meaningful Payment records destination without an invented count. Branch names, assignment coverage, reasons and precise Lagos dates remain visible. A single current-page breadcrumb and refresh control work across mobile and desktop. Legacy Admin/Super Admin overview behavior remains separate.

The existing overview endpoint adds its own access snapshot and minimal assigned branch names; the client verifies actor, access revision, active assignment IDs, privileges and complete branch/counter projections. Loading, failed refresh and mismatched access hide operational facts and destinations. Revoked or expired assignments remove work while personal account tools remain available. No operational mutation is introduced. See the [backend contract](../../../backend/docs/workforce-overview-workspace.md).

## Design evidence

Four native baselines at 430, 768, 1280 and 1440px preceded implementation. Fresh complete desktop/mobile concepts and the [pre-implementation specification](workforce-overview-oct-concepts/spec.md) define the page. Browser plugin not available; sequential Playwright with Edge used the local production build at `http://localhost:3070`.

| Comparison             | Implementation and intentional adjustment                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Information hierarchy  | Overview breadcrumb, compact Operational overview heading, work/access regions and full-width responsibilities preserve the concept hierarchy.                                                                     |
| Desktop composition    | Approximately 60/40 work/access grid and a separate personal-tools region. Native shell/sidebar/logo remain the actual application assets.                                                                         |
| Typography             | Quicksand, 28px desktop/24px mobile title and compact readable labels replace generated fallback typography.                                                                                                       |
| Palette and boundaries | Ink access panel, cool canvas, white work surfaces, restrained red focus and visible neutral borders. Warm temporary-coverage badges follow the desktop specification.                                             |
| Queue spacing          | Native inspection caught a more-specific list reset overriding horizontal padding; the final CSS separates selectors so icons and rules align with inset panel content.                                            |
| Responsibility layout  | Full desktop table; mobile labeled stacked assignments. Inherited cell shading/dividers were removed to match the concept's clearer row grouping.                                                                  |
| Responsive behavior    | Main grid stacks at 1100px to accommodate the existing sidebar; the access/tools rail stacks fully below 760px. All three actual assignments remain visible instead of the mobile concept's two illustrative rows. |
| Real information       | Full Lagos start/end times, actual branch names, explicit primary/temporary coverage and full reasons replace illustrative abbreviated data. Finance retains a link without a fabricated total.                    |

## Functional and integration evidence

- 27 distinct overview browser cases have passing evidence across the initial, focused and expiry runs: seven widths, eight responsibility templates, managed Admin access, zero/large counters, initial/loading/denied/error/retry/background states, access-version mismatch, unknown counter rejection, no assignments, long names/reasons at 320px, alias breadcrumb, revocation and automatic temporary-assignment expiry.
- Nine focused existing regressions pass: five workforce access/navigation/technical-update cases, notification/review at 430 and 1440px, and legacy Admin/Super Admin overview monitoring.
- Seven projection/scope unit cases and five isolated API/database scenarios pass. The API suite covers nine managed identities, finance-only and revoked access, weak MFA/suspended/customer/legacy denials and forged queries. Eleven successful overview reads produced eleven READ audits.
- Connected production Edge → Express → PostgreSQL verifies Operations, Accountant and a revoked technician, actual branch/counter rendering, refresh and bookings/payment queue navigation. Six overview reads and two queue reads produced eight READ audits. No business mutation was sent. Original hashes across 15 domain tables remained unchanged and all owned temporary sessions were removed.
- Backend type/lint and OpenAPI export/validation/route coverage passed (313 paths, 367 operations); frontend generated types and inventory were updated. Frontend type/lint/format checks pass. The final CSS production build and standalone preparation both exited zero. Seven frontend runtime/generated-contract files exactly match the tested build; this is not a claim that the entire worktree or unrelated proxy/config files match.
- The final CSS refinement passed nine focused browser checks: all seven viewport/accessibility cases, long labels at 320px and a maximum safe integer count at 360px. These repeat existing scenarios after the visual correction and are not counted as additional distinct cases. Eight overview accessibility states have passing evidence overall: seven widths plus denied access.
- A focused link check clicked all four Operations work rows and verified their destination headings and corresponding queue requests. The accountant's payment destination was verified against the real backend; technician navigation and technical updates pass the existing workforce regression. Personal notifications navigation and the overview alias also pass.

| Final rendered check             | Evidence                                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and meaningful content  | Correct `/admin` URL, Administration title, overview heading and responsibilities at all four native widths.                                                         |
| Framework and console health     | No error overlay observed; final captures recorded no page errors or console errors.                                                                                 |
| Layout and screenshot comparison | No horizontal overflow; 430, 768, 1280 and 1440px screenshots plus the mobile responsibility region inspected against both local concepts after the final CSS build. |
| Interaction                      | Refresh updates current data; failures hide facts; expiry removes queues; permitted links navigate and request scoped records.                                       |

Initial browser failures exposed dark-panel paragraph contrast and overly broad test alert locators matching Next.js's route announcer. The CSS was corrected and assertions scoped to the main region; all affected cases passed. The connected harness initially counted own-access requests as audited reads. Inspection confirmed that endpoint does not emit a READ audit; the expectation was corrected and the read-only flows repeated. These were harness corrections, not disabled assertions or permission changes.

## Data safety and evidence locations

Actual isolated target verified before writes: `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`. Runtime verified non-elevated, without database/table ownership or TRUNCATE. Test writes were temporary authentication sessions and normal read audits. Existing accounts, staff profiles, branches, assignments, bookings, orders, enquiries, complaints and all 652 policy versions were preserved. Connected checks additionally preserved notifications/preferences and financial tables; the financial tables were empty, so this does not prove populated financial preservation.

External artifacts under `C:/Users/PC/.codex/`: `workforce-overview-baseline-*`, `workforce-overview-final-*`, `workforce-overview-real-{0,4,7}.png`, `workforce-overview-real.json`, `workforce-overview-api-tests.log`, `workforce-overview-api-evidence.json`, `workforce-overview-e2e-results`, `workforce-overview-e2e-focused-results`, `workforce-overview-regression-results`, `workforce-overview-e2e-final-results`, `workforce-overview-links.json` and `workforce-overview-source-hashes.json`. Initial failed artifacts are retained for traceability. Build output is appended to the existing `work-reservation-build.log`.

No application/shared database, existing grant, schema/migration, provider activation, backup/restore rehearsal, push or deployment changed. Prior 60-migration replay/db-check evidence is reused for this schema-free change. Release the compatible backend before the frontend and verify the deployed environment separately.

## Next work and limits

The next page is the managed-workforce jobs queue, followed individually by its detail and the other operational queues. Owner decision checklist consolidation, application-wide role regression and deployed acceptance remain open. Local Edge/Playwright evidence does not establish Safari, Firefox, physical-device or deployed-environment acceptance.
