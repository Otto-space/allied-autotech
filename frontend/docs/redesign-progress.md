# Allied AutoTech redesign — implementation ledger

Status: frontend implementation and browser verification complete. See redesign-handoff.md for verified results and explicitly documented backend-dependent exceptions.

## Source and scope

The September 29 brief and all five supplied photographs govern the redesign of all public, authentication, customer and operational routes, including detail views. Existing backend rules and working transactions take precedence over concepts. Backend files are read-only for this task. Pre-existing backend deployment changes are unrelated and must remain intact.

Reference mapping, verified by image inspection:

- Image 1: lifestyle vehicle montage; editorial discovery and carousel direction.
- Image 2: executive Mercedes campaign; marketplace architecture and executive positioning.
- Image 3: operating principles; readable code-native principles on Home and About.
- Image 4: actual technician poster; authentic company story, preserving identity.
- Image 5: family/Highlander campaign; family vehicle discovery, not live inventory.

## Design specification

- Ink `#01121A`, brand red `#E60301`, true white, cool neutral information surfaces. Marketplace `#091B38`.
- Local Nippo display type (user clarification) for marketing, local Quicksand for all UI and operational headings.
- White compact public header; dark photographic hero with directional contrast; thin technical dividers; segmented carousel progress.
- Public sections alternate editorial media, open lists, service journey, live catalogue and trust content. No invented stock, ratings, counts or claims.
- Dashboard: 256px dark collapsible sidebar, compact white toolbar, cool canvas, readable tables and 40–44px controls. Titles 24–32px.
- Auth: focused 420–480px panel. Shared compact fields, feedback and copy controls.
- Concepts are layout references. Generated text, logos, prices, identity and business claims are not approved content. Such discrepancies must be replaced with backend data, supplied identity and approved copy.

## Verified architecture

Next.js 16.3.3 App Router, React 19, TypeScript, Tailwind 4, React Hook Form, Zod, Lucide; npm lockfile. No shadcn/Radix dependency is present, so preserve the existing component system. `PublicHome` and `loadPublicSeed` support server-rendered initial data. Typed API client, cookie sessions, CSRF, idempotency, version checks and role capabilities already exist. Public, auth, dashboard and operational detail routes are extensive. Nippo variable is sourced directly from Fontshare with its license; Quicksand is locally bundled. Both are now self-hosted via next/font/local.

## Confirmed contract gaps

- Customer profile: `PATCH /customers/profile` only permits name, phone and address fields. No profile image storage, upload, replacement or deletion endpoint.
- Customer-owned vehicles: `/customers/vehicles` supports vehicle metadata CRUD only. No image upload, image ordering or cover selection contract. These records are distinct from staff vehicle stock.
- Services: service DTO has no image field. Service-image upload/edit cannot be implemented honestly against this contract.
- Product images: administrative hosted-image metadata CRUD exists; no direct binary upload preparation endpoint.
- Vehicle stock: staff signed asset upload and image confirmation exist. Preserve ownership, storage allowlist and publish boundaries.
- Customer directory: The exact-email endpoint /admin/staff/candidates is restricted to staff promotion candidates, not a general customer directory. General customer search and aggregate customer details require new backend contracts; do not repurpose the promotion endpoint.

## Completed implementation and verification

1. Completed fifteen focused visual concepts and nine optimized production assets with provenance.
2. Completed shared public, detail, dashboard and authentication systems in place.
3. Integrated approved copy, all supplied imagery, real services and live commerce previews; preserved honest loading/error/empty states.
4. Improved forms, media galleries, supported uploads, MFA, Help and role-specific detail flows. Customer-directory and unsupported media contracts are documented in redesign-backend-gaps.md.
5. Completed unit tests, production build and browser suites; final lint, type and formatting results are recorded in the handoff.
6. Inspected screenshots and tested 360, 390, 430, 768, 1024, 1280 and 1440+ widths; fidelity and accessibility repairs are recorded in redesign-fidelity.md.
7. Recorded all 87 page routes, capability gaps, asset sources, exact changed files and endpoint handoff.

Browser plugin is not available in this session; use the repository Playwright/Edge configuration. Fixture-based UI checks must be distinguished from real backend/provider integration checks. No test account or running backend has yet been verified for this task.
