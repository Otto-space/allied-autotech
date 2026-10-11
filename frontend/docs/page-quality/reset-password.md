# Reset password

Status: locally accepted on 8 October 2026, the twenty-fifth expanded milestone. Route: `/reset-password`. This follows the completed Forgot-password gate; verification, MFA and other account routes remain separate.

## Audit and scope

Four baseline captures at 390/768/1280/1440px show the older generic card, weak input borders, no breadcrumb and no reveal controls. The current form accepts recovery-token fragments and manual token entry. Preserve both supported paths while applying the accepted auth shell, clear labels, compact controls and complete states without horizontal overflow.

Existing `POST /auth/password/reset` accepts a strict token/password body, with a 32–512-character token and a 12–128-character non-common password. Trusted-origin enforcement and a ten-attempts-per-fifteen-minutes limit apply. The transaction consumes a current unused token, updates the Argon2 password hash, clears login lock counters, revokes other reset tokens and active sessions, and records PASSWORD_RESET in the audit log. The controller clears the session cookie and returns 200. Invalid, expired, consumed or revoked tokens return generic TOKEN_INVALID (400). No additional backend contract is needed.

Completed scope: shared shell and breadcrumb; email-link token held in the masked, collapsed disclosure; manual entry retained; reversible reveal controls; no sensitive drafts; fragment removal without discarding router history state; native/client validation; explicit pending, invalid-link, uncertain-result, rate-limit and success states; session/cross-tab/restored-page clearing. No reset occurs on page load. Concepts and baseline review precede production edits. Scoped verification evidence follows.

## Implementation and behavior

AccessShell now uses a typed page-context map for Login, Registration, Forgot password and Reset password. Existing routes retain their labels, anchors and layout. Reset has a dedicated client form and scoped stylesheet; the legacy shared form remained at this checkpoint and was subsequently retired by the separate verification gate.

The email-link token is read from the fragment when the input mounts, removed from the address without replacing Next.js history state, and held in a masked, collapsed disclosure. Manual token entry remains available. Query-string tokens are not adopted. New token fragments clear prior input and pending work; ordinary anchors such as the skip link leave the token intact. Native validation opens an empty collapsed token field so it can receive focus.

Token and password reveal controls are independent, labelled, keyboard-operable and re-mask on submission, hidden-page and account changes. Passwords clear immediately when a valid request starts. Tokens remain available after a password-validation or rate-limit rejection, and clear after completion, invalid-link or uncertain-result states. Values are excluded from form drafts. No-JavaScript visitors receive an explanation and recovery/help links; the hidden form uses POST.

A synchronous lock prevents duplicate requests. Abort, unmount, session changes, cross-tab changes and restored pages discard obsolete results. Completion requires a valid API receipt, broadcasts the existing password-change session invalidation, clears credentials and focuses the result heading. Invalid links offer a new link or explicit manual token entry. Missing/malformed/network/5xx results offer sign-in or new-link guidance without blindly replaying a potentially consumed token. Retry-After pauses retries when supplied. These frontend controls do not replace server token, password or session enforcement.

## Fidelity ledger

Three fresh [desktop](reset-oct-concepts/01-desktop.webp), [mobile/manual-entry](reset-oct-concepts/02-mobile.webp) and [state](reset-oct-concepts/03-states.webp) concepts preceded implementation; see the [concept decisions](reset-oct-concepts/README.md).

| Area              | Concept evidence                                         | Browser evidence and final decision                                                                                                    |
| ----------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Composition       | Workshop editorial left, compact white form right        | Preserve the accepted 46/54 shell, 440px desktop form and existing photograph                                                          |
| Brand/type        | Rounded interface heading, dark editorial region         | Actual Brand, Nippo and Quicksand replace generated brand variants; no invented state-board tagline                                    |
| Link/manual paths | Collapsed disclosure on desktop, expanded manual example | Fragment entry collapses the masked token; missing fragments retain visible manual entry and new-link navigation                       |
| Controls          | Visible input outlines, compact eye buttons, red action  | 48px inputs/actions; independent 44px reveal buttons and 44px disclosure/navigation targets                                            |
| Breadcrumb        | Home/current route with generated icon/slash variations  | Real Home text link, Lucide chevron, aria-current and working skip link; skip navigation preserves the token                           |
| State layout      | Centered line icon, heading and actionable guidance      | Completed, invalid and uncertain panels preserve the hierarchy and actual backend meaning; secret values clear                         |
| Mobile density    | Complete portrait form                                   | Link and manual variants fit the tested target heights; 320px text wraps without horizontal page overflow                              |
| Errors            | Distinct invalid-link and uncertain-result panels        | A contradictory TOKEN_INVALID code on a 503 response initially selected the wrong state; status/code pairing now preserves uncertainty |

## Verification

An initial combined run passed 132 scenarios and timed out waiting for the existing Help-page mobile menu to open. The header was unchanged by this gate. That scenario passed three focused reruns without changes; the final combined rerun is recorded below. The timeout's cause was not established, and it is retained in the external first-run log rather than counted as a pass.

**All 133 combined browser scenarios passed on the final build:** 34 Reset password, 28 Forgot password, 40 Login, 27 Registration and four existing shared-auth/navigation regressions. Eight Reset-password Axe scans passed across four default widths and completed/invalid/uncertain/field-error states. Both linked and manual-entry layouts passed at 320/360/375/390/430/768/1024/1280/1440/1536px, with no horizontal overflow and visible default actions at the tested 844/900px heights. Short screens and enlarged text remain vertically scrollable. The initial focused run passed 29 of 30 scenarios and exposed the contradictory-503 classification defect, which was corrected before the final build. Additional checks cover forbidden requests, rejected query tokens, leaving pending work, re-masking on hidden pages and token preservation through the skip link.

**93 frontend unit tests passed** across fragment/credential boundaries, API-client behavior, Retry-After, Login/Registration and feedback. **11 backend identity tests passed**. Full frontend lint, type checking, production build and scoped formatting passed. No production backend, schema, dependency or API contract changed for this gate.

The real browser/backend/database helper passed on the final build. It mounted the actual Express app on an ephemeral local port with its own temporary keys and synthetic records in `allied_vehicles_qa` on port 55439. Only the browser reset request was forwarded to that real server; backend responses were not mocked. This isolated transport preserves the existing API process and its rate limits. Seeded tokens use the production purpose-specific HMAC helper. Verified outcomes: valid reset 200; expired, revoked and replayed tokens 400; common password 422; untrusted origin 403; two prior sessions revoked; one PASSWORD_RESET audit; session cookie cleared; old-password login 401; new-password login 200; no page errors. The first expired-token seed violated the database's expiry-after-creation constraint; the fixture's creation timestamp was corrected. The constraint was retained.

Email and SMS delivery were disabled. These checks prove reset handling with seeded tokens, not delivery of a provider email. Deployed email links, token TTL configuration and the full deployed recovery journey remain under REL-03.

Playwright with Edge used `http://localhost:3001` because the Browser plugin was unavailable. External QA artifacts at `C:/Users/PC/.codex/reset-oct-*` include four baselines, ten final default screenshots, two manual-entry captures and six state captures. Representative mobile, desktop and result views were compared with the concepts. Physical devices, actual password-manager/autofill tools, other browser engines and assistive technology remain outside this local gate.

## Files and commands

Production: `app/components/reset-password-form.tsx`, `app/components/access-shell.tsx`, `app/reset-password/page.tsx`, `app/reset-password/reset-password.css`, `lib/auth/password-reset.ts`, plus AccessShell prop updates in Registration and Forgot password. Added `tests/fixtures/password-reset.ts`, `tests/e2e/reset-password-quality.spec.ts`, `tests/unit/password-reset.test.ts` and the linked concepts/report. Milestone and backend handoff documents reflect this scope.

Checks: `npm run lint`, `npm run typecheck`, `npm run build`, scoped Prettier, six scoped frontend Vitest files, backend identity security/boundary Vitest files and Playwright reset/shared-auth suites. External scripts perform the real reset/database assertions and capture screenshots.

## Remaining scope

No new backend gap was identified. [Backend release verification](../../../BACKEND_IMPLEMENTATION_GAPS.md) remains open. Email verification and resend subsequently passed their [joint page gate](verify-email.md). MFA methods and remaining security/account pages are still open. This milestone does not certify those routes or the whole application; the full goal remains active.
