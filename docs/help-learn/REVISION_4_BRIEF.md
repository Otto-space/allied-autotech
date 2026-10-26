# Allied AutoTech — Workforce Access, Secure Allie and Connected Customer Care

Inspection date: 26 October 2026.
Revision 4: Manage Workforce & Responsibilities, dynamic dashboard access and preservation of Customer Care pages. Updated 26 October 2026.

Implementation precedence: sections 25–36 make real AI conversation a required capability when credentials/configuration are available. They supersede earlier wording that treats AI as optional or regards a scripted helper as the completed assistant. Reviewed search remains the operational fallback. All earlier visual, role-coverage, guide and practice requirements remain in scope. Sections 37–44 establish the workforce-access foundation: implement and verify that foundation before relying on it for Allie eligibility or live-chat assignment. Customer Care pages remain in place; chat extends their existing workflows.

## 1. Mission and scope

Act as the senior product engineer and UI/UX designer. Improve:
- /help.
- The Help & Learn entry on /help.
- /learn and its article/guide views.
- Existing safe-practice pages.
- The floating Help & Learn launcher/panel.
- Optional walkthroughs connected to these features.
- Contextual Help & Learn, Allie, task instructions and safe practice across every existing dashboard, role and authorised responsibility. Sections 17–24 define this expanded scope.
- Manage Workforce & Responsibilities: account roles, workforce positions, responsibility assignments, effective permissions and scope; dashboard navigation driven by the same access decisions as the backend.

Add a small, friendly assistant with useful interaction. “Allie” is a proposed working name, not an already approved brand identity. Keep the name easy to change.

The result should help customers and authorised staff understand the website, follow a task and practise safely. It must be professional, approachable and usable without long technical explanations.

Implement a real connected experience, not a decorative robot that opens another wall of links.

Preserve unrelated homepage, dashboard, fitment, media and commerce work. This scope includes the workforce-access improvements in sections 37–44, dashboard assistance integration and limited underlying UI corrections needed to make a real task understandable or a guide usable. Avoid an unrelated redesign of every operational module.

## 2. Verified observations and limits

Authenticated desktop inspection covered Help, the Learn hub, a Customer Care article, the floating panel, written parts-guide steps, the Customer Care practice exercise and the parts walkthrough.

| ID | Observed issue | Improvement direction |
| --- | --- | --- |
| H01 | Help & Learn entry is a long inline link between the Help hero and search area; measured 15px text, about 19px tall, no padding/background/border | Give it a designed, well-positioned entry card with clear actions |
| H02 | Link text describes implementation concepts: “role-aware instructions, optional guides and safe practice” | Explain the benefit in everyday language |
| H03 | Learn shows articles first, with Guide me and Practise safely farther down the page | Make learning modes visible near the top |
| H04 | The floating control opens a large blocking modal containing much of the full hub again | Use a compact task-focused assistant and progressive navigation |
| H05 | Article titles include “scoped”, “privileged” and other technical language | Use understandable task titles while preserving precise internal metadata |
| H06 | Several generic hub topics say “Relevant to this page” | Reserve contextual claims for a genuine page match; use Recommended on the hub where appropriate |
| H07 | Article rendering relies on long prose and has no prominent return-to-results action in the inspected view | Use numbered task steps, a concise outcome and clear navigation |
| H08 | Practice displays two stacked “Practice mode · Fictional data only” banners plus repeated disclaimers | Keep a persistent mode signal and one concise explanation |
| H09 | “Fill fictional example” reports insertion in a choice-only exercise while the required choice remains unselected | Give the action a meaningful purpose, or replace it with an explicit hint/example explanation |
| H10 | A parts search briefly enabled Next step during loading, then left it disabled after results settled, without explaining the condition | Reproduce and fix guide state/progression before declaring it complete |

Useful existing foundations:
- Reviewed/versioned instructions.
- Audience/capability-aware topics.
- Article and guide deep links.
- Search: “customer care” returned the corresponding article.
- Explicit guide pause/restart/exit/written-step options.
- Practice mode and local fictional examples.
- A successful practice choice produced a review-complete explanation.

Reproduce H10 using /parts#learn=parts-find: enter “oil filter”, submit Search, wait for results, then try Next step. Do not assume the brief establishes the underlying cause.

The practice page describes its inputs as local in-memory simulation. The inspection exercised its UI; it did not independently prove network isolation. Add that verification.

Limits: one authenticated work account and desktop rendering were inspected. Guest, customer, other staff responsibilities, all recovery paths, mobile and complete keyboard coverage require fixtures/tests. Do not present transient sign-in/loading UI as confirmed guest behaviour.

## 3. Repository discovery

Read repository instructions, existing help/learn registries, guide state, route guards, practice components, shared UI and tests.

Find the current source of truth for:
- FAQs, articles, reviewed versions and sources.
- Role/permission/capability eligibility.
- Contextual route matching.
- Guide selectors/steps and completion conditions.
- Practice adapters/state and progress.
- Launcher/dialog/floating support layout.
- Release availability and support destinations.
- Any existing answer-retrieval or AI integration.

Preserve correct content and working interactions. Do not build a second help corpus, permission system or practice engine.

Use one shared content model for full-page learning and the assistant, with different presentation appropriate to each surface.

## 4. Improve the Help-page entry

Replace the bare sentence-link with a deliberate feature card integrated into the Help layout.

Suggested copy:
- Title: “Let Allie show you around.”
- Body: “Find an answer, follow a guide or try a task with sample data.”
- Primary navigation action: “Explore Help & Learn”.
- Secondary action: “Ask Allie”, once the assistant is implemented.

The final wording should remain clear if the assistant name changes.

Design:
- Align with the page content gutter and search width.
- Use a restrained brand-tinted surface, border, friendly robot illustration/icon and obvious CTA treatment.
- Keep enough spacing around the card; eliminate the flush-left strip between dark hero sections.
- Preserve FAQ search as a prominent task.
- On mobile, stack copy/actions cleanly.
- Avoid adding another large hero before users can search.
- Use links for navigation and buttons for opening assistance.
- Keep the link reachable without a hover interaction.
- Make the learning hub discoverable from appropriate footer/help navigation without duplicating every navigation item.

Keep existing FAQ category selection, answer links and support contacts working. Use consistent words for Help Centre versus Help & Learn, explaining the relationship briefly where needed.

## 5. Learning hub: three obvious modes

Place a concise welcome/search area and three clear modes near the top:

| Mode | Purpose | Examples |
| --- | --- | --- |
| Find an answer | Read a short explanation | What does this status mean? |
| Guide me | Follow optional steps on the relevant page | Find a product; follow a support request |
| Practise | Try a fictional task without changing real records | Draft a sample reply; inspect sample compatibility evidence |

Use a lightweight tab/segmented navigation or clear mode cards. Do not simply stack three long lists and force users to discover the distinction by scrolling.

Recommended hierarchy:
1. Compact Help & Learn title and benefit.
2. “What would you like to do?” search.
3. The three modes.
4. Relevant/recommended tasks.
5. Optional resume/recent learning, if safely supported.
6. A clear contact-a-person path.

Keep mode meaning visible. Do not use a decorative mascot at a scale that pushes useful content below the first view.

Use a balanced card grid:
- Meaningful task icon.
- Short task title.
- One-line outcome.
- Content kind: article, walkthrough or practice.
- Accurate duration/step count only when maintained.
- Clear Open / Start guide / Try practice action.

Do not fabricate popularity, completion counts, training duration or certification.

Make Clear search contextual to a nonempty query rather than a dominant permanent action next to an empty field.

## 6. Search and content navigation

Search across the eligible learning content, including articles, available guides and practice scenarios. If a content kind is not searchable in the existing contract, extend it coherently rather than implying universal search while ignoring it.

- Match normal user language and curated task synonyms.
- Support relevant terms such as customer care/support, product image/photo and compatibility/fitment.
- Keep technical task vocabulary available as aliases rather than forcing it into every title.
- Group or label results by content kind.
- Preserve query/mode/filter state when opening a result and going Back.
- Provide a useful no-match state with suggestions and contact support.
- Do not turn a failed load into no matching results.
- Keep accessible result feedback concise.
- Avoid resetting focus or the input after each update.

Use eligibility from actual capabilities. Do not allow a role dropdown to grant access or reveal restricted recovery/work instructions. Any administrative preview must follow existing permissions and clearly remain a preview.

## 7. Article and written-guide design

Use a readable task page:
- Back to learning/results.
- Task title and one short outcome.
- Necessary prerequisites.
- Numbered steps with clear verbs.
- Expected result.
- Troubleshooting disclosure.
- Appropriate Start walkthrough / Try practice / Open page actions.
- Reviewed date/version/source at secondary prominence.

Replace technical-sounding headings with user-oriented titles where possible:
- “Handle a Customer Care request” rather than “Triage a scoped Customer Care case”.
- “Understand your work access” rather than unexplained permission jargon.

Keep the precise source/version/eligibility metadata behind the presentation. Do not weaken the actual access instructions.

Use screenshots/illustrations only when maintainable and safe. Prefer clearly identified fixture content and accessible captions. Do not copy private production records into documentation.

Keep prerequisites important at decision time; move repetitive background explanation out of the main step sequence.

Remove the redundant link back to the current Help & Learn page from inside that same hub. Make Back to results and Open full page purposeful.

## 8. Friendly assistant visual design

Create a small, lightweight branded robot/guide:
- Rounded, friendly silhouette.
- White/charcoal surfaces with restrained Allied red details.
- Expressive but calm eyes or face.
- Professional styling suited to an automotive business.
- Legible text alongside the icon where space allows.

Prefer a repo-native SVG/CSS asset or the existing icon/illustration system where suitable. Do not introduce a heavy animation dependency for a tiny mascot.

Subtle animation may acknowledge opening, a helpful hint or practice completion. Respect reduced motion. Avoid constant bouncing, attention-grabbing movement, sound or unsolicited speech.

Provide states such as idle, answering/searching, helpful result, unavailable and practice success, but do not simulate activity that is not occurring.

The assistant must remain understandable if animation or decorative artwork fails.

## 9. Assistant interaction and placement

Opening Allie should show a compact welcome, relevant prompt suggestions and a useful input.

Suggested starting actions:
- “Explain this page”.
- “Show me the steps”.
- “Let me practise”.
- “Find a help topic”.
- “Contact the team”.

Respond with a short answer and appropriate next actions, for example:
- Read the article.
- Start a guide.
- Open safe practice.
- Open the relevant permitted page.

Do not copy the entire learning hub into the first assistant screen.

Desktop: use an appropriately sized side panel/popover that allows customers to understand the page context. Mobile: use a deliberate sheet/full-screen panel with a reachable close action.

Distinguish:
- An assistant panel that may be modal while reading/asking.
- A live walkthrough where the highlighted page controls MUST remain usable.

Never leave a guide target inert behind a modal focus trap. Use correct modal/non-modal semantics and focus management.

Coordinate with WhatsApp and existing support controls:
- One coherent assistance area.
- No overlapping launchers.
- No obstruction of forms, sticky actions, cookie banners or mobile safe areas.
- Do not show two floating Allie controls on /learn.
- Hide/minimise for the session and restore through Help navigation.
- Opening/closing must preserve the user's form draft and page position.
- Do not auto-open on every page load or repeatedly re-prompt after dismissal.

Include an easy Open full Help & Learn link from the assistant. Escalation opens an existing support route/draft or the reviewed handoff described in sections 31–34; it never sends a message automatically.

## 10. Real conversational AI with a dependable fallback

Integrate an actual language-model provider behind the application backend, grounded in the existing eligible reviewed help corpus. A keyword-only or canned-response helper is no longer sufficient to mark Allie complete.

Allie must understand paraphrases, answer follow-up questions, simplify explanations, clarify ambiguity and connect answers to validated articles, walkthroughs and isolated practice. Sections 25–36 define the architecture, security controls and human handoff.

Retain deterministic reviewed search, written steps and contact options when the provider is absent, unavailable or over budget. Missing credentials must not be replaced with fake intelligence or fabricated responses; finish independent implementation and identify the exact deployment prerequisite.

Keep answers grounded, eligibility enforced on the server and credentials server-side. Do not transmit live customer records, raw DOM, secrets or private dashboard data to the model. Do not create paid accounts, make purchases or invent API credentials.

## 11. Role and context behaviour

Reuse current server-validated account responsibilities and capabilities.

- Guests can access genuine public help and appropriate public practice.
- Customers see their relevant account/task learning.
- Staff see instructions for permitted responsibilities and scope.
- Admin/Super Admin see applicable management guidance without bypassing additional permissions.
- Operations vacancy coverage follows actual granted responsibilities.

The hub can say “For your work account” without a long operational restriction banner dominating the page. Keep real feature limitations visible next to the task they affect.

Use allowlisted route patterns and content IDs for context. A page pattern such as a customer-care detail route can identify the task without collecting its actual record ID or conversation.

On /learn, use honest Recommended labels. “Relevant to this page” should reflect genuine current-task matching, not a generic default applied to unrelated articles.

On account/role/branch changes, recompute eligibility and clear private transient context. Do not leak prior-user chat/history or leave a restricted guide available after access changes.

The assistant never asks for passwords, OTPs, recovery codes, API keys or payment credentials. On sensitive sign-in/recovery screens, retain the established secure flow and simple approved help; do not insert a chat capture step.

## 12. Repair and polish live walkthroughs

First reproduce H10 using the exact observed search sequence.

Inspect whether:
- Route/query updates reset guide progress.
- Step completion depends on stale DOM nodes or selectors.
- Loading states briefly satisfy a condition that settled state removes.
- Required interaction/target visibility is unclear.
- Target remounts erase completion evidence.

Use stable learning target IDs/hooks rather than brittle display-text or layout selectors.

Required behaviour:
- User chooses to start.
- The next required action is explicit.
- Disabled Next explains the unmet condition.
- Same-page search/filter updates do not unexpectedly restart the guide.
- Completed learning interaction is tracked correctly across appropriate component remounts.
- Missing/unavailable controls produce an explanation and written-step fallback.
- Do not silently skip a step and call the business task complete.
- Provide Back where useful, Next, Pause/Resume, Exit and compact secondary controls.
- Avoid five equally prominent buttons in a small panel.
- Highlight the actual target without obscuring it.
- Keep tooltip/panel placement within the viewport and away from critical actions.
- Do not repeatedly scroll/focus when the user is reading elsewhere.
- Do not click, submit or approve on the user's behalf.
- Never inject dummy values into real customer/admin forms.
- End with a learning summary, not a claim that an order, review or request was completed.

Verify the existing parts guide first. Deliver the dashboard guide catalogue in tested batches, beginning with customer-care follow-up, scoped staff care handling and product-image management after inspecting each current workflow and eligibility. Continue through the coverage requirements in sections 17–24. Do not invent guide steps for unavailable capabilities.

## 13. Practice should be realistic and clearly fictional

Preserve the existing isolated practice foundation and improve its teaching value.

Replace repeated yellow warning panels with:
- One persistent “Practice • Sample data” mode indicator.
- One short explanation of what is simulated.
- A clear Exit/Reset action.
- Additional warning only at a meaningful transition to live work.

Use a suitable task simulation, not only a generic choice box for every workflow:
- Fictional customer-care conversation and local reply draft.
- Sample compatibility evidence with compatible/incompatible/unknown distinctions.
- A simulated media-selection/order review using bundled fixture assets.
- Safe access/recovery decision practice restricted appropriately.

Use existing supported scenarios first; add the dashboard scenarios defined in the coverage matrix in bounded, tested batches. Every page needs relevant help; not every simple page needs its own elaborate simulation.

“Fill sample data” must populate meaningful editable simulation fields. For a choice-only exercise, use an honest Hint or Show an example action instead of claiming to insert data that does not affect the exercise.

Give specific feedback:
- What the learner chose/did.
- Why it is appropriate or risky in this fictional scenario.
- What information is missing.
- A next attempt or relevant article.

Do not equate one click with real operational competence, permission, certification or verified fitment.

Technical isolation:
- Use an explicit in-memory/fixture adapter.
- Do not pass live mutation callbacks to practice forms.
- Do not create real customer/product/media/finance records.
- Do not send email/SMS, upload real files or invoke live approvals.
- Fixture IDs must not be accepted as live entity references.
- Preserve the current promise about local inputs clearing when leaving, or change behaviour transparently with an approved policy.
- Never copy practice drafts into real submissions silently.
- Opening live work requires a deliberate transition and normal authentication/permissions.

Test isolation, including network assertions for business mutations, not just the practice banner.

## 14. Content maintenance and progress

Maintain a shared typed registry/model for:
- Content ID, title, summary and kind.
- Audience/required capabilities.
- Relevant route patterns.
- Steps/prerequisites.
- Safe practice references.
- Source, review date/version and supported outcome.
- Actual availability.

Keep conditional instructions aligned with current controls and release flags. Do not teach disabled checkout or describe an enquiry as a confirmed booking.

Track progress only where useful:
- Resume a guide or remember completed learning.
- Separate learning completion from business state.
- Scope any stored progress to the correct identity/content version.
- Persist only necessary nonsensitive progress, not secret inputs or complete private conversations.
- Preserve existing privacy/retention conventions.

No new surveillance, session replay or mandatory training system is required. If helpfulness feedback is added, keep it optional and avoid capturing free-text private data by default.

## 15. Accessibility, visual quality and performance

- Readable headings and body hierarchy.
- Consistent spacing, cards, badges and button priorities.
- Understandable short labels instead of internal terminology.
- Keyboard-operable tabs, chips, assistant controls and practices.
- Correct dialog focus/Escape/return behaviour.
- No false aria-modal on an interactive non-modal guide.
- Useful status announcements without narrating every streamed token/update.
- Colour plus text/icon meaning and measured contrast.
- Reduced motion and zoom/reflow support.
- Touch targets and mobile keyboard handling.
- No widget collision or page overflow.
- Lazy-load heavier learning/assistant content where appropriate.
- Avoid duplicating the whole help tree in DOM/network responses unnecessarily.
- Preserve search/corpus caching and authorisation semantics.
- Loading/error/empty/offline states are clear and truthful.

Validate at 360, 390, 768, 1024 and 1440px. Do not claim complete accessibility or role coverage without actual evidence.

## 16. Acceptance, sequence and deliverables

| Case | Required result |
| --- | --- |
| Help entry | Designed card, clear actions and correct navigation replace the bare sentence-link |
| Hub hierarchy | Articles, guides and practice are discoverable near the top |
| Search | Eligible content kinds searchable; query/result/back state coherent |
| Articles | Readable numbered steps, prerequisites, outcome and clear return navigation |
| Assistant | Friendly branded asset plus useful short answers/actions; no full-hub clone |
| Context | Appropriate task suggestions without reading private records |
| Unknown answer | Honest clarification/fallback rather than invented facts |
| Role changes | Restricted content/history does not remain accessible incorrectly |
| Guide regression | Oil-filter search sequence preserves correct Next progression after results settle |
| Unavailable target | Clear reason and fallback; no false completion |
| Guide control | Exit/pause/resume works without submitting real work or losing form drafts |
| Practice UI | One clear mode signal; meaningful sample/hint actions and specific feedback |
| Practice isolation | No real mutations, messages, approvals, payments or uploads |
| Live transition | Deliberate exit and normal permission checks; no silent dummy-data transfer |
| Widget/modal | Correct focus, Escape, placement, touch and reduced-motion behaviour |
| Provider failure | Reviewed learning and human contact still work; secrets/context remain protected |
| Regression | FAQs, existing deep links, support routes and unrelated dashboard work remain correct |

Work in bounded batches:
1. Map/reproduce current behaviour and shared content/eligibility.
2. Redesign the Help entry and Learn hierarchy/article presentation.
3. Repair live guide progression and simplify control placement.
4. Improve existing practice feedback and isolation.
5. Implement Allie's branded launcher and useful grounded baseline interaction.
6. Integrate the required grounded conversational AI and secure human-handoff path; retain reviewed search during provider outages or missing deployment configuration.
7. Run relevant build/type/lint/unit/API/browser checks, inspect mobile/desktop and fix regressions.

Deliver:
- Working implementation and changed files/contracts.
- Safe fixture screenshots of Help entry, Learn hub, assistant, walkthrough and practice.
- Reproduction/regression evidence for guide progression.
- Roles/modes/devices actually tested.
- Isolation/privacy/accessibility checks.
- Real assistant capabilities, human-handoff mode and any provider/configuration limitations.
- Remaining issues and deferred optional features.

Research references supporting interaction principles:
- [Microsoft Research human-AI interaction guidelines](https://www.microsoft.com/en-us/research/?p=564561): set clear expectations, use relevant context and keep assistance easy to invoke, dismiss and correct.
- [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): use correct focus, keyboard and modal behaviour.

These references inform the interaction design. The proposed layouts, mascot and implementation scope above are specific recommendations for Allied AutoTech.


## 17. Expanded mission: every dashboard, every authorised responsibility

Extend the same coherent Help & Learn system to the entire authenticated website. Do not stop after installing a launcher in the common layout.

Include Customer, Staff, Admin and Super Admin dashboards and each actual workforce responsibility supported by the repository, including Operations Supervisor, Customer Service Officer, Sales, Accountant, Workshop Lead and technicians where present. Discover additional roles/responsibilities from the source of truth. These names describe the intended coverage, not new permissions to create.

For each actual dashboard route and meaningful workflow state, users should be able to determine:
1. What this page is for.
2. What the displayed statuses and important terms mean.
3. What they can do next with their current access.
4. What information they need before acting.
5. What an action will change and how to confirm its result.
6. What to do if blocked or an operation fails.
7. How to practise when the workflow warrants a simulation.
8. Where to get human help.

A missing learning topic must never be disguised by a generic welcome message. Give a truthful general fallback and record the coverage gap.

The new dashboard coverage below is an implementation requirement, not a claim that every dashboard was inspected during the original live audit. Inspect the current repository and rendered pages before writing precise instructions.

## 18. Route inventory and coverage contract

Before implementation, produce a route-to-learning matrix in the repository. Discover routes from navigation, route definitions, nested pages, guards and feature flags; navigation links alone will miss detail pages, drawers and hidden-but-authorised routes.

Record for each route pattern:
- Dashboard/module and task.
- Intended audience and actual capability/scope predicates.
- Page purpose and concise contextual answer.
- Linked article, walkthrough and practice IDs.
- Relevant status definitions and safe recovery instructions.
- Live availability/release restrictions.
- Coverage decision: explanation only, article, walkthrough, simulation or a documented combination.
- Fixture/account required for verification.
- Verification result and remaining gaps.

Use route patterns rather than storing real customer, enquiry, product, employee or transaction IDs. Model relevant subviews, such as a product Images tab versus Compatibility tab, when their instructions differ.

A read-only overview may need explanation and useful navigation rather than a simulation. A multi-step, consequential task needs stronger guidance and usually a safe example. Mark not-applicable modes with a reason instead of adding meaningless exercises.

Every eligible route must resolve to a useful contextual response or an explicit honest fallback. Every high-priority supported workflow must have maintained instructions and an appropriate guide or practice decision.

Add a coverage check that detects unmapped new dashboard routes or broken content references. Use the repository's route conventions; do not invent a second competing route list if a maintained manifest already exists.

## 19. Minimum role and module coverage

Use this table to organise discovery. Include each listed workflow only where currently implemented and authorised; document absent or deferred features rather than creating business functionality solely to teach it.

| Audience/module | Required assistance topics | Useful walkthrough/practice |
| --- | --- | --- |
| Customer overview | Understand the dashboard; find relevant next actions and support | Find and follow an existing enquiry |
| Customer profile and vehicles | Update supported personal details; manage saved vehicles; understand visibility | Edit a fictional profile or sample vehicle in practice |
| Customer saved items and enquiries | Find saved products/vehicles; distinguish enquiry, quotation and confirmed transaction | Start a supported enquiry with the required context |
| Customer Care list and detail | Search/filter cases; interpret status; public replies versus internal notes; attachments; next action | Scoped case handling with fictional conversation and audience review |
| Customers directory and detail | Find a customer; copy permitted contact data; inspect account state | Fictional account-state decision and confirmation, with role restrictions |
| Notifications in every dashboard | Unread/read; available filters; preferences; browser permission states; open source record | Review a fictional notification and distinguish permission from delivery |
| Products and catalogue | Search; product families; required fields; status; authoring and publishing conditions | Prepare a sample product without creating a live record |
| Product images/media | Upload versus hosted URL; preview; description; primary image; ordering; validation | Use bundled sample assets to review a gallery |
| Fitment/compatibility | Make/model/year; unknown versus unrestricted; evidence; draft/review/approval; independence | Review fictional evidence without asserting real compatibility |
| Vehicle listings and sourcing | Listing state; required details; supported enquiry routing | Draft a sample listing or sourcing requirement in an isolated simulator |
| Sales responsibilities | Available enquiries, quotations and follow-ups; customer-facing commitments | Prepare a fictional response without promising unavailable services |
| Operations supervision | Permitted queues, assignment, branch/scope limits and escalation | Prioritise fictional work; explain authorised vacancy coverage |
| Workshop lead | Supported work queues, assignments, evidence and status transitions | Review a fictional job and next action |
| Technicians | Assigned work, supported updates, notes and evidence | Update a fictional task without changing actual workshop state |
| Finance/accounting | Meaning of actual financial states, available reporting and permitted actions | Explain fictional figures/statuses; no live payments or bank changes |
| Admin | Permitted people, catalogue, operations and configuration tasks | Explain consequences and confirmation before sensitive actions |
| Super Admin | Additional permitted controls, approval separation, access and recovery policy | Approved decision scenarios using entirely fictional identities |
| Account/security across roles | Sessions, MFA, account restrictions and approved recovery options | Decision guidance; never simulate collecting real secrets |
| Reports/audit/history where present | Read filters, timestamps, actor/action meaning and export scope | Interpret a small fictional history/report |

Keep cross-role topics shared where instructions are identical. Attach role-specific differences to the canonical topic rather than duplicating text into drifting copies.

Do not explain an unsupported “My orders” destination as though orders are enabled. Reconcile any navigation/instruction mismatch with actual current behaviour. Collection-only restrictions, disabled checkout and deferred paid vehicle reservations remain accurate wherever relevant.

## 20. Dashboard assistance layout and task flow

Integrate help into the dashboard shell consistently:
- A discoverable Help & Learn navigation entry.
- A compact Ask Allie entry near the page header or a coordinated floating launcher.
- An explicit Help with this page action on complicated pages.
- Relevant inline help beside genuinely ambiguous controls.
- Clear access to the full learning hub without losing the current task.

Use the page title and a short purpose statement to orient users. Keep lengthy training content out of routine task layouts. On dense operational pages, use concise contextual explanation and expandable detail.

Desktop assistance should be a compact side panel or deliberately sized popover. If the panel occupies layout space, ensure tables, grids and forms remain usable. If it overlays, keep essential controls reachable or provide an obvious collapse action. Avoid competing scroll areas and stale sticky offsets.

For mobile, use an accessible sheet or full-screen assistance view with reachable close/back controls and keyboard-aware input. Closing help should return to the same work and position.

Coordinate Allie with existing notifications, WhatsApp, sticky reply composers, save bars, toasts and cookie controls. One shared launcher in the appropriate shell; no duplicate instance from nested layouts. Hide/collapse where necessary rather than covering an irreversible action.

Provide concise suggested questions that change with the actual page:
- Customer Care: “Who can see this reply?”, “What does this status mean?”
- Products: “What do I need before publishing?”
- Fitment: “Does an empty year mean unrestricted?”, answered from real policy.
- Notifications: “Why am I not receiving browser alerts?”
- Customers: “What happens when an account is suspended?”, only for an eligible operator.
- Finance: “What does this financial status mean?”, grounded in current definitions.

Do not repeat the same generic suggestions everywhere. Contextual relevance should come from maintained task metadata, not guesses from the visual page title.

Use semantic state colours consistently with the existing design system. Include labels/icons; do not imply that a warning colour establishes a business outcome or permission. Give primary, secondary and destructive actions distinct treatment without making every hint a coloured banner.

## 21. Allie's behaviour inside dashboards

Allie is an assistant for understanding and navigation. It must not become an unauthorised operator.

Baseline page context may include only an allowlisted route pattern, active learning topic, supported UI mode and current capability/availability metadata required for assistance. Do not send raw record IDs, query strings, private search terms, selected rows, user-entered form values or case contents to an external model.

It may:
- Explain a page, field, status or documented workflow.
- Clarify ambiguous questions with a small set of choices.
- Link to a permitted page or maintained source.
- Start an optional walkthrough.
- Open isolated practice and fill its sample fields.
- Help identify missing prerequisites using approved general rules.
- Offer human support through an existing authorised path.

It must not:
- Send public replies or internal notes.
- Suspend/reactivate accounts.
- Change permissions or assignments.
- Approve fitment or publish listings.
- Submit payments, refunds or financial adjustments.
- Upload files or alter real records.
- Claim a task succeeded without the business system confirming it.
- Suggest overriding a safety, approval or evidence requirement.
- Read a live case merely because its page is open.

If live-record assistance is proposed in future, treat it as a separately scoped feature with explicit data boundaries, server-authorised retrieval and retention rules. Do not silently introduce it during this rollout.

The assistant must explain unavailable or unauthorised tasks truthfully. It can suggest requesting the appropriate access through the established process; it cannot grant access. Never infer a new privilege from a job title.

On pages involving account suspension, finance, security recovery, public replies or approval, explain the consequences before directing the user to the real workflow. Normal confirmations and independent review remain mandatory.

If a provider fails, times out or returns an unsupported answer, keep reviewed articles, navigation, walkthroughs and practice usable. Do not turn model availability into a dependency for performing ordinary dashboard work.

## 22. Walkthroughs and realistic safe practice by dashboard

Reuse one shared walkthrough engine and one practice architecture. Do not create separate assistant applications for each role.

Walkthrough requirements:
- Resolve steps against actual capability, scope and feature availability.
- Handle empty lists, loading, errors, pagination, filtering, drawers and nested detail routes.
- Preserve appropriate progress across query changes and rerenders.
- Explain when no eligible record exists and offer fictional practice.
- Never require opening an unrelated customer's record to finish training.
- Never automatically click a consequential business action.
- Finish before a live mutation when observation is enough; actual submission remains the user's deliberate choice.
- Do not call a navigation-only walkthrough an accomplished business transaction.
- Provide the equivalent written steps.

Practice requirements:
- Use role-appropriate fictional scenarios and local adapters.
- Include realistic forms, rows, statuses, errors and feedback where pedagogically useful.
- Make Fill sample data visibly populate meaningful editable simulation fields.
- Do not offer “Fill sample data” on production forms.
- Make scenario reset and exit predictable.
- Keep practice visually recognisable with one persistent mode indicator.
- Separate hypothetical outcomes from live system status.
- Give feedback for wrong choices and incomplete evidence, not only the correct path.
- Never attach real storage, messaging, mutation or payment callbacks.

An advanced simulation must not leak restricted process details to an ineligible role. An Admin preview cannot impersonate a real customer or change the current session's permissions.

Learning completion, a quiz answer or practice success never grants capability, signs an approval or certifies technical competence. Keep business audit events separate from optional learning progress.

## 23. Permission, lifecycle and content integrity

Use the existing server-side authorisation model for restricted articles, guides, assistant retrieval and practice configuration. Client-side hiding alone is insufficient.

Verify:
- Direct restricted article/guide/practice URLs.
- Search suggestions, result counts, snippets and answer sources.
- API/content responses and any restricted bundles.
- Multi-role accounts and users with a subset of responsibilities.
- Branch/scope boundaries.
- Permission revocation while the assistant is open.
- Logout/login, account switching and shared-browser use.
- Stale cached answers, background requests and persisted progress.

Do not cache user-specific restricted results under a public/shared key. Cancel stale requests and clear sensitive transient state when identity or access changes. Reauthorise content before resuming a saved guide.

Never hide the normal page or require mandatory onboarding to use it. Let returning users skip, dismiss and reopen assistance. Save only minimal useful progress scoped to the correct user and content version.

Keep guidance coupled to current UI contracts:
- Stable learning target identifiers.
- Verified route destinations.
- Maintained field/status definitions.
- Capability predicates.
- Content version and review ownership.
- Feature availability.

Add targeted checks for broken deep links, orphaned content and missing guide targets. When an action changes, update its instructions in the same change. Do not give a stale article a fresh reviewed date without actually checking it.

Optional helpfulness feedback should not automatically capture record contents, complete private chats or customer identifiers. Use existing privacy and retention conventions.

## 24. Dashboard rollout, verification and definition of done

Complete the expanded scope in bounded batches without abandoning the remaining dashboards:
1. Audit shared shell, routes, permissions and existing learning content; verify the workforce-access foundation in sections 37–44 and publish the coverage matrix.
2. Implement the shared assistance design and repair the known guide/progression defects.
3. Deliver customer account tasks and Customer Care guidance.
4. Deliver product, images, fitment and vehicle authoring/review guidance.
5. Deliver Operations, Sales, Workshop and technician guidance for actual supported workflows.
6. Deliver finance, Admin, Super Admin and account/security guidance.
7. Close coverage gaps, test role transitions and verify responsive/accessibility behaviour.

Adapt this order to repository dependencies, but report coverage honestly. A tested initial batch is progress; it is not completion of the all-dashboard requirement.

For each responsibility, use seeded/test fixtures or legitimately available test access. Do not run real customer messaging, suspensions, financial mutations or approvals just to demonstrate the guide. Where an account or fixture is unavailable, finish independent work and identify precisely which verification remains blocked.

Minimum acceptance checks:
- Every discovered dashboard route has a recorded coverage decision.
- Every eligible page exposes working Help & Learn.
- Contextual answers describe the correct page and current supported actions.
- A Customer cannot retrieve staff-only guidance through search, deep links or assistant calls.
- Staff capabilities and branch scope are enforced; Admin/Super Admin labels alone do not bypass policy.
- Revoked permissions and account changes invalidate relevant assistant context and progress.
- Walkthroughs work with realistic route/query changes and have written fallbacks.
- Practice traffic contains no production business mutations.
- Opening, closing and moving between help modes preserves the current real draft.
- Desktop and mobile assistance does not hide essential controls.
- Keyboard, focus return, screen-reader status and reduced motion behave correctly.
- Restricted, empty, loading, error, provider-unavailable and no-content states remain understandable.
- The original Help entry, Learn hub, FAQs and existing links still work.

Run meaningful relevant unit, integration and browser checks plus required build/type/lint checks. Use negative permission cases and network assertions, not only screenshots of the happy path. Broad shared-shell changes warrant smoke coverage across all affected dashboard layouts.

Deliver:
- Updated implementation and content registry.
- The completed route/role/module coverage matrix.
- Maintained article, guide and practice IDs with their real eligibility.
- Test evidence identifying roles, routes, states and viewports actually exercised.
- Safe fixture screenshots of representative dashboard assistance layouts.
- A concise explanation of any behaviour/configuration change.
- Explicit remaining gaps or unavailable fixtures; no unsupported claim of full coverage.

Completion means the shared learning experience is integrated, useful and verified across the supported dashboard estate. A cute launcher on every page is only one small part of that result.


## 25. Required AI outcome and implementation authority

Act as the senior full-stack engineer, AI application engineer and product designer for Allied AutoTech. Implement this brief in the existing repository; do not stop at a plan, a mock chat window, canned answers or an architecture document.

Allie should feel like a small, approachable assistant that understands the user's question, maintains the relevant thread and offers an understandable next step. Preserve the friendly lightweight mascot and restrained visual design.

This scope includes the necessary frontend, backend, content, schema/migration, support integration, tests and operational documentation. Reuse current foundations and inspect repository instructions before changing code.

Availability means:
- Public Home, Services, Shop/Parts, Vehicles, About, Contact, Help and Learn.
- Customer, Staff, Admin and Super Admin dashboard layouts.
- All supported workforce responsibilities and nested/detail pages from the inventory.
- Loading, empty, error and access-restricted states where assistance is appropriate.
- Secure authentication/recovery screens through approved static/contextual help, with conversational capture suppressed when it risks collecting credentials.

Do not literally inject a widget into exports, print views, file responses, embedded payment/security challenges or API pages. Document intentional exclusions. “Available everywhere” means accessible useful assistance throughout the normal website, with safe treatment of sensitive surfaces.

An AI model is required for the conversational experience. Keep the provider/model configurable. Select an available supported model through current official documentation and benchmark it against Allied-specific evaluations; do not hardcode a guessed latest model or claim one is cheapest without measuring.

OpenAI Responses API is a suitable implementation option. Use the current supported SDK/API and server-side credentials if chosen. Keep a small provider adapter rather than a large speculative multi-provider framework.

Do not fine-tune first. Establish content quality, retrieval, conversation behaviour and evaluation failures before considering training. Do not use arbitrary chat messages to update weights or permanent company knowledge.

Required deliverables include a working implementation, route coverage matrix, threat/data-flow notes, tested deployment configuration, safe fixtures and an honest report of remaining prerequisites.

## 26. Conversation intelligence and answer standards

Support:
- Different wording, natural language and common misspellings.
- Follow-ups such as “Where is it?”, “Explain step two” and “Can I try it?”
- Short versus expanded explanations on request.
- Task comparison and simple definitions.
- Multiple questions in one turn without silently ignoring a consequential part.
- Clarification when multiple supported tasks could fit.
- An honest response when evidence is absent, stale, contradictory or outside scope.

Default answer structure:
1. Direct answer in a few sentences.
2. Numbered steps only when a sequence is useful.
3. A short caveat when the source establishes a restriction.
4. One to three relevant validated actions.
5. Compact source references.

Do not recite policy banners before every answer. Be warm and clear, never patronising. Do not overuse the mascot, emojis or cheerfulness in complaints, security or payment-related discussions.

Use examples from fictional data, clearly labelled. Distinguish general automotive explanation from a verified fitment conclusion. Never infer suitability from make/model alone or promise that a vehicle is safe to drive.

Do not claim to have looked at a user's record, sent a reply, completed an order, confirmed a booking, approved compatibility or changed an account unless a corresponding authorised system operation actually established that result. The initial assistant has no such operational tools.

A clarification must reduce uncertainty. Prefer one concise question with meaningful options to a long interrogation. Do not ask for information already safely available from the permitted page/task context.

Keep chat bounded to Allied help, supported tasks and relevant general explanations. Redirect unrelated requests politely. Avoid brittle keyword refusals that reject genuine site questions.

Conversation examples and expected behaviours must be included in the test fixtures. The exact answer wording may vary; the underlying facts, restrictions, sources and permitted next actions must remain correct.

## 27. Knowledge, retrieval and version integrity

Reuse the reviewed Help & Learn registry as the canonical corpus. Extend its schema where needed:
- Stable content and chunk IDs.
- Title, summary, body and task aliases.
- Audience, capability and scope predicates.
- Supported route patterns/subviews.
- Publication/review status and version.
- Effective/retired status where applicable.
- Source links, guide/practice IDs and feature availability.
- Review ownership.

Do not ingest database dumps, customer cases, emails, employee messages, private production screenshots, secrets, raw repository files or unreviewed uploads into the help index.

Use keyword retrieval plus semantic retrieval where evaluation demonstrates value. Start with a bounded eligible corpus; a small registry does not justify several infrastructure services. Verify extension/provider availability before choosing a vector implementation.

The server must apply access and availability rules before selecting context for the model. Preserve eligibility metadata in any index and recheck returned content against the current source of truth. Index attributes alone are not a complete authorisation system.

Prevent stale publication/access metadata from exposing revoked topics. Content removal or restriction changes must invalidate relevant retrieval caches and generated-answer reuse.

Retrieve a small bounded set of relevant passages. Exact identifiers and maintained UI labels should remain searchable. Reformulate follow-up questions using permitted recent context without changing their intent.

For unsupported or contradictory evidence:
- Ask a clarification, show relevant source choices or state the limitation.
- Prefer current published content over retired versions using explicit metadata.
- Do not resolve conflicting business policies by guessing.
- Offer human help when appropriate.

Source links must refer to actual eligible retrieved content. Validate cited IDs and anchor destinations. A real citation does not automatically prove every sentence is correct; test factual support separately.

Use content version/source-set identifiers in diagnostics and cache invalidation. Do not display invented review dates, source titles or confidence percentages.

## 28. Server request pipeline, contracts and controlled tools

Adapt names to existing API conventions. Proposed responsibilities are:
- Create/resume a bounded assistant session.
- Submit a user turn and receive an answer.
- Retrieve eligible help content.
- Resolve registered guide/practice/navigation actions.
- Prepare a handoff draft.
- Commit a human-support request after explicit review/submission.
- Retrieve support availability and permitted conversation updates.

For each turn:
1. Validate payload size and schema.
2. Resolve authenticated identity or a bounded public anonymous session.
3. Derive current capabilities, scope and permitted context on the server.
4. Apply quotas and abuse controls.
5. Retrieve eligible current sources.
6. Assemble trusted instructions separately from untrusted user/retrieved text.
7. Call the provider with bounded context and tool budget.
8. Validate structured results, sources and action IDs.
9. Deliver the safe answer, with truthful incomplete/failure handling.
10. Record minimal operational metrics without full sensitive transcripts.

Suggested structured response fields:
- Answer text.
- Retrieved source IDs.
- Registered action IDs and allowed parameters.
- Clarification options, if needed.
- Answer status such as answered, clarification_needed or unavailable.

Use Zod/runtime validation alongside provider structured-output support. Schema compliance is not authorisation or factual verification.

Initial model tools may retrieve help or resolve learning resources. Navigation, highlighting and practice must use registered identifiers. Do not give the model arbitrary URLs, CSS selectors, JavaScript, SQL, shell, filesystem, browser automation, general HTTP fetching or generic mutation tools.

Validate action eligibility at render time and again at execution. A customer-supplied role, branch ID, content ID or conversation ID is not authoritative. Reject forged tool calls and unknown fields.

Human-support submission is a separate deterministic application operation. The model may propose a draft but cannot invoke sending on its own. Require the user's explicit Send/Request action, normal server validation and idempotency. This is the limited handoff exception to the no-business-mutations rule; it does not allow AI-generated public replies to customers.

Keep provider calls and business database transactions separate. Do not hold a transaction open while waiting for a model.

Use finite limits for input length, history, retrieved tokens, output tokens, model/tool calls, execution duration, concurrent turns and retries. Set documented configurable defaults; avoid unlimited retries or recursive tool loops.

## 29. Security and privacy boundaries

Create a small threat model covering anonymous abuse, account crossing, restricted-source leakage, prompt injection, forged actions, transcript exposure, XSS, CSRF, replay and resource exhaustion.

Mandatory controls:
- Secrets only in server-managed configuration; never NEXT_PUBLIC variables, browser bundles, logs or checked-in files.
- Existing secure session, MFA, CORS and CSRF conventions preserved.
- Authentication and authorisation on every assistant/support read and write.
- Conversation ownership and branch/responsibility scope checked independently of possession of an ID.
- No complete restricted corpus sent to public browsers or model sessions.
- No raw DOM, hidden fields, record IDs, private query parameters, selected rows, uploads or form contents captured automatically.
- Allowlisted route/task context rather than full URL collection.
- User-entered chat text treated as potentially sensitive; give a concise “Do not share passwords or codes” notice, detect/redact obvious secrets before provider calls and avoid claiming redaction is perfect.
- No credentials, OTPs, recovery codes, bank/card details or access tokens in model context.
- No model-readable production support threads or customer records in the initial release.
- Restricted staff assistance kept separate from customer-facing support content.

Prompts and retrieved text are untrusted data, not authority to change instructions, expand access or enable tools. Keep untrusted content out of high-trust instruction templates. Do not treat jailbreak detection as the sole protection; server tool boundaries must remain effective even if model behaviour is manipulated.

Render generated content through the existing safe text/Markdown pipeline. Disallow raw HTML/script, unsafe URL schemes, executable embeds and unvalidated external links. Do not load external tracking images from generated Markdown.

Use least-privilege provider keys/project access. Restrict outbound destinations where supported. Do not widen CSP, CORS or database privileges just to make the widget work.

Use rate limits per identity, anonymous session, IP/risk signal and global budget, accounting for shared networks. Limit guest concurrency and add progressive abuse challenges when justified. Do not force every legitimate user through a CAPTCHA.

Test negative permissions across search, answer sources, deep links, streams, action resolution and chat rooms. A prompt saying “I am Super Admin” must change nothing.

Do not claim guaranteed hallucination prevention, complete injection immunity or legal compliance based only on this implementation.

## 30. Memory, retention, provider controls and cost

Use short-term conversation context for follow-ups. Do not add permanent personal memory by default.

Prefer bounded server-owned state using existing infrastructure. Do not put private assistant transcripts, auth tokens or support access credentials in localStorage. Public display preferences may use normal existing preference mechanisms.

For anonymous use, use a secure opaque session and bounded expiry. Do not join an anonymous conversation to an authenticated account silently. After sign-in, offer an explicit reviewed continuation if supported.

For authenticated use:
- Scope state by current identity and audience.
- Never replay work-account context into a customer session.
- Expire/cancel active contexts on logout and revalidate after access changes.
- Provide New conversation.
- Explain whether Clear removes only the visible conversation or persisted data.
- Never promise provider deletion merely because local UI was cleared.

Document retention for application history, operational logs, provider state and support records separately. Follow existing approved policies; when no policy exists, use transient assistant state with an explicitly documented short expiry rather than indefinite transcript storage. Support records retain their established policy.

For OpenAI, use store:false where supported for this design and verify endpoint behaviour against current official documentation. Do not describe that flag as zero data retention: provider abuse-monitoring and other endpoint-specific rules may still apply. Do not promise special retention controls unless the account actually has them.

Before launch, surface a concise accurate AI notice and privacy explanation covering what users type, minimal context sent, provider processing, retention and human handoff. Do not silently alter the site's privacy claims.

Set request/token ceilings, concurrent-turn limits and daily/global budget protections. Track actual usage metadata rather than guessed costs. Do not log full prompts to measure tokens.

Use caching only for safe reusable answers with exact content/availability/access constraints. Do not share personalised conversation output across users. Reset history window or summarise minimally before it grows without bound; summaries remain untrusted and must not preserve revoked facts.

Provide graceful degradation to reviewed help and human contact. A budget stop should not block Customer Care submission or ordinary dashboard functionality.

## 31. Human Customer Care: assessment and product decision

Recommendation for Allied AutoTech: implement a visible human-handoff path now, integrated with existing Customer Care. Preserve the customer's Customer Care page and authorised staff/admin Customer Care workspace as described in section 38. Implement real-time delivery behind a feature flag and enable the “Live chat” promise only when operational prerequisites are met.

Rationale specific to the supplied project:
- Product fitment uncertainty, complaints, account issues and enquiry-specific questions may require a person.
- Allie cannot responsibly infer private case state or make business commitments.
- The supplied workforce plan previously placed Customer Care coverage with Operations while the CS role was vacant. Recheck current operational configuration; do not assume the vacancy or coverage is unchanged.
- An unattended live queue would add confusion instead of solving it.

Provide three distinct experiences:
1. Ask Allie: automated guidance.
2. Talk to Customer Care: verified human availability or a clear request-to-connect state.
3. Leave a message: reliable asynchronous support when nobody is available.

A person must be reachable without exhausting several bot attempts. Include an obvious human option and honour direct requests such as “I want a person.”

Keep the existing Customer Care enquiry/case as the canonical business record. Add a related conversation/channel model if necessary, but do not create an isolated second customer inbox or force agents to monitor several queues for the same issue.

Deliver a written operational readiness result:
- Existing support architecture and reuse opportunities.
- Actual authorised staffing/coverage configuration.
- Presence, assignment/capacity and coverage schedule support.
- Hosting/transport capabilities.
- Notification/fallback readiness.
- Whether live mode can be enabled truthfully now.
- Exact configuration gaps.

Implement the secure asynchronous handoff independently of live staffing readiness. Build/test the live transport and availability controls with fixtures when feasible. Keep live mode off if no reliable staffing/configuration exists; do not fake presence or stop all other implementation.

No paid support platform account or purchase is authorised by this brief. Compare external services only if existing architecture cannot reasonably meet requirements, and finish a concrete recommendation before requesting any external commitment.

## 32. Reviewable handoff and identity-safe support access

When the user requests a human:
1. Explain whether someone can join or a message will be queued.
2. Prepare an editable issue summary.
3. Let the user choose whether to include selected relevant assistant messages.
4. Show exactly what will be sent and the intended audience.
5. Collect only information required by the established support flow.
6. Submit only after an explicit user action.
7. Show a real server-generated reference and next step.

Do not attach the full chat automatically. Mark AI-generated summaries as such and retain user edits. Do not present a summary as a verbatim quote.

Do not forward restricted staff guidance to general customer support. Use an authorised internal-help route for workforce access/security questions if one exists. Otherwise provide approved escalation instructions without creating a public transcript.

Reuse an existing permitted case when explicitly selected or unambiguously linked through a server-authorised context. Do not guess matches from names/emails or merge unrelated cases. For an ambiguous existing draft/case, offer an explicit choice and preserve the user's current draft.

For customers, derive account identity from the session rather than asking the model to establish it.

For guests, use the existing secure contact workflow. If guest conversation access is added, establish a verified ownership channel or an equivalent secure access mechanism; an email address or case UUID alone is never proof of ownership. Do not expose prior cases because a visitor types the same email. If safe guest inbox access is unavailable, provide the normal contact form and follow-up method.

Use client operation IDs/server idempotency so retry, refresh, double-click or lost acknowledgement does not create duplicate cases/messages. Return existing outcomes only within the same authorised owner/scope and payload contract.

Show Pending, Saved/Sent, Failed and Retry accurately. Retain a failed draft. Do not clear it before persistence succeeds.

Do not equate message persistence, browser delivery, email acceptance, email delivery or human reading. Do not mark a reply as read simply because a socket or tab is open.

## 33. Human chat experience and staff workspace

Maintain clear sender labels:
- Allie · AI assistant.
- You.
- Customer Care representative.
- System status.

When a human accepts, show a clear joined event and stop Allie's automatic answers in that support thread. Let the user reopen separate AI help deliberately. Use server-side ownership state/versioning so delayed AI responses cannot arrive after takeover or after a cancellation.

Represent assistance state separately from support business status. Suggested help states include AI active, handoff requested, queued, human active and ended; map to existing enums instead of casually replacing case lifecycle states.

Online must mean configured eligible staff opted in, currently reachable with non-stale presence and available capacity during supported coverage. A logged-in Admin is not automatically a support agent. Operations vacancy coverage requires actual capabilities.

Presence is approximate. If a connection/agent disappears or capacity is exhausted, explain that the request is queued and retain the conversation. Do not invent an exact wait time or queue position without reliable data.

Support hours are a separate setting from workshop hours. Do not assume supplied workshop times are approved live-chat coverage. Use existing approved configuration and Africa/Lagos for the appropriate display.

In the existing staff Customer Care workspace, add:
- Incoming/queued conversations with age, assignment and honest channel state.
- Accept/claim, transfer/reassign, unavailable and end controls where authorised.
- Transactional assignment to avoid two agents claiming one session.
- Visible customer-public reply versus internal-note audience.
- Compact conversation first, contextual details alongside.
- Unread and new-message indicators without forcing the reader to the bottom.
- Draft preservation and a jump-to-latest control.
- Audit history for assignment, public messages and lifecycle changes.

Recheck permissions for every message and assignment, including after revocation. Internal notes must never be sent to customer streams, API responses or notification previews.

Do not send customer messages through the model after a human takes over. Optional AI reply drafting for staff is a separate opt-in feature with its own data review and deliberate review-before-send; it is not silently included here.

Avoid duplicating notifications/email for the same event. Reuse existing notification preferences and delivery semantics. No real external-message tests against customers.

## 34. Real-time transport, persistence and resilience

Choose the simplest transport supported by current deployment:
- Authenticated HTTP message submission plus SSE events or bounded polling may be sufficient.
- Use WebSockets when justified by the required bidirectional behaviour and infrastructure.
- Typing/presence features are optional and must not delay a reliable message flow.

For any transport:
- Database persistence is authoritative; connection state is not message delivery.
- Authorise subscriptions, replay/cursor requests and individual operations.
- Use stable event/message IDs, server ordering and deduplication.
- Handle reconnection, missed events, duplicate events and multi-tab access.
- Enforce session expiry, logout and permission revocation on long-lived connections.
- Do not put credentials or transcript text in URLs.
- Keep public and staff audiences separate at the source.
- Set payload/connection/concurrency limits, heartbeat expiry and backpressure.
- Render failures truthfully and offer fallback to the same persisted conversation.

If using WebSockets, validate exact allowed origins, authenticate the handshake/session, use WSS in production and authorise every room/action/message. A successful handshake is not permission to subscribe to arbitrary case IDs.

If using SSE, authenticate the stream, apply exact CORS/session rules, validate replay cursors against scope and close unauthorised subscriptions. For assistant streaming via fetch, preserve existing CSRF protection for the initiating POST.

Validate model action/source metadata before exposing interactive controls. For answer text, prefer buffering a bounded complete response for validation; if streaming partial text, show it as incomplete, keep rendering safe and handle interrupted/invalid output without treating it as a final answer.

Stop-generation must stop display and attempt to cancel backend/provider work. Do not promise cancellation eliminates already incurred usage.

Multi-instance deployment requires shared presence/event delivery or another explicit supported strategy; process-local maps alone cannot coordinate several replicas. Verify proxy timeouts, connection limits and graceful deploy reconnects. Do not claim live readiness from a single local process.

Persist messages before broadcasting. Use the repository's outbox/event conventions for notifications where present. Avoid claiming exactly-once network delivery; provide idempotent durable writes and deduplicated replay.

Keep initial chat text-only unless the existing support attachment path can be reused safely. If attachments are included, preserve validation, private access, size/type controls and scanning policy; do not send them to the model by default.

## 35. Tests, release gates and operational controls

Create an initial evaluation set of at least 100 reviewed cases across public help and the supported responsibilities. This is a project acceptance target, not an industry benchmark.

Include paraphrases, typos, multi-turn references, ambiguous questions, stale content, unknown answers, policy conflicts, unsupported business features, attempted privilege escalation, fake source IDs, unsafe URLs, malicious retrieved text, missing guide targets and requests for real dummy-data insertion.

Evaluate separately:
- Retrieval relevance and source eligibility.
- Factual support and instruction accuracy.
- Appropriate clarification/abstention.
- Action validity and role boundaries.
- Conversation continuity without identity crossing.
- Response latency, timeout handling and actual provider usage.
- Human handoff integrity.

Do not grade only exact phrasing or use the same model's self-rating as the sole evidence. Use expert-reviewed expected facts and critical restrictions. Require all critical negative authorisation, secret exposure, real-mutation isolation and internal-note leakage tests to pass. Report measured answer quality and failures instead of inventing a 100% intelligence claim.

Integration/browser tests must cover:
- Every route in the coverage matrix.
- Guest, customer, workforce capability subsets, Admin and Super Admin.
- Account switching and revocation during a response/stream.
- AI unavailable, quota exhausted and malformed provider output.
- Handoff review/cancel/send/retry and duplicate prevention.
- Offline/reconnect, expired session, interrupted streams and assignment races.
- Human takeover with an in-flight AI answer.
- No available staff, stale presence and after-hours fallback.
- Public replies versus internal notes across every delivery channel.
- Practice isolation with network assertions.
- 360/390/768/1024/1440px, keyboard, focus return and reduced motion.

Add operational controls:
- Separate enable flags for AI answers and live human mode.
- Provider/model configuration and bounded quotas.
- Availability/coverage configuration restricted appropriately.
- Ability to disable AI while retaining help and human contact.
- Minimal metrics: answer/source version, latency, usage, error category, handoff outcome and queue age.
- Redacted diagnostic IDs, not full sensitive message logs.
- Alerts for provider failures, backlog and abnormal usage.
- A short runbook for outages, quota exhaustion, staffing loss and suspected data exposure.

Use compatible forward migrations and safe indexes for new entities. Preserve existing support ownership/status contracts and old URLs. Do not rewrite deployed migrations or delete records to simplify the feature.

Implement and validate in isolated development/staging. Use fake provider responses for deterministic tests and bounded real-provider evaluations only with configured test credentials. Do not publish, change production billing or contact real customers as part of testing.

## 36. Implementation sequence, completion and source notes

Work through:
1. Discover current workforce roles/responsibilities, access policies, routes and learning/support architecture.
2. Implement and verify Manage Workforce & Responsibilities plus effective access, scope, dynamic sidebar and active-session revocation (sections 37–44).
3. Define assistant/support contracts, content boundaries, threat model and route coverage matrix using that verified access model.
4. Implement the shared redesigned shell, Help entry and Learn modes.
5. Build backend retrieval and provider adapter with runtime validation.
6. Add conversational memory, grounded answers, source/action rendering and quotas.
7. Connect registered walkthroughs and isolated practice; fix observed regressions.
8. Implement reviewed asynchronous human handoff into the preserved Customer Care pages.
9. Implement/test the gated live mode and responsibility-based staff assignment.
10. Verify all role/page coverage, failures, security boundaries and accessibility.
11. Deliver code, evidence, configuration prerequisites and rollout/runbook notes.

Continue independent work if credentials, an account or an operational decision is unavailable. Do not pretend an AI feature is deployed without a provider, or live chat is staffed without support coverage.

This brief authorises implementation and testing within the repository. External purchases, real customer communication and production release remain outside that implementation instruction unless separately authorised.

Final implementation report must state:
- Actual AI provider/API/model and configuration requirements.
- What the model receives and cannot access.
- Actual retrieval, source and authorisation design.
- Coverage completed versus missing.
- Evaluation results and critical test outcomes.
- Handoff destination, transcript-sharing rules and customer identity handling.
- Whether human chat is live-enabled or queued-only, and why.
- Retention, quotas, estimated usage from measured test traffic and remaining decisions.
- Migration, deployment and rollback requirements.
- Known limitations without calling incomplete work finished.

Source notes for the implementing engineer:
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling): application code handles model-requested tool calls.
- [OpenAI retrieval](https://developers.openai.com/api/docs/guides/retrieval): semantic retrieval and filtering concepts.
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data): verify endpoint-specific storage/retention; store:false is not a blanket zero-retention guarantee.
- [OpenAI evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices): evaluate realistic cases and regressions as the system changes.
- [OWASP WebSocket security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html): transport, origin, session and per-operation access controls.
- [Intercom inbox setup](https://www.intercom.com/help/en/articles/10223008-setting-up-the-inbox): human support benefits from explicit coverage, routing and workload configuration.

These sources support selected engineering and service-design principles; they do not verify Allied's staffing, infrastructure or current implementation. The operational recommendation is a project-specific assessment, not a fresh live audit of every dashboard.


## 37. Workforce access is the foundation, not a sidebar-only enhancement

Implement this phase first. Manage Workforce & Responsibilities must control the actual work a person can perform. Dashboard navigation, page guards, backend operations, Allie content and live-chat eligibility must derive from the same maintained policy.

Keep these concepts distinct, reusing the repository's current equivalents:

| Concept | Purpose | Examples |
| --- | --- | --- |
| Account role | Administrative account tier and protected role-management boundaries | Customer, Staff, Admin, Super Admin |
| Workforce position | A person's business position; may provide a reviewed assignment template | Operations Supervisor, Accountant, Technician |
| Responsibility assignment | A maintained work function currently assigned to that person | Customer Care handling, Sales, Workshop supervision |
| Capability/permission | A specific permitted operation | View assigned cases, reply publicly, accept live chats, assign cases |
| Scope | Which records/context the capability applies to | An authorised branch, team or assigned work |

Do not duplicate an existing responsibility/capability system merely because its schema uses different terms. Document the mapping and extend the current source of truth where gaps exist.

An Operations Supervisor may handle Customer Care without becoming Admin. A Staff-to-Admin promotion changes the account tier according to the actual promotion policy; it must not silently invent a new job position or replace all responsibility assignments.

If existing Admin/Super Admin policies include baseline or supervisory capabilities, preserve and document them. Where they conflict with the user's responsibility-driven requirement, identify and deliberately reconcile the policy instead of adding broad role-name bypasses. Keep legitimate workforce-management access separate from day-to-day customer-facing work.

The sidebar is a presentation of effective access. It is never the authority that grants it.

## 38. Preserve Customer Care and treat chat as a channel

Do not remove, replace or hollow out the existing Customer Care pages.

Customer dashboard:
- Keep the customer's list/history of their own support requests.
- Preserve detail conversations, status, attachments and follow-up.
- Make a live/queued conversation accessible from its canonical case where appropriate.
- Let customers resume permitted conversations after closing the floating widget.
- Keep own-case access independent of workforce responsibilities.

Admin/Staff/Customer Service dashboard:
- Preserve the existing Customer Care queue and detail workspace.
- Include live and asynchronous conversations as supported channels/views in that workspace.
- Retain assignment, scope, public replies, internal notes, evidence and history.
- Show tools according to effective capabilities rather than assuming every staff member can operate them.

The floating chat is a convenient entry point, not a replacement for case management. The same canonical support records must remain accessible through their normal pages and existing deep links.

Do not conflate:
- A customer's right to contact support.
- A workforce member's permission to handle customers' cases.
- A supervisor's permission to assign or supervise cases.
- A person's eligibility/availability to accept live chat.

A person may hold some of these permissions without all of them. Available status cannot grant a missing capability.

## 39. Discover and maintain the workforce catalogue

Inspect repository instructions, migrations, seed data, invitation/promotion flows, workforce screens and the previously supplied business-role definitions. Reconcile existing IDs/labels rather than creating duplicate records.

Expected business positions to verify include:
- CEO/Managing Director.
- Operations Supervisor.
- Customer Service Officer.
- Sales Supervisor.
- Sales Representative/Cashier.
- Accountant.
- Workshop/Quality Service Lead.
- Electrical/Diagnostics Technician.
- Mechanic Technician.

Two mechanic employees do not necessarily require separate position definitions called Technician 1 and Technician 2. Preserve meaningful existing distinctions; represent individual employees as people rather than duplicating identical permission templates.

CEO/Managing Director as a business title is not automatically equivalent to the protected Super Admin account role. Preserve the repository's ownership/bootstrap/promotion rules.

Maintain responsibility definitions and their capability mappings in a controlled catalogue. A suggested position template can preselect common responsibilities for review; merely changing a display title must not secretly grant access.

When responsibilities are assigned, show the resulting capabilities and scopes in understandable language. An administrator should not need to edit raw JSON or remember internal permission strings.

Support several responsibilities per person where the policy permits. Do not implement exactly one role checkbox as a substitute for the user's requested flexibility.

Do not automatically give Operations all Sales/Customer Care access just because those jobs appear vacant. Apply explicit authorised coverage assignments. When a new employee fills the position, their appointment does not silently revoke Operations' coverage: make that change explicit and auditable.

If a capability requires approval separation or independent review, responsibility templates cannot override that requirement.

## 40. Manage Workforce interface, promotion and safe assignment

Build or improve a single clear workforce management flow.

Directory:
- Real table with person, account role, business position, account status, responsibility summary and actions.
- Search and filters that reflect real server-supported criteria.
- An explicit View/manage action; do not rely solely on an invisible clickable row.
- Scoped visibility of sensitive staff details.

Person detail/editor:
1. Account role and promotion/demotion controls, where authorised.
2. Business position.
3. Responsibility assignments grouped by work area.
4. Applicable branch/team/assignment scope.
5. Effective access preview.
6. Change review and save.

Show what access will be added, removed or retained, with the reason. For example: “Customer Care remains available through your supervisor assignment” or “Live chat acceptance will be removed.”

Keep destructive/access-reducing changes visually distinct. Require a concise reason for consequential promotion, demotion or responsibility revocation according to the audit convention. Preserve existing step-up/MFA requirements.

Apply the existing delegation policy:
- Operators can change only permitted target accounts, account tiers, responsibilities and scopes.
- No self-promotion, protected-owner modification or Super Admin creation through an ordinary responsibility screen.
- No broader scope or capability granted than the operator is authorised to delegate.
- No bypass through bulk assignment, template application, API calls or changed request IDs.
- Do not assume that possessing a capability also means permission to delegate it.

Use optimistic concurrency/version checks for concurrent edits. A stale form must not overwrite a second administrator's changes. Show the conflict and allow review.

Review role and responsibility changes together where dependencies matter. A demotion must not leave incompatible privileged assignments behind. Preview the required removals and apply the validated change atomically, rather than partially saving an insecure combination.

Do not invent new promotion authority. Preserve established Admin/Super Admin boundaries and the protected owner-account rules.

## 41. Effective access, scopes and dynamic navigation

Use one canonical effective-access policy/service and a maintained navigation registry connected to it.

For every navigation item, define:
- Its actual destination.
- Required capability predicate, including AND/OR semantics where necessary.
- Feature availability.
- Any required applicable scope.
- Group and ordering.
- Safe contextual learning references.

Derive sidebar groups from eligible children. Hide empty groups; preserve current responsive collapse behaviour, ordering and useful active-page context. Avoid duplicate items when several responsibilities unlock the same area.

Do not hardcode a separate sidebar tree for every possible combination of jobs. A new supported responsibility should map through the catalogue/policy rather than require duplicating layouts.

Provide a server-derived capability projection for the UI where useful. Do not expose private record lists or rely on a client-declared position. Server checks remain authoritative.

Account baseline permissions, responsibility grants, explicit restrictions and record scope must follow one documented precedence model. Do not casually introduce an unrestricted union of permissions.

Multiple grants:
- Revoking one assignment must remove only the access attributable to that assignment.
- Retain access legitimately supplied by another active assignment.
- Show the remaining grant source in the effective-access preview.
- Combine scope according to the defined policy; a capability for Branch A must not become global because another assignment exists in Branch B.

Use the same effective access for:
- Sidebar and quick links.
- Page/detail guards.
- Buttons, forms and bulk actions.
- API reads and writes.
- Search, reports and exports.
- Notifications and record links.
- Allie retrieval, guides and practice.
- Support queues, presence, assignment and live streams.

A hidden sidebar item must not remain usable through its URL or API. A visible item must not lead to an avoidable permission error because frontend and backend policies disagree.

Preserve existing access-denied/existence-hiding conventions. Do not redirect to a forbidden module after sign-in, promotion, responsibility removal or a stale notification click.

## 42. Active-session changes and operational continuity

Apply access changes without requiring the target to sign out and back in.

After a committed change:
- Invalidate relevant capability/eligibility caches.
- Refresh or invalidate the current session's effective access using the existing session architecture.
- Notify active clients through an appropriate event or bounded revalidation mechanism.
- Update sidebar groups, visible controls and Allie suggestions.
- Revalidate protected work on the next server request and before accepting a consequential operation.
- Close or rescope long-lived subscriptions that are no longer authorised.

Do not hold old privileges in an indefinitely trusted session claim. Removing access must not wait for a visual refresh. Define and test the propagation behaviour; do not promise impossible retroactive cancellation of already committed operations.

If the current page becomes forbidden, stop further requests, clear protected cached data and navigate to a permitted destination with a concise explanation. Do not leave restricted rows readable under a dimmed overlay.

Discard stale in-flight responses after identity/access changes. Revalidate assistant sources, active guides, saved progress and open action controls.

On Customer Care/live-chat responsibility removal:
- Stop accepting new assignments immediately.
- Remove live-chat availability.
- Revoke room subscriptions and reply authority.
- Transfer current work through an authorised policy or place it in the appropriate eligible queue.
- Preserve records, message history and accountability.
- Inform affected parties truthfully that reassignment is needed; never impersonate the former agent.

Do not let an unresolved assignment block urgent revocation indefinitely. If no replacement is available, retain the case in the valid scoped queue and surface the staffing gap.

Preserve drafts only within authorised storage/access boundaries. Do not retain exposed customer information for a revoked operator in a browser fallback, and do not send their unsent draft automatically.

When responsibilities are added, show the new tools without changing the person's account tier. Do not auto-open a dashboard module or force an onboarding tour; offer relevant learning instead.

## 43. Model, migration and audit requirements

Inspect existing tables and policy contracts first. Use compatible forward migrations only where necessary.

The final model must represent:
- Account tier distinct from workforce position.
- Multiple responsibility assignments when permitted.
- Capability mappings and applicable scope.
- Assignment status and provenance.
- Actor/time/reason for consequential changes.
- Current effective-access revision or another reliable invalidation mechanism.

These are required semantics, not prescribed table names. Prefer the repository's established relationships and audit infrastructure.

If templates evolve, do not silently expand existing users' permissions. Define whether assignments follow a versioned template or a reviewed snapshot and make access-expanding changes deliberate. Avoid adding a generic deny/override engine unless an actual requirement calls for it.

Do not migrate ambiguous historical roles into broad privileges. Produce a reviewed mapping, preserve legitimate existing access through an explicit compatibility plan and flag ambiguous accounts for resolution.

Write authorised assignment/account-role changes and their audit events consistently. Capture before/after references, operator, target, scope and reason without logging secrets or irrelevant personal information.

Audit records must remain attributable after job changes, demotion or account suspension. Removing a responsibility must not erase past actions.

Do not let Allie grant responsibilities, promote staff or change scopes. It may explain the process and open the normal permitted management page.

## 44. Workforce acceptance cases and completion gate

Add targeted backend and browser tests. At minimum:

| Case | Required outcome |
| --- | --- |
| Operations has no Customer Care assignment and no other applicable grant | Customer Care operator tools absent and requests denied |
| Customer Care responsibility added | Correct sidebar group, queue and authorised actions appear during the session |
| Care view/reply allowed but live acceptance not allowed | Case work available; live-chat acceptance remains unavailable |
| Live-chat capability added within allowed scope | Eligible operator can opt into availability; no automatic online promise |
| Customer Care responsibility removed | Operator access, subscriptions and availability revoked; work safely queued/reassigned |
| Another valid grant still permits Customer Care | Remaining authorised access retained and explained |
| Branch A care assignment | No access to Branch B cases, events or notifications |
| Position label changed without an access assignment change | No unexpected capability expansion |
| Staff promoted to Admin | Valid tier change; documented administrative policy applied; unrelated job assignments not silently replaced |
| Demotion conflicts with privileged assignments | Review explains dependent removals; validated result committed consistently |
| Unauthorised operator forges a grant or broader scope | Backend rejects it; no partial assignment |
| Stale concurrent edit | Conflict surfaced; newer changes preserved |
| Old open page or cached Allie answer after revocation | Restricted data/actions no longer exposed or usable |
| Customer opens own Customer Care history | Own support remains accessible without a workforce assignment |
| Live chat closes or goes offline | Existing Customer Care pages, reference and history remain usable |
| Protected role/account targeted | Existing ownership and promotion restrictions enforced |

Also test multi-tab access, expired sessions, interrupted invalidation, feature flags, scope combinations, invitation/onboarding and role changes through every supported API path.

Completion gate:
1. Workforce catalogue reconciled with the supplied structure and repository.
2. Account tier, position, responsibility and scope clearly separated in the UI/model.
3. Delegation and promotion rules enforced on the server.
4. Sidebar, APIs, Allie and live-chat eligibility agree.
5. Addition/removal works in active sessions and long-lived connections.
6. Existing Customer Care customer and operator pages preserved.
7. Audit, migration and compatibility evidence supplied.
8. Missing accounts/fixtures identified explicitly rather than claimed tested.

Include in the final report the before/after access examples, current policy precedence, navigation mapping, revocation behaviour, migration effects and any unresolved business-policy choices.

Implement this workforce foundation before calling the all-dashboard Allie or live-chat rollout complete.
