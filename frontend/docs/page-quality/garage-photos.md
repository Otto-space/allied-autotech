# Customer vehicle photo detail

Status: locally accepted, 9 October 2026. Route `/dashboard/vehicles/[vehicleId]` is expanded milestone 37, separate from the accepted garage list. Deployment acceptance and the remaining application routes remain open.

## Audit

The existing gallery has private photo reads, signed binary uploads, per-file previews/progress/cancellation, confirmation, descriptions, order, cover and removal. Cards contain excessive vertical form spacing; uploads begin below the entire gallery. The inherited breadcrumb uses literal separators and generic Details. Baselines were captured at 390, 768, 1280 and 1440px using synthetic photo records. Production must use only authenticated server photo URLs. Browser plugin not available; installed Edge via Playwright is the fallback.

The resource hook retains data after temporary background failures. The existing page does not expose refreshError or disable mutations during that state. All photo forms also share one draft key. Both need correction within this route. Upload preparation and final attachment must remain distinct, and no uncertain mutation may report success.

## Authoritative contract

- Customer-only authentication, owner-scoped vehicle/media access. POST prepare/confirm and PATCH/DELETE require CSRF; prepare/confirm are rate-limited to 20 per minute.
- `GET /customers/vehicles/{vehicleId}` provides vehicle identity, mediaVersion and up to 12 ordered private photos.
- `POST /customers/vehicles/{vehicleId}/assets/upload` accepts MIME, byte size and SHA-256 checksum. JPEG/PNG/WebP, nonempty through 10 MiB; server validates actual content and dimensions (32 through 8192 per side) and transforms images.
- `POST /customers/vehicles/{vehicleId}/images` attaches the asset token with expectedVersion, optional description, sortOrder 0 through 10000 and isPrimary. The first photo becomes cover automatically. Exact confirmed token/body replay returns the stored result; altered bodies must not be retried as the same operation.
- `PATCH /customers/vehicles/{vehicleId}/images/{imageId}` accepts expectedVersion plus description (nullable, trimmed, up to 240), integer sortOrder or isPrimary:true. No bulk reorder endpoint exists. Preserve explicit order editing.
- `DELETE` on that image route requires expectedVersion. Removing the cover promotes the first remaining photo by sort order/ID and queues storage cleanup. No undo is promised.
- Mutations return version and images. The row is locked and stale versions fail with 409. Private image reads use authenticated same-origin `/api/v1/customers/media/images/{imageId}` URLs with unoptimized Next Image to preserve credentials.

Relevant sources: [routes](../../../backend/src/modules/customers/garage-media.routes.ts), [schemas](../../../backend/src/modules/customers/garage-media.schemas.ts), [service](../../../backend/src/modules/customers/garage-media.service.ts), [media confirmation](../../../backend/src/modules/media/media.service.ts), [frontend upload transport](../../lib/api/signed-upload.ts).

No new backend capability is presently required. Deployed object storage remains REL-01 in the [backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md); existing local media acceptance is not deployed storage verification.

## Acceptance evidence

| Check                             | Result and scope                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser regression                | All 58 cases passed: 35 photo scenarios and 23 shared navigation regressions. Covers descriptions/order/cover/removal, CSRF request bodies, version conflicts, uncertain outcomes, exact attachment replay, independent upload slots, cancellation, capacity, permissions, session changes and private-image recovery. |
| Final CSS repeat                  | All 15 responsive/accessibility/short-screen cases passed after the final styling changes.                                                                                                                                                                                                                             |
| Responsive and visual review      | Captured 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px, plus the concept-native 1505 by 1045 viewport. No page overflow in checked views. Nine state captures cover loading, empty, error, stale, removal, uncertainty, upload, capacity and short-screen review.                                          |
| Accessibility and computed styles | Four automated Axe cases passed; keyboard/modal containment and focus restoration passed. Computed checks at six widths confirm Quicksand, 16px form text, 48px inputs and minimum 44px action targets, with no console warnings/errors or page errors in those checks.                                                |
| Backend regressions               | Twelve garage/media-validation tests passed against an isolated database, including customer ownership and denied work-account access.                                                                                                                                                                                 |
| Frontend regressions              | Nine upload/resource lifecycle tests passed.                                                                                                                                                                                                                                                                           |
| Static and build checks           | Full frontend lint, focused lint and TypeScript passed. Final Next.js 16.3.8 production build and standalone packaging passed.                                                                                                                                                                                         |
| Missing storage                   | Restored the preview without the QA upload host. Browser verification passed: clear unavailable-storage notice, disabled file selection/attachment, existing gallery and cover review still available, no page errors.                                                                                                 |

Real browser/API/database evidence is described below. Test fixtures exercise UI states; they are not production records. These local checks do not certify deployed object storage, other browser engines, a physical-device keyboard or manual screen-reader use.

## Implementation and current evidence

Three [retained ImageGen concepts and the written specification](garage-photos-oct-concepts/README.md) preceded implementation. The gallery now has semantic entity breadcrumbs, a private-photo band, compact description/order forms, a desktop upload panel, independent upload slots and a page-local native confirmation dialog. It preserves exact-body attachment retries, synchronous mutation locking, refreshed server versions and unique photo draft keys. Background failures disable mutations; manual failures hide old controls. Session changes discard private dialogs and late feedback. Failed private images have a labelled fallback, with refresh retry added during the final pass.

The first production build/type checks, full frontend lint, 12 backend media/garage tests and nine frontend upload/resource tests passed. The first browser run passed 29 of 30 cases; its only failure was a stale-warning selector also matching Next's hidden route announcer. After scoping the selector, that case and four added recovery/session cases passed. The complete updated suite subsequently passed all 58 cases, including cancellation and recovery of failed private images after refresh.

Real browser/Express/PostgreSQL acceptance passed against `allied_customer_overview_test`, using a local HTTPS byte-storage server. Actual browser file bytes were checked against declared size, persisted through upload confirmation and decoded as private image responses. Evidence includes one deliberate storage failure and recovery, lost confirmation response followed by exact-body retry without duplicate attachment, preservation of a second prepared upload, description/order edits, cover selection/reload, cancellation, removal and fallback cover. Foreign detail/image reads returned 404, stale versions 409 and missing CSRF 403. Two attachments produced two attachment audits. No browser page errors occurred. This verifies isolated storage, not deployed S3.

The initial interception-based test harness could not recover File request bytes and forwarded a null body, which the backend correctly rejected. The final harness uses real local HTTPS transfer instead; no production storage code was changed to accommodate the test.

## Fidelity review

All three retained concepts were inspected alongside the implemented desktop/native, mobile and recovery views. The final review accepts these explicit corrections and boundaries:

| Area                            | Final result                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition                     | Two photo cards and a 330px upload panel on wide desktop; upload moves below the gallery at 1360px to keep laptop forms comfortable. One photo column on narrow screens.                                   |
| Typography                      | Quicksand throughout this private workspace, 30/27px page heading, compact labels and readable 16px form text. Actual logo/navigation replace artwork substitutions.                                       |
| Palette and hierarchy           | Ink privacy band, cool grey canvas, restrained white surfaces, red primary actions and fine borders match the specification.                                                                               |
| Photo evidence                  | Authenticated images use uncropped contain framing and actual dimensions. Concept vehicles never enter customer data. Failed reads have labelled fallback and refresh retry.                               |
| Form density                    | The 104px Display order field keeps its label on one line. Save stays beside it; borderless cover/removal actions retain 44px targets.                                                                     |
| Responsive controls             | Mobile privacy title/count use separate rows. Tablet/laptop upload buttons stay compact. Empty upload-action rows no longer leave a gap.                                                                   |
| Recovery                        | Stale warning has deliberate separation from the privacy band; mutations remain disabled until fresh data. Native review dialogs preserve the existing contract and exact-body retry rules.                |
| Intentional artwork differences | Actual shell, Lucide icons, API-safe copy and outlined Save are authoritative. No redundant Make cover on the current cover, invented upload retry shortcut, public sharing or duplicate review thumbnail. |

One final screenshot pass timed out at 1024px; the affected desktop widths were recaptured successfully. Existing fixed support controls remain part of the shared shell; controls are reachable on scroll. Full-page screenshots can show fixed controls mid-document. No production code change was needed after the final passing CSS checks.

## Changed files and reproducibility

Production changes are scoped to [gallery](../../app/components/garage-images.tsx), [gallery styles](../../app/components/garage-images.module.css), [photo review](../../app/components/garage-photo-review.tsx), [detail route](../../app/dashboard/vehicles/[vehicleId]/page.tsx) and the detail-route breadcrumb exclusion in [dashboard shell](../../app/components/dashboard-shell.tsx). Existing upload transport, shared upload controls and garage dialog are reused. No backend code was changed for this page gate.

Coverage lives in [photo scenarios](../../tests/e2e/garage-photos-quality.spec.ts) and [photo fixtures](../../tests/fixtures/garage-photos.ts); the existing garage-media test's empty-state selector was aligned with the new copy, but that older suite was not rerun as this gate's acceptance suite. Verification used frontend `npm run lint`, `npm run typecheck`, `npm run build`, focused Vitest/resource suites and Playwright photo/navigation suites. Backend garage/media suites used `TEST_DB_NAME=allied_customer_overview_test`.

External evidence lives under `C:/Users/PC/.codex/garage-photos-oct-*`: baseline/final/state/native captures; `browser-final.log` (58), `browser-release.log` (15), `backend.log` (12), `unit.log` (9), `real.log`, `computed.log`, `desktop-repeat.log`, lint/type logs and `build-accepted.log`. The `unconfigured.cjs` helper and screenshot record the restored-storage fallback. Browser plugin was unavailable; Microsoft Edge via repository Playwright used `http://localhost:3001`. Local HTTPS test storage and synthetic data do not establish REL-01 deployed acceptance.

Next separate page gate: `/dashboard/inspections`. The whole application goal remains active.
