# MFA sign-in, enrollment and recovery codes

Status: locally accepted on 8 October 2026, the twenty-seventh expanded milestone. Route `/mfa`, including the existing `?setup=1` state. Twenty-six earlier expanded milestones have passed.

## Contract audit

The route reads `/auth/session`, prepares `/auth/mfa/challenge/options`, submits `/auth/mfa/challenge/verify`, and supports TOTP/security-key enrollment through `/auth/mfa/totp/setup`, `/auth/mfa/totp/verify`, `/auth/mfa/webauthn/options`, and `/auth/mfa/webauthn/verify`. Mutations require an authenticated pending/full session and CSRF. Options are limited to 20 attempts per fifteen minutes and verification to ten. TOTP requires an actual factor UUID and six digits; recovery codes accept 8?128 characters and are single-use. WebAuthn requires the browser ceremony, expected RP/origin and server verification. Session rotation and a fresh session read precede role-specific account-security navigation.

First-factor setup requires confirmation that no active factor or unused recovery code exists; existing factors require prior verification. The backend locks/rechecks the account/session/CSRF during enrollment. TOTP setup replaces unfinished TOTP enrollment. Completed enrollment replaces prior recovery codes and rotates the session. Keep explicit consent, QR/manual setup, copy/download/hide recovery codes, uncertain-result handling and all existing permissions.

## Baseline and plan

Four baseline captures cover 390/768/1280/1440px before production edits. The old generic shell stacks method buttons and setup instructions, lacks a breadcrumb and consistent compact input styling, and uses the older card layout. The code form still has a sensitive draft marker and no reveal control. Reuse the accepted authentication shell; introduce clear method choices and a focused active step; preserve explicit WebAuthn gestures and server authority; improve mobile enrollment/recovery layout, cancellation, restored-page clearing and rate-limit feedback. Concepts precede implementation.

## Implemented behavior

The route uses the accepted AccessShell with a route-specific breadcrumb and keyboard skip link. The three method choices have short descriptions and outlined controls. Selecting one opens a focused authenticator, recovery-code or browser-key step; changing methods clears the old code and returns keyboard focus. The native factor selector retains actual server IDs and names, with a visible border, chevron, focus treatment and bounded width.

Both code inputs start masked, support a labelled reversible reveal, and re-mask when hidden or submitted. Codes clear as soon as a valid submission starts. The old draft marker is removed. Recovery input disables autocomplete; authenticator input retains one-time-code assistance and the numeric keyboard. Server Retry-After delays disable repeated verification and method changes until the wait ends. Unknown mutation results retain the existing no-replay/session-check path. Method-unavailable and MFA-required codes are paired with their applicable HTTP status rather than trusted in isolation.

Enrollment preserves explicit consent before replacing recovery codes, first-factor checks, existing-factor verification, QR and manual-secret entry, and a separate user gesture for the browser security-key ceremony. The scoped layout compresses headings, instructions, QR display and controls without removing supported paths. A completed enrollment displays all ten recovery codes with copy, local text download and explicit hide actions. The recovery heading is an h1 in this route; its reusable component retains the h2 default for account-security pages. A redundant completion banner above the code list was removed.

Session changes, cross-tab changes and restored-page events discard the current screen, secrets and pending work. Completion focuses its heading. A fresh server session read still precedes Customer versus Staff/Admin/Super Admin account-security navigation. The no-JavaScript fallback uses server/client readiness instead of a client-rendered noscript block, so its explanation and sign-in/Help links are actually available before hydration.

## Fidelity ledger

Fresh [desktop](mfa-oct-concepts/desktop.webp), [mobile challenge](mfa-oct-concepts/mobile.webp) and [enrollment/results](mfa-oct-concepts/setup.webp) concepts were generated and inspected before production edits. [Concept decisions](mfa-oct-concepts/README.md) retain official assets and correct generated variations.

| Area                 | Concept evidence                                 | Browser evidence and correction                                                                                | Remaining limitation                                          |
| -------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Desktop shell        | Workshop editorial plus compact white form       | Existing 46/54 composition, 440px form, approved workshop image and official Brand                             | None for this page                                            |
| Typography           | Concept introduced serif text and variant logos  | Actual Nippo and Quicksand replace generated substitutions and invented tagline                                | Concept assets are documentation only                         |
| Method hierarchy     | Three icon/description rows                      | Bordered 68px method rows open one active step, with working return focus                                      | The backend determines method availability                    |
| Active challenge     | Single factor/code field and primary action      | 48px fields/actions, 44px reveal/navigation, masked codes and visible selector focus                           | Browser owns security-key prompt UI                           |
| Mobile               | Compact logo/breadcrumb and focused verification | All chooser and active challenge controls fit the tested default 844/900px heights at ten widths               | Short screens and enlarged text scroll vertically             |
| Enrollment           | QR/manual entry and explicit code verification   | 144px displayed QR, readable manual key/copy control, compact consent and preserved discard explanation        | Longer setup content scrolls vertically                       |
| Recovery codes       | Clear save/copy/download/hide sequence           | Removed duplicate success banner and divider; compact monospace area shows all ten codes with working controls | Help/footer can require vertical scrolling on shorter screens |
| Result/loading/error | Clear state and next action                      | Focused completion heading, inline feedback, session loading and real no-JavaScript explanation                | No provider/deployed-device acceptance claimed                |

Four baseline captures preceded edits. Final captures include all ten widths for the chooser and authenticator/recovery/security-key, setup, QR, recovery-list and completed states at 390/1440px. The 24 captures report no horizontal overflow. Reviewed desktop and mobile outputs against the concepts. Temporary scripts, images and logs remain outside the repository under `C:/Users/PC/.codex/mfa-oct-*`.

## Verification evidence

- Lint, type checking, production build and scoped formatting passed; final small refinements received scoped lint and a fresh build.
- Four frontend unit files passed 54 checks for MFA response boundaries, API client behavior, Retry-After parsing and feedback. Three backend identity/WebAuthn boundary suites passed 13 checks.
- The first focused browser run passed 58 scenarios and exposed one no-JavaScript fallback failure. The rendered output contained no explanatory text from the client noscript block; the readiness-based fallback replaces it. **All 228 final browser scenarios passed:** 22 new MFA quality scenarios, 21 existing MFA flows, 16 account-security regressions and 169 prior Login/Registration/Forgot-password/Reset-password/Email-verification/shared-auth scenarios.
- Tests retain existing MFA authorization, unknown-result, malformed-response, CSRF, cross-tab, copy and virtual-authenticator scenarios. New tests cover ten widths across chooser/challenge/enrollment/recovery, eight challenge Axe scans, independent reveal, immediate code clearing, rate-limit delays, restored-page clearing, local code download, method-switch focus, enlarged text, no-JavaScript and skip navigation. Existing account-security tests exercise the reusable RecoveryCodes component with its unchanged default heading behavior.
- A real isolated Express/browser/PostgreSQL run passed TOTP enrollment and verification, a fresh TOTP challenge, TOTP replay rejection, recovery-code verification/replay rejection, pending-session enrollment denial, and virtual-security-key enrollment/authentication against the actual backend verifier. Assertions verified encrypted TOTP storage, ten hashed recovery codes, replacement of the previous recovery codes, MFA confirmation and renewal of session-token/CSRF hashes. The old cookie was rejected. The browser used real requests forwarded to a temporary Express instance with process-local test keys in `allied_vehicles_qa`; no provider delivery was enabled. For the fresh TOTP challenge, the helper waited for the next actual time step without altering clocks or factor state.
- Two initial helper assertions were corrected after checking the implementation: token/CSRF renewal retains the same session record, and `/auth/csrf` uses POST, not GET. Neither correction changed backend behavior. Final real acceptance returned Node exit code 0; development Web Crypto experimental warnings remain in the log. No private codes, setup secrets or keys were printed.

Browser plugin tooling was unavailable; Playwright used the installed Microsoft Edge against the standalone production build. The virtual security key exercises browser and backend WebAuthn cryptography, but physical-device and deployed-origin verification remain release checks.

## Changed files and checks

Production: `app/mfa/page.tsx`, `app/mfa/mfa.css`, `app/components/access-shell.tsx`, `app/components/mfa-form.tsx`, `app/components/mfa-challenge.tsx`, `app/components/mfa-code-form.tsx`, `app/components/mfa-enrollment.tsx`, `app/components/recovery-codes.tsx`, and `lib/api/use-mfa-operation.ts`. Test fixture extraction preserves existing MFA scenarios in `tests/e2e/mfa.spec.ts`; new files are `tests/fixtures/mfa.ts` and `tests/e2e/mfa-quality.spec.ts`. Concepts, this report and the milestone/backend handoff documents record the scope.

Commands: frontend `npm run lint`, `npm run typecheck`, `npm run build`, scoped Prettier and Vitest, and Playwright across MFA/new quality/account-security plus prior authentication routes. Backend scoped Vitest covers identity security, WebAuthn policy and identity boundaries. External helpers run the real browser/API/database journey and capture screenshots.

## Remaining scope

No new backend gap was identified. [REL-03](../../../BACKEND_IMPLEMENTATION_GAPS.md) retains deployed session, real-device and origin-specific MFA verification. [Customer account security](customer-security.md) and [staff/admin security](admin-security.md) subsequently passed their separate gates; other account/dashboard/role pages remain open. This page does not certify those routes or the whole application. The full goal remains active.
