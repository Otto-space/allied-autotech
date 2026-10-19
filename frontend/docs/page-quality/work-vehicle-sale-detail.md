# Workshop vehicle purchase detail

Locally accepted 17 October 2026, milestone 73. Route
`/admin/vehicle-sales/[transactionId]`; the index was separately accepted at 72.

## Result

The named header, section navigation, facts/amount panels, negotiation/progress,
actual history and applicable handover reuse the accepted dashboard/forms/review/
upload/private-access components. Exact amounts, full references, null/zero values,
Lagos milliseconds and recorded lifecycle/terms dates remain factual. No current
financial ledger or terms/appointment/delivery guarantee is invented.

Current active identity gates reads. Strict ID/branch parsing rejects malformed or
foreign Staff data. Fresh actor/domain checks precede reviewed writes. Stable
forms preserve drafts on concurrent changes and explicitly reload affected versions.
Full receipts validate saved values, history and independent transaction/handover
versions. Minimal owner-scoped pending locks survive uncertainty and reload;
explicit current-record recovery replaces this page's drafts without resending or
proving the original outcome. Definite rejection differs from an unsent preflight.

The backend now returns negotiation/progress history after appending it, exposes
only signed-document presence and returns a clear 409 when completion lacks required
evidence/recipient details. No schema change is needed. Optional-PDF creation stays
supported, with advance explanation that evidence cannot be attached later.
Completion requires evidence; cancelled handover recovery remains unsupported.
Authorized temporary document access stays independent of mutation reconciliation.
See [backend contract/gaps](../../../backend/docs/workshop-vehicle-sale-detail.md).

## Concepts and fidelity

Fresh built-in Image Gen [desktop](work-vehicle-sale-detail-oct-concepts/desktop.png)
and [mobile](work-vehicle-sale-detail-oct-concepts/mobile.png) concepts were viewed
before UI edits. The [audit](work-vehicle-sale-detail-oct-concepts/audit.md),
[specification](work-vehicle-sale-detail-oct-concepts/spec.md) and exact
[prompts](work-vehicle-sale-detail-oct-concepts/prompts.md) are saved. No generated
image enters the app. Browser plugin tools were unavailable; production Next.js,
Playwright/Edge, Axe and native `view_image` comparisons were used.

Native concept/final dimensions: **1487x1058 desktop**, **779x2020 mobile reference**.
The wide generated phone canvas is supplemented by actual 320/375/430px checks.
Viewport captures judge the fixed shell; full-page captures show continuation.

| Area        | Final disposition                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition | Named breadcrumb/header, anchors, facts/amounts and paired operation panels follow references; actual Allied shell/navigation/account controls remain.               |
| Typography  | Computed Quicksand, 30px wide/24px narrower headings, 16px sections and 13px body/controls follow the dashboard hierarchy.                                           |
| Surfaces    | Cool canvas, white 12px panels, subtle rules, restrained red actions/focus and neutral badges match accepted workshop pages.                                         |
| Mobile      | Panels stack, fact labels and wrapping values retain compact paired rows, and inputs/actions measure >=44px. Final visual review prompted narrower fact-row spacing. |
| Facts       | Real UUIDs, numeric versions and precise Lagos timestamps replace samples. Only actual stock navigation is linked; unsupported customer/branch links are excluded.   |
| History     | Only actual statuses, notes and reasons appear. Generated Stock linked/Customer linked events and invented editor attribution are excluded.                          |
| Handover    | The generated paid example is not inserted into a negotiating record. Real state/evidence/zero readings/independent versions drive controls.                         |
| Review/copy | Full customer-visible notes and exact money appear in a focused review. Repeated generated red review notices and unsupported hold promises become factual guidance. |

Copy retains **Purchase facts**, **Recorded amounts**, **Negotiated price**,
**Purchase progress**, **Purchase history**, **Refresh vehicle purchase** and
**Back to vehicle sales**. Amounts use **Reservation amount requested** and
**Not agreed/Not set/Not recorded**. Recorded full payment refers to the saved
timestamp. Terms guidance requires customer acceptance without claiming business
approval or that published terms are absent.

## Verification

- **29 distinct passing browser cases:** 21 new detail and eight legacy negotiation/
  cancellation/handover/upload/access cases. One existing empty-storage case was
  skipped in this deliberately configured storage runtime. Corrected test locators
  and contract-aligned fixtures were rerun selectively. Final mobile CSS triggered
  a fresh seven-width/review check and ten final captures.
- **Seven focused unit cases:** strict receipts/history/scope, independent versions/
  zero values, observation merging, minimal pending markers, redaction, scoped draft
  removal and unavailable storage.
- **Three API/database scenarios:** role/MFA/private boundaries, exact maximum
  negotiation/current history/reason, stale versions, verified-PDF creation/READY/
  COMPLETED, missing-PDF 409 without mutation and cancelled/replacement denial.
  Presence flags match evidence; raw object keys and hashes remain absent.
- Frontend/backend type checks, focused ESLint/oxlint, formatting and final production
  build passed. **22 exact production source/dependency hashes** match the tested build.
- **18 final new-page Axe scans:** seven widths (320/375/430/768/1024/1440/1920),
  review and ten native/state captures. No overflow/captured page errors. States
  include Staff, paid creation, ready without evidence, errors, long text and review.
- Connected production Edge/Express/PostgreSQL verified **six UI changes/six
  transaction mutation audits**, saved negotiation/public history/cancellation,
  lost committed response/reload/current-read without replay, zero odometer/keys,
  independent handover versions, Staff reassignment and Customer/anonymous denial.
  The initial audit assertion incorrectly expected separate handover-entity audits.
  A read-only follow-up verified all saved values/history and six transaction/zero
  handover-entity audits, avoiding repetition of the completed browser workflow.
- Actual PDF upload/checksum/ticket, expiry/private access and completion passed in
  legacy browser and isolated API checks. The connected browser fixture intentionally
  covers the no-PDF path; these are distinct evidence scopes.

## Database and remaining work

Actual **127.0.0.1:55480 / allied_work_aftercare_20261017_test**, isolated-test
environment and restricted runtime credentials were verified before fixture writes.
Synthetic reservation-policy acceptance uses the existing helper and does not approve
business terms. Domain fixtures remain; only owned sessions were removed. No
application/shared database, schema, migration, grant, backup/restore, push or deployment
change ran. Unchanged 59-migration replay/db:check/privilege evidence was reused.

ADM-28 records completed receipt/evidence/409 fixes; ADM-29 covers late evidence and
cancelled-handover recovery; ADM-30 is optional durable outcome recovery. Policy,
finance, deployed and application-wide acceptance remain open. Next: customer records
`/admin/customers`; its detail is separate. The overall goal remains active.

Evidence: `C:/Users/PC/.codex/work-sale-detail-` browser/focused/final, API, real and
read-only verification logs; real/captures/source-hashes JSON; final PNGs and build log.
Temporary harnesses remain outside the repository.
