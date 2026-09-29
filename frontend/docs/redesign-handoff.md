# Allied AutoTech frontend redesign

Frontend implementation and browser verification completed on September 30, 2026. All 87 page routes inherit the appropriate shared system. Backend-dependent exceptions are explicitly documented below, as required by the brief's read-only backend boundary.

## What existed and what changed

The existing Next.js App Router frontend already had a substantial typed API integration: cookie sessions, CSRF, idempotency, versioned mutations, capability-aware navigation, booking/quotation flows, commerce, stock, payments, MFA, support, notifications, privacy and operational policies. These integrations were preserved. The application had uneven public/dashboard typography, oversized marketing treatments, static detail galleries, limited Help navigation and manual-key-only authenticator setup.

The new shared design uses ink `#01121A`, red `#E60301`, white and cool neutral surfaces, with marketplace navy `#091B38`. Nippo is the local marketing display font, per the user's clarification; Quicksand is the local interface font. Darker red and secondary text are used where the neutral canvas needs additional contrast.

## Public and detail pages

Home now contains a four-slide editorial hero, trust rail, three business areas, live service preview, six-step service journey, authentic technician story, operating principles, live vehicle and product previews, lifestyle discovery, diagnostic equipment, approved reviews, FAQ and contact invitation. Hero navigation supports buttons, keyboard and swipe; autoplay pauses on interaction, hover and page invisibility, and reduced motion disables automatic movement.

Services, Shop, Vehicles and Contact share photographic banners, consistent sections and action styles. About combines the actual technician image, readable principles, existing diagnostic equipment and an expandable archive of the supplied posters. Service details retain real availability, booking and quotation logic. Product/vehicle details now use a primary-image-aware gallery with thumbnails, previous/next controls, image count and honest unavailable-media states. This fixes the old vehicle gallery's possibility of duplicating the primary image and omitting an earlier image.

Help has local search, eight topic categories, twelve articles, related guidance and links to working customer-care requests/history. Existing anonymous enquiry/complaint forms and signed-in support threads remain integrated. No fake live chat or invented policy was added. Help article metadata and sitemap inclusion were added.

## Dashboards, roles and controls

All customer and operational pages, including nested details, inherit the shared sidebar, toolbar, breadcrumb, typography, table, form, status and feedback system. White metric groups and compact controls replace inconsistent surface treatments. The mobile navigation is a native modal drawer with backdrop, contained focus, Escape dismissal, scroll locking and focus restoration. Desktop sidebar collapse, page search and internal scrolling remain available. Customer profile uses initials when no photo contract exists.

| Role        | Preserved access boundary                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Customer    | Own bookings, orders/cart/saved items, garage, inspections/purchases, payments/invoices, support/reviews, profile/security/privacy/notifications.                                                |
| Staff       | Operational destinations and branch-scoped data; restricted financial actions appear only with verified current capability grants. Own security/profile reads do not grant administrator access. |
| Admin       | Existing administrative catalogue, stock, finance, support, staff, audit and branch capabilities. Cannot create or promote a Super Admin or manage protected peers through unsupported actions.  |
| Super Admin | Existing privileged policy/access configuration and protected-account rules.                                                                                                                     |

Existing native selects, labelled fields, structured fieldsets, validation, review dialogs, stale-data handling, uncertain-write locking and accessible toast/feedback components remain in use. Detail disclosures now have sufficient touch height. No backend permission check was replaced with a visual-only restriction.

## Security and media

Authenticator setup now renders the backend-provided validated `otpauth` URI into a local canvas QR code through a dynamically imported QR library. The URI is not sent to an external QR service. Setup keys and recovery codes have reusable copy controls, announced confirmation and manual-copy fallback. Recovery codes also support a user-triggered text download. Existing session-change/discard behavior clears displayed security material.

The reusable signed uploader now offers drag-and-drop, browse/mobile file selection, validated local image previews, filename/size information, real progress, cancellation, retry and removal before confirmation. Object URLs are revoked. Existing signed preparation, token confirmation, allowlists and server validation remain authoritative. Hosted product images have a preview before reviewed save. Product/vehicle public cards continue to use only backend inventory media.

Customer profile/garage/service photos, a general customer directory, direct product binary upload and editing/removing attached stock images require backend contracts. See [exact gaps](redesign-backend-gaps.md); no imitation success flows or substitute datasets were implemented.

## Components and data sources

Reusable additions: `EditorialBanner`, `ServiceJourney`, `TrustPrinciples`, `LifestyleDiscovery`, `ContactInvitation`, `MediaGallery`, `AuthenticatorQr`, `CopyControl`. `FileUpload`, `DashboardShell`, `HelpCentre`, `AuthShell`, `Brand`, `HomeHero`, service rows and profile presentation were improved in place.

Public data: `/public/services`, `/public/catalog/products`, `/public/vehicles`, `/public/support/reviews`, their detail routes, branches, booking policy and service slots. Customer data remains under `/customers/*`; operational reads/mutations remain under their existing `/staff/*` and `/admin/*` boundaries. Authentication and MFA remain under `/auth/*`. Customer-care public submissions retain `/public/support/*`. No new backend endpoint was invented.

The current zero-deposit booking-policy flow remains a booking request and was tested without obsolete deposit consent. Historical API statuses and policy-driven payment handling were preserved. Paystack/Monnify availability, totals, stock, settlement, refunds and finance actions remain server-authoritative. Real provider transactions were not performed.

## Assets and design comparison

See [asset inventory](redesign-assets.md) and [route coverage](redesign-route-audit.md). All five supplied images are retained: lifestyle/executive/family/principles posters in About's archive, and the actual technician prominently on Home/About. Four generated editorial photographs support Home and listing-page banners. Fifteen concept images are retained in `docs/design-concepts`; generation source identifiers are recorded in `sources.json`.

Playwright with Microsoft Edge was used because the Browser plugin was unavailable. Concept files and rendered screenshots were inspected using `view_image`, including native-size desktop and mobile captures. Comparison points: typography and hierarchy; white header/red primary action; dark hero image framing and contrast; section width/spacing; dashboard sidebar/toolbar density; form and table sizing; mobile navigation and image framing.

Material repairs: replaced the incorrect distressed Nibble typeface with the user's Nippo; restored sentence-case controls; corrected header CTA color; fixed hero/body contrast; repaired dashboard link/secondary-text contrast; preserved every detail image; prevented duplicate mobile navigation; repaired mobile focus restoration and disclosure touch targets. Support controls now preserve keyboard visibility without scrolling a pointer-focused button between pointerdown and pointerup, which previously cancelled payment verification clicks near the viewport edge.

Intentional deviations: concepts' generated logos, sample people/stock, prices, counts, locations and policies are not production facts. The implementation uses supplied identity and backend data. Dashboard metrics/charts retain their existing real API shapes. Unsupported customer tables and media mutations are documented rather than invented. Supplied posters remain uncropped in the archive; marketing typography is rendered as HTML. Help search is synchronous local content, so it has results/no-results/reset rather than simulated network states.

## Verification

Production build and standalone preparation passed. Lint, TypeScript type checking, formatting and whitespace checks passed. Unit tests passed: 163 tests in 23 files. Browser checks used the production build in Edge with isolated API/storage fixtures; no real accounts or provider transactions were used.

| Browser group                                                         | Result and evidence                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public, dashboard navigation, authentication, MFA and dashboard forms | 62 cases verified: 61 passed together; the remaining navigation failed with `ERR_NETWORK_IO_SUSPENDED` and passed on its targeted rerun.                                                                                                                |
| Operational workflows                                                 | 215 cases verified: initial run 176 passed, 28 failed and 11 conditional storage cases skipped; 25 of the failures passed after repairs, then the final 3 passed. All 11 storage cases subsequently passed with the isolated storage allowlist enabled. |
| Brand, public accessibility, galleries, Help and booking              | 23 passed. Both gallery cases passed again against the final build.                                                                                                                                                                                     |
| Support responsiveness after the pointer-focus correction             | All 13 passed; the same run also passed the remaining MFA case.                                                                                                                                                                                         |

These are cumulative results with targeted reruns, not a claim that all suites were executed in one uninterrupted final run. Early failures exposed contrast, focus and pointer-click defects plus stale fixture/copy assumptions; repairs preserved request-integrity assertions. Conditional storage checks covered private evidence, expiration, session invalidation, uncertain submissions, document handover, failed/cancelled transfers, image drag-and-drop preview and exact-byte confirmation.

The 62-case group comprises `public`, `dashboard-navigation`, `auth-forms`, `mfa` and `dashboard-forms`. The 215-case group comprises `account-flows`, `booking-response`, `inventory`, `invoices`, `manual-payments`, `notifications`, `product-extras`, `security`, `staff-admin`, `staff-bookings`, `staff-order-access`, `staff-payments`, `staff-slots`, `support-responsive`, `support`, `vehicle-sales` and `vehicle-stock`. The 23-case group is `brand-refresh`. These names refer to `tests/e2e/*.spec.ts`; the groups total 300 distinct cases, with reruns excluded from that count.

Requested widths checked: 360, 390, 430, 768, 1024, 1280 and 1440 pixels, with additional 320, 850/851, 1366, 1655 and 1920 coverage in relevant suites. Tests include reduced motion, keyboard/focus behavior, drawer resizing, image loading, overflow and axe accessibility checks on selected public, dashboard and MFA states. Role fixtures cover Customer, Staff, Admin and Super Admin, own-account isolation, unauthorized route behavior, protected role changes and capability-gated financial actions. This does not substitute for deployed backend authorization testing.

Commands: `npm run build`, `npm run test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `git diff --check -- frontend`, and `npx playwright test` with the groups above. Browser flags: `PLAYWRIGHT_BASE_URL=http://localhost:3001`, `RUN_BRAND_TESTS=true` for the isolated public suite; storage-only cases use port 3002 with `RUN_ASSET_BROWSER_TESTS=true` and runtime `ASSET_STORAGE_HOSTS=storage.invalid`. The allowlist is not a production configuration change.

Logs are retained under `C:/Users/PC/.codex/allied-redesign-*`; native screenshots are in the system temporary directory (`allied-brand-*`, `allied-dashboard-shell-*`, `allied-detail-*`, `allied-mfa-*`). See [fidelity ledger](redesign-fidelity.md) and [exact changed files](redesign-changed-files.md).

Remaining external validation: a connected staging backend with suitable role accounts, payment-provider sandbox, email delivery and real object storage. The customer directory and unsupported image mutations require separately authorized backend implementation. No production-readiness claim is made for those missing integrations.

No deployment, commit or backend mutation was performed. Existing unrelated backend deployment files and `.gitattributes` were preserved. QA screenshots, browser traces and logs are outside the source tree. The retained concept images and production assets are intentional deliverables.
