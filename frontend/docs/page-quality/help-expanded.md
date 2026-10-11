# Help Centre — expanded local acceptance

Date: 7 October 2026. Route: `/help`. Scope: article discovery, search, topic selection, public answers and appropriate account/contact shortcuts. Article detail routes are a separate subsequent milestone; opening them is regression evidence, not their visual acceptance.

## Audit and implementation

The previous page had a large plain introduction, faint search boundaries, wrapping category buttons, stray question-mark separators in article links and customer-only account actions shown to every viewer. Twelve approved FAQs already covered bookings, location, customer care, payments, account recovery, policies, quotations, shop, inspections, garage, MFA and support follow-up.

Three fresh [concepts](help-oct-concepts/README.md) define the search/topics area, lower guidance/contact section and mobile adaptation. The implementation retains all twelve articles and approved copy, using a compact ink search header, a grey workspace, a desktop topic rail, white contiguous answer disclosures and a single ink contact section. Nippo headings stay within 28–36px for the main title; Quicksand remains the body/control typeface. The existing header/footer and public metadata remain in use.

Mobile uses a native topic selector instead of nine wrapping filter buttons. Search boundaries use `#82939F`, controls have at least 44px targets, and native disclosures remain keyboard-operable. An ordered breadcrumb marks the current page. Submitting a search moves focus to the results below the fixed header; clearing returns focus to the search field.

Search matches every entered word against the complete local collection's category, question, answer and keywords, ignoring case and extra spaces. Counts derive from that collection, not a fetched subset. Category names are included so the suggested term “payments” finds the payment article. Query length is bounded at 200 characters and unknown categories fall back to all topics. Text is rendered literally, without HTML injection.

Live typing replaces the current URL; topic changes create history entries. Reload, article return and browser Back/Forward restore the filters. The server initializes the same query/topic state. Search, topic selection and clearing use ordinary GET forms as a no-JavaScript fallback. No content endpoint or mutation was added.

## Account and security behavior

| Viewer or state                 | Account actions                                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous                       | Customer shortcuts lead to sign-in with a fixed, encoded internal return path.                                                                                                                      |
| Customer                        | Existing payment, garage, security and support destinations remain available.                                                                                                                       |
| Staff / Admin / Super Admin     | Existing work support and personal account-security destinations are shown. Customer payment and garage actions are replaced with explanatory text; no broader finance or stock access is inferred. |
| Session checking or unavailable | Private shortcuts are absent. Public help and contact remain usable; an unavailable session has a retry action.                                                                                     |

The session projection is validated, obsolete requests are aborted and account links are cleared/rechecked on `SESSION_CHANGED`. The route performs only shared session reads, not private record reads or writes. Backend role enforcement remains authoritative. Customer support uses `requireCustomer`; the existing work support router uses `requireStaff`, with its existing MFA/record policies. Frontend role fixtures do not prove those backend policies or an MFA ceremony.

The address remains **133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria**. External article actions and WhatsApp use fixed approved destinations, new-tab labels and `noopener noreferrer`. Phone/email use existing constants. No hours, reply-time promises, policy terms, payment success or live inventory are fabricated. The existing FAQ reminder about not sharing credentials is preserved.

## Verification

Environment: standalone production preview at `http://localhost:3001`, existing isolated API at `localhost:5012`, and Microsoft Edge through repository Playwright because Browser/IAB was unavailable. No new backend writes were required.

| Check                           | Evidence                                                                                                                                                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build and static checks         | Final production build, separate TypeScript check and final changed-file ESLint passed. Full frontend lint passed before the final search/reset correction.                                                                                                                |
| New browser suite               | All 24 scenarios passed in the final run of `tests/e2e/help-quality.spec.ts`.                                                                                                                                                                                              |
| Existing regressions            | The public Help search/recovery test passed. The article-navigation/related-guidance test initially skipped behind its fixture opt-in, then passed with `RUN_BRAND_TESTS=true` and a temporary fixture server on port 5013. Both existing scenarios have passing evidence. |
| Responsive                      | 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px passed content, control and overflow checks.                                                                                                                                                                     |
| Accessibility                   | Axe WCAG 2 A/AA, 2.1 AA and 2.2 AA tags passed at 320, 390, 768, 1280, 1440 and 1536px, plus the 320×568 empty state. No rules were disabled. Keyboard disclosure, focus movement and clear/reset passed.                                                                  |
| Discovery and history           | All eight categories, multiword/category-name search, no-match recovery, reload, article return and browser Back/Forward passed.                                                                                                                                           |
| Roles and sessions              | Anonymous and all four roles passed shortcut/private-request checks. Unavailable and malformed sessions recovered through retry; obsolete responses could not restore account links after a session change.                                                                |
| Progressive enhancement         | Search, mobile topic selection, clearing and article disclosure worked with JavaScript disabled.                                                                                                                                                                           |
| Public content and destinations | All twelve article URLs returned 200; approved external links, phone/address and literal bounded query handling passed.                                                                                                                                                    |
| Unmocked browser health         | HTTP 200, correct title, CSP and `nosniff`; no page/console errors or failed non-auth responses. Only two shared session reads occurred (header and Help); anonymous-session 401 was expected.                                                                             |

The first browser run passed 17 scenarios and failed seven session-dependent scenarios because its success fixture omitted the API envelope's required `message`. The fixture was corrected; production validation was retained. The final full run passed all 24. Role/error fixtures test UI behavior and do not certify backend authorization or provider delivery.

## Fidelity ledger

| Item              | Baseline or concept difference                                         | Implemented treatment                                                                                      |
| ----------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Heading scale     | Baseline and generated lettering exceeded the requested compact scale. | Bundled Nippo title at 28–36px, with 15px supporting copy.                                                 |
| Search visibility | Baseline search had a barely visible field boundary.                   | White input on ink, visible border, search icon, label and explicit Search action.                         |
| Topic navigation  | Baseline wrapped nine buttons above the answers on mobile.             | Desktop topic rail; one native selector on mobile, both derived from the same article categories.          |
| Answer anatomy    | Baseline links had stray question marks and weak grouping.             | Contiguous native disclosures, deliberate dividers, readable answer copy and proper arrow icons.           |
| Account actions   | Every viewer previously received customer dashboard links.             | Verified role-specific destinations, fail-closed session states and retry without blocking public reading. |
| Contact rhythm    | Baseline repeated support and generic contact sections.                | One consolidated contact section with approved phone, email, WhatsApp, address and follow-up link.         |
| Search recovery   | Single-string matching missed useful multiword/category queries.       | Complete-collection token matching, meaningful no-results state, working clear action and URL restoration. |

Accepted concepts and final-build screenshots were inspected with `view_image`, including desktop/mobile first viewports, contact sections and the short-screen empty state. Desktop capture includes 1536×1024, matching the first concept's raster dimensions. The mobile concept is a scaled presentation; behavior was verified at actual 320–430px browser widths. The written brief governs real font scale and existing navigation/footer. Expanded concept rows are interactive-state references; the initial list remains collapsed for scanning. Above-the-fold copy matches the approved brief, with the required breadcrumb and explicit search action added. The implementation was faithfully verified against the accepted layout and these documented constraints; no unresolved visual mismatch was identified in the tested states.

## Artifacts and remaining scope

Production: [Help page](../../app/help/page.tsx), [Help Centre component](../../app/components/help-centre.tsx), [scoped styles](../../app/help/help.css). Tests: [Help quality suite](../../tests/e2e/help-quality.spec.ts).

Local QA files remain outside the repository under `C:/Users/PC/.codex/`: `help-oct-before-*`, `help-oct-after-*`, and `help-oct-*.log`. Test screenshots are `help-quality-*.png` in the OS temporary directory. Only the accepted concept references and permanent regression tests are added to the repository.

This local page gate is complete. It does not certify staging, provider delivery, other browser engines or Help article-detail visual acceptance. The Help index requires no mandatory new backend capability. Local FAQs remain the source of help content; a CMS is not required by the current page. Help article detail, commerce, Quotation, authentication and dashboard gates remain open. Deployment verification remains separate in the [backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md).
