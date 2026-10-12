# Customer profile - local page gate

Status: locally accepted on 12 October 2026, the forty-first expanded frontend milestone. This accepts the profile route within the boundaries below; the wider application remains in progress.

Route: `/dashboard/profile`. Audit and implementation started 11 October 2026. The preceding accepted milestone is [customer vehicle purchase detail](customer-purchase-detail.md).

## Audit and preserved contract

- Customer-only `GET/PATCH /customers/profile` uses the session owner. The existing schema allows name, phone and optional address/city/state; account email and roles cannot be edited here. Country updates are restricted to Nigeria. The page displays the returned country and sends only changed editable fields.
- Subsequent contract update: metadata now has `profileVersion`, and PATCH requires `expectedVersion`. Atomic stale-write rejection and an explicit saved-value comparison preserve the original draft/revision through tab changes and reloads. Unknown outcomes remain locked until reviewed; no automatic repeat PATCH or durable server replay is promised. See the separately verified [profile revision implementation](../../../backend/docs/customer-profile-revisions.md). The original page-gate counts below remain historical evidence.
- Existing photo preparation, private transfer, confirmation and removal remain under BG-02. `PUT/DELETE /customers/profile/photo` uses the media version; confirmation retries preserve the original token/body. Server validation decodes image bytes, and replacing/removing a photo schedules owned cleanup. Private reads are owner-only and uncached. No fabricated avatar, unsigned external image URL or claimed upload success is introduced.
- Existing dashboard role gating, CSRF, safe API messages, session invalidation, draft ownership, upload-host restrictions and photo review remain in use. Parent dashboard metadata prevents indexing. Related links target actual security/privacy routes.

## Design and implementation

[Retained desktop and mobile/state concepts](customer-profile-oct-concepts/README.md) were generated and inspected before production changes. Four baseline captures at 390, 768, 1280 and 1440px showed a wide upload section pushing the contact form below the first desktop viewport.

The new asymmetric desktop layout places identity and managed photography beside the wider contact form. Smaller screens use a horizontal identity and collapsible photo section so contact editing remains prominent. Initials represent missing or failed private images. Quicksand, ink, cool grey and restrained red match the established dashboard. Inputs retain visible borders and focus, with a read-only account email, grouped address and explicit save/discard controls. A desktop gutter accommodates the support widget.

Stale reads remain labelled and disable mutations; denied reads remove private data. Background refresh preserves dirty edits. Saves block duplicate submissions, honor Retry-After and focus rejected fields after controls unlock. Unconfirmed metadata writes require reloading server-saved values. Explicit reload/discard clears the local draft as well as form edits. Photo confirmation remains mounted through its own refresh so a lost confirmation can retry its original request.

## Corrections found during verification

- The first fixture's CSRF token was shorter than the existing client minimum. Five mutation scenarios could not reach their intended endpoints. Corrected the test fixture; the production CSRF check was preserved.
- React Hook Form merges global reset options into explicit resets. `keepDirtyValues` therefore defeated Discard changes. Explicit resets now override that option and clear the account-scoped stored draft. A reload assertion covers the full discard behavior.
- The initial photo panel repeated its heading and privacy sentence. The disclosure now owns the visible Profile photo heading, and privacy appears once in the identity panel.
- Deferred server-field focus until the submitted controls become enabled again.
- Real API QA initially compared relative and absolute forms of the same image URL, then expected 400 where the backend returns its documented 422 validation status. Updated the helper assertions without changing production behavior.
- The root metadata template already appends the company name; the route title is simply Your profile to avoid duplication.

## Verification ledger

| Check                                       | Evidence/status                                                                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four-width baseline                         | Captured and inspected before production changes                                                                                                    |
| Initial ten-width captures                  | 320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536px; no page overflow or browser errors/warnings                                                 |
| Initial browser run                         | 53 passed, six failures investigated as above; corrected final run passed all 62 scenarios (39 profile and 23 shared navigation)                    |
| Frontend unit tests                         | 13 passed: profile contract/change projection and existing background-resource regressions                                                          |
| Backend regressions                         | 23 passed across profile-photo service, HTTP boundaries, Phase 3 boundary checks and byte validation                                                |
| Scoped lint                                 | Passed on the final implementation; full frontend lint also passed                                                                                  |
| Production build                            | Final optimized build, TypeScript, route generation and standalone packaging passed                                                                 |
| Real browser/API/database                   | Passed against isolated `allied_customer_overview_test`, real transferred image bytes and injected storage; no deployed S3 acceptance claimed       |
| Final concept comparison and state captures | Final ten-width captures, seven state captures and concept-native 1468 x 1071 viewport inspected; no page overflow or errors in the normal captures |

Local helper scripts, screenshots and logs are kept outside the repository under `C:/Users/PC/.codex/profile-oct-*`. All report counts refer to recorded local runs, not deployed services.

## Fidelity ledger

| Comparison            | Design requirement                                                     | Current finding                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Composition           | Dark identity/photo column beside a wider white contact form           | Final native-size capture matches the extracted composition; repeated photo labels removed                                              |
| Typography and colour | Compact Quicksand; ink, cool grey, white, controlled red               | Final desktop/mobile comparison passed with the actual bundled Quicksand font and scoped palette                                        |
| Controls              | Paired names and city/state, full-width phone/address, visible borders | Implemented; mobile deliberately stacks fields                                                                                          |
| Mobile                | Compact identity and collapsible photo workflow                        | Final 390px and tablet captures match the extracted specification                                                                       |
| Recovery              | Stale and unknown results visibly block further writes                 | Stale, denied and unknown-result scenarios passed; real API outcomes and saved-data reconciliation verified                             |
| Shell and copy        | Existing sidebar/search/support and exact profile title/subtitle       | Existing shell retained; generated alternative branding/footer/country selector deliberately excluded for actual architecture/contracts |

## Remaining boundaries

REL-01 still requires actual deployed storage and cleanup acceptance. REL-03 still requires target-environment account/session checks. No backend application or migration changes are part of this page gate. The metadata concurrency limitation is stated above; media versioning must not be presented as versioning for profile text. Approved reservation agreement work in BG-11 proceeds separately and is not certified by this profile report.

The whole-app goal remains active. This route has passed its local gate. Next: customer privacy requests `/dashboard/privacy`; remaining customer, staff, administrator and Super Admin routes retain separate gates.

## Final acceptance evidence

The final browser command ran `customer-profile-quality.spec.ts` and `dashboard-navigation.spec.ts` against the optimized standalone server: **62 passed**. The 39 profile cases cover ten widths, four accessibility widths, saved/discarded changes, validation, loading/error/offline/stale/denied states, unknown results, duplicate suppression, Retry-After, owner mismatch, all privileged-role redirects, session clearing, image fallback, reviewed removal, keyboard focus and long content. Page title and private noindex metadata are asserted. The existing photo regression file was adapted to open its now-collapsible mobile section; its separate legacy harness was not run in this gate. The actual lifecycle was exercised by the real API/browser helper below.

The real helper finished with Node exit 0 and verified:

- One metadata update/audit after a deliberately lost committed response; explicit reload recovered saved name/address without a repeat PATCH, and untouched phone remained unchanged.
- Three real HTTPS image transfers into isolated byte storage: valid first attachment, invalid replacement and valid replacement. A lost first confirmation response retried the original token/body and left one attached image. Invalid bytes preserved the existing photo. Successful replacement survived reload and revoked the previous application image URL.
- Private image bytes, `private, no-store` and `nosniff`; another customer received 404; Staff, Admin and Super Admin received 403; an anonymous request received 401. Missing CSRF received 403, stale media version 409 and attempted role mutation 422.
- Cancelled removal preserved the image; confirmed removal restored initials, removed the reference, revoked the image URL and advanced media version to three. Exactly two photo replacement audits existed. No page errors occurred.

Final normal screenshots at all ten widths and seven loading/error/stale/dirty/photo/review/uncertain states were inspected. The accepted desktop concept and latest browser capture were both opened with `view_image` at a matching 1468 x 1071 viewport. Browser/IAB was unavailable; Playwright with Edge supplied the screenshots and interaction checks. Composition, typography, colour, input grouping, photo workflow, mobile adaptation and recovery presentation were compared directly. Above-fold title/subtitle/refresh copy matches the extracted specification. Initials, read-only country, existing shell and disabled pristine-state actions are intentional contract/architecture adaptations. The implementation is faithfully verified against that specification; no material visual mismatch remains. Fixed support controls appear at the capture viewport boundary in full-page screenshots; scrolling, modal containment and keyboard reachability were checked separately.

The preview was restarted without the QA upload-host setting. A final native-width check verified the honest unavailable-storage notice and disabled file input while contact editing remained enabled, with no overflow or page/console errors. Runtime QA host configuration was not written into repository environment files. Deployed storage acceptance remains open.

Evidence logs: `profile-oct-browser-final.log`, `profile-oct-backend.log`, `profile-oct-unit-final.log`, `profile-oct-lint-all.log`, `profile-oct-build-release.log`, `profile-oct-real.log`, `profile-oct-captures-final.log`, `profile-oct-states.log`, `profile-oct-native.log` and `profile-oct-fallback.log`, under the external QA directory above. Formatting and local documentation links were checked after recording acceptance.

## Files in this page gate

- [Profile route and metadata](../../app/dashboard/profile/page.tsx), [scoped stylesheet](../../app/dashboard/profile/profile.css), [profile panel](../../app/components/profile-panel.tsx), [photo workflow](../../app/components/profile-photo.tsx).
- [Profile contract and changed-field projection](../../lib/api/profile-schemas.ts).
- [Browser fixtures](../../tests/fixtures/customer-profile.ts), [profile browser scenarios](../../tests/e2e/customer-profile-quality.spec.ts), [existing photo scenario adaptation](../../tests/e2e/profile-photo.spec.ts), [contract tests](../../tests/unit/customer-profile.test.ts).
- This report, retained concepts/specification, [page register](README.md), [expanded brief](expanded-brief.md) and [backend delivery backlog](../../../BACKEND_IMPLEMENTATION_GAPS.md).

No backend service, schema, migration, dependency or shared dashboard-shell change was required for this profile gate. Concurrent reservation-terms and deployment work was preserved and is outside this report's acceptance claim.
