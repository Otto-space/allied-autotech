# Native Authentication Design for Allied AutoTech Companion

**Status:** PROPOSED. Draft ADR and threat model. **Must not be merged or deployed without explicit human security review.**
**Intended location in the repo:** `docs/mobile/NATIVE_AUTH_DESIGN.md`
**Revision (after full-repo review):** the session token now travels in a dedicated `X-Device-Session` header, not `Authorization: Bearer`, because the staging perimeter gate already uses `Authorization: Basic` (section 5.6). Owner/security review must confirm this choice.
**Basis:** the full repository (`allied-autotech_3.zip`), confirmed by git to be at HEAD `80e95a386afeba3450cc5e66ed9afab421f52e65` (the audited commit; the working tree differs only in line endings and excluded media). I read `AGENTS.md`, the three CI workflows, the identity service and routes, `authenticate.ts`, `csrf.ts`, `cookies.ts`, `public-launch.ts`, `private-testing.ts`, `client-address.ts`, `rate-limits.ts`, `app.ts`, the env schema, the migration safety scripts, the `Session` and `PushSubscription` models, the frontend `next.config.ts`, `proxy.ts` and `public-capabilities.ts`, and the migration names on the open PR branches. I did **not** trace every one of the 85 `authenticate()` and 228 `requireCsrf` call sites, run any test, or see the deployed environment. Items marked **[VERIFIED]** come from that source; **[PROPOSED]** are design choices; **[CONFIRM]** must be checked before building.

---

## 1. The problem, as verified in source

| Fact | Evidence | Consequence for native |
|---|---|---|
| **[VERIFIED]** Sessions are opaque cookies (`__Host-aat_session` in production, `aat_session` otherwise). `authenticate()` reads only `req.cookies`. | `common/middleware/authenticate.ts`, `common/security/cookies.ts` | No Bearer path exists. A native client has no credential the server will accept. |
| **[VERIFIED]** Mutations require `X-CSRF-Token` **and** a trusted `Origin` (must be in `FRONTEND_URL`; `Sec-Fetch-Site`, if present, must be `same-origin`). A missing `Origin` is rejected. | `common/middleware/csrf.ts` | Native sends no `Origin`, so every authenticated write fails by design. |
| **[VERIFIED]** The **unauthenticated** auth routes are also guarded by `requireTrustedOrigin`: `/auth/register`, `/auth/login`, `/auth/email/verify`, `/auth/email/resend`, `/auth/password/forgot`, `/auth/password/reset`, `/auth/csrf`. | `modules/identity/identity.routes.ts` | A native app **cannot even register or log in** against today's backend. |
| **[VERIFIED]** Session rows are hashed server-side (`hashToken("session", raw)`), rotated in place on MFA completion and password change, capped by `MAX_ACTIVE_SESSIONS` (default 5), and revoked by password reset/change. Customer defaults: 7-day absolute TTL, 24-hour idle. | `identity.service.ts`, `config/env.ts` | Good machinery to reuse. Mobile sessions stored as `Session` rows inherit revocation, listing and audit. |
| **[VERIFIED]** MFA is required for staff/admin always, and for customers **only if they enrolled a factor**. WebAuthn is bound to the web domain (`WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS`). | `identity.policy.ts`, `.env.production.example` | Passkeys work in a browser on the web domain; they do not work inside a native login form without extra setup. |
| **[VERIFIED]** `req.authSession` is consumed only by the CSRF middleware and the CSRF-rotation controller. Logging does not record headers or bodies. | grep over `src`, `docs/logging-privacy.md` | The change surface is small and centralised. A session-token header will not leak through logs by default. |
| **[VERIFIED]** Rate limits are keyed by IP. | `common/middleware/rate-limits.ts` | Mobile carriers share IPs. Throttling must be reviewed. |

## 2. Requirements and non-goals

**Requirements**
1. A customer can sign in on iOS/Android and stay signed in for a reasonable period without weakening the web.
2. Parity with the web's controls: Argon2id passwords, email verification, throttling and lockout, optional MFA (TOTP, recovery codes, WebAuthn), audit events, session listing and revocation, revocation on password change/reset.
3. Instant server-side revocation (lost phone, suspended account).
4. **Customers only.** A native credential must never carry staff, admin or owner authority.
5. Additive and reversible: web behaviour, cookies, CSRF and the existing 97 migrations stay unchanged. Feature-flagged, default off.

**Non-goals for v1:** staff/admin mobile access, guest-purchase sessions (they use separate cookies and need their own design), native passkey enrolment, biometric login as a server credential.

## 3. Options considered

| Option | Description | Verdict |
|---|---|---|
| **A. Spoof the web contract** | Native sets a fake `Origin` and keeps cookies/CSRF. | **Reject.** Defeats the CSRF design and trains the server to trust a forgeable header. |
| **B. Native login form + device-session tokens** | App collects email/password (and TOTP), calls new `/mobile/auth/login`, receives access and refresh tokens. | Viable later. Needs a second login surface exposed to credential stuffing with no `Origin` check, plus duplicate MFA, recovery and verification UI in the app. |
| **C. Browser hand-off with PKCE (recommended)** | App opens the existing web login in the system browser sheet. After web login (including MFA and passkeys), the web page asks the backend for a one-time authorization code bound to a PKCE challenge and redirects back to the app. The app exchanges code + verifier for tokens. | **Recommended for v1.** Reuses the whole web credential stack and passkeys, keeps passwords out of the app, and leaves only two small unauthenticated native endpoints. |
| **D. Full OAuth/OIDC server** | Stand up a standards-based authorization server. | Over-scoped for one first-party app. C is OAuth authorization-code-with-PKCE in miniature and can migrate to D later. |

**Trade-off to accept with C:** sign-in uses a browser sheet, not a fully native form. Users already signed in on the phone's browser get a near-instant flow. If testing shows the UX is unacceptable, add option B as a second path behind its own flag, after the token layer exists.

## 4. Flow (option C) [PROPOSED]

```text
App                          System browser sheet            Web frontend / API
 |  generate code_verifier, code_challenge (S256), state, installationId
 |-- open https://<web>/mobile-auth?challenge=..&state=..&redirect=.. -->
 |                              user logs in on the normal web page
 |                              (password, email verify, TOTP / passkey)
 |                              page calls POST /api/v1/auth/mobile/authorize
 |                              (cookie session + CSRF, as for any web mutation)
 |                              <-- one-time code (60 s, single use, role CUSTOMER, MFA complete)
 |<-- redirect to app link  ?code=..&state=..   (verify state)
 |-- POST /api/v1/mobile/auth/token {code, codeVerifier, redirectUri, device{...}} -->
 |<-- {accessToken (15 min), refreshToken, expiries, sessionId, minimal user}
 |  store both in Keychain / Keystore (expo-secure-store)
 |-- X-Device-Session: <access>  on /customers/*, /mobile/*, selected /auth/*
 |   (staging / pre-launch builds also send the perimeter header `Authorization: Basic ...`)
 |-- POST /api/v1/mobile/auth/refresh {refreshToken, installationId} -->  new pair (rotation)
```

## 5. Backend changes [PROPOSED]

### 5.1 Schema (illustrative; one forward-only migration)

Migration folders are **timestamp-named** (the latest on disk is `20261103190000_booking_resource_allocations`). Choose a timestamp later than the latest merged migration and reconcile with the unmerged migrations **[VERIFIED in git]** on `origin/codex/booking-attendance-20261104` (`20261104002000_booking_attendance_history`, PR #20) and `origin/codex/running-work-review-20261104` (`20261104010000_booking_work_reviews`, apparently PR #23). Do not assume the next number is "98": two different branches each add one migration. Re-fetch before choosing your timestamp. **[VERIFIED]** Both are independent of sessions and auth: PR #20's SQL never references `Session`, and PR #23's SQL only alters `BookingResourceAllocation`. Choose a timestamp later than both and do not depend on either. I did not verify that the safe migrator enforces ordering (it filters pending migrations by name; Prisma applies them by name), so a later timestamp is the safe choice. Never edit an applied migration. **[VERIFIED]** The backend's safe migrator (`scripts/lib/database-safety.ts`) rejects pending migrations containing `DROP TABLE/TYPE/COLUMN`, `ALTER COLUMN`, `TRUNCATE`, `DELETE FROM`, any `UPDATE`, `DO $` or dynamic `EXECUTE`, and it fails if the database holds an applied migration the checkout does not contain. So this migration must be **additive only** (new tables, `CREATE TYPE`, `ADD COLUMN ... DEFAULT`) with no backfill `UPDATE`, and it must live in the same repository history as the website backend.

```prisma
enum SessionKind { WEB MOBILE }
enum MobilePlatform { IOS ANDROID }

model Session {            // existing; add:
  kind     SessionKind @default(WEB)
  deviceId String?     @db.Uuid
  device   MobileDevice? @relation(fields: [deviceId], references: [id], onDelete: SetNull)
}

model MobileDevice {
  id                   String         @id @default(uuid()) @db.Uuid
  userId               String         @db.Uuid
  installationIdHash   String         @db.Char(64)      // HMAC of app-generated install ID
  platform             MobilePlatform
  appVersion           String         @db.VarChar(32)
  osVersion            String?        @db.VarChar(32)
  label                String         @db.VarChar(80)   // "iPhone", "Android phone"; no hardware IDs
  createdAt            DateTime       @default(now())
  lastSeenAt           DateTime?
  revokedAt            DateTime?
  @@unique([userId, installationIdHash])
}

model MobileRefreshToken {
  id           String    @id @default(uuid()) @db.Uuid
  sessionId    String    @db.Uuid
  tokenHash    String    @unique @db.Char(64)
  createdAt    DateTime  @default(now())
  expiresAt    DateTime
  usedAt       DateTime?
  replacedById String?   @db.Uuid
  @@index([sessionId])
}

model MobileAuthorizationCode {
  id              String    @id @default(uuid()) @db.Uuid
  codeHash        String    @unique @db.Char(64)
  userId          String    @db.Uuid
  webSessionId    String    @db.Uuid
  codeChallenge   String    @db.VarChar(128)   // S256 only
  redirectUri     String    @db.VarChar(300)   // exact-match allowlist
  stateHash       String    @db.Char(64)
  expiresAt       DateTime
  consumedAt      DateTime?
  createdAt       DateTime  @default(now())
}
```

Extend the `TokenPurpose` union (`mobile-access`, `mobile-refresh`, `mobile-auth-code`, `mobile-installation`) so every secret is HMAC-hashed with a purpose label, as the existing tokens are. Mobile sessions reuse the `Session` table so `req.actor.sessionId`, audit, session listing, `MAX_ACTIVE_SESSIONS`, and revocation on password change/reset keep working.

### 5.2 Endpoints

| Endpoint | Auth | Behaviour |
|---|---|---|
| `POST /auth/mobile/authorize` | Web cookie session + CSRF (`authenticate()`, `requireCsrf`) | Body: `codeChallenge` (S256 only), `redirectUri` (exact allowlist match), `state`. Reject unless role is `CUSTOMER` and, if `mfaRequired`, `mfaVerifiedAt` is set. Returns a single-use code valid 60 seconds. Sensitive rate limit. Audit `MOBILE_AUTH_CODE_ISSUED`. |
| `POST /mobile/auth/token` | None (no `Origin` requirement) | Atomically consume the code (`UPDATE ... WHERE consumedAt IS NULL AND expiresAt > now() RETURNING`), verify PKCE and redirect URI in constant time, re-check the user is `ACTIVE` and `CUSTOMER`, upsert `MobileDevice`, create a `Session` (`kind = MOBILE`) copying the web session's MFA state, issue access + refresh tokens. Audit `MOBILE_LOGIN`. |
| `POST /mobile/auth/refresh` | Refresh token in body | Rotation with reuse detection (section 6). Verifies the `installationId` matches the device. |
| `POST /mobile/auth/logout` | Session-token header | Revoke the session and its refresh tokens; idempotent; audit. |
| `GET /auth/session`, `GET/DELETE /auth/sessions[...]` | Session-token header or cookie | Mobile sessions appear in the user's list with the device `label` instead of a browser string and are revocable from the web. |

Security-sensitive actions stay on the web in v1: password change, MFA enrolment/removal, recovery codes, account deletion initiation (link out to the web, or expose only the existing privacy-request endpoints after review).

### 5.3 Middleware changes (the critical part)

1. **`authenticate()`**: add a device-session branch.
   - If an `X-Device-Session` header is present, look up the session by `hashToken("mobile-access", raw)` and require `session.kind = MOBILE`. Otherwise use the existing cookie path and require `session.kind = WEB`. **A token of one kind must never authenticate on the other path** (token-type confusion).
   - **Never read `Authorization` for session purposes.** The staging perimeter's `Authorization: Basic` header must pass through untouched, and an `Authorization: Bearer` header must authenticate nothing.
   - Set `req.authSession.transport = "device" | "cookie"`.
   - For device sessions: require role `CUSTOMER`; **default-deny by path** with a single central allowlist (for example `/api/v1/customers/`, `/api/v1/mobile/`, `/api/v1/auth/session`, `/api/v1/auth/sessions`). Anything under `/staff` or `/admin` is rejected for device sessions regardless of role.
   - Keep the existing suspended/revoked/expired/idle checks, the idle-touch update and `enforceWorkforceBoundary` unchanged.
2. **`requireCsrf`**: if `transport === "device"`, skip the Origin/CSRF/Sec-Fetch checks (browsers do not attach a custom header automatically, and `X-Device-Session` is absent from the backend's CORS `allowedHeaders`, so a web page cannot send it cross-origin; CSRF does not apply). Cookie sessions behave exactly as today.
3. **`requireTrustedOrigin`** (30 call sites): unchanged. Native uses its own `/mobile/auth/*` routes.
4. **`publicLaunch`**: treat `/mobile/*` like `/customers/*` in `catalogue` mode (blocked), and let `/mobile/auth/*` through in `browse_enquiries` mode.
5. **Guest cookies** (`purchase.routes.ts`, `allie.routes.ts`): unchanged and out of scope.

Because the cookie is read in one place and CSRF is enforced in one place, **the behaviour change is centralised**, but it touches the security of all 85 authenticated routers. That is why a test sweep (section 9) is mandatory.

### 5.4 Configuration [PROPOSED]

`MOBILE_AUTH_ENABLED` (default `false`), `MOBILE_AUTH_REDIRECT_URIS` (exact-match list), `MOBILE_AUTH_CODE_TTL_SECONDS` (60), `MOBILE_ACCESS_TTL_SECONDS` (900), `MOBILE_REFRESH_IDLE_SECONDS`, `MOBILE_REFRESH_ABSOLUTE_SECONDS`, `MOBILE_REFRESH_GRACE_SECONDS` (30). Add them to the env schema and its production validation pattern, and to `.env.example`, `.env.staging.example` and `.env.production.example`.

### 5.5 Rate limiting [PROPOSED]

Keep the IP limit but add keys that do not depend on IP: per authorization code, per refresh-token family and per device. Raise the IP ceiling on `/mobile/auth/*` modestly because of carrier NAT, and always return `Retry-After`. Load-test shared-IP behaviour before launch.

### 5.6 Private-testing perimeter vs the session token [VERIFIED problem; RESOLVED in this draft, owner to confirm]

**Problem [VERIFIED].** `app.ts` mounts `privateTesting` before everything else. When `PRIVATE_TESTING_ENABLED=true` (documented for staging and for production before public release), every `/api/v1` request except health probes and provider webhooks must carry `Authorization: Basic base64("allied-test:<64-hex password>")`, including anonymous public GETs. The frontend proxy has the same gate. A Bearer token would need the same `Authorization` header, so the two cannot coexist.

**Decision [PROPOSED].** Carry the device-session token in a dedicated header, **`X-Device-Session`**, and never read `Authorization` for session authentication. The perimeter keeps `Authorization: Basic` exactly as today.

Why this option:
1. **No change to the perimeter gate or the frontend proxy gate.** Fewer shared files to edit than the alternatives.
2. **Same behaviour in every environment.** Only the extra perimeter header exists where the gate is on; production after public release sends only `X-Device-Session`.
3. **Extra CSRF safety.** Browsers cannot attach this non-simple header cross-origin unless CORS allows it, and it is not in `allowedHeaders`.
4. **Declarable in OpenAPI** as an `apiKey` security scheme (`mobileSession`).

Consequences: staging, dev and closed-beta builds send both headers. The perimeter value comes from a dev-only runtime input kept in secure storage and is **never** placed in an `EXPO_PUBLIC_*` variable or any store build. Do not add `X-Device-Session` to the trusted proxy-proof headers (`x-allied-client-ip`, `-time`, `-proof`). **[CONFIRM]** that Cloudflare and DigitalOcean do not strip custom headers on `api.alliedautotech.com`.

Alternatives considered: (b) change the perimeter gate to also accept a custom header, freeing `Authorization` for Bearer; this edits a gate that protects staging and adds environment-dependent behaviour. (c) turn the backend perimeter off for the mobile host; this weakens staging. If the owner later wants standards-based `Authorization: Bearer` in production, it can be added as a second accepted header once the perimeter is permanently off.

## 6. Token lifetimes, rotation and reuse detection [PROPOSED; owner/security decision]

| Token | Form | Lifetime (proposal) | Notes |
|---|---|---|---|
| Authorization code | Opaque, hashed | 60 s, single use | Bound to PKCE challenge, redirect URI, state and web session. |
| Access token | **Opaque** (not JWT), hashed in `Session.tokenHash` | 15 min | Opaque keeps the existing per-request database check, so revocation is instant. |
| Refresh token | Opaque, hashed in `MobileRefreshToken` | 30 days idle, 90 days absolute | Rotated on every use. |

- **Reuse detection:** presenting an already-used refresh token outside the grace window revokes the whole session (and its device refresh tokens) and records `MOBILE_REFRESH_REUSE`.
- **Lost-response grace:** if a refresh response is lost, the app retries with the old token. Allow a short grace window (30 s) in which the previous token yields a fresh pair instead of killing the session. This slightly widens exposure for a stolen token inside 30 s; document it and make it configurable. Do **not** store raw tokens to replay them.
- Existing web defaults are 7 days absolute and 24 hours idle. Mobile users expect longer; confirm the numbers with the owner and security reviewer.
- `MAX_ACTIVE_SESSIONS` (default 5) counts mobile sessions too. Decide whether web and mobile share the cap or get separate caps, so signing in on a new phone does not silently evict a web session.

## 7. Web frontend changes required (outside the backend zip) [CONFIRM]

- A `/mobile-auth` page that reuses the existing login/MFA flow, then calls `POST /auth/mobile/authorize` with the CSRF token and redirects to the app link.
- Hosting `apple-app-site-association` and `assetlinks.json` on the web domain for verified app links (preferred over a custom scheme).
- No change to existing login, cookies or CSRF.

## 8. Mobile implementation notes

- `expo-web-browser` `openAuthSessionAsync` (system browser sheet, not an embedded WebView), `expo-crypto` for the PKCE verifier/challenge and `state`.
- Store tokens only in `expo-secure-store` (Keychain / Keystore). On iOS use a "this device only" accessibility class so tokens are not restored to another device from a backup.
- Single-flight refresh: one refresh at a time; queue concurrent requests behind it. On `SESSION_EXPIRED` refresh once, then sign out.
- Sign-out and any auth failure must clear secure storage, bump `sessionGeneration`, and clear the query cache and drafts (MOB-018).
- Biometric unlock is a **local presentation lock only**. It never replaces server authentication.
- Never log tokens. In staging, dev and closed-beta builds also send the perimeter `Authorization: Basic` value, kept in secure storage from a dev-only runtime input and never built into the app. Send an app-version header on every request so the backend can later enforce a minimum version.

## 9. Threat model

| Threat | Mitigation |
|---|---|
| Authorization code intercepted via a hijacked custom scheme | PKCE S256, `state`, 60 s single-use code, exact redirect allowlist, prefer verified app links. |
| Redirect URI manipulation / open redirect | Exact-match allowlist; no wildcards; reject on mismatch. |
| Refresh token theft or replay | Rotation, reuse detection with family revocation, device (`installationId`) binding, secure storage. Phase 2: hardware-backed proof-of-possession key. |
| Cookie session used as a device token, or the reverse | `Session.kind` enforced on both paths; distinct token purposes in the HMAC. |
| Privilege escalation to staff/admin | Role must be `CUSTOMER` at issuance and on every request; `/staff` and `/admin` denied for device sessions. |
| Credential stuffing | No password endpoint exposed to native in option C; web login keeps its throttles and lockout. |
| Stolen or lost phone | Server revocation (web session list, "sign out all", password reset), short access TTL. |
| Account suspended after sign-in | Existing per-request status check applies to device sessions too. |
| Concurrent refresh race | Atomic rotation; single-flight client; grace window. |
| Token leakage in logs | Existing logging excludes headers and bodies; add a regression test. |
| Shared-IP throttling (denial of service by neighbours) | Non-IP rate-limit keys, `Retry-After`, load test. |
| Emulated or modified client | Accepted risk in v1; optional App Attest / Play Integrity later. |
| Previous user's data after account switch | App-side generation counter and cache clear. |

## 10. Test plan (backend, isolated `_test` database)

Authorization code: single-use, expiry, PKCE mismatch, redirect mismatch, state mismatch, non-customer role, MFA required but incomplete, suspended user. Tokens: rotation, reuse detection, grace window, installation mismatch, idle and absolute expiry, `MAX_ACTIVE_SESSIONS`, password reset/change revokes mobile sessions, logout idempotency. Middleware: device-session token rejected on every `/staff` and `/admin` route (use the route-coverage script pattern to enumerate), cookie token rejected on the device path and vice versa, `Authorization: Bearer` authenticates nothing, with `PRIVATE_TESTING_ENABLED=true` a request with both `Authorization: Basic` and `X-Device-Session` succeeds while `X-Device-Session` alone gets the perimeter 401, `X-Device-Session` values never appear in logs, CSRF/Origin still enforced for cookie sessions, `requireTrustedOrigin` unchanged. Hygiene: tokens absent from logs and audit rows, new operations pass `check:openapi` (operation IDs, examples, security scheme `mobileSession` (an `apiKey` in the `X-Device-Session` header)) and `check:routes`, all existing web identity tests unchanged and green. Run the backend's full `npm run check`. Never use `db push`, migration reset or **`prisma migrate dev`** (`AGENTS.md` forbids all three against application, shared, staging or production databases); apply migrations with `npm run db:migrate`, which verifies history and takes a verified backup first. The existing backend workflow is path-filtered to `backend/**`, so the PR must also pass the exact-source checks the release workflow requires (frontend release checks, backend database safety, repository secret guard).

## 11. Rollout

`MOBILE_AUTH_ENABLED=false` by default. Order: local stack, isolated staging with test accounts, production dark, then a closed beta. Provide a kill switch and an operator procedure to revoke all mobile sessions. Monitor `MOBILE_REFRESH_REUSE` and token-endpoint error rates.

## 12. Decisions needed before building

1. Hand-off (option C) or a native form (option B)? I recommend C first.
2. Refresh and access lifetimes, and whether web and mobile share `MAX_ACTIVE_SESSIONS`.
3. Redirect scheme: verified app links (needs web hosting changes) with a custom-scheme fallback?
4. Do we want App Attest / Play Integrity in v1 or later?
5. Who performs the security review, and who may merge changes to `authenticate.ts` and `csrf.ts`?
6. Confirm the `X-Device-Session` header decision (section 5.6) with the owner and reviewer, and who may change the perimeter gate if they prefer another option.
7. Will staff ever use mobile? If yes, that needs a separate design (MFA, workforce grants).

## 13. Work breakdown

1. **Backend PR:** schema + migration, token purposes, endpoints, middleware changes, config, OpenAPI, tests. Human review required.
2. **Frontend PR:** `/mobile-auth` page and app-link files.
3. **Mobile PR:** auth module (PKCE, secure storage, refresh manager, sign-out), wired into the scaffold's `SessionProvider`.

Build them in that order. Package C (public experience) does not depend on any of this and can proceed in parallel.
