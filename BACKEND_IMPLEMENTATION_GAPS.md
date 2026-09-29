# Allied AutoTech — Backend Implementation Gaps

Prepared: 30 September 2026  
Basis: completed frontend redesign and read-only review of the current backend routes, schemas and exported OpenAPI contract.  
Status: implementation backlog; the additions below are not implemented by this document.

## Purpose and scope

Implement the missing backend capabilities needed to complete the redesigned customer management and media workflows. Preserve existing authentication, authorization, response envelopes, CSRF protection, idempotency, concurrency handling and domain rules.

There are six confirmed gaps. Proposed endpoint paths and fields below are design recommendations, not existing API contracts. Paths omit the deployment's API prefix. Final names, DTOs and permissions must be documented in OpenAPI before frontend integration.

| ID    | Missing capability                                      | Current frontend behavior                                            | Suggested sequence                 |
| ----- | ------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------- |
| BG-01 | Admin customer directory and aggregate customer details | No general customer directory is fabricated                          | First: enables customer management |
| BG-02 | Customer profile photo                                  | Initials displayed; profile metadata remains editable                | After shared media contract        |
| BG-03 | Customer garage images                                  | Vehicle metadata CRUD remains available                              | After shared media contract        |
| BG-04 | Service image management                                | Service rows use icons                                               | After shared media contract        |
| BG-05 | Direct product image upload                             | Approved hosted-image URL management remains available               | Extend existing catalogue media    |
| BG-06 | Editing/removing attached stock vehicle images          | Upload and attachment work; existing images cannot be edited/deleted | Extend existing stock media        |

## BG-01 — Admin customer directory and detail views

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

### Existing capability

`GET/PATCH /customers/profile` supports personal/contact/address metadata. There is no profile image field, upload workflow, replacement or removal contract.

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

### Existing capability

`/customers/vehicles` and `/customers/vehicles/{vehicleId}` support customer-owned vehicle metadata CRUD. Garage records are distinct from staff stock vehicles; staff stock upload endpoints cannot substitute for owner-scoped garage media.

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

### Existing capability

`GET/POST /admin/services` and `PATCH /admin/services/{serviceId}` manage service records. Current service DTOs and mutations do not include service media.

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

### Existing capability

- `POST /admin/catalog/products/{productId}/images` accepts approved hosted image metadata: `url`, `altText`, `sortOrder`, `isPrimary`.
- `PATCH/DELETE /admin/catalog/products/{productId}/images/{imageId}` already supports metadata updates and removal.
- There is no direct binary upload preparation/confirmation contract. Do not reimplement working hosted-image CRUD as a missing feature.

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

### Existing capability

- `POST /staff/vehicles/{vehicleId}/assets/upload` prepares a signed upload.
- `POST /staff/vehicles/{vehicleId}/images` confirms an `assetToken` with `altText`, `sortOrder` and `isPrimary`.
- `GET /public/vehicles/images/{imageId}` serves media through the public proxy subject to existing visibility rules.
- Existing image records have no PATCH/DELETE routes. A newly attached image can become primary, but existing images cannot otherwise be reordered, edited or removed.

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

- [ ] Inspect current models and infrastructure before selecting new tables or fields; add reviewed, backward-compatible migrations only where required.
- [ ] Add validated DTOs, policy checks, repository/service/controller logic and routes within the existing module architecture.
- [ ] Extend module OpenAPI definitions and regenerate `backend/docs/api/allied-autotech.openapi.json`.
- [ ] Add unit/integration tests for ownership, all relevant roles, concurrency, idempotent retries, validation and storage failures.
- [ ] Regenerate frontend API types through the existing `api:types` command after the contract is finalized.
- [ ] Integrate real customer search and supported media actions into the redesigned frontend, retaining loading, empty, error, conflict and permission states.
- [ ] Run backend contract/tests and frontend lint, type checking, tests and build; verify browser flows against staging rather than fixtures alone.

Suggested delivery order: BG-01 can proceed independently; establish shared media contracts, implement BG-02/BG-03/BG-04, then extend BG-05/BG-06 using the same validated infrastructure. Sequence may be adjusted to prioritize existing catalogue and stock workflows.

## Deployment verification — separate from missing features

The redesign's browser tests used isolated fixtures. The following are integration checks, not proof that additional backend features are missing:

- Verify all four roles with suitable staging accounts, including direct unauthorized requests and cross-customer isolation.
- Exercise signed uploads against real configured storage, including CORS, allowlists, expiry, cleanup and public/private access boundaries.
- Verify existing payment-provider sandbox, email delivery, cookie/session and recovery flows against deployed services.
- Retest gallery/profile updates after reload and public cache refresh; confirm that failed storage transfers never create successful attachments.

Existing booking requests, quotations, checkout/payment authority, MFA, support history, notifications and local Help articles are outside these six implementation gaps. Preserve their current behavior and do not introduce booking deposits or expose disabled payment providers as part of this work.

## Repository evidence and frontend handoff

- [Exported API contract](backend/docs/api/allied-autotech.openapi.json)
- [Customer routes](backend/src/modules/customers/customers.routes.ts) and [schemas](backend/src/modules/customers/customers.schemas.ts)
- [Catalogue routes](backend/src/modules/catalog/catalog.routes.ts) and [schemas](backend/src/modules/catalog/catalog.schemas.ts)
- [Stock vehicle routes](backend/src/modules/vehicles/vehicles.routes.ts) and [schemas](backend/src/modules/vehicles/vehicles.schemas.ts)
- [Identity routes](backend/src/modules/identity/identity.routes.ts)
- [Original redesign gap summary](frontend/docs/redesign-backend-gaps.md)
- [Completed frontend handoff](frontend/docs/redesign-handoff.md)

This document records the implementation work required. It does not authorize changes to role boundaries, existing domain rules or unrelated deployment files.
