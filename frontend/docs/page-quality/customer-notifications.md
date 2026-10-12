# Customer notifications quality gate

Status: **locally accepted**, 12 October 2026. Gate 43 follows the 42 previously accepted milestones. Route `/dashboard/notifications`; staff personal notifications retain their separate route/gate.

## Audit and baseline

The existing panel uses oversized filter padding, large per-message cards, loose heading spacing and a distant preferences grid. Baseline 390/768/1280/1440 screenshots are outside the repository at `C:/Users/PC/.codex/notifications-oct-before-{width}.png`; all four were captured with Edge and inspected. No horizontal overflow occurred. Content remains too tall for efficient scanning. Browser/IAB is unavailable; Playwright with Edge is the fallback.

## Contract evidence

- [Routes](../../../backend/src/modules/notifications/notifications.routes.ts): customer and staff route families, authentication/role boundaries and CSRF writes.
- [Schemas](../../../backend/src/modules/notifications/notifications.schemas.ts): cursor, limit 1-100(default 25), type/category/unreadOnly; no search, total or unread-count endpoint.
- [Repository](../../../backend/src/modules/notifications/notifications.repository.ts): owner-scoped, unexpired inbox; newest first; owned read mutations. Mark-all includes all unread owned records, including expired and filtered records.
- [Service](../../../backend/src/modules/notifications/notifications.service.ts): no read-state toggleback/delete operation; marketing enqueue disabled pending approval; preferences record consent/audit but no expected-version or idempotent replay contract. Optional operational delivery defaults on; mandatory messages bypass optional preferences. Contact availability/runtime providers govern actual delivery.
- [Frontend schemas](../../lib/api/notification-schemas.ts): strict parsed response shape, unique inbox/preference entries and consent-aware defaults.

No backend change is necessary for the current inbox and preference workflow. Marketing execution is a separate policy-dependent capability. Exact preference replay can append another consent/audit; uncertain writes must not replay automatically. A profile-style expected-revision enhancement would be a separate optional contract decision.

## Design and implementation

[Complete concept specification](customer-notifications-oct-concepts/README.md) prepared before page code. Preserve shared shell, role routing, resource reads, cursor pagination, Feedback and MutationReview; use a dedicated customer composition. API business rules remain authoritative. No production marketing campaign is authorized by this page work.

## Implementation

[CustomerNotifications](../../app/components/customer-notifications.tsx) composes an owned inbox and independent preference rail inside the existing shell. Its [scoped stylesheet](../../app/dashboard/notifications/notifications.css) uses the concept's compact rules, dark preference header, clear status labels and responsive single-column continuation. The existing staff panel and shared shell are unchanged.

The [write guard](../../lib/notifications/use-notification-write.ts) checks the current session identity before each customer mutation, blocks loading/refreshing/stale data, respects Retry-After and serializes writes within each region. It saves only an account- and region-specific pending marker in session storage. An uncertain response survives reload, never automatically replays, and requires explicit successful refresh plus acknowledgement. A failed manual refresh cannot later unlock acknowledgement through a background-only success. Storage failures prevent transmission or retain recovery until the marker can be cleared. Fresh preflight reduces stale-session errors; backend ownership and CSRF remain authoritative.

Mark-all confirmation explains its full-account scope. Marketing confirmation is explicit, channel-specific, cancellable, and explains that delivery is unavailable. A saved preference does not activate campaigns. Already-read rows have no mark action. Cursor paging retains Previous on a failed or empty later page; there is no invented total. Long titles/messages wrap and preserve line breaks. Foreground read failures hide old data; background failures label stale data and block the affected region's writes while the other region can remain usable.

## Local verification

Artifacts and logs below are local QA evidence outside the repository under `C:/Users/PC/.codex/`. They contain isolated synthetic account data. Provider delivery and deployment are not certified by this gate.

| Check                       | Evidence and result                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production build            | `notifications-oct-build-accepted.log`, exit 0: webpack, TypeScript, 71 static pages and standalone packaging. Final source includes the filter, recovery and skeleton refinements.                                                                                                                                                                                                        |
| Lint                        | `notifications-oct-lint-all.log`, full frontend exit 0; scoped final lint also exit 0.                                                                                                                                                                                                                                                                                                     |
| Resource refresh regression | `notifications-oct-resource.log`: five tests passed.                                                                                                                                                                                                                                                                                                                                       |
| Notification backend scope  | `notifications-oct-backend-focused.log`: all three selected notification creation/delivery/withdrawal cases passed against isolated PostgreSQL; five unrelated cases deliberately excluded. Six security/template unit cases also passed in the broader run below.                                                                                                                         |
| Real browser/API/database   | `notifications-oct-real-final.log`, Node exit 0, actual Express API and `allied_customer_overview_test` PostgreSQL with synthetic accounts.                                                                                                                                                                                                                                                |
| Responsive capture          | `notifications-oct-captures-final.log`: 320,360,375,390,430,768,1024,1280,1440,1536 and native 1435px; every capture reports no overflow and no page errors.                                                                                                                                                                                                                               |
| States                      | `notifications-oct-states-final.log`: empty, error, loading, stale, confirmation and unknown outcome; all overflow-free. Separate simultaneous inbox/preference loading capture verifies no invented defaults.                                                                                                                                                                             |
| Mobile clearance            | `notifications-oct-native-final.log`: 390x844 viewport; preferences refresh bottom 582.64px, safely above the fixed support dock.                                                                                                                                                                                                                                                          |
| Browser regression          | `notifications-oct-browser-final.log`, exit 0: all 52 cases passed (35 new customer quality cases and 17 existing notification regressions). Covers ten widths, four page/dialog Axe and focus checks, four state Axe checks, filters/paging, loading/error/stale behavior, session/role/CSRF, consent, uncertainty/reload/storage isolation, rate limiting and long/short-screen content. |

The real browser/API flow verifies 25+2 owned paging, a server-side type filter, a persisted individual read and an unchanged timestamp on repeat read. Cancelling read-all changes nothing. Confirmed read-all changes 27 remaining records, including an expired row outside the displayed filter, while leaving another customer's record unread. Preference cancellation creates nothing; a deliberately lost committed response followed by reload/manual refresh/acknowledgement leaves exactly one consent and one audit without replay. Withdrawal appends the second consent record. It also verifies private no-store reads without internal ownership/deduplication fields, mandatory-category 422, forged-owner 422, foreign-read 404, missing-CSRF 403, customer-route denial for staff/admin/SuperAdmin, working staff personal routes and anonymous 401. No page errors occurred. No actual email/SMS campaign was sent.

## Corrections and verification limits

- Initial TypeScript found a nullable preference projection inside a callback; optional access corrected it. Final production build passes.
- First browser run: 46 passed, one teardown failure after assertions. Another concurrent Playwright run used the same temporary artifact directory, causing an ENOENT trace file. Final run uses its own output directory; no shared artifacts were deleted to repair it.
- Initial real helper queried nonexistent `AuditLog.actorUserId`; it was corrected to the actual `userId` field. The complete corrected run passed; the application did not need a backend repair.
- The broader backend run was 13/14: the unrelated review fixture failed because the isolated database lacks `Service.categoryId`. That is not reported as a passing full backend suite. The three notification cases and six security/template unit cases passed; the three notification cases were rerun explicitly. No application database or migration was changed for this page.
- Initial unit command named a nonexistent file; the actual resource-background-refresh suite was then located and all five cases passed.

## Fidelity review

The two retained concepts and all ten final responsive screenshots were opened with `view_image`, along with native 1435x1096, mobile 390x844, scrolled mobile preferences and final state captures. Playwright/Edge was used because Browser/IAB is unavailable. The native-size screenshot is `notifications-oct-native.png`; it uses the desktop concept's exact 1435x1096 dimensions. No resized image was used as a substitute for that viewport check.

| Comparison               | Final assessment                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header and copy          | Exact extracted heading/subtitle; compact breadcrumb and no extra eyebrow. Above-the-fold copy diff against the extracted spec: none.                  |
| Composition              | Flexible inbox plus 340px preferences with 24px gap; aligned panel tops; stack below 1100px.                                                           |
| Filters and density      | Desktop selects/unread align on one row after removing the initial extra row; mobile filters stack with 44px targets.                                  |
| Notification anatomy     | Thin rules, 3px status rails, explicit read/unread labels, full message, Lagos time and correctly conditional action. No repeated large rounded cards. |
| Preferences              | Ink header, four compact rows, neutral effective/default state, exact separate actions and honest delivery limits.                                     |
| Color and typography     | Quicksand retained, white/cool-gray surfaces and ink/red accents; contrast states and shared focus treatment verified.                                 |
| Mobile and dialogs       | Single-column continuation, wrapping, safe modal focus/restoration, short-screen scrolling and dock clearance.                                         |
| Empty and failure states | Matching skeletons and compact state regions; no false empty account or invented preferences after failures; recovery is clear and isolated by region. |

Material mismatches fixed: loose initial desktop filter placement, duplicate uncertain-outcome feedback and undersized loading placeholders. Intentional differences from generated pixels were specified before implementation: the actual logo/sidebar/header, real API text/dates, no fake page total, neutral preference colors, and no mark action for a read row. Shared MutationReview retains its established buttons and safe-error presentation. The final rendering is faithful to the extracted design with those documented corrections; no material visual mismatch remains in the inspected surfaces.

## Remaining boundary

Marketing execution remains disabled pending Q12 content/consent/sender/unsubscribe approval and its own implementation/release verification. Preference PUT has no expected revision or durable replay contract, so it must not be described as conflict-safe across sessions. These limits are recorded in [backend gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md#marketing-delivery-and-preference-contracts---policy-dependent-follow-up). Existing owner/role/CSRF rules remain intact. No backend source, schema, provider configuration, shared shell or staff redesign was changed for this gate.

**Accepted locally:** all required page checks above are complete. The whole-app goal remains active. Next: customer reviews `/dashboard/reviews`; remaining customer support and staff/admin/Super Admin routes retain their own gates.
