# Frontend integration handover

## Contract source and topology

Use the private OpenAPI artifact at `docs/api/allied-autotech.openapi.json`. Hosted Swagger and
hosted OpenAPI remain disabled in production mode. The frontend repository stays separate and needs
no database, Spaces, Paystack secret, or backend deployment credential.

Browser code must call relative `/api/v1/*` URLs. Vercel must internally rewrite that prefix to the
stable DigitalOcean App Platform origin without redirecting, stripping methods/bodies/cookies, or
caching API responses. Do not infer the teammate's framework setup from this repository.

## Integration order

1. Public health, branch list/detail, service list/detail.
2. Public categories/products/product detail, approved reviews, and vehicle listings.
3. Registration, email-link completion, login, session status, CSRF, logout, and recovery.
4. MFA enrollment/challenge and privileged pending-assurance screens where applicable.
5. Customer profile/vehicles, favourites, cart, collection checkout, orders, invoices, and payments.
6. Bookings, quotations, service work, vehicle enquiries/reservations/sales, and private assets.
7. Support enquiries/complaints/chat, rated reviews, and notification preferences.
8. Staff/admin operational screens only after role/MFA test accounts and authorization tests exist.

## Response, error, money, and time rules

- Success responses contain `success`, `message`, optional `data`, and `meta.requestId`.
- Errors contain a stable `error.code`; validation failures may contain field details. Display the
  safe message and retain `requestId` for support. Never display or infer server stack details.
- All monetary values are integer **kobo** and may be serialized as decimal strings. Never use
  floating-point naira for calculations; format only for display.
- Dates are ISO 8601 UTC strings. Convert to the user's locale only in presentation.
- List endpoints use bounded cursor pagination. Send only documented filters/sort values and treat
  cursors as opaque.
- Retry-sensitive mutations require `Idempotency-Key`; reuse the same key only for an identical
  request. Generate a new key when the user intentionally changes the request.

## Cookie session and CSRF lifecycle

1. Send requests with credentials enabled. In staging/production the backend sets the secure,
   `HttpOnly`, same-site `__Host-aat_session` cookie; JavaScript must never read it.
2. After login, inspect the response/session projection. An MFA-pending session may call only the MFA
   challenge and logout surfaces until assurance is complete.
3. Call `POST /api/v1/auth/csrf` when the application needs a mutation token. Store the returned token
   in memory, never local/session storage, logs, analytics, or URLs.
4. Send it as `X-CSRF-Token` on every authenticated POST/PUT/PATCH/DELETE. A CSRF rotation or session
   rotation invalidates the old token; fetch a new one.
5. On `401`, clear in-memory identity/CSRF state. On CSRF failure, fetch one replacement token and
   retry only if the operation is safe/idempotent.

Do not add an `Authorization: Bearer` header or JWT storage. The backend intentionally uses a random
opaque session cookie whose hash is held in PostgreSQL. `Origin`/Fetch Metadata and CSRF checks are
part of the design, not duplicate authentication.

## Email and recovery links

Verification, password-reset, and invitation links carry tokens in the URL **fragment**, not the
query string. The page reads the fragment locally, immediately removes it from browser history, and
submits the token in the documented POST body. Never send tokens to analytics, logs, referrers, or
third-party scripts. Registration/resend/recovery acknowledgements are deliberately generic.

## Reviews

`POST /api/v1/customers/support/reviews` always requires a 1–5 `rating`, a comment, CSRF, and an
authenticated customer:

- `BUSINESS`: overall Allied AutoTech experience; no transaction identifier.
- `PRODUCT`: `productId` plus the customer's completed `orderItemId`; one review per
  customer/product.
- `SERVICE`: `serviceId` plus the customer's completed `bookingId`.
- `ORDER`: the customer's completed `orderId`.
- `VEHICLE_TRANSACTION`: the customer's completed vehicle transaction ID.

Every submission starts `PENDING`. Show it in the customer's private list, but never publish it until
approved. Rejected reviews show the safe moderation note only to authorized/private views. Public
`GET /api/v1/public/support/reviews` accepts `targetType`; product and service pages may additionally
filter by their documented IDs. Public results never include customer identity/contact details.

## Customer-care chat

Authenticated customers create an enquiry or complaint and post follow-ups to its `/messages`
route with CSRF. Staff use the corresponding staff route and may mark a message `CUSTOMER` or
`INTERNAL`; customer responses can never receive internal notes.

For near-real-time UI:

1. Fetch `GET .../{supportId}/messages?limit=50`.
2. Render `data.items` in returned order and retain `data.cursor` as opaque state.
3. While the conversation is visible, repeat with `?cursor=<cursor>&limit=50` after
   `data.pollAfterMs` (currently 5000 ms).
4. If `hasMore` is true, fetch the next page immediately; otherwise wait for the poll interval.
5. Stop polling when the tab/thread is hidden, on logout, or when access returns `401/404`.

Chat GET responses are `private, no-store`; messages are append-only, capped in length, rate-limited
on writes, ownership/branch checked, and unavailable after a record is closed. Do not implement
optimistic messages as confirmed until the POST succeeds. The initial enquiry/complaint text remains
on the parent record; `/messages` contains follow-ups.

## Notifications

Use `/api/v1/customers/notifications` for the in-app inbox and its documented read/preferences
mutations. Security and transactional categories are mandatory. Operational preferences may be
changed; marketing must start disabled and requires explicit opt-in. Provider delivery can be
disabled while in-app records continue to work.

## Checkout and payment screens

- Recalculate nothing from display prices; send documented item/target identifiers and let the
  backend own price, discount, fee, amount, currency, and customer identity.
- Collection checkout is available. Delivery checkout is deliberately unavailable until zones and
  fees are approved; show a clear “collection currently available” state for a conflict response.
- A Paystack redirect is not proof of payment. Poll/read the backend payment/order state after return.
- Represent `REQUIRES_PAYMENT`, `PROCESSING`, `REQUIRES_REVIEW`, `SUCCEEDED`, `CANCELLED`, and
  `EXPIRED` distinctly. Do not turn “submitted manual evidence” into “paid”.
- A verified payment received after commitment expiry remains a captured payment plus an operations
  anomaly; the cancelled order/reservation is not revived. Tell the customer support will resolve it.
- Private evidence/documents use short-lived authorized upload/download instructions. Never expose
  or persist object keys.

## Vercel/browser acceptance

- Confirm `Set-Cookie`, `Cookie`, `Origin`, `Sec-Fetch-Site`, `X-CSRF-Token`, `Idempotency-Key`, and
  `X-Request-ID` survive the rewrite.
- Disable caching for every `/api/v1/*` response, not only authenticated paths.
- Confirm the exact staging origin is accepted and an unapproved origin is rejected.
- Test cookie flags, session/CSRF rotation, MFA pending access, logout, multi-tab behavior, malformed
  JSON, validation fields, throttling, and request-ID correlation in a real browser.
- Test chat polling under Vercel timeouts and verify no response or service-worker cache stores it.
- Validate the effective proxy hop count before changing `TRUST_PROXY_HOPS`.

## Known restrictions

- No live payments, marketing campaign, destructive retention, automatic offline-refund completion,
  or delivery checkout is approved.
- OAuth/Google/JWT are not part of the browser contract.
- WebSockets are not required; cursor polling is the supported staging chat transport.
- Business-policy blockers and proposed answers are tracked in `owner-decision-checklist.md`.
