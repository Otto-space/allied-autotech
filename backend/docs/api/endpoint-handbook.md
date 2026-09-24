# Allied AutoTech private API handbook

This handbook is generated from the same hardened OpenAPI document as the private JSON artifact. The canonical base path is `/api/v1`. Hosted staging and production must keep Swagger and `/openapi.json` disabled; run the backend locally with `API_DOCS_ENABLED=true` when interactive Swagger is needed.

## Browser security contract

- Send relative same-origin requests such as `fetch("/api/v1/auth/session", { credentials: "include", cache: "no-store" })`. Vercel forwards `/api/v1/*` to the DigitalOcean API.
- Authentication uses an opaque `HttpOnly` cookie. JavaScript must never read, copy, persist, or replace it, and must not add browser bearer/JWT storage.
- After login or any session rotation, call `POST /api/v1/auth/csrf`. Keep the returned CSRF value in memory only and send it as `X-CSRF-Token` on every authenticated mutation.
- Use a cryptographically random `Idempotency-Key` for operations marked idempotent. Retrying the same logical request reuses the key and exact body; a different body requires a new key.
- Money values ending in `Kobo` are base-10 integer strings. Never calculate authoritative prices, discounts, deposits, refunds, invoice totals, or currencies in the browser.
- Authenticated responses are `Cache-Control: no-store`. Render error messages as text, keep `requestId` for support, and never render provider payloads as HTML.

## Pagination

List routes use bounded cursor pagination. Pass the returned `nextCursor` as `cursor`; never construct or modify cursors. Treat a missing/null cursor as the final page.

## Customer workflows

### Registration, verification, login, MFA, recovery and logout

1. Submit customer registration. The generic accepted response intentionally does not confirm whether an email already exists.
2. Verification links put the raw token in the frontend URL fragment. The frontend reads it once, posts it to `/auth/email/verify`, clears the fragment, and never logs or persists it.
3. Login sets the opaque cookie. If `mfaRequired` is true, show only the MFA challenge/logout UI until a TOTP, WebAuthn, or recovery-code challenge succeeds.
4. Obtain a fresh CSRF value after login/MFA/session rotation. Password change and factor administration require the documented reauthentication and assurance.
5. Forgot/reset flows remain enumeration-safe. Reset tokens follow the same URL-fragment rule. Logout requires CSRF and clears the local in-memory CSRF value.

### Branches, services, published slots and booking requests

1. Read public branches, services, published slots and the current booking policy.
2. Submit the slot, current policy version and an idempotency key. New bookings are REQUESTED with no booking deposit.
3. Staff with BOOKING_CONFIRM records resource review; the server enforces approved branch capacity/calendar and overlaps before confirmation.
4. One transactional email reminder is enqueued one hour before the appointment. Confirmation less than one hour ahead uses an immediate reminder fallback. GET links only render a screen; the signed POST confirms attendance or cancels free.
5. Rescheduling invalidates earlier links/reminders and returns the appointment to staff review. No response never auto-cancels or incurs a fee. Historical deposit records remain protected.

### Orders, invoices, vehicles and payments

- Checkout sends product identifiers/quantities and accepts only server-calculated price, promotion, inventory and currency results.
- Invoices are immutable snapshots. Never alter totals or assume an unpaid invoice is settled because checkout returned successfully.
- Vehicle documents, condition reports, handovers and payment evidence use authorized short-lived access; never expose or persist object keys.
- Manual payment submission does not settle a payment. It creates a review requiring an independent approver.

### Reviews, notifications and support

- Customers can submit rated overall-business, product, service and eligible transaction reviews. Public review results expose moderated anonymous projections only.
- Fetch and update notification state through the customer routes; preferences affect optional operational messages; essential messages remain enabled and marketing execution stays disabled.
- Support chat uses authenticated five-second cursor polling. Stop polling when hidden/offline, resume with the last cursor, and never request another customer's conversation.

## Staff, administration and four-eyes controls

Staff/admin operations require an MFA-verified session and default-deny role, branch, ownership and lifecycle policies. A manual-payment submitter cannot approve that payment, and a refund requester cannot approve the same refund. The UI must present the server's conflict/forbidden response rather than trying to bypass separation of duties.

## Webhook restrictions

Paystack calls the DigitalOcean API origin directly; Monnify remains disabled, not Vercel. Browser code must never invoke webhook routes. The API verifies exact raw bytes, signature policy, reference, amount, currency, state and provider truth; duplicate, late or mismatched events are idempotently recorded or escalated as anomalies.

## Never do this client-side

- Never store session cookies, CSRF values, verification/reset tokens, MFA secrets, checkout state or authorization URLs in localStorage/sessionStorage.
- Never embed provider secret keys, webhook secrets, storage credentials or private object keys.
- Never trust a redirect query string, client-calculated total, client-supplied customer ID, role, status or resource owner.
- Never send webhook traffic through frontend rewrites or parse it before backend signature verification.
- Never expose hosted API docs publicly or use real customer/payment data in fixtures.

## Public API

### GET `/public/branches`

- Operation ID: `getPublicBranches`
- Purpose: List active public branches. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `city` | query | string | No | City used to constrain this request. |
| `state` | query | string | No | State used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List active public branches",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "code": "synthetic-code",
        "name": "synthetic-name",
        "phone": "+2348000000000",
        "email": "customer@example.test",
        "address": "synthetic-address",
        "city": "synthetic-city",
        "state": "synthetic-state",
        "country": "synthetic-country",
        "timezone": "synthetic-timezone",
        "isActive": true,
        "createdAt": "2030-01-15T10:00:00.000Z",
        "updatedAt": "2030-01-15T10:00:00.000Z"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/branches/{branchId}`

- Operation ID: `getPublicBranchesByBranchId`
- Purpose: Get an active public branch. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `branchId` | path | string (uuid) | Yes | Identifier selecting the branch resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an active public branch",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "code": "synthetic-code",
    "name": "synthetic-name",
    "phone": "+2348000000000",
    "email": "customer@example.test",
    "address": "synthetic-address",
    "city": "synthetic-city",
    "state": "synthetic-state",
    "country": "synthetic-country",
    "timezone": "synthetic-timezone",
    "isActive": true,
    "createdAt": "2030-01-15T10:00:00.000Z",
    "updatedAt": "2030-01-15T10:00:00.000Z"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/catalog/categories`

- Operation ID: `getPublicCatalogCategories`
- Purpose: List active categories. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List active categories",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/catalog/categories/{categoryId}`

- Operation ID: `getPublicCatalogCategoriesByCategoryId`
- Purpose: Get an active category. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `categoryId` | path | string (uuid) | Yes | Identifier selecting the category resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an active category",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/catalog/products`

- Operation ID: `getPublicCatalogProducts`
- Purpose: Search active products. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `categoryId` | query | string (uuid) | No | Category Id used to constrain this request. |
| `brand` | query | string | No | Brand used to constrain this request. |
| `search` | query | string | No | Search used to constrain this request. |
| `make` | query | string | No | Make used to constrain this request. |
| `model` | query | string | No | Model used to constrain this request. |
| `year` | query | integer | No | Year used to constrain this request. |
| `featured` | query | true / false | No | Featured used to constrain this request. |
| `sort` | query | newest / name / price_asc / price_desc | No | Sort used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Search active products",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/catalog/products/{productId}`

- Operation ID: `getPublicCatalogProductsByProductId`
- Purpose: Get an active product. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an active product",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/services`

- Operation ID: `getPublicServices`
- Purpose: List active services. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `pricingType` | query | FIXED / QUOTE_REQUIRED | No | Pricing Type used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List active services",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "name": "synthetic-name",
        "slug": "synthetic-slug",
        "description": "synthetic-description",
        "shortDescription": "synthetic-shortdescription",
        "pricingType": "FIXED",
        "priceKobo": "300000",
        "currency": "NGN",
        "durationMinutes": 1,
        "isActive": true,
        "version": 1,
        "createdAt": "2030-01-15T10:00:00.000Z",
        "updatedAt": "2030-01-15T10:00:00.000Z"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/services/{serviceId}`

- Operation ID: `getPublicServicesByServiceId`
- Purpose: Get an active service. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `serviceId` | path | string (uuid) | Yes | Identifier selecting the service resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an active service",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "name": "synthetic-name",
    "slug": "synthetic-slug",
    "description": "synthetic-description",
    "shortDescription": "synthetic-shortdescription",
    "pricingType": "FIXED",
    "priceKobo": "300000",
    "currency": "NGN",
    "durationMinutes": 1,
    "isActive": true,
    "version": 1,
    "createdAt": "2030-01-15T10:00:00.000Z",
    "updatedAt": "2030-01-15T10:00:00.000Z"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/booking-policy`

- Operation ID: `getPublicBookingPolicy`
- Purpose: Get the current deposit and scheduling policy. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get the current deposit and scheduling policy",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/services/{serviceId}/slots`

- Operation ID: `getPublicServicesByServiceIdSlots`
- Purpose: List available published slots for a fixed-price service. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `serviceId` | path | string (uuid) | Yes | Identifier selecting the service resource. |
| `branchId` | query | string (uuid) | Yes | Branch Id used to constrain this request. |
| `from` | query | string (date-time) | No | From used to constrain this request. |
| `to` | query | string (date-time) | No | To used to constrain this request. |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List available published slots for a fixed-price service",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/vehicles`

- Operation ID: `getPublicVehicles`
- Purpose: Search published vehicle listings. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `search` | query | string | No | Search used to constrain this request. |
| `make` | query | string | No | Make used to constrain this request. |
| `model` | query | string | No | Model used to constrain this request. |
| `year` | query | integer | No | Year used to constrain this request. |
| `bodyType` | query | SEDAN / SUV / COUPE / HATCHBACK / WAGON / PICKUP / VAN / TRUCK / BUS / OTHER | No | Body Type used to constrain this request. |
| `transmission` | query | AUTOMATIC / MANUAL / CVT / OTHER | No | Transmission used to constrain this request. |
| `fuelType` | query | PETROL / DIESEL / HYBRID / ELECTRIC / OTHER | No | Fuel Type used to constrain this request. |
| `featured` | query | true / false | No | Featured used to constrain this request. |
| `minPriceKobo` | query | string | No | Min Price Kobo used to constrain this request. |
| `maxPriceKobo` | query | string | No | Max Price Kobo used to constrain this request. |
| `sort` | query | newest / price_asc / price_desc / year_desc | No | Sort used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Search published vehicle listings",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/vehicles/{listingId}`

- Operation ID: `getPublicVehiclesByListingId`
- Purpose: Get a published vehicle listing. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `listingId` | path | string (uuid) | Yes | Identifier selecting the listing resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get a published vehicle listing",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/vehicles/images/{imageId}`

- Operation ID: `getPublicVehiclesImagesByImageId`
- Purpose: Resolve short-lived public listing image access. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `imageId` | path | string (uuid) | Yes | Identifier selecting the image resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Resolve short-lived public listing image access",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/support/reviews`

- Operation ID: `getPublicSupportReviews`
- Purpose: List approved reviews without customer identity. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `targetType` | query | BUSINESS / PRODUCT / SERVICE / ORDER / VEHICLE_TRANSACTION | No | Target Type used to constrain this request. |
| `productId` | query | string (uuid) | No | Product Id used to constrain this request. |
| `serviceId` | query | string (uuid) | No | Service Id used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List approved reviews without customer identity",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/public/support/enquiries`

- Operation ID: `postPublicSupportEnquiries`
- Purpose: Submit a public enquiry. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Synthetic request example:

```json
{
  "branchId": "00000000-0000-4000-8000-000000000001",
  "subject": "synthetic-subject",
  "message": "synthetic-message",
  "name": "synthetic-name",
  "email": "customer@example.test",
  "phone": "+2348000000000",
  "type": "GENERAL"
}
```

Success: HTTP 202.

```json
{
  "success": true,
  "message": "Submit a public enquiry",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/public/support/complaints`

- Operation ID: `postPublicSupportComplaints`
- Purpose: Submit a public complaint. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `branchId` | string (uuid) | No | Identifier of the branch resource; ownership is resolved server-side. |
| `subject` | string | Yes | Subject validated by this operation's strict request contract. |
| `description` | string | Yes | Description validated by this operation's strict request contract. |
| `name` | string | Yes | Name validated by this operation's strict request contract. |
| `email` | string (email) | Yes | Normalized account email address. |
| `phone` | string | No | Customer or business phone number in international format. |

Synthetic request example:

```json
{
  "branchId": "00000000-0000-4000-8000-000000000001",
  "subject": "synthetic-subject",
  "description": "synthetic-description",
  "name": "synthetic-name",
  "email": "customer@example.test",
  "phone": "+2348000000000"
}
```

Success: HTTP 202.

```json
{
  "success": true,
  "message": "Submit a public complaint",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/fulfillment-options`

- Operation ID: `getPublicFulfillmentOptions`
- Purpose: Read collection details and currently effective approved delivery zones without private policy provenance. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read collection details and currently effective approved delivery zones without private policy provenance",
  "data": {
    "serverTime": "2030-01-15T10:00:00.000Z",
    "currency": "NGN",
    "checkoutEnabled": true,
    "collection": {
      "enabled": true,
      "address": "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria"
    },
    "delivery": {
      "enabled": false,
      "policyVersion": "synthetic-policyversion",
      "zones": [
        {
          "id": "synthetic-id",
          "label": "synthetic-label",
          "city": "synthetic-city",
          "state": "synthetic-state",
          "feeKobo": "300000"
        }
      ]
    }
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/capabilities`

- Operation ID: `getPublicCapabilities`
- Purpose: Read safe policy capabilities and server time. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read safe policy capabilities and server time",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/public/booking-response`

- Operation ID: `getPublicBookingResponse`
- Purpose: Private, no-store, noindex HTML. GET and HEAD never mutate; current status determines available controls. POST validates the exact trusted Origin, active verified customer and current booking schedule version. Cancellation is repeat-safe and attendance confirmation is repeat-safe while confirmed. Tokens are private and must not be logged. Invalid/expired or changed links render recovery HTML; uncertain server errors direct the customer to check their account before another action. Render a read-only attendance confirmation screen. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `token` | query | string | Yes | Token used to constrain this request. |

Success: HTTP 200.

```json
{}
```

Relevant errors: 400 The request is malformed.; 403 Untrusted origin; recovery HTML (global CORS denial may use JSON); 409 Invalid, expired, changed or unavailable appointment link; recovery HTML; 413 Form exceeds 4 KiB; recovery HTML; 422 Invalid query or form; recovery HTML; 429 The route-specific request limit was exceeded.; 500 Result unavailable; recovery HTML without exception details

### POST `/public/booking-response`

- Operation ID: `postPublicBookingResponse`
- Purpose: Private, no-store, noindex HTML. GET and HEAD never mutate; current status determines available controls. POST validates the exact trusted Origin, active verified customer and current booking schedule version. Cancellation is repeat-safe and attendance confirmation is repeat-safe while confirmed. Tokens are private and must not be logged. Invalid/expired or changed links render recovery HTML; uncertain server errors direct the customer to check their account before another action. Confirm attendance or cancel using a purpose-bound expiring token. Access boundary: public. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{}
```

Relevant errors: 400 The request is malformed.; 403 Untrusted origin; recovery HTML (global CORS denial may use JSON); 409 Invalid, expired, changed or unavailable appointment link; recovery HTML; 413 Form exceeds 4 KiB; recovery HTML; 422 Invalid query or form; recovery HTML; 429 The route-specific request limit was exceeded.; 500 Result unavailable; recovery HTML without exception details


## Authentication

### POST `/auth/register`

- Operation ID: `postAuthRegister`
- Purpose: Register a customer. Access boundary: unauthenticated. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `email` | string (email) | Yes | Normalized account email address. |
| `password` | string | Yes | Sensitive password value sent only over HTTPS and never logged or persisted by the client. |
| `firstName` | string | Yes | First Name validated by this operation's strict request contract. |
| `lastName` | string | Yes | Last Name validated by this operation's strict request contract. |
| `phone` | string | Yes | Customer or business phone number in international format. |

Synthetic request example:

```json
{
  "email": "customer@example.test",
  "password": "correct horse battery staple",
  "firstName": "synthetic-firstname",
  "lastName": "synthetic-lastname",
  "phone": "+2348000000000"
}
```

Success: HTTP 202.

```json
{
  "success": true,
  "message": "Register a customer",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/email/verify`

- Operation ID: `postAuthEmailVerify`
- Purpose: Verify an email. Access boundary: unauthenticated. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `token` | string | Yes | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |

Synthetic request example:

```json
{
  "token": "synthetic-token-value-not-a-real-secret"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Verify an email",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/email/resend`

- Operation ID: `postAuthEmailResend`
- Purpose: Resend verification. Access boundary: unauthenticated. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `email` | string (email) | Yes | Normalized account email address. |

Synthetic request example:

```json
{
  "email": "customer@example.test"
}
```

Success: HTTP 202.

```json
{
  "success": true,
  "message": "Resend verification",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/login`

- Operation ID: `postAuthLogin`
- Purpose: Create a session. Access boundary: unauthenticated. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `email` | string (email) | Yes | Normalized account email address. |
| `password` | string | Yes | Sensitive password value sent only over HTTPS and never logged or persisted by the client. |

Synthetic request example:

```json
{
  "email": "customer@example.test",
  "password": "correct horse battery staple"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Create a session",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/logout`

- Operation ID: `postAuthLogout`
- Purpose: Revoke the current session. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Revoke the current session",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/csrf`

- Operation ID: `postAuthCsrf`
- Purpose: Rotate the CSRF token. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Rotate the CSRF token",
  "data": {
    "csrfToken": "synthetic-token-value-not-a-real-secret"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/password/forgot`

- Operation ID: `postAuthPasswordForgot`
- Purpose: Request password recovery. Access boundary: unauthenticated. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `email` | string (email) | Yes | Normalized account email address. |

Synthetic request example:

```json
{
  "email": "customer@example.test"
}
```

Success: HTTP 202.

```json
{
  "success": true,
  "message": "Request password recovery",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/password/reset`

- Operation ID: `postAuthPasswordReset`
- Purpose: Reset a password. Access boundary: unauthenticated. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PUBLIC
- Authentication: None
- CSRF: Not required
- Idempotency: Not required

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `token` | string | Yes | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `password` | string | Yes | Sensitive password value sent only over HTTPS and never logged or persisted by the client. |

Synthetic request example:

```json
{
  "token": "synthetic-token-value-not-a-real-secret",
  "password": "correct horse battery staple"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Reset a password",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/password/change`

- Operation ID: `postAuthPasswordChange`
- Purpose: Change a password. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `currentPassword` | string | Yes | Sensitive password value sent only over HTTPS and never logged or persisted by the client. |
| `newPassword` | string | Yes | Sensitive password value sent only over HTTPS and never logged or persisted by the client. |

Synthetic request example:

```json
{
  "currentPassword": "correct horse battery staple",
  "newPassword": "correct horse battery staple"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Change a password",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/mfa/totp/setup`

- Operation ID: `postAuthMfaTotpSetup`
- Purpose: Requires a current session and CSRF token. A session without MFA verification may enroll only when the account has no active MFA factor and no unused recovery code. Otherwise verify an existing MFA method first (403 MFA_REQUIRED). Eligibility is rechecked atomically during activation. Factor activation, replacement recovery codes, audit and session rotation commit together. A session rotated or revoked after middleware is rejected. Start TOTP enrollment. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Start TOTP enrollment",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 Session unavailable, expired, revoked or changed during enrollment; 403 Existing MFA verification required, or CSRF validation failed; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/mfa/totp/verify`

- Operation ID: `postAuthMfaTotpVerify`
- Purpose: Requires a current session and CSRF token. A session without MFA verification may enroll only when the account has no active MFA factor and no unused recovery code. Otherwise verify an existing MFA method first (403 MFA_REQUIRED). Eligibility is rechecked atomically during activation. Factor activation, replacement recovery codes, audit and session rotation commit together. A session rotated or revoked after middleware is rejected. Complete TOTP enrollment. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `factorId` | string (uuid) | Yes | Identifier of the factor resource; ownership is resolved server-side. |
| `code` | string | Yes | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |

Synthetic request example:

```json
{
  "factorId": "00000000-0000-4000-8000-000000000001",
  "code": "synthetic-code"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Complete TOTP enrollment",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 Session unavailable, expired, revoked or changed during enrollment; 403 Existing MFA verification required, or CSRF validation failed; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/mfa/webauthn/options`

- Operation ID: `postAuthMfaWebauthnOptions`
- Purpose: Requires a current session and CSRF token. A session without MFA verification may enroll only when the account has no active MFA factor and no unused recovery code. Otherwise verify an existing MFA method first (403 MFA_REQUIRED). Eligibility is rechecked atomically during activation. Factor activation, replacement recovery codes, audit and session rotation commit together. A session rotated or revoked after middleware is rejected. Create WebAuthn registration options. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `name` | string | No | Name validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "name": "synthetic-name"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Create WebAuthn registration options",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 Session unavailable, expired, revoked or changed during enrollment; 403 Existing MFA verification required, or CSRF validation failed; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/mfa/webauthn/verify`

- Operation ID: `postAuthMfaWebauthnVerify`
- Purpose: Requires a current session and CSRF token. A session without MFA verification may enroll only when the account has no active MFA factor and no unused recovery code. Otherwise verify an existing MFA method first (403 MFA_REQUIRED). Eligibility is rechecked atomically during activation. Factor activation, replacement recovery codes, audit and session rotation commit together. A session rotated or revoked after middleware is rejected. Complete WebAuthn registration. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `name` | string | No | Name validated by this operation's strict request contract. |
| `response` | object | Yes | Response validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "name": "synthetic-name",
  "response": {
    "id": "synthetic-id",
    "rawId": "synthetic-rawid",
    "type": "public-key",
    "response": {},
    "clientExtensionResults": {},
    "authenticatorAttachment": "cross-platform"
  }
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Complete WebAuthn registration",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 Session unavailable, expired, revoked or changed during enrollment; 403 Existing MFA verification required, or CSRF validation failed; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/mfa/challenge/options`

- Operation ID: `postAuthMfaChallengeOptions`
- Purpose: Create MFA authentication options. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `method` | totp / webauthn / recovery-code | Yes | Method validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "method": "totp"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Create MFA authentication options",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/mfa/challenge/verify`

- Operation ID: `postAuthMfaChallengeVerify`
- Purpose: Verify an MFA challenge. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Synthetic request example:

```json
{
  "method": "totp",
  "factorId": "00000000-0000-4000-8000-000000000001",
  "code": "synthetic-code"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Verify an MFA challenge",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/mfa/recovery-codes/regenerate`

- Operation ID: `postAuthMfaRecoveryCodesRegenerate`
- Purpose: Regenerate recovery codes. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Regenerate recovery codes",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/auth/session`

- Operation ID: `getAuthSession`
- Purpose: Get current session. Access boundary: authenticated-user. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get current session",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/auth/sessions`

- Operation ID: `getAuthSessions`
- Purpose: List active sessions. Access boundary: authenticated-user. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List active sessions",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### DELETE `/auth/sessions`

- Operation ID: `deleteAuthSessions`
- Purpose: Revoke other sessions. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Revoke other sessions",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### DELETE `/auth/sessions/{sessionId}`

- Operation ID: `deleteAuthSessionsBySessionId`
- Purpose: Revoke an owned session. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `sessionId` | path | string (uuid) | Yes | Identifier selecting the session resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Revoke an owned session",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/auth/mfa/factors`

- Operation ID: `getAuthMfaFactors`
- Purpose: List safe MFA factor metadata. Access boundary: authenticated-user. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List safe MFA factor metadata",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### DELETE `/auth/mfa/factors/{factorId}`

- Operation ID: `deleteAuthMfaFactorsByFactorId`
- Purpose: Revoke an MFA factor. Access boundary: authenticated-user. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: AUTHENTICATED
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `factorId` | path | string (uuid) | Yes | Identifier selecting the factor resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `password` | string | Yes | Sensitive password value sent only over HTTPS and never logged or persisted by the client. |

Synthetic request example:

```json
{
  "password": "correct horse battery staple"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Revoke an MFA factor",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/auth/staff/invitations/accept`

- Operation ID: `postAuthStaffInvitationsAccept`
- Purpose: Accept the intended account administrator invitation. Access boundary: mfa-verified-invited-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `token` | string | Yes | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `currentPassword` | string | Yes | Sensitive password value sent only over HTTPS and never logged or persisted by the client. |

Synthetic request example:

```json
{
  "token": "synthetic-token-value-not-a-real-secret",
  "currentPassword": "correct horse battery staple"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Accept the intended account administrator invitation",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.


## Customer API

### GET `/customers/profile`

- Operation ID: `getCustomersProfile`
- Purpose: Get own customer profile. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get own customer profile",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/customers/profile`

- Operation ID: `patchCustomersProfile`
- Purpose: Update own customer profile. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `firstName` | string | No | First Name validated by this operation's strict request contract. |
| `lastName` | string | No | Last Name validated by this operation's strict request contract. |
| `phone` | string | No | Customer or business phone number in international format. |
| `address` | string / null | No | Address validated by this operation's strict request contract. |
| `city` | string / null | No | City validated by this operation's strict request contract. |
| `state` | string / null | No | State validated by this operation's strict request contract. |
| `country` | Nigeria | No | Country validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "firstName": "synthetic-firstname",
  "lastName": "synthetic-lastname",
  "phone": "+2348000000000",
  "address": "synthetic-address",
  "city": "synthetic-city",
  "state": "synthetic-state",
  "country": "Nigeria"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update own customer profile",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/vehicles`

- Operation ID: `getCustomersVehicles`
- Purpose: List own customer vehicles. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own customer vehicles",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/vehicles`

- Operation ID: `postCustomersVehicles`
- Purpose: Create an owned customer vehicle. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `make` | string | Yes | Make validated by this operation's strict request contract. |
| `model` | string | Yes | Model validated by this operation's strict request contract. |
| `year` | integer | Yes | Year validated by this operation's strict request contract. |
| `registrationNumber` | string / null | No | Registration Number validated by this operation's strict request contract. |
| `vin` | string / null | No | Vin validated by this operation's strict request contract. |
| `color` | string / null | No | Color validated by this operation's strict request contract. |
| `mileageKm` | integer / null | No | Mileage Km validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "make": "synthetic-make",
  "model": "synthetic-model",
  "year": 1886,
  "registrationNumber": "synthetic-registrationnumber",
  "vin": "synthetic-vin",
  "color": "synthetic-color",
  "mileageKm": "synthetic-mileagekm"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create an owned customer vehicle",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/vehicles/{vehicleId}`

- Operation ID: `getCustomersVehiclesByVehicleId`
- Purpose: Get an owned customer vehicle. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | string (uuid) | Yes | Identifier selecting the vehicle resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an owned customer vehicle",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/customers/vehicles/{vehicleId}`

- Operation ID: `patchCustomersVehiclesByVehicleId`
- Purpose: Update an owned customer vehicle. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | string (uuid) | Yes | Identifier selecting the vehicle resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `make` | string | No | Make validated by this operation's strict request contract. |
| `model` | string | No | Model validated by this operation's strict request contract. |
| `year` | integer | No | Year validated by this operation's strict request contract. |
| `registrationNumber` | string / null | No | Registration Number validated by this operation's strict request contract. |
| `vin` | string / null | No | Vin validated by this operation's strict request contract. |
| `color` | string / null | No | Color validated by this operation's strict request contract. |
| `mileageKm` | integer / null | No | Mileage Km validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "make": "synthetic-make",
  "model": "synthetic-model",
  "year": 1886,
  "registrationNumber": "synthetic-registrationnumber",
  "vin": "synthetic-vin",
  "color": "synthetic-color",
  "mileageKm": "synthetic-mileagekm"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update an owned customer vehicle",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### DELETE `/customers/vehicles/{vehicleId}`

- Operation ID: `deleteCustomersVehiclesByVehicleId`
- Purpose: Delete an owned customer vehicle. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | string (uuid) | Yes | Identifier selecting the vehicle resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Delete an owned customer vehicle",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/favourites`

- Operation ID: `getCustomersFavourites`
- Purpose: List own favourites. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own favourites",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PUT `/customers/favourites/{productId}`

- Operation ID: `putCustomersFavouritesByProductId`
- Purpose: Save a favourite. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Save a favourite",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### DELETE `/customers/favourites/{productId}`

- Operation ID: `deleteCustomersFavouritesByProductId`
- Purpose: Remove a favourite. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Remove a favourite",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/cart`

- Operation ID: `getCustomersCart`
- Purpose: Get own cart. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get own cart",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### DELETE `/customers/cart`

- Operation ID: `deleteCustomersCart`
- Purpose: Clear own cart. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Clear own cart",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PUT `/customers/cart/items/{productId}`

- Operation ID: `putCustomersCartItemsByProductId`
- Purpose: Set a cart item quantity. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `quantity` | integer | Yes | Quantity validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "quantity": 1
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Set a cart item quantity",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### DELETE `/customers/cart/items/{productId}`

- Operation ID: `deleteCustomersCartItemsByProductId`
- Purpose: Remove a cart item. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Remove a cart item",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/bookings/{bookingId}/disruption-resolution`

- Operation ID: `postCustomersBookingsByBookingIdDisruptionResolution`
- Purpose: Transfer a business-disrupted booking or request its deposit refund. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

Synthetic request example:

```json
{
  "resolution": "TRANSFER",
  "slotId": "00000000-0000-4000-8000-000000000001",
  "expectedVersion": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Transfer a business-disrupted booking or request its deposit refund",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/bookings`

- Operation ID: `getCustomersBookings`
- Purpose: List own bookings with previously issued quotations only. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | REQUESTED / AWAITING_DEPOSIT / CONFIRMED / IN_PROGRESS / COMPLETED / CANCELLED / NO_SHOW / EXPIRED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own bookings with previously issued quotations only",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/bookings`

- Operation ID: `postCustomersBookings`
- Purpose: Request a booking. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `slotId` | string (uuid) | Yes | Identifier of the slot resource; ownership is resolved server-side. |
| `vehicleId` | string (uuid) | No | Identifier of the vehicle resource; ownership is resolved server-side. |
| `customerNotes` | string / null | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `policyVersion` | string | Yes | Policy Version validated by this operation's strict request contract. |
| `acceptNonRefundableDeposit` | boolean | No | Deprecated compatibility field; new bookings require no deposit and cancellation is free. |

Synthetic request example:

```json
{
  "slotId": "00000000-0000-4000-8000-000000000001",
  "vehicleId": "00000000-0000-4000-8000-000000000001",
  "customerNotes": "synthetic-customernotes",
  "policyVersion": "synthetic-policyversion",
  "acceptNonRefundableDeposit": true
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Request a booking",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/bookings/{bookingId}`

- Operation ID: `getCustomersBookingsByBookingId`
- Purpose: Get an owned booking with previously issued quotations only. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an owned booking with previously issued quotations only",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/customers/bookings/{bookingId}/schedule`

- Operation ID: `patchCustomersBookingsByBookingIdSchedule`
- Purpose: Reschedule a confirmed deposit-backed booking once. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `slotId` | string (uuid) | Yes | Identifier of the slot resource; ownership is resolved server-side. |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "slotId": "00000000-0000-4000-8000-000000000001",
  "expectedVersion": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Reschedule a confirmed deposit-backed booking once",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/bookings/{bookingId}/cancel`

- Operation ID: `postCustomersBookingsByBookingIdCancel`
- Purpose: Cancel an owned booking. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "reason": "synthetic-reason",
  "expectedVersion": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Cancel an owned booking",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/bookings/{bookingId}/quotes/{quoteId}/accept`

- Operation ID: `postCustomersBookingsByBookingIdQuotesByQuoteIdAccept`
- Purpose: Accept an issued quote. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `quoteId` | path | string (uuid) | Yes | Identifier selecting the quote resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedRevision` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "expectedRevision": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Accept an issued quote",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/bookings/{bookingId}/quotes/{quoteId}/reject`

- Operation ID: `postCustomersBookingsByBookingIdQuotesByQuoteIdReject`
- Purpose: Reject an issued quote. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `quoteId` | path | string (uuid) | Yes | Identifier selecting the quote resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedRevision` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "expectedRevision": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Reject an issued quote",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/orders/checkout`

- Operation ID: `postCustomersOrdersCheckout`
- Purpose: Create an atomic server-priced checkout. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `branchId` | string (uuid) | Yes | Identifier of the branch resource; ownership is resolved server-side. |
| `fulfillmentMethod` | COLLECTION / DELIVERY | No | Fulfillment Method validated by this operation's strict request contract. |
| `promotionCode` | string | No | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `delivery` | object | No | Delivery validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "branchId": "00000000-0000-4000-8000-000000000001",
  "fulfillmentMethod": "COLLECTION",
  "promotionCode": "synthetic-promotioncode",
  "delivery": {
    "zoneId": "synthetic-zoneid",
    "name": "synthetic-name",
    "phone": "+2348000000000",
    "address": "synthetic-address",
    "city": "synthetic-city",
    "state": "synthetic-state",
    "country": "Nigeria"
  }
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create an atomic server-priced checkout",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/orders`

- Operation ID: `getCustomersOrders`
- Purpose: List own orders. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | PENDING / CONFIRMED / PROCESSING / READY / COMPLETED / CANCELLED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own orders",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/orders/{orderId}`

- Operation ID: `getCustomersOrdersByOrderId`
- Purpose: Get an own order. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `orderId` | path | string (uuid) | Yes | Identifier selecting the order resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an own order",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/orders/{orderId}/cancel`

- Operation ID: `postCustomersOrdersByOrderIdCancel`
- Purpose: Cancel an own pending order or record a cancellation request for staff review. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `orderId` | path | string (uuid) | Yes | Identifier selecting the order resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "reason": "synthetic-reason"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Cancel an own pending order or record a cancellation request for staff review",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/promotions/preview`

- Operation ID: `postCustomersPromotionsPreview`
- Purpose: Preview promotion eligibility. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `code` | string | Yes | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `subtotalKobo` | string | Yes | Subtotal Kobo validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "code": "synthetic-code",
  "subtotalKobo": "300000"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Preview promotion eligibility",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/invoices`

- Operation ID: `getCustomersInvoices`
- Purpose: Customer-owned issued invoices only. List authorized invoices. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | ISSUED / PAID / VOID | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List authorized invoices",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/invoices/{invoiceId}`

- Operation ID: `getCustomersInvoicesByInvoiceId`
- Purpose: Customer-owned issued invoices only. Get an authorized invoice. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `invoiceId` | path | string (uuid) | Yes | Identifier selecting the invoice resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an authorized invoice",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/saved-vehicles`

- Operation ID: `getCustomersSavedVehicles`
- Purpose: List saved vehicles. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List saved vehicles",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PUT `/customers/saved-vehicles/{listingId}`

- Operation ID: `putCustomersSavedVehiclesByListingId`
- Purpose: Save a vehicle. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `listingId` | path | string (uuid) | Yes | Identifier selecting the listing resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Save a vehicle",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### DELETE `/customers/saved-vehicles/{listingId}`

- Operation ID: `deleteCustomersSavedVehiclesByListingId`
- Purpose: Remove a saved vehicle. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `listingId` | path | string (uuid) | Yes | Identifier selecting the listing resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Remove a saved vehicle",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/vehicle-inspections`

- Operation ID: `getCustomersVehicleInspections`
- Purpose: List own inspection requests. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | REQUESTED / CONFIRMED / COMPLETED / RESCHEDULED / CANCELLED / NO_SHOW | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own inspection requests",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/vehicle-inspections`

- Operation ID: `postCustomersVehicleInspections`
- Purpose: Request a vehicle inspection. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `vehicleListingId` | string (uuid) | Yes | Identifier of the vehicle listing resource; ownership is resolved server-side. |
| `preferredStartAt` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |
| `preferredEndAt` | string (date-time) | No | ISO 8601 timestamp interpreted and validated by the server. |
| `notes` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "vehicleListingId": "00000000-0000-4000-8000-000000000001",
  "preferredStartAt": "2030-01-15T10:00:00.000Z",
  "preferredEndAt": "2030-01-15T10:00:00.000Z",
  "notes": "synthetic-notes"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Request a vehicle inspection",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/vehicle-transactions`

- Operation ID: `getCustomersVehicleTransactions`
- Purpose: List own vehicle transactions. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | ENQUIRY / INSPECTION_SCHEDULED / INSPECTION_COMPLETED / NEGOTIATING / PAYMENT_PENDING / RESERVED / PARTIALLY_PAID / PAID / HANDOVER_PENDING / COMPLETED / CANCELLED / EXPIRED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own vehicle transactions",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/vehicle-transactions`

- Operation ID: `postCustomersVehicleTransactions`
- Purpose: Open a vehicle transaction. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `vehicleListingId` | string (uuid) | Yes | Identifier of the vehicle listing resource; ownership is resolved server-side. |
| `sourceInspectionId` | string (uuid) | No | Identifier of the source inspection resource; ownership is resolved server-side. |

Synthetic request example:

```json
{
  "vehicleListingId": "00000000-0000-4000-8000-000000000001",
  "sourceInspectionId": "00000000-0000-4000-8000-000000000001"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Open a vehicle transaction",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/vehicle-transactions/{transactionId}`

- Operation ID: `getCustomersVehicleTransactionsByTransactionId`
- Purpose: Get own vehicle transaction. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `transactionId` | path | string (uuid) | Yes | Identifier selecting the transaction resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get own vehicle transaction",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/vehicle-transactions/{transactionId}/reserve`

- Operation ID: `postCustomersVehicleTransactionsByTransactionIdReserve`
- Purpose: Reserve an agreed vehicle. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `transactionId` | path | string (uuid) | Yes | Identifier selecting the transaction resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `termsVersion` | string | Yes | Terms Version validated by this operation's strict request contract. |
| `termsAccepted` | true | Yes | Terms Accepted validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "termsVersion": "synthetic-termsversion",
  "termsAccepted": true
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Reserve an agreed vehicle",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/payments`

- Operation ID: `getCustomersPayments`
- Purpose: Requires the customer account that owns the payment; server verification remains authoritative. List own payments. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | REQUIRES_PAYMENT / PROCESSING / REQUIRES_REVIEW / SUCCEEDED / CANCELLED / EXPIRED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own payments",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### POST `/customers/payments`

- Operation ID: `postCustomersPayments`
- Purpose: Requires the customer account that owns the payment; server verification remains authoritative. Create a server-priced payment intent. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

Synthetic request example:

```json
{
  "targetType": "ORDER",
  "targetId": "00000000-0000-4000-8000-000000000001",
  "purpose": "ORDER_PAYMENT"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a server-priced payment intent",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### GET `/customers/payments/{paymentId}`

- Operation ID: `getCustomersPaymentsByPaymentId`
- Purpose: Requires the customer account that owns the payment; server verification remains authoritative. Get an owned payment. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `paymentId` | path | string (uuid) | Yes | Identifier selecting the payment resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an owned payment",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### POST `/customers/payments/{paymentId}/paystack`

- Operation ID: `postCustomersPaymentsByPaymentIdPaystack`
- Purpose: Requires the customer account that owns the payment; server verification remains authoritative. Initialize Paystack checkout. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `paymentId` | path | string (uuid) | Yes | Identifier selecting the payment resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Initialize Paystack checkout",
  "data": {
    "attemptId": "00000000-0000-4000-8000-000000000001",
    "authorizationUrl": "https://example.test/continue",
    "authorizationExpiresAt": "2030-01-15T10:00:00.000Z",
    "replayed": true
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### POST `/customers/payments/{paymentId}/monnify`

- Operation ID: `postCustomersPaymentsByPaymentIdMonnify`
- Purpose: Requires the customer account that owns the payment; server verification remains authoritative. Initialize Monnify hosted Pay-with-Bank checkout. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `paymentId` | path | string (uuid) | Yes | Identifier selecting the payment resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Initialize Monnify hosted Pay-with-Bank checkout",
  "data": {
    "attemptId": "00000000-0000-4000-8000-000000000001",
    "authorizationUrl": "https://example.test/continue",
    "authorizationExpiresAt": "2030-01-15T10:00:00.000Z",
    "replayed": true
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### POST `/customers/payments/{paymentId}/attempts/{attemptId}/verify`

- Operation ID: `postCustomersPaymentsByPaymentIdAttemptsByAttemptIdVerify`
- Purpose: Requires the customer account that owns the payment; server verification remains authoritative. Verify an online payment attempt with its stored provider. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `paymentId` | path | string (uuid) | Yes | Identifier selecting the payment resource. |
| `attemptId` | path | string (uuid) | Yes | Identifier selecting the attempt resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Verify an online payment attempt with its stored provider",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### POST `/customers/payments/{paymentId}/manual`

- Operation ID: `postCustomersPaymentsByPaymentIdManual`
- Purpose: Requires the customer account that owns the payment; server verification remains authoritative. Submit manual-payment evidence. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `paymentId` | path | string (uuid) | Yes | Identifier selecting the payment resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `method` | BANK_TRANSFER / POS / CASH | Yes | Method validated by this operation's strict request contract. |
| `bankReference` | string | No | Bank Reference validated by this operation's strict request contract. |
| `payerName` | string | Yes | Payer Name validated by this operation's strict request contract. |
| `transferredAt` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |
| `evidenceToken` | string | No | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |

Synthetic request example:

```json
{
  "method": "BANK_TRANSFER",
  "bankReference": "synthetic-bankreference",
  "payerName": "synthetic-payername",
  "transferredAt": "2030-01-15T10:00:00.000Z",
  "evidenceToken": "synthetic-token-value-not-a-real-secret"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Submit manual-payment evidence",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### POST `/customers/payments/{paymentId}/manual-evidence/upload`

- Operation ID: `postCustomersPaymentsByPaymentIdManualEvidenceUpload`
- Purpose: Requires the customer account that owns the payment; server verification remains authoritative. Authorize a private manual-payment evidence upload. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `paymentId` | path | string (uuid) | Yes | Identifier selecting the payment resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `mimeType` | application/pdf / image/jpeg / image/png | Yes | Mime Type validated by this operation's strict request contract. |
| `sizeBytes` | integer | Yes | Size Bytes validated by this operation's strict request contract. |
| `checksumSha256` | string | Yes | Checksum Sha256 validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "mimeType": "application/pdf",
  "sizeBytes": 1,
  "checksumSha256": "synthetic-checksumsha256"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Authorize a private manual-payment evidence upload",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### GET `/customers/support/enquiries/{supportId}/messages`

- Operation ID: `getCustomersSupportEnquiriesBySupportIdMessages`
- Purpose: Poll new customer-visible enquiry chat messages. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Poll new customer-visible enquiry chat messages",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/support/enquiries/{supportId}/messages`

- Operation ID: `postCustomersSupportEnquiriesBySupportIdMessages`
- Purpose: Add a customer message to an owned enquiry. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `message` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "message": "synthetic-message"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Add a customer message to an owned enquiry",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/support/complaints/{supportId}/messages`

- Operation ID: `getCustomersSupportComplaintsBySupportIdMessages`
- Purpose: Poll new customer-visible complaint chat messages. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Poll new customer-visible complaint chat messages",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/support/complaints/{supportId}/messages`

- Operation ID: `postCustomersSupportComplaintsBySupportIdMessages`
- Purpose: Add a customer message to an owned complaint. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `message` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "message": "synthetic-message"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Add a customer message to an owned complaint",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/support/enquiries`

- Operation ID: `getCustomersSupportEnquiries`
- Purpose: List owned enquiries. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | OPEN / IN_PROGRESS / RESOLVED / CLOSED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List owned enquiries",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/support/enquiries`

- Operation ID: `postCustomersSupportEnquiries`
- Purpose: Create an owned enquiry. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Synthetic request example:

```json
{
  "branchId": "00000000-0000-4000-8000-000000000001",
  "subject": "synthetic-subject",
  "message": "synthetic-message",
  "type": "GENERAL"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create an owned enquiry",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/support/enquiries/{supportId}`

- Operation ID: `getCustomersSupportEnquiriesBySupportId`
- Purpose: Get an owned enquiry and customer-visible history. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an owned enquiry and customer-visible history",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/support/complaints`

- Operation ID: `getCustomersSupportComplaints`
- Purpose: List owned complaints. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | OPEN / INVESTIGATING / RESOLVED / CLOSED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List owned complaints",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/support/complaints`

- Operation ID: `postCustomersSupportComplaints`
- Purpose: Create an owned complaint. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `branchId` | string (uuid) | No | Identifier of the branch resource; ownership is resolved server-side. |
| `subject` | string | Yes | Subject validated by this operation's strict request contract. |
| `description` | string | Yes | Description validated by this operation's strict request contract. |
| `bookingId` | string (uuid) | No | Identifier of the booking resource; ownership is resolved server-side. |
| `orderId` | string (uuid) | No | Identifier of the order resource; ownership is resolved server-side. |
| `vehicleTransactionId` | string (uuid) | No | Identifier of the vehicle transaction resource; ownership is resolved server-side. |

Synthetic request example:

```json
{
  "branchId": "00000000-0000-4000-8000-000000000001",
  "subject": "synthetic-subject",
  "description": "synthetic-description",
  "bookingId": "00000000-0000-4000-8000-000000000001",
  "orderId": "00000000-0000-4000-8000-000000000001",
  "vehicleTransactionId": "00000000-0000-4000-8000-000000000001"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create an owned complaint",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/support/complaints/{supportId}`

- Operation ID: `getCustomersSupportComplaintsBySupportId`
- Purpose: Get an owned complaint and customer-visible history. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an owned complaint and customer-visible history",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/support/reviews`

- Operation ID: `getCustomersSupportReviews`
- Purpose: List own review submissions. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | PENDING / APPROVED / REJECTED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own review submissions",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/support/reviews`

- Operation ID: `postCustomersSupportReviews`
- Purpose: Submit an eligible review for moderation. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Synthetic request example:

```json
{
  "rating": 1,
  "title": "synthetic-title",
  "comment": "synthetic-comment",
  "targetType": "BUSINESS"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Submit an eligible review for moderation",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/notifications`

- Operation ID: `getCustomersNotifications`
- Purpose: List own notifications. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `unreadOnly` | query | true / false | No | Unread Only used to constrain this request. |
| `type` | query | BOOKING / QUOTATION / WORK_ORDER / ORDER / PAYMENT / REFUND / DISPUTE / INSPECTION / VEHICLE_TRANSACTION / ENQUIRY / COMPLAINT / REVIEW / PROMOTION / SYSTEM | No | Type used to constrain this request. |
| `category` | query | SECURITY / TRANSACTIONAL / OPERATIONAL / MARKETING | No | Category used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own notifications",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/notifications/read-all`

- Operation ID: `postCustomersNotificationsReadAll`
- Purpose: Mark all own notifications as read. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Mark all own notifications as read",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/notifications/{notificationId}/read`

- Operation ID: `postCustomersNotificationsByNotificationIdRead`
- Purpose: Mark one owned notification as read. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `notificationId` | path | string (uuid) | Yes | Identifier selecting the notification resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Mark one owned notification as read",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/notifications/preferences/current`

- Operation ID: `getCustomersNotificationsPreferencesCurrent`
- Purpose: Get mutable operational and marketing preferences. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get mutable operational and marketing preferences",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PUT `/customers/notifications/preferences/current`

- Operation ID: `putCustomersNotificationsPreferencesCurrent`
- Purpose: Update one mutable notification preference. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `category` | OPERATIONAL / MARKETING | Yes | Category validated by this operation's strict request contract. |
| `channel` | EMAIL / SMS | Yes | Channel validated by this operation's strict request contract. |
| `enabled` | boolean | Yes | Enabled validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "category": "OPERATIONAL",
  "channel": "EMAIL",
  "enabled": true
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update one mutable notification preference",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/overview`

- Operation ID: `getCustomersOverview`
- Purpose: Inclusive Africa/Lagos calendar range, maximum 90 days. Scope derives from the authenticated actor, with active-branch enforcement for STAFF. Booking/order/inspection/vehicle counts use creation dates; quotations use issue dates. Status breakdowns reflect current status. Administrator payment sums use succeededAt and verified settled attempts; refunds use processedAt. Currencies remain separate. Recent records are bounded previews, never the source of aggregate counts. Read own date-filtered dashboard aggregates. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `from` | query | string (date) | Yes | From used to constrain this request. |
| `to` | query | string (date) | Yes | To used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read own date-filtered dashboard aggregates",
  "data": {
    "scope": "CUSTOMER",
    "branch": {
      "id": "00000000-0000-4000-8000-000000000001",
      "name": "synthetic-name"
    },
    "range": {
      "from": "synthetic-from",
      "to": "synthetic-to",
      "timeZone": "Africa/Lagos"
    },
    "generatedAt": "2030-01-15T10:00:00.000Z",
    "counts": {
      "bookings": 0,
      "orders": 0,
      "quotations": 0,
      "inspections": 0,
      "vehicles": 0
    },
    "activity": [
      {
        "date": "2030-01-15T10:00:00.000Z",
        "bookings": 0,
        "orders": 0
      }
    ],
    "bookingStatuses": [
      {
        "status": "synthetic-status",
        "count": 0
      }
    ],
    "recentBookings": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "serviceName": "synthetic-servicename",
        "scheduledAt": "2030-01-15T10:00:00.000Z",
        "createdAt": "2030-01-15T10:00:00.000Z",
        "status": "synthetic-status"
      }
    ],
    "recentOrders": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "orderNumber": "synthetic-ordernumber",
        "createdAt": "2030-01-15T10:00:00.000Z",
        "status": "synthetic-status",
        "totalKobo": "300000",
        "currency": "NGN"
      }
    ]
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/privacy-requests`

- Operation ID: `getCustomersPrivacyRequests`
- Purpose: List own privacy requests. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own privacy requests",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "userId": "00000000-0000-4000-8000-000000000001",
        "kind": "ANONYMIZATION",
        "reason": "synthetic-reason",
        "status": "REQUESTED",
        "createdAt": "2030-01-15T10:00:00.000Z",
        "reviewedAt": "2030-01-15T10:00:00.000Z",
        "reviewNote": "synthetic-reviewnote"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/privacy-requests`

- Operation ID: `postCustomersPrivacyRequests`
- Purpose: Request reviewed anonymization or deletion without scheduling destruction. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `kind` | ANONYMIZATION / DELETION | Yes | Kind validated by this operation's strict request contract. |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "kind": "ANONYMIZATION",
  "reason": "synthetic-reason"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Request reviewed anonymization or deletion without scheduling destruction",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "userId": "00000000-0000-4000-8000-000000000001",
    "kind": "ANONYMIZATION",
    "reason": "synthetic-reason",
    "status": "REQUESTED",
    "createdAt": "2030-01-15T10:00:00.000Z",
    "reviewedAt": "2030-01-15T10:00:00.000Z",
    "reviewNote": "synthetic-reviewnote"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/customers/orders/{id}/aftercare`

- Operation ID: `getCustomersOrdersByIdAftercare`
- Purpose: Read latest 100 own cancellation and return requests without internal approval data. Access boundary: authenticated-customer. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read latest 100 own cancellation and return requests without internal approval data",
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "orderId": "00000000-0000-4000-8000-000000000001",
      "kind": "RETURN",
      "status": "REQUESTED",
      "reason": "synthetic-reason",
      "items": [
        {
          "orderItemId": "00000000-0000-4000-8000-000000000001",
          "quantity": 1
        }
      ],
      "requestedAt": "2030-01-15T10:00:00.000Z",
      "receivedAt": "2030-01-15T10:00:00.000Z",
      "inspectedAt": "2030-01-15T10:00:00.000Z",
      "goodCondition": "synthetic-goodcondition",
      "approvedFeeKobo": "300000",
      "reviewedAt": "2030-01-15T10:00:00.000Z",
      "reviewNote": "synthetic-reviewnote",
      "refundDueAt": "2030-01-15T10:00:00.000Z",
      "refundClockStatus": "synthetic-refundclockstatus"
    }
  ],
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/orders/{id}/aftercare`

- Operation ID: `postCustomersOrdersByIdAftercare`
- Purpose: Request selected-line cancellation or return; existing active requests retain their original details. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `kind` | RETURN / CANCELLATION | Yes | Kind validated by this operation's strict request contract. |
| `items` | array<object> | Yes | Items validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "reason": "synthetic-reason",
  "kind": "RETURN",
  "items": [
    {
      "orderItemId": "00000000-0000-4000-8000-000000000001",
      "quantity": 1
    }
  ]
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Request selected-line cancellation or return; existing active requests retain their original details",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "orderId": "00000000-0000-4000-8000-000000000001",
    "kind": "RETURN",
    "status": "REQUESTED",
    "reason": "synthetic-reason",
    "items": [
      {
        "orderItemId": "00000000-0000-4000-8000-000000000001",
        "quantity": 1
      }
    ],
    "requestedAt": "2030-01-15T10:00:00.000Z",
    "receivedAt": "2030-01-15T10:00:00.000Z",
    "inspectedAt": "2030-01-15T10:00:00.000Z",
    "goodCondition": "synthetic-goodcondition",
    "approvedFeeKobo": "300000",
    "reviewedAt": "2030-01-15T10:00:00.000Z",
    "reviewNote": "synthetic-reviewnote",
    "refundDueAt": "2030-01-15T10:00:00.000Z",
    "refundClockStatus": "synthetic-refundclockstatus"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/customers/orders/{id}/returns`

- Operation ID: `postCustomersOrdersByIdReturns`
- Purpose: Request a whole-order return for timing and condition review. Access boundary: authenticated-customer. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: CUSTOMER
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "reason": "synthetic-reason"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Request a whole-order return for timing and condition review",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "orderId": "00000000-0000-4000-8000-000000000001",
    "kind": "RETURN",
    "status": "REQUESTED",
    "reason": "synthetic-reason",
    "items": [
      {
        "orderItemId": "00000000-0000-4000-8000-000000000001",
        "quantity": 1
      }
    ],
    "requestedAt": "2030-01-15T10:00:00.000Z",
    "receivedAt": "2030-01-15T10:00:00.000Z",
    "inspectedAt": "2030-01-15T10:00:00.000Z",
    "goodCondition": "synthetic-goodcondition",
    "approvedFeeKobo": "300000",
    "reviewedAt": "2030-01-15T10:00:00.000Z",
    "reviewNote": "synthetic-reviewnote",
    "refundDueAt": "2030-01-15T10:00:00.000Z",
    "refundClockStatus": "synthetic-refundclockstatus"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.


## Staff API

### GET `/staff/profile`

- Operation ID: `getStaffProfile`
- Purpose: Get the current privileged profile. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get the current privileged profile",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "email": "customer@example.test",
    "role": "STAFF",
    "status": "ACTIVE",
    "emailVerifiedAt": "2030-01-15T10:00:00.000Z",
    "createdAt": "2030-01-15T10:00:00.000Z",
    "updatedAt": "2030-01-15T10:00:00.000Z",
    "capabilities": [
      "synthetic-capabilities-item"
    ],
    "staffProfile": {
      "id": "00000000-0000-4000-8000-000000000001",
      "firstName": "synthetic-firstname",
      "lastName": "synthetic-lastname",
      "phone": "+2348000000000",
      "jobTitle": "synthetic-jobtitle",
      "branchId": "00000000-0000-4000-8000-000000000001",
      "createdAt": "2030-01-15T10:00:00.000Z",
      "updatedAt": "2030-01-15T10:00:00.000Z",
      "branch": {
        "id": "00000000-0000-4000-8000-000000000001",
        "code": "synthetic-code",
        "name": "synthetic-name",
        "isActive": true
      }
    }
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/inventory`

- Operation ID: `getStaffInventory`
- Purpose: List authorized branch inventory. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `branchId` | query | string (uuid) | No | Branch Id used to constrain this request. |
| `productId` | query | string (uuid) | No | Product Id used to constrain this request. |
| `lowStock` | query | true / false | No | Low Stock used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List authorized branch inventory",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/inventory/{inventoryId}`

- Operation ID: `getStaffInventoryByInventoryId`
- Purpose: Get authorized inventory. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `inventoryId` | path | string (uuid) | Yes | Identifier selecting the inventory resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get authorized inventory",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/staff/inventory/{inventoryId}`

- Operation ID: `patchStaffInventoryByInventoryId`
- Purpose: Update reorder level. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `inventoryId` | path | string (uuid) | Yes | Identifier selecting the inventory resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `reorderLevel` | integer | Yes | Reorder Level validated by this operation's strict request contract. |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "reorderLevel": 0,
  "expectedVersion": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update reorder level",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/inventory/{inventoryId}/movements`

- Operation ID: `postStaffInventoryByInventoryIdMovements`
- Purpose: Record an idempotent stock movement. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `inventoryId` | path | string (uuid) | Yes | Identifier selecting the inventory resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

Synthetic request example:

```json
{
  "type": "STOCK_IN",
  "quantity": 1,
  "note": "synthetic-note",
  "referenceType": "ORDER",
  "referenceId": "synthetic-referenceid"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Record an idempotent stock movement",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/inventory/{inventoryId}/history`

- Operation ID: `getStaffInventoryByInventoryIdHistory`
- Purpose: List append-only stock history. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `inventoryId` | path | string (uuid) | Yes | Identifier selecting the inventory resource. |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `type` | query | STOCK_IN / SALE / RESERVATION / RESERVATION_RELEASE / RETURN / ADJUSTMENT / DAMAGE / RESTOCK | No | Type used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List append-only stock history",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/inventory/{inventoryId}/reservations`

- Operation ID: `getStaffInventoryByInventoryIdReservations`
- Purpose: List inventory reservations. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `inventoryId` | path | string (uuid) | Yes | Identifier selecting the inventory resource. |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | ACTIVE / RELEASED / CONSUMED / EXPIRED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List inventory reservations",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/inventory/{inventoryId}/reservations`

- Operation ID: `postStaffInventoryByInventoryIdReservations`
- Purpose: Create an idempotent reservation. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `inventoryId` | path | string (uuid) | Yes | Identifier selecting the inventory resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `quantity` | integer | Yes | Quantity validated by this operation's strict request contract. |
| `customerId` | string (uuid) | No | Identifier of the customer resource; ownership is resolved server-side. |
| `expiresAt` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |
| `referenceType` | ORDER / WORK_ORDER / CART / MANUAL | No | Reference Type validated by this operation's strict request contract. |
| `referenceId` | string | No | Identifier of the reference resource; ownership is resolved server-side. |

Synthetic request example:

```json
{
  "quantity": 1,
  "customerId": "00000000-0000-4000-8000-000000000001",
  "expiresAt": "2030-01-15T10:00:00.000Z",
  "referenceType": "ORDER",
  "referenceId": "synthetic-referenceid"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create an idempotent reservation",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/inventory/{inventoryId}/reservations/{reservationId}/release`

- Operation ID: `postStaffInventoryByInventoryIdReservationsByReservationIdRelease`
- Purpose: Release an idempotent reservation. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `inventoryId` | path | string (uuid) | Yes | Identifier selecting the inventory resource. |
| `reservationId` | path | string (uuid) | Yes | Identifier selecting the reservation resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `note` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "note": "synthetic-note"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Release an idempotent reservation",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/bookings`

- Operation ID: `getStaffBookings`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. List branch-authorized bookings. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | REQUESTED / AWAITING_DEPOSIT / CONFIRMED / IN_PROGRESS / COMPLETED / CANCELLED / NO_SHOW / EXPIRED | No | Status used to constrain this request. |
| `branchId` | query | string (uuid) | No | Branch Id used to constrain this request. |
| `assignedStaffId` | query | string (uuid) | No | Assigned Staff Id used to constrain this request. |
| `scheduledFrom` | query | string (date-time) | No | Scheduled From used to constrain this request. |
| `scheduledTo` | query | string (date-time) | No | Scheduled To used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List branch-authorized bookings",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/booking-slots`

- Operation ID: `getStaffBookingSlots`
- Purpose: List authorized published booking slots. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `branchId` | query | string (uuid) | No | Branch Id used to constrain this request. |
| `serviceId` | query | string (uuid) | No | Service Id used to constrain this request. |
| `staffId` | query | string (uuid) | No | Staff Id used to constrain this request. |
| `status` | query | OPEN / CLOSED | No | Status used to constrain this request. |
| `startsFrom` | query | string (date-time) | No | Starts From used to constrain this request. |
| `startsTo` | query | string (date-time) | No | Starts To used to constrain this request. |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List authorized published booking slots",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/booking-slots`

- Operation ID: `postStaffBookingSlots`
- Purpose: Publish a staff-bound fixed-price booking slot. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `branchId` | string (uuid) | Yes | Identifier of the branch resource; ownership is resolved server-side. |
| `serviceId` | string (uuid) | Yes | Identifier of the service resource; ownership is resolved server-side. |
| `staffId` | string (uuid) | Yes | Identifier of the staff resource; ownership is resolved server-side. |
| `startsAt` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |

Synthetic request example:

```json
{
  "branchId": "00000000-0000-4000-8000-000000000001",
  "serviceId": "00000000-0000-4000-8000-000000000001",
  "staffId": "00000000-0000-4000-8000-000000000001",
  "startsAt": "2030-01-15T10:00:00.000Z"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Publish a staff-bound fixed-price booking slot",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/staff/booking-slots/{slotId}`

- Operation ID: `patchStaffBookingSlotsBySlotId`
- Purpose: Open or close a booking slot using optimistic concurrency. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `slotId` | path | string (uuid) | Yes | Identifier selecting the slot resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `status` | OPEN / CLOSED | Yes | Requested or filtered lifecycle state from the documented enum. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "status": "OPEN"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Open or close a booking slot using optimistic concurrency",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/bookings/{bookingId}`

- Operation ID: `getStaffBookingsByBookingId`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Get a branch-authorized booking. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get a branch-authorized booking",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/staff/bookings/{bookingId}/assignment`

- Operation ID: `patchStaffBookingsByBookingIdAssignment`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Assign available branch staff. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `assignedStaffId` | string (uuid) | Yes | Identifier of the assigned staff resource; ownership is resolved server-side. |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "assignedStaffId": "00000000-0000-4000-8000-000000000001",
  "expectedVersion": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Assign available branch staff",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/bookings/{bookingId}/disruption`

- Operation ID: `postStaffBookingsByBookingIdDisruption`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Report a business-caused booking disruption. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "reason": "synthetic-reason"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Report a business-caused booking disruption",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/bookings/{bookingId}/status`

- Operation ID: `postStaffBookingsByBookingIdStatus`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Transition a booking. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `status` | CONFIRMED / IN_PROGRESS / COMPLETED / CANCELLED / NO_SHOW | Yes | Requested or filtered lifecycle state from the documented enum. |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `reason` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `staffNotes` | string / null | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `resourceReviewNote` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "status": "CONFIRMED",
  "expectedVersion": 0,
  "reason": "synthetic-reason",
  "staffNotes": "synthetic-staffnotes",
  "resourceReviewNote": "synthetic-resourcereviewnote"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Transition a booking",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/bookings/{bookingId}/quotes`

- Operation ID: `postStaffBookingsByBookingIdQuotes`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Create a quote draft. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `items` | array<object> | Yes | Items validated by this operation's strict request contract. |
| `taxKobo` | string | No | Legacy compatibility field; ignored. The server calculates quotation tax from its priced subtotal. |
| `notes` | string / null | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `expiresAt` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |

Synthetic request example:

```json
{
  "items": [
    {
      "type": "PART",
      "productId": "00000000-0000-4000-8000-000000000001",
      "quantity": 1,
      "description": "synthetic-description"
    }
  ],
  "taxKobo": "300000",
  "notes": "synthetic-notes",
  "expiresAt": "2030-01-15T10:00:00.000Z"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a quote draft",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PUT `/staff/bookings/{bookingId}/quotes/{quoteId}`

- Operation ID: `putStaffBookingsByBookingIdQuotesByQuoteId`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Create a replacement quote version. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `quoteId` | path | string (uuid) | Yes | Identifier selecting the quote resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `items` | array<object> | Yes | Items validated by this operation's strict request contract. |
| `taxKobo` | string | No | Legacy compatibility field; ignored. The server calculates quotation tax from its priced subtotal. |
| `notes` | string / null | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `expiresAt` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |
| `expectedRevision` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "items": [
    {
      "type": "PART",
      "productId": "00000000-0000-4000-8000-000000000001",
      "quantity": 1,
      "description": "synthetic-description"
    }
  ],
  "taxKobo": "300000",
  "notes": "synthetic-notes",
  "expiresAt": "2030-01-15T10:00:00.000Z",
  "expectedRevision": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Create a replacement quote version",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/bookings/{bookingId}/quotes/{quoteId}/issue`

- Operation ID: `postStaffBookingsByBookingIdQuotesByQuoteIdIssue`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Issue a quote. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `quoteId` | path | string (uuid) | Yes | Identifier selecting the quote resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedRevision` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "expectedRevision": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Issue a quote",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/bookings/{bookingId}/quotes/{quoteId}/void`

- Operation ID: `postStaffBookingsByBookingIdQuotesByQuoteIdVoid`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Void a quote. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `quoteId` | path | string (uuid) | Yes | Identifier selecting the quote resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedRevision` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "expectedRevision": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Void a quote",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/bookings/{bookingId}/quotes/{quoteId}/expire`

- Operation ID: `postStaffBookingsByBookingIdQuotesByQuoteIdExpire`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Expire an overdue quote. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `quoteId` | path | string (uuid) | Yes | Identifier selecting the quote resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedRevision` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "expectedRevision": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Expire an overdue quote",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/bookings/{bookingId}/work-orders`

- Operation ID: `postStaffBookingsByBookingIdWorkOrders`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Create a work order. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedBookingVersion` | integer | Yes | Expected Booking Version validated by this operation's strict request contract. |
| `diagnosis` | string / null | No | Diagnosis validated by this operation's strict request contract. |
| `internalNotes` | string / null | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `items` | array<object> | No | Items validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "expectedBookingVersion": 0,
  "diagnosis": "synthetic-diagnosis",
  "internalNotes": "synthetic-internalnotes",
  "items": [
    {
      "type": "PART",
      "productId": "00000000-0000-4000-8000-000000000001",
      "quantity": 1,
      "description": "synthetic-description"
    }
  ]
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a work order",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PUT `/staff/bookings/{bookingId}/work-orders/{workOrderId}`

- Operation ID: `putStaffBookingsByBookingIdWorkOrdersByWorkOrderId`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Update work details and append items. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `workOrderId` | path | string (uuid) | Yes | Identifier selecting the work order resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `diagnosis` | string / null | No | Diagnosis validated by this operation's strict request contract. |
| `internalNotes` | string / null | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `addItems` | array<object> | No | Add Items validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "diagnosis": "synthetic-diagnosis",
  "internalNotes": "synthetic-internalnotes",
  "addItems": [
    {
      "type": "PART",
      "productId": "00000000-0000-4000-8000-000000000001",
      "quantity": 1,
      "description": "synthetic-description"
    }
  ]
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update work details and append items",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/bookings/{bookingId}/work-orders/{workOrderId}/status`

- Operation ID: `postStaffBookingsByBookingIdWorkOrdersByWorkOrderIdStatus`
- Purpose: Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied. Transition a work order. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `bookingId` | path | string (uuid) | Yes | Identifier selecting the booking resource. |
| `workOrderId` | path | string (uuid) | Yes | Identifier selecting the work order resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `status` | APPROVED / IN_PROGRESS / AWAITING_PARTS / QUALITY_CHECK / COMPLETED / CANCELLED | Yes | Requested or filtered lifecycle state from the documented enum. |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "status": "APPROVED",
  "expectedVersion": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Transition a work order",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/orders`

- Operation ID: `getStaffOrders`
- Purpose: Branch-authorized fulfilment. Invoice records are omitted entirely for STAFF; only ADMIN/SUPER_ADMIN receive embedded invoices. Commercial order totals and payment clearance dates remain available for fulfilment. List branch-authorized orders. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `branchId` | query | string (uuid) | No | Branch Id used to constrain this request. |
| `customerId` | query | string (uuid) | No | Customer Id used to constrain this request. |
| `status` | query | PENDING / CONFIRMED / PROCESSING / READY / COMPLETED / CANCELLED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List branch-authorized orders",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/orders/{orderId}`

- Operation ID: `getStaffOrdersByOrderId`
- Purpose: Branch-authorized fulfilment. Invoice records are omitted entirely for STAFF; only ADMIN/SUPER_ADMIN receive embedded invoices. Commercial order totals and payment clearance dates remain available for fulfilment. Get a branch-authorized order. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `orderId` | path | string (uuid) | Yes | Identifier selecting the order resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get a branch-authorized order",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/orders/{orderId}/status`

- Operation ID: `postStaffOrdersByOrderIdStatus`
- Purpose: Branch-authorized fulfilment. Invoice records are omitted entirely for STAFF; only ADMIN/SUPER_ADMIN receive embedded invoices. Commercial order totals and payment clearance dates remain available for fulfilment. Transition an order. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `orderId` | path | string (uuid) | Yes | Identifier selecting the order resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `status` | CONFIRMED / PROCESSING / READY / COMPLETED / CANCELLED | Yes | Requested or filtered lifecycle state from the documented enum. |
| `reason` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "status": "CONFIRMED",
  "reason": "synthetic-reason"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Transition an order",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/invoices`

- Operation ID: `getStaffInvoices`
- Purpose: ADMIN or SUPER_ADMIN with verified MFA only; STAFF is denied. List authorized invoices. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | DRAFT / ISSUED / PAID / VOID | No | Status used to constrain this request. |
| `customerId` | query | string (uuid) | No | Customer Id used to constrain this request. |
| `branchId` | query | string (uuid) | No | Branch Id used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List authorized invoices",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/invoices`

- Operation ID: `postStaffInvoices`
- Purpose: ADMIN or SUPER_ADMIN with verified MFA and CSRF protection only. STAFF is denied; source prices remain server-authoritative. Create an invoice from a server-owned source. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `sourceType` | ORDER / BOOKING / VEHICLE_TRANSACTION | Yes | Source Type validated by this operation's strict request contract. |
| `sourceId` | string (uuid) | Yes | Identifier of the source resource; ownership is resolved server-side. |
| `dueAt` | string (date-time) | No | ISO 8601 timestamp interpreted and validated by the server. |

Synthetic request example:

```json
{
  "sourceType": "ORDER",
  "sourceId": "00000000-0000-4000-8000-000000000001",
  "dueAt": "2030-01-15T10:00:00.000Z"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create an invoice from a server-owned source",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/invoices/{invoiceId}`

- Operation ID: `getStaffInvoicesByInvoiceId`
- Purpose: ADMIN or SUPER_ADMIN with verified MFA only; STAFF is denied. Get an authorized invoice. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `invoiceId` | path | string (uuid) | Yes | Identifier selecting the invoice resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get an authorized invoice",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/invoices/{invoiceId}/issue`

- Operation ID: `postStaffInvoicesByInvoiceIdIssue`
- Purpose: ADMIN or SUPER_ADMIN with verified MFA and CSRF protection only. STAFF is denied; lifecycle and version checks still apply. issue an invoice. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `invoiceId` | path | string (uuid) | Yes | Identifier selecting the invoice resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "expectedVersion": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "issue an invoice",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/invoices/{invoiceId}/void`

- Operation ID: `postStaffInvoicesByInvoiceIdVoid`
- Purpose: ADMIN or SUPER_ADMIN with verified MFA and CSRF protection only. STAFF is denied; lifecycle and version checks still apply. void an invoice. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `invoiceId` | path | string (uuid) | Yes | Identifier selecting the invoice resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "expectedVersion": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "void an invoice",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/vehicles`

- Operation ID: `getStaffVehicles`
- Purpose: List branch vehicle inventory; acquisition costs are administrator-only. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `search` | query | string | No | Search used to constrain this request. |
| `make` | query | string | No | Make used to constrain this request. |
| `model` | query | string | No | Model used to constrain this request. |
| `year` | query | integer | No | Year used to constrain this request. |
| `bodyType` | query | SEDAN / SUV / COUPE / HATCHBACK / WAGON / PICKUP / VAN / TRUCK / BUS / OTHER | No | Body Type used to constrain this request. |
| `transmission` | query | AUTOMATIC / MANUAL / CVT / OTHER | No | Transmission used to constrain this request. |
| `fuelType` | query | PETROL / DIESEL / HYBRID / ELECTRIC / OTHER | No | Fuel Type used to constrain this request. |
| `featured` | query | true / false | No | Featured used to constrain this request. |
| `minPriceKobo` | query | string | No | Min Price Kobo used to constrain this request. |
| `maxPriceKobo` | query | string | No | Max Price Kobo used to constrain this request. |
| `sort` | query | newest / price_asc / price_desc / year_desc | No | Sort used to constrain this request. |
| `status` | query | DRAFT / AVAILABLE / RESERVED / SOLD / INACTIVE / ARCHIVED | No | Status used to constrain this request. |
| `branchId` | query | string (uuid) | No | Branch Id used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List branch vehicle inventory; acquisition costs are administrator-only",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicles`

- Operation ID: `postStaffVehicles`
- Purpose: Create a physical vehicle; acquisition cost requires ADMIN or SUPER_ADMIN. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `branchId` | string (uuid) | Yes | Identifier of the branch resource; ownership is resolved server-side. |
| `stockNumber` | string | Yes | Stock Number validated by this operation's strict request contract. |
| `make` | string | Yes | Make validated by this operation's strict request contract. |
| `model` | string | Yes | Model validated by this operation's strict request contract. |
| `trim` | string / null | No | Trim validated by this operation's strict request contract. |
| `year` | integer | Yes | Year validated by this operation's strict request contract. |
| `mileageKm` | integer / null | No | Mileage Km validated by this operation's strict request contract. |
| `transmission` | AUTOMATIC / MANUAL / CVT / OTHER / null | No | Transmission validated by this operation's strict request contract. |
| `fuelType` | PETROL / DIESEL / HYBRID / ELECTRIC / OTHER / null | No | Fuel Type validated by this operation's strict request contract. |
| `condition` | NEW / USED | No | Condition validated by this operation's strict request contract. |
| `bodyType` | SEDAN / SUV / COUPE / HATCHBACK / WAGON / PICKUP / VAN / TRUCK / BUS / OTHER / null | No | Body Type validated by this operation's strict request contract. |
| `engineSize` | string / null | No | Engine Size validated by this operation's strict request contract. |
| `driveType` | FWD / RWD / AWD / FOUR_WD / OTHER / null | No | Drive Type validated by this operation's strict request contract. |
| `color` | string / null | No | Color validated by this operation's strict request contract. |
| `doors` | integer / null | No | Doors validated by this operation's strict request contract. |
| `seats` | integer / null | No | Seats validated by this operation's strict request contract. |
| `vin` | string / null | No | Vin validated by this operation's strict request contract. |
| `chassisNumber` | string / null | No | Chassis Number validated by this operation's strict request contract. |
| `registrationNumber` | string / null | No | Registration Number validated by this operation's strict request contract. |
| `acquisitionCostKobo` | string / null | No | Acquisition Cost Kobo validated by this operation's strict request contract. |
| `acquiredAt` | string / null | No | ISO 8601 timestamp interpreted and validated by the server. |

Synthetic request example:

```json
{
  "branchId": "00000000-0000-4000-8000-000000000001",
  "stockNumber": "synthetic-stocknumber",
  "make": "synthetic-make",
  "model": "synthetic-model",
  "year": 1886
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a physical vehicle; acquisition cost requires ADMIN or SUPER_ADMIN",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/vehicles/{vehicleId}`

- Operation ID: `getStaffVehiclesByVehicleId`
- Purpose: Get vehicle inventory details; acquisition costs are administrator-only. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | string (uuid) | Yes | Identifier selecting the vehicle resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get vehicle inventory details; acquisition costs are administrator-only",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/staff/vehicles/{vehicleId}`

- Operation ID: `patchStaffVehiclesByVehicleId`
- Purpose: Update vehicle inventory; acquisition cost requires ADMIN or SUPER_ADMIN. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | string (uuid) | Yes | Identifier selecting the vehicle resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `make` | string | No | Make validated by this operation's strict request contract. |
| `model` | string | No | Model validated by this operation's strict request contract. |
| `trim` | string / null | No | Trim validated by this operation's strict request contract. |
| `year` | integer | No | Year validated by this operation's strict request contract. |
| `mileageKm` | integer / null | No | Mileage Km validated by this operation's strict request contract. |
| `transmission` | AUTOMATIC / MANUAL / CVT / OTHER / null | No | Transmission validated by this operation's strict request contract. |
| `fuelType` | PETROL / DIESEL / HYBRID / ELECTRIC / OTHER / null | No | Fuel Type validated by this operation's strict request contract. |
| `condition` | NEW / USED | No | Condition validated by this operation's strict request contract. |
| `bodyType` | SEDAN / SUV / COUPE / HATCHBACK / WAGON / PICKUP / VAN / TRUCK / BUS / OTHER / null | No | Body Type validated by this operation's strict request contract. |
| `engineSize` | string / null | No | Engine Size validated by this operation's strict request contract. |
| `driveType` | FWD / RWD / AWD / FOUR_WD / OTHER / null | No | Drive Type validated by this operation's strict request contract. |
| `color` | string / null | No | Color validated by this operation's strict request contract. |
| `doors` | integer / null | No | Doors validated by this operation's strict request contract. |
| `seats` | integer / null | No | Seats validated by this operation's strict request contract. |
| `vin` | string / null | No | Vin validated by this operation's strict request contract. |
| `chassisNumber` | string / null | No | Chassis Number validated by this operation's strict request contract. |
| `registrationNumber` | string / null | No | Registration Number validated by this operation's strict request contract. |
| `acquisitionCostKobo` | string / null | No | Acquisition Cost Kobo validated by this operation's strict request contract. |
| `acquiredAt` | string / null | No | ISO 8601 timestamp interpreted and validated by the server. |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |

Synthetic request example:

```json
{
  "expectedVersion": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update vehicle inventory; acquisition cost requires ADMIN or SUPER_ADMIN",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicles/listings`

- Operation ID: `postStaffVehiclesListings`
- Purpose: Create a vehicle listing. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `vehicleId` | string (uuid) | Yes | Identifier of the vehicle resource; ownership is resolved server-side. |
| `title` | string | Yes | Title validated by this operation's strict request contract. |
| `slug` | string | Yes | Slug validated by this operation's strict request contract. |
| `priceKobo` | string | Yes | Integer price in Nigerian kobo; client-calculated values are never authoritative. |
| `description` | string / null | No | Description validated by this operation's strict request contract. |
| `featured` | boolean | No | Featured validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "vehicleId": "00000000-0000-4000-8000-000000000001",
  "title": "synthetic-title",
  "slug": "synthetic-slug",
  "priceKobo": "300000",
  "description": "synthetic-description",
  "featured": true
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a vehicle listing",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/staff/vehicles/listings/{listingId}`

- Operation ID: `patchStaffVehiclesListingsByListingId`
- Purpose: Update a vehicle listing. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `listingId` | path | string (uuid) | Yes | Identifier selecting the listing resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `title` | string | No | Title validated by this operation's strict request contract. |
| `slug` | string | No | Slug validated by this operation's strict request contract. |
| `description` | string / null | No | Description validated by this operation's strict request contract. |
| `featured` | boolean | No | Featured validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "title": "synthetic-title",
  "slug": "synthetic-slug",
  "description": "synthetic-description",
  "featured": true
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update a vehicle listing",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicles/listings/{listingId}/status`

- Operation ID: `postStaffVehiclesListingsByListingIdStatus`
- Purpose: Transition a vehicle listing. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `listingId` | path | string (uuid) | Yes | Identifier selecting the listing resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `status` | AVAILABLE / INACTIVE / ARCHIVED | Yes | Requested or filtered lifecycle state from the documented enum. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "status": "AVAILABLE"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Transition a vehicle listing",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicles/listings/{listingId}/price`

- Operation ID: `postStaffVehiclesListingsByListingIdPrice`
- Purpose: Change listing price with history. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `listingId` | path | string (uuid) | Yes | Identifier selecting the listing resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `priceKobo` | string | Yes | Integer price in Nigerian kobo; client-calculated values are never authoritative. |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "priceKobo": "300000",
  "reason": "synthetic-reason"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Change listing price with history",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicles/{vehicleId}/assets/upload`

- Operation ID: `postStaffVehiclesByVehicleIdAssetsUpload`
- Purpose: Authorize a bounded object upload. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | string (uuid) | Yes | Identifier selecting the vehicle resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `kind` | IMAGE / DOCUMENT / CONDITION_REPORT / HANDOVER | Yes | Kind validated by this operation's strict request contract. |
| `mimeType` | image/jpeg / image/png / image/webp / application/pdf | Yes | Mime Type validated by this operation's strict request contract. |
| `sizeBytes` | integer | Yes | Size Bytes validated by this operation's strict request contract. |
| `checksumSha256` | string | Yes | Checksum Sha256 validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "kind": "IMAGE",
  "mimeType": "image/jpeg",
  "sizeBytes": 1,
  "checksumSha256": "synthetic-checksumsha256"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Authorize a bounded object upload",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicles/{vehicleId}/images`

- Operation ID: `postStaffVehiclesByVehicleIdImages`
- Purpose: Confirm uploaded vehicle image. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | string (uuid) | Yes | Identifier selecting the vehicle resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `assetToken` | string | Yes | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `altText` | string / null | No | Alt Text validated by this operation's strict request contract. |
| `sortOrder` | integer | No | Sort Order validated by this operation's strict request contract. |
| `isPrimary` | boolean | No | Boolean control for is primary; authorization is still enforced server-side. |

Synthetic request example:

```json
{
  "assetToken": "synthetic-token-value-not-a-real-secret",
  "altText": "synthetic-alttext",
  "sortOrder": 0,
  "isPrimary": true
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Confirm uploaded vehicle image",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicles/{vehicleId}/documents`

- Operation ID: `postStaffVehiclesByVehicleIdDocuments`
- Purpose: Confirm uploaded private document. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | string (uuid) | Yes | Identifier selecting the vehicle resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `assetToken` | string | Yes | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `type` | OWNERSHIP / REGISTRATION / CUSTOMS_CLEARANCE / PURCHASE_RECEIPT / INSPECTION_REPORT / SERVICE_HISTORY / OTHER | Yes | Type validated by this operation's strict request contract. |
| `issuedAt` | string / null | No | ISO 8601 timestamp interpreted and validated by the server. |
| `expiresAt` | string / null | No | ISO 8601 timestamp interpreted and validated by the server. |

Synthetic request example:

```json
{
  "assetToken": "synthetic-token-value-not-a-real-secret",
  "type": "OWNERSHIP",
  "issuedAt": "2030-01-15T10:00:00.000Z",
  "expiresAt": "2030-01-15T10:00:00.000Z"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Confirm uploaded private document",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicles/{vehicleId}/condition-reports`

- Operation ID: `postStaffVehiclesByVehicleIdConditionReports`
- Purpose: Create a condition report. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | string (uuid) | Yes | Identifier selecting the vehicle resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `inspectionId` | string / null | No | Identifier of the inspection resource; ownership is resolved server-side. |
| `odometerKm` | integer / null | No | Odometer Km validated by this operation's strict request contract. |
| `conditionScore` | integer / null | No | Condition Score validated by this operation's strict request contract. |
| `summary` | string | Yes | Summary validated by this operation's strict request contract. |
| `findings` | object | No | Findings validated by this operation's strict request contract. |
| `inspectedAt` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |
| `assetToken` | string | No | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |

Synthetic request example:

```json
{
  "inspectionId": "00000000-0000-4000-8000-000000000001",
  "odometerKm": "synthetic-odometerkm",
  "conditionScore": "synthetic-conditionscore",
  "summary": "synthetic-summary",
  "findings": {},
  "inspectedAt": "2030-01-15T10:00:00.000Z",
  "assetToken": "synthetic-token-value-not-a-real-secret"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a condition report",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicles/{vehicleId}/documents/{documentId}/review`

- Operation ID: `postStaffVehiclesByVehicleIdDocumentsByDocumentIdReview`
- Purpose: Review a vehicle document. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | string (uuid) | Yes | Identifier selecting the vehicle resource. |
| `documentId` | path | string (uuid) | Yes | Identifier selecting the document resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `status` | VERIFIED / REJECTED | Yes | Requested or filtered lifecycle state from the documented enum. |
| `rejectionReason` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "status": "VERIFIED",
  "rejectionReason": "synthetic-rejectionreason"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Review a vehicle document",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicles/{vehicleId}/documents/{documentId}/access`

- Operation ID: `postStaffVehiclesByVehicleIdDocumentsByDocumentIdAccess`
- Purpose: Authorize private document download. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | string (uuid) | Yes | Identifier selecting the vehicle resource. |
| `documentId` | path | string (uuid) | Yes | Identifier selecting the document resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Authorize private document download",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/vehicle-inspections`

- Operation ID: `getStaffVehicleInspections`
- Purpose: List branch inspections. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | REQUESTED / CONFIRMED / COMPLETED / RESCHEDULED / CANCELLED / NO_SHOW | No | Status used to constrain this request. |
| `branchId` | query | string (uuid) | No | Branch Id used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List branch inspections",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicle-inspections/{inspectionId}/status`

- Operation ID: `postStaffVehicleInspectionsByInspectionIdStatus`
- Purpose: Transition an inspection. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `inspectionId` | path | string (uuid) | Yes | Identifier selecting the inspection resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `status` | CONFIRMED / COMPLETED / RESCHEDULED / CANCELLED / NO_SHOW | Yes | Requested or filtered lifecycle state from the documented enum. |
| `assignedStaffId` | string (uuid) | No | Identifier of the assigned staff resource; ownership is resolved server-side. |
| `scheduledStartAt` | string (date-time) | No | ISO 8601 timestamp interpreted and validated by the server. |
| `scheduledEndAt` | string (date-time) | No | ISO 8601 timestamp interpreted and validated by the server. |
| `reason` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "status": "CONFIRMED",
  "assignedStaffId": "00000000-0000-4000-8000-000000000001",
  "scheduledStartAt": "2030-01-15T10:00:00.000Z",
  "scheduledEndAt": "2030-01-15T10:00:00.000Z",
  "reason": "synthetic-reason"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Transition an inspection",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/vehicle-transactions`

- Operation ID: `getStaffVehicleTransactions`
- Purpose: List branch vehicle transactions. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | ENQUIRY / INSPECTION_SCHEDULED / INSPECTION_COMPLETED / NEGOTIATING / PAYMENT_PENDING / RESERVED / PARTIALLY_PAID / PAID / HANDOVER_PENDING / COMPLETED / CANCELLED / EXPIRED | No | Status used to constrain this request. |
| `branchId` | query | string (uuid) | No | Branch Id used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List branch vehicle transactions",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/vehicle-transactions/{transactionId}`

- Operation ID: `getStaffVehicleTransactionsByTransactionId`
- Purpose: Get a branch vehicle transaction. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `transactionId` | path | string (uuid) | Yes | Identifier selecting the transaction resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get a branch vehicle transaction",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicle-transactions/{transactionId}/negotiate`

- Operation ID: `postStaffVehicleTransactionsByTransactionIdNegotiate`
- Purpose: Record an agreed vehicle price. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `transactionId` | path | string (uuid) | Yes | Identifier selecting the transaction resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `agreedPriceKobo` | string | Yes | Integer price in Nigerian kobo; client-calculated values are never authoritative. |
| `reservationRequiredKobo` | string / null | No | Reservation Required Kobo validated by this operation's strict request contract. |
| `notes` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "agreedPriceKobo": "300000",
  "reservationRequiredKobo": "300000",
  "notes": "synthetic-notes"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Record an agreed vehicle price",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicle-transactions/{transactionId}/status`

- Operation ID: `postStaffVehicleTransactionsByTransactionIdStatus`
- Purpose: Transition a vehicle transaction. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `transactionId` | path | string (uuid) | Yes | Identifier selecting the transaction resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `status` | INSPECTION_SCHEDULED / INSPECTION_COMPLETED / NEGOTIATING / PAYMENT_PENDING / CANCELLED | Yes | Requested or filtered lifecycle state from the documented enum. |
| `reason` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "status": "INSPECTION_SCHEDULED",
  "reason": "synthetic-reason"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Transition a vehicle transaction",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicle-transactions/{transactionId}/handovers`

- Operation ID: `postStaffVehicleTransactionsByTransactionIdHandovers`
- Purpose: Create a paid-vehicle handover. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `transactionId` | path | string (uuid) | Yes | Identifier selecting the transaction resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `recipientName` | string | Yes | Recipient Name validated by this operation's strict request contract. |
| `recipientPhone` | string | Yes | Customer or business phone number in international format. |
| `odometerKm` | integer | Yes | Odometer Km validated by this operation's strict request contract. |
| `keysDelivered` | integer | Yes | Keys Delivered validated by this operation's strict request contract. |
| `assetToken` | string | No | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |

Synthetic request example:

```json
{
  "recipientName": "synthetic-recipientname",
  "recipientPhone": "+2348000000000",
  "odometerKm": 0,
  "keysDelivered": 0,
  "assetToken": "synthetic-token-value-not-a-real-secret"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a paid-vehicle handover",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicle-transactions/{transactionId}/handovers/{handoverId}/status`

- Operation ID: `postStaffVehicleTransactionsByTransactionIdHandoversByHandoverIdStatus`
- Purpose: Transition a vehicle handover. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `transactionId` | path | string (uuid) | Yes | Identifier selecting the transaction resource. |
| `handoverId` | path | string (uuid) | Yes | Identifier selecting the handover resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `status` | READY / COMPLETED / CANCELLED | Yes | Requested or filtered lifecycle state from the documented enum. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "status": "READY"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Transition a vehicle handover",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/vehicle-transactions/{transactionId}/handovers/{handoverId}/access`

- Operation ID: `postStaffVehicleTransactionsByTransactionIdHandoversByHandoverIdAccess`
- Purpose: Authorize private handover document access. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `transactionId` | path | string (uuid) | Yes | Identifier selecting the transaction resource. |
| `handoverId` | path | string (uuid) | Yes | Identifier selecting the handover resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Authorize private handover document access",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/payments`

- Operation ID: `getStaffPayments`
- Purpose: Requires ADMIN or SUPER_ADMIN with verified MFA. STAFF has no payment, evidence or refund access. Existing separation-of-duties and transactional checks also apply. List payments for review. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | REQUIRES_PAYMENT / PROCESSING / REQUIRES_REVIEW / SUCCEEDED / CANCELLED / EXPIRED | No | Status used to constrain this request. |
| `customerId` | query | string (uuid) | No | Customer Id used to constrain this request. |
| `provider` | query | PAYSTACK / MONNIFY / MANUAL | No | Provider used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List payments for review",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### POST `/staff/payments/manual-attempts/{attemptId}/review`

- Operation ID: `postStaffPaymentsManualAttemptsByAttemptIdReview`
- Purpose: Requires ADMIN or SUPER_ADMIN with verified MFA. STAFF has no payment, evidence or refund access. Existing separation-of-duties and transactional checks also apply. Review a manual payment with separation of duties. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `attemptId` | path | string (uuid) | Yes | Identifier selecting the attempt resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `decision` | APPROVED / REJECTED | Yes | Decision validated by this operation's strict request contract. |
| `reviewerNote` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "decision": "APPROVED",
  "reviewerNote": "synthetic-reviewernote"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Review a manual payment with separation of duties",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### POST `/staff/payments/manual-attempts/{attemptId}/evidence-access`

- Operation ID: `postStaffPaymentsManualAttemptsByAttemptIdEvidenceAccess`
- Purpose: Requires ADMIN or SUPER_ADMIN with verified MFA. STAFF has no payment, evidence or refund access. Existing separation-of-duties and transactional checks also apply. Authorize short-lived private evidence access. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `attemptId` | path | string (uuid) | Yes | Identifier selecting the attempt resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Authorize short-lived private evidence access",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### POST `/staff/payments/refunds`

- Operation ID: `postStaffPaymentsRefunds`
- Purpose: Requires ADMIN or SUPER_ADMIN with verified MFA. STAFF has no payment, evidence or refund access. Existing separation-of-duties and transactional checks also apply. Request a refund. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `paymentAttemptId` | string (uuid) | Yes | Identifier of the payment attempt resource; ownership is resolved server-side. |
| `amountKobo` | string | Yes | Integer amount in Nigerian kobo; the server remains authoritative. |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "paymentAttemptId": "00000000-0000-4000-8000-000000000001",
  "amountKobo": "300000",
  "reason": "synthetic-reason"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Request a refund",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### POST `/staff/payments/refunds/{refundId}/decision`

- Operation ID: `postStaffPaymentsRefundsByRefundIdDecision`
- Purpose: Requires ADMIN or SUPER_ADMIN with verified MFA. STAFF has no payment, evidence or refund access. Existing separation-of-duties and transactional checks also apply. Approve or cancel a refund with separation of duties. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `refundId` | path | string (uuid) | Yes | Identifier selecting the refund resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `decision` | APPROVED / CANCELLED | Yes | Decision validated by this operation's strict request contract. |
| `note` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "decision": "APPROVED",
  "note": "synthetic-note"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Approve or cancel a refund with separation of duties",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### GET `/staff/support/enquiries/{supportId}/messages`

- Operation ID: `getStaffSupportEnquiriesBySupportIdMessages`
- Purpose: Poll new branch-authorized enquiry chat messages. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Poll new branch-authorized enquiry chat messages",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/support/enquiries/{supportId}/messages`

- Operation ID: `postStaffSupportEnquiriesBySupportIdMessages`
- Purpose: Add a customer-visible or internal enquiry message. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `message` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `visibility` | CUSTOMER / INTERNAL | No | Visibility validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "message": "synthetic-message",
  "visibility": "CUSTOMER"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Add a customer-visible or internal enquiry message",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/support/complaints/{supportId}/messages`

- Operation ID: `getStaffSupportComplaintsBySupportIdMessages`
- Purpose: Poll new branch-authorized complaint chat messages. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Poll new branch-authorized complaint chat messages",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/support/complaints/{supportId}/messages`

- Operation ID: `postStaffSupportComplaintsBySupportIdMessages`
- Purpose: Add a customer-visible or internal complaint message. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `message` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `visibility` | CUSTOMER / INTERNAL | No | Visibility validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "message": "synthetic-message",
  "visibility": "CUSTOMER"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Add a customer-visible or internal complaint message",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/support/enquiries`

- Operation ID: `getStaffSupportEnquiries`
- Purpose: List branch-authorized enquiries. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `branchId` | query | string (uuid) | No | Branch Id used to constrain this request. |
| `type` | query | GENERAL / PRODUCT / VEHICLE / SERVICE / BOOKING / QUOTATION | No | Type used to constrain this request. |
| `status` | query | OPEN / IN_PROGRESS / RESOLVED / CLOSED | No | Status used to constrain this request. |
| `assignedStaffId` | query | string (uuid) | No | Assigned Staff Id used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List branch-authorized enquiries",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/support/enquiries/{supportId}`

- Operation ID: `getStaffSupportEnquiriesBySupportId`
- Purpose: Get a branch-authorized enquiry. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get a branch-authorized enquiry",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/support/enquiries/{supportId}/assignment`

- Operation ID: `postStaffSupportEnquiriesBySupportIdAssignment`
- Purpose: Assign a branch-authorized enquiry. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer / null | Yes | Last server version observed by the client; stale writes are rejected. |
| `assignedStaffId` | string / null | Yes | Identifier of the assigned staff resource; ownership is resolved server-side. |

Synthetic request example:

```json
{
  "expectedVersion": "synthetic-expectedversion",
  "assignedStaffId": "00000000-0000-4000-8000-000000000001"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Assign a branch-authorized enquiry",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/support/enquiries/{supportId}/status`

- Operation ID: `postStaffSupportEnquiriesBySupportIdStatus`
- Purpose: Transition an enquiry. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer / null | Yes | Last server version observed by the client; stale writes are rejected. |
| `status` | IN_PROGRESS / RESOLVED / CLOSED | Yes | Requested or filtered lifecycle state from the documented enum. |
| `response` | string | No | Response validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "expectedVersion": "synthetic-expectedversion",
  "status": "IN_PROGRESS",
  "response": "synthetic-response"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Transition an enquiry",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/support/complaints`

- Operation ID: `getStaffSupportComplaints`
- Purpose: List branch-authorized complaints. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `branchId` | query | string (uuid) | No | Branch Id used to constrain this request. |
| `status` | query | OPEN / INVESTIGATING / RESOLVED / CLOSED | No | Status used to constrain this request. |
| `priority` | query | LOW / MEDIUM / HIGH / URGENT | No | Priority used to constrain this request. |
| `assignedStaffId` | query | string (uuid) | No | Assigned Staff Id used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List branch-authorized complaints",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/support/complaints/{supportId}`

- Operation ID: `getStaffSupportComplaintsBySupportId`
- Purpose: Get a branch-authorized complaint. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get a branch-authorized complaint",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/support/complaints/{supportId}/assignment`

- Operation ID: `postStaffSupportComplaintsBySupportIdAssignment`
- Purpose: Assign a branch-authorized complaint. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer / null | Yes | Last server version observed by the client; stale writes are rejected. |
| `assignedStaffId` | string / null | Yes | Identifier of the assigned staff resource; ownership is resolved server-side. |

Synthetic request example:

```json
{
  "expectedVersion": "synthetic-expectedversion",
  "assignedStaffId": "00000000-0000-4000-8000-000000000001"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Assign a branch-authorized complaint",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/support/complaints/{supportId}/status`

- Operation ID: `postStaffSupportComplaintsBySupportIdStatus`
- Purpose: Transition a complaint. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer / null | Yes | Last server version observed by the client; stale writes are rejected. |
| `status` | INVESTIGATING / RESOLVED / CLOSED | Yes | Requested or filtered lifecycle state from the documented enum. |
| `resolution` | string | No | Resolution validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "expectedVersion": "synthetic-expectedversion",
  "status": "INVESTIGATING",
  "resolution": "synthetic-resolution"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Transition a complaint",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/support/complaints/{supportId}/priority`

- Operation ID: `postStaffSupportComplaintsBySupportIdPriority`
- Purpose: Set complaint priority. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer / null | Yes | Last server version observed by the client; stale writes are rejected. |
| `priority` | LOW / MEDIUM / HIGH / URGENT | Yes | Priority validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "expectedVersion": "synthetic-expectedversion",
  "priority": "LOW"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Set complaint priority",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/support/reviews`

- Operation ID: `getStaffSupportReviews`
- Purpose: List reviews awaiting administrative moderation. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | PENDING / APPROVED / REJECTED | No | Status used to constrain this request. |
| `targetType` | query | BUSINESS / PRODUCT / SERVICE / ORDER / VEHICLE_TRANSACTION | No | Target Type used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List reviews awaiting administrative moderation",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/support/reviews/{reviewId}/moderation`

- Operation ID: `postStaffSupportReviewsByReviewIdModeration`
- Purpose: Approve or reject a review. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `reviewId` | path | string (uuid) | Yes | Identifier selecting the review resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer / null | Yes | Last server version observed by the client; stale writes are rejected. |
| `decision` | APPROVED / REJECTED | Yes | Decision validated by this operation's strict request contract. |
| `note` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "expectedVersion": "synthetic-expectedversion",
  "decision": "APPROVED",
  "note": "synthetic-note"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Approve or reject a review",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/notifications`

- Operation ID: `getStaffNotifications`
- Purpose: List own notifications. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `unreadOnly` | query | true / false | No | Unread Only used to constrain this request. |
| `type` | query | BOOKING / QUOTATION / WORK_ORDER / ORDER / PAYMENT / REFUND / DISPUTE / INSPECTION / VEHICLE_TRANSACTION / ENQUIRY / COMPLAINT / REVIEW / PROMOTION / SYSTEM | No | Type used to constrain this request. |
| `category` | query | SECURITY / TRANSACTIONAL / OPERATIONAL / MARKETING | No | Category used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own notifications",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/notifications/read-all`

- Operation ID: `postStaffNotificationsReadAll`
- Purpose: Mark all own notifications as read. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Mark all own notifications as read",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/notifications/{notificationId}/read`

- Operation ID: `postStaffNotificationsByNotificationIdRead`
- Purpose: Mark one owned notification as read. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `notificationId` | path | string (uuid) | Yes | Identifier selecting the notification resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Mark one owned notification as read",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/notifications/preferences/current`

- Operation ID: `getStaffNotificationsPreferencesCurrent`
- Purpose: Get mutable operational and marketing preferences. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get mutable operational and marketing preferences",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PUT `/staff/notifications/preferences/current`

- Operation ID: `putStaffNotificationsPreferencesCurrent`
- Purpose: Update one mutable notification preference. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `category` | OPERATIONAL / MARKETING | Yes | Category validated by this operation's strict request contract. |
| `channel` | EMAIL / SMS | Yes | Channel validated by this operation's strict request contract. |
| `enabled` | boolean | Yes | Enabled validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "category": "OPERATIONAL",
  "channel": "EMAIL",
  "enabled": true
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update one mutable notification preference",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/overview`

- Operation ID: `getStaffOverview`
- Purpose: Inclusive Africa/Lagos calendar range, maximum 90 days. Scope derives from the authenticated actor, with active-branch enforcement for STAFF. Booking/order/inspection/vehicle counts use creation dates; quotations use issue dates. Status breakdowns reflect current status. Administrator payment sums use succeededAt and verified settled attempts; refunds use processedAt. Currencies remain separate. Recent records are bounded previews, never the source of aggregate counts. Read role-scoped dashboard aggregates; financial totals are administrator-only. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `from` | query | string (date) | Yes | From used to constrain this request. |
| `to` | query | string (date) | Yes | To used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read role-scoped dashboard aggregates; financial totals are administrator-only",
  "data": {
    "scope": "CUSTOMER",
    "branch": {
      "id": "00000000-0000-4000-8000-000000000001",
      "name": "synthetic-name"
    },
    "range": {
      "from": "synthetic-from",
      "to": "synthetic-to",
      "timeZone": "Africa/Lagos"
    },
    "generatedAt": "2030-01-15T10:00:00.000Z",
    "counts": {
      "bookings": 0,
      "orders": 0,
      "quotations": 0,
      "inspections": 0,
      "vehicles": 0
    },
    "activity": [
      {
        "date": "2030-01-15T10:00:00.000Z",
        "bookings": 0,
        "orders": 0
      }
    ],
    "bookingStatuses": [
      {
        "status": "synthetic-status",
        "count": 0
      }
    ],
    "recentBookings": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "serviceName": "synthetic-servicename",
        "scheduledAt": "2030-01-15T10:00:00.000Z",
        "createdAt": "2030-01-15T10:00:00.000Z",
        "status": "synthetic-status"
      }
    ],
    "recentOrders": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "orderNumber": "synthetic-ordernumber",
        "createdAt": "2030-01-15T10:00:00.000Z",
        "status": "synthetic-status",
        "totalKobo": "300000",
        "currency": "NGN"
      }
    ]
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/finance-policy`

- Operation ID: `getStaffFinancePolicy`
- Purpose: Required duty: FINANCE_POLICY_APPROVE; SUPER_ADMIN may read without a grant. Capability is checked against the current active verified account on every action. Read the latest 100 financial policy versions for approval review. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read the latest 100 financial policy versions for approval review",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/privacy-requests`

- Operation ID: `getStaffPrivacyRequests`
- Purpose: Required duty: PRIVACY_REVIEW. Capability is checked against the current active verified account on every action. List privacy review queue. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List privacy review queue",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "userId": "00000000-0000-4000-8000-000000000001",
        "kind": "ANONYMIZATION",
        "reason": "synthetic-reason",
        "status": "REQUESTED",
        "createdAt": "2030-01-15T10:00:00.000Z",
        "reviewedAt": "2030-01-15T10:00:00.000Z",
        "reviewNote": "synthetic-reviewnote",
        "reviewedByUserId": "00000000-0000-4000-8000-000000000001"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/privacy-requests/{id}/review`

- Operation ID: `postStaffPrivacyRequestsByIdReview`
- Purpose: Required duty: PRIVACY_REVIEW. Capability is checked against the current active verified account on every action. Review a privacy request subject to retention and dispute holds; optional expectedReviewedAt rejects stale decisions. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `status` | UNDER_REVIEW / ON_HOLD / APPROVED_PENDING_POLICY / REJECTED | Yes | Requested or filtered lifecycle state from the documented enum. |
| `note` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `expectedReviewedAt` | string / null | No | ISO 8601 timestamp interpreted and validated by the server. |

Synthetic request example:

```json
{
  "status": "UNDER_REVIEW",
  "note": "synthetic-note",
  "expectedReviewedAt": "2030-01-15T10:00:00.000Z"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Review a privacy request subject to retention and dispute holds; optional expectedReviewedAt rejects stale decisions",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "userId": "00000000-0000-4000-8000-000000000001",
    "kind": "ANONYMIZATION",
    "reason": "synthetic-reason",
    "status": "REQUESTED",
    "createdAt": "2030-01-15T10:00:00.000Z",
    "reviewedAt": "2030-01-15T10:00:00.000Z",
    "reviewNote": "synthetic-reviewnote",
    "reviewedByUserId": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/retention-holds`

- Operation ID: `getStaffRetentionHolds`
- Purpose: Required duty: PRIVACY_REVIEW. Capability is checked against the current active verified account on every action. Read retention holds for one account. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `userId` | query | string (uuid) | Yes | User Id used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read retention holds for one account",
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "userId": "00000000-0000-4000-8000-000000000001",
      "recordType": "ALL",
      "recordId": "00000000-0000-4000-8000-000000000001",
      "reason": "synthetic-reason",
      "createdByUserId": "00000000-0000-4000-8000-000000000001",
      "createdAt": "2030-01-15T10:00:00.000Z",
      "releasedAt": "2030-01-15T10:00:00.000Z",
      "releasedByUserId": "00000000-0000-4000-8000-000000000001"
    }
  ],
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/retention-holds`

- Operation ID: `postStaffRetentionHolds`
- Purpose: Required duty: PRIVACY_REVIEW. Capability is checked against the current active verified account on every action. Record a legal or accounting retention hold. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `userId` | string (uuid) | Yes | Identifier of the user resource; ownership is resolved server-side. |
| `recordType` | ALL / ACCOUNT / PAYMENT / INVOICE / AUDIT / SUPPORT | Yes | Record Type validated by this operation's strict request contract. |
| `recordId` | string (uuid) | No | Identifier of the record resource; ownership is resolved server-side. |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "userId": "00000000-0000-4000-8000-000000000001",
  "recordType": "ALL",
  "recordId": "00000000-0000-4000-8000-000000000001",
  "reason": "synthetic-reason"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Record a legal or accounting retention hold",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "userId": "00000000-0000-4000-8000-000000000001",
    "recordType": "ALL",
    "recordId": "00000000-0000-4000-8000-000000000001",
    "reason": "synthetic-reason",
    "createdByUserId": "00000000-0000-4000-8000-000000000001",
    "createdAt": "2030-01-15T10:00:00.000Z",
    "releasedAt": "2030-01-15T10:00:00.000Z",
    "releasedByUserId": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/retention-holds/{id}/release`

- Operation ID: `postStaffRetentionHoldsByIdRelease`
- Purpose: Required duty: PRIVACY_REVIEW. Capability is checked against the current active verified account on every action. Release a hold with written justification; destruction stays disabled. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "reason": "synthetic-reason"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Release a hold with written justification; destruction stays disabled",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/orders/{id}/aftercare`

- Operation ID: `getStaffOrdersByIdAftercare`
- Purpose: Read latest 100 branch-authorized order review requests. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read latest 100 branch-authorized order review requests",
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "orderId": "00000000-0000-4000-8000-000000000001",
      "kind": "RETURN",
      "status": "REQUESTED",
      "reason": "synthetic-reason",
      "items": [
        {
          "orderItemId": "00000000-0000-4000-8000-000000000001",
          "quantity": 1
        }
      ],
      "requestedAt": "2030-01-15T10:00:00.000Z",
      "receivedAt": "2030-01-15T10:00:00.000Z",
      "inspectedAt": "2030-01-15T10:00:00.000Z",
      "goodCondition": "synthetic-goodcondition",
      "approvedFeeKobo": "300000",
      "reviewedAt": "2030-01-15T10:00:00.000Z",
      "reviewNote": "synthetic-reviewnote",
      "refundDueAt": "2030-01-15T10:00:00.000Z",
      "refundClockStatus": "synthetic-refundclockstatus",
      "customerId": "00000000-0000-4000-8000-000000000001",
      "reviewReason": "synthetic-reviewreason",
      "inspectedByUserId": "00000000-0000-4000-8000-000000000001",
      "inspectionNote": "synthetic-inspectionnote",
      "reviewedByUserId": "00000000-0000-4000-8000-000000000001"
    }
  ],
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/orders/{id}/fulfillment-evidence`

- Operation ID: `postStaffOrdersByIdFulfillmentEvidence`
- Purpose: Record delivery or collection evidence once. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `at` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |
| `reference` | string | Yes | Reference validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "at": "2030-01-15T10:00:00.000Z",
  "reference": "synthetic-reference"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Record delivery or collection evidence once",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "fulfillmentEvidenceAt": "2030-01-15T10:00:00.000Z",
    "fulfillmentEvidenceReference": "synthetic-fulfillmentevidencereference"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/order-requests/{id}/review`

- Operation ID: `postStaffOrderRequestsByIdReview`
- Purpose: Required duty: FINANCE_POLICY_APPROVE for APPROVED/REJECTED; branch-authorized staff for receipt/inspection. Capability is checked against the current active verified account on every action. Record receipt, inspection or fee decision; optional expectedStatus prevents stale stage review. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `stage` | RECEIVED / INSPECTED / APPROVED / REJECTED | Yes | Stage validated by this operation's strict request contract. |
| `note` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `goodCondition` | boolean | No | Good Condition validated by this operation's strict request contract. |
| `approvedFeeKobo` | string | No | Approved Fee Kobo validated by this operation's strict request contract. |
| `expectedStatus` | REQUESTED / RECEIVED / INSPECTED / APPROVED / REJECTED | No | Expected Status validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "stage": "RECEIVED",
  "note": "synthetic-note",
  "goodCondition": true,
  "approvedFeeKobo": "300000",
  "expectedStatus": "REQUESTED"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Record receipt, inspection or fee decision; optional expectedStatus prevents stale stage review",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "orderId": "00000000-0000-4000-8000-000000000001",
    "kind": "RETURN",
    "status": "REQUESTED",
    "reason": "synthetic-reason",
    "items": [
      {
        "orderItemId": "00000000-0000-4000-8000-000000000001",
        "quantity": 1
      }
    ],
    "requestedAt": "2030-01-15T10:00:00.000Z",
    "receivedAt": "2030-01-15T10:00:00.000Z",
    "inspectedAt": "2030-01-15T10:00:00.000Z",
    "goodCondition": "synthetic-goodcondition",
    "approvedFeeKobo": "300000",
    "reviewedAt": "2030-01-15T10:00:00.000Z",
    "reviewNote": "synthetic-reviewnote",
    "refundDueAt": "2030-01-15T10:00:00.000Z",
    "refundClockStatus": "synthetic-refundclockstatus",
    "customerId": "00000000-0000-4000-8000-000000000001",
    "reviewReason": "synthetic-reviewreason",
    "inspectedByUserId": "00000000-0000-4000-8000-000000000001",
    "inspectionNote": "synthetic-inspectionnote",
    "reviewedByUserId": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/support/complaints/{supportId}/acknowledge`

- Operation ID: `postStaffSupportComplaintsBySupportIdAcknowledge`
- Purpose: Acknowledge a complaint with a customer-visible message without resolving it. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `supportId` | path | string (uuid) | Yes | Identifier selecting the support resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `message` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "message": "synthetic-message"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Acknowledge a complaint with a customer-visible message without resolving it",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/refunds/{refundId}/decision`

- Operation ID: `postStaffRefundsByRefundIdDecision`
- Purpose: Required duty: REFUND_APPROVE. Capability is checked against the current active verified account on every action. Independently approve or reject a refund; approval is not payment. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `refundId` | path | string (uuid) | Yes | Identifier selecting the refund resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `decision` | APPROVED / CANCELLED | Yes | Decision validated by this operation's strict request contract. |
| `note` | string | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "decision": "APPROVED",
  "note": "synthetic-note"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Independently approve or reject a refund; approval is not payment",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "refundNumber": "synthetic-refundnumber",
    "paymentAttemptId": "00000000-0000-4000-8000-000000000001",
    "paymentAttempt": {
      "provider": "MANUAL"
    },
    "requestedByUserId": "00000000-0000-4000-8000-000000000001",
    "approvedByUserId": "00000000-0000-4000-8000-000000000001",
    "providerRefundId": "synthetic-providerrefundid",
    "authorizationKind": "synthetic-authorizationkind",
    "policyVersionId": "00000000-0000-4000-8000-000000000001",
    "dueAt": "2030-01-15T10:00:00.000Z",
    "clockStatus": "synthetic-clockstatus",
    "transferredByUserId": "00000000-0000-4000-8000-000000000001",
    "transferRecordedAt": "2030-01-15T10:00:00.000Z",
    "bankTransferAt": "2030-01-15T10:00:00.000Z",
    "checkedByUserId": "00000000-0000-4000-8000-000000000001",
    "checkedAt": "2030-01-15T10:00:00.000Z",
    "amountKobo": "300000",
    "currency": "NGN",
    "status": "REQUESTED",
    "reason": "synthetic-reason",
    "providerStatus": "synthetic-providerstatus",
    "failureCode": "synthetic-failurecode",
    "requestedAt": "2030-01-15T10:00:00.000Z",
    "approvedAt": "2030-01-15T10:00:00.000Z",
    "processedAt": "2030-01-15T10:00:00.000Z",
    "failedAt": "2030-01-15T10:00:00.000Z",
    "updatedAt": "2030-01-15T10:00:00.000Z"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/refunds`

- Operation ID: `getStaffRefunds`
- Purpose: Required duty: Any of REFUND_APPROVE, REFUND_TRANSFER, REFUND_CHECK; company-scoped grants, queue limited to the granted stage. Capability is checked against the current active verified account on every action. Read refunds relevant to an active refund approval, transfer or checking grant; no private evidence or beneficiary details. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | REQUESTED / APPROVED / PENDING / PROCESSING / NEEDS_ATTENTION / SUCCEEDED / FAILED / CANCELLED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read refunds relevant to an active refund approval, transfer or checking grant; no private evidence or beneficiary details",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "refundNumber": "synthetic-refundnumber",
        "paymentAttemptId": "00000000-0000-4000-8000-000000000001",
        "paymentAttempt": {
          "provider": "MANUAL"
        },
        "requestedByUserId": "00000000-0000-4000-8000-000000000001",
        "approvedByUserId": "00000000-0000-4000-8000-000000000001",
        "providerRefundId": "synthetic-providerrefundid",
        "authorizationKind": "synthetic-authorizationkind",
        "policyVersionId": "00000000-0000-4000-8000-000000000001",
        "dueAt": "2030-01-15T10:00:00.000Z",
        "clockStatus": "synthetic-clockstatus",
        "transferredByUserId": "00000000-0000-4000-8000-000000000001",
        "transferRecordedAt": "2030-01-15T10:00:00.000Z",
        "bankTransferAt": "2030-01-15T10:00:00.000Z",
        "checkedByUserId": "00000000-0000-4000-8000-000000000001",
        "checkedAt": "2030-01-15T10:00:00.000Z",
        "amountKobo": "300000",
        "currency": "NGN",
        "status": "REQUESTED",
        "reason": "synthetic-reason",
        "providerStatus": "synthetic-providerstatus",
        "failureCode": "synthetic-failurecode",
        "requestedAt": "2030-01-15T10:00:00.000Z",
        "approvedAt": "2030-01-15T10:00:00.000Z",
        "processedAt": "2030-01-15T10:00:00.000Z",
        "failedAt": "2030-01-15T10:00:00.000Z",
        "updatedAt": "2030-01-15T10:00:00.000Z"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/refunds/{refundId}/evidence-upload`

- Operation ID: `postStaffRefundsByRefundIdEvidenceUpload`
- Purpose: Required duty: REFUND_TRANSFER. Capability is checked against the current active verified account on every action. Issue a private bank-transfer evidence upload. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `refundId` | path | string (uuid) | Yes | Identifier selecting the refund resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `mimeType` | application/pdf / image/jpeg / image/png | Yes | Mime Type validated by this operation's strict request contract. |
| `sizeBytes` | integer | Yes | Size Bytes validated by this operation's strict request contract. |
| `checksumSha256` | string | Yes | Checksum Sha256 validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "mimeType": "application/pdf",
  "sizeBytes": 1,
  "checksumSha256": "synthetic-checksumsha256"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Issue a private bank-transfer evidence upload",
  "data": {
    "evidenceToken": "synthetic-token-value-not-a-real-secret",
    "upload": {
      "method": "PUT",
      "url": "https://example.test/continue",
      "expiresAt": "2030-01-15T10:00:00.000Z",
      "headers": {}
    }
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/refunds/{refundId}/transfer`

- Operation ID: `postStaffRefundsByRefundIdTransfer`
- Purpose: Required duty: REFUND_TRANSFER. Capability is checked against the current active verified account on every action. Record an independent bank transfer and verified private evidence. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `refundId` | path | string (uuid) | Yes | Identifier selecting the refund resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `bankReference` | string | Yes | Bank Reference validated by this operation's strict request contract. |
| `transferredAt` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |
| `evidenceToken` | string | Yes | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `beneficiary` | object | Yes | Beneficiary validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "bankReference": "synthetic-bankreference",
  "transferredAt": "2030-01-15T10:00:00.000Z",
  "evidenceToken": "synthetic-token-value-not-a-real-secret",
  "beneficiary": {
    "bankName": "synthetic-bankname",
    "accountName": "synthetic-accountname",
    "accountNumber": "synthetic-accountnumber"
  }
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Record an independent bank transfer and verified private evidence",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status",
    "amountKobo": "300000",
    "bankReference": "synthetic-bankreference",
    "transferredAt": "2030-01-15T10:00:00.000Z",
    "transferredByUserId": "00000000-0000-4000-8000-000000000001",
    "checkedAt": "2030-01-15T10:00:00.000Z",
    "checkedByUserId": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/refunds/{refundId}/evidence-access`

- Operation ID: `postStaffRefundsByRefundIdEvidenceAccess`
- Purpose: Required duty: REFUND_CHECK. Capability is checked against the current active verified account on every action. Issue short-lived private evidence access with audit. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `refundId` | path | string (uuid) | Yes | Identifier selecting the refund resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |

Synthetic request example:

```json
{}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Issue short-lived private evidence access with audit",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "url": "https://example.test/continue",
    "amountKobo": "300000",
    "bankReference": "synthetic-bankreference",
    "transferredAt": "2030-01-15T10:00:00.000Z",
    "beneficiary": {
      "bankName": "synthetic-bankname",
      "accountName": "synthetic-accountname",
      "accountNumber": "synthetic-accountnumber"
    }
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/refunds/{refundId}/check`

- Operation ID: `postStaffRefundsByRefundIdCheck`
- Purpose: Required duty: REFUND_CHECK. Capability is checked against the current active verified account on every action. Independently check or dispute bank evidence before completion. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `refundId` | path | string (uuid) | Yes | Identifier selecting the refund resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `accepted` | boolean | Yes | Accepted validated by this operation's strict request contract. |
| `note` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `evidenceChecked` | true | Yes | Evidence Checked validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "accepted": true,
  "note": "synthetic-note",
  "evidenceChecked": true
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Independently check or dispute bank evidence before completion",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status",
    "amountKobo": "300000",
    "bankReference": "synthetic-bankreference",
    "transferredAt": "2030-01-15T10:00:00.000Z",
    "transferredByUserId": "00000000-0000-4000-8000-000000000001",
    "checkedAt": "2030-01-15T10:00:00.000Z",
    "checkedByUserId": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/staff/disputes`

- Operation ID: `getStaffDisputes`
- Purpose: Required duty: DISPUTE_MANAGE. Capability is checked against the current active verified account on every action. List assigned disputes and authoritative provider deadlines. Access boundary: mfa-verified-staff. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `openOnly` | query | true / false | No | Open Only used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List assigned disputes and authoritative provider deadlines",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "paymentAttemptId": "00000000-0000-4000-8000-000000000001",
        "provider": "PAYSTACK",
        "providerDisputeId": "synthetic-providerdisputeid",
        "status": "AWAITING_RESPONSE",
        "category": "NOT_RECOGNIZED",
        "amountKobo": "300000",
        "currency": "NGN",
        "openedAt": "2030-01-15T10:00:00.000Z",
        "primaryUserId": "00000000-0000-4000-8000-000000000001",
        "backupUserId": "00000000-0000-4000-8000-000000000001",
        "primaryOperator": {
          "id": "00000000-0000-4000-8000-000000000001",
          "label": "synthetic-label"
        },
        "backupOperator": {
          "id": "00000000-0000-4000-8000-000000000001",
          "label": "synthetic-label"
        },
        "responseDueAt": "2030-01-15T10:00:00.000Z",
        "acknowledgedAt": "2030-01-15T10:00:00.000Z",
        "acknowledgedByUserId": "00000000-0000-4000-8000-000000000001",
        "acknowledgementDueAt": "2030-01-15T10:00:00.000Z",
        "respondedAt": "2030-01-15T10:00:00.000Z",
        "resolvedAt": "2030-01-15T10:00:00.000Z",
        "providerSubmissionReference": "synthetic-providersubmissionreference",
        "updatedAt": "2030-01-15T10:00:00.000Z",
        "hasEvidence": true
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/disputes/{id}/assign`

- Operation ID: `postStaffDisputesByIdAssign`
- Purpose: Required duty: DISPUTE_MANAGE; STAFF must be an assignee; assignment requires ADMIN or SUPER_ADMIN. Capability is checked against the current active verified account on every action. Assign two verified primary and backup accounts. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `primaryUserId` | string (uuid) | Yes | Identifier of the primary user resource; ownership is resolved server-side. |
| `backupUserId` | string (uuid) | Yes | Identifier of the backup user resource; ownership is resolved server-side. |
| `expectedUpdatedAt` | string (date-time) | No | ISO 8601 timestamp interpreted and validated by the server. |

Synthetic request example:

```json
{
  "primaryUserId": "00000000-0000-4000-8000-000000000001",
  "backupUserId": "00000000-0000-4000-8000-000000000001",
  "expectedUpdatedAt": "2030-01-15T10:00:00.000Z"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Assign two verified primary and backup accounts",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "paymentAttemptId": "00000000-0000-4000-8000-000000000001",
    "provider": "PAYSTACK",
    "providerDisputeId": "synthetic-providerdisputeid",
    "status": "AWAITING_RESPONSE",
    "category": "NOT_RECOGNIZED",
    "amountKobo": "300000",
    "currency": "NGN",
    "openedAt": "2030-01-15T10:00:00.000Z",
    "primaryUserId": "00000000-0000-4000-8000-000000000001",
    "backupUserId": "00000000-0000-4000-8000-000000000001",
    "primaryOperator": {
      "id": "00000000-0000-4000-8000-000000000001",
      "label": "synthetic-label"
    },
    "backupOperator": {
      "id": "00000000-0000-4000-8000-000000000001",
      "label": "synthetic-label"
    },
    "responseDueAt": "2030-01-15T10:00:00.000Z",
    "acknowledgedAt": "2030-01-15T10:00:00.000Z",
    "acknowledgedByUserId": "00000000-0000-4000-8000-000000000001",
    "acknowledgementDueAt": "2030-01-15T10:00:00.000Z",
    "respondedAt": "2030-01-15T10:00:00.000Z",
    "resolvedAt": "2030-01-15T10:00:00.000Z",
    "providerSubmissionReference": "synthetic-providersubmissionreference",
    "updatedAt": "2030-01-15T10:00:00.000Z",
    "hasEvidence": true
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/disputes/{id}/acknowledge`

- Operation ID: `postStaffDisputesByIdAcknowledge`
- Purpose: Required duty: DISPUTE_MANAGE; STAFF must be an assignee; assignment requires ADMIN or SUPER_ADMIN. Capability is checked against the current active verified account on every action. Record dispute acknowledgement separately from resolution. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `note` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `expectedUpdatedAt` | string (date-time) | No | ISO 8601 timestamp interpreted and validated by the server. |

Synthetic request example:

```json
{
  "note": "synthetic-note",
  "expectedUpdatedAt": "2030-01-15T10:00:00.000Z"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Record dispute acknowledgement separately from resolution",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "paymentAttemptId": "00000000-0000-4000-8000-000000000001",
    "provider": "PAYSTACK",
    "providerDisputeId": "synthetic-providerdisputeid",
    "status": "AWAITING_RESPONSE",
    "category": "NOT_RECOGNIZED",
    "amountKobo": "300000",
    "currency": "NGN",
    "openedAt": "2030-01-15T10:00:00.000Z",
    "primaryUserId": "00000000-0000-4000-8000-000000000001",
    "backupUserId": "00000000-0000-4000-8000-000000000001",
    "primaryOperator": {
      "id": "00000000-0000-4000-8000-000000000001",
      "label": "synthetic-label"
    },
    "backupOperator": {
      "id": "00000000-0000-4000-8000-000000000001",
      "label": "synthetic-label"
    },
    "responseDueAt": "2030-01-15T10:00:00.000Z",
    "acknowledgedAt": "2030-01-15T10:00:00.000Z",
    "acknowledgedByUserId": "00000000-0000-4000-8000-000000000001",
    "acknowledgementDueAt": "2030-01-15T10:00:00.000Z",
    "respondedAt": "2030-01-15T10:00:00.000Z",
    "resolvedAt": "2030-01-15T10:00:00.000Z",
    "providerSubmissionReference": "synthetic-providersubmissionreference",
    "updatedAt": "2030-01-15T10:00:00.000Z",
    "hasEvidence": true
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/disputes/{id}/evidence-upload`

- Operation ID: `postStaffDisputesByIdEvidenceUpload`
- Purpose: Required duty: DISPUTE_MANAGE; STAFF must be an assignee; assignment requires ADMIN or SUPER_ADMIN. Capability is checked against the current active verified account on every action. Issue a private dispute evidence upload. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `mimeType` | application/pdf / image/jpeg / image/png | Yes | Mime Type validated by this operation's strict request contract. |
| `sizeBytes` | integer | Yes | Size Bytes validated by this operation's strict request contract. |
| `checksumSha256` | string | Yes | Checksum Sha256 validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "mimeType": "application/pdf",
  "sizeBytes": 1,
  "checksumSha256": "synthetic-checksumsha256"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Issue a private dispute evidence upload",
  "data": {
    "evidenceToken": "synthetic-token-value-not-a-real-secret",
    "upload": {
      "method": "PUT",
      "url": "https://example.test/continue",
      "expiresAt": "2030-01-15T10:00:00.000Z",
      "headers": {}
    }
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/disputes/{id}/evidence`

- Operation ID: `postStaffDisputesByIdEvidence`
- Purpose: Required duty: DISPUTE_MANAGE; STAFF must be an assignee; assignment requires ADMIN or SUPER_ADMIN. Capability is checked against the current active verified account on every action. Verify and preserve the dispute evidence bundle. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `evidenceToken` | string | Yes | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `invoice` | true | Yes | Invoice validated by this operation's strict request contract. |
| `fulfillmentOrHandoverProof` | true | Yes | Fulfillment Or Handover Proof validated by this operation's strict request contract. |
| `relevantCustomerMessages` | true | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `note` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `expectedUpdatedAt` | string (date-time) | No | ISO 8601 timestamp interpreted and validated by the server. |

Synthetic request example:

```json
{
  "evidenceToken": "synthetic-token-value-not-a-real-secret",
  "invoice": true,
  "fulfillmentOrHandoverProof": true,
  "relevantCustomerMessages": true,
  "note": "synthetic-note",
  "expectedUpdatedAt": "2030-01-15T10:00:00.000Z"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Verify and preserve the dispute evidence bundle",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "paymentAttemptId": "00000000-0000-4000-8000-000000000001",
    "provider": "PAYSTACK",
    "providerDisputeId": "synthetic-providerdisputeid",
    "status": "AWAITING_RESPONSE",
    "category": "NOT_RECOGNIZED",
    "amountKobo": "300000",
    "currency": "NGN",
    "openedAt": "2030-01-15T10:00:00.000Z",
    "primaryUserId": "00000000-0000-4000-8000-000000000001",
    "backupUserId": "00000000-0000-4000-8000-000000000001",
    "primaryOperator": {
      "id": "00000000-0000-4000-8000-000000000001",
      "label": "synthetic-label"
    },
    "backupOperator": {
      "id": "00000000-0000-4000-8000-000000000001",
      "label": "synthetic-label"
    },
    "responseDueAt": "2030-01-15T10:00:00.000Z",
    "acknowledgedAt": "2030-01-15T10:00:00.000Z",
    "acknowledgedByUserId": "00000000-0000-4000-8000-000000000001",
    "acknowledgementDueAt": "2030-01-15T10:00:00.000Z",
    "respondedAt": "2030-01-15T10:00:00.000Z",
    "resolvedAt": "2030-01-15T10:00:00.000Z",
    "providerSubmissionReference": "synthetic-providersubmissionreference",
    "updatedAt": "2030-01-15T10:00:00.000Z",
    "hasEvidence": true
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/disputes/{id}/evidence-access`

- Operation ID: `postStaffDisputesByIdEvidenceAccess`
- Purpose: Required duty: DISPUTE_MANAGE; STAFF must be an assignee; assignment requires ADMIN or SUPER_ADMIN. Capability is checked against the current active verified account on every action. Issue audited short-lived dispute evidence access. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |

Synthetic request example:

```json
{}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Issue audited short-lived dispute evidence access",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "url": "https://example.test/continue"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/staff/disputes/{id}/submission`

- Operation ID: `postStaffDisputesByIdSubmission`
- Purpose: Required duty: DISPUTE_MANAGE; STAFF must be an assignee; assignment requires ADMIN or SUPER_ADMIN. Capability is checked against the current active verified account on every action. Record a provider dashboard submission receipt without claiming acceptance. Access boundary: mfa-verified-staff. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `providerSubmissionReference` | string | Yes | Provider Submission Reference validated by this operation's strict request contract. |
| `submittedAt` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |
| `note` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |
| `expectedUpdatedAt` | string (date-time) | No | ISO 8601 timestamp interpreted and validated by the server. |

Synthetic request example:

```json
{
  "providerSubmissionReference": "synthetic-providersubmissionreference",
  "submittedAt": "2030-01-15T10:00:00.000Z",
  "note": "synthetic-note",
  "expectedUpdatedAt": "2030-01-15T10:00:00.000Z"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Record a provider dashboard submission receipt without claiming acceptance",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "paymentAttemptId": "00000000-0000-4000-8000-000000000001",
    "provider": "PAYSTACK",
    "providerDisputeId": "synthetic-providerdisputeid",
    "status": "AWAITING_RESPONSE",
    "category": "NOT_RECOGNIZED",
    "amountKobo": "300000",
    "currency": "NGN",
    "openedAt": "2030-01-15T10:00:00.000Z",
    "primaryUserId": "00000000-0000-4000-8000-000000000001",
    "backupUserId": "00000000-0000-4000-8000-000000000001",
    "primaryOperator": {
      "id": "00000000-0000-4000-8000-000000000001",
      "label": "synthetic-label"
    },
    "backupOperator": {
      "id": "00000000-0000-4000-8000-000000000001",
      "label": "synthetic-label"
    },
    "responseDueAt": "2030-01-15T10:00:00.000Z",
    "acknowledgedAt": "2030-01-15T10:00:00.000Z",
    "acknowledgedByUserId": "00000000-0000-4000-8000-000000000001",
    "acknowledgementDueAt": "2030-01-15T10:00:00.000Z",
    "respondedAt": "2030-01-15T10:00:00.000Z",
    "resolvedAt": "2030-01-15T10:00:00.000Z",
    "providerSubmissionReference": "synthetic-providersubmissionreference",
    "updatedAt": "2030-01-15T10:00:00.000Z",
    "hasEvidence": true
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.


## Administration

### GET `/admin/branches`

- Operation ID: `getAdminBranches`
- Purpose: List branches. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `isActive` | query | true / false | No | Is Active used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List branches",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/branches`

- Operation ID: `postAdminBranches`
- Purpose: Create a branch. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `code` | string | Yes | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `name` | string | Yes | Name validated by this operation's strict request contract. |
| `phone` | string / null | No | Customer or business phone number in international format. |
| `email` | string / null | No | Normalized account email address. |
| `address` | string | Yes | Address validated by this operation's strict request contract. |
| `city` | string | Yes | City validated by this operation's strict request contract. |
| `state` | string | Yes | State validated by this operation's strict request contract. |
| `country` | Nigeria | No | Country validated by this operation's strict request contract. |
| `timezone` | string | No | ISO 8601 timestamp interpreted and validated by the server. |
| `isActive` | boolean | No | Boolean control for is active; authorization is still enforced server-side. |

Synthetic request example:

```json
{
  "code": "synthetic-code",
  "name": "synthetic-name",
  "address": "synthetic-address",
  "city": "synthetic-city",
  "state": "synthetic-state"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a branch",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/branches/{branchId}`

- Operation ID: `getAdminBranchesByBranchId`
- Purpose: Get a branch. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `branchId` | path | string (uuid) | Yes | Identifier selecting the branch resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get a branch",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/admin/branches/{branchId}`

- Operation ID: `patchAdminBranchesByBranchId`
- Purpose: Update a branch. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `branchId` | path | string (uuid) | Yes | Identifier selecting the branch resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `code` | string | No | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `name` | string | No | Name validated by this operation's strict request contract. |
| `phone` | string / null | No | Customer or business phone number in international format. |
| `email` | string / null | No | Normalized account email address. |
| `address` | string | No | Address validated by this operation's strict request contract. |
| `city` | string | No | City validated by this operation's strict request contract. |
| `state` | string | No | State validated by this operation's strict request contract. |
| `country` | Nigeria | No | Country validated by this operation's strict request contract. |
| `timezone` | string | No | ISO 8601 timestamp interpreted and validated by the server. |
| `isActive` | boolean | No | Boolean control for is active; authorization is still enforced server-side. |

Synthetic request example:

```json
{}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update a branch",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/staff`

- Operation ID: `getAdminStaff`
- Purpose: List privileged users. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `branchId` | query | string (uuid) | No | Branch Id used to constrain this request. |
| `role` | query | STAFF / ADMIN / SUPER_ADMIN | No | Role used to constrain this request. |
| `status` | query | ACTIVE / SUSPENDED / DEACTIVATED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List privileged users",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/staff/{staffUserId}`

- Operation ID: `getAdminStaffByStaffUserId`
- Purpose: Get a privileged user. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `staffUserId` | path | string (uuid) | Yes | Identifier selecting the staff user resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get a privileged user",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/staff/invitations`

- Operation ID: `getAdminStaffInvitations`
- Purpose: List own invitations or all invitations for the owner. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | PENDING / ACCEPTED / REVOKED / EXPIRED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List own invitations or all invitations for the owner",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/staff/invitations`

- Operation ID: `postAdminStaffInvitations`
- Purpose: Invite an existing verified staff account to ADMIN. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `email` | string (email) | Yes | Normalized account email address. |
| `role` | ADMIN | Yes | Role validated by this operation's strict request contract. |
| `currentPassword` | string | Yes | Sensitive password value sent only over HTTPS and never logged or persisted by the client. |

Synthetic request example:

```json
{
  "email": "customer@example.test",
  "role": "ADMIN",
  "currentPassword": "correct horse battery staple"
}
```

Success: HTTP 202.

```json
{
  "success": true,
  "message": "Invite an existing verified staff account to ADMIN",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/admin/staff/{staffUserId}/status`

- Operation ID: `patchAdminStaffByStaffUserIdStatus`
- Purpose: Change a privileged user status. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `staffUserId` | path | string (uuid) | Yes | Identifier selecting the staff user resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `status` | ACTIVE / SUSPENDED / DEACTIVATED | Yes | Requested or filtered lifecycle state from the documented enum. |

Synthetic request example:

```json
{
  "status": "ACTIVE"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Change a privileged user status",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/admin/staff/{staffUserId}/branch`

- Operation ID: `patchAdminStaffByStaffUserIdBranch`
- Purpose: Assign staff to an active branch. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `staffUserId` | path | string (uuid) | Yes | Identifier selecting the staff user resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `branchId` | string (uuid) | Yes | Identifier of the branch resource; ownership is resolved server-side. |

Synthetic request example:

```json
{
  "branchId": "00000000-0000-4000-8000-000000000001"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Assign staff to an active branch",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/admin/staff/{staffUserId}/role`

- Operation ID: `patchAdminStaffByStaffUserIdRole`
- Purpose: Super administrator demotion of ADMIN to branch STAFF only. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `staffUserId` | path | string (uuid) | Yes | Identifier selecting the staff user resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `role` | STAFF | Yes | Role validated by this operation's strict request contract. |
| `branchId` | string (uuid) | Yes | Identifier of the branch resource; ownership is resolved server-side. |

Synthetic request example:

```json
{
  "role": "STAFF",
  "branchId": "00000000-0000-4000-8000-000000000001"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Super administrator demotion of ADMIN to branch STAFF only",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/staff/candidates`

- Operation ID: `getAdminStaffCandidates`
- Purpose: Search active verified customers and staff by exact email. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `email` | query | string (email) | Yes | Email used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Search active verified customers and staff by exact email",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/staff/promotions`

- Operation ID: `postAdminStaffPromotions`
- Purpose: Promote an existing verified customer to branch staff. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `customerUserId` | string (uuid) | Yes | Identifier of the customer user resource; ownership is resolved server-side. |
| `branchId` | string (uuid) | Yes | Identifier of the branch resource; ownership is resolved server-side. |
| `currentPassword` | string | Yes | Sensitive password value sent only over HTTPS and never logged or persisted by the client. |

Synthetic request example:

```json
{
  "customerUserId": "00000000-0000-4000-8000-000000000001",
  "branchId": "00000000-0000-4000-8000-000000000001",
  "currentPassword": "correct horse battery staple"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Promote an existing verified customer to branch staff",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/staff/invitations/{invitationId}/revoke`

- Operation ID: `postAdminStaffInvitationsByInvitationIdRevoke`
- Purpose: Revoke an unused authorized invitation. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `invitationId` | path | string (uuid) | Yes | Identifier selecting the invitation resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `currentPassword` | string | Yes | Sensitive password value sent only over HTTPS and never logged or persisted by the client. |

Synthetic request example:

```json
{
  "currentPassword": "correct horse battery staple"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Revoke an unused authorized invitation",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/catalog/categories`

- Operation ID: `getAdminCatalogCategories`
- Purpose: List all categories. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `isActive` | query | true / false | No | Is Active used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List all categories",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/catalog/categories`

- Operation ID: `postAdminCatalogCategories`
- Purpose: Create a category. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `name` | string | Yes | Name validated by this operation's strict request contract. |
| `slug` | string | Yes | Slug validated by this operation's strict request contract. |
| `description` | string / null | No | Description validated by this operation's strict request contract. |
| `isActive` | boolean | No | Boolean control for is active; authorization is still enforced server-side. |

Synthetic request example:

```json
{
  "name": "synthetic-name",
  "slug": "synthetic-slug",
  "description": "synthetic-description",
  "isActive": true
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a category",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/admin/catalog/categories/{categoryId}`

- Operation ID: `patchAdminCatalogCategoriesByCategoryId`
- Purpose: Update a category. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `categoryId` | path | string (uuid) | Yes | Identifier selecting the category resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `name` | string | No | Name validated by this operation's strict request contract. |
| `slug` | string | No | Slug validated by this operation's strict request contract. |
| `description` | string / null | No | Description validated by this operation's strict request contract. |
| `isActive` | boolean | No | Boolean control for is active; authorization is still enforced server-side. |

Synthetic request example:

```json
{
  "name": "synthetic-name",
  "slug": "synthetic-slug",
  "description": "synthetic-description",
  "isActive": true
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update a category",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/catalog/products`

- Operation ID: `getAdminCatalogProducts`
- Purpose: List all products. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `categoryId` | query | string (uuid) | No | Category Id used to constrain this request. |
| `brand` | query | string | No | Brand used to constrain this request. |
| `search` | query | string | No | Search used to constrain this request. |
| `make` | query | string | No | Make used to constrain this request. |
| `model` | query | string | No | Model used to constrain this request. |
| `year` | query | integer | No | Year used to constrain this request. |
| `featured` | query | true / false | No | Featured used to constrain this request. |
| `sort` | query | newest / name / price_asc / price_desc | No | Sort used to constrain this request. |
| `isActive` | query | true / false | No | Is Active used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List all products",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/catalog/products`

- Operation ID: `postAdminCatalogProducts`
- Purpose: Create a product. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `categoryId` | string (uuid) | Yes | Identifier of the category resource; ownership is resolved server-side. |
| `name` | string | Yes | Name validated by this operation's strict request contract. |
| `slug` | string | Yes | Slug validated by this operation's strict request contract. |
| `sku` | string | Yes | Sku validated by this operation's strict request contract. |
| `brand` | string / null | No | Brand validated by this operation's strict request contract. |
| `manufacturerPartNumber` | string / null | No | Manufacturer Part Number validated by this operation's strict request contract. |
| `description` | string / null | No | Description validated by this operation's strict request contract. |
| `priceKobo` | string | Yes | Integer price in Nigerian kobo; client-calculated values are never authoritative. |
| `compareAtPriceKobo` | string / null | No | Integer price in Nigerian kobo; client-calculated values are never authoritative. |
| `currency` | NGN | No | Currency validated by this operation's strict request contract. |
| `isActive` | boolean | No | Boolean control for is active; authorization is still enforced server-side. |
| `featured` | boolean | No | Featured validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "categoryId": "00000000-0000-4000-8000-000000000001",
  "name": "synthetic-name",
  "slug": "synthetic-slug",
  "sku": "synthetic-sku",
  "priceKobo": "300000"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a product",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/admin/catalog/products/{productId}`

- Operation ID: `patchAdminCatalogProductsByProductId`
- Purpose: Update a product. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `categoryId` | string (uuid) | No | Identifier of the category resource; ownership is resolved server-side. |
| `name` | string | No | Name validated by this operation's strict request contract. |
| `slug` | string | No | Slug validated by this operation's strict request contract. |
| `sku` | string | No | Sku validated by this operation's strict request contract. |
| `brand` | string / null | No | Brand validated by this operation's strict request contract. |
| `manufacturerPartNumber` | string / null | No | Manufacturer Part Number validated by this operation's strict request contract. |
| `description` | string / null | No | Description validated by this operation's strict request contract. |
| `priceKobo` | string | No | Integer price in Nigerian kobo; client-calculated values are never authoritative. |
| `compareAtPriceKobo` | string / null | No | Integer price in Nigerian kobo; client-calculated values are never authoritative. |
| `currency` | NGN | No | Currency validated by this operation's strict request contract. |
| `isActive` | boolean | No | Boolean control for is active; authorization is still enforced server-side. |
| `featured` | boolean | No | Featured validated by this operation's strict request contract. |

Synthetic request example:

```json
{}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update a product",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/catalog/products/{productId}/compatibilities`

- Operation ID: `postAdminCatalogProductsByProductIdCompatibilities`
- Purpose: Add compatibility. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `make` | string | Yes | Make validated by this operation's strict request contract. |
| `model` | string / null | No | Model validated by this operation's strict request contract. |
| `yearFrom` | integer / null | No | Year From validated by this operation's strict request contract. |
| `yearTo` | integer / null | No | Year To validated by this operation's strict request contract. |
| `notes` | string / null | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "make": "synthetic-make",
  "model": "synthetic-model",
  "yearFrom": "synthetic-yearfrom",
  "yearTo": "synthetic-yearto",
  "notes": "synthetic-notes"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Add compatibility",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/admin/catalog/products/{productId}/compatibilities/{compatibilityId}`

- Operation ID: `patchAdminCatalogProductsByProductIdCompatibilitiesByCompatibilityId`
- Purpose: Update compatibility. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |
| `compatibilityId` | path | string (uuid) | Yes | Identifier selecting the compatibility resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `make` | string | No | Make validated by this operation's strict request contract. |
| `model` | string / null | No | Model validated by this operation's strict request contract. |
| `yearFrom` | integer / null | No | Year From validated by this operation's strict request contract. |
| `yearTo` | integer / null | No | Year To validated by this operation's strict request contract. |
| `notes` | string / null | No | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "make": "synthetic-make",
  "model": "synthetic-model",
  "yearFrom": "synthetic-yearfrom",
  "yearTo": "synthetic-yearto",
  "notes": "synthetic-notes"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update compatibility",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### DELETE `/admin/catalog/products/{productId}/compatibilities/{compatibilityId}`

- Operation ID: `deleteAdminCatalogProductsByProductIdCompatibilitiesByCompatibilityId`
- Purpose: Delete compatibility. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |
| `compatibilityId` | path | string (uuid) | Yes | Identifier selecting the compatibility resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Delete compatibility",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/catalog/products/{productId}/images`

- Operation ID: `postAdminCatalogProductsByProductIdImages`
- Purpose: Add product image. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `url` | string (uri) | Yes | HTTPS location validated against the operation's server-side allowlist. |
| `altText` | string / null | No | Alt Text validated by this operation's strict request contract. |
| `sortOrder` | integer | No | Sort Order validated by this operation's strict request contract. |
| `isPrimary` | boolean | No | Boolean control for is primary; authorization is still enforced server-side. |

Synthetic request example:

```json
{
  "url": "https://example.test/continue",
  "altText": "synthetic-alttext",
  "sortOrder": 0,
  "isPrimary": true
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Add product image",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/admin/catalog/products/{productId}/images/{imageId}`

- Operation ID: `patchAdminCatalogProductsByProductIdImagesByImageId`
- Purpose: Update product image. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |
| `imageId` | path | string (uuid) | Yes | Identifier selecting the image resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `url` | string (uri) | No | HTTPS location validated against the operation's server-side allowlist. |
| `altText` | string / null | No | Alt Text validated by this operation's strict request contract. |
| `sortOrder` | integer | No | Sort Order validated by this operation's strict request contract. |
| `isPrimary` | boolean | No | Boolean control for is primary; authorization is still enforced server-side. |

Synthetic request example:

```json
{
  "url": "https://example.test/continue",
  "altText": "synthetic-alttext",
  "sortOrder": 0,
  "isPrimary": true
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update product image",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### DELETE `/admin/catalog/products/{productId}/images/{imageId}`

- Operation ID: `deleteAdminCatalogProductsByProductIdImagesByImageId`
- Purpose: Delete product image. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `productId` | path | string (uuid) | Yes | Identifier selecting the product resource. |
| `imageId` | path | string (uuid) | Yes | Identifier selecting the image resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Delete product image",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/inventory`

- Operation ID: `postAdminInventory`
- Purpose: Create a branch inventory record. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `productId` | string (uuid) | Yes | Identifier of the product resource; ownership is resolved server-side. |
| `branchId` | string (uuid) | Yes | Identifier of the branch resource; ownership is resolved server-side. |
| `reorderLevel` | integer | No | Reorder Level validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "productId": "00000000-0000-4000-8000-000000000001",
  "branchId": "00000000-0000-4000-8000-000000000001",
  "reorderLevel": 0
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a branch inventory record",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/services`

- Operation ID: `getAdminServices`
- Purpose: List all services. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `pricingType` | query | FIXED / QUOTE_REQUIRED | No | Pricing Type used to constrain this request. |
| `isActive` | query | true / false | No | Is Active used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List all services",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/services`

- Operation ID: `postAdminServices`
- Purpose: Create a service. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. Requires an Idempotency-Key; a key may only be replayed with the identical request.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Required in `Idempotency-Key`

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |
| `idempotency-key` | header | string | Yes | Unique retry key for this logical mutation. Reuse it only with the identical request. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `name` | string | Yes | Name validated by this operation's strict request contract. |
| `slug` | string | Yes | Slug validated by this operation's strict request contract. |
| `description` | string / null | No | Description validated by this operation's strict request contract. |
| `shortDescription` | string / null | No | Short Description validated by this operation's strict request contract. |
| `pricingType` | FIXED / QUOTE_REQUIRED | Yes | Pricing Type validated by this operation's strict request contract. |
| `priceKobo` | string / null | Yes | Integer price in Nigerian kobo; client-calculated values are never authoritative. |
| `currency` | NGN | No | Currency validated by this operation's strict request contract. |
| `durationMinutes` | integer | Yes | Duration Minutes validated by this operation's strict request contract. |
| `isActive` | boolean | No | Boolean control for is active; authorization is still enforced server-side. |

Synthetic request example:

```json
{
  "name": "synthetic-name",
  "slug": "synthetic-slug",
  "pricingType": "FIXED",
  "priceKobo": "300000",
  "durationMinutes": 15
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a service",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/admin/services/{serviceId}`

- Operation ID: `patchAdminServicesByServiceId`
- Purpose: Update a service using optimistic concurrency. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `serviceId` | path | string (uuid) | Yes | Identifier selecting the service resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `name` | string | No | Name validated by this operation's strict request contract. |
| `slug` | string | No | Slug validated by this operation's strict request contract. |
| `description` | string / null | No | Description validated by this operation's strict request contract. |
| `shortDescription` | string / null | No | Short Description validated by this operation's strict request contract. |
| `pricingType` | FIXED / QUOTE_REQUIRED | No | Pricing Type validated by this operation's strict request contract. |
| `priceKobo` | string / null | No | Integer price in Nigerian kobo; client-calculated values are never authoritative. |
| `currency` | NGN | No | Currency validated by this operation's strict request contract. |
| `durationMinutes` | integer | No | Duration Minutes validated by this operation's strict request contract. |
| `isActive` | boolean | No | Boolean control for is active; authorization is still enforced server-side. |

Synthetic request example:

```json
{
  "expectedVersion": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update a service using optimistic concurrency",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/orders/expire`

- Operation ID: `postAdminOrdersExpire`
- Purpose: Expire due pending orders. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `limit` | integer | No | Maximum page size, subject to the documented server bound. |

Synthetic request example:

```json
{
  "limit": 1
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Expire due pending orders",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/promotions`

- Operation ID: `getAdminPromotions`
- Purpose: List promotions. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `isActive` | query | true / false | No | Is Active used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List promotions",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/promotions`

- Operation ID: `postAdminPromotions`
- Purpose: Create a promotion. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `name` | string | Yes | Name validated by this operation's strict request contract. |
| `code` | string / null | No | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `description` | string / null | No | Description validated by this operation's strict request contract. |
| `discountType` | PERCENTAGE / FIXED_AMOUNT | Yes | Discount Type validated by this operation's strict request contract. |
| `percentageBasisPoints` | integer / null | No | Percentage Basis Points validated by this operation's strict request contract. |
| `fixedAmountKobo` | string / null | No | Integer amount in Nigerian kobo; the server remains authoritative. |
| `minimumOrderAmountKobo` | string / null | No | Integer amount in Nigerian kobo; the server remains authoritative. |
| `maximumDiscountAmountKobo` | string / null | No | Integer amount in Nigerian kobo; the server remains authoritative. |
| `usageLimit` | integer / null | No | Usage Limit validated by this operation's strict request contract. |
| `perCustomerLimit` | integer / null | No | Per Customer Limit validated by this operation's strict request contract. |
| `startsAt` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |
| `endsAt` | string (date-time) | Yes | ISO 8601 timestamp interpreted and validated by the server. |
| `isActive` | boolean | No | Boolean control for is active; authorization is still enforced server-side. |

Synthetic request example:

```json
{
  "name": "synthetic-name",
  "discountType": "PERCENTAGE",
  "startsAt": "2030-01-15T10:00:00.000Z",
  "endsAt": "2030-01-15T10:00:00.000Z"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Create a promotion",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/promotions/{promotionId}`

- Operation ID: `getAdminPromotionsByPromotionId`
- Purpose: Get a promotion. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `promotionId` | path | string (uuid) | Yes | Identifier selecting the promotion resource. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Get a promotion",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### PATCH `/admin/promotions/{promotionId}`

- Operation ID: `patchAdminPromotionsByPromotionId`
- Purpose: Update a promotion. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `promotionId` | path | string (uuid) | Yes | Identifier selecting the promotion resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedVersion` | integer | Yes | Last server version observed by the client; stale writes are rejected. |
| `name` | string | No | Name validated by this operation's strict request contract. |
| `code` | string / null | No | Sensitive single-purpose value; submit once and never log or persist it in browser storage. |
| `description` | string / null | No | Description validated by this operation's strict request contract. |
| `discountType` | PERCENTAGE / FIXED_AMOUNT | No | Discount Type validated by this operation's strict request contract. |
| `percentageBasisPoints` | integer / null | No | Percentage Basis Points validated by this operation's strict request contract. |
| `fixedAmountKobo` | string / null | No | Integer amount in Nigerian kobo; the server remains authoritative. |
| `minimumOrderAmountKobo` | string / null | No | Integer amount in Nigerian kobo; the server remains authoritative. |
| `maximumDiscountAmountKobo` | string / null | No | Integer amount in Nigerian kobo; the server remains authoritative. |
| `usageLimit` | integer / null | No | Usage Limit validated by this operation's strict request contract. |
| `perCustomerLimit` | integer / null | No | Per Customer Limit validated by this operation's strict request contract. |
| `startsAt` | string (date-time) | No | ISO 8601 timestamp interpreted and validated by the server. |
| `endsAt` | string (date-time) | No | ISO 8601 timestamp interpreted and validated by the server. |
| `isActive` | boolean | No | Boolean control for is active; authorization is still enforced server-side. |

Synthetic request example:

```json
{
  "expectedVersion": 0
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Update a promotion",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/vehicle-transactions/expire`

- Operation ID: `postAdminVehicleTransactionsExpire`
- Purpose: Release expired vehicle reservations. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `limit` | integer | No | Maximum page size, subject to the documented server bound. |

Synthetic request example:

```json
{
  "limit": 1
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Release expired vehicle reservations",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/audit`

- Operation ID: `getAdminAudit`
- Purpose: Search append-only audit events. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `userId` | query | string (uuid) | No | User Id used to constrain this request. |
| `action` | query | CREATE / UPDATE / DELETE / READ / LOGIN / LOGOUT / PASSWORD_RESET / EMAIL_VERIFIED / MFA_ENABLED / MFA_DISABLED / SESSION_REVOKED / ROLE_CHANGE / ACCOUNT_SUSPENDED / ACCOUNT_DEACTIVATED / STATUS_CHANGE / INVENTORY_ADJUSTED / PAYMENT_INITIALIZED / PAYMENT_VERIFIED / MANUAL_PAYMENT_APPROVED / REFUND_REQUESTED / REFUND_APPROVED / PAYMENT_REFUNDED / DISPUTE_UPDATED / VEHICLE_RESERVED / VEHICLE_RELEASED / INVITATION_CREATED / INVITATION_ACCEPTED / BRANCH_ASSIGNED | No | Action used to constrain this request. |
| `entityType` | query | USER / BRANCH / PRIVILEGED_INVITATION / SESSION / MFA_FACTOR / CUSTOMER_PROFILE / STAFF_PROFILE / CUSTOMER_VEHICLE / SERVICE / BOOKING / QUOTE / WORK_ORDER / PRODUCT / INVENTORY / ORDER / PAYMENT / PAYMENT_ATTEMPT / REFUND / DISPUTE / VEHICLE / VEHICLE_LISTING / VEHICLE_TRANSACTION / INSPECTION / REVIEW / ENQUIRY / COMPLAINT / PROMOTION / INVOICE | No | Entity Type used to constrain this request. |
| `entityId` | query | string | No | Entity Id used to constrain this request. |
| `requestId` | query | string | No | Request Id used to constrain this request. |
| `from` | query | string (date-time) | No | From used to constrain this request. |
| `to` | query | string (date-time) | No | To used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Search append-only audit events",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/operations/status`

- Operation ID: `getAdminOperationsStatus`
- Purpose: Read queue and reconciliation status. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read queue and reconciliation status",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/operations/jobs`

- Operation ID: `getAdminOperationsJobs`
- Purpose: List failed or leased operational jobs. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `source` | query | OUTBOX / PAYMENT_WEBHOOK | No | Source used to constrain this request. |
| `status` | query | FAILED / DEAD_LETTER / PROCESSING | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List failed or leased operational jobs",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/operations/payment-anomalies`

- Operation ID: `getAdminOperationsPaymentAnomalies`
- Purpose: List payment anomalies. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | OPEN / INVESTIGATING / RESOLVED / IGNORED | No | Status used to constrain this request. |
| `type` | query | UNKNOWN_REFERENCE / AMOUNT_MISMATCH / CURRENCY_MISMATCH / DUPLICATE_SUCCESS / LATE_SUCCESS / REFUND_MISMATCH / WEBHOOK_REPLAY / OTHER | No | Type used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List payment anomalies",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/operations/payment-disputes`

- Operation ID: `getAdminOperationsPaymentDisputes`
- Purpose: List payment disputes without private evidence keys. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | AWAITING_RESPONSE / UNDER_REVIEW / WON / LOST / ACCEPTED / EXPIRED | No | Status used to constrain this request. |
| `category` | query | NOT_RECOGNIZED / FRAUD / NOT_RECEIVED / NOT_AS_DESCRIBED / DUPLICATE_CHARGE / REFUND_NOT_RECEIVED / OTHER | No | Category used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List payment disputes without private evidence keys",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/operations/payment-refunds`

- Operation ID: `getAdminOperationsPaymentRefunds`
- Purpose: List refunds requiring operational action. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `cursor` | query | string (uuid) | No | Opaque cursor returned by the preceding page. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |
| `status` | query | REQUESTED / APPROVED / PENDING / PROCESSING / NEEDS_ATTENTION / SUCCEEDED / FAILED / CANCELLED | No | Status used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "List refunds requiring operational action",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/operations/jobs/{source}/{jobId}/retry`

- Operation ID: `postAdminOperationsJobsBySourceByJobIdRetry`
- Purpose: Retry a failed job using optimistic attempt matching. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `source` | path | outbox / webhook | Yes | Identifier selecting the source resource. |
| `jobId` | path | string (uuid) | Yes | Identifier selecting the job resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedAttempts` | integer | Yes | Expected Attempts validated by this operation's strict request contract. |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "expectedAttempts": 1,
  "reason": "synthetic-reason"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Retry a failed job using optimistic attempt matching",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 Job state changed; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/operations/payment-anomalies/{anomalyId}/status`

- Operation ID: `postAdminOperationsPaymentAnomaliesByAnomalyIdStatus`
- Purpose: Transition a payment anomaly investigation. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `anomalyId` | path | string (uuid) | Yes | Identifier selecting the anomaly resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `expectedStatus` | OPEN / INVESTIGATING | Yes | Expected Status validated by this operation's strict request contract. |
| `status` | INVESTIGATING / RESOLVED / IGNORED | Yes | Requested or filtered lifecycle state from the documented enum. |
| `resolutionNote` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "expectedStatus": "OPEN",
  "status": "INVESTIGATING",
  "resolutionNote": "synthetic-resolutionnote"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Transition a payment anomaly investigation",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 Invalid or stale transition; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/policies`

- Operation ID: `getAdminPolicies`
- Purpose: Read immutable policy history. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `key` | query | string | Yes | Key used to constrain this request. |
| `limit` | query | integer | No | Maximum number of records to return, bounded by the API. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read immutable policy history",
  "data": {
    "items": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "status": "synthetic-status"
      }
    ],
    "nextCursor": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/policies`

- Operation ID: `postAdminPolicies`
- Purpose: Required duty: FINANCE_POLICY_APPROVE for FINANCE; SUPER_ADMIN for other policy kinds. Capability is checked against the current active verified account on every action. Publish an approved policy version with written provenance. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: STAFF, ADMIN, SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

Synthetic request example:

```json
{
  "expectedVersion": 0,
  "effectiveAt": "2030-01-15T10:00:00.000Z",
  "source": "synthetic-source",
  "approvalEvidence": "synthetic-approvalevidence",
  "kind": "BANK_REFUND_CLOCK",
  "settings": {
    "startEvent": "REQUESTED",
    "businessDays": 10,
    "countingConvention": "EXCLUDE_START_SAME_LOCAL_TIME",
    "bankingDays": [
      0
    ],
    "holidays": [
      "synthetic-holidays-item"
    ],
    "timezone": "Africa/Lagos"
  }
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Publish an approved policy version with written provenance",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### GET `/admin/capabilities`

- Operation ID: `getAdminCapabilities`
- Purpose: Read the latest 100 grants and revocations, or all active grants with activeOnly=true. Access boundary: mfa-verified-admin. Requires the opaque session cookie. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `userId` | query | string (uuid) | Yes | User Id used to constrain this request. |
| `activeOnly` | query | true / false | No | Active Only used to constrain this request. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Read the latest 100 grants and revocations, or all active grants with activeOnly=true",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/capabilities`

- Operation ID: `postAdminCapabilities`
- Purpose: Grant a narrow duty to a verified existing account. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `userId` | string (uuid) | Yes | Identifier of the user resource; ownership is resolved server-side. |
| `capability` | REFUND_APPROVE / REFUND_TRANSFER / REFUND_CHECK / FINANCE_POLICY_APPROVE / BOOKING_CONFIRM / PRIVACY_REVIEW / DISPUTE_MANAGE | Yes | Capability validated by this operation's strict request contract. |

Synthetic request example:

```json
{
  "userId": "00000000-0000-4000-8000-000000000001",
  "capability": "REFUND_APPROVE"
}
```

Success: HTTP 201.

```json
{
  "success": true,
  "message": "Grant a narrow duty to a verified existing account",
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "status": "synthetic-status"
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.

### POST `/admin/capabilities/{id}/revoke`

- Operation ID: `postAdminCapabilitiesByIdRevoke`
- Purpose: Revoke a duty immediately with an audit reason. Access boundary: mfa-verified-admin. Requires the opaque session cookie. Requires a current session-bound CSRF header. This operation has no idempotency-key contract.
- Roles: SUPER_ADMIN
- Authentication: Opaque session cookie
- CSRF: Required in `X-CSRF-Token`
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | Yes | Identifier selecting the id resource. |
| `x-csrf-token` | header | string | Yes | Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only. |

JSON request fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `reason` | string | Yes | Plain-text business context; HTML is not accepted or rendered as trusted markup. |

Synthetic request example:

```json
{
  "reason": "synthetic-reason"
}
```

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Revoke a duty immediately with an audit reason",
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 A valid session and required assurance are missing.; 403 The actor is not authorized for this resource or action.; 404 The requested resource is not available.; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.


## Payment webhooks

### POST `/webhooks/paystack`

- Operation ID: `postWebhooksPaystack`
- Purpose: Receive a signature-verified Paystack webhook. Access boundary: provider-webhook. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PAYMENT_PROVIDER
- Authentication: Provider signature plus authoritative verification
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `x-paystack-signature` | header | string | Yes | Provider-generated webhook signature verified against the exact raw request bytes. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Receive a signature-verified Paystack webhook",
  "data": {
    "attemptId": "00000000-0000-4000-8000-000000000001",
    "authorizationUrl": "https://example.test/continue",
    "authorizationExpiresAt": "2030-01-15T10:00:00.000Z",
    "replayed": true
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 Invalid signature; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.

### POST `/webhooks/monnify`

- Operation ID: `postWebhooksMonnify`
- Purpose: Receive a verified Monnify webhook. Access boundary: provider-webhook. Does not accept browser bearer tokens. No CSRF token is required. This operation has no idempotency-key contract.
- Roles: PAYMENT_PROVIDER
- Authentication: Provider signature plus authoritative verification
- CSRF: Not required
- Idempotency: Not required

Parameters:

| Parameter | Location | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| `monnify-signature` | header | string | No | Provider-generated webhook signature verified against the exact raw request bytes. |

Success: HTTP 200.

```json
{
  "success": true,
  "message": "Receive a verified Monnify webhook",
  "data": {
    "attemptId": "00000000-0000-4000-8000-000000000001",
    "authorizationUrl": "https://example.test/continue",
    "authorizationExpiresAt": "2030-01-15T10:00:00.000Z",
    "replayed": true
  },
  "meta": {
    "requestId": "req_0000000000000001"
  }
}
```

Relevant errors: 400 The request is malformed.; 401 Missing or invalid production signature; 409 The request conflicts with current state or idempotency.; 422 One or more request fields are invalid.; 429 The route-specific request limit was exceeded.; 500 An unexpected error occurred; no sensitive detail is disclosed.; 503 A required provider or database is temporarily unavailable.


## Operational


