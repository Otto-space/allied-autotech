# Forgot password

Status: locally accepted on 8 October 2026, the twenty-fourth expanded milestone. Current route: `/forgot-password`. The Login and Registration gates are complete; reset-password, verification and MFA remain separately gated.

## Audit and planned scope

Baseline captures at 390/768/1280/1440px show a narrow generic card with a nearly invisible email input, no route breadcrumb, and the older shared email-action form. Scope: bring this page into the accepted Login/Registration design, make the email field and recovery actions clear, and add complete pending, accepted and failure states without horizontal scrolling. Preserve native email validation, privacy and working sign-in/help paths.

Existing contract: `POST /auth/password/forgot`, strict email-only body, trusted-origin enforcement, five attempts per hour and a generic 202 response. Only active, email-verified accounts receive a newly hashed reset token and encrypted outbox event; previous unused tokens are revoked. Unknown, unverified and inactive accounts receive the same generic response. The frontend must never infer account existence or promise provider delivery. A new recovery request may supersede an earlier link.

The route uses AccessShell and a dedicated recovery request form. Existing reset/verification form behavior remains scoped to its later gates. No new backend endpoint or schema was needed. Concepts preceded production edits; scoped verification evidence follows.

## Implementation

The dedicated form now uses AccessShell's recovery context, route breadcrumb, skip link, 48px bordered input/action, clear help and sign-in links, and compact typography. Its accepted panel removes the entry form, clears the email and focuses the heading. The generic message is fixed frontend copy rather than arbitrary backend prose. Use another email restores the empty form and focus. No address is stored by the form-draft system.

Native email constraints and a matching client schema validate input. A ref-based lock prevents duplicate submission; pending controls are disabled. Abort, account/session changes, cross-tab events and restored pages discard pending results and clear the address. No-JavaScript visitors receive explanatory text and a Help link; the hidden form uses POST. Network/invalid-response failures advise checking email before retrying because a missing receipt cannot prove the server did nothing.

ApiError now exposes a parsed Retry-After value without altering existing status, message or response-envelope handling. The recovery form disables retries until the indicated delay elapses, displays a rounded waiting interval, and never resubmits automatically. Missing or malformed headers retain the generic rate-limit guidance. The timer is bounded to a day; backend limits remain authoritative across refreshes and devices.

## Fidelity ledger

Fresh [desktop](forgot-oct-concepts/01-desktop.webp), [mobile](forgot-oct-concepts/02-mobile.webp) and [state](forgot-oct-concepts/03-states.webp) concepts preceded production edits. The [concept decisions](forgot-oct-concepts/README.md) preserve the brand and existing asset requirements.

| Area           | Concept evidence                                                            | Browser evidence and final decision                                                                                                      |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Composition    | Ink workshop beside a white, compact form                                   | Preserve the accepted 46/54 shared desktop shell and 440px form; mobile omits the editorial region                                       |
| Typography     | Bold rounded interface heading; desktop generated a serif editorial heading | Keep Quicksand for UI and required Nippo for editorial text; reject the generated serif substitution                                     |
| Photography    | Workshop/technician framing                                                 | Retain the approved existing workshop image with its separate ink story area; generated signs and people are not new production assets   |
| Navigation     | Home/current-page trail on desktop; incomplete mobile breadcrumb            | Use the actual Home / Forgot password breadcrumb, semantic navigation and a keyboard skip link at every width                            |
| Input/actions  | Clearly bordered email field, red action, secondary links                   | 48px input/primary action and 44px links; default actions fit all ten tested widths/heights                                              |
| Accepted state | Centered mail, generic guidance, sign-in/restart                            | Mail was initially left-aligned by inherited SVG styling; explicit auto margins correct it. Clear the email and focus the result heading |
| Failure state  | Inline pale-red feedback above email                                        | Reuse accessible Feedback, sanitize field errors, retain recovery/navigation, and explain uncertain outcomes                             |
| Compact mobile | Form-first portrait composition                                             | Wrap heading/copy at 320px without hiding content or allowing horizontal page scrolling; short enlarged-text screens scroll vertically   |

## Verification evidence

The first combined browser pass had 88 passes and 11 test-selector failures: desktop tests incorrectly required the hidden mobile logo to be visible, and error locators also matched Next.js's separate route announcer. After scoping assertions to visible controls and the main landmark, **all 99 combined scenarios passed**: 28 recovery, 40 Login, 27 Registration and four existing auth/navigation regressions. After the icon-only CSS correction, the final production build and all 28 recovery scenarios passed again; shared Login/Registration behavior was unchanged by that scoped CSS correction.

Six recovery Axe scans passed: four default viewports, accepted state and field-error state. Browser coverage includes native validation, generic receipt/reset/restart, 422/403/429/503/network/malformed responses, Retry-After expiry, duplicate requests, session/cross-tab/restored-page changes, no-JavaScript fallback, keyboard navigation and short-screen enlarged text. All ten target widths (320/360/375/390/430/768/1024/1280/1440/1536px) showed no horizontal overflow; default controls fit at 844px height below 900px width and 900px height above. These checks do not promise error states fit every short screen without vertical scrolling.

**79 frontend unit tests passed** across Retry-After parsing, API-client regressions, Login/Registration and feedback. **11 backend identity tests passed**, including strict rejection of invalid recovery input/additional fields before persistence. Frontend lint, type checks, final production build and scoped formatting passed. No production backend contract, schema or migration changed.

Real browser/API/database checks on isolated `allied_vehicles_qa` (PostgreSQL port 55439, API 5012) verified eligible 202, generic unknown/unverified 202, two hashed reset tokens with only the newest active, two encrypted outbox events, no session creation, real 429 with Retry-After, cross-origin 403 and zero page errors. Email/SMS delivery was disabled. The first ad-hoc verification read UTC database timestamps as local time; the helper was corrected to parse Prisma's UTC timestamps explicitly, and its full rerun passed without resetting or bypassing the request limit. That was a QA timestamp-parser defect, not a token-expiry implementation change.

Playwright with Edge exercised `http://localhost:3001` because the Browser plugin was unavailable. Captures, traces and helpers are outside the repository at `C:/Users/PC/.codex/forgot-oct-*`. Ten final default captures plus accepted/error captures at 390 and 1440px were produced; representative mobile, desktop and state comparisons were inspected against the concepts. No temporary credentials or raw recovery tokens were published.

## Remaining scope

Production files: `app/forgot-password/page.tsx`, `app/forgot-password/forgot-password.css`, `app/components/forgot-password-form.tsx`, `app/components/access-shell.tsx`, `lib/api/client.ts` and `lib/api/retry-after.ts`. Added recovery fixture/browser tests and Retry-After unit tests; extended API-client and backend identity boundary coverage. Related milestone and backend handoff documents were updated.

Commands: `npm run lint`, `npm run typecheck`, `npm run build`; scoped `prettier --check`; `vitest run` for Retry-After/API-client/Login/Registration/feedback; `playwright test` for recovery/Login/Registration/shared-auth followed by the recovery-only final rerun; backend `oxlint` and identity unit/API `vitest run`. The external real-API helper and screenshot script supplied the separately described database and visual evidence.

Actual provider delivery, token consumption/expiry and deployed recovery/session behavior remain under REL-03 in the [backend gap register](../../../BACKEND_IMPLEMENTATION_GAPS.md). This gate covers requesting a link, not the separate reset-password page or the entire recovery journey. Reset-password subsequently passed its [separate gate](reset-password.md). Verification, MFA and account-security routes remain open. Other browser engines, physical keyboard/device combinations and assistive-technology checks remain unverified. The whole-application goal remains active.
