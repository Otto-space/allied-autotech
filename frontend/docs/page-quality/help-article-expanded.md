# Help articles — expanded local acceptance

Date: 7 October 2026. Route: `/help/[slug]`, covering all twelve current article variants and the unavailable-article state. This is a completed local page gate, not whole-application or deployment acceptance.

## Audit and implementation

The former template used a large heading, a category-only breadcrumb with text separators, one answer paragraph and generic related links. Customer account actions were exposed without a session/role check. Unknown articles used the general site recovery page, which did not lead back to Help.

Two fresh [concept references](help-article-oct-concepts/README.md) define the desktop article and mobile reading order. The implementation uses a compact ink breadcrumb band, a white reading column, a grey related-help rail and a separate contact band. Bundled Nippo and Quicksand, 28–36px title sizing, 44px minimum controls and visible focus maintain the current brand system. Desktop columns stack on mobile.

Every approved FAQ answer is retained verbatim. Three topic-specific preparation notes supplement each answer, using the existing workflow context. These are helpful details rather than new required fields or policies. No authors, dates, reading times, rating totals, availability promises, refund terms or successful payment states are invented. The confirmed workshop landmark remains beside Kilimanjaro.

The topic link returns to the Help index with the actual category selected. Related articles exclude the current article and use the same category where available. The fallback heading says “More help” rather than implying a category relationship. Contact, telephone and WhatsApp use approved destinations; external links have new-tab labels and `noopener noreferrer`.

The page stays a Server Component. Public actions render on the server; only account-dependent actions use the small client component. A shared pure action resolver now serves both Help index and article views. The Help-specific unavailable state provides a working return to the index and preserves the public shell.

## Roles and metadata

| Viewer/state                    | Article action                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous                       | Sign in with a fixed, encoded internal return path.                                                                                                                                                   |
| Customer                        | Existing payments, garage, account security or support destination.                                                                                                                                   |
| Staff / Admin / Super Admin     | Existing work support and personal-security destinations where applicable. Customer payment/garage actions are replaced by an explanation and contact link. No finance/stock privileges are inferred. |
| Checking or unavailable session | No private shortcut. Public reading remains available; failed or malformed sessions offer retry.                                                                                                      |

The session projection is validated. Session changes immediately clear the previous action and abort obsolete requests. The route performs no private record reads or mutations. Existing backend authorization, MFA and record policies remain unchanged and authoritative. The role fixtures verify presentation behavior; they do not certify an MFA ceremony or deployed authorization.

Breadcrumbs use an ordered list, icons, Home/Help links and the readable article title with `aria-current="page"`. At narrow widths, the middle item is hidden and the current item can truncate; its full name remains available through its title and the page heading. Metadata uses the existing operator-configured origin and indexing policy. Public breadcrumb JSON-LD is emitted only when indexing is enabled with a valid origin and the URL has no query parameters. Unknown and filtered pages are `noindex`; query text and request Host do not establish article identity.

## Verification

Environment: production standalone preview at `http://localhost:3001`, existing isolated API at `localhost:5012`, Microsoft Edge through repository Playwright because Browser/IAB was unavailable. A temporary standalone preview at port 3002 used the deliberately non-production origin `https://allied.example` for metadata checks and was stopped afterward.

| Check                   | Result                                                                                                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build/static            | Production build passed, including TypeScript, 70 route generations and standalone packaging. Full lint, separate TypeScript and final scoped checks passed.                                                                                                                                     |
| Article suite           | 33 of 34 scenarios passed in the combined run. The remaining missing-page assertion was corrected to validate every robots tag, then passed in a targeted rerun. All 34 distinct article scenarios have passing evidence.                                                                        |
| Shared Help index       | All 24 existing Help quality scenarios passed in the same combined run after extracting the shared action resolver.                                                                                                                                                                              |
| Existing article flow   | The category → article → related-guidance regression passed with its fixture opt-in enabled. Its anonymous action expectation now correctly checks the sign-in destination.                                                                                                                      |
| Responsive              | 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px passed article/breadcrumb/control checks. All twelve article variants were also checked at desktop and 390px.                                                                                                                          |
| Accessibility           | Axe WCAG 2 A/AA, 2.1 AA and 2.2 AA tags passed at six article widths: 320, 390, 768, 1280, 1440 and 1536px. The unavailable state separately passed at 320, 390 and 1440px. No rules disabled.                                                                                                   |
| Content/navigation      | All twelve answers, preparation lists, topic destinations, related exclusions and action targets passed. Related navigation and browser Back update both title and account target. Public content/topic navigation work without JavaScript.                                                      |
| Session behavior        | Anonymous and all four roles, session errors, malformed sessions, retry and delayed obsolete responses passed. No private-data read or mutation was made.                                                                                                                                        |
| Unmocked browser health | Payment and MFA articles returned successfully with no page/console errors or failed non-auth responses. Only shared session reads occurred. CSP and `nosniff` were present; expected anonymous-session 401 is excluded from the error count.                                                    |
| Metadata/404            | Real server-rendered JSON-LD had the expected three breadcrumb items. Canonical URLs used the configured test origin despite a spoofed Host. Filtered pages omitted breadcrumb data and were `noindex`. Unknown articles returned HTTP 404, did not reflect the slug and recovered through Help. |

The combined run was **57 passed / 1 failed**, not an all-green run. The failed assertion assumed one robots tag, while Next.js added its own `noindex` tag alongside page metadata. Both were valid. The corrected test now requires at least one policy, validates every policy as `noindex`, and asserts HTTP 404. The targeted recovery and existing article regression both passed. No production validation was weakened.

## Fidelity ledger

| Item                | Concept/baseline issue                                                          | Final treatment and evidence                                                                               |
| ------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Title and hierarchy | Baseline and generated type were larger than the written compact scale.         | Actual Nippo at 28–36px; article title, topic and answer headings inspected on desktop/mobile.             |
| Reading layout      | Baseline put every section in one long white column.                            | White main article, grey related rail and separate contact band; columns stack in reading order on mobile. |
| Breadcrumb          | Baseline showed a category rather than the current article, using text slashes. | Ordered Home/Help/title trail, proper chevrons, current-page semantics and bounded mobile title.           |
| Action state        | Concept depicts a signed-in customer; baseline exposed that link to everyone.   | Correct role-specific action or sign-in/retry/explanation, tested across all supported roles.              |
| Preparation content | Baseline offered no concise preparation guidance.                               | Three plain numbered rows per article, without turning them into new requirements or repeated cards.       |
| Related links       | Unrelated fallback items were labelled “Related help.”                          | Same-category links keep that label; fallback suggestions use “More help.”                                 |
| Mobile consistency  | Generated mobile reference changed the logo and breadcrumb color.               | Existing logo retained; desktop ink breadcrumb treatment applied consistently at all widths.               |
| Recovery state      | General missing-page UI sent visitors toward unrelated routes.                  | Help-specific message, readable breadcrumb and a tested return to Help.                                    |

Accepted concepts and final screenshots were inspected with `view_image`, including the desktop concept's native **1435×1096** viewport, actual 390px mobile output, the longer MFA article and unavailable state. Above-the-fold article copy matches the original answer and selected topic; the concept's action varies with the verified viewer. Existing navigation/footer and the written font limits supersede generated substitutes. The implementation was faithfully verified against the accepted structure and documented constraints; no unresolved visual mismatch was identified in the tested states.

## Files and limitations

Production: [article page](../../app/help/[slug]/page.tsx), [account action](../../app/help/[slug]/article-account-action.tsx), [article styles](../../app/help/[slug]/article.css), [unavailable state](../../app/help/[slug]/not-found.tsx), [shared action policy](../../lib/help-actions.ts), [preparation notes](../../lib/help-article-guidance.ts), and the [Help index integration](../../app/components/help-centre.tsx). Tests: [article quality suite](../../tests/e2e/help-article-quality.spec.ts), [existing article regression](../../tests/e2e/brand-refresh.spec.ts).

Evidence lives outside the repository under `C:/Users/PC/.codex/`: `help-article-oct-before-*`, `help-article-oct-after-*`, `help-article-oct-native-desktop.png`, `help-article-oct-security-*`, `help-article-oct-notfound-*` and the corresponding build, lint, types, browser, recovery-regression, health and SEO logs. Test captures use `help-article-quality-*.png` in the OS temporary directory. Accepted concepts remain in the repository; temporary scripts and screenshots are not application assets.

No new mandatory backend capability was required. Deployment, live provider behavior, other browser engines and the broader account/commerce workflows remain outside this gate. Resume the remaining Quotation and transactional milestones; the full application goal remains open. See the [backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md).
