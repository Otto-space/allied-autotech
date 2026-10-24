# Login

Status: locally accepted on 8 October 2026, the twenty-second expanded milestone. Route: `/login`. Registration subsequently passed its [separate gate](register.md), including regression checks of the shared AccessShell.

## Contract and behavior

Authentication layout update, 13 October 2026: the shared `AccessShell` now omits the decorative workshop image. The existing 46/54 desktop split, logo, dark brand panel, motto, white form area and mobile form-first layout remain. The brand panel has its own viewport height and the form starts at a stable position, so validation messages and shorter confirmation states cannot resize the branding or recenter the form heading. This supersedes the image-based composition described in the original acceptance record below. The homepage's opening headline now uses “Built on Trust Driven by Quality.”, matching the authentication panel, About page, footer and invoice motto.

The page uses existing `POST /auth/login` and authenticated `POST /auth/csrf` contracts. The backend normalizes email, verifies Argon2 credentials, checks active/verified/lock state, applies request/account throttles, creates an HttpOnly session and independently enforces MFA. Work accounts always require MFA; customers with an enrolled factor also require it. No backend endpoint, schema or migration was added.

The form validates the returned identity, role and MFA flag before continuing. Unsupported or external `next` destinations fall back to the customer dashboard, including work-dashboard paths supplied to a customer. MFA-required responses route to the existing `/mfa` page; this gate verifies handoff, not completion of every MFA method or preserving a continuation through MFA.

The password reveal control has an explicit accessible name/state and 44px target. Inputs retain autocomplete attributes and native email/required/length validation. A ref-based lock prevents duplicate submissions; passwords are cleared and re-masked immediately after submission. Credentials are not stored by this form. Session changes, cross-tab invalidation and restored-page events clear form values and discard pending results. Unmount aborts pending work. Success requires both a valid login receipt and CSRF refresh; failures retain recovery links and show sanitized feedback. The form uses POST, and without JavaScript it is hidden with an explanatory message rather than submitting credentials in a URL.

## Design and implementation

Four baseline captures at 390, 768, 1280 and 1440px preceded three fresh [design concepts](login-oct-concepts/README.md). The desktop page pairs the existing workshop editorial image and approved tagline with a focused white form area. On widths below 900px, the decorative image/story is omitted and the home-linked brand, breadcrumb, form and help remain. Other authentication pages still use their existing shell until their own gate.

| Comparison | Final design decision                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout     | Preserve the 46/54 desktop split and mobile form-first composition.                                                                                                     |
| Density    | Cap the form at 440px, with a 34px desktop heading and 14–16px controls instead of the concept's enlarged presentation scale.                                           |
| Brand      | Use the real Brand component and local Nippo/Quicksand fonts. Keep the approved workshop asset with no added overlay.                                                   |
| Controls   | Retain visible cool-grey borders, restrained red focus, 48px inputs and submit action, 44px reveal and recovery links.                                                  |
| Navigation | Real Home / Sign in breadcrumb, home-linked logo, skip link, registration/recovery links and the existing account-security Help article.                                |
| Copy       | Preserve primary concept labels and tagline; omit example placeholders. Normalize inherited uppercase button styling back to the concept's sentence case.               |
| States     | Generic backend failure copy, pending lock and spinner, no fabricated authentication success, and cleared passwords instead of the state concept's sample masked value. |

## Verification

The final production build passed **44 browser scenarios**: 40 login scenarios and four existing shared authentication/navigation regressions. All ten target widths (320/360/375/390/430/768/1024/1280/1440/1536px) fit without horizontal overflow. Five Axe scans passed, covering four widths and invalid-credential feedback on a short screen. Keyboard skip/navigation, 44px actions, password reveal, duplicate submission, malformed receipts, failed CSRF refresh, network/401/429/503 failures, safe redirects, all four MFA-role handoffs, cross-tab/session/back-forward clearing, no-JavaScript fallback and short-screen enlarged text were exercised.

Full frontend lint, type checking, production build and scoped formatting passed. **26 frontend unit checks** passed across response/redirect validation and shared feedback. **Nine existing backend identity security/boundary tests** passed. No backend implementation changed.

Real isolated API/database/browser checks verified customer continuation to Saved items and Staff/Admin/Super Admin handoff to MFA, one new persisted session per sign-in, HttpOnly cookies, HMAC-only persisted session tokens and denial of privileged reads before MFA. Unverified and unknown accounts returned the same generic authentication failure; untrusted-origin login returned 403. Customer/Staff/Admin plus the negative checks were repeated on the final build; Super Admin passed on the prior build with identical login behavior. The repeat intentionally avoids creating a second Super Admin, which the database correctly prohibits. No browser page errors occurred.

Ten final screenshots and two error-state captures were produced; desktop, tablet, narrow-mobile and error-state renders were inspected against the concepts. Corrections included inherited uppercase/glowing button styling, an undersized optimized image for the tall crop, and the no-JavaScript fallback. The enlarged-text test now changes allowed element styles without weakening CSP. An initial fixture lacked the required envelope message; it was corrected before the final full pass. These test-fixture failures are not treated as successful coverage.

Browser plugin unavailable: Playwright with Edge is used. Temporary captures, scripts and logs remain outside the repository at `C:/Users/PC/.codex/login-oct-*`. Controlled browser fixtures test failures and responsive states; separate real checks use only synthetic accounts in isolated `allied_vehicles_qa` on port 55439. No production credentials or customer messages are used.

## Remaining scope

Registration has passed its separate gate. Password recovery, verification and MFA-method pages retain their own visual/interaction gates. Deployed cookie/proxy behavior, provider delivery, other browser engines and physical assistive-technology/device verification remain separate. Existing sessions on login are not automatically redirected; customers can explicitly sign in. The full application goal remains active.
