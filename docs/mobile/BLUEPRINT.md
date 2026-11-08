# Allied AutoTech
## Website Platform Audit & Mobile App Product Blueprint

**Repository examined:** [`Otto-space/allied-autotech`](https://github.com/Otto-space/allied-autotech)  
**Source snapshot:** `master` at [`80e95a386afeba3450cc5e66ed9afab421f52e65`](https://github.com/Otto-space/allied-autotech/commit/80e95a386afeba3450cc5e66ed9afab421f52e65)  
**Snapshot committed:** 4 November 2026, 02:58:44 UTC  
**Report prepared:** 5 November 2026  
**Audience:** Allied AutoTech owner, engineering team, product designers, and Codex implementation agent  
**Deliverables:** platform inventory, evidence-based completion/gap register, customer-first mobile strategy, UX specification, architecture and a safe Codex execution brief.

> **Critical distinction.** A feature can exist in code without being enabled, operationally configured, deployed, or validated on a real customer's device. This document keeps those states separate. It is a repo-grounded product/architecture audit and implementation specification, **not** a claim that each of the 3,846 tracked files was individually reviewed line by line, a penetration test, or a production sign-off. The complete tracked tree was inventoried; high-value application code, schema, policy documents, release records, workflows, tests, and current pull requests were sampled and reconciled against the latest commit.

---

# 1. Executive decision brief

Allied AutoTech is substantially more than a brochure website. The repository describes a **multi-domain automotive operations platform** combining public vehicle/service/parts discovery, customer identities and saved garages, workshop scheduling and service jobs, compatibility-reviewed spare parts, collection orders, vehicle sales workflows, secure invoicing and payments, customer support, notifications, learning content, and workforce/owner controls. Much of this is implemented and extensively tested in source. Some commercially critical journeys deliberately remain restricted pending genuine inventory, real capacity and operational policies, authorized financial configuration, provider acceptance, or physical-device checks.

**App recommendation:** build **Allied AutoTech Companion**, a **customer-first iOS/Android app** backed by the current Express/PostgreSQL system. Its home screen should answer: *What needs my attention? What is happening with my vehicle? What can I do next?* Do not convert the admin dashboard wholesale into a cramped phone application. Preserve a separate, narrower staff companion as a later phase. Use native mobile strengths—reliable push notifications, saved vehicles, camera-assisted enquiries, context-aware deep links, calendar handoffs, lightweight access to invoices and service records—without bypassing the website's approval, stock, pricing, privacy, or authentication safeguards.

**Five product pillars:**

1. **My Garage:** the customer's cars, actual service/appointment history, documents/photos they are permitted to view, fitment profile, and next useful actions.
2. **Book & Track:** service discovery, a clear request-versus-confirmation flow, calendar, quotes, progress, service completion, and follow-up.
3. **Find & Collect:** parts/oils search, evidence-backed vehicle compatibility, suitable enquiries, authenticated/guest purchase when enabled, invoices and collection readiness.
4. **Explore Vehicles:** honest stock listings, saved listings, requirements enquiries, inspections and history; no unapproved paid reservation promise.
5. **Care & Confidence:** helpful notifications, human support and escalation, truthful payment states, aftercare, privacy controls, learning and optional AI only when approved.

## 1.1 Board-level recommendation

| Decision | Recommendation | Reason |
|---|---|---|
| Primary app audience | Existing and new customers first | Strongest retention and lowest permission risk; aligns with existing customer APIs. |
| Technology | Expo / React Native + TypeScript, subject to an auth/security spike | Reuses TypeScript expertise and generated contracts without assuming web cookies work in native apps. |
| Backend | Extend existing Express API; **do not duplicate** its financial, stock or booking logic | The current service layer already owns concurrency, audit, policy and state transitions. |
| Launch mode | Discover/garage/enquiry/support MVP before paid journeys | The public website currently has operational and merchant activation gates. |
| Staff operations | Second-stage narrowly scoped operational app or protected mode | Workforce grants, MFA and account-scoped disclosure are complex. |
| Retention | Service utility, trust and follow-through; not spam or artificial rewards | A useful car-care record offers a reason to return without inventing discounts or service intervals. |
| AI | Optional Allie feature behind existing business, quota and privacy gates | Current adapter exists but production activation remains separately gated. |
| Release governance | Feature flags, exact-source tests, independent provider acceptance and rollback | Existing repository explicitly requires those controls. |

# 2. Audit method, coverage and confidence

The repository was accessed through the connected GitHub integration at the immutable source SHA above. The complete recursive Git tree was obtained and categorized. Representative implementation files were checked alongside source-of-truth documents, current API composition, Prisma model/enum inventory, frontend route/component inventories, the latest GitHub Actions results and open PR descriptions. Conflicting historical documents were resolved in favor of later dated owner decisions and current source; historical implementation claims were **not** automatically promoted to deployment claims.

## 2.1 Measured repository inventory

| Inventory item | Recorded at snapshot |
|---|---:|
| Git tree entries, including directories | **4,320** |
| Tracked blobs/files | **3,846** |
| Frontend `page.tsx` routes | **119** |
| React TSX components under `frontend/app/components` | **378** |
| Prisma data models | **104** |
| Prisma enums | **77** |
| Committed SQL migrations on `master` | **97** |
| Backend domain module directories | **21** |
| Backend test files under `/tests` | **370** |
| Frontend test files under `/tests` | **639** |
| Playwright E2E `.spec.ts` files | **303** |
| GitHub Actions workflow definitions | **3** |

These are structural counts, **not** counts of features proved working, routes fully tested, or unique test assertions. Most of the reported 281 MB of tracked file contents is in frontend source/assets; binary/media presence should not be confused with verified product or vehicle records.

**No existing native app project was found:** the tracked tree contains no Expo project, React Native app manifest, native `ios`/`android` application structure or `apps/mobile` package. `frontend/app` is the **Next.js App Router**, not a native mobile application.

## 2.2 Evidence labels used throughout

| Label | Meaning |
|---|---|
| **SOURCE** | Code, route, model, component or test exists in the inspected `master` snapshot. |
| **RELEASE RECORD** | A dated repo document describes publication or a hosted acceptance on a specific older runtime. It does **not** verify the current latest commit is live. |
| **CI VERIFIED** | A documented GitHub Action succeeded against an identified source SHA. |
| **GATED** | Code/support exists but a feature flag, policy, provider or real business data restricts practical use. |
| **PARTIAL / IN PROGRESS** | Missing acceptance, unmerged change, genuine operations setup or a known contract gap. |
| **PROPOSED APP** | New mobile-product requirement, **not** claimed to exist on the website. |
| **OWNER DECISION REQUIRED** | Product, finance, privacy, fulfilment or safety policy must be confirmed by an authorized business actor. |

**Current CI signal:** at the exact `master` SHA, [Backend database safety run 41764169273](https://github.com/Otto-space/allied-autotech/actions/runs/41764169273), [Frontend release checks 41764169257](https://github.com/Otto-space/allied-autotech/actions/runs/41764169257) and [Redacted repository secret guard 41764169248](https://github.com/Otto-space/allied-autotech/actions/runs/41764169248) all concluded successfully on 4 November. That is strong source-level release-gate evidence; it is not proof of merchant enablement, real staff acceptance, device testing or exact-current production deployment.

# 3. Business and product scope

**Business:** Allied AutoTech / Allied Autotech Limited, an automotive service and vehicle-solutions company at **133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria**. The canonical app-facing source file currently gives `support@alliedautotech.com` and `+234 813 607 5567`. Treat these as reviewed project content, not permission to invent additional branches or contact options. The owner-approved working-hours record currently says **Monday–Saturday, 08:00–18:00 Africa/Lagos**, subject to real closures/calendar configuration. The website separates workshop availability from a guaranteed open appointment.

## 3.1 What Allied AutoTech offers

- **Workshop services:** eight business service groups, specific published jobs, concerns/diagnostics, appointment requests, staff review/confirmation, estimates, work orders, and quality workflow.
- **Parts, oils and essentials:** categories, brand/part number, condition/classification, searchable products, images, availability, cart, quotes, fitment evidence and branch pickup.
- **Vehicle marketplace:** controlled company stock and sales listings, rich condition/specification filters, owner photographs and material-fault disclosure, saved listings, requirements enquiries, inspection requests and downstream sales/handover records.
- **Customer care:** enquiries, complaints, threaded replies, status changes, human handoff, service questions, notifications, Help Centre and guided education.
- **Business operations:** staff responsibilities, branch-scoped work queues, inventory, payment/invoice/aftercare administration, financial exception handling, audit/privacy policies and owner-specific controls.

## 3.2 Owner service groups in the product

The repository carries eight approved group destinations; their labels should stay synchronized with the actual public service-category API rather than become eight hard-coded mobile promises:

1. Tyre & Wheel Maintenance.
2. Vehicle Diagnostics & Inspections.
3. ECU Programming & Vehicle Electronics.
4. Suspension Repairs.
5. Engine & Drive System Maintenance.
6. Vehicle AC Maintenance.
7. Bodywork & Painting.
8. Interior Repairs.

**Important distinction:** a category can be published even if it has no listed individual priced service. The mobile app must offer an *Ask about this service* path instead of inventing a price or a bookable slot. Repository handoff records a published **Tyre Change price of ₦1,000**; it does not authorize guessing prices for other work. Source: [`docs/OWNER_SERVICE_STRUCTURE_20261030.md`](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/docs/OWNER_SERVICE_STRUCTURE_20261030.md) and [`docs/DELIVERY_HANDOFF_20261101.md`](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/docs/DELIVERY_HANDOFF_20261101.md).

# 4. Existing system architecture

```text
WEB / EXISTING                                  NEW MOBILE / PROPOSED
Next.js 16.4.3 + React 19                     Expo / React Native + TypeScript
Public / customer / staff / admin             Customer-first experience
Same-origin /api/v1 browser gateway           Reviewed mobile auth/session + API client
             |                                         |
             +-----------------+-----------------------+
                               |
                       Express 5 API (/api/v1)
            Authentication | authorization | Zod contracts
   Services | fitment | orders | payments | vehicles | support | policies
                               |
              Prisma 7.10 + PostgreSQL (source of truth)
                               |
     Durable event outbox | background workers | scheduled jobs | audit
              /             |              |               \
       Resend/email    Push providers    Object storage    Payment adapters
         (gated)      (web today)       (private/public)  (activation gated)
```

**Hosting documented:** Next.js frontend on Vercel; Express API, database and workers on separate DigitalOcean infrastructure; Cloudflare for DNS/edge; object storage compatible with AWS S3. Integrations include Resend for transactional email, Google Workspace groups, Paystack/Monnify adapters, browser push, and a server-side OpenAI Responses adapter for Allie. Provider presence in source does not imply production activation.

## 4.1 Frontend architecture (SOURCE)

- Next.js App Router, TypeScript, React 19, Tailwind CSS 4, Zod, React Hook Form, Lucide icons and server-rendered public catalog pages.
- One public site with `/services`, `/parts`, `/vehicles`, `/search`, `/about`, `/contact`, `/help`, `/learn`, authentication and purchase journeys.
- `/dashboard` is the customer account hub; `/admin` is the staff/administrator/owner operational shell, with navigation built according to actual grants.
- Shared typed API client, stale-response/session invalidation, secure same-origin rewrite, error normalization, resource-level loading/retry states, form drafts and review dialogs.
- Assets and brand UI built around red/dark navy/white with genuine workshop/product/vehicle media. Quicksand is used heavily; avoid inventing alternate brand fonts or imagery.

## 4.2 Backend architecture (SOURCE)

- Express controllers adapt validated requests; domain services own transactions and authorization; repositories expose restricted Prisma projections.
- 21 bounded-module areas: audit, billing, catalog, customers, fitment, health, identity, inventory, learning, media, notifications, orders, organization, overview, payments, policies, promotions, service-operations, support, vehicle-sales, vehicles, plus cross-cutting infrastructure.
- **104 Prisma models / 77 enums / 97 committed migrations** at snapshot. Existing models express historical/financial invariants, workforce scopes, saved cars, stock and source evidence—not just CRUD tables.
- Worker files cover booking reminders, notifications, browser push, customer/support email, outbox, retention, expiration, reconciliation, payment/refund/webhook retries, media cleanup and operational alerts.
- OpenAPI is generated from backend contracts. The backend's canonical `allied-autotech.openapi.json` is a large generated artifact; do not manually author alternate mobile business semantics from it without regeneration from source.

## 4.3 A non-negotiable integration rule

**The mobile app must be another verified client of the existing system, not a new source of truth.** The mobile application may cache public display data and store limited device state, but booking confirmation, service prices, compatibility approval, available stock, invoice totals, payment settlement, permissions, reservation status and complaint decisions must remain server-authoritative.

# 5. Existing website: public experience map

| Existing route / group | What it contains in source | Mobile implication |
|---|---|---|
| `/` Home | Hero carousel, service/parts/vehicle previews, workshop story, reviews, helpful onward routes | Compose a personalized, action-led Home instead of copying a long marketing page. |
| `/services`, `/services/[serviceId]` | Eight groups, service discovery, detail descriptions, concern/enquiry actions | Service category cards, clear what is known/not priced, contextual booking eligibility. |
| `/services/request` | Concern/booking draft path when capability permits | Stepwise intake; sign-in handoff and explicit pending request status. |
| `/parts`, `/parts/[productId]` | Catalog search, filters, grades/categories, fitment picker, availability and product detail | One search, selected car, clear compatibility confidence, easy ask-a-technician. |
| `/cart`, `/checkout` | Cart and guarded purchase flow | Use only when capability says enabled; quote and stock review before payment. |
| `/vehicles`, `/vehicles/[listingId]` | Listings, photo gallery, filters, disclosed faults, enquiries, inspection | Car-focused gallery, truthful status, save/share, inspect; no invented reservation. |
| `/search` | Cross-catalog public search with scopes and recovery | Federated search into Services/Parts/Vehicles/Help; preserve query and filters. |
| `/contact` | Public enquiry/contact, location/directions, support access | Human support action with channel, hours, expected acknowledgement. |
| `/help/[slug]`, `/help`, `/learn` | Help Centre, versioned guides/practice and optional Allie | Searchable help, guided next steps; AI only if released and policy-reviewed. |
| `/reviews` | Moderated public reviews and source-backed testimonials | Trust signals; allow review only from eligible genuine experiences. |
| `/login`, `/register`, `/mfa`, reset/verify | Account/credential recovery and MFA flows | Native identity security design; no web-cookie shortcuts. |
| `/purchase/...` | Account-optional verified purchase/order/invoice/payment/aftercare surfaces | Guest continuity and claim/verify later, with device-bound privacy. |
| `/privacy` | Public notice | Native consent/privacy summary linking to authoritative full policy. |

The current home has `HomeHero`, `HomeFeaturedServices`, `HomeWorkshop`, product/vehicle previews, reviews and a contextual service enquiry. These are useful content concepts, not a template for a mobile tab. Source: [`frontend/app/components/public-home.tsx`](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/app/components/public-home.tsx).

# 6. Identity, audiences and role boundaries

| Principal | Available business purpose | Do not assume |
|---|---|---|
| Anonymous visitor | Browse genuine public catalogue, read Help, submit permitted enquiries | No private garage, payments or personal records without access checks. |
| Guest purchaser | Account-optional verified purchase and privately scoped receipts/aftercare when enabled | A guest email alone must not grant access to another person's order. |
| CUSTOMER | Own garage, bookings, orders, support, notifications, payments, profile, privacy and saved items | Cannot read other accounts or internal workshop notes. |
| STAFF | Branch/assignment-scoped operational work, where currently enrolled and explicitly granted | Job title does not itself grant permission; do not use generic admin access. |
| ADMIN | Approved operational administration; current MFA/account rules | No automatic owner-only policy or independent financial approval powers. |
| SUPER_ADMIN | Verified owner-level administrative and policy functions | Not a mobile shortcut for bypassing MFA, four-eyes approval or audit. |

**Workforce model:** `WorkforceAccess` and `WorkforceAssignment` track explicitly enrolled/assigned responsibilities with branch, scope, expiry, actor and history. Operating Supervisor, customer-care roles, sales, accountant, workshop lead and technicians use different projections and actions. Even two staff members with the same title need not share the same data access. Source: [`backend/docs/workforce-dashboard-access.md`](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/workforce-dashboard-access.md).

**Recommended mobile release boundary:** ship one **consumer app** at first. Later, offer a separately secured **staff companion** or clearly separated workspace that authenticates against the same server and evaluates live permissions on every action. Keep owner financial policy, refunds, role changes, audit/export and release controls **web-first** until an independently reviewed mobile contract exists.

# 7. Domain-by-domain implementation and product audit

## 7.1 Accounts and security — SOURCE; live-device acceptance PARTIAL

Existing backend stores opaque HMAC-digested sessions with HttpOnly browser cookies, session-bound CSRF, strict origins, MFA (TOTP/WebAuthn), recovery codes, Argon2id passwords, security sessions and audit records. Every privilege-changing and payment-sensitive action must be verified server-side. Customer authentication exists, but **a native session contract does not yet exist**. A React Native app should not simply copy `/api/v1` browser cookies or store web CSRF/session tokens in AsyncStorage. Design a dedicated reviewed mobile authentication mechanism (Section 19).

## 7.2 My Garage — SOURCE; app presentation PROPOSED

`CustomerVehicle` stores make/model/year and optional detailed vehicle/fitment identifiers, nickname/default choice and private media relationships. The website supports saved vehicles, images, editing, default/recent selection, and service association. The highest-value mobile innovation is a **single car card** showing the saved vehicle, verified next booked service, past service work, applicable fitment context and owner-controlled attachments. Do not infer registration/VIN/specs or service due dates when missing.

## 7.3 Services and booking — SOURCE; operational launch GATED

Service categories, prices (fixed versus quote-required), duration, preferred slots, concern intake, booking requests, staff alternative proposals/confirmation, status timelines, reschedule requests, reminders and calendar components exist. The backend separately models Booking, BookingSlot, ServiceQuote, WorkOrder, BookingTimingSnapshot and BookingResourceAllocation. Customers may request an appointment; a chosen preference does **not** automatically become confirmed availability. Actual calendars, people/equipment/bay constraints and staff acceptance remain essential. The app should show the difference at every step.

## 7.4 Work orders and quotations — SOURCE; complete real-role journey PARTIAL

Versioned service quotations, line items, customer review/accept/decline, work-order status and technician/quality workflow are modeled. An issued quote is an immutable financial snapshot; acceptance and service progress are not equivalent to paid settlement. For mobile, show a readable quote breakdown, a review step, validity, the service/parts distinction and clear *Who needs to act next?* messaging. Never allow edits to the actual priced quote through the client.

## 7.5 Products, oils and compatibility — SOURCE; genuine catalogue data PARTIAL

The catalogue supports categories, product family, searchable names/identifiers, brand/MPN, images, condition and genuine/OEM versus aftermarket classification. Engine oils have grade and pack-volume facts, not automatic fitment proof. ProductCompatibility includes draft/pending/approved/rejected/retired evidence and explicit exclusions; the public finder narrows candidates but clearly says *confirm suitability with our team*. The mobile app should make **Fitment status** prominent and distinguish possible match, approved technical evidence, exclusion and unknown—not a reassuring green check based only on make/model/year.

## 7.6 Cart, guest purchasing and parts quotes — SOURCE; activation GATED

Cart/CartItem, selection of vehicle context, quotations for listed/unlisted parts, purchase guest sessions, purchase review, Order/OrderItem, checkout, invoice, order aftercare and idempotent recovery are modeled and visible in route/component inventories. Later November source includes account-optional purchase paths and an explicit compatibility/availability review before payment. Owner decisions say purchases are approved *in principle*; actual checkout still depends on financial policy, genuine stock and provider/worker activation. The mobile app may expose guarded read-only carts or enquiries before enabling paid checkout.

## 7.7 Vehicle marketplace — SOURCE; paid holds/reservations GATED

Stock records, sale listings, galleries, price-history audit, legal documents, condition reports, inspections, enquiries, sales transaction statuses and handover workflows exist. Vehicle filters include condition (new, foreign used, locally used, unspecified used), final-assembly country, powertrain (BEV/HEV/PHEV/ICE), body style, transmission, fuel and relevant price/year fields. Unknown details must stay blank. An owner's BMW sample is documented as published with seven approved images and its AC fault disclosed; this does not establish a general abundance of stock. The mobile app should emphasize **Enquire / Request inspection / Save**; paid reservation or guaranteed purchase requires a separately authorized activation.

## 7.8 Collection orders, aftercare and invoices — SOURCE; policy/operations GATED

Current owner direction retains **workshop collection only**, with delivery deferred. Source includes status transitions, aftercare requests, private invoices/payments and original-request recovery. The approved policy direction includes a standard in-stock five-business-day holding concept and private order-specific pickup code for third-party collection; actual calendar/counting and custom-order holds require approved operational configuration. In the app, *Ready for collection* must be a real recorded state; a generic order confirmation is not pickup authorization.

## 7.9 Payments, reconciliation and refunds — SOURCE; live commerce GATED

Paystack/Monnify adapters, verified attempts, durable webhook events, unique payment identities, ledger entries, anomalies, disputes, reconciliation, manual review and multi-person refund approval exist. Amounts use exact integer **kobo**. A browser return/SDK callback is not proof of settlement. Historical documents explicitly show Paystack production mode disabled while merchant NGN eligibility, callback/webhook registration and test-mode acceptance remained incomplete. The mobile app must never send authoritative amount/currency, mark an invoice as paid optimistically, or retry an uncertain payment without querying the server.

## 7.10 Customer care and live support — SOURCE; provider/workforce acceptance PARTIAL

Public and customer support enquiries, complaints, threaded messages, confidential staff notes, assignment, human live-coverage/presence and AI-to-human handoff modules exist. Responses are scoped to the owner and authorized team. Target acknowledgement is within 30 minutes **during customer-care hours**, not a guarantee of resolution. The mobile support experience should put **Talk to a person** ahead of chat-bot complexity and show communication thread/state, expected acknowledgement and recovery for failed submissions. A chat interface or a sent email queue is not independent proof of staffed live support.

## 7.11 Notifications and push — SOURCE for website; native push NEW WORK

Notification inboxes, categories, read/unread, preferences, outbox, email/SMS concepts and **browser web-push** subscriptions exist, including consent/revocation. A native app requires separate APNs/FCM token registration, consent, session/device binding, logout cleanup, safe payloads and notification deep-link validation. Web VAPID subscriptions are **not** interchangeable with native tokens. Do not mirror private message bodies or vehicle/financial detail to phone lock screens by default.

## 7.12 Help, Learn, Practice and Allie — SOURCE; AI GATED

Help Centre, versioned task guides, Learn/Practice, role eligibility, destination validation and a server-side Allie Responses adapter are in the repository. A November handoff records published Help but absent live AI key/model/quota configuration; do not advertise Allie as available merely because components exist. In the app: use structured Help/FAQ offline where appropriate; show **Allie** only when the actual capability is enabled and privacy terms are reviewed; maintain human escalation and no made-up stock/availability.

## 7.13 Reviews, promotions, retention and privacy — SOURCE; new incentives PROPOSED

Verified-source review submission/moderation, promotions and coupon rules, account privacy requests, consent, retention holds and signed private media exist. The app can add retention **presentation** around these legitimate records. It must not add a fabricated points balance, discount, service warranty, personalized price or marketing opt-in by default. Introduce optional loyalty/referral or maintenance contracts only after explicit commercial, consent, accounting and anti-abuse decisions.


# 8. Evidence-based completion and readiness register

This matrix classifies the **inspected website/backend**, not the proposed mobile implementation. “Source present” means code and a route or model exist; it does not promise that an actual customer can finish the journey against today's production business data. **Anything in the app column is a new delivery requirement even when the website already has an equivalent screen.**

| Product/workflow | Website/backend evidence at this snapshot | Status / important limitation | Mobile app implication |
|---|---|---|---|
| Home, About, Contact, workshop story | Next.js public pages, authentic brand/media components, published releases | **SOURCE + prior RELEASE RECORD**; final device/copy sweep not exhaustive | Reinterpret as a useful app home, not a scrolling marketing copy. |
| Eight service group discovery | Public ServiceCategory/service routes, category cards, import/authoring records | **SOURCE + prior RELEASE RECORD**; an empty group is not a booked service | Show groups with honest “Ask about this service” route. |
| Service details and pricing | Service records, FIXED/QUOTE_REQUIRED, detail pages | **SOURCE**; actual prices/durations depend on published records | Show exact recorded price or “Get a quote”; never make estimates up. |
| Concern-based service enquiry | Support/booking context and customer intake | **SOURCE**; available when capability allows enquiries | One-minute photo/voice-optional text enquiry with review. |
| Booking request, proposal, confirmation | Booking/slot/capacity components, booking history and API | **SOURCE; activation/real capacity GATED** | Distinguish preferred time, proposed time and confirmed appointment. |
| Customer cancellation and rescheduling | Booking actions, reschedule requests, versioned history | **SOURCE; owner cutoff/operational review PARTIAL** | Use only currently eligible server actions and approved policy text. |
| Physical arrival, waiting, staff absence check | Attendance proposal on open draft PR #20; compatibility PR #22 | **NOT MERGED to master** | Do not claim geofenced check-in or verified arrival now. |
| Remaining-work capacity allocation | PR #23 and existing reservation/capacity master work | **PARTIAL; PR #23 unmerged; frontend PR CI failed** | Never display invented precise bay/technician availability. |
| Customer saved garage | CustomerVehicle, photos/default, account garage pages | **SOURCE; sampled responsive acceptance** | Make this the anchor of personalized experiences. |
| Detailed service history/quotes/work orders | Booking, ServiceQuote, WorkOrder and customer-safe projections | **SOURCE; some data remains staff-private** | Show only verified customer-facing history and documents. |
| Parts/product catalogue | Products, categories, media, search, facets | **SOURCE**; actual data/stock quality can be sparse | Browse with genuine descriptions, images, empty states. |
| “Find Parts for My Car” | VehicleMake/Model, ProductCompatibility, user picker, reviewer UI | **SOURCE; fitment evidence and real approvals required** | Preselect saved vehicle; show “possible match / confirmed / not verified.” |
| Product favourites/cart | ProductFavourite, Cart, CartItem, associated views | **SOURCE; purchase may be GATED** | Retain items and provide relevant enquiry instead of broken checkout. |
| Guest purchasing and private receipts | PurchaseGuest and related sessions/records; public purchase routes | **SOURCE; monetary launch GATED** | Preserve optional account; mobile handoff needs secure guest ownership. |
| Parts quotation acceptance | PartsQuote, quote workflows, guest/customer views | **SOURCE; real offer approval and purchase gates** | Quote inbox with expiry, line items and one clear next action. |
| Collection orders/pickup | Order lifecycle, fulfillment facts, aftercare | **SOURCE; real collection configuration PARTIAL** | Collection details, actual “Ready” state and private code only when live. |
| Aftercare/returns | OrderAftercareRequest, staff review, original-request recovery | **SOURCE; broad refund/return policy unresolved** | Make “Get help with this order” always discoverable. |
| Vehicle stock/listings/advanced facets | Vehicle, VehicleListing, public filters, photo handling | **SOURCE; real content/facts variable** | Save vehicles, compare genuine specs, keep condition/fault disclosures. |
| Vehicle enquiries, requirements and inspections | Enquiry types, InspectionRequest, sales transaction views | **SOURCE; appointment capacity depends on approval** | Lead with Enquire/Inspect; no fictional paid hold. |
| Sale, payment and handover records | VehicleTransaction, payment/status and handover models | **SOURCE; policies and live money GATED** | Display history only for actual eligible owner records. |
| Login, sessions, MFA, account security | Identity APIs, opaque browser cookies, TOTP/WebAuthn | **SOURCE FOR WEB; mobile auth NOT BUILT** | A mandatory dedicated mobile-security implementation workstream. |
| Customer notifications and web push | Notifications, preferences, Web Push and workers | **SOURCE FOR WEB; provider/device delivery needs acceptance** | Native push registration/consent is new; do not reuse VAPID directly. |
| Support, complaints and human handoff | Support messages, conversation/coverage and notifications | **SOURCE; live staffing/response evidence partial** | Persistent case history, one-touch escalation, no phantom online agent. |
| Help, Learn and Practice | Versioned knowledge and eligibility | **SOURCE; published Help in prior runtime** | Native help and deep links; static FAQ when AI off. |
| Allie AI | Server Responses adapter, bounded context and retrieval | **SOURCE; live paid activation GATED** | An optional assistant, not an MVP dependency or emergency tool. |
| Roles/workforce and managed permissions | WorkforceAccess/Assignment, policies, admin pages | **SOURCE; actual employee enrollment/assignments require approval** | Only customer endpoints in MVP. Staff separate after threat review. |
| Payments/Paystack/Monnify/refunds | Financial modules, provider adapters, immutable ledger | **SOURCE; merchant acceptance, publication and real operations GATED** | Never ship mobile money features independently of server capability. |
| Privacy requests and consent | ConsentRecord, PrivacyRequest, account privacy views | **SOURCE**; full legal retention enforcement/approval separate | Mobile export/delete/contact, granular push/marketing settings. |
| Native iOS/Android application | No native project found in tracked tree | **NOT IMPLEMENTED** | Entire new app project, secure transport and QA are required. |

## 8.1 What “finished” means here

The **platform foundation**, many routes, workflows, schemas, UI components, tests and prior releases are substantial. A complete customer operating model requires a second definition of done: real services and people configured, permissioned staff able to perform duties, honest published inventory/fitment, payments and notification providers accepted, and physical-device plus accessibility journeys signed off. Do not label all of that “done” because the application compiled.

# 9. Incomplete work, dependencies and release blockers

## 9.1 Highest-impact active dependencies

| ID / urgency | Work still required | Accountable party / suggested action | Blocks |
|---|---|---|---|
| **G01 / P0** | Publish **real workshop schedules**, holidays/closures, exact service durations, preparation/cleanup, employee skills, equipment/bay capacity; check technician availability. | Owner and workshop lead supply facts; Codex validates and exposes only approved values. | Confident appointment time offers, booking activation. |
| **G02 / P0** | Complete payment-provider merchant/test-mode registration and verified signed webhook, return, duplicate/late event and reconciliation flows; review live enablement. | Owner/finance configures protected Paystack account; engineers run test-mode acceptance. | Real checkout, settlement claims, card payment in app. |
| **G03 / P0** | Verified finance business identity, Tax ID/CAC applicability, invoice publication, applicable VAT exceptions, policy effective date and authorized approver. | Owner/accountant approves; Codex supports exact versioned policy and invoice output. | Issued payable invoices and monetary launch. |
| **G04 / P0** | Genuine catalogue records, images, stock, item types, manufacturer part numbers and vehicle compatibility technical evidence/review. | Operations, parts specialist and owner supply evidence; staff review fitment. | Trustworthy shopping/pickup and safe compatibility claims. |
| **G05 / P0** | Real collection/holding rules: branch counter, eligible times, business-day counting, custom-order cases, verification, third-party pickup code and exception management. | Owner/operations approves policy; staff accept using real orders. | Collection promise, pickup code and operational flow. |
| **G06 / P0** | Separately design and threat-model **native authentication**; WebAuthn/MFA enrollment and session revocation, deep-link, secure storage and lost-device cases. | Mobile/backend security workstream. | Any signed-in customer app release. |
| **G07 / P0** | Native notification permission, per-device token registration/retirement, safe pushes and exact account-bound deep links. | Mobile/backend workstream; publish only after provider/devices accepted. | Push-based retention; inbox remains a fallback. |
| **G08 / P1** | Real signed-in Customer, Staff, Admin and Super Admin integration checks where permissioned; genuine business-data journeys, storage/upload, real messaging. | Owner-authorized test identities; independent QA. | Production acceptance, separate staff companion. |
| **G09 / P1** | Physical Android/iPhone testing, Safari/iOS behavior, dynamic/200% text, keyboard, assistive tech, offline/poor-network, accessibility audit. | Mobile QA and accessibility reviewer. | Public mobile release sign-off. |
| **G10 / P1** | Reconcile status of latest `master` commit against **actual backend and frontend deployment identities** and exact feature flags. | Release engineer using hosting dashboards and read-only APIs. | Claims about what is *live right now*. |
| **G11 / P1** | Finish genuine vehicle media, missing descriptions/faults and compliant condition evidence; avoid unverified prices/duties. | Stock team and authorized vehicle reviewer. | Credible vehicle marketplace and inspection handoffs. |
| **G12 / P1** | Resolve known stock-search API mismatch: schema accepts some inherited filters not applied by repository; specify support or reject unsupported parameters. | Backend contract owner. | Future stock operator filtering, not customer MVP. |
| **G13 / P1** | Real provider acceptance for Allie, including model/quota/billing/retention and factual grounding. | Owner and AI/reliability engineers. | Only optional AI feature; must not block core app. |
| **G14 / P1** | Document and approve broader refunds, warranties/returns, cancellation cutoff and exceptional order/service handling. | Owner, finance and customer care. | Relevant policy-sensitive actions and copy. |
| **G15 / P2** | Complete role/page-wide UX register, cross-browser evidence and remaining public/authoring refinements. | Frontend team/QA. | Experience quality; prioritize real journeys first. |

### 9.1.1 Open pull requests — distinguish from `master`

At the audit snapshot there are **three open pull requests**. Do not merge or apply their behavior by implication:

- **[PR #20 — Record physical attendance and staff-verified missed appointments](https://github.com/Otto-space/allied-autotech/pull/20):** *draft*. Proposes actual arrival, agreed waiting, departure, eligible staff verification of missed appointments and append-only history. Existing customer RSVP is **not** physical attendance. Proposed migration number **98** requires strict sequencing and additional acceptance; not a customer self-check-in feature.
- **[PR #22 — Prepare the missed-status writer for the attendance migration](https://github.com/Otto-space/allied-autotech/pull/22):** *draft*. Required compatibility protection because an older API can mark a booking `NO_SHOW` without evidence, which conflicts with PR #20's stronger DB rule. An old API starting successfully against the new schema does not prove operational write compatibility.
- **[PR #23 — Review remaining workshop work against actual capacity](https://github.com/Otto-space/allied-autotech/pull/23):** *open, not draft*. Adds actual remaining-work estimate and equipment/space selection. Its description reports 118 local integration/learning checks and a 98-migration isolated replay, but the latest observed frontend PR check **failed**. It requires fresh backup, populated restore, compatibility and full exact-master verification before any release. This is not currently deployable by assumption.

**Critical sequencing:** review PR dependencies/conflicts against a newly fetched `master` before any change; keep existing 97 migrations immutable; do not deploy migration 98 while older `NO_SHOW` writers remain incompatible; perform backup, actual populated separate restore, migration rehearsal, exact-source CI and post-release verification using the repository's rules. Mobile development must rely on current stable booking contracts until a separately approved backend rollout is complete.

## 9.2 Time-ordered evidence and documents that can mislead an agent

The 1 November delivery handoff documents a real release with 83 migrations and states that the core booking/Paystack/Allie source was implemented but merchant, AI and workshop activation were incomplete. Subsequent published-release records on 2–3 November contain more schema and UX changes. On 4 November the tracked main branch has **97** committed migrations. Therefore **do not reuse the 83-migration release's implementation status or latest production SHA as the status of all 4 November code**.

The top of `backend/docs/site-completion-tracker.md` says the public-search change is “not yet merged”; that text is a historical *working checkpoint*. GitHub verifies PR #24 **is merged into the audited master**. Conversely, a merge and green CI do **not** prove the search fix is in the deployed production build. Confirm the current hosting identity rather than trusting either stale release text or successful CI alone.

Some legacy domain docs describe a 30% booking deposit or automatic forfeiture, while later signed owner decisions explicitly changed this to **request-then-confirm, deposits disabled**. Some earlier hours records distinguish Saturday, but the 2–3 November owner decision supersedes them to **Monday–Saturday 08:00–18:00**. Later authorized policy and environment state take precedence over superseded implementation notes. Maintain a provenance/effective-date record instead of silently editing financial history.

# 10. Verification and production-confidence map

## 10.1 What the latest green CI actually proves

The three GitHub Actions on `80e95a3` succeeded. That is evidence the latest integrated source passed the repository's configured frontend, backend/database-safety and secret checks. The frontend workflow runs lint, TypeScript, unit, build, formatting and its defined browser gates; the backend safety workflow has extensive isolated tests, migration replay and contract checks. Counts from historical tasks are **not additive**: the same test can run in CI, local and hosted fixtures.

There is positive prior evidence of native browser inspection of the **real public site** at seven viewport sizes and synthetic account/role fixtures. There is also explicit documentation of limits: no blanket real-role production sign-off, no comprehensive physical-phone Safari or screen-reader validation, no provider-backed payment settlement and no guaranteed live customer push delivery. An **intercepted provider response** proves application behavior under that fixture, not a merchant test transaction.

## 10.2 Minimum evidence required before calling a new feature available

| Readiness level | Requirement | Honest wording |
|---|---|---|
| 0 — Design | UX mock and written acceptance criteria only | Proposed, not implemented. |
| 1 — Source | App/backend code exists and static checks pass | Implemented in source. |
| 2 — Isolated | Native database/API integration and automated UI tests pass | Verified in isolated conditions. |
| 3 — Hosted | Matching exact-source backend/frontend/app staging acceptance passes | Verified in staging, with limits. |
| 4 — Operational | Real owner-configured business data, permissions and external providers pass | Operationally accepted. |
| 5 — Released | Store builds are approved, feature flag on, telemetry healthy, rollback available | Available to eligible customers. |

For a mobile app, also require app-store signing and permissions, device matrix, crash monitoring, API compatibility, privacy store disclosures, deep-link ownership and safe downgrade on a backend outage. Neither published website screenshots nor App Store approval alone supersede the other layers.

# 11. Mobile product strategy

## 11.1 Product promise and customer jobs

**Promise:** *“Everything about your car care, purchases and requests—clear, convenient, and in one place.”* The app is valuable even without an active purchase. A customer should be able to ask a real question, remember which car they own, see what actually happened at the workshop, understand a pending appointment or order, and reach a human.

Four evidence-informed jobs-to-be-done:

1. **Uncertain driver:** “My vehicle makes a noise or my AC is not cooling. Help me describe the issue, request support and know what to do next.”
2. **Busy returning customer:** “I have a car that was serviced. Show me its recorded history, upcoming confirmed visit, documents and next real action.”
3. **Parts buyer:** “Help me search for a part, verify that it suits my specific vehicle, and clearly explain collection and payment.”
4. **Vehicle shopper:** “Show actual listings, images, known faults and filters; let me save options, ask questions or request an inspection without being pressured.”

A separate optional staff job is: “Show only my assigned bookings, jobs and customer requests, with safe evidence and no owner-only actions.” That is **not the customer MVP**.

## 11.2 Product principles

- **Useful before promotional:** important care/action cards precede banner advertising. Empty dashboards offer one meaningful journey, not ten empty metric counters.
- **Trust earns retention:** precise statuses, approved compatibility evidence, material fault disclosure, real images, real contact paths and privacy protections matter more than animations.
- **Saved car is the personalization unit:** default vehicle + actual data, not inferred diagnosis or guessed mileage.
- **Progress is visible:** a request stays *Awaiting review* until a human genuinely confirms it; a paid-looking screen remains *Checking payment* until the backend verifies settlement.
- **A guest can get help:** browsing, service/parts enquiries and applicable guest checkout do not force account creation. Suggest account creation only where it adds continuity.
- **Human help remains primary:** Allie is optional and the “Talk to our team” path is always obvious.
- **Quiet by default:** transactional alerts are useful; marketing messages require separate permission and controls. No false urgency, countdowns based on guessed service intervals or nagging to leave reviews.

## 11.3 Personalization without overclaiming

Use a small selection of real inputs: signed-in profile first name, explicitly selected default garage vehicle, recent eligible booking/order, genuine unread support reply, issued unpaid invoice, pickup-ready order, a saved listing and the customer's notification preferences. **Do not** infer vehicle health scores, kilometres driven, manufacturer service deadlines, ownership income, customer risk or technician promises from missing records. When the system lacks a fact, show a neutral option such as **“Add your vehicle to get relevant results”** or **“Ask us about service timing.”**

# 12. Mobile information architecture

The recommended structure is a **five-tab customer app**. Primary tabs should be stable, reachable with one thumb and have clear nouns. The shell should not mirror the website's complex role-specific administrative sidebar.

| Tab | Purpose | High-frequency content |
|---|---|---|
| **Home** | Your current care and attention queue | Next confirmed visit; open request; quote to review; pickup-ready order; recent support reply; default car. |
| **Explore** | Find services, parts, vehicles | Unified search with explicit `Services / Parts / Vehicles` scopes and browsable categories. |
| **Garage** | Vehicles and car-care continuity | Saved cars, photos, default vehicle, real appointments/service history, parts-finder shortcut. |
| **Activity** | Every active/previous transaction in one place | Bookings, service quotes, orders, inspections, invoices, payments, support and aftercare. |
| **You** | Profile, controls and assistance | Account/security, notifications, Help, privacy requests, contact and sign-out. |

**Global access:** a clearly labelled **Support** icon or action on relevant screens; cart shortcut on Explore/Parts; actual notification inbox badge in Home/Activity; persistent Back behavior on nested screens; searchable activity filters. The bottom tab bar respects iOS/Android safe area, remains legible at 200% text and never covers a pay, save, review or submit control. Incompatible features disappear or present an honest explanation based on current server capabilities, never by hardcoded fake readiness.

### 12.1 Signed-out navigation

Home displays nearby business context and three useful choices: **Describe a vehicle problem**, **Find a part**, **Explore cars**. Explore works without login. Garage and Activity show a considered sign-in invitation with the reason; they are not dead ends. The email-verified guest purchase access already in the website must be researched for a secure native equivalent before any logged-out transaction history is displayed. Contact and Help stay reachable.

### 12.2 Signed-in navigation

Home opens with a first-name greeting and a card for the **single most actionable verified event**. Then show default-vehicle context, next pending/confirmed appointment, active orders and a visually quiet “What can we help you with?” row. Avoid large paid-promotions surfaces that displace an invoice, complaint or scheduled pickup. Sign-out appears in **You → Account**, not as a floating unlabeled power icon.

# 13. Detailed native screen specification

Each screen below describes **required app behavior**, not a promise that an identical mobile endpoint already exists. Use current OpenAPI/server permissions to build; where the server lacks a mobile-safe projection, write a minimal additive backend contract first. Every screen must handle: initial loading, authoritative empty state, partial failure, full error/retry, offline, signed-out/expired session, unavailable capability, pending submission, confirmed saved result and permission loss.

## 13.1 Customer onboarding and identity

**S01 — Welcome/Entry (P0):** a branded cover with *Explore without an account*, *Sign in*, *Create account*. Explain in one sentence why a garage account helps. Never force an account before public discovery or enquiry; avoid automatic push permission prompts during onboarding.

**S02 — Sign in/Sign up/Verify (P0):** accessible labelled email/password forms, show-password toggle, concise validation, email verification state and link-expired recovery. Avoid social sign-in until an authorized identity provider is supported. Signup and verification responses must not reveal account existence unnecessarily. Browser cookie auth cannot be silently reused in native clients.

**S03 — MFA and account security (P0):** implement the backend's eligible factor flow with an approved native session design. Support TOTP and approved WebAuthn/passkey or fallback based on actual backend capability, with sensitive-factor recovery and current-device/session termination. Never present a biometric local unlock as a substitute for the server's authentication/MFA guarantees. Device lost/revoked must be a tested scenario.

**S04 — Add your first car (P0; skippable):** make/model/year fields, optional nickname, trim, engine and vehicle photo when supported. Validate only known options and avoid inventing VIN/plate details. Show privacy hints, permit “I'll add this later,” and let the customer select a default. Existing garage record ownership is authoritative.

## 13.2 Home, search and discovery

**S05 — Personalized Home (P0):** one “Needs your attention” stack sorted by actual urgency and eligibility, followed by My Garage preview, service/parts/vehicles entry tiles and readable contact options. Separate Requested, Proposed, Confirmed, Started and Completed states. Suppress future-booking countdown for unconfirmed times. An entirely new customer sees a helpful first action, not artificial charts.

**S06 — Universal Search (P0):** a clear editable query, scope chips and recent searches retained only when privacy settings allow. Search Services, Parts and Vehicles individually or show grouped results. Preserve query, filters and scope across back navigation and failed partial results; do not turn a failed Shop call into “no matching items.” Show result identity (brand + part number, car year/condition, service name) compactly and accurately.

**S07 — Services catalogue/detail (P0):** eight category landing tiles using authentic imagery/icons. Detail includes purpose, known symptoms, approved price or quote status, recorded expected duration **only if available**, photos and “Ask about this” or “Request appointment” depending on capabilities. An empty group invites a specific enquiry; no dummy appointment slots.

**S08 — Shop/parts catalogue/detail (P0):** compact photo/product name, brand, identifiers, labelled classification/condition, real availability; select fitment using default car or manual model. Faceted search and sort must reflect server-supported fields. A “possible match” cannot be converted into “fits your car” without approved qualifiers. Add to favourites/cart only if eligible; otherwise offer quote/enquiry clearly.

**S09 — Vehicles marketplace/detail (P0):** tall, trustworthy photographs; price, condition, model year, mileage and transmission only when recorded; conspicuous fault/condition callout, additional photos, location and real listing status. Filters for new/used/foreign-used/local-use, assembly country, year, budget, body, powertrain and specifications where supported. Actions: Save, Enquire, Schedule inspection (when enabled), Share safe public link. No invented valuation, deposits or guarantee.

## 13.3 Garage and service operations

**S10 — Garage overview (P0):** real owned cars as distinctive image cards, simple default marker, add/edit vehicle, choose one for Parts Finder or service request. Missing photo uses a polished neutral automotive silhouette, never someone else's car. No cross-account data cache.

**S11 — Vehicle detail & care timeline (P1):** anchored car identity, verified visits, quotations, services/parts linked to this car and user-accessible documents/photos. Distinguish “Recorded at Allied AutoTech” from “Added by you” if manual customer notes are introduced. Future owner-authorized maintenance reminders can be an explicit timeline section; do not calculate false service intervals.

**S12 — Service enquiry/request appointment (P0):** steps *Issue → Vehicle → Contact → Preferred date/time (if enabled) → Review → Send*. Keep drafts through temporary navigation but never upload or submit automatically. After sending, show a real case/booking reference and “Awaiting workshop review.” Display an alternative when public booking requests are disabled. Do not charge deposits.

**S13 — Appointment detail/calendar (P1):** visual vertical state progression, last confirmed time, proposed alternative, cancellation/rescheduling eligibility and explicit calendar export. The appointment should enter the device calendar **only with permission**, correct timezone and clear update/removal behavior. Display one-hour/other reminders only if actually configured and delivered; don't assume a push is sent.

**S14 — Quote and work progress (P1):** line-item labour/parts, subtotal, VAT/discount and total from the immutable server snapshot; quote expiry and actual Accept/Decline state. Show a work-order progress tracker only where the customer-safe API proves a state; staff notes remain private. Support “Ask about this quote,” not a client-calculated price.

## 13.4 Commerce, orders and vehicle enquiries

**S15 — Cart / request parts (P0 enquiry, P2 payment):** clear product variants, selected car and suitability, quantities and totals from server, compact editing, trustworthy stock state. When checkout off, keep item context and offer a parts quotation/enquiry. Do not show an unclickable “Buy now.” Preserve account-optional purchase, with backend-supported secure guest session recovery.

**S16 — Checkout / payment confirmation (P2 after gates):** collection-only address and verified holding rules, item-by-item suitability approval, immutable order summary with correct VAT after discount, explicit payment provider handoff, status polling/refetch after return and clear “We’re checking your payment” state. Show no success until server has a verified, matched receipt. Support recovery from app dismissal, callback loss, wrong amount, duplicate webhook, changed stock and expired quote; never automatically charge twice.

**S17 — Order detail / collection (P1 read, P2 action):** customer-readable order progress, distinct *Confirmed*, *Preparing*, *Ready for collection* and *Collected* states, item list, invoice receipt and contact support. Private pickup code/QR requires a real order-specific token, role policy, expiry, replay protection and owner acceptance; never use order number alone as authorization.

**S18 — Aftercare / return or problem report (P1):** choose actual order and eligible line(s), explain issue, attach consented evidence, review and submit. Surface case number, staff review, outstanding documentation and resolution status. Preserve original idempotency receipt and manual outcome reconciliation; don't automatically restock or mark refunded on request submission.

**S19 — Vehicle saved/inspection/requirements enquiry (P0):** saved listing comparison with exact known facts and explicit unknowns, “Find a vehicle like this” form for budget/make/preferences, private enquiry history and real inspection slots when enabled. Display fault disclosure before the request CTA, not hidden under a collapsed panel.

## 13.5 Customer care, messages and settings

**S20 — Activity center (P0):** tabs/filters for All, Appointments, Orders, Quotes, Inspections, Support and Payments. Sort based on last meaningful server event. Group saved references into cards with status/updated date/one clear next action, not dozens of empty statistics. Customer-private data stays invisible when session revalidation fails.

**S21 — Support inbox and conversation (P0):** Start enquiry, My conversations and Contact a human. Show queued/assigned/replied/closed with truthful labels. Photo attachment if explicitly permitted. A long-running complaint keeps an accessible escalation option; customer messages never expose staff-only notes, raw system events or another person's account. If human coverage is offline, state it rather than faking live typing.

**S22 — Notifications (P1 inbox, P1/P2 native push):** message preview, read/unread, safe deep links, category preferences and explicit opt-in. In-app inbox always works when OS push is unavailable. Prioritize confirmed appointments, changes, reply arrivals and actual collection-ready status. Customer controls marketing separately and can mute nonessential categories; quiet-hours behavior must be explicit and owner-approved.

**S23 — Help / Learn / optional Allie (P1):** discoverable concise FAQ, relevant guides at the moment of uncertainty, contact escalation and an Allie entry **only if live capability says yes**. Allie answers show grounded records, appropriate caveats and safe destinations; never predict car diagnosis, price or inventory as if verified.

**S24 — You / Profile / Privacy / Security (P0):** editable permitted profile fields, verified contact, device/session management, notifications, consent/marketing, privacy request, support channels, accessible legal documents and sign-out. Sensitive actions require appropriate reauthentication. Profile picture should not be scraped from contacts or inferred from phone media.

## 13.6 Later professional/staff companion — separate product boundary

**W01 — My assigned work:** branch-scoped booking/job queue, customer vehicle symptoms and task statuses, only after fully enforced workforce assignment and verified MFA. **W02 — Work evidence:** camera with signed upload, technician notes/quality handoff, no unrelated customer information. **W03 — Customer care:** assigned cases, replies and explicit handoff, with internal notes kept private. **W04 — Operations:** booking confirmations, actual capacity, pickup verification and inspection status within active assignment; owner-only finance and grants excluded. **W05 — Security:** MFA/reauthentication, assignment expiry, forced refresh, confidentiality on lock screen. These screens are intentionally excluded from the first customer app store release and need their own source/role acceptance matrix.

# 14. End-to-end customer journeys and interaction rules

## 14.1 Journey A — A new visitor with an AC problem

**Entry:** open app → Explore/Services → Vehicle AC Maintenance → “Describe the problem.” **When booking is restricted:** the action produces an appropriately categorized service enquiry with optional vehicle context and a saved request reference, **not** a confirmed booking. **When booking is enabled:** the customer may proceed to preferred service and date/time selection, review and request, still awaiting workshop confirmation. Avoid forcing account signup for a public enquiry when the current API permits it; if an authenticated appointment is required, preserve the drafted problem through the sign-in transition.

**Success UX:** “We’ve received your question about your vehicle’s AC. Our team will review it.” If a case reference exists, display and allow copy. If no verified reference returned, show **“We couldn't confirm whether your request was saved”** with a safe *Check requests / Contact us* recovery path, never send the same request blindly twice. A support acknowledgement target applies during stated care hours; it does not guarantee a diagnostic outcome.

**Negative checks:** unavailable category, stale catalogue ID, anonymous-to-signed-in context change, permission loss, failed photo upload, network drop after submit, double tap and same idempotency body mismatch.

## 14.2 Journey B — Returning customer preparing for a service appointment

**Entry:** Home → default garage car → current-care card → appointment. Show the actual state, e.g. “Requested — waiting for confirmation,” “A different time was proposed,” or “Confirmed: 11 November, 10:00 WAT” only when supported by the server. In the proposed case, the customer can review and accept/decline only where the API allows. A confirmed appointment may be added to the device calendar with explicit permission. Status/slot changes must update or invalidate stale app-calendar cues thoughtfully; never mark an appointment automatically confirmed by counting down.

**Arrival boundary:** do **not** conflate RSVP/attendance confirmation with being physically present. An actual staff-verified arrival/wait/left record is unmerged draft PR work and does not authorize mobile geofence check-in or automatic no-show penalties.

**After service:** show actual completed work and customer-visible quote or invoice, then a human-readable “Ask a follow-up” action. Propose an optional maintenance check-in **only if** the owner approves an interval/source; avoid inventing mileage-based reminders.

## 14.3 Journey C — Find a real replacement part for a saved car

**Entry:** Garage → “Find parts for this car” → pass recorded make/model/year/technical qualifiers → Parts catalogue/search. Search for a concrete category or identifier such as brake pads. Possible matches are **candidates**, not proof of fit; the backend's reviewed compatibility rule, evidence, include/exclude precedence and technical qualifiers decide whether compatibility can be stated. If unknown, show “Compatibility needs confirmation” and an enquiry path with the selected car and part context.

**Quote path:** Product/part enquiry → relevant staff-issued quote → valid snapshot with quantity/parts/expiry → eligible acceptance → order/payment only if current capability and policy permit. A seven-day quote is not unconditional stock reservation. Before payment, obey owner direction for final suitability and availability review and separate purchase review/exceptions. A changed catalogue price must not mutate an issued historical quote.

**Failure cases:** same make/model but incompatible brake diameter; unknown trim; excluded part; inactive product; no eligible inventory; already-expired quote; same-key replay; order stock changed between review/payment; double purchase attempt.

## 14.4 Journey D — Order then collect

**Entry:** Activity → Order detail. Progress follows the server's true status transitions: request/confirmed, processing, actual ready for collection, completed/cancelled. Provide workshop address, contact/directions and policy-approved collection hours. If a private code exists, reveal it only on eligible ownership and at the correct lifecycle point. A third-party collection flow requires exact authorization and audit; static order numbers or public QR codes do not prove collection authority.

**Payments:** returning from Paystack or another payment screen does not mark the order paid. Re-read authoritative payment/order status, distinguish pending verification/under review/verified success/confirmed failure, and advise against a second payment until the first attempt is reconciled. If payment is disabled, show no payment button. Real aftercare, return request, receipts and human support remain accessible.

## 14.5 Journey E — Shopping for a used car

**Entry:** Explore → Vehicles → filter by actual field values → listing detail. Prominent image gallery, facts/unknowns, all recorded material faults, condition and status. Customer saves a shortlist or submits a requirements enquiry independent of a particular listing. Inspection requests must be shown only where eligible; desired time is not guaranteed. The app can provide a side-by-side comparison of **recorded** year, mileage, engine, fuel/powertrain, transmission, condition and asking price with unknown fields visibly marked “Not recorded.” No invented price evaluation or credit/finance offer.

**Lifecycle:** staff confirms availability and inspection. If subsequent sale records belong to this customer, Activity may show their current transaction, documents or handover state through customer-owned projections. No arbitrary sale completion or paid hold is created by saving a car.

## 14.6 Journey F — A complaint needs a human

**Entry:** order/booking detail → “Report a problem” → select linked record → written concern and optional approved evidence → review → send. The case appears in Activity/Support after the server confirms persistence. A response notification opens the **owned** conversation after session revalidation; if no longer eligible, show generic access-unavailable copy without leaking message contents. The team may assign or escalate internally, while customers see their own case status and safe replies.

**Human-first design:** use a message timeline, clear last update, availability caveat and one persistent “Contact Allied AutoTech” route. An AI assistant may help find published knowledge, but it must not be a gatekeeper for complaints, refund questions or consent requests.

# 15. Customer retention and engagement system

Customer retention is an outcome of **saved value + reliable resolution + timely next action**. Build the retention system as a consent-aware event platform around genuine customer/vehicle records—not a constant stream of push notifications.

## 15.1 Retention opportunities, ranked

| Idea | What the customer gains | Existing foundation vs new work | Responsible first release |
|---|---|---|---|
| **Personal car-care home** | One place for owned vehicles and recent activity | Existing garage, overview, bookings; **new native composition** | **P0**: default car + verified next actions. |
| **Saved service journal** | Trustworthy record of services and quotes at the workshop | Booking, work order, invoice; **new customer-safe timeline** if APIs lack it | **P1**: show only actual completed/issued data. |
| **Your request was answered** | Stop repeatedly checking WhatsApp | Support messages + notification outbox; new native delivery | **P1**: in-app first, consented push second. |
| **Appointment clarity** | Fewer missed appointments and less anxiety | Booking, reminders, calendar | **P1**: actual confirmed time and calendar export. |
| **Collection-ready alerts** | Avoid wasted trips to the workshop | Order statuses and notifications | **P1** after collection lifecycle truly configured. |
| **Parts matched to your saved car** | Less search friction, higher fitment trust | Garage + approved fitment | **P0/P1**: candidate explanation and review/ask flow. |
| **Quotes requiring attention** | Easy response to genuine priced offers | Issued quotes, expiry/decisions | **P1**: valid quote cards, no coercive countdown. |
| **Saved vehicle comparison & changes** | Recall options without repeating searches | SavedVehicle and listing revisions | **P1**: saved list; **P2** price/status alerts only on real change. |
| **Maintenance check-in** | Remember care agreed with workshop | Actual service history partially exists | **P2** after approved intervals + opt-in; no predictive diagnosis. |
| **After-service check-in** | A human route if the repair needs follow-up | Booking completion/support | **P2** via permitted transactional/service outreach. |
| **Education library** | Understand fault symptoms, parts and next steps | Help/Learn/Practice; optional Allie | **P1** static relevant guides; AI only if activated. |
| **Loyalty/rewards** | Perceived appreciation and clarity | Promotion tables are **not a loyalty ledger** | **P3 / owner decision**: design separate audited rules and funding. |
| **Referral invitation** | Optional word-of-mouth benefit | No confirmed referral policy | **P3 / owner decision**; no fictional rewards or contact scraping. |
| **Digital vehicle health record** | Trusted documentation beyond one visit | Existing condition/service records are fragmented | **P3** only with approved provenance, visibility and export rules. |

## 15.2 Event-trigger rules, not imaginary reminders

The following are product proposals. Each requires a real event, eligible recipient, legal/marketing classification, explicit delivery preference and a verified destination before dispatch.

| Real server event | Candidate message | Guardrail |
|---|---|---|
| Staff confirms appointment | “Your appointment is confirmed for [actual date/time].” | Must be `CONFIRMED`; Lagos timezone; suppress if cancelled/rescheduled. |
| Staff proposes alternative time | “The workshop proposed a different time.” | No date claim unless present; link to owned review action. |
| Appointment changes/cancels | “Your appointment details changed. Review the update.” | Idempotent, last authoritative state and no prior stale time. |
| Customer receives human support reply | “You have a reply from Allied AutoTech.” | Generic lock-screen content; no internal notes/PII. |
| Order marked READY | “Your order is ready for collection.” | Only real eligible branch and actual ready state; collection policy visible. |
| Quote is issued | “A quotation is ready to review.” | Actual issued valid quote, not a sales promotion. |
| Quote approaches expiry | “Your saved quotation expires soon.” | Only if permitted reminder rule and actual expiry; no fake urgency. |
| Saved listing price/status changes | “A vehicle you saved has an update.” | User specifically opts in; material change verified; no implied deal. |
| Service reaches verified completion | “Your service record has been updated.” | Only customer-safe completed state; never make an unsupported quality claim. |
| Customer sets a service reminder | “Your chosen check-in is coming up.” | Customer-specified or workshop-approved interval; edit/pause/delete controls. |

**Frequency policy proposed for approval:** security and essential transactional events must be delivered as needed; optional advice/marketing categories use explicit opt-in, frequency caps, quiet hours and one-tap opt-out. Do not mix service-critical status updates with unrelated promotions to evade opt-out. Customer support case updates may be sensitive: show generic notification text only. Event-driven nudges should cease when the task is complete, rejected, cancelled or no longer accessible.

## 15.3 The retention loops

**Service loop:** save garage vehicle → describe need → receive real review/appointment → attend → view honest service record → optional approved follow-up → return when a genuine need arises.

**Parts loop:** save car → find likely products → verify suitability → enquiry/quote → enabled purchase and collection → aftercare/saved appropriate item → easier future search.

**Vehicle marketplace loop:** discover → save/compare → enquiry or inspection → real updates → later care/parts services **only if customer consents to relevant marketing or actively requests them**.

**Support trust loop:** submit clear question → acknowledgment → appropriate human response → visible resolution/history → faster future contact, not forced chatbot interaction.

## 15.4 Editorial and personalization rules

Prioritize *Your next action* over generalized offers. Each recommendation card has a reason that can be explained: “For your saved Toyota Corolla” (saved data), “From your last booking” (recorded booking), “A reply to your enquiry” (actual thread). Avoid “Your car needs new brakes” based only on age, similarity or a product campaign. Use plain friendly Nigerian English, not unnecessarily technical labels like `QUOTE_ISSUED`, and retain exact reference numbers through optional copy actions.

# 16. Visual identity and interaction design system

## 16.1 Design character

The app should feel like **premium automotive engineering with approachable service**: dramatic but controlled black/red areas, quiet white content surfaces, restrained dark-navy marketplace treatment, confident photography, disciplined typography, legible content hierarchy and precise interaction feedback. Preserve the brand's existing approved art/logo and actual media. Visual stimulation should come from cars, equipment, motion *with purpose*, and beautiful layout—not gradients behind every input.

### Proposed app tokens — review against actual web tokens before implementation

| Token | Proposed value | Purpose |
|---|---|---|
| Ink / near-black | `#111820` | Main text, headings and dark brand panels. |
| Allied red | `#C92C32` | Primary brand/action; adjust to approved web token/contrast. |
| Bright red on dark | `#FF625A` | Small red accent on charcoal/navy (from current web design guidance). |
| Marketplace navy | `#14243A` | Vehicle areas and premium supporting surfaces. |
| Canvas | `#F7F8FA` | Subtle mobile background, not endless dark panels. |
| Main surface | `#FFFFFF` | Easy-reading cards, forms and historical records. |
| Divider | `#DEE3E9` | Sparse separation, not boxes around every element. |
| Success | `#24724F` | Verified completion only, always with a text label. |
| Caution | `#9B611B` | Pending review, unavailable conditions, uncertainty. |
| Error | `#B32734` | Important errors, paired with actionable words. |
| Spacing | `4 / 8 / 12 / 16 / 24 / 32` dp | Consistent rhythm; avoid random per-screen values. |
| Card radius | `16–20` dp | Premium but not overly rounded. |
| Input/button radius | `10–12` dp | Clear, compact, touch friendly. |
| Minimum touch target | `44×44` pt iOS / `48×48` dp Android target | Accessibility and comfortable one-thumb use. |

**Typography:** use properly licensed, app-bundled **Quicksand** where legibility and approved brand fidelity permit; body should normally stay at or above a practical 16sp/pt equivalent, with true platform dynamic type/scaling. Strong weight/spacing establishes hierarchy rather than shrinking explanatory copy. The repository has some later heading-font treatments; Codex must inspect actual current web tokens and establish the authoritative mobile type pairing rather than assume an old design-system paragraph wins.

## 16.2 Core component kit to implement once

- **Brand shell:** safe-area top header, stable five-tab navigation, controlled notification badge, local account avatar and supported secure status bar/light-dark behavior.
- **Attention card:** icon, actual state, title, key date/reference, one primary action, subtle secondary “View details.” No duplicate widgets for one case.
- **Vehicle card:** truthful approved cover or silhouette, make/model/year/trim and context badges; clear selection and default styling, not an image crop that hides the car.
- **Catalogue card:** image aspect ratio appropriate to vehicle vs parts vs services, factual name/price/fitment/availability and one obvious CTA; prevent microscopic card text or huge empty padding.
- **Timeline/status stepper:** timestamped, server-verifiable milestones, plain labels, “Awaiting” stage distinct from “Done.”
- **Search/filter sheet:** compact chips, sticky Apply/Clear controls, actual result counts if server provides them; keyboard-friendly; no inadvertent list reset on close.
- **Input and review screen:** floating label is optional; persistent label is mandatory; one column on phones, generous touch controls, inline error and draft preservation.
- **Modal/bottom sheet:** native-safe geometry, visible heading/close, bounded scroll, keyboard dismissal, focus restoration, no stacked obscured dialogs and no overhanging fixed dock.
- **Media viewer:** accessible pinch/zoom, true aspect ratio, thumbnails, alt/description, loading/error placeholders and honest image provenance.
- **Event inbox:** distinct unread state but not badge-only; safe preview and deterministic deep-link behavior.
- **Support thread:** sender/role safe labels, timestamps, delivery or submission state and retry only after checking original outcome.
- **Skeleton, blank, offline and partial-error views:** restrained, same layout geometry, avoid spinners that never end.

## 16.3 Motion and micro-interactions

Use 120–220ms transitions for safe selection changes, brief tactile feedback on deliberate actions, and subtle attention-card entry. Respect *Reduce Motion*. Do not autoplay a distracting vehicle/video carousel in the action-critical area. A button becoming disabled may indicate in-flight progress but must not be mistaken for a saved outcome. After submit, an explicit success screen shows the authoritative record; a payment spinner never becomes a green success animation without verification. Avoid celebratory confetti for a customer complaint or finance refund.

## 16.4 Copy examples to enforce system truth

| Avoid | Prefer |
|---|---|
| “Booked for Friday!” immediately after request | “Request received. We'll confirm the appointment after reviewing availability.” |
| “This part fits your vehicle” from model/year alone | “Possible match. Ask our team to confirm the technical details.” |
| “Your payment failed” after a timeout | “We couldn't confirm your payment yet. Check its status before paying again.” |
| “Order ready” when merely ordered | “Order placed” / “Preparing” / “Ready for collection,” as verified. |
| “Agent online” because service endpoint exists | “Send your question” / genuine staffing status only. |
| “AI expert diagnosis” | “Allie can help you find information. A technician can assess the vehicle.” |
| “Guaranteed refund in 10 days” without published terms | “Your request is under review. Check the recorded status.” |

# 17. Nigerian context, accessibility and performance

### Locale and real-world usage

- Set business time semantics to **Africa/Lagos** and display the timezone where a deadline or appointment is material. Do not derive opening hours from the device timezone or invent holiday capacity.
- Display **NGN** with readable naira symbol and separators; all calculations still happen in exact **integer kobo on the server**. Client formatting must never change charge amounts or tax history.
- Design for spotty mobile data and mid-journey network changes. Permit cached **public, non-sensitive** catalogue imagery/content with a freshness indicator; forbid unapproved cached customer records, finance details and private documents on shared devices.
- Make phone/WhatsApp/directions accessible from Contact, support and key handoff screens; use the canonical business contact and route, no invented staff personal numbers.
- Image uploads may be large on mobile. Offer proper camera/image compression with permission, previews and progress, while preserving safety-critical legibility and verifying allowed MIME, checksum and actual storage signatures on the backend. Never upload arbitrary gallery contents silently.
- Support light/dark OS preferences only where the complete token scheme is reviewed. Inconsistent near-white text on a white card is a defect, not a premium effect.

### Accessibility commitments

Adopt WCAG 2.2 AA as the design goal and native accessibility testing as release evidence. All controls need semantic labels and roles, clear visible and screen-reader states, adequate contrast on red/navy/white, dynamic font scaling, no single-color status meaning, voice-control names, keyboard/focus support on tablets and externally attached keyboards, reduced motion, and no critical actions hidden under the mobile keyboard/tab bar. Test screen readers on actual **VoiceOver and TalkBack**. Use focus/announcement changes deliberately after a case is submitted, a modal closes or a permission is revoked. Account for foldable/small screens, rotation, reduced height and 200% text.

### Target performance budgets (proposals; measure on representative devices)

| Area | Initial engineering objective | Validation |
|---|---|---|
| Cold start | Load the first usable shell promptly on entry-tier Android | Real device startup trace and staged baseline; avoid an unsupported universal timing guarantee. |
| First meaningful Home | Show branded skeleton immediately, then the highest-priority verified card without waterfall fetching | Slow-3G/offline simulation plus device trace, incomplete API returns. |
| Smooth scrolling | Keep long catalogue/garage lists smooth with virtualization and responsive pictures | Android low/mid/high and older iPhone profiling. |
| Search changes | Debounce typing, cancel stale requests, preserve prior useful results with freshness feedback | Rapid typing, back/forward, partial failures, focus/keyboard. |
| Battery/data | No always-on polling for every screen, no background location by default, no full-size image preload | Network inspector/background battery check. |
| App size | Avoid embedding hundreds of catalogue images or duplicating the web runtime | Release artifact size and asset/font audit. |

# 18. Proposed native application architecture

## 18.1 Recommended initial package layout

```text
allied-autotech/
  frontend/                        # existing Next.js 16 website; preserve
  backend/                         # existing Express 5 / Prisma API; preserve
  apps/
    mobile/                        # NEW Expo / React Native application
      app/                          # Expo Router public and protected layouts
      src/
        features/{home,garage,services,parts,vehicles,activity,support,account}/
        components/{ui,forms,media,feedback}/
        navigation/
        api/{client,contracts,errors,queries}/
        auth/{session,mfa,secure-storage}/
        notifications/{registration,deep-links,preferences}/
        design/{tokens,typography,spacing}/
        state/                       # minimal account-scoped transient UI state
        telemetry/                   # privacy-reviewed events and crash handling
      assets/                        # licensed fonts and reviewed brand artwork
      tests/{unit,integration,e2e}/
  packages/
    api-contracts/                  # OPTIONAL: generated, versioned public types
    design-tokens/                  # OPTIONAL: shared semantic tokens, no web CSS import
  docs/
    mobile/                         # design, threat model, matrix, release checklist
```

**No premature monorepo refactor:** start with `apps/mobile` and consume a stable generated OpenAPI client. Share domain contracts only after reviewing generated compatibility and bundling; avoid dragging Prisma models, backend secrets, Node-only libraries, Next.js server files or web-cookie code into the mobile bundle. A new React Native project cannot `import` Next.js pages; reuse *rules and API contracts*, not DOM components.

## 18.2 App stack: recommended, not already installed

- **Expo/React Native + TypeScript**, with an approved Expo SDK version selected at implementation time, **Expo Router** or an equally coherent navigation approach, and platform-compliant app signing. Verify dependency compatibility rather than copying the frontend's Next/React versions blindly.
- **TanStack Query** or equivalent for bounded server-state fetch, request cancellation, pagination, mutation reconciliation and cache invalidation. All sensitive query keys must incorporate the current account/session generation; clear on logout/session revoke.
- **Typed HTTP client** generated from existing backend OpenAPI 3.1 plus strict runtime response validation where required. Standardize `ApiError` code handling, request IDs and a safe refresh/cancel strategy.
- **React Hook Form + Zod** or an equally accessible native form package. Persist safe user drafts only where justified and protect sensitive financial/identity evidence.
- **React Native Reanimated/Gesture Handler** only when necessary for accessible, motion-reduced interactions. Avoid elaborate animation architecture before completing transactional screens.
- **Native secure storage** for minimal session credential/capability material; never use ordinary AsyncStorage for auth secrets, payment instrument data or private customer messages.
- **Native notifications** via appropriate APNs/FCM integration and Expo provider strategy, with separate server registration and explicit opt-in; existing browser push subscriptions do not cover these devices.
- **Monitoring** for app errors, performance and delivery failures, with PII redaction and consent-aware analytics.

## 18.3 Mobile authentication is the first technical spike

The website's `HttpOnly`, same-origin, host-only `__Host-aat_session` cookie and CSRF/Origin model were built for an HTTPS browser at Allied's web domain. Native `fetch` does not magically inherit that exact threat boundary, MFA or trusted origin. Before connecting a real customer account:

1. Inventory existing `identity.routes`/session endpoints, MFA transitions, logout/all-device revocation, guest email challenge, device binding, rate limits and CSRF expectations.
2. Choose an explicit mobile auth pattern. Prefer **system-browser authorization with PKCE and server-supported code exchange** if adopting a properly designed OAuth/OIDC authorization server, **or** a carefully reviewed native-device-bound opaque session with short-lived tokens and rotation. Neither exists merely by installing an SDK.
3. Implement a new server-authenticated device/session record as required, with separate audience, expiry/rotation, revocation and CSRF-equivalent mutation defenses. Do not downgrade staff MFA or add long-lived bearer tokens to logs.
4. Account for email verification, account lock, TOTP/passkeys/WebAuthn device behavior, recovery, refresh, concurrent devices, background resume, reinstall, compromised device, clipboard and deep-link interception.
5. Prove actual Android/iOS cookies/tokens, login, MFA, CSRF/origin decisions, secure storage and logout under real device builds and server tests before P0 account launch.

A local PIN or Face ID may optionally **unlock protected local presentation**, but it must not substitute for server authentication, role grants, recent-password proof or required MFA for privileged business actions.

## 18.4 API, storage and offline boundaries

Use one backend source of truth. Public catalogue responses can be cached with ETag/version/freshness. Customer data is private and no-store in transit; if offline persistence is indispensable, specify a time-limited, encrypted, account-bound local store reviewed for this data class. By default, keep private responses in memory, suppress details on app switcher/lock-screen where appropriate, clear on sign-out and account switch, and never leak previous user's garage contents during fast account changes.

**Write semantics:** every consequential create, payment attempt, booking/cancel/reschedule, quote accept, inventory action, upload finalization and aftercare submission must use the existing or newly reviewed idempotency/review/version contract. If a response is lost, show **Outcome unknown → inspect saved record/recover original receipt**, not an automatic replay with a new key. Optimistic UI is acceptable for reversible visual toggles only when the backend contract and rollback are explicit; never for money, appointment confirmation, stock allocation or refund success.

**Media:** use approved signed upload URLs and storage host allowlists; validate content type, length, hash and ownership. Keep private invoice, identity, VIN/ownership and service documents outside public CDNs. Only public listing photos can be exposed through approved public media pathways. Native file access permissions are purpose-specific, not broad gallery read grants.

**Notifications:** API receives device token, platform, session/device fingerprint/installation ID, consent category, push capability and expiration. The worker should deliver **generic event text** and an opaque notification/resource reference, not sensitive message content. Opening a push verifies a current authenticated owner, exact destination allowlist, account freshness, item visibility and state. Logout/device revocation must deactivate the token. Delivery status is best effort, not guaranteed.

# 19. Reuse existing APIs, add only mobile-specific contracts

## 19.1 Endpoint families to inspect and reuse

The backend's composition root is `backend/src/routes/index.ts` under `/api/v1`. The routes below identify **existing families and logical capabilities**, not a claim that every possible HTTP verb/example is implemented. Inspect the current canonical OpenAPI and exact route schemas before code generation.

| Domain | Existing server module/route family | Mobile usage / constraint |
|---|---|---|
| Public discovery | `/public/services`, `/public/catalog`, `/public/vehicles`, `/public/branches`, `/public/fitment` | Anonymous search, category, candidate fitment and verified capability-aware views. |
| Auth/account | `/auth`, `/customers` | Identity, profile, MFA, garage. **Mobile auth requires new reviewed transport.** |
| Care | `/customers/overview`, customer service-operations routes | Home attention, bookings, customer-safe quote status. |
| Shop | Customer catalogue/cart, `/customers/orders`, `/customers/parts-quotes` | Save, quotation, order and eligible purchasing. |
| Guest commerce | `/purchase` and private guest access workflow | Reuse ownership principles after native callback/secure guest review. |
| Billing/payments | `/customers/invoices`, `/customers/payments` | Authoritative history, payment verification and receipts; no client-owned amounts. |
| Vehicle owner/listings | `/customers`, customer vehicle-sales/discovery routers | Garage, saved listings, inspection and transaction records. |
| Support | `/public/support`, `/customers/support`, `/customers/notifications` | Enquiry, case history, private replies, inbox. |
| Learning | learning/Allie routes | Only eligible guide and enabled assistant destinations. |
| Workforce/admin | `/staff/*`, `/admin/*`, current policy/workforce routes | **Not reachable from customer MVP**; separately guarded staff phase. |

**Important:** `frontend/lib/api/generated.d.ts` is generated from `backend/docs/api/allied-autotech.openapi.json`; existing docs say some response definitions are incomplete and Zod client-side runtime validators cover this. Codex must not treat a generated `any` or incomplete response schema as an authorization or type guarantee. Add the missing mobile-required response contract to server-owned schemas, regenerate OpenAPI and test both version compatibility and runtime parsing.

## 19.2 Additive mobile API work candidates — NOT current routes

These are **proposed endpoint contracts**, subject to source review and security design. Names are examples, not claims of current implementation:

| Proposed capability | Possible API contract | Acceptance boundaries |
|---|---|---|
| Native auth exchange | `POST /api/v1/mobile/auth/...` | Reviewed identity flow, audience, PKCE/device binding, MFA and revocation; no copied web CSRF assumptions. |
| Installation/push registration | `POST /api/v1/mobile/devices` + DELETE/unregister | Current session, platform/token validation, per-device ownership, opt-in, logout and dead-token retirement. |
| Home attention feed | `GET /api/v1/mobile/me/attention` | Minimal customer-safe bounded projection; no full raw messages, tax IDs, VIN or staff notes; versioned response. |
| Garage timeline | `GET /api/v1/mobile/me/vehicles/:id/timeline` | Exact owner and car link, event provenance, approved detail visibility, stable paging. |
| Customer service reminders | `GET/POST/DELETE /api/v1/mobile/me/reminders` | Customer opt-in, explicitly documented schedule source, duplicate/cancel rules, no invented intervals. |
| Saved discovery alert | `POST/DELETE /api/v1/mobile/me/alerts` | Real saved-listing revisions; notification consent and frequency caps; no unsupported price-source inference. |
| Mobile push open resolution | `GET /api/v1/mobile/notifications/:id/destination` | Current owner/role, safe allowlisted route, stale/revoked state, no open redirect. |
| Service-history export | `POST /api/v1/mobile/me/service-history-export` | Data minimization, source attribution, authorized private document, expiry, audit; no unsupported manufacturer claim. |

If existing routes already satisfy the privacy, pagination, idempotency and mobile requirements, **reuse them** and avoid creating aliases merely because “mobile” appears in the URL. A feature-design issue should first map needed fields to existing owner-controlled data and prove any necessary new contract with isolated API tests.

## 19.3 Data model extensions — minimum viable, explicitly optional

The schema already contains `CustomerVehicle`, `Booking`, `BookingReminder`, `ProductCompatibility`, `Order`, `Notification`, `PushSubscription`, `ConsentRecord`, `PrivacyRequest` and others. Avoid copycat tables for “AppUser”, “AppBooking”, “AppOrder” or “AppInventory”: they would create competing truth and introduce consistency debt.

Potential **new** records, only after contract sign-off, are `MobileDevice`/`MobilePushRegistration` (encrypted or safely stored provider token, ownership/session, platform, expiry, consent and deletion), `CustomerCareReminder` (explicit source, interval/effective time, timezone, opt-in and cancellation), `SavedSearchAlert` (query/vehicle context and preferences) and `CustomerVehicleNote` (marked **user-provided**, never confused with technician diagnosis). For each, define retention, privacy request linkage, account deletion effects, indexing, audit, idempotency, replay protections and a **reviewed forward-only migration**. Do not edit applied SQL migrations or reset data to evolve the model.

# 20. Security, privacy and operational threat model

The existing website's strongest safeguards should become the mobile team's baseline—not obstacles to work around.

| Threat / failure | Required mitigation and test evidence |
|---|---|
| Previous user sees another account's car/orders after switch | Clear account-scoped query/cache and drafts on every session-generation change; force new owner validation before rendering protected content. |
| Stolen phone / expired session | Server-bound session/device revocation; app reauth; remote sign-out; no secrets in normal local storage or crash logs. |
| Deep link to another customer's invoice or complaint | Authenticate, resolve owner/role **server side**, then render or generic unavailable screen; test forged IDs and delayed push. |
| Payment amount tampering, browser/SDK return spoofing | Server-owned kobo totals; provider verification/webhook; immutable attempt/ledger and no local success inference. |
| Duplicate booking/order/aftercare after network timeout | Idempotency key scoped to actor/body, inspect/recover original receipt, explicit consequence review, no background blind retry. |
| False fitment for braking or engine parts | Approved technical evidence, explicit exclusion precedence, variant qualifiers, independent review and customer warning for unknown fitment. |
| Customer photo or private document exposed publicly | Signed, short-lived owned access; media host allowlists, nonpublic storage, no screenshots or logs with sensitive tokens. |
| Staff overreach from a hidden app tab or forged request | Backend role/MFA/assignment/branch checks on every request; customer app has no admin token or URL shortcuts. |
| Token pushed to the wrong device/account | Session/installation binding, explicit opt-in, rotation/logout cleanup, only generic lock-screen content, no token reuse across users. |
| Privacy request ignored or marketing opt-out bypassed | Consent-purpose classification and event-time preference check, retention/deletion flow, explain legal holds and no bulk promotion to transactional delivery. |
| AI hallucinated fault, inventory, or price | Feature gate, canonical retrieval with versioned source, bounded context, clear uncertainty and human handoff; no write authority by default. |
| Backend outage | Safe read-only cached public screen if allowed, visible last-updated indicator, preserve drafts, disable consequential writes, contact fallback. |

**Must-have controls:** HTTPS/TLS, certificate validity, rate limits, strict input validation, secure OS deep links and intent handling, API audience/version negotiation, authenticated signed URLs, private cache policy, least privilege, audit logs, event deduplication, secret scanning, dependency advisories and staged rollout. Avoid unsupported claims of “fully secure” based only on automated scanner passes. Financial, booking and privacy invariants should be asserted in backend tests, not merely via disabled frontend buttons.

# 21. Delivery roadmap and prioritization

Treat phase boundaries as **capability and acceptance gates**, not arbitrary calendar promises. Website operational activation and native app development can proceed in parallel, but the app must not circumvent an owner-approval dependency. A “developer demo” and a customer production release have different definitions of done.

## Phase 0 — Discovery, security and contract foundation (must precede signed-in app)

**Deliverables:** repository/source and current-deployment reconciliation; owner-verified scope and flags; app architecture decision record; security threat model; mobile-auth/MFA prototype against a **new isolated/staging** database; API inventory and generated client; privacy-safe logging; design token baseline; native push feasibility; 24-screen state matrix; first Figma-compatible wireframes/design tokens; app CI, emulator build and testing scaffolding.

**Done when:** a customer can register/login/verify/MFA/sign out in staging on a physical Android and iPhone or representative accepted target devices; leaked/expired token and account-switch tests fail closed; public catalogue works without an account; no production business records or real payments were changed; exact backend contracts and feature-gate behavior are documented.

## Phase 1 — Useful customer MVP (first worthwhile app release)

**In scope:** branded welcome, public Explore, actual Services/Parts/Vehicles discovery, support/contact and enquiries, sign-in/verification, My Garage, basic Home, saved products/listings, Activity overview of real previous records, security/privacy/notifications inbox, native deep-link baseline, responsive imagery and accessible loading/offline/failure recovery. **Do not** show payment/booking actions unless the server explicitly exposes a verified eligible capability. Native push may be staged behind a rollout flag after delivery/device validation.

**Done when:** the following paths pass on real Android and iPhone with correct ownership: anonymous service enquiry, account create/sign-in/MFA, garage add/edit/default, parts-by-car **candidate** search and help, saved vehicle enquiry, genuine support case, existing owned booking/order history, notification destination, sign-out and cross-account isolation. All source-visible prices and faults are accurate and consistent with the actual backend.

## Phase 2 — Booking, quote, collection and retention utility

**In scope only after G01/G03/G04/G05 gates:** service requests with real schedule/capacity, staff proposals/confirmation and calendar, quotation decisions, shop/parts quotation continuity, collection status/receipt details, end-to-end aftercare, verified customer service history and useful event-triggered notification delivery. Add customer-defined maintenance follow-ups after explicit consent/source policies. Integrate actual checkout **only after** provider and monetary gates pass.

**Done when:** request → staff action → correct customer status and notifications; quote → exact server line/tax snapshot → accepted or declined; order → eligibility/stock/actual collection state → aftercare; timeouts and duplicate events reconcile; all business actions retain a durable audit/receipt, and the app can safely degrade to enquiry-only mode on capability withdrawal.

## Phase 3 — Excellence and deliberate growth

**Candidates:** approved price/status alerts for saved vehicle listings, opt-in care plans, service-history exports, digital vehicle document wallet with provenance, advanced parts finder (VIN/engine qualifiers only with credible review), deeper support continuity, intelligent but safe Allie assistance, approved loyalty/referral economics, guest-to-account history linking under explicit ownership proof, multi-branch discovery when real branches exist, a separate staff companion with actual workforce assignment and offline-safe read boundaries.

**Do not authorize by default:** multi-vendor marketplace onboarding, consumer lending/vehicle financing, unapproved deposits/paid holds, GPS background tracking, auto-diagnosis, health scores, random coupon issuance, pushing paid invoices or collecting marketing consent through dark patterns. Each is a separate business/legal/security decision.

## 21.1 Build order within a typical Codex sprint

| Step | Engineering result | Dependency | Evidence required |
|---|---|---|---|
| 1 | Baseline source/commit check and open PR conflict inventory | Current GitHub master | Document immutable SHA and ignored/unrelated changes. |
| 2 | Read policy, security, UX and API documents in this report | GitHub access | Mapping from app features to exact API contracts. |
| 3 | Mobile auth/session security proof-of-concept | Test backend and approved design | Login/MFA/logout/revoke/account swap on devices. |
| 4 | Shared semantic tokens and native components | Genuine brand/logo/media | Accessibility snapshots of core components. |
| 5 | Public Explore and all three product catalogues | Public APIs | Missing/failed/partial/success server states. |
| 6 | Garage and saved objects | Signed-in auth | Ownership and cross-account memory/cache tests. |
| 7 | Support and actual-history Home | Safe customer projections | End-to-end enquiry and back/refresh recovery. |
| 8 | Booking and quotation workflow | Real capacity + policy | Staff/Customer integration on isolated data. |
| 9 | Native push and deep links | Device registration + consent | Permission denied, logout, stale and wrong-account cases. |
| 10 | Commerce and paid acceptance | Finance + provider + fulfilment gates | Provider test-mode and financial ledger invariants. |
| 11 | Signed store builds / staged release | Complete matrix | Real-device usability, accessibility, privacy and crash gates. |

# 22. Product stories and acceptance tests for Codex

Use these as **testable contracts**, not marketing copy. Every applicable story is exercised across initial loading, valid data, unknown/missing data, failure, retry, lost response, account switch and restricted-launch mode.

| ID | User story / system behavior | Mandatory acceptance example |
|---|---|---|
| **MOB-001** | As a visitor, I can explore services without signup. | Public service categories load in `browse_enquiries`; restricted booking buttons do not promise a saved slot. |
| **MOB-002** | As a new customer, I can add an actual vehicle. | Confirmed server garage record appears after refresh; duplicate-tap and slow response do not generate second car. |
| **MOB-003** | As a driver, my default car prepopulates discovery. | Switching default vehicle updates context; unrelated search and another account never receive old car data. |
| **MOB-004** | As a parts buyer, compatibility claims are evidence-based. | A Corolla model/year match with unknown brake qualifiers displays “Needs confirmation,” never “Guaranteed fit.” |
| **MOB-005** | As a visitor, I can send a concern enquiry. | Confirmed server reference and clear next step; lost submit returns unknown outcome and safe investigation action. |
| **MOB-006** | As a customer, I know my appointment status. | REQUESTED/PROPOSED vs CONFIRMED render differently and only confirmed future bookings show countdown/calendar invite. |
| **MOB-007** | As a returning customer, I can inspect actual care history. | Only owned and customer-safe records; no staff notes, no fabricated older service visits. |
| **MOB-008** | As a shopper, I can search with reliable facets. | Missing product source says “Could not load products”; other successful scope results remain visible and retry preserves query. |
| **MOB-009** | As a vehicle buyer, faults are clearly disclosed. | Material AC fault remains readable on listing detail and before enquiry at 320–430px equivalent width. |
| **MOB-010** | As a user, I can save a listing. | Save/unsave follows server truth; stale/private/sold listing transitions are explained, not treated as purchasable. |
| **MOB-011** | As an order owner, I can inspect real status. | “Ready for pickup” appears only for the recorded eligible lifecycle state. |
| **MOB-012** | As a payer, I am protected from duplicate payments. | Provider return before webhook shows pending check; amount mismatch cannot create paid invoice; repeat callback cannot double-capture. |
| **MOB-013** | As a customer, I can request aftercare. | Original idempotency receipt recovered after lost response; no second request, stock change or refund after mere submission. |
| **MOB-014** | As a customer, I can see and reply to my support thread. | Internal notes and foreign thread IDs never appear; revoked account loses cached thread content immediately. |
| **MOB-015** | As a user, notifications open safe context. | Forged notification destination and stale link show generic unavailable page; lock-screen preview contains no sensitive details. |
| **MOB-016** | As a user, marketing notifications are optional. | Declining OS permission still allows inbox; opt-out prevents future optional campaigns, not security notifications. |
| **MOB-017** | As a customer, I can recover login/security safely. | Server MFA challenge is required where configured; expired/used challenge and lost-device session revoked correctly. |
| **MOB-018** | As an account holder, my records stay private. | Logout/login as B purges A's garage/orders/invoices and no app-switcher content leaks sensitive data. |
| **MOB-019** | As a customer, I can use a low-bandwidth device. | Failed images have safe fallback; no infinite spinners; action remains accessible offline for contact/help where possible. |
| **MOB-020** | As an accessibility user, I can complete core workflows. | TalkBack/VoiceOver labels, focus order, enlarged type, reduced motion and bottom bar keyboard geometry pass on physical devices. |
| **MOB-021** | As an operations owner, a mobile client cannot expand authority. | Staff/admin endpoints reject customer app sessions; a hidden mobile link or forged role field grants nothing. |
| **MOB-022** | As a business, only actual published availability is actionable. | A flag changing from `full` to `browse_enquiries` while app is open removes checkout/booking actions without deleting history. |
| **MOB-023** | As a user, the app distinguishes missing facts from “none.” | No mileage/trim/part number is labelled “Not recorded,” not 0, “new,” or invented stock. |
| **MOB-024** | As a business, analytics are privacy safe. | Events carry anonymous or minimal identifiers; no full VIN/phone, personal message, payment credential or unconsented marketing linkage. |
| **MOB-025** | As a service customer, I can request human assistance. | Every payment/quote/fault/aftercare blocker has a reachable human escalation; Allie off does not block support. |
| **MOB-026** | As an operator, unmerged attendance features do not appear active. | Server/source on 97 migrations never offers “staff-verified arrived” as though PR #20 were deployed. |

# 23. Analytics and customer-experience measurement

The objective is not to maximize app opens by sending more messages. Measure whether customers can **complete valuable tasks and return because they trust the record**. Instrument with explicit privacy approval, short-lived identifiers where possible, security review and retention periods.

## 23.1 Suggested operating metrics and definitions

| Metric | Working definition | Why it matters |
|---|---|---|
| **Successful service enquiry rate** | Valid persisted service enquiries / intentional service enquiry submit attempts, measured by authoritative receipt | Does the app help customers reach the workshop? |
| **Garage activation rate** | Unique eligible registered customers with ≥1 valid owned vehicle / eligible registered customers in cohort | Are users building durable usefulness? |
| **Time to meaningful action** | App opening to first valid enquiry, saved car, viewed owned next-step or answered case | Is Home reducing work? |
| **Quote-to-response rate** | Eligible quotes accepted or declined within validity / eligible issued quotes actually viewed | Does the app help decisions without pressuring? |
| **Confirmed booking attendance support** | Confirmed appointments with correct notices/destination / eligible confirmed appointments | Reliability, not a no-show blame metric. |
| **Collection status clarity** | Customer order status visits that render an authoritative current state / visits to eligible order detail | Avoid wasted journeys. |
| **Support first response** | Elapsed *care-hours* between case arrival and actual team response, segmented by case category | Measure real service responsiveness, not fake green badges. |
| **Repeat meaningful use (30/90-day)** | Returning users who complete a nontrivial task or view a relevant owned record / active eligible cohort | Retention beyond idle opens. |
| **Critical journey error rate** | Authoritative failed/unknown-outcome submissions by workflow and cause / submit attempts | Reliability and financial safety. |
| **Notification usefulness** | Owned deep-link destination successfully loaded after opt-in notification / eligible delivered/opened notifications | Quality, not clickbait. |
| **App performance** | Crash-free sessions/users, real-device startup, P75 screen navigation, image transfer and request error rate | Device/experience health. |

**Event schema proposal:** `event_name`, schema version, timestamp (UTC), platform/app release, capability snapshot version, anonymized session/cohort ID, flow stage, outcome, server request ID on error, synthetic vs real-test marker. Never put unredacted VIN, license plate, phone, street address, exact customer name, support body, card detail or auth material into analytics. Define consent and lawful basis before enabling any behavioral tracking. Segment by device class and internet quality only in privacy-respecting aggregate form.

## 23.2 Experimentation priorities

A/B test only after baseline reliability is measured and user consent/privacy is respected. Candidate experiments: Home attention-card order; “Find parts for my car” entry position; enquiry form step density; support CTA label; photo-card framing. Never experiment with price calculations, authorization, payment verification, consent wording, data deletion, fitment safety claims or financial fairness.

# 24. Comprehensive quality-assurance and release matrix

| Layer | Required testing and evidence | Minimum release disposition |
|---|---|---|
| Source/build | TypeScript, lint/format, dependency/secret checks, SDK compatibility, exact signed commit and lockfile review | Green exact-source CI with existing checks preserved. |
| API contract | Existing Zod/OpenAPI correctness, generated client, schema version compatibility, real authorization/ownership and pagination | Contracts validated against isolated real API and database. |
| Financial safety | Test-mode Paystack return, signed webhook, duplicate/late events, mismatched amount/currency/reference, reconciliation, refund separation of duties | No live money without owner/merchant acceptance and recorded test proof. |
| Booking/capacity | Real resource facts, overlap/actual duration, quote and appointment transitions, stale versions, rebooking and force-cancel cases | No public booking until workshop configuration verified. |
| User isolation | Owner A/B sessions, guest tokens, stale account switch, signed upload expiry, private document and deep-link tampering | Zero cross-account data exposure in all supported cases. |
| Native identity | Android/iOS login, 2FA, passkey paths, refresh, revoke, logout, compromised device, storage and push subscription retirement | Real-device verification and security sign-off. |
| UI states | 24 screens × eligibility/loading/empty/offline/error/retry/success/unknown/revoked/failure states | Each P0 screen has state coverage and evidence. |
| Device coverage | Entry-level Android, modern Android, older iPhone/current iPhone; small, large and tablet/foldable; portrait/landscape; gesture bar and keyboard | Tested on real Android and real iPhone, not emulator alone. |
| Accessibility | VoiceOver, TalkBack, dynamic type to 200%, reduced motion, contrast, focus order, labels, keyboard/external input | Essential journey acceptance, manual review, logged exceptions. |
| Localization | NGN/kobo, Africa/Lagos, null data, long Nigerian names, phone numbers, slow-data networks and local directions | Zero invented prices/hours; exact server dates. |
| Notifications | permission never auto-prompted, deny/allow, app killed/background, delayed message, revoked session, opt-out, wrong account, deep link | In-app fallback, no private lock-screen copy. |
| Privacy/compliance | Consent scope, push marketing classification, deletion/export request, crash/event redaction, privacy notice, external providers/data handling | Written owner/legal review and truthful app-store disclosures. |
| Operational rollout | staging → closed beta → limited production rollout; signed builds, rollout feature flags, kill switches, support playbook and rollback | All gates, actual owner approval, telemetry and rollback tested. |

### 24.1 Specific challenge cases that frequently break automotive apps

- Customers changing cars during a multi-step booking or quote request; no wrong-car association.
- Two devices editing the same appointment while a workshop staff member proposes an alternative; stale version conflict, not silent overwrite.
- Customer tapping Send twice after the phone goes offline; verify existing record before any resend.
- Quote expires at midnight UTC while customer views time in Nigeria; server expiry remains authoritative.
- A named part appearing in search but its compatibility evidence being withdrawn; show current warning.
- A vehicle listing marked SOLD between filter and enquiry; preserve displayed content only as historical and prevent misleading availability.
- Three different order payment attempts after browser/app interruption; no hidden double charge.
- A paid record with a refund reversal/dispute; label provisional financial states accurately.
- Current-role grant revoked while staff companion is open; close the protected screen immediately and clear stale reads.
- A generic push arrives on a phone whose last account logged out; no stale document or conversation deep link is displayed.
- A picture upload accepted by storage but final API mutation fails; separate orphan cleanup and safe retry.
- A device setting 200% text over a bottom-tab modal with keyboard and screen reader active; submit button remains reachable.

# 25. Codex handoff: implementation brief

The following is an explicit instruction set for the **next Codex engineer/agent**. It is a plan, not permission to modify production records or release code without the established owner/repository authorizations.

> **Your job:** build **Allied AutoTech Companion**, a mobile-first native iOS/Android customer application using the *existing* `Otto-space/allied-autotech` repository as the platform of truth. Start from the latest reviewed `master` and reconcile its SHA with this document's audited snapshot `80e95a386afeba3450cc5e66ed9afab421f52e65` (4 Nov 2026). Do not assume the source or production state stayed unchanged. Do not rebuild the backend, fork the identity database or port the full admin UI. Protect the existing website.
>
> **Before coding:** read `AGENTS.md`, `README.md`, `backend/docs/site-completion-tracker.md`, `frontend/docs/UI_UX_QUALITY_REGISTER.md`, `docs/UI_UX_AND_CONTENT_RULES.md`, `docs/DELIVERY_AND_VERIFICATION.md`, `backend/docs/public-launch-policy-decisions.md`, `backend/docs/security-model.md`, `backend/docs/architecture.md`, `backend/docs/payment-invariants.md`, `frontend/docs/architecture-and-integration.md` and the canonical backend OpenAPI artifact. Inspect PR #20/#22/#23; do not treat their migrations or runtime behavior as merged. Preserve all unrelated worktrees and changes.
>
> **First deliverable:** a current-source traceability matrix mapping each approved mobile screen to existing endpoints/models/permissions, exact gap, owner decision, acceptance evidence and dependency. Separately design and prove the native authentication/session/MFA model. If there is no secure eligible mobile path, do not bypass the web auth contract to make a demo work.
>
> **Build order:** create `apps/mobile` with typed navigation and a native design kit faithful to Allied black/red/navy/white brand and accessible Quicksand typography. Build public Explore; auth; Garage; Home attention; Activities; support; saved products/listings; allowed booking/quote/collection actions in capability order. Reuse the existing API and strict server-side authorization/transaction rules. Only add mobile-specific backend contracts when an actual gap is demonstrated. Payment and live AI stay off until owner/provider requirements are accepted.
>
> **Quality expectations:** world-class but disciplined UI/UX, beautiful authentic imagery, compact searchable catalogs, honest status wording, clear error/empty/offline/recovery states, controlled animations, genuine accessibility, responsive small/large devices and helpful human support. Keep all data real. Do not invent car specs, stock, compatibility, services, reviews, discounts, due dates, prices, capacity, refund policies or payment success. No background GPS, spammy marketing, unapproved consumer profiling or unnecessary permissions.
>
> **Backend safety:** apply forward-only reviewed migrations; preserve actual PostgreSQL data and provider secrets; use isolated test databases and exact-source checks; do not run `prisma db push`, migration reset or unreviewed write against shared/staging/production. Follow backup/restore, CI, access and disk reserves from `AGENTS.md`. Do not turn on production flags, send messages, initiate real charges, assign privileged roles, or deploy without current authorization. The web uses HttpOnly same-origin sessions and CSRF: design a distinct secure native authentication integration.
>
> **Deliver each bounded batch with:** route/file inventory, screenshots/recordings from actual device or clearly marked emulator, executed tests, accessibility checks, changed API/schema/release flags, exact source SHA, evidence of account isolation and lost-response safety, known remaining gaps and next testable batch. Use the established quality register instead of a competing infinite backlog.
>
> **Definition of done:** a real visitor/customer can find services/parts/vehicles, add and use a garage car, submit a support enquiry, retrieve owned history, understand actual booking/order status and receive helpful eligible notifications without stale data leaks. Only then activate further booking, payment, collection, AI, staff or loyalty functionality behind separately verified business/provider/security gates. The finished app must feel native, elegant, useful and trustworthy—not like a website trapped in a WebView.

**The standalone Codex starter brief supplied with this report extracts these instructions into a directly reusable execution document.**

# Appendix A. Actual frontend page route inventory

The following page-file paths are taken from the complete recursive Git tree at the audited snapshot. Dynamic names `[id]` and optional catch-all `[[...section]]` are **Next.js file-system parameters**, not literal URLs. There are **119** `frontend/app/**/page.tsx` files in total (including parameterized pages). Internal controls/modals/components are additional UI surfaces and do not each have separate routes.

### A.1 Public, sign-in and guest purchase pages

```text
frontend/app/page.tsx
frontend/app/about/page.tsx
frontend/app/contact/page.tsx
frontend/app/services/page.tsx
frontend/app/services/[serviceId]/page.tsx
frontend/app/services/request/page.tsx
frontend/app/parts/page.tsx
frontend/app/parts/[productId]/page.tsx
frontend/app/vehicles/page.tsx
frontend/app/vehicles/[listingId]/page.tsx
frontend/app/cart/page.tsx
frontend/app/checkout/page.tsx
frontend/app/search/page.tsx
frontend/app/reviews/page.tsx
frontend/app/help/page.tsx
frontend/app/help/[slug]/page.tsx
frontend/app/learn/page.tsx
frontend/app/learn/practice/[scenarioId]/page.tsx
frontend/app/login/page.tsx
frontend/app/register/page.tsx
frontend/app/mfa/page.tsx
frontend/app/verify-email/page.tsx
frontend/app/forgot-password/page.tsx
frontend/app/reset-password/page.tsx
frontend/app/privacy/page.tsx
frontend/app/payments/complete/page.tsx
frontend/app/purchase/page.tsx
frontend/app/purchase/verify/page.tsx
frontend/app/purchase/complete/page.tsx
frontend/app/purchase/orders/[orderId]/page.tsx
frontend/app/purchase/orders/[orderId]/aftercare/page.tsx
frontend/app/purchase/invoices/[invoiceId]/page.tsx
frontend/app/purchase/payments/[paymentId]/page.tsx
frontend/app/staff/accept-invitation/page.tsx
```

### A.2 Customer account pages

```text
frontend/app/dashboard/page.tsx
frontend/app/dashboard/bookings/page.tsx
frontend/app/dashboard/bookings/[bookingId]/page.tsx
frontend/app/dashboard/cart/page.tsx
frontend/app/dashboard/orders/page.tsx
frontend/app/dashboard/orders/[orderId]/page.tsx
frontend/app/dashboard/orders/[orderId]/aftercare/page.tsx
frontend/app/dashboard/vehicles/page.tsx
frontend/app/dashboard/vehicles/[vehicleId]/page.tsx
frontend/app/dashboard/inspections/page.tsx
frontend/app/dashboard/vehicle-transactions/page.tsx
frontend/app/dashboard/vehicle-transactions/[transactionId]/page.tsx
frontend/app/dashboard/saved/page.tsx
frontend/app/dashboard/invoices/page.tsx
frontend/app/dashboard/invoices/[invoiceId]/page.tsx
frontend/app/dashboard/payments/page.tsx
frontend/app/dashboard/payments/[paymentId]/page.tsx
frontend/app/dashboard/support/page.tsx
frontend/app/dashboard/support/[kind]/[supportId]/page.tsx
frontend/app/dashboard/reviews/page.tsx
frontend/app/dashboard/reviews/[reviewId]/page.tsx
frontend/app/dashboard/notifications/page.tsx
frontend/app/dashboard/privacy/page.tsx
frontend/app/dashboard/profile/page.tsx
frontend/app/dashboard/security/page.tsx
```

### A.3 Administrator/managed-workforce pages

```text
frontend/app/admin/page.tsx
frontend/app/admin/[resource]/page.tsx
frontend/app/admin/audit/page.tsx
frontend/app/admin/booking-capacity/page.tsx
frontend/app/admin/booking-resources/page.tsx
frontend/app/admin/booking-slots/page.tsx
frontend/app/admin/bookings/page.tsx
frontend/app/admin/bookings/[bookingId]/page.tsx
frontend/app/admin/branches/page.tsx
frontend/app/admin/categories/page.tsx
frontend/app/admin/categories/[categoryId]/page.tsx
frontend/app/admin/complaint-policy/page.tsx
frontend/app/admin/customers/page.tsx
frontend/app/admin/customers/[customerId]/page.tsx
frontend/app/admin/delivery-policy/page.tsx
frontend/app/admin/dispute-policy/page.tsx
frontend/app/admin/finance-policy/page.tsx
frontend/app/admin/fitment/page.tsx
frontend/app/admin/inspections/page.tsx
frontend/app/admin/inventory/page.tsx
frontend/app/admin/inventory/[inventoryId]/page.tsx
frontend/app/admin/invoices/page.tsx
frontend/app/admin/invoices/[invoiceId]/page.tsx
frontend/app/admin/notifications/page.tsx
frontend/app/admin/orders/page.tsx
frontend/app/admin/orders/[orderId]/page.tsx
frontend/app/admin/orders/[orderId]/aftercare/page.tsx
frontend/app/admin/payment-disputes/page.tsx
frontend/app/admin/payment-disputes/work/page.tsx
frontend/app/admin/payment-exceptions/page.tsx
frontend/app/admin/payments/page.tsx
frontend/app/admin/privacy/page.tsx
frontend/app/admin/processing-jobs/page.tsx
frontend/app/admin/products/page.tsx
frontend/app/admin/products/[productId]/page.tsx
frontend/app/admin/profile/page.tsx
frontend/app/admin/promotions/page.tsx
frontend/app/admin/promotions/new/page.tsx
frontend/app/admin/promotions/[promotionId]/page.tsx
frontend/app/admin/refund-timing/page.tsx
frontend/app/admin/refunds/page.tsx
frontend/app/admin/reservation-terms/page.tsx
frontend/app/admin/retention-policy/page.tsx
frontend/app/admin/reviews/page.tsx
frontend/app/admin/security/page.tsx
frontend/app/admin/service-categories/page.tsx
frontend/app/admin/service-categories/[categoryId]/page.tsx
frontend/app/admin/services/page.tsx
frontend/app/admin/services/[serviceId]/page.tsx
frontend/app/admin/staff/page.tsx
frontend/app/admin/staff/[staffUserId]/page.tsx
frontend/app/admin/staff/invite/page.tsx
frontend/app/admin/support/page.tsx
frontend/app/admin/support/[kind]/[supportId]/page.tsx
frontend/app/admin/vehicle-sales/page.tsx
frontend/app/admin/vehicle-sales/[transactionId]/page.tsx
frontend/app/admin/vehicles/page.tsx
frontend/app/admin/vehicles/new/page.tsx
frontend/app/admin/vehicles/[vehicleId]/page.tsx
frontend/app/admin/workforce/[[...section]]/page.tsx
```

**Other HTTP files** include `frontend/app/api/backend-unavailable/route.ts`, `frontend/app/api/catalogue-image/[...path]/route.ts` and `frontend/app/sitemap.xml/route.ts`; these are **route handlers, not user pages**. Site layout exists in `frontend/app/layout.tsx`, customer layout in `frontend/app/dashboard/layout.tsx`, and admin layout in `frontend/app/admin/layout.tsx`.

# Appendix B. Actual Prisma model inventory (104)

The existence of a model shows a supported data domain or designed workflow, **not** that its schema rows are populated or its associated features approved for public use. Grouping below is editorial; model names come from `backend/prisma/schema.prisma`.

| Bounded data context | Prisma model names |
|---|---|
| **Identity / organization / security (13)** | `User`, `Session`, `PasswordResetToken`, `EmailVerificationToken`, `MfaFactor`, `MfaRecoveryCode`, `MfaChallenge`, `AuthenticationThrottle`, `AuditLog`, `StaffProfile`, `CustomerProfile`, `Branch`, `PrivilegedInvitation` |
| **Customer garage (1)** | `CustomerVehicle` |
| **Service, appointments, quotations, workshop (12)** | `ServiceCategory`, `Service`, `BookingSlot`, `Booking`, `BookingReminder`, `ServiceQuote`, `QuoteItem`, `WorkOrder`, `WorkOrderItem`, `BookingRescheduleRequest`, `BookingTimingSnapshot`, `BookingResourceAllocation` |
| **Catalog / inventory / fitment / cart (11)** | `Category`, `Product`, `ProductCompatibility`, `ProductImage`, `Inventory`, `InventoryTransaction`, `InventoryReservation`, `ProductFavourite`, `Cart`, `CartItem`, `ProductCompatibilityHistory` |
| **Orders / guest / parts quotations (8)** | `PurchaseGuest`, `PurchaseGuestChallenge`, `PurchaseGuestSession`, `Order`, `OrderPurchaseReview`, `OrderItem`, `OrderAftercareRequest`, `PartsQuote` |
| **Payments, refunds, reconciliation (11)** | `Payment`, `PaymentAttempt`, `ManualPaymentReview`, `Refund`, `PaymentDispute`, `PaymentWebhookEvent`, `PaymentAnomaly`, `PaymentLedgerEntry`, `PaymentReconciliationRun`, `PaymentReconciliationItem`, `PaymentReconciliationDue` |
| **Vehicle inventory, sales and discovery (13)** | `Vehicle`, `VehicleListing`, `VehicleImage`, `VehiclePriceHistory`, `VehicleDocument`, `VehicleConditionReport`, `InspectionRequest`, `VehicleTransaction`, `VehicleTransactionStatusHistory`, `VehicleHandover`, `SavedVehicle`, `VehicleMake`, `VehicleModel` |
| **Care / reviews / promotions (9)** | `Review`, `Enquiry`, `Complaint`, `SupportMessage`, `SupportLiveCoverage`, `SupportLivePresence`, `SupportConversation`, `Promotion`, `PromotionUsage` |
| **Billing / communications / jobs (11)** | `Invoice`, `Notification`, `PushSubscription`, `NotificationPreference`, `NotificationDelivery`, `IdempotencyRecord`, `OutboxEvent`, `SupportDeliveryNoticeDismissal`, `OperationalAlert`, `WorkerHeartbeat`, `WorkerScanCheckpoint` |
| **Policies / access / privacy (7)** | `BusinessPolicyVersion`, `WorkforceAccess`, `WorkforceAssignment`, `UserCapability`, `ConsentRecord`, `PrivacyRequest`, `RetentionHold` |
| **Allie / learning (3)** | `AssistantGuestSession`, `AssistantConversation`, `AssistantTurn` |
| **Media lifecycle (4)** | `MediaUpload`, `StoredMedia`, `ResourceImage`, `MediaCleanupJob` |
| **Platform abuse control (1)** | `RateLimitBucket` |

The groups contain **104 distinct model names** in total, checked against the Prisma model declaration inventory. This appendix is a schema navigation index, not a guarantee that the database contains live rows for each table.

# Appendix C. Source-of-truth links and inspection trail

All code links below are pinned to the **same immutable 4 November commit** unless the link is explicitly a PR or GitHub Action. Each linked file was read, structurally inventoried or used as an exact location discovered in the source tree. A source link provides inspectable evidence; it does not certify deployment.

| Topic | Source / inspect next |
|---|---|
| Repository instructions and safeguards | [AGENTS.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/AGENTS.md) |
| Main setup and deployment | [README.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/README.md) |
| Original client requirement | [ORIGINAL_CLIENT_BRIEF.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/ORIGINAL_CLIENT_BRIEF.md) |
| Owner financial decisions | [OWNER_POLICY_DECISIONS.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/OWNER_POLICY_DECISIONS.md) |
| Updated operational decisions | [public-launch-policy-decisions.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/public-launch-policy-decisions.md) |
| Most recent implementation tracker | [site-completion-tracker.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/site-completion-tracker.md) |
| Comprehensive UI work register | [UI_UX_QUALITY_REGISTER.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/docs/UI_UX_QUALITY_REGISTER.md) |
| UX and accurate wording rules | [UI_UX_AND_CONTENT_RULES.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/docs/UI_UX_AND_CONTENT_RULES.md) |
| 1 November formal release/activation handoff | [DELIVERY_HANDOFF_20261101.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/docs/DELIVERY_HANDOFF_20261101.md) |
| 3 November production/source audit | [CONSOLIDATED_AUDIT_20261103.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/docs/CONSOLIDATED_AUDIT_20261103.md) |
| Website requirements/completion ledger | [completion-audit.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/docs/completion-audit.md) |
| Frontend integration and client auth | [architecture-and-integration.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/docs/architecture-and-integration.md) |
| Backend bounded contexts | [architecture.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/architecture.md) |
| Backend security model | [security-model.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/security-model.md) |
| Money/ledger/payment invariants | [payment-invariants.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/payment-invariants.md) |
| Exact Prisma schema | [schema.prisma](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/prisma/schema.prisma) |
| API composition | [backend/src/routes/index.ts](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/src/routes/index.ts) |
| Canonical API document | [allied-autotech.openapi.json](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/api/allied-autotech.openapi.json) |
| App render/routes | [frontend/app/](https://github.com/Otto-space/allied-autotech/tree/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/app) |
| Native proposal must not reuse Next.js session mechanics | [frontend/lib/api/client.ts](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/lib/api/client.ts) |
| Public launch flags/capabilities | [frontend/lib/public-capabilities.ts](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/lib/public-capabilities.ts) |
| Canonical business contact and FAQ wording | [frontend/lib/business.ts](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/lib/business.ts) |
| Role-aware dashboard navigation | [frontend/lib/dashboard-navigation.ts](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/lib/dashboard-navigation.ts) |
| Customer-facing car parts finder | [find-parts-for-car.tsx](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/app/components/find-parts-for-car.tsx) |
| Fitment technical safety and review | [discovery-fitment-implementation.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/discovery-fitment-implementation.md) |
| Workshop service groups | [OWNER_SERVICE_STRUCTURE_20261030.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/docs/OWNER_SERVICE_STRUCTURE_20261030.md) |
| Workforce permissions | [workforce-dashboard-access.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/workforce-dashboard-access.md) |
| Notification/browser push architecture | [team-notifications-and-push.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/team-notifications-and-push.md) |
| Dedicated notifications experience | [notifications-experience-20261025.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/notifications-experience-20261025.md) |
| Guest/owned aftercare recovery | [aftercare-request-recovery.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/aftercare-request-recovery.md) |
| Vehicle public filter requirements | [vehicle-marketplace-implementation-20261028.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/vehicle-marketplace-implementation-20261028.md) |
| Known stock-query filter gap | [vehicle-stock-discovery.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/backend/docs/vehicle-stock-discovery.md) |
| Service/commerce release limitations | [SERVICES_COMMERCE_READINESS_20261101.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/docs/SERVICES_COMMERCE_READINESS_20261101.md) |
| Brand component language | [frontend/docs/design-system.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/docs/design-system.md) |
| Continuous front-end quality instruction | [Allied_AutoTech_Continuous_UI_UX_Codex_Prompt.md](https://github.com/Otto-space/allied-autotech/blob/80e95a386afeba3450cc5e66ed9afab421f52e65/frontend/docs/Allied_AutoTech_Continuous_UI_UX_Codex_Prompt.md) |
| CI backend checks | [run 41764169273](https://github.com/Otto-space/allied-autotech/actions/runs/41764169273) |
| CI frontend checks | [run 41764169257](https://github.com/Otto-space/allied-autotech/actions/runs/41764169257) |
| CI secret guard | [run 41764169248](https://github.com/Otto-space/allied-autotech/actions/runs/41764169248) |
| Physical attendance proposal **unmerged** | [PR #20](https://github.com/Otto-space/allied-autotech/pull/20) |
| Writer compatibility proposal **unmerged** | [PR #22](https://github.com/Otto-space/allied-autotech/pull/22) |
| Remaining-work capacity proposal **unmerged** | [PR #23](https://github.com/Otto-space/allied-autotech/pull/23) |

### Scope limitations and next repository inspection

This report inventories the complete Git tree and reads/reconciles key high-impact code, schema and documentation. It does **not** mean every file or PR diff has been line-reviewed, nor that the connected GitHub snapshot can reveal encrypted runtime provider configuration, private customer data, store account approvals, or the exact current production feature flags without separate authorized access. A Codex agent beginning implementation should inspect every **relevant** source/route/test at the newer live commit it actually uses, reconcile protected deployments read-only, obtain any necessary owner policy approvals and record its own measured evidence. This is the safe meaning of “examine every inch”: complete **coverage mapping and traceability** plus focused, testable review—not a fictional claim of omniscient production verification.

---

**Bottom line:** Allied AutoTech already has the essential domain platform for a powerful customer app. Build the app to make that existing capability emotionally satisfying and genuinely useful: **remember my car; show me what matters; help me make a safe decision; tell me what happens next; keep my records; let me reach a person.** Deliver those experiences exceptionally well before adding speculative features. The retention strategy will succeed when the app becomes the easiest trusted way for customers to care for their vehicles—not merely a more elaborate way to advertise services.
