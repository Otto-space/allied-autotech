# W16D: managed Customer Care conversation integration

29 October 2026. Source continuation from master `2586c61b`; this checkpoint does
not establish publication or enable live chat. All Revision 4 requirements and the
106 exact-route acceptance decisions remain in scope.

## Implemented boundary

Responsibility-managed enquiry and complaint lists now disclose the shared
conversation queue and explicit availability controls to current Care viewers.
Queue links open the corresponding managed workspace and select the existing case.
Legacy queue consumers keep their existing destinations. A case's availability link
returns to its own workspace without losing its selected case or filters.

Rendered review also reproduced missing Customer column headers in both managed
tables, despite matching body cells. Headers and desktop widths now match every
cell, so values and Open actions line up. Mobile card presentation is retained.

Linked customer cases expose the existing reviewed channel controls only within
current same-branch Care viewing authority. Server-returned action eligibility is
still authoritative; no client position, role, assignment name or help article
grants live access. Unlinked cases retain their ordinary message workflow.

Background reads retain mounted case content, the unsent reply and typing focus.
Review/send stay locked during reads, failures, uncertainty and stale versions.
After a changed case, the customer-visible draft needs explicit adoption against
the current conversation before another review. Access denial or a changed access
projection removes private content and controls. Existing assignment, review,
reconciliation, audience and independent-action safeguards are retained.

New public updates offer an explicit jump. It preserves list filters and case
selection, clears obsolete message paging, and uses the existing message anchor.
It does not add a notification-read action. Ordinary replies and channel actions
continue to use their existing canonical APIs and receipts.

The server-owned Care article is version 3, dated 29 October. It explains the same
queue, explicit availability, current live duty, staffing/hours/capacity, retained
draft and uncertain-action boundaries. Existing view-only/public-only projections
remain in their original step positions. No real provider evaluation was run.

## Evidence and remaining acceptance

- Twelve focused component cases pass for both case types: draft/focus retention,
  stale-draft adoption, explicit-update URL context, denied/changed scope,
  unlinked cases, and managed versus legacy queue destinations.
- The final combined repeat passed 46 frontend contract, enquiry, complaint and
  component cases. Ten backend role-guidance unit cases pass. Frontend no-emit
  types and changed-file lint passed; backend changed-file lint/format passed.
- Twelve distinct rendered scenarios passed across the final 11-case run and a
  corrected one-case tablet repeat: six channel journeys at 390/768/1440px, two
  granular version-2 view-only cases, two existing separate assignment/draft cases
  and two existing assignment-revocation cases. The tablet repeat gives the initial
  session bootstrap 45 seconds on this loaded local machine; it previously timed
  out at 15 seconds. This is not a production performance measurement.
- Channel journeys verify the actual header/body column structure, reviewed claim,
  preserved focus/draft, stale-version review lock, explicit message navigation,
  no case or notification writes, overflow and Axe. Final screenshots were inspected.
  Early stylesheet-warning failures remain in separate trace directories. Known
  local fallback preloads require a successful same-origin CSS response and its
  exact fallback selector. A redundant timestamped development workforce preload
  requires the exact route asset, the workspace selector and applied border styles.
  Each is annotated. Other console warnings/errors still fail; this does not prove
  production or exact-lock warning acceptance.
- Browser plugin unavailable; existing Playwright/Edge is used. Reused local
  dependencies run Next 16.3.8, while the lock requests 16.4.3. Local browser
  results cannot satisfy exact-lock or hosted acceptance.

Screenshots, traces and browser artifacts stay outside Git under `%TEMP%`, named
`allied-w16d-*`. The preview uses loopback port 3171. Browser API responses and
writes are intercepted fixtures; no real support message, availability, inventory,
database, provider request or customer contact is created by these checks.

Owner coverage editing and approved staffing/hours, actual browser/API composition,
multi-instance/reconnect/load acceptance, source/release reconciliation and guarded
publication remain unfinished. AI/live flags stay off. The existing provider call
ceiling is exhausted and unchanged. No schema or migration changes are part of W16D.

## Release reconciliation

The read-only provider check at 03:43 UTC identified ACTIVE backend
`9c91eeff-b191-4de5-b9d5-0e6d06134d42`. Its four digests exactly match the other
authorized release worktree's immutable `2586c61b` manifest. That release's recorded
76-to-78 migration verification reports restricted runtime credentials, backup
read access, no changed grants and unchanged feature flags. W16D does not reapply
those migrations. Both frontend aliases were READY on `060dba8d` /
`dpl_AzXytZPjJgVb93kjfcb79KsuZtVH`. Preserve that newer fragment-navigation release
when integrating this batch. This paragraph records provider/receipt inspection,
not a new independent production database or restore execution by W16D.
