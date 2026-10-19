# Workshop staff conversation — gate 77

Routes `/admin/support/enquiries/[supportId]` and
`/admin/support/complaints/[supportId]` share the conversation template. Queue gate76
is separate. Reviewed 18 October 2026.

## Implemented behavior

The named breadcrumb/header, status/classification, section links, grouped handling
and contact facts, full original text and asymmetric history/management workspace
reuse the accepted workshop shell. Full references, version and precise Lagos
timestamps remain visible. Null contact values and guest/no-account follow-up use
factual guidance; no generated address or invented agent identity is displayed.

Dedicated oldest-first history has independent refresh, 50-record pages and URL
cursor/Back state. It does not render the capped embedded detail messages. Internal
staff notes use an amber surface and explicit visibility labels. History failures
remain distinct from empty history; denied summary, history or reconciliation clears
the protected conversation. Active own role/profile/branch gates private requests.

One parent review/single-flight guard coordinates assignment/removal, priority,
status/resolution, first acknowledgement and customer/internal replies. Fresh actor
and relevant-domain preflight precedes writes. Exact scoped response metadata proves
the reviewed body/visibility and independent version effect. An already-acknowledged
race explicitly says the reviewed response was not added. Stable management forms
retain unsaved fields on version changes and require explicit field reload.

Minimal account/role/kind/reference pending markers survive unknown outcomes and
reload. Session invalidation redacts their values. Explicit **Load current
conversation** rechecks access, loads the current record/message page and replaces
only this conversation's drafts without replay or proof of the original outcome.
Definite API rejection differs from an unsent preflight. Accepted customer same-key
recovery remains unchanged.

The backend now serializes staff messages with closure, rejects a new first
acknowledgement after closure, and returns safe scoped message/acknowledgement
outcome metadata independently of the oldest500 embedded history. No endpoint,
request, permission, schema or migration change is needed. See the
[contract and optional durable recovery](../../../backend/docs/workshop-support-conversation.md).

## Concepts and fidelity

Fresh built-in Image Gen [desktop](work-support-detail-oct-concepts/desktop.png) and
[mobile](work-support-detail-oct-concepts/mobile.png) concepts were viewed before
UI edits. [Audit](work-support-detail-oct-concepts/audit.md),
[specification](work-support-detail-oct-concepts/spec.md) and
[prompts](work-support-detail-oct-concepts/prompts.md) are saved. Browser plugin tools
were unavailable; production Next.js, Playwright/Edge, Axe and native `view_image`
comparisons were used. No generated image is embedded in the UI.

Native comparisons use **1487x1058 desktop** and **870x1808 mobile reference**;
actual 320/375/430px checks separately prove narrow layouts. Viewport and full-page
captures show the complete facts and continuation rather than hiding rows to fit a
generated canvas.

| Area          | Final disposition                                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition   | Named subject, section links, handling/contact groups, full original text, left history/reply and right management follow the references and stack in reading order.             |
| Typography    | Computed Quicksand, 30px wide/24px narrow title, 16px sections and 13px body/controls retain the established dashboard hierarchy.                                                |
| Surfaces      | Cool canvas, white12px panels, restrained red actions and amber internal-note cards replace generated blue branding and arbitrary colors.                                        |
| Facts         | Full UUIDs, numeric version, actual branch/code/staff/contact and exact Lagos milliseconds replace generated short IDs, fake addresses and date-only examples.                   |
| History       | Actual author types, explicit visibility, oldest-first pages and separate original text replace invented names/avatars, duplicated original messages and false all-history copy. |
| Management    | Explicit assignment/status/priority and separate acknowledgement preserve supported APIs; generated combined resolution/internal management-note controls are not adopted.       |
| Review/mobile | >=44px controls, complete wrapping text/references, single-column forms and a readable full-body review remain usable at320px.                                                   |

Copy includes **Customer care**, **Refresh conversation**, **Back to customer care**,
**Record and handling**, **Original complaint/message**, **Internal staff note**,
**Customer-visible**, **Last confirmed message**, **Reload management fields** and
**Load current conversation**. **Not recorded/Unassigned** preserve missing values;
saved messages and acknowledgement facts do not claim actual provider delivery.

## Verification

- **Thirty-nine distinct production browser cases pass:**29 new conversation cases
  and10 existing customer/staff reply, resolution/closure, assignment/priority,
  stale/unknown outcome and Staff-picker regressions. Legacy response fixtures now
  include the additive scoped receipts; copy assertions match the new factual
  guest guidance and confirmed-message panel.
- Seven helper units pass for scope/history/cursors, exact scoped replies and
  status receipts, immutable acknowledgement/version merging, once-only outcomes,
  minimal pending metadata/redaction, scoped draft removal and blocked storage.
- Five new isolated API/database scenarios pass for private 50+3 history, current
  branch/MFA access, a new response beyond the embedded500 cap, exact versions,
  acknowledgement once/race/closed behavior and a held-lock concurrent closure
  that creates no late staff message/audit.
- Frontend/backend static checks, focused ESLint/oxlint, formatting and production
  build pass. Twenty exact frontend source/dependency hashes match the tested
  production snapshot. Functional corrections used the development snapshot before
  the single final production build.
- Twenty-one final Axe scans cover seven widths320/375/430/768/1024/1440/1920,
  the full mobile review and13 native/state captures. Captures include both kinds,
  Staff, empty, outage, profile failure, closed, long text, review, null contact and
  unknown outcome. No page overflow or captured page errors occurred.
- Connected production Edge/Express/PostgreSQL verifies50+3 reloadable paging/Back,
  **nine real UI writes/nine mutation audits**, exact customer/internal responses,
  assignment/removal, independent versions, first acknowledgement, priority,
  resolution and closure. A committed response loss stays locked through reload;
  explicit recovery reads without replay and leaves exactly one saved reply.
  Twenty-three privileged READ audits were recorded. Staff reassignment clears
  private facts; Customer/anonymous access fails; a foreign conversation's complete
  snapshot stays unchanged.

## Safety and remaining scope

Actual **127.0.0.1:55480 / allied_work_aftercare_20261017_test**, isolated-test
environment and existing restricted runtime credentials were verified before fixture
writes. Synthetic records remain; only owned sessions were removed. No application/
shared database, schema, migration, grant, backup/restore, push or deployment
operation occurred. Unchanged59-migration replay, db:check and privilege evidence
was reused; no new restore test is claimed.

ADM-31 records the implemented additive lifecycle/receipt correction. ADM-32 records
optional durable staff original-request recovery. Provider delivery, business policy,
privacy review, moderation, finance and deployed/application-wide acceptance remain
separate. Next page gate: administrator privacy review `/admin/privacy`. The overall
goal remains active.

Evidence: `C:/Users/PC/.codex/work-support-detail-` browser/legacy/API/build/unit/
real/capture logs, real/captures/source-hashes JSON and final PNGs. Development logs
retain the targeted correction evidence. Temporary harnesses remain outside the repo.
