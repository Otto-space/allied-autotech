# About — expanded local acceptance

Date: 7 October 2026. Route: `/about`. This gate covers the public company introduction, complete principles, equipment disclosures, original campaign archive and workshop contact paths. It does not establish whole-application or deployment acceptance.

## Audit and implementation

The previous page had an oversized introduction, a long all-expanded equipment gallery and repeated contact sections. The approved company copy, eleven principles, fifteen equipment items, original campaign images and business constants already existed. They remain the content sources; no company statistics, staff identities, opening hours or inventory claims were added.

Four fresh [concept references](about-oct-concepts/README.md) preceded implementation. The page now uses a compact ink introduction, the original technician campaign photograph, focusable section navigation, paired mission/vision, a numbered principles list, a native campaign disclosure, three equipment disclosures and one consolidated workshop contact section. Nippo display headings use a 36px maximum; Quicksand remains the interface/body font. Grey and white sections, fine dividers and controlled red accents distinguish the content without repetitive cards.

All eleven principles remain visible. The first equipment group opens by default; all fifteen items remain available through native keyboard-operable disclosures. Campaign links open the original local files with explicit new-tab labels and `noopener noreferrer`. Campaign copy distinguishes original artwork from current marketplace availability. Equipment images retain the actual existing assets, not generated substitutes.

The page remains a Server Component. `EquipmentGallery` adds an optional `collapsible` presentation while preserving its default rendering. No new client boundary, dependency, content service, backend contract or database change was needed. Existing navigation, footer and metadata remain in use.

## Functional and security boundaries

The workshop address is **133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria**. Phone, email, WhatsApp and Google address-based directions use approved constants. No Place ID or coordinates are inferred, and no embedded map is claimed. The owner has not supplied Maps configuration.

About is public for every role and has no private record or mutation controls. Query text is not reflected into content or destinations. A real unmocked browser visit requested only the shared `GET /api/v1/auth/session`; no content API or mutation was needed. Four role fixtures verify the public page remains free of customer/admin record links. These fixtures test frontend behavior, not backend authorization or an MFA ceremony.

## Verification

Environment: production standalone preview at `http://localhost:3001`, existing isolated API at `localhost:5012`, Microsoft Edge through repository Playwright. Local checks do not verify deployed integrations or other browser engines.

| Check                   | Result                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build        | Final `npm run build` passed, including TypeScript, 70 generated routes and standalone packaging.                                                                                                               |
| Static checks           | Full frontend lint passed before the final CSS/test correction. Final changed-file ESLint and separate `npx tsc --noEmit` passed afterward. Scoped formatting and whitespace checks passed.                     |
| Browser scenarios       | All 19 scenarios passed in the final full run of `tests/e2e/about-quality.spec.ts`.                                                                                                                             |
| Responsive              | 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px passed overflow, complete-content and disclosure checks.                                                                                              |
| Accessibility           | Axe WCAG 2 A/AA, 2.1 AA and 2.2 AA tags passed at 320, 390, 768, 1280, 1440 and 1536px; no rules disabled. Keyboard disclosures and section focus below the fixed header passed, including 320×568.             |
| Assets and destinations | All fifteen equipment images loaded; four original campaign links returned 200; opening an original image produced no window opener. Contact and Services navigation worked.                                    |
| Progressive enhancement | Principles, equipment and campaign disclosures, and contact navigation worked with JavaScript disabled.                                                                                                         |
| Role and input behavior | Customer, Staff, Admin and Super Admin fixtures made no private-data or mutation requests. Untrusted query text did not change content or links.                                                                |
| Unmocked browser health | HTTP 200, correct title, CSP and `nosniff`, no page/console errors, failed non-auth responses, framework overlay or broken main images. Expected anonymous-session 401 is excluded from the health error count. |

The first run found a genuine address contrast defect: a more specific shared paragraph style overrode the intended light color. A page-scoped selector corrected it. Five other failures came from test selectors matching both the main contact link and the existing footer link; the tests now scope that interaction to `main`. The final 19-scenario run passed after both corrections.

## Fidelity ledger

| Item                 | Concept or baseline mismatch                                                 | Final treatment and evidence                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Introduction scale   | Baseline and generated lettering were larger than the written brief permits. | Real Nippo at 28–36px, readable copy and 44px actions; inspected final desktop/mobile first viewports.                            |
| Brand imagery        | Generation altered the supplied portrait and equipment illustrations.        | Original technician campaign and actual fifteen equipment photos retained; desktop/mobile crops inspected.                        |
| Section rhythm       | Baseline repeated contact bands and left equipment permanently expanded.     | Ink introduction/contact bookends, grey purpose/equipment bands and white principles; one contact section.                        |
| Principles           | All eleven approved principles must survive the compact redesign.            | Complete numbered list, two columns on desktop and one on mobile, with subtle separators and no hidden principles.                |
| Equipment            | Baseline consumed excessive height with uniform large image cards.           | Three native disclosures with compact image/text rows, actual group counts and first group expanded.                              |
| Mobile layout        | An initial mobile concept incorrectly retained desktop columns.              | Regenerated mobile concept; single-column reading order, wrapping actions and a two-column section navigation. Ten widths passed. |
| Contact readability  | Initial address inherited dark text on the ink background.                   | Scoped light address color; final desktop/mobile contact screenshots inspected and six Axe widths passed.                         |
| Navigation and focus | Section links must remain usable beneath the fixed header.                   | Semantic breadcrumb, four focusable destinations, scroll margin and visible focus; short-screen keyboard test passed.             |

Concepts and final first viewports and lower-page sections were inspected with `view_image`. Intentional differences include the production header/footer, real bundled typography, original photographs and compact scale. Generated logos, equipment brands, footer claims and decorative labels were not adopted.

## Files and evidence

Production: [About page](../../app/about/page.tsx), [scoped styles](../../app/about/about.css), [equipment gallery](../../app/components/equipment-gallery.tsx). Regression coverage: [About browser suite](../../tests/e2e/about-quality.spec.ts).

Local evidence is outside the repository under `C:/Users/PC/.codex/`: `about-oct-before-*`, `about-oct-after-*`, `about-oct-browser-final.log`, `about-oct-health-final.log`, `about-oct-build-final.log`, `about-oct-lint.log`, `about-oct-lint-final.log` and `about-oct-types-final.log`. Ten-width test screenshots use `about-quality-*.png` in the OS temp directory. Accepted concepts are retained in the repository; temporary scripts and screenshots are not application assets.

No mandatory backend gap was identified for About. Maps remains a configuration dependency in the [backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md). Help is the next page gate; Quotation, commerce, account and operational dashboard work remains open.
