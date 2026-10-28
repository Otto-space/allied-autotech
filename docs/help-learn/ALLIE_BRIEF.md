# Allied AutoTech — Help, Help & Learn and “Allie” Assistant Brief

Inspection date: 26 October 2026.

## 1. Mission and scope

Act as the senior product engineer and UI/UX designer. Improve:
- /help.
- The Help & Learn entry on /help.
- /learn and its article/guide views.
- Existing safe-practice pages.
- The floating Help & Learn launcher/panel.
- Optional walkthroughs connected to these features.

Add a small, friendly assistant with useful interaction. “Allie” is a proposed working name, not an already approved brand identity. Keep the name easy to change.

The result should help customers and authorised staff understand the website, follow a task and practise safely. It must be professional, approachable and usable without long technical explanations.

Implement a real connected experience, not a decorative robot that opens another wall of links.

Preserve unrelated homepage, dashboard, fitment, media and commerce work. Add stable guide targets/context hooks where required, without redesigning those entire pages.

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

Include an easy Open full Help & Learn link from the assistant. Escalation opens an existing support route/draft or contact option; it does not send a message automatically.

## 10. Useful answers without false AI claims

The assistant must give grounded help, not pretend to know live records.

Baseline implementation:
- Reuse the reviewed content registry.
- Map common natural-language questions to eligible articles/steps.
- Offer clarification choices when intent is ambiguous.
- Return concise supported answers with a source link and reviewed/version context where useful.
- Admit when it cannot find an answer.
- Provide a working help/contact fallback.

A deterministic retrieval/conversational guide is acceptable and should be described as a website guide, not falsely advertised as generative AI.

If a real AI provider is already configured or is deliberately integrated within the project constraints:
- Use server-side credentials/configuration.
- Ground responses in the eligible reviewed corpus.
- Do not send raw page DOM, customer records, form contents, private IDs, finance data or secrets to a provider.
- Send minimal allowlisted page/task context only.
- Do not ship the entire restricted corpus to every browser.
- Add suitable validation, rate limits, timeouts and failure fallback.
- Treat user prompts and retrieved text as content, not authority to change system rules or invoke actions.
- Do not invent endpoints, buttons, prices, opening hours, fitment conclusions or permissions.
- Keep a functional non-AI path if the provider is unavailable.
- Label AI-assisted behaviour honestly when present.

Do not add an external vector/search platform by default. Do not create paid provider accounts or invent secrets. Missing optional provider configuration must not block the core redesigned hub, guides and useful baseline assistant.

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

Verify the existing parts guide first. Add/refresh a small, useful initial set for supported tasks such as customer-care follow-up, scoped staff care handling or product-image management only after inspecting the actual current workflow and eligibility. Do not invent guide steps for unavailable capabilities.

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

Use existing supported scenarios first; add only a bounded set of useful task experiences.

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
| Provider failure, if applicable | Existing grounded learning still works; secrets/context remain protected |
| Regression | FAQs, existing deep links, support routes and unrelated dashboard work remain correct |

Work in bounded batches:
1. Map/reproduce current behaviour and shared content/eligibility.
2. Redesign the Help entry and Learn hierarchy/article presentation.
3. Repair live guide progression and simplify control placement.
4. Improve existing practice feedback and isolation.
5. Implement Allie's branded launcher and useful grounded baseline interaction.
6. Integrate any justified optional AI capability without blocking the core experience.
7. Run relevant build/type/lint/unit/API/browser checks, inspect mobile/desktop and fix regressions.

Deliver:
- Working implementation and changed files/contracts.
- Safe fixture screenshots of Help entry, Learn hub, assistant, walkthrough and practice.
- Reproduction/regression evidence for guide progression.
- Roles/modes/devices actually tested.
- Isolation/privacy/accessibility checks.
- Real assistant capabilities and any provider/configuration limitations.
- Remaining issues and deferred optional features.

Research references supporting interaction principles:
- [Microsoft Research human-AI interaction guidelines](https://www.microsoft.com/en-us/research/?p=564561): set clear expectations, use relevant context and keep assistance easy to invoke, dismiss and correct.
- [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): use correct focus, keyboard and modal behaviour.

These references inform the interaction design. The proposed layouts, mascot and implementation scope above are specific recommendations for Allied AutoTech.

