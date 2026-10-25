# Notification experience — 25 October 2026

Scope: notifications only. Source starts at frontend release receipt `0253a651`
(runtime `e9f48ef5`) combined with current backend `ff42b0e2`. Reused the clean
home-restoration worktree on `feat/notifications-experience-20261025`; the preferred
Home and audit fixes are retained. Shop/Vehicles R2 and other worktrees are separate.
No publication, real messages, production roles or production fixture writes.

## Contracts and acceptance cases established before implementation

| Boundary | Required fixture outcome | Initial finding |
| --- | --- | --- |
| Personal inbox | Customer `/dashboard/notifications`; STAFF/ADMIN/SUPER_ADMIN `/admin/notifications`, authenticated own records only | Existing shared account inbox and exact workforce endpoint exception |
| Responsibility | Mechanical/electrical technicians, workshop lead, sales supervisor/cashier, accountant, customer service and executive; current assigned/branch/delegated grants, never position title | Existing workforce policy and recipient fixtures; verify revoked access |
| Private source | Missing/revoked source has generic unavailable text and no resource identifiers/destination; raw historical content never returned | Target is checked but original payload is still returned: fix |
| Read state | GET/render/preview no writes; explicit read/unread idempotent, CSRF/ownership checks, no business mutation | Read exists; unread missing |
| Bulk | Whole owned inbox through one server timestamp; later arrivals stay unread; response includes cutoff; expired rows may be dismissed | Existing whole-account update has no explicit cutoff |
| Badge/preview | Global summary independent of filters/page; safe recent preview, capped visual/full accessible count; keyboard dismissal/focus restoration; no insertion while open | Badge correct; preview missing |
| Reconciliation | Local/other-tab read changes refresh without private broadcasts; hidden/offline polling paused; session switch clears private state | Existing summary broadcast/polling; inbox needs reconciliation |
| Settings | Focused inbox plus full-width settings disclosure; explicit reviewed saves and unknown-result recovery preserved; honest defaults/channel capabilities/marketing consent | Long narrow sidebar and technical labels |
| Device | Unsupported/default/granted/denied/revoked/offline/unconfigured distinguishable; no permission prompt on mount; enabled requires local permission/subscription AND confirmed server binding | Existing UI uses OR and does not reconcile revoked permission |
| Push | Existing genuine service worker/outbox, generic IDs-only payload, session-bound subscription, logout cleanup, bounded retries/410 retirement; no foreground polling presented as push | Existing implementation; real-device/configured delivery not yet verified |
| Delivery | Trusted producers + transactional dedup/outbox; delayed opt-out respected; provider failure cannot fail domain transaction; disabled channels do not retry forever | Existing delivery worker rechecks opt-out; disabled provider retries unnecessarily |

## Event / recipient / channel inspection

| Producer | Recipient and access | Existing optional channels |
| --- | --- | --- |
| Support reply/status/acknowledgement | Owned linked customer; internal notes excluded by customer-email layer | Operational email; guest support email uses separate encrypted outbox |
| Support created/customer reply/assignment | Current branch/responsibility or assigned recipient; actor excluded; dedup per persisted event/recipient | Assigned reply email only; generic team text |
| Workforce job assignment | Assigned technician from persisted work event | Inbox; inspect existing job producer |
| Booking/quotation/work order lifecycle and reminders | Owning customer from persisted booking | Existing selected EMAIL/SMS rules; no blanket category policy change |
| Payments/refunds/expiry | Owner/approved operational recipients; release capabilities retained | Existing transactional channel selection |
| Operational alert worker | Existing explicit alert eligibility, not every administrator | Existing worker policy |
| Account/security | Dedicated identity outbox exists; do not turn transient form success into permanent notifications | Existing required identity email policy |

Status: discovery/fixture contracts established. Integration, rendered states and
final outcomes will be appended after actual checks. Existing tests and new focused
regressions are isolated; no claim of real authenticated/device/provider acceptance.
Browser plugin not available; use installed Edge with existing Playwright.
