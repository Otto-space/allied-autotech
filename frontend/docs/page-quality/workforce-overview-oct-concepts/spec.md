# Workforce overview design specification — milestone 103

Route: `/admin` for workforce-managed accounts, with the existing `/admin/workforce` overview alias. The legacy Admin/Super Admin overview remains a separate accepted surface.

The four native baselines at 430, 768, 1280 and 1440px were captured and inspected before runtime changes (`C:/Users/PC/.codex/workforce-overview-baseline-*`). Problems: inflated repeated metric/responsibility cards, large vertical gaps, generic counter descriptions, no branch names, no accountant work entry, unconstrained counter-name links and potentially stale counters after failed reads. Existing valid scopes, responsibility reasons and expiry information must remain.

Fresh complete desktop and mobile concepts were generated before implementation and copied here as `desktop.png` and `mobile.png`. Their briefing specifies the actual five supported counters, permitted finance entry without a counter, role-controlled navigation, actual account responsibilities and no operational mutations.

## Locked visual system

Quicksand UI throughout; 28px desktop/24px mobile title, 18–20px section headings, 14px readable body, 13px support text. Existing Allied shell/logo/search/icons remain. Ink `#01121A`, red `#E60301`, cool existing canvas, white regions, visible neutral borders, 6px radii, subtle panel shadow, 24px desktop region gap, 16px narrow padding, 44px minimum controls, red focus-visible outlines. No heading eyebrow, photography, invented counts or charts.

Exact title Operational overview; subtitle Current work across your active responsibilities. Single current Overview breadcrumb. Refresh overview and actual Lagos update timestamp align right on desktop, wrap below heading on narrow screens.

Main grid: approximately 60/40 flexible work-list/access rail, stacking below 1000px. Your work white section uses thin-rule-separated linked rows: line icon, title/subtitle, actual count and chevron. Jobs/Bookings/Order progress counters include all records in current scope; Enquiries/Complaints counters include only unresolved records. Payment records gets an authorized link with View records and no numeric total. Omitted permissions produce no work link. Zero counts are valid, distinct from unavailable reads.

Your access ink panel shows readable position, department when present, actual active responsibility and unique-branch counts and the note Access follows your current assignments. Personal notification/security links below remain account tools. Assignment-management link appears only when authorized, without making this page an access editor.

Active responsibilities spans the full width below. Desktop columns: Responsibility; Branch and scope; Coverage; Dates and reason. Native semantic table becomes labeled stacked rows below 760px, without horizontal scrolling. Show all reasons, primary/temporary status, start and optional expiry dates; missing expiry says No scheduled end. Branch names come only from the scoped backend response. Full-width note: Financial approvals and collection release require separate approved authority.

Concept corrections decided before runtime: retain actual shell brand and workforce icons rather than generated approximations; use Quicksand instead of generated fallback typography; temporary cover uses warm neutral, not the mobile image's red badge. Show accurate full Lagos dates including times instead of abbreviated synthetic dates. Render every actual assignment, not the mobile concept's two illustrative rows. Access-panel rows may stack on narrow screens to preserve readable role names. The exact familiar queue names and scope descriptions below are code-native. Existing mandatory lower-level permission checks remain.

## Data and states

Extend the existing overview response compatibly with its own current access snapshot and minimal scoped branch names in the same authorized transaction. Keep counts/generatedAt. The frontend requires those additions, a matching user, current access version and active assignment identity; unknown counter keys, mismatched owners or incomplete branch mappings must not render work links. No schema migration or new endpoint. Refresh checks access and overview; expired access still follows the shell's existing timer/revalidation.

Initial loading uses a compact status/skeleton. Foreground and background failures hide old operational counts and give retry; personal links remain. Denied/mismatched access never presents successful counters. No assignments has an explicit empty-state explanation; finance-only access has a meaningful permitted entry. Show stale update feedback, never silently present old totals as current. Preserve all current role isolation, MFA/session checks, private/no-store responses and READ audits.

Required gate: seven widths and accessibility, native concept comparison, all eight templates and combined coverage, zero/large/unknown counts, missing/foreign/mismatched access, failure/retry/background/expiry, long branch names/reasons, refresh and all links, existing workforce/legacy/notification regressions, units/API/connected evidence, static checks, production build and runtime hashes.

Implementation refinement: the main grid stacks at 1100px, rather than the initial 1000px, to preserve readable queue and access widths alongside the existing sidebar. Between 760px and 1100px the access and personal regions share a row; below 760px all regions stack. The final native comparison and seven-width accessibility checks verify this adjustment.
