# Email verification and resend

Status: locally accepted on 8 October 2026, the twenty-sixth expanded milestone. Route: `/verify-email`. The resend action is part of this existing page, not a separate route, so both workflows belong to this gate. Reset-password passed its separate gate; MFA and other security/account pages remain open.

## Audit and scope

Baseline captures at 390/768/1280/1440px show the older AuthShell, a weakly outlined token field, no reveal control or breadcrumb, and a second resend form below. Preserve explicit verification, fragment/manual token entry, generic resend responses and sign-in/help paths while bringing this complete page into the accepted authentication design.

Existing contracts: `POST /auth/email/verify` accepts a strict 32–512-character token, enforces trusted origin and ten attempts per fifteen minutes, atomically consumes a current unused token, sets emailVerifiedAt, revokes other verification tokens and records EMAIL_VERIFIED. Invalid/expired/revoked/used tokens return generic TOKEN_INVALID (400). Success is 200 and does not sign the visitor in. `POST /auth/email/resend` accepts a strict email-only body and limits requests to three per hour. Only active unverified accounts receive a new hashed token and encrypted notification event; prior unused tokens are revoked. Existing, unknown and ineligible-account outcomes use a generic 202 response. No new backend endpoint is required.

Implemented scope: shared auth shell, route breadcrumb and skip link; masked token with reversible reveal; clear switching between token and resend forms; separate pending, completion, invalid-link, uncertainty, validation and rate-limit states; token/address clearing; no sensitive drafts or automatic submission; session/cross-tab/restored-page cancellation; accessible mobile layout without horizontal overflow. Concepts precede production edits. Scoped verification evidence follows.

## Implementation and behavior

The page now uses AccessShell with the verification breadcrumb and skip target. A dedicated EmailVerificationForm replaces the old generic EmailActionForm and separate ResendVerification component; repository import searches confirmed those components had no other live callers. Both workflows remain on `/verify-email`, with one visible form at a time. This avoids stacking two unrelated submissions into a long mobile page.

The verification token is masked with a labelled 44px reveal button. A single bounded fragment token is adopted on input mount and removed from the URL while preserving Next.js history state; query-string and duplicate tokens are ignored. Manual entry remains supported. Token fragments never trigger a request automatically. The shared fragment parser is also re-exported under the existing recovery helper name, preserving password-reset callers and tests.

Changing workflows clears both fields and focuses the destination input. Verification and resend retain separate Retry-After deadlines, so switching cannot bypass a local cooldown or incorrectly block the other endpoint. The backend remains authoritative across refreshes. A synchronous request lock, AbortController and session/cross-tab/restored-page handling discard obsolete results. Token reveal resets when the page is hidden. No sensitive form drafts are persisted; without JavaScript, both POST forms stay hidden and explanatory text, sign-in and Help remain available.

Verification completion requires a valid API receipt, clears the token and focuses the result heading. It does not announce a session change or claim to sign the visitor in. Invalid/expired links offer a new email or explicit manual entry. Network, malformed and server-error results offer sign-in/new-link guidance without claiming success or reusing a potentially consumed token. Invalid-token codes are paired with the applicable HTTP status so a contradictory 503 response cannot look like an expired link.

Resend completion uses generic eligibility wording and clears the address. Server validation errors use associated, static field copy. Unknown failures preserve an editable address and advise checking email before retrying. No state echoes arbitrary backend text or claims provider delivery.

## Fidelity ledger

Three fresh concepts were generated and inspected before production edits: [desktop](verify-oct-concepts/desktop.webp), [mobile forms](verify-oct-concepts/mobile.webp), and [result states](verify-oct-concepts/states.webp). See the [design decisions](verify-oct-concepts/README.md).

| Area                   | Concept evidence                                   | Browser evidence and correction                                                                                              | Remaining limitation                         |
| ---------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Desktop composition    | Workshop editorial beside white form               | Retain the established 46/54 shell and 440px form; actual approved photograph replaces generated variation                   | None for this route                          |
| Brand and typography   | Generated Allied wordmark and rounded form text    | Use official Brand, Nippo editorial type and Quicksand interface text                                                        | Generated concept is a guide, not a new logo |
| Mobile spacing         | Large empty region above the concept logo          | Compact real shell starts with logo and breadcrumb, followed by the form; default controls fit at 844px height               | Short screens scroll vertically              |
| Input and action scale | Bordered token/email fields and red primary action | 48px fields/actions, 44px reveal and secondary targets; retain a visible focus outline                                       | None                                         |
| Form hierarchy         | One workflow per mobile panel                      | One visible form with explicit switching, clearing and destination focus                                                     | None                                         |
| Result states          | Four centered icon/heading/action panels           | 36px icons, focused headings, distinct verified/sent/invalid/uncertain copy and functioning next actions                     | Provider delivery remains unverified         |
| Secret handling        | Masked token with reveal                           | Fragment removed, no automatic request, preserved skip-link behavior and no stored token                                     | Backend decides validity                     |
| Color and density      | Red actions, ink headings, cool neutral outlines   | Official brand palette and existing compact authentication spacing replace generated bright-blue links and oversized artwork | None                                         |

Final browser captures cover both forms at 320/360/375/390/430/768/1024/1280/1440/1536px and four result states at 390/1440px. Inspected desktop/default, narrow-mobile/default, mobile/resend and result captures against the concepts. All twenty default/form captures report no horizontal overflow. Temporary scripts, captures and logs remain outside the repository under `C:/Users/PC/.codex/verify-oct-*`.

## Verification evidence

- Frontend lint, TypeScript, production build and scoped Prettier checks passed.
- Seven frontend unit files passed: 104 checks covering API receipts/errors, retry timing, Login, Registration, password-reset fragment/validation behavior, Feedback and new verification/resend validation.
- Backend identity security/boundary suites passed all 11 existing checks; no production backend change was required.
- **All 169 combined browser scenarios passed:** 36 Email verification/resend, 34 Reset password, 28 Forgot password, 40 Login, 27 Registration and four existing auth/navigation regressions. Eleven verification/resend Axe scans passed across four widths and the form/result/error states. New verification scenarios cover ten widths for both forms, accessibility, fragment privacy, explicit submission, reveal behavior, field clearing, valid/generic receipts, invalid/uncertain responses, validation, rate limits, cancellation, session/cross-tab/restored-page changes, short screens, no-JavaScript and keyboard navigation. Controlled responses are test fixtures only.
- The real isolated Express/browser/PostgreSQL check passed resend then verification through the actual handlers. The browser transport was forwarded to a temporary real Express app using process-local test keys and the isolated `allied_vehicles_qa` database. It proved one encrypted outbox event, old-token revocation, new-token consumption, emailVerifiedAt, one EMAIL_VERIFIED audit, no verification-created session or login cookie, replay/expired/revoked rejection (400), cross-origin rejection (403), generic eligible/already-verified/unknown resend responses (202), a fourth resend rejected with Retry-After (429), and login changing from 401 before verification to 200 afterward. The encrypted test outbox was read in-process to obtain the test link; no token/key/address was printed. Provider delivery stayed disabled. Existing API-instance rate limits were untouched.
- The first helper invocation completed all assertions, but PowerShell classified Node experimental Web Crypto stderr warnings as a native command error. A follow-up invocation explicitly returned Node exit code 0 and again passed all assertions; both logs are retained. These warnings are not hidden or treated as failed application assertions.

Browser plugin tooling was unavailable; the repository Playwright runner used installed Microsoft Edge against the standalone production build. No deployment or external email delivery is claimed.

## Files and commands

Production files: `app/verify-email/page.tsx`, `app/verify-email/verify-email.css`, `app/components/email-verification-form.tsx`, `app/components/access-shell.tsx`, `lib/auth/email-verification.ts`, `lib/auth/fragment-token.ts`, and the compatible re-export in `lib/auth/password-reset.ts`. Removed unused `app/components/email-action-form.tsx` and `app/components/resend-verification.tsx`. Tests: `tests/fixtures/email-verification.ts`, `tests/e2e/email-verification-quality.spec.ts`, and `tests/unit/email-verification.test.ts`. Concepts and this report are documentation assets.

Commands: frontend `npm run lint`, `npm run typecheck`, `npm run build`, scoped `npx prettier --check`, scoped `npx vitest run`, and `npx playwright test` across Email verification, Reset password, Forgot password, Login, Registration and existing auth/navigation regressions; backend scoped `npx vitest run` for identity security/boundary. External Node helpers perform real database assertions and screenshots.

## Remaining scope

No new backend gap was identified for either workflow. [REL-03](../../../BACKEND_IMPLEMENTATION_GAPS.md) still requires deployed email delivery and the complete registration/verification/recovery journey. MFA challenge, enrollment and recovery codes subsequently passed their [joint route gate](mfa-expanded.md). Customer account security and the remaining security/account/role pages are still open. Resend is complete within this page, not a separate route. The whole-app goal remains active.
