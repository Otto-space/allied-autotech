# Allied AutoTech — Backend Implementation Gaps

**Implementation update (30 September 2026):** BG-01 through BG-06 are implemented and have local API/database/browser acceptance evidence. See the [final implementation handoff](backend/docs/backend-gaps-handoff.md) for current contracts, regression results and remaining staging storage verification. This update supersedes earlier implementation-status notes below.

Prepared: 30 September 2026

Basis: completed frontend milestones, recorded backend acceptance, and read-only review of the current backend routes, schemas and exported OpenAPI contract.

Status: BG-01 through BG-06 have recorded local acceptance evidence. Remaining work consists of deployed integration verification and the optional discovery enhancements below. This documentation review checked current source contracts and existing acceptance records; it did not rerun application tests or verify staging.

## Purpose and scope

Use this handoff to plan remaining backend and deployment work without rebuilding capabilities that already exist. Preserve existing authentication, authorization, response envelopes, CSRF protection, idempotency, concurrency handling and domain rules.

The redesign identified six gaps. All six now have backend routes, frontend integration and recorded local acceptance. The original requirements below are retained as historical acceptance baselines; they must not be treated as a new list of absent endpoints. Paths omit `/api/v1`. Current contracts are authoritative where they differ from the original proposals. Later page audits identified optional discovery enhancements, documented separately below.

| ID    | Originally identified capability                        | Current implementation                                                                 | Remaining work             |
| ----- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------- |
| BG-01 | Admin customer directory and aggregate customer details | Real directory and bounded related-record reads; local acceptance recorded             | Retain regression coverage |
| BG-02 | Customer profile photo                                  | Managed upload, replacement and removal; initials fallback                             | Verify deployed storage    |
| BG-03 | Customer garage images                                  | Owner-only gallery, order, cover and removal                                           | Verify deployed storage    |
| BG-04 | Service image management                                | Editor, public image projections and local acceptance recorded                         | Verify deployed storage    |
| BG-05 | Direct product image upload                             | Binary upload and hosted-image management; local acceptance recorded                   | Verify deployed storage    |
| BG-06 | Editing/removing attached stock vehicle images          | Metadata, ordering, cover, replacement, removal and preview; local acceptance recorded | Verify deployed storage    |

### Current status and release boundaries

- **BG-01 — locally verified:** mounted administrator-only directory and related-record reads have recorded local acceptance. See the implementation audit below for the actual contract and results; this is not a deployment claim.
- **BG-02 and BG-03 — locally verified, staging pending:** managed profile and garage media now exist. Their contracts and local evidence are documented in [Managed image lifecycle](backend/docs/managed-media.md). Real object-storage configuration and end-to-end staging checks remain outstanding.
- **BG-04 and BG-05 — locally verified, staging pending:** service media and product binary uploads have separate recorded backend, frontend and browser acceptance results in [Managed image lifecycle](backend/docs/managed-media.md). Product hosted-image management remains compatible. These records do not certify deployed storage.
- **BG-06 — locally verified, staging pending:** stock image mutations, authenticated preview and frontend integration have recorded local lifecycle, branch/role, concurrency and publication checks. See [stock-media acceptance](backend/docs/managed-media.md#stock-vehicle-images-bg-06). Existing upload, hosted/legacy image and non-image asset behavior remain supported. Deployed storage remains unverified.
- **Contact — no new submission endpoint required:** public enquiries and complaints already have backend routes. Branch setup and Maps configuration are tracked separately below.
- **Verification scope:** the original redesign handoff records completed frontend checks. The later Contact refinement passed its separate page gate; see its milestone report for scoped browser and real API evidence. Customer-directory implementation has its own acceptance record and must not inherit either frontend completion claim.

Suggested ownership: backend owns DTOs, authorization, persistence and media lifecycle; frontend owns integration after the contracts are available; deployment owners configure storage and Maps and verify the deployed integrations. No implementation is considered complete solely because an endpoint or button exists.

### Remaining delivery order

1. **Verify deployed media:** configure private object storage, frontend upload-host allowlisting, CORS and the cleanup worker. Apply reviewed migrations through the normal deployment process. Exercise actual upload/read/replace/delete and failure recovery in staging; injected storage tests do not satisfy this gate.
2. **Complete Contact configuration:** verify the deployed active handling branch and provider delivery. Add the Maps key when available; the address-based fallback already works without a Place ID.
3. **Retain regression coverage:** preserve all six completed capabilities. Keep backend capability acceptance separate from each frontend page's visual acceptance gate.
4. **Implement optional discovery extensions only when selected:** finalize their contracts and tests before enabling additional catalogue controls. Existing fallbacks work with the current APIs.

### Actionable remaining backlog

Priority P1 means a release verification requirement for the affected integration. P2 means an optional product enhancement; it does not block the current supported browsing experience. These priorities are proposed for planning.

| ID     | Priority / owner                             | Remaining task                                                                                                                                                                | Acceptance evidence                                                                                                                                                                                                           |
| ------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REL-01 | P1 — deployment + backend                    | Configure private object storage, signed-upload host allowlisting, CORS, migrations and the general cleanup worker. Verify all five media resources against deployed storage. | Real browser upload/confirm/read/replace/remove succeeds; invalid replacement preserves existing media; unauthorized personal reads fail; unpublished public media is inaccessible; cleanup retries retain referenced assets. |
| REL-02 | P1 — backend + operations                    | Verify the deployed active handling branch and existing enquiry/complaint delivery.                                                                                           | A synthetic submission persists against the intended branch and its configured notification delivery is observed. Record API receipt separately from provider delivery.                                                       |
| REL-03 | P1 — QA + deployment                         | Verify existing role/session, payment-provider sandbox and email/recovery integrations in staging.                                                                            | Record real integration outcomes, unauthorized requests and server-confirmed payment state. This is verification of existing features, not a request for replacement endpoints.                                               |
| CFG-01 | When available — owner + frontend/deployment | Configure the Google Maps key and verify the workshop location. No key or verified Place ID has been supplied.                                                                | The keyed map matches the approved address; the existing address and external directions remain usable without it. No backend Maps endpoint is required.                                                                      |
| API-01 | P2 — backend, then frontend                  | Add bounded vehicle make/model options and, if required, filtered total counts.                                                                                               | Options use public inventory visibility, models belong to the selected make, traversal is bounded and stable, and any totals match the filtered dataset.                                                                      |
| API-02 | P2 — backend, then frontend                  | Add catalogue-wide category search, brand/compatibility options and, if selected, product price/availability filters and totals.                                              | Queries are documented and validated; results follow active catalogue and stock rules; option searches and filters operate across the catalogue, not one fetched page.                                                        |
| API-03 | P2 — backend, then frontend                  | Add service search, category taxonomy/options, sorting and totals if required.                                                                                                | Active-service visibility, search semantics, category ownership, cursor behavior and query performance are documented and tested before UI integration.                                                                       |

For REL-01, the existing configuration uses `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY` and frontend `ASSET_STORAGE_HOSTS`. Configure secrets through the deployment secret manager. The detailed staging procedure is in the [implementation handoff](backend/docs/backend-gaps-handoff.md#19-missing-credentialsinfrastructure-and-remaining-verification).

For API-01 through API-03, proposed endpoints and fields below are design proposals, not callable contracts. Delivery must include exported OpenAPI, regenerated frontend types, authorization/visibility and pagination tests, and frontend loading/empty/error integration. Do not derive global facets or totals from a single page.

### Handoff and closure evidence

Create implementation tickets from API-01 through API-03 only after the corresponding enhancement is selected. Track REL-01 through REL-03 as deployment verification tasks and CFG-01 as a configuration dependency. BG-01 through BG-06 are completed local implementations; reopen one only for a reproduced defect or a newly agreed requirement.

For each remaining item, record the assigned owner, target environment, deployed revision, prerequisites, actual result and evidence link. Verification records should identify the tested workflow and resulting record or request ID without including credentials or customer data. Close an item only when its acceptance evidence above is recorded; an API receipt alone does not establish email delivery, and a local storage fixture does not establish deployed storage readiness.

**Confirmed workshop configuration:** use **133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria**. Pizza Jungle is inside Kilimanjaro; do not substitute “beside Pizza Jungle” in customer-facing copy. The owner has not supplied a Maps key or verified Place ID. Preserve the address panel and address-based directions until the embedded map can be configured and checked. This does not create a backend endpoint requirement.

Optional discovery enhancements below are separate from these required media gaps. The page-by-page frontend quality work remains tracked in its [milestone register](frontend/docs/page-quality/README.md).

### Completed-page coverage

The current page-quality register records seven completed local milestones: Contact, Vehicles listing, Shop listing, Services listing, Vehicle detail, Product detail and [Service detail](frontend/docs/page-quality/service-detail.md). The later transactional, account and dashboard milestones have not yet passed that gate. This document does not certify the entire frontend or deployment as complete.

| Completed surface                   | Backend handoff                                                                                                                                                                                                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contact and Customer Care           | Existing enquiry/complaint APIs are integrated. Verify the deployed handling branch and notification delivery under REL-02; retain the address fallback until CFG-01 can be configured.                                                                                                            |
| Vehicles listing and Vehicle detail | Existing public inventory, detail and media reads are available. API-01 is optional discovery work; deployed stock-media lifecycle verification remains under REL-01.                                                                                                                              |
| Shop listing and Product detail     | Existing catalogue, detail, cart and saved-item APIs are available. API-02 is optional discovery work; deployed product-media verification remains under REL-01. Checkout and provider verification are separate from product-page acceptance.                                                     |
| Services listing and Service detail | Existing service reads, pricing filters, availability, booking requests and service enquiries are integrated and locally verified. API-03 remains optional discovery work; deployed service-media verification remains under REL-01. Separate Booking and Quotation page gates remain outstanding. |

**Implementation decision:** no additional mandatory endpoint gap has been established by these completed page audits beyond the six capabilities already implemented. REL-01 through REL-03 require integration verification; CFG-01 requires configuration when available; API-01 through API-03 require new backend implementation only if those optional enhancements are selected. Reassess this inventory as each remaining page passes its audit.

## BG-01 — Admin customer directory and detail views

**Current status:** implementation and local acceptance recorded. This section preserves the original requirements; the implementation audit below describes the routes and evidence. Unchecked criteria below are the original checklist, not a claim that the implementation is absent.

### Existing capability

`GET /admin/staff/candidates?email=...` finds eligible staff-promotion candidates by exact email. It is not a general customer search endpoint and must not be repurposed. Existing operational records expose only their authorized customer projections.

### Required implementation

- Add an Admin/Super Admin customer listing with server-side search, filters, sorting and deterministic cursor pagination.
- Define permitted search fields, including name, email and phone. Explicitly document normalization, matching rules, query limits and indexed query strategy.
- Return the minimal table projection: stable customer ID, display name, permitted contact information, existing account status and registration date. Include branch associations only if the domain supports them; do not invent a single customer branch.
- Return pagination metadata consistent with existing APIs. If total counts are exposed, document their meaning and whether they are exact.
- Add an authorized customer detail projection for profile and related garage, bookings, quotations, orders, payments and support records. Reuse existing projections where possible and paginate each collection; avoid an unbounded aggregate response.
- Define which fields each role may read. Do not expose password hashes, sessions, MFA secrets, recovery codes, reset tokens or unrelated sensitive internal fields.
- Keep customer impersonation, account suspension and role promotion outside this read-only directory scope unless separately specified. Admin must not gain the ability to assign Super Admin.

### Proposed API additions

| Method | Proposed path                                | Purpose                                                                                               |
| ------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/admin/customers`                           | Search/filter/sort and page through authorized customer rows                                          |
| GET    | `/admin/customers/{customerId}`              | Read the permitted customer summary                                                                   |
| GET    | `/admin/customers/{customerId}/{collection}` | Optional separately paginated related records; define an explicit allowlist of collections in OpenAPI |

**Authorization:** Admin and Super Admin within existing policy boundaries. Ordinary Staff and Customers must be denied general directory access. Related records must independently enforce their existing access rules.

**Acceptance criteria**

- [ ] Search runs against real persisted customers and supports empty, no-results and invalid-query responses.
- [ ] Stable sorting and cursor traversal do not duplicate or omit records in an unchanged dataset; behavior under concurrent changes is documented.
- [ ] Invalid customer IDs, deleted/unavailable records and unauthorized access use existing response conventions.
- [ ] Detail collections remain bounded and enforce role/record visibility.
- [ ] Tests cover all four roles, sensitive-field exclusion and query performance on representative data.

## BG-02 — Customer profile photo

**Current status:** implemented with recorded local acceptance; deployed storage verification remains. Actual routes are `POST /customers/profile/photo/upload`, `PUT/DELETE /customers/profile/photo`, and owner-authorized `GET /customers/media/images/{imageId}`. Profile reads include `mediaVersion` and nullable `photo`. See [managed-media evidence](backend/docs/managed-media.md). The requirements below describe the original gap and remain the acceptance baseline.

### Existing capability

At the original audit, `GET/PATCH /customers/profile` supported personal/contact/address metadata and exposed `CustomerProfile.avatarUrl`, but provided no managed media mutations. The lifecycle described below has since been implemented through separate photo routes.

### Required implementation

- Add owner-bound image upload preparation and confirmation, using the shared media rules below.
- Add an optional photo projection to the profile response, including stable image ID and an authorized display URL or access mechanism.
- Support atomic replacement and removal. A failed replacement must leave the current photo intact.
- Schedule cleanup of replaced/deleted objects without deleting shared or still-referenced assets.
- Keep profile photos private by default; explicitly authorize any administrative visibility rather than making the storage bucket public.

**Proposed endpoints:** `POST /customers/profile/photo/upload`, `PUT /customers/profile/photo` to confirm a validated upload ticket, and `DELETE /customers/profile/photo`.

**Authorization:** the authenticated customer owns the profile. The client must not choose another customer's owner ID.

**Acceptance criteria**

- [ ] Upload, replacement and deletion are reflected after a fresh profile read.
- [ ] Cross-account access, ticket substitution and expired/replayed tickets are rejected.
- [ ] Invalid uploads do not replace the current photo; deletion restores the initials fallback.
- [ ] Personal image URLs follow documented privacy, expiry and cache rules.

## BG-03 — Customer garage images

**Current status:** implemented with recorded local acceptance; deployed storage verification remains. The four routes proposed below now exist, with owner-only image reads, up to 12 images and version-checked mutations. See [garage lifecycle and evidence](backend/docs/managed-media.md#bg-03-private-garage-galleries). The requirements below remain the original acceptance baseline.

### Existing capability

At the original audit, `/customers/vehicles` and `/customers/vehicles/{vehicleId}` supported customer-owned vehicle metadata CRUD only. Owner-scoped media has since been added. Garage records remain distinct from staff stock vehicles.

### Required implementation

- Add an owner-scoped image collection to garage vehicle detail responses.
- Support upload preparation, confirmation, alt text, display order, primary/cover selection and deletion.
- Publish the permitted formats, size/dimension limits and maximum image count in the contract.
- Define deterministic ordering, primary selection when the cover is removed, and cleanup when a garage vehicle is deleted.
- Enforce ownership for image reads as well as writes. Garage images must not appear in public marketplace listings automatically.

**Proposed endpoints:**

- `POST /customers/vehicles/{vehicleId}/assets/upload`
- `POST /customers/vehicles/{vehicleId}/images`
- `PATCH /customers/vehicles/{vehicleId}/images/{imageId}`
- `DELETE /customers/vehicles/{vehicleId}/images/{imageId}`

**Acceptance criteria**

- [ ] The owner can attach, reorder, select a cover and remove images, with changes surviving refresh.
- [ ] Another customer's vehicle/image IDs and tickets cannot be read or mutated.
- [ ] Concurrent edits cannot silently overwrite ordering or create multiple primary images.
- [ ] Count limits, deletion cleanup and cover fallback have explicit tests.

## BG-04 — Service image management

**Current status:** implemented with recorded local acceptance; deployed storage verification remains. Actual routes use `GET /admin/services/{serviceId}/images`, `POST /admin/services/{serviceId}/assets/upload`, `PUT /admin/services/{serviceId}/image`, and `PATCH/DELETE /admin/services/{serviceId}/images/{imageId}`. Separate administrator preview and public active-service image reads exist. Mutations use `Service.version`. See [current service contract and evidence](backend/docs/managed-media.md#service-image-checkpoint-bg-04); the original proposed paths below are superseded by that contract.

### Existing capability

At the original audit, `GET/POST /admin/services` and `PATCH /admin/services/{serviceId}` managed service records without media. The current implementation adds separate media routes and nullable public image projections, as described in the status note above.

### Required implementation

- Add an optional service image projection and authorized upload/confirmation, replacement, alt-text editing and removal.
- Use a single primary image unless a service gallery is explicitly required; avoid introducing an unsupported gallery assumption.
- Include the approved image in public service list/detail responses according to existing service visibility rules.
- Define whether replacing media is immediately visible or follows an existing publication workflow. Uploading an object must not bypass service visibility controls.

**Proposed endpoints:** `POST /admin/services/{serviceId}/image/upload`, `PUT /admin/services/{serviceId}/image`, `PATCH /admin/services/{serviceId}/image`, and `DELETE /admin/services/{serviceId}/image`.

**Authorization:** Admin/Super Admin with existing service-management access. Do not implicitly grant ordinary Staff or Customers media administration.

**Acceptance criteria**

- [ ] Authorized users can upload, replace, edit alt text and remove service images.
- [ ] Public reads expose only media allowed by service visibility policy.
- [ ] Services without images continue to render through the existing icon fallback.
- [ ] Failed uploads or replacements preserve the previously valid service record and image.

## BG-05 — Direct product binary uploads

**Current status:** implemented with recorded local acceptance; deployed storage verification remains. The two upload/confirmation routes proposed below now exist. `Product.mediaVersion` supports gallery concurrency, uploaded and hosted images have distinct projections, and existing metadata/removal routes handle both sources. See [product contract and evidence](backend/docs/managed-media.md#product-binary-upload-checkpoint-bg-05). The requirements below preserve the original acceptance baseline.

### Existing capability

- `POST /admin/catalog/products/{productId}/images` accepts approved hosted image metadata: `url`, `altText`, `sortOrder`, `isPrimary`.
- `PATCH/DELETE /admin/catalog/products/{productId}/images/{imageId}` already supports metadata updates and removal.
- The original audit found no direct binary upload preparation/confirmation contract. That gap has since been implemented; retain working hosted-image CRUD alongside the new binary workflow.

### Required implementation

- Add product-bound signed upload preparation, or an equivalent backend-mediated binary upload.
- Add a token-confirmation operation that verifies the uploaded object before attaching it to the product.
- Preserve the existing hosted-URL creation contract. Prefer a separate confirmation endpoint, or document a backward-compatible discriminated request that accepts exactly one of an approved URL and an upload ticket.
- Feed confirmed uploads into the existing image ordering, primary selection, edit and removal behavior.
- Distinguish backend-owned uploaded objects from externally hosted images so deletion only removes objects the application owns.

**Proposed additions:** `POST /admin/catalog/products/{productId}/assets/upload` and `POST /admin/catalog/products/{productId}/images/confirm`. Existing hosted-URL endpoints remain supported.

**Authorization:** preserve existing catalogue image administration permissions and any product scope restrictions.

**Acceptance criteria**

- [ ] A selected local file becomes a persistent product image only after successful confirmation.
- [ ] Existing hosted-URL image creation, ordering, primary selection and deletion remain compatible.
- [ ] Invalid, expired or wrong-product tickets cannot create image records.
- [ ] Removing externally hosted metadata does not attempt to delete an external object.

## BG-06 — Editing/removing attached stock vehicle images

**Current status:** implemented with recorded local acceptance; deployed storage verification remains. `PATCH/DELETE /staff/vehicles/{vehicleId}/images/{imageId}` and `GET /staff/vehicles/{vehicleId}/images/{imageId}/content` are integrated with the stock editor. The update schema requires `expectedVersion` plus at least one change and supports nullable alt text, display order and primary selection. The [stock-media acceptance record](backend/docs/managed-media.md#stock-vehicle-images-bg-06) reports 13 stock-media integration tests, six media HTTP tests, two live stock browser scenarios and all 12 existing stock browser scenarios passing. These are recorded prior results using isolated storage, not tests rerun by this documentation review.

### Existing capability

- `POST /staff/vehicles/{vehicleId}/assets/upload` prepares a signed upload.
- `POST /staff/vehicles/{vehicleId}/images` confirms an `assetToken` with `altText`, `sortOrder` and `isPrimary`.
- `GET /public/vehicles/images/{imageId}` serves media through the public proxy subject to existing visibility rules.
- At the original audit, existing images had no PATCH/DELETE routes. These operations and their frontend integration are now implemented with recorded local acceptance.

### Required implementation

- Add `PATCH /staff/vehicles/{vehicleId}/images/{imageId}` for permitted alt-text, order and primary-selection changes.
- Add `DELETE /staff/vehicles/{vehicleId}/images/{imageId}` for authorized removal.
- Apply the existing stock role, branch, record and publication rules to the new mutations; a `/staff` prefix alone is not an authorization check.
- Enforce image-to-vehicle binding and the repository's concurrency conventions. Keep primary selection and ordering transactional.
- Define whether deleting the last image of a published listing is allowed, and the primary fallback when deleting the current cover.
- Support replacement through verified new attachment followed by removal of the old image, or a documented atomic operation. Never delete the old image before a replacement is confirmed.
- Define public proxy/cache behavior and storage cleanup after removal.

**Acceptance criteria**

- [ ] Authorized stock users can edit existing image metadata, change the cover, reorder and remove images.
- [ ] Unauthorized branches/roles and mismatched vehicle/image IDs fail closed.
- [ ] Stale updates produce an explicit conflict instead of overwriting newer changes.
- [ ] Failed replacement preserves the previous image; deleted images no longer appear in listing responses.
- [ ] Publication constraints and public cache invalidation are tested.

## Shared media implementation requirements

The shared managed-media infrastructure is now implemented for profile, garage, service, product and stock vehicle resources. Reuse it for future extensions instead of building another ticket/storage/cleanup system. The following requirements remain the baseline; live storage verification is still required.

Extend the existing signed asset infrastructure where appropriate. Do not route unrelated resources through stock vehicle authorization merely to reuse an upload URL.

1. **Preparation:** bind the upload ticket to the authenticated principal, resource, purpose, permitted MIME type, size and checksum. Return expiry and the precise upload method/headers required by storage.
2. **Validation:** enforce actual byte size, file signature/decodability, dimension limits and checksum at confirmation. A client-supplied extension or MIME type is insufficient. Define image transformations and metadata stripping appropriate to personal images.
3. **Confirmation:** verify the object and bind it to one authorized resource. Document single-use ticket behavior and the response to an idempotent retry after a lost response. Storage transfer alone must not create a visible image record.
4. **Read model:** return stable image IDs, alt text, ordering/primary status where applicable, dimensions and a safe display URL/access method. Do not leak storage credentials or upload tickets in normal read responses or logs.
5. **Consistency:** retain existing CSRF, idempotency and version-check conventions; specify the mutation version source and how callers recover from conflicts or uncertain outcomes.
6. **Privacy/publication:** personal profile/garage media requires owner-authorized reads; service/product/stock images follow catalogue/listing visibility. Do not expose private documents through public image proxies.
7. **Lifecycle:** clean up expired unattached uploads, replaced images and deleted-resource assets. Make cleanup retryable and safe for retained references. Define cache invalidation and retention behavior.
8. **Limits and errors:** publish per-resource file/count limits and machine-readable failure codes using existing envelopes. Cover invalid media, oversized files, expiry, permission denial, stale versions, rate limits and storage outages.
9. **Audit:** record permitted actor/resource mutation metadata through existing audit facilities without recording file contents, secrets or signed URLs.

## Contract, persistence and delivery checklist

This is the original implementation checklist, retained as a baseline. Its unchecked boxes are not the current backlog. Implementation and local evidence for all six capabilities are recorded in the [handoff](backend/docs/backend-gaps-handoff.md); outstanding work is listed in the actionable backlog above.

- [ ] Inspect current models and infrastructure before selecting new tables or fields; add reviewed, backward-compatible migrations only where required.
- [ ] Add validated DTOs, policy checks, repository/service/controller logic and routes within the existing module architecture.
- [ ] Extend module OpenAPI definitions and regenerate `backend/docs/api/allied-autotech.openapi.json`.
- [ ] Add unit/integration tests for ownership, all relevant roles, concurrency, idempotent retries, validation and storage failures.
- [ ] Regenerate frontend API types through the existing `api:types` command after the contract is finalized.
- [ ] Integrate real customer search and supported media actions into the redesigned frontend, retaining loading, empty, error, conflict and permission states.
- [ ] Run backend contract/tests and frontend lint, type checking, tests and build; verify browser flows against staging rather than fixtures alone.

The original six-gap checklists above are acceptance requirements, not a current list of absent endpoints. Follow the remaining delivery order at the top of this document and retain links to each capability's actual verification record.

## Deployment verification — separate from missing features

The redesign's browser tests used isolated fixtures. The following are integration checks, not proof that additional backend features are missing:

- Verify all four roles with suitable staging accounts, including direct unauthorized requests and cross-customer isolation.
- Exercise signed uploads against real configured storage, including CORS, allowlists, expiry, cleanup and public/private access boundaries.
- Verify existing payment-provider sandbox, email delivery, cookie/session and recovery flows against deployed services.
- Retest gallery/profile updates after reload and public cache refresh; confirm that failed storage transfers never create successful attachments.

Existing booking requests, quotations, checkout/payment authority, MFA, support history, notifications and local Help articles are outside these six implementation gaps. Preserve their current behavior and do not introduce booking deposits or expose disabled payment providers as part of this work.

### Contact and workshop configuration

The current Contact page uses existing `POST /public/support/enquiries` and `POST /public/support/complaints` routes. These routes validate real submissions and return an accepted receipt; they are not missing backend features. Attachment upload is not part of the public submission contract and must not be added to the form without a separately specified backend capability.

| Item                   | Remaining action                                                                                                                                                                                                       | Completion evidence                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active handling branch | Confirm the deployed backend contains the correct active branch and that public branch reads expose it. Enquiries/complaints require an active handling branch; vehicle enquiries derive it from the selected listing. | A real submission creates the intended support record against the correct branch. An empty dataset shows a recoverable empty state.                                 |
| Google Maps embed      | Configure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with appropriate API/referrer restrictions, then rebuild and verify the embedded map. The owner has no key or verified Place ID yet.                                       | The map loads at the correct workshop in each configured environment; without a key, the existing address panel and external Maps links remain usable.              |
| Workshop address       | Retain **133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria**. The owner confirmed that Pizza Jungle is within Kilimanjaro and that the site must say “beside Kilimanjaro.”                    | Visible address, map query and directions agree with the approved address. A Place ID or coordinates are used only after verification.                              |
| Contact acceptance     | Local page gate passed, including browser, real API/database and shared-component checks. Deployed provider delivery and the keyed map remain separate configuration checks.                                           | See the [Contact milestone report](frontend/docs/page-quality/contact.md) for exact results and limitations; fixture success is not deployed delivery verification. |

The Maps item is frontend/deployment configuration, not a requirement for a new backend Maps endpoint. A Place ID is optional while the address query is used. The existing fallback permits the page to work before a key is supplied.

### Vehicle discovery metadata — optional API enhancement

The page-by-page Vehicles audit confirmed that `GET /public/vehicles` supports exact-name make/model filters and cursor pagination, but returns neither a complete make/model options dataset nor a total match count. The redesigned frontend therefore uses optional exact-name text fields and reports the number of vehicles on the current page. This is a truthful, working fallback, not a missing listing integration.

To enable searchable make/model pickers and a global result count later:

- Define an anonymous, bounded catalogue-options endpoint, for example a proposed `GET /public/vehicles/facets`. Support searching make/model names and selecting models within a make; document pagination and completeness. Do not derive an allegedly exhaustive list from one inventory page.
- Apply the same AVAILABLE-listing and active-branch visibility rules as public inventory. Return display labels and filter values without private stock, VIN, acquisition or customer information.
- If adding `totalMatches` to the listing response, count the same filtered public dataset before cursor pagination. Specify whether the count is exact, its consistency during concurrent inventory changes, and its performance/caching policy.
- Publish the DTOs, validation, query semantics, limits and empty/error responses in OpenAPI before changing the frontend integration. Existing public queries must remain compatible.

Acceptance: options exclude unavailable inventory, make/model relationships are correct, empty and paginated option searches work, counts agree with filtered inventory, and performance is verified against representative stock volumes. Neither capability is required to ship the current truthful page-count/exact-name fallback. No implementation of this proposed enhancement is claimed here.

### Shop discovery metadata — optional API enhancement

The [Shop audit](frontend/docs/page-quality/shop.md) confirms that product search, category, exact brand/make/model, year, featured status and sorting already work through `GET /public/catalog/products`. Category reads accept only `cursor` and `limit`; product and category collections return `items` and `nextCursor`, without totals. These are limitations of discovery metadata, not missing product-list endpoints.

If broader discovery is required later:

- Add bounded server-side category search or a separately documented options endpoint. Until then, category picker search must clearly say it searches loaded categories and allow loading additional pages.
- Define searchable brand and compatibility options sourced from publicly visible products. Do not present values from one product page as a complete catalogue.
- Define a filtered `totalMatches` only if required, with matching visibility/filter semantics, consistency and performance guarantees. The current-page count remains a valid fallback.
- Specify price-range or availability filters before adding them to the UI. Neither query exists today; filtering a single fetched page cannot implement catalogue-wide filtering. Availability must follow the existing active-branch, unreserved-stock rules without exposing internal quantities.

Acceptance for any extension: strict validated queries and exported OpenAPI, stable bounded pagination, active product/category visibility, matching option/filter semantics, accurate empty states and representative-volume query checks. These are proposed API enhancements. The current Shop page has passed its separate local acceptance gate using the existing contract; no implementation of these enhancements is claimed here.

### Service discovery — optional API enhancement

The Services listing audit confirms that `GET /public/services` accepts only `pricingType` (`FIXED` or `QUOTE_REQUIRED`), a UUID `cursor`, and `limit` (1–100, default 25). Public reads include active services only, ordered by ID, and return `items` plus an optional `nextCursor`. The API already supports pricing filters and pagination; it does not expose catalogue search, category filters, configurable sorting or total match counts.

If catalogue-wide search or richer discovery is required later:

- Specify a bounded search query with normalization, matching fields, minimum/maximum length and indexed query behavior. Do not implement apparent catalogue-wide search by filtering one fetched page.
- Define category data and its public options endpoint before adding category controls. No service category taxonomy is supplied by the current contract.
- Allowlist any new sorting and bind pagination semantics to the chosen filters/sort. Define behavior under concurrent service edits.
- Add a filtered total only if needed, using the same active-service and filter rules before pagination, with documented consistency and query costs.

Acceptance: anonymous queries exclude inactive services; invalid query values fail predictably; search, filters, cursor traversal and totals agree on the same public dataset; OpenAPI and representative-volume tests cover the extension. The current pricing filter and page-count fallback require no new backend capability. Services page visual acceptance remains a separate milestone.

## Repository evidence and frontend handoff

- [Exported API contract](backend/docs/api/allied-autotech.openapi.json)
- [Customer routes](backend/src/modules/customers/customers.routes.ts) and [schemas](backend/src/modules/customers/customers.schemas.ts)
- [Directory routes](backend/src/modules/customers/customer-directory.routes.ts) and [directory contract](backend/src/modules/customers/customer-directory.openapi.ts)
- [Profile read projection](backend/src/modules/customers/customers.repository.ts) and [data models](backend/prisma/schema.prisma)
- [Catalogue routes](backend/src/modules/catalog/catalog.routes.ts) and [schemas](backend/src/modules/catalog/catalog.schemas.ts)
- [Product binary media routes](backend/src/modules/catalog/product-media.routes.ts) and [managed-media contracts and acceptance](backend/docs/managed-media.md)
- [Service routes](backend/src/modules/service-operations/service-operations.routes.ts) and [schemas](backend/src/modules/service-operations/service-operations.schemas.ts)
- [Stock vehicle routes](backend/src/modules/vehicles/vehicles.routes.ts) and [schemas](backend/src/modules/vehicles/vehicles.schemas.ts)
- [Stock image mutation schemas](backend/src/modules/vehicles/stock-media.schemas.ts) and [service implementation](backend/src/modules/vehicles/stock-media.service.ts)
- [Storage adapter](backend/src/providers/storage/s3-object-storage.adapter.ts)
- [Support routes](backend/src/modules/support/support.routes.ts) and [schemas](backend/src/modules/support/support.schemas.ts)
- [Identity routes](backend/src/modules/identity/identity.routes.ts)
- [Original redesign gap summary](frontend/docs/redesign-backend-gaps.md)
- [Completed frontend handoff](frontend/docs/redesign-handoff.md)

This document records the implementation work required. It does not authorize changes to role boundaries, existing domain rules or unrelated deployment files.

## Implementation audit — 30 September 2026

This section preserves the earlier BG-01 implementation checkpoint. Statements below about missing media infrastructure describe that checkpoint, before BG-02 through BG-06 were completed. Use the current status table and [managed-media record](backend/docs/managed-media.md) for present media capabilities and verification boundaries.

The supplied brief refers to `Pasted markdown(6).md`; that filename is absent from the workspace and attachment directory. This repository document contains the matching six-gap specification and was read in full before implementation.

Existing infrastructure: npm lockfiles per application; Express 5 controllers/services/repositories; Prisma 7 and PostgreSQL; secure session authentication with privileged MFA; strict Zod validation; shared error/success envelopes; PostgreSQL-backed production rate limiting; transactional audit events; OpenAPI export, validation and route-drift checks; Next.js 16 with generated OpenAPI types, authenticated API client, resource loading, cursor pagination, feedback, upload and mutation-review components.

Discrepancies and reuse boundaries:

- `CustomerProfile.avatarUrl` already exists and is returned by profile reads, but it has no authorized upload/replacement lifecycle. It is not evidence of a completed profile-media feature.
- Stock asset tickets are encrypted and bound to actor, vehicle, kind, object key, MIME, size, checksum and expiry. The S3 adapter validates metadata and a short signature prefix, but does not fully decode images, strip metadata, or delete objects. Existing workers provide a runtime to extend; an object cleanup lifecycle is missing.
- The object-storage fallback reports synthetic success when no bucket is configured. New media functionality must fail closed outside explicit injected test adapters.
- Existing Admin/Super Admin operational read policies are cross-branch; branch restrictions apply to ordinary Staff. Customer profiles have no branch relationship. Directory access must not grant Staff these administrative reads.
- New directory reads use minimal projections and separate bounded collections. No counts, media access, impersonation or account mutations are included.

BG-01 contract: `GET /admin/customers`, `GET /admin/customers/{customerId}`, and explicit `GET` collection routes ending in `vehicles`, `bookings`, `quotations`, `orders`, `payments`, `enquiries`, and `complaints`. Customer IDs are profile IDs. Name/email prefix searches require two characters; phone prefixes require three digits; exact ID search requires a UUID. Queries trim/collapse whitespace and lowercase text; phone matching removes punctuation without guessing country codes. Empty search is supported. Search field, status, email verification and registration-date sort are allowlisted. Default page size is 25, maximum 50. Directory cursors bind filters and sorting, carry the last registration timestamp and unique account ID, and remain usable if the preceding row disappears. They do not provide snapshot isolation: concurrent matching inserts/updates can affect subsequent pages. Related collections use ascending record IDs and independently validate customer-bound cursors. Read audits contain collection/result count, not search text or contact values. Responses are private and uncached.

Persistence: `20260930010000_customer_directory_indexes` adds prefix expression indexes, an account registration index, and customer/record composite indexes without adding extensions or changing existing records. Expression and partial indexes are maintained by SQL; representable composite indexes are declared in Prisma.

BG-01 capability verification complete: the full 43-migration history replayed successfully into the new isolated `allied_bg_gaps_20260930_test` database. Initial directory integration tests passed (22), unit tests passed (6), and 5,000-customer PostgreSQL EXPLAIN checks confirmed name/phone/email index use (1). OpenAPI validation and mounted-route coverage passed. Frontend directory/detail integration and generated types are present. Five Playwright scenarios passed against the real isolated API with synthetic accounts; error/empty/loading responses were explicitly controlled for those UI-state checks. The real-data browser flow passed again after compact-spacing changes. Desktop (1440px) and mobile (390px) screenshots were inspected, with no page overflow. Frontend production build/standalone packaging, targeted lint/format checks, and backend/frontend type checks passed. Frontend unit regression: 161/163 passed in parallel, with the two timeout cases passing unchanged in a one-worker rerun. BG-02 through BG-06 remain outstanding.

Environment: local PostgreSQL is available. Real object storage is not configured (`OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY` absent; an endpoint is also needed for non-AWS storage). Staging uploads/CORS/cleanup have not been verified. Browser QA uses an isolated local API/test database and a separate frontend copy because another development server is running in the shared workspace. Existing contact/support edits are outside this implementation and are preserved.
