# Codex Implementation Handoff — Allied AutoTech Companion (Revised)

**Purpose:** create a premium, customer-first iOS/Android application on top of the existing Allied AutoTech platform. **Read the full blueprint (`docs/mobile/BLUEPRINT.md`) before making changes.** This brief is a concise operational document, not a replacement for the detailed requirements.

**Project:** `https://github.com/Otto-space/allied-autotech`
**Audited reference:** `master` commit `80e95a386afeba3450cc5e66ed9afab421f52e65` (4 November 2026). **Refresh current master and deployment state first.**
**App name (working):** Allied AutoTech Companion
**Roles for v1:** CUSTOMER and signed-out public visitor. A staff companion is a separately reviewed later stage.

---

## Mission

Build an app customers want to keep because it remembers their vehicles and keeps their automotive business in one reliable place. Product promise: **"My car, my care, my parts, my bookings, my records, without the back-and-forth."** It should feel like a high-quality native app while being more honest about automotive facts and money than ordinary marketplaces.

The website supports service discovery, eight owner service groups, garage, parts and vehicle discovery, approved fitment checks, bookings and quotations, cart, collection orders, vehicle enquiries/inspections, customer support, Help/Learn, notifications, privacy, and guarded financial/workforce workflows. These are **source features, not universal live availability.** Never activate purchases, deposits, AI or confirmed booking slots without current server capabilities and actual owner/provider approval.

---

## Stop rule (applies to everything below)

**If any required fact (a policy, a flag, an endpoint, a file, a contract) cannot be found or verified, stop and report it. Do not assume, invent or fill the gap.** Record the blocker in the package report with what you looked at and what decision or access is needed.

---

## Non-negotiable context and safety

1. Read `AGENTS.md`, backend security and policy docs, current issue/quality registers and the canonical OpenAPI. Reconcile the latest merge, test results and actual release identity. Preserve unrelated user changes.
2. This is an existing **Next.js 16 + Express 5 + Prisma 7/PostgreSQL** monorepo. **No native app currently exists.** Create an independent `apps/mobile` Expo/React Native TypeScript app. Not a WebView clone, not a second database.
3. The web app uses **HttpOnly host-only opaque cookies plus session CSRF/Origin checks and MFA**. Mobile authorization is a **new security architecture task** (see Package B). Never copy browser cookies into AsyncStorage or weaken backend checks.
4. Public launch may still be in `browse_enquiries` mode. The server-owned capability snapshot controls what is truly available. A preferred appointment is **not** confirmed. Candidate fitment is **not** guaranteed. A payment callback is **not** settlement. A quote is **not** a stock reservation. A collected order is **not** a refund.
5. Payments, refunds and tax use exact **integer kobo** and immutable server history. The mobile app **never computes or stores a tax rate or payable amount**; it displays server-provided totals. Owner direction currently includes: collection-only, verified suitability and stock **before** payment, no booking deposits, and enquiries/inspections without unapproved paid vehicle holds. VAT is applied after discounts using the rate in the **currently authorized, versioned finance policy** (see `OWNER_POLICY_DECISIONS.md` and `backend/docs/public-launch-policy-decisions.md`). Do not hardcode a rate from this brief. The backend's `GET /api/v1/public/capabilities` currently returns `finance.draftVatBasisPoints: 750` with `pricesIncludeVat: false`; that is a **draft** value, not an approved published rate. Display server values only.
6. Do not invent services, stock, service durations, staff capacity, photos, warranties, verified fitment, vehicle condition, mileage, transaction states, marketing consent, late fees or personal preferences.
7. **Three open PRs** at audit: `#20` and `#22` (draft physical attendance and compatibility), `#23` (remaining-work resource selection; its frontend PR check failed). None is in the 97-migration audited master. Do not treat proposed migration 98 or arrival/no-show rules as deployed.
8. Never write to production for exploratory tests, charge real money, send real customer messages, change employee grants, publish financial policy, enable provider flags or deploy without explicit current authorization. Use isolated test databases, forward-only migrations and the existing backup/recovery workflow.

### Development target environment

Run the mobile app against a **local stack or a dedicated staging API with an isolated database and test-mode providers only**. Record the API base URL and backend commit SHA in every package report. **Never point a development build at production.** If no staging environment exists, use the local stack only and treat staging provisioning as a prerequisite for Package F.

---

## Verified backend facts (read from the backend source; re-confirm in the live repo)

- `apps/mobile` is a standalone **npm** package; the backend is a standalone npm package and the repo root is not an npm workspace.
- Server capability snapshot: `GET /api/v1/public/capabilities` (anonymous, no-store). The backend also enforces launch mode with HTTP 403 on writes, so handle 403 even when the snapshot allowed an action.
- Auth is **cookie-only** with CSRF and trusted-`Origin` checks and no Bearer path. Native register, login and authenticated writes are rejected by design (the unauthenticated auth routes also require a trusted `Origin`); native auth is a backend change to `authenticate` and CSRF middleware and needs human review.
- Money is a digit string of integer kobo. Idempotency key formats differ per endpoint. Rate limits are per IP.
- Push is browser Web Push only. There is no app-version or forced-update mechanism. Private images need authenticated GETs.
- **Backend additions Package B/E must plan for:** native auth exchange and device sessions; APNs/FCM device registration; an app-version gate (minimum supported version plus force-update response); device-aware or token-aware rate limiting; native WebAuthn/passkey support if wanted.
- The repository is git-confirmed at `80e95a3`. `AGENTS.md` bans `prisma db push`, `migrate reset` and `migrate dev` against shared databases; migrations are applied with `npm run db:migrate`. Unmerged branches add migrations `20261104002000_booking_attendance_history` (PR #20) and `20261104010000_booking_work_reviews` (apparently PR #23).
- When `PRIVATE_TESTING_ENABLED=true` (staging, pre-launch production) every API request needs `Authorization: Basic ...`, which would collide with a Bearer token. The proposed native design carries the session token in `X-Device-Session` instead (section 5.6, pending owner confirmation). Never embed the perimeter password in a build.
- Keep mobile routes under `/api/v1/mobile/`, not a new prefix, so launch-mode rules, no-store headers and OpenAPI generation apply.
- Any backend PR must pass the backend's own `npm run check`, use an isolated `_test` database, and must not use `prisma db push` or migration reset.

## Navigation and priority

**Bottom tabs:** Home · Explore · Garage · Activity · You.

### P0-A — first store release
Guest browsing; Explore (Services, Parts, Vehicles) with universal search; Contact and Help; service enquiries with confirmed reference; accessible registration, verification and sign-in with MFA; Garage with default car; support cases; notification **inbox**; account, privacy and sign-out; honest offline, error and unknown-outcome handling.

### P0-B — immediately after P0-A
Saved vehicles and products; personalized Home attention feed; full Activity timelines; vehicle-aware "Find Parts for My Car" candidate search.

### P1
- **Booking request, staff proposal and confirmation: build only after gate G01 (real schedules and capacity) is closed.** Until then, service requests are enquiries that end in "Awaiting workshop review," and booking UI stays behind the server capability flag.
- Calendar links; customer-safe service timeline and quote statuses; real post-order/collection tracking; aftercare; relevance-ranked Help; supported vehicle inspection enquiries.
- **Native push is P1/P2:** the in-app inbox ships first. APNs/FCM registration ships behind a rollout flag only after device validation and provider acceptance. The inbox must work fully when push is off or denied.

### P2
Server-approved checkout, provider test-mode payment status and collection code; maintenance follow-ups sourced from actual records and approved policy; saved-listing change alerts; opted-in educational content.

### P3 / new owner decision
Rewards/referrals, advanced AI (Allie), vehicle condition scores, additional dealer models, staff companion. Not MVP entitlements.

---

## Screen construction rules

- **Home:** one verified "Needs your attention" priority card, default car, genuine active orders/appointments/quotes/replies, useful navigation. No fake metrics.
- **Explore:** Services, Parts, Vehicles with separate scoping, fast search, filters, empty/failed/partial states, real product identity.
- **Garage:** owned car cards and detail, default car, vehicle-aware parts search and service request, records with provenance.
- **Activity:** appointment, quote, order, inspection, support and payment timelines by server state; searchable and deep-linkable.
- **You:** profile, session security and MFA, notification settings, support, FAQs (and Allie only when enabled), privacy requests, sign out.

Build a proper React Native design system faithful to Allied's black/red premium direction, dark-navy vehicle accents and white readable form surfaces. Prefer Quicksand if approved and licensed for app distribution. Use responsive tokens, generous tap targets, safe areas, 200% text scaling, VoiceOver/TalkBack labels, compact catalogue cards, authentic photography, clear focus/error/review states and reduced-motion-aware animation. One screen, one primary goal. No floating buttons over content, no unnecessary circular icon borders, no blue accents leaking into primary controls, no cluttered header.

---

## Required customer journeys

1. Signed-out visitor browses the Vehicle AC service category, describes an AC concern, sends an enquiry and receives a confirmed reference. If booking is disabled, no confirmed-slot copy appears.
2. Customer signs up, passes server authentication/MFA, saves a car and sets it as default. The garage is owned and isolated across accounts.
3. Saved car pre-populates **Find Parts for My Car**. Uncertain qualifiers trigger an explicit fitment check, never a false "Fits" badge.
4. Customer saves a real vehicle listing, sees known faults, compares recorded facts, and requests information or an eligible inspection without any deposit.
5. *(Gated by G01.)* Booking moves from REQUESTED → staff review/proposal → CONFIRMED only on a real backend record; calendar and alerts follow authoritative changes.
6. Issued quote review shows immutable items, prices and expiry, eligible accept/decline, and safe unknown-outcome recovery.
7. Order progress shows real preparation, ready and collection states, private invoice/receipt and support. Checkout stays hidden or honestly disabled until owner/merchant acceptance.
8. A human support case can be opened from any critical journey. A reply notification revalidates the exact owned record.
9. Logout and re-login as another user clears prior garage, enquiries, inbox and cached private details, including notification deep links and app-switcher snapshots.
10. Offline or lost-response handling never resubmits bookings, purchases, payments or aftercare with a new idempotency key.

---

## Backend reuse and selective extensions

Inspect `backend/src/routes/index.ts`, the canonical OpenAPI, and the identity, customer/overview, services, catalogue/fitment, orders/payments, vehicles, support, notifications and privacy modules. Consume a **generated typed client** from the canonical Zod/OpenAPI and validate incomplete responses at runtime. The website's `frontend/lib/api/client.ts` is browser transport; do not import it unchanged into mobile.

**Proposed additions (design candidates, not existing routes), only if existing routes cannot satisfy safe mobile behavior:** device/session auth exchange; APNs/FCM token register/unregister; customer-safe attention feed; per-vehicle service-history timeline; optional consented reminders and saved-search alerts; notification destination resolver. Every new endpoint needs ownership checks, CSRF-equivalent mutation protection, versioning, idempotency, safe errors, audit, input bounds and isolated API tests.

The existing `PushSubscription` model is browser web push. APNs/FCM need distinct device records and worker integration. Lock-screen text is generic by default, and no OS permission prompt appears before the user chooses to enable notifications.

---

## Work packages

Order: **Package A first. Then B and C run in parallel** (C needs no authentication; B is the auth spike). **Package D starts only after B's auth proof passes on real devices.** E and F follow in order.

### Package A — Reconnaissance and technical decisions
1. **Commit the blueprint to `docs/mobile/BLUEPRINT.md`** in the same PR that adds this brief, and reference that path rather than the dated filename. If the blueprint file is missing, stop and report it.
2. Refresh GitHub; inspect actual code, the blueprint, open PR overlap, current owner policy and flag readback.
3. Produce the route/API/model/screen traceability matrix, a tech ADR, the mobile auth threat model and an implementation plan. Never assert current production state from an old handoff.

### Package B — Secure native foundation (includes backend work)
This package includes **backend changes**: a device/session record, a forward-only migration, native auth exchange endpoints, refresh rotation and revocation, with MFA, secure storage and cross-account isolation.
- Deliver the backend part as a **separate backend PR** with an ADR, threat model and isolated tests. **It must not be merged without explicit human review.**
- Do not number or apply the migration until you have checked it against a freshly fetched `master` and the open PRs. **PR #20 already proposes migration 98.**
- App side: Expo baseline and tests, typed HTTP client, session/account invalidation, secure storage, navigation, design tokens, primitive UI. Test on Android and iOS.
- If a secure auth protocol cannot yet be established, stop and record the precise blocker. Do not bypass the web auth contract to make a demo work.

### Package C — Public experience (parallel with B)
Guest Home, Explore, search, the three catalogues, service/vehicle enquiry, Help and contact. Run screen-reader, real-image, offline and capability-degradation cases. Verify no false availability or fitment.

### Package D — Owned experience
Garage, personal Home attention, Activity, saved items, support, profile/security/privacy and notification inbox. Verify ownership and cross-account isolation.

### Package E — Operations and retention
Booking (only after G01), quote, order/collection lifecycle, user-authored or workshop-authorized maintenance reminders, native push (flagged) and aftercare, in policy-eligible order. Test staff/customer transitions and lost-response reconciliation.

### Package F — Financial and release acceptance
Only after documented owner approval: provider test-mode return/webhook/reconciliation; exact money, tax, stock, fitment and collection checks; physical-device and accessibility matrix; store signing and privacy disclosures; gradual release, feature flags, telemetry and rollback. Staging must exist by this point. **Store submission is blocked until section A of `docs/mobile/PRE_LAUNCH_CHECKLIST.md` is closed** (perimeter gate handled for review, reviewer demo account, account-deletion path, privacy disclosures, organisation store accounts).

### Every package report MUST include
- Verified source SHA, API base URL and backend commit used
- Exact files changed; existing contracts reused; new APIs, migrations, permissions
- Tests executed with pass/fail results, **each mapped to blueprint story IDs (MOB-001 to MOB-026)**, listing which IDs the package covers, which remain, and which are blocked
- Screenshots labelled device or emulator
- Release flag status and whether any staging or production action occurred
- Customer-data safety evidence (account isolation, lost-response safety)
- Remaining tasks and approval blockers

Use the repo's single quality ledger. Never weaken a failing assertion to obtain a green report.

---

## Non-functional targets

- **Accessibility and performance:** follow blueprint Section 17: WCAG 2.2 AA as the goal, 200% text scaling, VoiceOver/TalkBack on real devices, performance budgets measured on an entry-level Android and an older iPhone.
- **Analytics and privacy:** follow blueprint Section 23: privacy-safe event schema, with no VIN, phone, message text, address or payment data in events. **Analytics stay off until consent and lawful basis are approved.**
- **Release evidence:** use the blueprint's readiness levels 0–5 for honest wording of what is available.

---

## Definition of customer-ready

The app is customer-ready when someone can discover real services, parts and cars; save a verified garage vehicle; send a support question; understand actual pending or confirmed status; see owned history; receive only authorized information; and recover safely from network and session failures. **Excellent design means every important action is easy, accurate, accessible and reversible where business rules allow, not merely visually impressive.**

---

## References

- Blueprint: `docs/mobile/BLUEPRINT.md`
- Pre-launch checklist and cautions: `docs/mobile/PRE_LAUNCH_CHECKLIST.md`
- Native authentication design: `docs/mobile/NATIVE_AUTH_DESIGN.md`
- [Security model](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/security-model.md)
- [Current owner decisions](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/public-launch-policy-decisions.md)
- [Owner policy decisions](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/OWNER_POLICY_DECISIONS.md)
- [API composition](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/src/routes/index.ts)
- [UX rules](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/docs/UI_UX_AND_CONTENT_RULES.md)
- Open PRs: [#20 attendance](https://github.com/Otto-space/allied-autotech/pull/20), [#22 compatibility](https://github.com/Otto-space/allied-autotech/pull/22), [#23 capacity](https://github.com/Otto-space/allied-autotech/pull/23)
