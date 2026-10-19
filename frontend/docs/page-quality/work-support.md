# Workshop support queue

Locally accepted 18 October 2026, milestone 76. Route `/admin/support`.
Staff conversation detail is a separate gate.

## Result

One Customer care breadcrumb/header, labelled enquiry/complaint categories, grouped
filters and complete named records replace the sparse queue. Supported status,
type/priority, administrator branch and assignee filters apply explicitly. Category,
filter and cursor history survive reload/Back; category changes reset incompatible
state. Counts describe this page only. No text search, aggregate totals, live-agent
availability or list mutation is invented.

Active own-profile identity gates private reads. Staff require a current branch;
foreign branch links stop before reads, and foreign returned Staff scope clears
protected data. Strict bounded/unique pages, dates, associations and filter matches
fail closed. Temporary refresh failure retains labelled records with paging blocked;
denial clears contacts. Branch/staff picker failure stays independent of the queue,
and off-page assignees retain their reference. Branch changes clear the assignee
draft. StaffPicker's optional label/required props preserve existing form defaults;
the filter uses All staff without requiring an assignee.

Grouped records retain full subject/reference/version, status/type/priority,
branch/assignment, permitted contact/customer reference and exact creation/update/
lifecycle/complaint acknowledgement dates. Message previews are labelled; the subject
link opens the full conversation. Complaint contact name/email now accept actual
nullable backend fields when a customer is linked, displaying Not recorded. Enquiry
contact requirements remain unchanged. This is a frontend projection correction;
no backend endpoint, request contract or schema change was needed. See
[API/privacy boundaries](../../../backend/docs/workshop-support-discovery.md).

## Concepts and fidelity

Fresh built-in Image Gen [desktop](work-support-oct-concepts/desktop.png) and
[mobile](work-support-oct-concepts/mobile.png) concepts were viewed before UI edits.
[Audit](work-support-oct-concepts/audit.md),
[specification](work-support-oct-concepts/spec.md) and exact
[prompts](work-support-oct-concepts/prompts.md) are saved. No generated image is
embedded in the application. Browser plugin tools were unavailable; production
Next.js, Playwright/Edge, Axe and native `view_image` comparisons were used.

Native concept/final comparisons use **1486x1058 desktop** and **921x1708 mobile
reference**. The wide generated phone canvas differs from the existing sidebar
breakpoint at 921px; actual 320/375/430px checks independently verify the intended
single-column mobile flow. Viewport captures judge shell placement; full-page
images show record continuation.

| Area             | Final disposition                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition      | Named header, category controls, one grouped filter panel, page-local band and complete cards follow the references with actual Allied navigation/logo/account controls.         |
| Typography       | Computed Quicksand, 30px wide/24px narrower title, 16px record subjects and 13px body/labels retain dashboard hierarchy.                                                         |
| Surfaces         | Cool canvas, white 12px cards, subtle rules and restrained red actions/selected category replace arbitrary generated badge/link colors with the established theme.               |
| Facts            | Real full UUIDs, numeric versions, full authorized contact values and exact Lagos timestamps replace generated CUST codes, masked samples and date-only examples.                |
| Records/mobile   | Three desktop groups reflow into tablet pairs and complete mobile paired labels/values. Long subject/contact/reference/preview text wraps without page overflow.                 |
| Preview/actions  | One >=44px subject link opens the conversation. A labelled abbreviated preview replaces duplicate generated View conversation links; management remains in detail.               |
| State/count copy | Previous/First page/Next and records on this page replace generated numbered/total-page navigation. Recorded acknowledgement/escalation dates do not claim a response guarantee. |

Copy retains **Customer care**, **Enquiries**, **Complaints**, **Record status**,
**Complaint priority**, **Branch filter**, **Assigned staff filter**, **Apply support
filters**, **Clear support filters** and **Refresh support records**. Empty values
use **Unassigned**, **Not recorded** or **Unassigned branch**, without false booleans
or invented agent availability.

## Verification

- **28 distinct production browser cases passed:** 24 new queue cases and four
  existing history/privacy, administrator-filter, Staff-picker and long-thread
  regressions. The legacy administrator fixture now returns its actual own identity,
  role/capabilities and matching filtered records. Tests explicitly wait for URL
  commitment before reload/Back when applying a filter does not change row count.
- **Five focused units** passed for supported kind-specific queries, Staff scope,
  cursor trails, complete/null contact projections, association/filter consistency
  and malformed/duplicate pages.
- **Three isolated API/database scenarios** passed for both 25+3 collections,
  exact dates/private projections/null owned-complaint contact, combined filters/
  assignment, current Staff reassignment, private headers, read audits and anonymous/
  Customer/unverified-MFA/unsupported-query rejection. Fixture corrections respected
  existing session-MFA and complaint-contact constraints; no constraint was weakened.
- Frontend/backend type checks, focused ESLint/oxlint, formatting and production
  build passed. **16 exact source/dependency hashes** match the tested build.
  Functional and visual corrections were checked in the development snapshot before
  the single final production build.
- **18 final Axe scans:** seven widths 320/375/430/768/1024/1440/1920 and 11 native/
  state captures. No page overflow/captured errors. States include Staff, empty,
  outage, own-profile error, invalid link, long text, picker outage and null contact.
- Connected production Edge/Express/PostgreSQL verified **25+3 paging/reload/Back**,
  complaint filters/recorded acknowledgement date, named conversation/return,
  Staff reassignment clearing old facts and Customer/anonymous denial. Full owned
  enquiry/complaint row hashes stayed unchanged with **zero domain mutation
  requests**. The test administrator has 13 privacy READ audits, including the first
  interrupted harness read. A selector was scoped to Support records pages to
  distinguish it from Branch choices pages; continuation reused the original 28+28
  support fixtures rather than creating them again.

## Safety and remaining scope

Actual **127.0.0.1:55480 / allied_work_aftercare_20261017_test**, isolated-test
environment and existing restricted runtime credentials were verified before fixture
writes. Synthetic support records remain; only owned sessions were removed. No
application/shared database, schema, migration, grant, backup/restore, push or
deployment change occurred. Unchanged 59-migration replay/db:check/privilege evidence
was reused. No new backend implementation gap was identified.

Conversation detail `/admin/support/[kind]/[supportId]` is next. Policy, provider
delivery, privacy review, moderation, finance and deployed/application-wide acceptance
remain separate. The overall goal remains active.

Evidence: `C:/Users/PC/.codex/work-support-` production browser/legacy/API/build/
real-resume logs, real/captures/source-hashes JSON and final PNGs. Development logs
retain targeted correction evidence. Temporary harnesses remain outside the repo.
