# Allied AutoTech — Home, Parts and Vehicles UX Remediation

## Complete implementation prompt for Codex

Act as the senior frontend engineer and UI/UX lead responsible for improving Allied AutoTech’s public discovery and enquiry experience. Implement the changes below in the actual repository. This is an implementation request, not a request for another list of recommendations or a standalone visual mockup.

Primary pages:

- https://alliedautotech.com/
- https://alliedautotech.com/parts
- https://alliedautotech.com/vehicles

Supporting scope: the parts enquiry handoff to Contact and shared components/styles directly affected by these changes. Do not turn this into an unrelated dashboard rewrite, new chatbot, payment redesign or complete platform rebuild.

The goal is to make the site immediately understandable, make parts and vehicles easier to discover, reduce unnecessary decisions, improve content hierarchy and ensure every visible action leads to an honest, useful result.

## 1. Evidence and limits of the audit

A live desktop inspection on 24 October 2026 observed the following. Reproduce and revalidate them before changing code because the site may have changed.

1. Parts displayed zero products and “No products are listed yet,” while still presenting extensive discovery controls and disabled pagination.
2. Vehicles displayed zero vehicles and “No vehicles are listed yet,” while presenting search, filters, sort and disabled pagination.
3. The Parts make selector returned no catalogue suggestions, including for Toyota. Model/year could not be selected through that path. Clicking the finder produced a choose-make/model/year validation message.
4. Parts exposed ten additional vehicle-detail fields together, including engine code, market, axle, brake hardware, brake diameter, generation and chassis/model code.
5. The vehicle filter panel emphasised final-assembly shortcuts and exposed numerous fields, including exact-name inputs, overlapping year controls and featured/non-featured choices.
6. Vehicle condition filtering worked: selecting Foreign Used updated the URL, showed a removable chip, and produced a filtered empty state. Clearing the filter worked.
7. Vehicle lifestyle cards presented distinct intentions but directed users to the same inventory anchor without a meaningful distinction in results.
8. Home repeated brand reassurance, service, vehicle and parts promotion across numerous substantial sections. Its four carousel selectors included two vehicle themes.
9. The homepage service preview showed “Tyre Change” with the description “Changing tyres.” This observation does not establish the entire service catalogue’s contents.
10. Home displayed empty product, vehicle and review modules. The empty review module offered a refresh action.
11. Inspected styles used Nippo for prominent headings and Quicksand for body text. Several explanatory passages were 13–14px. This is a readability/design observation, not a measured accessibility failure.
12. The parts enquiry destination pre-filled a parts-verification subject/message, but its Enquiry type remained General. Its context message claimed selected details were included even on a generic parts request with no actual vehicle selection.

The audit did not establish why inventory was empty. It did not verify populated cards/detail pages, mobile behaviour, authenticated journeys or checkout. Do not report those as already inspected or broken. Do not mistake browser-extension console errors for application failures.

Preserve the working filter URL/chip/clear behaviour, enquiry prefill, FAQ expansion and carousel pause controls while improving the experience.

## 2. Discover the implementation first

Read applicable AGENTS.md files, project documentation, package scripts and current business-policy records. Preserve unrelated work and existing instructions.

Inspect actual components, routes, state management, API clients, validation, schemas, feature flags and styling tokens. Historical project context suggests a Next.js frontend and Express/Prisma backend; verify the current structure.

Trace the product and vehicle requests from page state to API response and publication/availability rules. Determine whether zero results reflect real unpublished inventory, unexpected defaults, faulty query mapping, caching, missing data or request failures. Record evidence; do not guess.

Give a brief implementation sequence and proceed with authorised fixes. Do not stop after planning when useful work is feasible. If real inventory is unavailable, continue by using isolated development/test fixtures for populated-state verification. Do not publish those fixtures as genuine stock.

## 3. Protect business rules and existing capabilities

Use current approved business records as the authority. Where still current, preserve collection-only fulfilment for parts and enquiry/inspection vehicle workflows, with delivery and paid vehicle reservations deferred.

Do not invent prices, stock, testimonials, branch choices, service scope, compatibility guarantees, response times or booking confirmations. Verify claims rather than filling attractive layouts with unsupported content.

Preserve authentication, authorisation, price handling, inventory rules, payment verification and backend validation. A submitted request is not automatically a confirmed appointment, verified payment or reserved item.

Retain useful advanced filtering and vehicle-fitment precision. Simplify how capabilities are presented rather than deleting meaningful functionality. Do not disable a functioning workflow merely because the current production catalogue is empty.

Do not change secrets, seed production, submit real enquiries, initiate transactions or deploy merely to demonstrate progress. Follow the repository’s established release process and the user’s actual publication instruction.

## 4. Handle catalogue states honestly

Create explicit, independently testable states:

- Loading: useful layout-preserving feedback, with no premature zero-results claim.
- Populated catalogue/results: products or vehicles, clear count, appropriate discovery controls.
- No published catalogue: compact availability explanation with a relevant enquiry action.
- No matches within an existing catalogue: visible applied constraints, clear recovery and filter removal.
- Request failure: error and retry; retain user inputs.
- Invalid query: helpful correction without silently dropping meaningful constraints.

Do not infer “no catalogue” solely from a filtered result count of zero. Use reliable public publication metadata or equivalent existing evidence. If global availability is unknown, use wording that does not overstate the cause.

For a genuinely empty catalogue, remove or collapse sorting, irrelevant filter controls, redundant zero-count text and pagination. Show the useful availability/enquiry path near the top. Preserve valid request information that can assist an enquiry.

For filtered empty results, keep the controls and selected filters available. Do not suggest changing filters if the underlying catalogue is known to be entirely empty.

Do not render pagination when there are no results or no additional pages. Do not replace an API failure with “no products are listed yet.”

## 5. Reorganise Parts around customer intent

Provide two clear discovery paths:

1. “I know the part”: search by part name, brand or part number, with category browsing.
2. “Find parts for my car”: make/model/year, followed by relevant category and configuration details.

Use a compact segmented choice, clearly separated compact sections or another pattern that fits the existing design system. Do not add a modal that must be completed before browsing, and do not force sign-in for basic discovery.

Make the most useful search controls and actual results visible earlier. Reduce the combined height of the promotional hero, repeated headings, explanatory copy, sign-in message and divider rows. Do not prescribe one universal “above the fold” position; verify the resulting hierarchy at representative screen sizes.

Keep product search a distinct, persistent capability. Preserve entered search/filter/vehicle context when switching discovery paths wherever meaningful. Avoid hidden criteria continuing to affect results without visible chips.

Make “Use a saved vehicle” a compact optional shortcut. For signed-out users, show a secondary sign-in link while keeping manual discovery available. Preserve a safe return route and relevant non-sensitive context.

## 6. Make the vehicle finder usable and technically honest

Investigate the missing make suggestions. Fix data/query problems where supported by evidence. If no fitment catalogue is published, explain that limitation and offer a direct parts-enquiry path instead of letting users repeatedly attempt an impossible selection.

Make dependent make/model/year behaviour clear. Reset only incompatible dependent selections, explain important resets and keep focus sensible. Prevent stale asynchronous responses from replacing the newest suggestions. Test typed text versus a validated catalogue selection.

Maintain the distinction between verified fitment, a possible candidate, incompatibility and unknown compatibility. Matching make/model/year alone must not become a fitment guarantee.

Replace implementation-oriented wording with customer language. Examples:

- “Choose a catalogue make” → “Choose your vehicle make.”
- “No matching catalogue make” → a clear unavailable/no-match message with help.
- “Optional, required for some parts” → explain why additional details matter when they actually become relevant.

If a finder cannot proceed, explain the prerequisite beside the relevant control and provide a useful alternative. Do not rely on a silently disabled button or a generic toast.

## 7. Progressively disclose technical fitment fields

Do not display every technical attribute as one generic customer form. Show details relevant to the selected part category and known configuration, based on the real compatibility model.

Examples, subject to actual rules:

- Brake parts: position/axle and relevant brake specifications.
- Engine parts: relevant engine identification.
- Other categories: only attributes required to distinguish suitable variants.

If the backend does not support category-specific rules, do not invent them. Group existing fields meaningfully, retain an “All technical details” option where useful and document the remaining modelling dependency.

Provide “I don’t know—help me check” with practical guidance or an enquiry route. Explain where a detail can be found if verified guidance exists. Do not require speculative customer entries to make a form valid.

Retain useful entered details in an enquiry handoff without claiming unknown values are verified. Do not collect unnecessary personal information or place it in shareable URLs.

## 8. Prioritise vehicle shopping filters

Make common purchase decisions prominent. Initial proposed hierarchy:

1. Budget.
2. Make and model.
3. Vehicle condition.
4. Model-year range.
5. Body type.

Use this as a reasoned starting point, adapting it to actual data and customer requirements. Keep first-level choices scannable; do not expose every field immediately.

Keep Brand New, Foreign Used and Nigerian Used distinguishable. If the data also includes generic Used with unspecified origin, preserve it honestly with an understandable explanation. Do not silently reclassify inventory or confuse usage/import condition with assembly country.

Move less frequent attributes into clearly labelled advanced groups: transmission, mileage, fuel/powertrain, drivetrain, engine capacity, assembly location and supported equipment/features.

Retain the existing URL-backed filter state, removable chips, clear-all action, sorting, refresh/deep-link behaviour and recovery. If there is an Apply workflow, distinguish draft values from applied values and preserve predictable cancel/clear behaviour.

## 9. Simplify the vehicle filter controls

Remove “exact name” from the visible customer interface. Use controlled suggestions and normalisation backed by supported API behaviour. If exact matching is an actual constraint, help users select a valid value rather than requiring them to guess spelling.

Consolidate exact Year plus Year from/to into a clear year-range interaction. Support one year by setting equal bounds if the contract permits it. Validate impossible dates and inverted ranges.

Use understandable price formatting in naira. Verify any naira/kobo conversion at the API boundary. Do not accidentally multiply or divide amounts twice. Validate minimum/maximum price and mileage ranges and provide clear inline corrections.

Replace “Recorded feature (exact name)” with useful supported feature choices or accessible suggestions when such data exists. Do not fabricate a comprehensive feature taxonomy. Defer the filter if no reliable searchable data supports it.

Remove customer-facing “Non-featured only” unless repository/business evidence establishes a real customer use case. Keep merchandising controls in the appropriate administration experience; do not delete their backend meaning.

Review overlapping fuel/powertrain options. Make the relationship understandable without silently changing data semantics. Keep advanced distinctions where useful and document any schema mismatch.

Keep final-assembly details available but secondary. Label countries and regions consistently. Do not suggest a country/region proves quality, import condition or suitability.

Use a compact desktop presentation with coherent grouping and a mobile drawer/sheet if suitable. Provide reachable Apply/Clear controls when the panel is long without obscuring content or keyboard focus.

## 10. Make lifestyle content earn its space

The Family comfort and Executive presence cards should not imply different discoveries while sending users to an identical unfiltered inventory position.

Choose the best supported outcome:

- Apply transparent, relevant filters with accurate result expectations.
- Offer concise editorial guidance clearly labelled as guidance.
- Remove or reduce the section where it adds no distinct value.

Do not invent a family-safety or executive-suitability classification. A body style alone does not establish vehicle safety, comfort or professional suitability. Explain any selection criteria used.

Avoid duplicating a substantial lifestyle module on both Home and Vehicles unless the two instances serve distinct useful purposes. Do not replace one redundant module with several new decorative ones.

## 11. Edit the homepage around distinct questions

Reduce repetition and prioritise useful evidence. Proposed flow:

1. Clear business proposition, Port Harcourt location and primary next action.
2. Three recognisable routes: services, parts and vehicles.
3. Substantive service highlights using actual available content.
4. Workshop expertise/equipment with authentic supporting material where supplied.
5. A concise explanation of the service process.
6. Relevant inventory previews when populated.
7. Genuine customer reviews when available.
8. Practical FAQ, location/contact and final next step.

Adapt the implementation to available content. Each section must answer a distinct question: what do you do, can you help me, why trust you, what happens next, what can I browse, or how do I contact you?

Merge repeated trust/quality statements. Reduce excessive vertical gaps and repeated calls to identical destinations. Preserve meaningful whitespace and a clear visual rhythm. Do not make an arbitrary percentage reduction in page height the success metric.

When vehicle or product previews are empty, omit the merchandising module or replace it with one compact, honest enquiry option. Avoid repeated “nothing is published” announcements across the page.

Omit the public testimonials module when no genuine published feedback exists. Show refresh/retry for an actual fetch failure, not as the main response to a known empty collection. Never invent reviews, ratings or customer counts.

## 12. Strengthen the hero and motion hierarchy

Keep “Built on trust, driven by quality” as brand language if approved, while making the first screen specific about the business, location and available action.

A possible copy direction, to verify against approved services, is “Vehicle diagnostics, repairs and maintenance in Port Harcourt.” Write supporting copy with useful meaning instead of adding another slogan.

Use one dominant action and a clear secondary action. Select labels that describe the real next step. Do not label an enquiry action as a confirmed booking or inspection.

The existing carousel and marquee may reflect previous owner preferences. Preserve those capabilities by default while improving their usefulness; record a justified static-hero alternative rather than silently removing an established requirement.

If the carousel remains, make each slide serve a distinct supported task. Reconsider giving two of four slides to vehicle themes when published inventory is unavailable. Use concise content, consistent CTA hierarchy and responsive image framing. Preserve accessible controls, pause and reduced-motion behaviour.

Reduce competing motion. A static service summary is the preferred alternative to a continuously moving marquee unless existing requirements justify retaining it. If retained, keep it readable, pausable and nonessential to understanding the business.

Do not add scroll hijacking, parallax, animated counters or entrance effects as a substitute for clearer content.

## 13. Improve copy without inventing services

Replace tautological descriptions such as “Tyre Change — Changing tyres” with useful approved information about scope and next steps. Inspect existing service records/documentation first.

Do not invent balancing, alignment, warranties, turnaround times, inclusions or prices. If authoritative details are missing, improve the surrounding layout and provide a precise content request for the owner. Do not overwrite an operational service record with speculative marketing prose.

Standardise terminology across navigation and pages. Decide how Shop, Parts and automotive products relate, using the established brand language and customer clarity. Do not rename routes unnecessarily.

Keep booking, enquiry, quotation, order and payment states distinct. Remove internal terms and unnecessarily formal warnings where a shorter accurate explanation works. Keep essential compatibility and confirmation information at the decision point.

## 14. Refine typography and visual hierarchy

Keep the established brand identity. Audit existing font tokens and intended use before changing font families or adding downloads.

Use the strongest Nippo/display treatment selectively for primary brand headings. Create a more restrained section-heading tier and consistent product/form typography. Retain Quicksand if it remains the approved body family; improve size, weight, line height and layout before replacing it.

Increase important explanatory body text toward 16px where appropriate. Keep supporting labels/captions smaller only when genuinely secondary and readable. This target is a design recommendation, not a claim that every smaller font violates accessibility.

Review hierarchy, line lengths, heading wraps, contrast, field labels, icon alignment, button padding, border strength and visual density. Use shared tokens and components rather than page-specific overrides for every detail.

Avoid fixed-height text containers and mandatory line breaks that fail at intermediate widths or enlarged text. Make the results count and selected state readable without giving them disproportionate prominence.

## 15. Improve imagery and business credibility

Prefer available authorised images of the actual workshop, entrance, staff, equipment, products and vehicles. Bring authentic business evidence earlier in Home where it supports the proposition.

The original campaign poster photograph is authentic source material but is not automatically the best hero photograph. Use it appropriately; do not stretch, upscale excessively or disguise its limitations.

Do not invent staff portraits, workshop scenes, facilities, certifications or inventory and present them as genuine. Keep editorial imagery appropriately labelled. If better assets are needed, supply a short specific capture list rather than blocking all other work.

Use deliberate image ratios, useful crops, appropriate alternative text and stable reserved space. Verify below-the-fold images after scrolling; do not call lazy-loaded imagery broken solely because it was absent in an initial full-page capture.

Optimise delivery through the existing framework. Avoid unnecessary priority loading, oversized sources and layout shifts.

## 16. Fix enquiry context precisely

Trace the parts-specific Contact handoff. Select the Product enquiry type using the actual existing enum/contract. Preserve the useful parts-verification subject and editable message.

When a validated vehicle or part selection exists, carry supported context accurately. When the user only opens a generic parts request, say they can add details; do not claim selected details were included when none were supplied.

Preserve intentional user edits and do not repeatedly reset the message or enquiry type during rerenders. Use safe structured handling, validate URL/context values and avoid personal information in shareable query strings.

Verify refresh, direct links, Back/Forward and the distinction between prefill and submission. Do not send a real enquiry during testing.

Review branch-related text and controls against actual operational choices. Do not delete legitimate multi-branch support, but do not ask customers to select a preferred/handling branch if no meaningful choice is supported. Verify any hours or response-time promises encountered in the affected flow against current approved records.

## 17. Verify populated layouts using isolated fixtures

The desktop audit could not assess real product/vehicle cards because both catalogues were empty. Treat their redesign needs as requirements to evaluate, not established defects.

Use local/test fixtures or an existing approved non-production dataset to inspect short/long names, varied prices, missing images, stock states, unknown compatibility, different conditions, a single listing and multiple pages.

For Parts, assess image, product name, brand/part number, price or price basis, availability, compatibility status and actual next action. For Vehicles, assess real listing images, title, price or enquiry basis, year, mileage, condition, relevant specifications and actual enquiry/inspection action.

Use a responsive grid or list appropriate to content. Do not cram every attribute into a card or require hover to reveal essentials. Keep details accessible and action labels unambiguous.

Do not publish fixtures as available inventory, fabricate report badges or imply professional inspection/certification without supporting records.

## 18. Accessibility and responsive requirements

Use the project’s accessibility target, with WCAG 2.2 AA as a baseline where no stronger applicable requirement exists. Consult authoritative guidance for relevant requirements; do not claim compliance from an automated score alone.

Verify labels, semantic headings, keyboard operation, focus visibility/order, meaningful announcements, contrast, text resizing and reduced motion. Use links for navigation and buttons for actions.

Test searchable comboboxes, dependent fields, range inputs, filter disclosures, chips, clear/apply controls, carousels and FAQ. Make loading/no-match/validation states understandable to assistive technology without excessive announcements.

For mobile filter sheets, implement correct focus, scrolling, dismissal and return focus. Do not trap focus in a non-modal panel while requiring interaction with the page outside it.

Inspect representative widths such as 320, 390, 768, 1024 and 1440 CSS pixels, plus actual transition points. Include long content, zoom, short screens and mobile keyboards where tooling permits. State whether checks are emulated or on real devices.

Prevent horizontal page overflow, clipped menus, crowded controls, sticky overlaps and support widgets covering critical content. Do not merely shrink the desktop form. Keep primary controls and actions reachable without needless scrolling.

## 19. State and API correctness

Preserve and test useful filter/search state in URLs, refresh and navigation. Retain independent criteria when removing one chip. Clear dependent values only when necessary and avoid ambiguous hidden filters.

Validate external query values server-side. Keep supported enums, condition meanings, units and price conversions correct. Handle unsupported or malformed values predictably.

Avoid request races, stale suggestions and duplicate submissions. Use bounded loading, cancellation/debouncing where suitable and helpful retry. A selection change must not turn a transient request failure into an authoritative empty-catalogue claim.

Do not rewrite stable API contracts for cosmetic convenience. If a backend change is genuinely required, implement a compatible fix within scope and document the reason. Preserve existing session, rate-limit and validation controls.

## 20. Test the meaningful risks

Use the existing test framework and appropriate repository commands. Add focused regression coverage for the logic changed; do not manufacture trivial tests for individual spacing values.

Required cases, as applicable:

- Catalogue loading, real emptiness, filtered emptiness and failures remain distinct.
- The make/model/year finder handles valid selections, unavailable data, typed-but-unselected text and dependent resets.
- Compatibility remains unknown when required technical evidence is absent.
- Vehicle condition remains distinct from assembly location and filter semantics are preserved.
- Price, year and mileage ranges validate and map to API units correctly.
- Apply/cancel/clear/chip removal, URLs, refresh and Back/Forward behave consistently.
- Older search/suggestion responses cannot overwrite newer intent.
- Parts enquiry selects Product and conditionally describes actual transferred context.
- Generic entry and user-edited prefill survive rerenders without overwriting work.
- Home handles populated, empty and failed previews/reviews appropriately.
- Shared typography/control changes do not regress representative adjacent pages.
- Keyboard and responsive interactions work across relevant states.

Inspect rendered pages with available browser tools. Capture useful before/after evidence internally. Use test environments and fixtures, never real operational submissions. Report unavailable coverage rather than claiming it passed.

## 21. Implementation order and checkpoints

1. Reproduce findings and trace catalogue/finder data paths.
2. Fix proven reliability defects and explicit state handling.
3. Correct the enquiry classification/context behaviour.
4. Reorganise Parts discovery and technical-detail disclosure.
5. Reorganise vehicle filters while retaining useful capabilities.
6. Simplify Home, improve copy hierarchy and conditionally render merchandising/review modules.
7. Refine typography, imagery, spacing and responsive behaviour.
8. Verify populated fixtures, state transitions, accessibility and regressions.

This order is a working sequence, not permission to stop after the first item. Complete feasible independent work across the full requested scope. If an external business/content dependency blocks one part, record it and continue other authorised improvements.

Maintain one concise implementation checklist in the existing project documentation or issue system. Distinguish fixed, verified, blocked, deferred and not applicable. Do not create a competing governance system or replace the prior standing UI/UX directive.

Make ordinary reversible implementation decisions autonomously. Ask only when an unresolved business decision materially changes the correct result. Do not request approval for routine layout, label or shared-component fixes already covered here.

## 22. Acceptance criteria

The work is ready for review when:

1. A new visitor can identify the business, location and relevant next step promptly.
2. Home sections have distinct purposes, and empty inventory/review modules no longer dominate the page.
3. Parts supports clear direct-search and vehicle-based paths with manageable initial complexity.
4. The finder offers valid supported choices or an honest useful fallback; no unexplained dead end remains.
5. Additional fitment fields are relevant/grouped and unknown details never become confirmed compatibility.
6. Vehicle condition, budget, make/model and year are easy to reach, while useful advanced filters remain available.
7. Exact-name jargon, redundant year controls and unsupported merchandising filters are addressed without corrupting data semantics.
8. Lifestyle cards perform distinct useful functions or are reduced/removed appropriately.
9. Empty, no-match and failed requests have accurate distinct recovery paths.
10. Parts enquiries are correctly classified and accurately preserve available context.
11. Typography, spacing, imagery and hierarchy are coherent across the three pages and affected shared components.
12. Relevant desktop/mobile, keyboard, populated-fixture and regression checks pass, with limitations documented.
13. No fabricated content, unrequested operational submissions, weakened security or unintended business-rule changes were introduced.

Do not claim completion based only on compilation, screenshots of empty catalogues or a restyled hero.

## 23. Final handoff

Report what changed and why it helps customers, organised by Home, Parts, Vehicles and the affected enquiry flow. Include actual checks/results, meaningful before/after evidence where available, and unresolved dependencies.

Provide a short owner-content list only where genuinely necessary: approved service details, authentic photographs, publishable inventory, verified policies and real reviews. Engineering work should not silently invent those inputs.

Leave a clear resume checkpoint if anything remains incomplete. Follow the existing review/deployment process; implementation does not by itself authorise production publication.

Start now by reading the repository instructions, reproducing the highest-impact findings and implementing the first coherent batch. Continue toward the full requested result. Every improvement should make the user’s next decision easier while preserving accurate information and working functionality.
