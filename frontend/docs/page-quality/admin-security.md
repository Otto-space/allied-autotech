# Staff and administrator account security

Status: locally accepted, 8 October 2026. Route `/admin/security`, shared by Staff, Admin and Super Admin. This is the twenty-ninth completed expanded milestone.

## Audit and contracts

Four baseline screenshots at 390/768/1280/1440px show the original stacked security layout. Passwords have no reveal buttons in this presentation. Sessions show every timestamp in tall cards. MFA protection is explained, but a forbidden final-factor removal button remains disabled rather than being omitted. Reuse the accepted customer security components and visual primitives while preserving the staff dashboard shell and per-role navigation.

The dashboard rejects customer sessions and redirects pending MFA to `/mfa`. Security operations use the current user's existing `/auth/session`, `/auth/sessions`, `/auth/password/change`, `/auth/mfa/factors` and `/auth/mfa/recovery-codes/regenerate` endpoints. Writes require full authentication and CSRF. No admin capability grants access to another account's credentials or MFA. Staff profile capabilities affect navigation, not this own-account page.

Password changes require the current password and a 12-128-character validated new password, revoke other sessions and unused reset links, and renew the current session token/CSRF. Individual session revocation rejects the current session and scopes other IDs to the actor. Last activity may be null on newly issued sessions. Factor removal verifies the password, locks/rechecks the account and requires privileged roles to retain at least one active factor. Pending and revoked factors are not removable. Recovery-code replacement returns fresh codes privately once, replacing all old hashes. Preserve explicit review, uncertain-result controls, resource loading/error states, private-code clearing and restored-page session revalidation.

## Design plan

Generate fresh desktop, mobile and state concepts before production changes. Keep the real Allied wordmark and existing role-aware shell. Use Quicksand, official ink/red/white, cool grey dashboard background, compact bordered forms, 44px controls, 48px inputs and visible focus. Reuse the customer grid and disclosures through shared account-security styles; keep customer copy and layout stable. Introduce a short privileged-account MFA explanation, omit prohibited removal actions, and enable independent password reveal. Test all three privileged roles, customer and pending-MFA redirects, permitted second-factor removal, final-factor protection and cross-tab secret clearing. Run customer/shared-security regressions and actual backend acceptance. No new backend capability is identified at audit time.

## Implementation

Both security routes now use `app/components/account-security.css`, extracted from the completed customer route without duplicating the design. `SecurityPanel` has explicit customer/staff presentations; the staff route adds its work-account description and neutral MFA requirement note. Shared password/MFA/session components use the compact layout, independent password reveal, accessible section anchors, masked-network metadata and timestamp disclosures. The existing own-account APIs, dashboard role boundary and capability-filtered navigation remain authoritative.

Prohibited final-factor removal is omitted for privileged accounts while its explanation remains visible. A second active factor can still be removed through the password form and explicit review. Pending/revoked factors have no removal action. Customer accounts retain their existing ability to remove their final factor. Reusing compact presentation also applies existing remasking, credential clearing, restored-page session invalidation, recovery-code privacy and uncertain-result controls to this route. No backend code, contract or migration changed.

## Concept and fidelity review

Fresh [desktop](admin-security-oct-concepts/desktop.webp), [mobile](admin-security-oct-concepts/mobile.webp) and [state](admin-security-oct-concepts/states.webp) concepts preceded implementation. The [design notes](admin-security-oct-concepts/README.md) establish tokens, hierarchy, copy and intentional treatment of generated details. Concept and final desktop/mobile/state images were inspected with `view_image` in the acceptance pass.

| Comparison                         | Render evidence and decision                                                                                                                                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main hierarchy and panel alignment | Account heading and section anchors lead into a 42/58 password/MFA grid and full-width sessions; the panel tops align. Below 1100px, sections stack.                                                                                                                   |
| Forms and password controls        | Three 48px fields retain visible borders and independent 44px eye controls. Removal has its own reveal control. Reviews omit credentials and remain usable at 320x420.                                                                                                 |
| Typography and palette             | Quicksand interface type, official ink/red/white, cool-grey canvas, neutral status badges, 30/27px title and compact 20/15px section/record hierarchy match the written design tokens. Generated green/blue decoration was intentionally excluded.                     |
| Privileged MFA state               | The final active factor has explanatory text and no removal action; two active factors expose the permitted reviewed action. A short top-level note explains the work-account rule without repeating the longer factor text verbatim.                                  |
| Records and mobile continuation    | Divided records replace the old tall nested cards. Network/last activity remain visible; secondary timestamps use native disclosures. Mobile metadata and actions wrap into readable rows without horizontal scrolling.                                                |
| Actual shell, icons and data       | The real logo, Lucide navigation, role-specific menu and server factor/client labels are preserved. Generated names, vendor logos, locations, footer/tagline and additional sign-out section are not product data and were excluded before implementation.             |
| Reviews and recovery codes         | Existing consequence wording, focus behavior, error recovery, private textarea, explicit download and hide controls remain. Neutral bordered secondary controls preserve the established account-security system rather than adding red to every action.               |
| First-viewport copy                | Heading, staff description, MFA requirement and section-anchor labels match the implementation inventory. Existing password consequences and pending-factor explanation retain authoritative wording. No security score, invented status or marketing claim was added. |

The final standard fixture measures 2,681px at 390px and 1,780px at 1440px, reduced from 3,903px and 3,048px in the baseline. These are full-page fixture measurements; vertical scrolling remains necessary. The generated desktop overview is 1536x1024, and an additional exact 1536x1024 viewport capture was inspected; the responsive matrix uses 900px-high viewports and the short-screen test uses 420px. Long full-page captures include the complete route. The implementation follows the adopted concepts and documented existing-system constraints, with no unresolved material layout issue identified in this pass.

## Verification

**59 browser scenarios passed:** 22 new staff/admin scenarios, 21 customer-security scenarios and 16 shared security scenarios. New cases cover ten widths (320/360/375/390/430/768/1024/1280/1440/1536), section navigation, 44px targets, page errors, four Axe scans, all three privileged roles, permitted second-factor removal, hidden final/pending/revoked removal actions, customer redirection, pending-MFA redirection, exact recovery download contents, restored-page private-code clearing and short-screen password review. Shared scenarios cover read failures, malformed/empty responses, wrong passwords, uncertain mutations, CSRF submission, cancelled review focus, cross-tab changes and expired sessions. The customer suite passed against the extracted shared stylesheet.

**45 frontend unit tests passed** across mutation review, API client, account mutation and feedback. **11 backend tests passed** across identity security and identity boundaries. Full ESLint, TypeScript, production build and scoped formatting checks passed. Four baseline views and sixteen final/state captures record no horizontal overflow. Playwright used installed Microsoft Edge against the standalone build because browser-plugin tooling was unavailable. Automated Axe checks are scoped evidence, not a whole-application accessibility certification.

### Real API/database acceptance

An isolated Express instance used the existing PostgreSQL QA database, fresh in-process keys and synthetic accounts. Browser auth calls forwarded to actual endpoints without replacing response data. The administrator journey completed real TOTP sign-in, single/all-other session revocation, ten-code replacement, second-factor removal and password change. Database assertions verified retained current access, code hashes, the remaining active factor, password hash replacement, unused reset-token revocation and renewal of the current session token/CSRF. Old cookie/password returned 401; the new password succeeded. Current-session deletion returned 409, another account's session was unchanged and missing CSRF returned 403. No browser page error occurred.

Direct deletion of the final factor returned 409 for both ADMIN and STAFF. Super Admin received browser scenario coverage and read-only policy confirmation: `mayRemoveFinalMfaFactor` permits only CUSTOMER. An attempted additional real Super Admin fixture was rejected by the database's single-owner constraint; the existing owner was left untouched. This report does not claim a real Super Admin mutation journey. The final successful helper uses ADMIN/STAFF and preserves the single-owner safeguard. All providers stayed disabled; no real email, SMS or payment delivery was exercised.

### Evidence and changed files

External QA evidence is under `C:/Users/PC/.codex/`: `admin-security-oct-before-{width}.png`, final/review/removal/codes screenshots, baseline/capture helpers and logs, `admin-security-oct-browser.log`, `admin-security-oct-real-accepted.log`, `admin-security-oct-unit.log`, `admin-security-oct-backend.log`, build/lint/type/format logs. The real helper exited 0; Node experimental WebCrypto warnings did not change its assertions. Captures use synthetic credentials/codes and stay outside the product repository.

Production changes: `app/admin/security/page.tsx`, `app/dashboard/security/page.tsx`, `app/components/account-security.css` (moved from the customer route), `security-panel.tsx` and `security-factors.tsx`. Tests: `tests/e2e/admin-security-quality.spec.ts`, the explicit final-factor expectation in `security.spec.ts`, and pending-MFA fixture support in `tests/fixtures/security.ts`.

Commands: frontend `npm run build`, `npm run lint`, `npm run typecheck`, scoped Prettier/Vitest and `npx playwright test tests/e2e/security.spec.ts tests/e2e/customer-security-quality.spec.ts tests/e2e/admin-security-quality.spec.ts`; backend scoped identity Vitest; external helpers with `node --import tsx`.

## Remaining scope

No new mandatory backend gap was found. [REL-03](../../../BACKEND_IMPLEMENTATION_GAPS.md) retains deployed session/cookie/proxy, physical-device/origin MFA and target-environment account acceptance. The next route is the customer dashboard overview `/dashboard`; the other account/dashboard/role routes remain open. This local page milestone does not complete the full application goal.
