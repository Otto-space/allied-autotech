# Registration

Status: locally accepted on 8 October 2026, the twenty-third expanded milestone. Route: `/register`. Forgot-password subsequently passed its [separate gate](forgot-password.md); the full application goal remains active.

## Contract and implementation

Registration reuses `POST /auth/register`. The existing strict schema accepts first name, last name, phone, email and a 12–128-character password; the server rejects common passwords and additional fields. Trusted-origin enforcement and the five-attempts-per-hour registration limit remain intact. The generic 202 response preserves duplicate-email privacy. A new customer receives an Argon2 password hash, customer profile, verification token and queued notification; registration does not create an authenticated session. No production backend, API contract or migration changed for this gate.

The form now shares Login's `AccessShell`, local Nippo/Quicksand fonts, desktop workshop composition, visible field borders and accessible password reveal. Names share a row; phone, email and password span the form. Native constraints and a matching client schema associate field errors with their controls. The first invalid field receives focus. A synchronous submission lock prevents duplicate clicks, and the password is cleared and re-masked when a valid request starts.

Accepted responses show a focused “Check your email” panel with Sign in and Use another email actions. Copy does not guarantee a newly created account or delivered email. Form values are reset and are not persisted by the form-draft system. Session changes, cross-tab invalidation, restored pages and unmount discard pending results; aborting a request cannot undo a server write. Without JavaScript, explanatory text replaces the form and credentials cannot enter a query string.

## Concepts and fidelity

Four baseline captures at 390, 768, 1280 and 1440px preceded fresh [desktop](register-oct-concepts/01-desktop.webp), [mobile](register-oct-concepts/02-mobile.webp) and [state](register-oct-concepts/03-states.webp) concepts. See the [concept decisions](register-oct-concepts/README.md).

| Comparison           | Concept evidence                             | Browser evidence and correction                                                                      | Remaining boundary                                                   |
| -------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Desktop composition  | Workshop image beside white form             | Shared Login shell retains the split and existing approved image                                     | No new production photograph required                                |
| Mobile density       | Form-first mobile view                       | At 320–768px the decorative story is omitted; default fields and actions fit the tested 844px height | Short screens, keyboard and enlarged text require vertical scrolling |
| Typography and brand | Bold heading, restrained red actions         | Real logo and Nippo/Quicksand replace generated branding; approved tagline retained                  | Generated sample logo/tagline deliberately excluded                  |
| Fields               | Paired names and full-width remaining inputs | 48px inputs, visible borders and 44px reveal/links verified                                          | Error messages can increase form height                              |
| Navigation           | Existing-account and help actions            | Breadcrumb, skip link, home logo, Sign in and account-security Help resolve                          | Other auth pages retain separate gates                               |
| Validation           | Field-associated error treatment             | Invalid names/phone focus correctly; backend 422 field errors are sanitized and associated           | Backend common-password checks remain authoritative                  |
| Accepted state       | Mail symbol, email guidance and two actions  | Reset form, focusable heading, working Sign in/restart, neutral outlined secondary action            | Receipt and queued event do not establish email delivery             |

Ten final default-state screenshots and accepted-state captures at 390/1440px were produced. Representative desktop, tablet, narrow-mobile and accepted-state renders were inspected. No horizontal page overflow was observed across 320/360/375/390/430/768/1024/1280/1440/1536px. Default-form actions fit at 844px height below 1024px and 900px at the larger widths; this is not a claim that every error state fits every screen without vertical scrolling.

## Verification

- **71 combined browser scenarios passed:** 27 registration, 40 Login and four existing shared-auth regressions. The corrected 422 field-error fixture also passed a separate targeted rerun.
- Six registration Axe scans passed: four default widths, field validation and accepted state. Coverage includes password reveal, native validation, no credential persistence, duplicate submission, 422/429/network/malformed failures, session/cross-tab/restored-page clearing, no-JavaScript behavior, keyboard navigation and short-screen enlarged text.
- **36 frontend unit tests passed:** registration validation, Login response/redirect validation and shared feedback.
- **10 backend identity tests passed**, including the added cross-origin registration boundary check. CORS rejects the untrusted origin with 403 `FORBIDDEN` before identity middleware; the initial test incorrectly expected `CSRF_INVALID` and was corrected to the existing contract.
- Frontend production build, lint, type checking and scoped formatting passed. Scoped backend formatting/lint passed. No checks were weakened.

Real browser/API checks created two synthetic customers in isolated `allied_vehicles_qa` on port 55439. A separate read-only verifier confirmed each persisted as an unverified CUSTOMER with one profile, one verification token, one queued notification, an Argon2 hash and no session. Duplicate-email requests returned generic 202 responses without an additional account/token; unverified login returned 401. Role injection returned 422 in the initial real run. The ad-hoc helper initially expected 400 and stopped; after correction its repeat reached the actual 429 registration limit. That limit was not reset or bypassed, and neither entire helper run is claimed as a full pass. Untrusted-origin registration is covered by the isolated HTTP boundary test, not that interrupted live script.

Email and SMS delivery were disabled. Queued notifications are not evidence of provider delivery. Playwright with Edge supplied browser coverage because the browser plugin was unavailable. Temporary captures, scripts and logs remain outside the repository at `C:/Users/PC/.codex/register-oct-*`.

## Backend handoff and remaining scope

No new backend gap was identified. Deployed verification-email delivery, token consumption/expiry, session/proxy configuration and recovery-provider checks remain under REL-03 in the [backend gap register](../../../BACKEND_IMPLEMENTATION_GAPS.md). Forgot-password has passed its separate gate. Reset-password, verification/resend, MFA methods, recovery and security pages still require their own visual and interaction gates. Physical devices, other browser engines and assistive-technology testing remain separate.
