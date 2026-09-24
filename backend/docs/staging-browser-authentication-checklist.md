> Historical phase document. Booking-deposit, provider-activation and readiness claims below are superseded by the signed 22 September owner decisions. Use [the current implementation matrix](owner-implementation-matrix.md) and [staging runbook](owner-staging-runbook.md).

# Staging browser-authentication checklist

Run this checklist only after the public discovery milestone is stable and the
identity email worker/test email provider are intentionally enabled. Use
synthetic accounts, Paystack test mode, and Monnify sandbox only.

## Preconditions

- [ ] The exact Vercel staging origin is the only `FRONTEND_URL` and WebAuthn
      origin, and its hostname is the WebAuthn RP ID.
- [ ] Vercel proxies `/api/v1/*` without changing the browser-visible origin.
- [ ] API rewrite caching is explicitly disabled for the whole prefix.
- [ ] Hosted Swagger/OpenAPI remain disabled and the private contract version
      matches the deployed commit.
- [ ] Staging email delivery, outbox worker, synthetic mailbox, and cleanup
      owner are approved.
- [ ] Browser developer tools preserve network requests but do not export logs
      containing credentials, cookies, tokens, or personal data.

## Session cookies

- [ ] Login is sent to the relative `/api/v1/auth/login` path with
      `credentials: "include"` and the exact staging `Origin`.
- [ ] The response sets `__Host-aat_session` with `Secure`, `HttpOnly`,
      `SameSite=Lax`, `Path=/`, and no `Domain` attribute.
- [ ] JavaScript cannot read the session cookie, and the cookie is not sent over
      HTTP or to sibling hosts.
- [ ] The cookie passes unchanged through Vercel and is returned on subsequent
      relative API requests.
- [ ] Login, MFA completion, password change, and sensitive recovery rotate the
      session; the previous value no longer authenticates.
- [ ] Logout clears/revokes the current session. Revoked, expired, idle-expired,
      suspended, and deactivated sessions fail with stable non-sensitive errors.

## CSRF and origin enforcement

- [ ] After login, `POST /api/v1/auth/csrf` with an empty JSON body and the exact
      trusted origin returns a CSRF token once; the token is held in memory, not
      local/session storage or logs.
- [ ] Every cookie-authenticated mutation sends that value in `X-CSRF-Token`
      with `credentials: "include"`.
- [ ] Missing, incorrect, stale, and replayed rotated CSRF values fail.
- [ ] Missing/foreign `Origin`, cross-site `Sec-Fetch-Site`, and forged direct
      requests fail, including when the session cookie is valid.
- [ ] Same-origin browser requests forwarded by Vercel retain `Origin` and
      `Sec-Fetch-Site: same-origin` as observed by Express.
- [ ] CORS never reflects arbitrary origins and credentialed responses use only
      the configured staging origin.

## Caching and browser storage

- [ ] Vercel does not cache login, session, CSRF, MFA, customer, staff, admin,
      payment, upload, or error responses.
- [ ] `x-vercel-cache`/observability confirms bypass for repeated API requests,
      including the public endpoints under the shared prefix.
- [ ] The service worker, framework data cache, browser storage, and client
      query cache do not persist passwords, raw tokens, CSRF values, recovery
      codes, MFA enrollment material, payment payloads, or private URLs.
- [ ] Back/forward navigation and page-source inspection do not reveal
      verification/reset tokens; links place them in URL fragments and the
      frontend submits them in POST bodies.

## Hosted checkout return handling

- [ ] Paystack and Monnify return only to the exact configured HTTPS frontend callback.
- [ ] The frontend accepts only same-origin post-checkout navigation and does not persist provider
      authorization URLs, references, or response parameters.
- [ ] A browser return is displayed as pending until the owned payment/attempt endpoint reports a
      server-verified state; query parameters never mark a booking, order, or vehicle as paid.
- [ ] Paystack and Monnify webhooks go directly to the stable App Platform API hostname, bypassing
      Vercel rewrites so exact raw bytes reach signature verification.

## Trusted proxy validation

Start with `TRUST_PROXY_HOPS=1`. Do not increase it from an architecture
diagram alone.

- [ ] Send controlled requests directly to App Platform and through Vercel.
- [ ] Record only the count/order and known provider classification of proxy
      hops; do not retain public client addresses in handoff artifacts.
- [ ] Confirm App Platform overwrites/appends forwarded headers and that a
      client-supplied `X-Forwarded-For`, `X-Forwarded-Proto`, or
      `X-Forwarded-Host` cannot become authoritative.
- [ ] Confirm `req.secure` is true for external HTTPS and host/origin checks see
      the staging frontend host where intended.
- [ ] Confirm rate limits distinguish synthetic clients as expected. If one-hop
      trust identifies only Vercel egress, establish Vercel's documented header
      behavior before proposing a narrowly scoped change.
- [ ] Any `TRUST_PROXY_HOPS` change receives security review and regression
      tests for spoofed forwarding headers, rate-limit bypass, cookie security,
      redirects, and audit IP handling.

## Functional negative paths

- [ ] Registration/forgot/resend responses do not enumerate account existence.
- [ ] Unverified users cannot log in; verification tokens are single-use and
      absent from URLs after the frontend consumes the fragment.
- [ ] Privileged users cannot access protected routes before MFA assurance.
- [ ] Session listing omits hashes, full IPs, and unrestricted user agents.
- [ ] Cross-customer, cross-branch, role escalation, IDOR, mass assignment,
      malformed JSON, oversized body, rate-limit, and unexpected-error tests
      fail closed without stack traces or secrets.
- [ ] Request IDs correlate browser, Vercel, App Platform, and redacted API logs.

## Completion evidence

Record the deployed commit and image digest, browsers tested, UTC test window,
reviewers, checklist result, and issue references. Do not attach HAR files,
screenshots, cookies, headers, email links, recovery codes, or provider payloads
unless they have been explicitly sanitized and independently reviewed.
