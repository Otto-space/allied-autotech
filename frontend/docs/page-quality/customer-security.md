# Customer account security

Status: locally accepted, 8 October 2026. Route `/dashboard/security`. This is the twenty-eighth completed expanded milestone. The staff/admin security route remains a separate page gate; shared behavior changes require regression coverage there.

## Audit

Four baseline views at 390/768/1280/1440px show a long sequence of password fields, session records and MFA records in the existing dashboard shell. Controls and metadata lack a compact hierarchy; password-change and factor-removal fields have no reveal controls and retain sensitive draft markers. Preserve the current dashboard navigation, role boundary and real data while improving this page with a deliberate header, section navigation, compact form/control sizing, readable session/factor rows and complete review/error/loading states.

## Contracts

`GET /auth/session` establishes the role/session boundary. Full-auth reads `/auth/sessions` and `/auth/mfa/factors` return only the account's records; sessions omit revoked/expired/idle-expired entries and expose coarse client labels and masked network addresses. CSRF-protected `DELETE /auth/sessions` revokes other sessions; `DELETE /auth/sessions/:sessionId` rejects the current session and scopes other changes to the actor. The current session ends through the existing logout action.

`POST /auth/password/change` validates the current password and a 12-128-character non-common new password. It updates the hash, invalidates unused reset links, revokes other sessions, audits the change and renews the current session token/CSRF before frontend session revalidation. `DELETE /auth/mfa/factors/:factorId` requires the password, owns the active factor, rechecks password/role while holding the account lock, and prevents privileged accounts removing their final active factor. Customers may remove their final factor. Existing sessions and recovery codes are not revoked by factor removal.

`POST /auth/mfa/recovery-codes/regenerate` replaces all prior code hashes and returns new plaintext codes once. The frontend currently requires an active factor before exposing replacement; it must preserve explicit review, private display, copy/download/hide and uncertainty handling. Enrollment links to the separately completed `/mfa?setup=1`. All mutations preserve existing CSRF, response validation, safe error copy and review behavior. No missing backend contract identified at audit time.

## Plan

Fresh concepts precede production edits. Use customer-route styling and opt-in structural presentation where shared components need adjustment; retain the separate staff/admin page's current presentation until its gate. Improve independent password reveal, clear sensitive drafts, hide unavailable role actions, provide readable factor statuses, and strengthen restored-page and cancellation behavior where needed. Implementation and verification are recorded below.

## Implementation

The customer route opts into a compact `SecurityPanel` presentation while keeping the existing dashboard shell, role/session boundary and semantic breadcrumbs. Password and MFA panels use a 42/58 desktop grid, followed by the full-width session list. Smaller screens use one column with wrapping section anchors. Secondary session/factor timestamps remain available through keyboard-operable disclosures; server labels, network masks and timestamps are preserved.

Password-change and factor-removal forms have independent labeled reveal buttons, remask when hidden or entering review, and no sensitive draft markers. Reviews omit passwords. Cancellation, completion and session changes retain credential clearing. Restoring a persisted page invalidates the session view, clearing private recovery codes. Session revocation requests now abort when their component unmounts and do not trigger a late refresh after abort. Existing review, CSRF, stale-session, pending and uncertain-outcome controls remain in place.

Real-backend acceptance exposed a pre-existing frontend contract mismatch: Prisma sessions have nullable `lastUsedAt`, and newly issued sessions legitimately return null. The frontend schema now accepts that value; the list and review show **No activity recorded** without inventing a timestamp. Browser regressions exercise this for both customer and staff accounts. No backend change or migration was needed.

## Concepts and fidelity review

Fresh [desktop](security-oct-concepts/desktop.webp), [mobile](security-oct-concepts/mobile.webp) and [state](security-oct-concepts/states.webp) concepts preceded production changes. The [concept notes](security-oct-concepts/README.md) describe the intended structure and the generated details that must not become real product data.

| Finding against the concepts                                                        | Implemented correction or deliberate treatment                                                                                                                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The original page stacked all long sections on desktop.                             | Password and MFA share a 42/58 grid, with sessions spanning the row below; mobile remains one column.                                                                             |
| Shared form styles displaced the password panel 28px below MFA.                     | Customer-scoped specificity restores aligned panel tops without changing other dashboard forms.                                                                                   |
| Shared article styles retained large nested cards and 18px record headings.         | Customer records use compact 15px headings, dividing rules and reduced padding.                                                                                                   |
| Credentials lacked independent visibility controls.                                 | Each password has a 44px reveal control, visible focus treatment and automatic remasking.                                                                                         |
| Every session timestamp competed for attention.                                     | Network and last activity remain visible; creation, expiry and MFA verification are disclosed on demand.                                                                          |
| Generated concepts included substitute branding, identities and device details.     | The actual Allied logo, Quicksand interface font, existing navigation and backend record labels remain authoritative. No invented device location or security score is displayed. |
| Recovery-code actions touched and the nested section inherited excessive spacing.   | Scoped recovery spacing separates download/hide buttons and reduces the nested section gap, retaining all private-code actions.                                                   |
| Mobile review and long labels needed complete actions without horizontal scrolling. | Wrapping labels, constrained dialog width, stacked small-screen actions and scrollable review content preserve access at 320px and short heights.                                 |

The final standard fixture is 2,653px tall at 390px and 1,702px at 1440px, compared with the captured baseline of 3,889px and 2,985px respectively. These are fixture-specific full-page heights, not a promise to fit all account data in one viewport. Vertical scrolling remains appropriate; horizontal page scrolling is absent at all ten tested widths.

## Verification evidence

- **37 browser scenarios passed:** 21 customer-quality scenarios plus 16 existing security scenarios, including staff restrictions and nullable session activity. Checks cover 320/360/375/390/430/768/1024/1280/1440/1536px, section anchors, minimum target sizes, page errors, independent reveal/remask, review privacy, cancellation focus, restored-page clearing, short dialogs, partial/malformed/empty reads, rejected and uncertain mutations, recovery-code replacement/private display/hide, cross-tab changes and expired sessions. Axe checks at four widths and the short-dialog check found no covered violations.
- **45 frontend unit tests passed** across mutation review, API client, account mutation and feedback. **11 backend tests passed** across identity security and identity boundaries.
- Production build, full ESLint, TypeScript and scoped Prettier checks passed. The accepted build and all 37 browser scenarios also passed after the final recovery-code spacing refinement.
- Four baseline screenshots and sixteen final/state screenshots were captured outside the repository with synthetic accounts/codes. The final capture matrix records no horizontal overflow. Desktop/mobile standard views, password review and recovery-code states were visually inspected against the concepts.
- Playwright used installed Microsoft Edge against the standalone production build because browser-plugin tooling was unavailable. Automated accessibility evidence supplements the keyboard/visual checks; it is not a whole-application accessibility certification.

### Actual API/database acceptance

The external helper starts the actual Express app against the isolated PostgreSQL database `allied_vehicles_qa`, using fresh in-process keys and synthetic accounts. Browser auth calls forward to those real endpoints without replacing response data. Delivery and payment providers remain disabled.

The journey signs in with actual TOTP, creates two additional sessions, revokes one then the remaining other session, and verifies that the current session survives. It replaces ten recovery codes, checks their hashes and removal of the old code, removes the customer's authenticator using the current password, and changes the password through the visible reviews. Database assertions confirm the new password hash, invalidation of an unused reset token and renewed token/CSRF hashes on the existing session record. The old cookie and password receive 401; the new password succeeds. Current-session deletion receives 409, deletion of another account's session has no effect, and a missing-CSRF mutation receives 403. No browser page errors occurred.

The first real run failed because the old frontend schema rejected nullable session activity. The successful rerun verifies the corrected contract with real newly created sessions. This failure and correction are part of the acceptance evidence; a fixture-only pass would have missed it.

### Evidence locations and commands

External evidence under `C:/Users/PC/.codex/`: `security-oct-before-{width}.png`, `security-oct-final-{width}.png`, review/removal/codes screenshots, `security-oct-final-browser.log`, `security-oct-unit.log`, `security-oct-backend.log`, `security-oct-real-final.log`, `security-oct-final-lint.log`, `security-oct-final-type.log`, and the accepted-build/browser/capture logs. Helpers are `security-oct-baseline.cjs`, `security-oct-capture.cjs` and `security-oct-real.cjs`. Real helper assertions completed with process exit 0; experimental Node WebCrypto warnings are separate from its acceptance result. These local evidence files are not committed product assets.

Commands: frontend `npm run build`, `npm run lint`, `npm run typecheck`, scoped `npx prettier --check`, `npx vitest run` for the four named unit suites, and `npx playwright test tests/e2e/security.spec.ts tests/e2e/customer-security-quality.spec.ts` with the local preview origin. Backend scoped Vitest covers identity security and identity boundaries; the actual acceptance helper uses `node --import tsx`.

## Changed files and remaining scope

Production: `app/dashboard/security/page.tsx`, `app/components/account-security.css` (subsequently extracted during the staff/admin gate), `app/components/security-panel.tsx`, `password-change-form.tsx`, `factor-removal-form.tsx`, `security-factors.tsx`, `security-sessions.tsx`, and `lib/api/security-schemas.ts`. Tests: extracted `tests/fixtures/security.ts`, retained `tests/e2e/security.spec.ts`, and added `tests/e2e/customer-security-quality.spec.ts`. Concepts, this report and the progress/backend documents record the local scope.

No new mandatory backend gap remains from this page. [REL-03](../../../BACKEND_IMPLEMENTATION_GAPS.md) retains deployed cookie/proxy/session and MFA checks. [Staff/admin security](admin-security.md) subsequently passed its own visual route gate; its report records that later scope. Other account, dashboard and role routes remain open, and the full goal remains active.
