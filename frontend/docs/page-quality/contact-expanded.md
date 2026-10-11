# Contact and Customer Care — expanded brief

Route: `/contact`. Date: 7 October 2026. Status: complete; expanded local acceptance passed. This extends the [September milestone](contact.md). Account support pages, Reviews, About and Help retain separate gates.

## Audit and design

Fresh 390, 768, 1280 and 1440px baselines showed a functional page without overflow or page errors, but oversized headings and a predominantly white composition gave the form and location little visual distinction. The existing enquiry/complaint forms already supported bounded related-record choices, review-before-send, focused errors, uncertain-outcome locks and actual API submissions.

Source review covered the Contact page/styles, shared public/support forms, record picker, review dialog, copy control, account changes, CSP and backend routes/schemas/service/repository. Public support receipts contained a validated UUID that the page did not show. The static customer-care shortcut also pointed every role at a customer-only destination. The Maps iframe configuration existed, but the page CSP would have blocked its external frame.

Three [ImageGen concepts](contact-oct-concepts/README.md) were generated and inspected before implementation. The accepted direction uses the actual Nippo/Quicksand typography, compact ink/image introduction, white direct-contact strip, cool-grey form band, white form with an ink top rule and subtle shadow, and a distinct location/FAQ sequence. The existing workshop editorial asset remains; no generated concept technician becomes production photography.

The form retains its actual fields and segmented enquiry/complaint controls. Desktop preserves contact-field rows; mobile keeps the form ahead of the process/preparation guidance. Preparation copy explains useful information, and a new complaint FAQ explains the existing choice and review flow without promising response times or outcomes.

## Functional changes and preserved contracts

- Confirmed Contact receipts now display the actual returned UUID and the existing Copy control, including visible feedback and manual selection fallback. The value is read-only, excluded from drafts, cleared on account changes and never turned into a public private-record link.
- Account shortcuts distinguish anonymous, customer and work-account sessions. Customers receive `/dashboard/support`; Staff/Admin/Super Admin receive `/admin/support`; anonymous users receive sign-in guidance. Pending/failed session reads cannot expose a stale customer destination. Failed checks offer retry without blocking the public form.
- The location panel keeps **133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria**, working external Maps/directions, and a usable dark address fallback. There are no invented coordinates, opening hours or Place ID.
- CSP now permits the exact Google Maps embed path only on `/contact` when a nonblank public Maps key is configured. Other pages and unconfigured Contact retain self-only frames. No actual key was supplied or installed; the live embed remains a configuration verification task.

Paths below omit `/api/v1`.

| Contract                                         | Preserved behavior                                                                                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /auth/session`                              | Optional account navigation check; no privileged support data is fetched by Contact.                                                                       |
| Public branches, products, services and vehicles | Existing bounded cursor choices. Search explicitly covers the loaded page. A selected vehicle determines its handling branch.                              |
| `POST /public/support/enquiries`                 | Existing strict GENERAL/PRODUCT/SERVICE/VEHICLE variants and matching resource ID, branch, contact fields, subject and message. Review precedes the write. |
| `POST /public/support/complaints`                | Existing contact fields, branch, subject and description. No authenticated transaction IDs, upload or unsupported field is added.                          |
| Public receipt                                   | Valid UUID, OPEN status and timestamp before confirmation. A receipt confirms submission, not an appointment, price, refund or resolution.                 |

No backend code or API contract change was needed. Required fields and length limits, safe server-error mapping, duplicate guards, abort handling, session cleanup, native review dialogs and pending/unknown locks remain intact. The shared form change only renders the new reference for Contact presentation.

## Fidelity ledger

| Comparison                                                      | Correction or deliberate source-bound treatment                                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oversized white baseline introduction                           | Concept 01 and final 1536px/390px captures show a compact ink introduction, 36px maximum heading, controlled photo crop and 44px actions.                                             |
| Generated branding, navigation and workshop scene               | Actual shell and existing editorial image retained; generated uniforms, logo, slogans and search icon are not adopted.                                                                |
| Concept 01 invents response-time assurances                     | Existing factual introduction and safe form wording retained. Above-the-fold title, supporting sentence and action labels match the source brief; generated timing claims are absent. |
| Form blends into white page                                     | Concept 02 and final care capture: cool-grey section, white panel, ink rule, restrained shadow and visible Login-derived borders/focus.                                               |
| Generated form uses alternate radio/field wording               | Preserve the actual segmented radios, “Your name,” current-page picker behavior, required fields and review dialog.                                                                   |
| Empty left context                                              | Three concise steps plus an ink preparation panel; mobile keeps those after the form. Guidance now explains saving the returned reference.                                            |
| Static customer destination for all accounts                    | Actual role-aware shortcut replaces unsupported customer navigation; anonymous and failure states remain useful.                                                                      |
| Dark map inherits a low-contrast paragraph color                | Initial Axe checks found 2.74:1 contrast. Explicit light address text fixes the rendered panel; no accessibility rule is excluded.                                                    |
| Concept location adds decorative slogans and a different header | Preserve approved address, real shared shell, compact outline icons and safe external links; no fabricated map or promises.                                                           |
| Concept 03 receipt differs from established feedback            | Retain the existing restrained green success notice and focused heading, adding the real UUID/copy control. The generated sample ID is never used.                                    |
| FAQ and mobile adaptation                                       | Four native disclosures, keyboard controls, wrapping channels and narrow-screen form/receipt layouts. No new animation dependency; reduced motion remains supported.                  |

`view_image` comparison covered all three references and final native desktop introduction, complete form, location, receipt and tablet/mobile states. Remaining differences are the explicit branding/data/contract decisions above, not unimplemented controls.

## Verification

Environment: production standalone `http://localhost:3001`, isolated API 5012, PostgreSQL 55439 with database `allied_vehicles_qa`. Browser plugin not available; repository Playwright with installed Microsoft Edge was used. Temporary scripts, logs and screenshots remain outside the repository.

| Gate                        | Evidence                                                                                                                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build            | Final compilation, TypeScript, 70 route entries and standalone packaging passed; `contact-oct-build-final.log`.                                                                                                                          |
| Code quality                | Full frontend lint passed, followed by targeted ESLint after the policy correction; scoped Prettier, local documentation links and diff checks passed.                                                                                   |
| Browser suites              | All 74 passed against the final build: 28 Contact scenarios and 46 shared-support regressions, including role navigation, safe text review, copy/fallback, session clearing, public/customer workflows and pending/unknown locks.        |
| Responsive layout           | 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px; no horizontal overflow. Whole-document Axe runs on six representative widths plus receipt/dialog states; remaining widths include navigation, layout and interaction checks.  |
| Policy unit checks          | Seven passed for Maps scope, absent configuration and retained private cache/header behavior.                                                                                                                                            |
| Existing backend safeguards | Six existing support/notification security tests passed, including escaped notification text; this is not claimed as full endpoint coverage.                                                                                             |
| Real API/database           | Enquiry and complaint each returned 202 and persisted once for a unique synthetic identity, correct branch and OPEN status. Review caused no premature write; displayed references matched both rows; two matching CREATE audit records. |
| Negative API checks         | Missing/cross-site origin 403, unexpected privileged field 422, invalid/oversized complaint 422, anonymous private support read 401. CSP and nosniff observed on the final production response.                                          |
| Page health                 | Expected title, URL and heading; HTTP 200; no framework overlay, unexpected console/page errors, failed responses or broken rendered images. Expected anonymous session 401 is excluded.                                                 |

Interaction loops: introduction → enquiry focus → validate → choose related type/branch → review/cancel → send → focused receipt → copy or manual fallback; complaint selection → retained strict payload → receipt; role/account change → correct shortcut and cleared receipt; direct channels → approved destination; keyboard FAQ → expanded/collapsed content.

Initial browser run: 64 passed, 10 failed, all reporting the location paragraph contrast defect. The final run passed all 74 after the explicit color correction and Maps policy change. The initial real submission harness stopped at a screenshot timeout after a write; the completed real acceptance run used a new isolated QA identity and verified both transactions. A negative API harness initially expected 400 for invalid data; current middleware returns 422, and the corrected check passed. These harness corrections did not weaken application validation.

Security detail and boundaries are recorded in [Customer Care security verification](contact-security.md). External delivery was disabled for the isolated run, so API/database success does not certify provider delivery. The Maps key, deployed notification delivery and production integration checks remain outstanding under [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md).

Commands: `npm run build`; `npm run lint`; targeted ESLint/Prettier; `npx playwright test tests/e2e/contact-quality.spec.ts tests/e2e/support.spec.ts --workers=1`; `npx vitest run tests/unit/contact-map-policy.test.ts --maxWorkers=1`; existing backend support-security unit file; real API/database, negative-request and page-health scripts; `git diff --check`.

Artifacts under `C:/Users/PC/.codex/`: `contact-oct-build-final.log`, `contact-oct-lint.log`, `contact-oct-lint-final.log`, `contact-oct-browser-final.log`, `contact-oct-map-policy.log`, `contact-oct-backend-security.log`, `contact-oct-real-final.log`, `contact-oct-security-final.log`, `contact-oct-health.json`, `contact-oct-{before,after}-{width}-{viewport,full}.png`, and focused final care/location/FAQ captures. The OS temporary directory contains `contact-quality-*.png` and `contact-oct-320-copy-fallback.png`.

## Files and next scope

Production: `app/contact/page.tsx`, `app/contact/contact.css`, new `app/contact/contact-account-link.tsx`, `app/components/support-create-form.tsx` and `proxy.ts`. Tests: `tests/e2e/contact-quality.spec.ts` and new `tests/unit/contact-map-policy.test.ts`. Concept references, this report, security record, historical milestone link, coverage register and backend handoff record the work.

Next: Reviews `/reviews`, then About and Help as separate expanded gates. Cart, checkout, payment, invoices/receipts, download/share, saved/wishlist/favourites, potential cart drawer and toast improvements are explicitly retained in the latest [coverage register](expanded-brief.md), alongside the remaining application objective. This milestone does not certify those pages or the full app as complete.
