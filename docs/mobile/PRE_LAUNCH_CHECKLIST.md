# Pre-Launch Checklist and Cautions: Allied AutoTech Companion

**Intended location in the repo:** `docs/mobile/PRE_LAUNCH_CHECKLIST.md`
**Purpose:** one place that tracks everything that can block a store release, weaken security, or surprise the team and owner while the app is built. Update the status of each item as it is resolved, and link evidence (PR, screenshot, owner message).

**Evidence labels**
- **VERIFIED** means I read it in the repository at HEAD `80e95a386afeba3450cc5e66ed9afab421f52e65`.
- **GENERAL** means mobile or store-policy experience that must be confirmed against current official documentation or the owner before relying on it.

**Status legend:** `[ ]` open, `[~]` in progress, `[x]` done (add evidence).
**Needed by:** NOW (lead time), BUILD (while coding), BETA (before closed beta), SUBMIT (before store submission), ONGOING.

---

## A. Could block a store release

### A1. Staging gate and App Review (needed by SUBMIT)
- **Evidence:** VERIFIED that `privateTesting` rejects every `/api/v1` request without `Authorization: Basic ...` while `PRIVATE_TESTING_ENABLED=true` (staging and pre-launch production). GENERAL that reviewers must reach your API.
- **Risk:** reviewers get 401 on every call and reject the app.
- **Actions:**
  - [ ] Owner and developer agree the launch sequence: gate off before submission, or a dedicated review environment.
  - [ ] Prepare a reviewer demo account (no MFA) and written review notes.
  - [ ] Confirm launch mode through `GET /public/capabilities` on the day of submission.
  - [ ] Check that browse-and-enquire mode gives enough real utility to avoid a "minimal functionality" rejection.
- **Owner:** owner and developer.

### A2. Account deletion (needed by SUBMIT)
- **Evidence:** VERIFIED that `destructiveRetention.enabled` is hard-coded to `false` in the capability snapshot. GENERAL that the stores expect in-app deletion initiation (confirm current Apple and Google wording).
- **Actions:**
  - [ ] Owner and a lawyer decide the deletion and retention policy, including what must be retained and for how long.
  - [ ] Confirm exactly what the existing privacy-request flow does (`PrivacyRequest`); I have not verified this.
  - [ ] Build an in-app way to start deletion and explain what is retained.
- **Owner:** owner, lawyer, developer.

### A3. Store developer accounts (needed by NOW; long lead time)
- **Evidence:** GENERAL.
- **Actions:**
  - [ ] Create Apple Developer and Google Play accounts as **organisation accounts owned by Allied Autotech Limited**, not personal accounts.
  - [ ] Start any D-U-N-S or business verification now; it can take weeks.
  - [ ] Check Google Play's current testing requirements for new accounts.
  - [ ] Give the developer an admin role without transferring ownership.
  - [ ] Tell the owner early that an iPhone development build or TestFlight test needs the paid Apple account (see C10).
- **Owner:** owner.

### A4. Privacy policy and store disclosures (needed by SUBMIT)
- **Evidence:** GENERAL.
- **Actions:**
  - [ ] List all data the app collects: account details, vehicle details, support messages, photos, push tokens, diagnostics.
  - [ ] Make sure the privacy policy URL covers the app, not only the website.
  - [ ] Complete Apple's privacy labels and Google's data-safety form from that list; update them whenever push or analytics are added.
  - [ ] Keep analytics off until consent and lawful basis are approved.
- **Owner:** owner and developer.

---

## B. Security and hygiene

### B5. Secret exposure in repository history (needed by NOW)
- **Evidence:** VERIFIED. The secret-guard workflow's own description says a "known old Resend exposure must fail until cleaned" when history is scanned. `.env*` is git-ignored and only the `*.example` files are tracked.
- **Actions:**
  - [ ] Owner confirms the exposed Resend key was rotated.
  - [ ] Keep every clone and copy of the repository private; do not push it to a public host.
  - [ ] Never commit the staging perimeter password or any token; keep `.env.example` files empty.
  - [ ] Owner decides whether to clean the history.
  - [ ] Run the secret check before every push (`npm run check:secrets` in `backend/`; the CI guard also runs on every push).
- **Owner:** owner and developer.

### B6. No certificate pinning at first (needed by ONGOING)
- **Evidence:** GENERAL.
- **Reason:** pinning can lock every user out when a certificate rotates, and Cloudflare rotates them.
- **Actions:**
  - [ ] Revisit only after a stable release, with backup pins and a documented rotation plan.

### B7. Secret headers, logs and screenshots (needed by BUILD)
- **Evidence:** VERIFIED that backend request logging excludes headers and bodies. GENERAL for client-side tools.
- **Actions:**
  - [ ] Add `X-Device-Session` and the perimeter header to the redaction rules of any crash, logging or network-monitoring tool added to the app.
  - [ ] Blur or hide private screens in the app-switcher snapshot.
  - [ ] Add a test proving tokens never appear in logs or error reports.

---

## C. Technical traps

### C8. Everything is `no-store` (needed by BUILD)
- **Evidence:** VERIFIED. Every `/api/v1` response, and the resized-image route, is sent `private, no-store`.
- **Effect:** normal HTTP caching will not help users on expensive data.
- **Actions:**
  - [ ] Decide deliberately whether to cache public catalogue data in the app (memory and disk) and for how long.
  - [ ] Never persist private customer data to disk by default.
  - [ ] Later, ask the backend for `ETag` or `max-age` on public GET responses (a backend change that needs its own review).

### C9. Public images (needed by BUILD, decide in Package C)
- **Evidence:** VERIFIED. The website resizes public images through a Next route (`frontend/app/api/catalogue-image/...?w=<width>`, `sharp`, allowed widths only, 8 MB limit). The raw backend path serves the originals.
- **Actions:**
  - [ ] Choose: use the website's resize route (with its allowed widths), or request backend thumbnails.
  - [ ] Do not hotlink originals; test on a slow connection.
  - [ ] Note the extra dependency on the frontend host and, in staging, on its perimeter gate.
  - [ ] Decide the image cache policy (see C8).

### C10. Expo Go first, a development build before the sign-in work (needed by BUILD)
- **Evidence:** GENERAL; check the current Expo documentation for the chosen SDK.
- **Why:** Expo Go is Expo's app, not yours. It is fine for the scaffold, design system and public screens, but it cannot test your own app links or URL scheme (the sign-in redirect) and has limits on push and extra native libraries. A development build is your own app with live reload.
- **Actions:**
  - [ ] Run the scaffold, design system and public screens in Expo Go on an Android phone and a borrowed iPhone. Prefer libraries Expo Go supports, and note any that need a development build.
  - [ ] Before the sign-in work starts, create a development build. Android first: an installable build file needs no store account.
  - [ ] An iPhone development build generally needs a paid Apple Developer account and the test phone registered to it (or TestFlight). This depends on A3, so ask the owner early.
  - [ ] Test the sign-in redirect and app links only in a development build.
  - [ ] On a borrowed iPhone use test accounts only, no real customer data, and sign out and delete the app afterwards. Recent iOS versions need Developer Mode switched on for development builds (confirm current steps).
  - [ ] Plan for periodic Expo SDK upgrades and budget time for them.

### C11. Sign-in depends on the web login pages (needed by BUILD)
- **Evidence:** PROPOSED in `NATIVE_AUTH_DESIGN.md`.
- **Actions:**
  - [ ] Treat the `/mobile-auth` page and the verified app-link files as part of the app's contract.
  - [ ] Add an end-to-end test of the whole hand-off; tell the app team before any login-page redesign.
  - [ ] Design the return-to-app step after email verification and password reset, which open in the browser.

### C12. Generated API types can drift (needed by BUILD)
- **Evidence:** VERIFIED that the existing workflows are path-filtered (`backend/**`, `frontend/**`).
- **Actions:**
  - [ ] Make the mobile workflow also trigger on `backend/docs/api/allied-autotech.openapi.json`.
  - [ ] Add a step that regenerates the types and fails on any difference from the committed file.

---

## D. Real-world users

### D13. Budget Android phones and data costs (needed by BETA)
- **Evidence:** GENERAL.
- **Actions:**
  - [ ] Test on the cheapest Android phone available, not only a modern device.
  - [ ] Set a bundle-size and image-weight budget.
  - [ ] Remember that some brands' battery managers delay or kill push; never depend on push alone, and keep the in-app inbox complete.

### D14. Email deliverability (needed by BETA)
- **Evidence:** GENERAL. Verification and reset emails go through Resend.
- **Actions:**
  - [ ] Test delivery to Gmail, Yahoo, Outlook and common local providers.
  - [ ] Confirm the sender domain's SPF, DKIM and DMARC records.
  - [ ] Monitor bounces, and check that verification links work end to end from a phone.

---

## E. Process and expectations

### E15. Re-verify before each work session (needed by ONGOING)
- **Evidence:** VERIFIED that HEAD was `80e95a3` when the repository was reviewed; `master` will move.
- **Actions:**
  - [ ] Fetch, diff against `80e95a3`, and re-read any changed docs, migrations, auth files and open PRs before building.
  - [ ] Update these documents when the repository drifts from them.

### E16. Agree the launch scope in writing (needed by NOW)
- **Evidence:** VERIFIED that production was set to browse-and-enquire mode; the schedule, payment, catalogue and collection gates (G01 to G05) are open.
- **Actions:**
  - [ ] Give the owner a one-page scope statement: P0-A at first release, which features wait on which gate, and no promised dates for booking or checkout.
  - [ ] Get it acknowledged before store submission.

### E17. Legal review (needed by SUBMIT)
- **Evidence:** GENERAL.
- **Actions:**
  - [ ] A Nigerian lawyer reviews consent, retention, breach-notification duties and any registration the company needs under the Nigeria Data Protection Act.
  - [ ] List third-party processors (for example email, hosting, edge) and where they process data.

### E18. Costs and accounts to budget (needed by NOW)
- **Evidence:** GENERAL; check current prices.
- **Actions:**
  - [ ] Budget for Apple's yearly fee, Google's one-time fee, the build service tier, crash or monitoring tools, and any device purchases for testing.

---

## Already tracked elsewhere

| Topic | Where |
|---|---|
| Native sign-in design, session token header, rate-limit changes | `NATIVE_AUTH_DESIGN.md` |
| Missing app-version / forced-update mechanism, web-only push, native push device model | `CODEX_HANDOFF.md`, Package B and E notes |
| Migration rules and pending migrations | `NATIVE_AUTH_DESIGN.md` section 5.1 and `AGENTS.md` |
| Booking, payment, catalogue, collection gates G01 to G05 | `BLUEPRINT.md` section 9 |

## Sign-off before store submission

| Gate | Owner sign-off | Date |
|---|---|---|
| A1 to A4 closed | | |
| B5 confirmed (key rotated) | | |
| E16 scope acknowledged | | |
| E17 legal review done | | |
| Security review of native auth merged and deployed | | |
