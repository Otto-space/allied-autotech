# Allied AutoTech — Help, Learn & Practice

## Implementation brief and Codex execution prompts

Prepared: 24 October 2026, Africa/Lagos.

Status: proposed development specification, ready to implement now or retain for later. This document does not claim that the repository has been inspected, that these features already exist, or that business policies and permissions have received additional owner approval.

Working product name: **Help & Learn**. Branding may change without changing the requirements.

---

## 1. What we are building

Build a role-aware assistance system for Allied AutoTech that helps visitors, customers and employees understand and use the website. It should answer approved how-to questions, explain the page the user is on, guide users through actual workflows, and provide clearly separated practice scenarios using fictional data.

The system has three core experiences:

1. **Explain:** find a trustworthy answer, understand a field or status, and open the relevant page or article.
2. **Guide:** receive optional step-by-step instructions anchored to the real interface.
3. **Practise:** learn with sample data in a simulation or an isolated training environment, without affecting live business operations.

Conversational AI is an optional later layer. The useful core must work without an AI provider, model API key or vector database. A search box and well-designed task guides are legitimate first-class interfaces, not a temporary error state.

Primary goal: help each person complete their authorised tasks confidently and correctly, with less memorisation, fewer avoidable mistakes and less repeated support.

## 2. Boundaries and operating modes

Preparing this document does not implement or publish the feature. Codex must use one of the execution prompts at the end when instructed to act.

| Execution mode | Authorised outcome |
| --- | --- |
| PLAN ONLY / SAVE FOR LATER | Inspect the available repository; save an implementation-ready specification, capability map and backlog. Do not modify runtime behaviour, add packages, execute migrations or deploy. |
| BUILD NOW | Implement the deterministic foundation, guides and suitable practice simulation in verified increments. Build against the actual repository and existing permissions. AI is excluded unless explicitly selected. |
| RESUME | Re-read current code, decisions and previous checkpoints; continue the next incomplete milestone. Do not assume the application is unchanged. |
| ADD AI LATER | After the deterministic foundation is reliable, add permission-filtered, grounded conversational help behind its own rollout control. Do not introduce operational write actions. |

If a document is attached without an execution instruction, treat it as a specification to review, not implicit permission to start a production deployment. “Later” means a documented backlog; do not create a scheduled automation or recurring task unless separately requested.

## 3. Product principles

- Help must complement a usable interface. Fix confusing core UI rather than making every user read a tutorial to overcome it.
- Offer guidance at the point of need. Keep it optional, easy to dismiss and available to reopen.
- Use the existing brand and design system. Avoid a competing chatbot visual language.
- Make the distinction between explanation, navigation, practice and real work visible.
- Provide the shortest sufficient answer first, with expandable detail and links.
- Preserve user work and control. Never unexpectedly change a form, navigate away or submit an action.
- Business truth, access control and application state outrank generated wording.
- A capability is available only when both the product supports it and the current user may use it.
- Demonstration success is never represented as an actual payment, booking, order or approval.
- Build and verify coherent milestones instead of promising an endless autonomous implementation.

## 4. Discovery before implementation

Read applicable AGENTS.md files, package scripts, architectural documentation, current business decisions, route structure, authentication, authorisation and feature flags. Preserve unrelated instructions and uncommitted changes.

Inspect the actual frontend, backend, shared contracts and reusable components. Historical context suggests a Next.js/TypeScript frontend and an Express/Prisma/PostgreSQL backend; verify this rather than generating files for an assumed structure.

Produce a capability map containing:

- Actual role identifiers and effective permission identifiers.
- Existing routes and supported workflows for each audience.
- Public versus internal help audiences.
- Implemented, partially implemented, planned, disabled and absent features.
- Authoritative sources for business policies and terminology.
- Available training/test environments and integration adapters.
- Existing help content, support links, search, analytics and audit logging.
- Current test commands and browser-testing capabilities.

Do not create a new workflow simply because it appears in a suggested tutorial below. Record a missing feature and hide or label the related guide appropriately. Distinguish an unresolved business question from a routine engineering decision.

## 5. Allied AutoTech business context

Use current repository records and explicitly approved decisions as the authority. The following are continuity notes, not permission to overwrite newer records:

- Parts fulfilment at launch is workshop collection; delivery integration is deferred.
- Vehicle launch direction is enquiries and inspections; paid reservations are deferred.
- Submitted bookings, enquiries and quotations are not automatically confirmed appointments, accepted quotes or successful payments.
- Vehicle seller arrangements and several operational details have previously been unresolved. Do not invent answers.
- The workforce includes CEO/MD, Operations Supervisor, Customer Service Officer, Sales Supervisor, Sales Representative/Cashier, Accountant, Workshop/Quality Service Lead, Electrical/Diagnostics Technician and two Mechanic Technicians.
- The Operations Supervisor has been expected to cover sales-supervision and customer-service responsibilities while those roles are vacant. Verify the current permission assignment.
- Admin and Super Admin are application access roles and may not map one-to-one to job titles. Preserve the actual model.

Verify address, hours, collection procedure, payment rules, response times and escalation contacts before publishing related help. An undecided policy must produce an honest “not yet confirmed” explanation or support link, not a plausible invention.

## 6. Role-aware learning coverage

This table defines candidate learning topics, not new privileges or guaranteed existing features. Build guides only for verified workflows. Use effective permissions, resource ownership, assignment and organisational scope where the application requires them; a role name alone is insufficient.

| Audience | Candidate learning topics | Important restriction |
| --- | --- | --- |
| Visitor | Find services, parts and vehicles; understand account benefits; contact the business | Public documentation only; no account records or internal procedures |
| Customer | Search and compatibility; booking requests; quotations; cart/orders; collection; saved vehicles; profile/security | Their own authorised records only; no other customer data |
| CEO/MD | Available oversight views, report definitions, review/approval responsibilities | No implied access beyond actual assigned privileges |
| Operations Supervisor | Work queues, coordination, escalations and interim responsibilities | Respect current combined permissions, rather than creating a hard-coded exception |
| Customer Service Officer | Enquiry handling, follow-up, status explanations and escalation | No automatic access to unrelated financial or administrative information |
| Sales Supervisor | Sales oversight, permitted review and supervisory workflows | No power to approve actions absent from the actual permission model |
| Sales Representative/Cashier | Product lookup, permitted quotations/orders, collection and payment-status interpretation | No tutorial for bypassing reconciliation, stock or approval rules |
| Accountant | Available financial records, payment reconciliation and report interpretation | Financial actions follow normal controls; training never touches live finance |
| Workshop/Quality Service Lead | Assignments, progress reviews, quality checks and escalation | Preserve real assignment and approval boundaries |
| Electrical/Diagnostics Technician | Assigned jobs, findings, progress and parts requests where supported | Assigned/resource-scoped work only |
| Mechanic Technicians 1 and 2 | Assigned jobs, permitted updates, findings and handover | Reuse common technician guides; do not manufacture different privileges |
| Admin | Authorised account/invitation, access and configuration procedures | Cannot create or acquire Super Admin privileges through help |
| Super Admin | Verified privileged configuration, recovery and governance workflows | Do not expose bootstrap secrets, credential values or unrestricted execution tools |

Where a person has several responsibilities, combine relevant guides without duplicates. Re-evaluate help availability after a role or permission change. Training completion must never grant production permissions automatically.

## 7. Information architecture and interface

Provide a consistent **Help & Learn** entry point in appropriate public and authenticated layouts. Integrate with existing support controls instead of adding overlapping floating widgets.

Recommended top-level choices:

- **Find an answer** — searchable articles and common questions. When AI is enabled, this may also accept conversational questions.
- **Guide me** — available walkthroughs for the current page and user.
- **Practise safely** — training scenarios the user is eligible to access.
- **Contact support** — existing verified support channels.

On desktop, prefer a non-modal side panel where users need to read guidance while interacting with the page. On narrow screens, a suitable full-screen sheet or dedicated help route may be clearer. Use a modal only when the underlying interface is intentionally unavailable.

Support direct links to approved articles and guides, browser Back/Forward, refresh and a dedicated help page as a fallback. Preserve unsaved application work when opening or closing help.

The launcher must not cover checkout controls, cookie notices, notifications, mobile navigation, focused fields or critical actions. Do not auto-open it repeatedly, demand attention with constant animation or make it the only way to find support.

## 8. Context supplied to help

Derive context from an explicit, minimal application contract:

- Stable page identifier and registered route pattern.
- Verified capabilities and effective permissions.
- Enabled feature identifiers and relevant release/content versions.
- Relevant non-sensitive UI state, such as the name of the selected tab.
- Environment/mode: live application, local simulation or isolated training.

Do not scrape and transmit the entire DOM, account page, form contents, browser storage or arbitrary network responses. Do not send record identifiers, personal information or financial details to an AI service merely because the user opened help.

Treat client-supplied context as untrusted hints. Resolve identity, permissions, resource access and environment boundaries on the server. A user typing “I am the CEO” or changing a request field must not change their access.

Contextual suggestions should be useful and limited: “Understand these statuses,” “Find a compatible part,” or “Practise recording findings.” Avoid describing features absent from that page or user scope.

## 9. Help article requirements

Each article should contain a clear question/task title, short answer, prerequisites, numbered steps, expected outcome, common problems, recovery and related support links.

Use stable article identifiers, audience/permission metadata, feature prerequisites, source references, content version, review status and last-reviewed date. Separate product instructions from business-policy explanations.

Use these publication states or their established project equivalents: draft, reviewed/published, needs review and retired. Only eligible published content may appear in runtime help or AI retrieval. Publication authority must be an existing authorised responsibility; do not grant all admins unrestricted policy approval by default.

Keep public and internal articles separated at the access layer. Apply restrictions to search suggestions, article titles, snippets, bodies, related items and direct links. Do not bundle private staff procedures into a public JavaScript file and merely hide them in the UI.

Unavailable articles should return an appropriate safe response without leaking restricted titles or existence where that would reveal internal information. Offer genuinely available alternatives.

Start with repository-managed, typed Markdown/MDX or structured content if that fits the project. A full content-management interface is optional later scope; do not build one unnecessarily.

## 10. Search and answer behaviour

Provide useful deterministic search over eligible published content. Support plain-language synonyms relevant to actual labels, such as “parts/shop,” “quote/quotation,” and “booking/appointment request,” without changing business meanings.

Return short, scannable results with descriptive titles and a matching excerpt. Keep keyboard navigation, clear input, loading, no results and recovery usable. Never show inaccessible snippets while filtering results later.

For a direct answer, display the short explanation, source article link and relevant navigation action. Distinguish an explanation of a status from a lookup of the user’s current status.

For example, “What does payment pending mean?” can use documentation. “Has my payment arrived?” requires an authorised live lookup that is outside the initial knowledge-only release. The assistant must not infer it from the conversation or pretend it checked.

Provide a human-support route when content does not answer the question. If the business has only email/phone/contact forms, present those honestly; do not display a fake “agent joining” or promise a live handoff.

## 11. Walkthrough engine

Represent guides as versioned definitions tied to verified page and capability identifiers. Prefer stable semantic anchors, such as registered tutorial IDs, instead of brittle CSS positions or visible-text matching alone.

Each step should define its target, explanation, prerequisites, allowed navigation, completion condition and fallback. Completion must use a known UI or application event where practical, not assume success after a timed delay.

Suggested lifecycle: available → starting → active → paused → completed, dismissed or unavailable. Preserve useful progress only where prerequisites and definition versions still match.

Requirements:

- User starts, skips, pauses, resumes, restarts and exits a guide.
- Show current step and concise progress without hiding essential page content.
- Wait for route/data readiness with a bounded timeout.
- If a target is missing or inaccessible, stop gracefully and offer the equivalent written steps; do not highlight the wrong control.
- Reposition after resize, scroll and responsive layout changes.
- Avoid duplicate handlers and stale state when routes change.
- Do not unexpectedly reset filters, overwrite fields, navigate away from dirty forms or click buttons for the user.
- Re-check eligibility after session expiry or permission changes.
- Support keyboard operation and a linear text alternative.
- Do not require users to perform a real irreversible action to finish a tutorial. End before live submission or offer practice instead.

Avoid a forced multi-page first-login tour. A short optional introduction may point out where help lives, but essential use of the application must remain possible without completing training.

## 12. Practice architecture: select the right level

Use the least complex training level that honestly achieves the lesson.

| Level | Suitable purpose | Required isolation |
| --- | --- | --- |
| Example preview | Read a completed sample form or record | Static synthetic content; no operational writes |
| Local simulation | Enter values and practise a bounded workflow | Explicit simulation data adapter; no live mutation paths; resettable synthetic state |
| Full workflow training | Practise multiple interacting backend steps | Isolated training deployment/data store, environment credentials and integration controls |

For the default BUILD NOW scope, a well-tested local simulation is sufficient where no isolated backend already exists. Do not label it an end-to-end rehearsal of production payment or booking logic. Document what it simulates and which production behaviour it does not prove.

For full workflow training, use an isolated database or equivalent enforceable boundary and separate credentials. Merely adding an isDemo field to production records is not an acceptable substitute. Staging is not automatically a safe training environment: verify data, configuration, integrations and side effects first.

Do not copy production customer data into training. Do not switch the live user’s production role to simulate another role. Training role fixtures must be restricted to the isolated training context and the user’s authorised training entitlement.

## 13. Practice safety contract

Every practice screen must display a persistent, plain-language label such as **Practice mode — fictional data; nothing here changes live records**. Repeat the distinction at simulated completion and on any exported sample.

Enforce the boundary in code and infrastructure where applicable:

- Local simulation imports/use-sites must not invoke production mutation clients. Use a narrow, explicit practice adapter and test that the network boundary is respected.
- Full training credentials and sessions must not authorise live operations. Production APIs must reject training credentials and identifiers, independent of a client-supplied mode flag.
- Do not share live cookies across a training subdomain or reuse live write tokens. If sign-in bridging is required later, design a narrow server-side exchange for a training-scoped credential.
- Prevent real email, SMS, messaging, payment, refunds, uploads to live storage and external operational webhooks. Use separate mock adapters or approved provider test endpoints when the scenario actually needs them.
- Background jobs, queues, scheduled tasks and outbound integration paths require the same isolation as synchronous endpoints. Apply outbound allowlists or equivalent infrastructure controls for full training.
- Practice must not reserve workshop slots, modify stock, create invoices in live finance, notify actual staff, change permissions or contaminate production reports and operational analytics.
- Do not offer arbitrary URLs, unrestricted HTTP calls, SQL, shell commands or generic administrative tools through training or chat.
- Reset and cleanup must be scoped to the active practice session. A reset can never target a live record.

A banner, prompt instruction, frontend flag or suffix on a record ID alone does not establish safety. Test observable side effects and server rejection.

## 14. Sample data and “fill an example”

Use fictional, clearly labelled data. Example identity: **Practice Customer 001**. Use reserved example email domains, such as customer001@example.com. Avoid generating real-looking deliverable Nigerian phone numbers; use a clearly synthetic display value and keep messaging adapters disconnected. If a provider requires a valid-format test phone number, use an approved test fixture within that provider’s test environment.

Sample vehicle: Toyota Corolla, model year 2018. Sample request: brake pads. Compatibility, prices, stock and outcomes in a scenario are explicitly fictional unless sourced from a verified non-production fixture.

“Fill an example” must:

1. Be available only inside a declared practice surface.
2. Explain that it inserts fictional information.
3. Preserve existing entries or ask before replacing them.
4. Run through the practice form’s validation and remain editable.
5. Never submit automatically.
6. Offer clear/reset and an accessible announcement of the change.

Use deterministic fixtures for reliable lessons and tests. An LLM is unnecessary for generating the core sample records. Make sample prices, registration details and deadlines explicitly simulated.

Do not inject dummy values into the user’s live profile, customer enquiry, staff job record, checkout or security settings. A future “help me draft my real request” feature must use real user-supplied facts, show proposed changes and remain separate from example filling.

## 15. Initial scenario catalogue

Use the following as a candidate backlog. Select only scenarios whose underlying workflow is verified. All staff roles must have appropriate learning coverage, but identical permissions may share one scenario implementation.

| ID | Audience | Scenario | Completion evidence |
| --- | --- | --- | --- |
| C-01 | Customer | Find Toyota Corolla 2018 brake pads | User applies supported vehicle filters and interprets the compatibility evidence correctly |
| C-02 | Customer | Prepare a service-booking request | Required sample details are entered; user understands request versus confirmation |
| C-03 | Customer | Understand a sample quotation | User identifies scope, price and actual available next action |
| C-04 | Customer | Understand collection and order statuses | User finds the published instructions and distinguishes sample order/payment states |
| CS-01 | Customer service / eligible Operations Supervisor | Triage a fictional enquiry | User identifies missing information and selects a permitted escalation/next step |
| S-01 | Sales rep/cashier | Find a suitable sample product and prepare permitted sales information | User checks attributes and avoids treating unknown fitment as verified |
| S-02 | Sales supervisor / eligible Operations Supervisor | Review a sample sales queue | User identifies the relevant item and performs a simulated permitted review |
| A-01 | Accountant | Review a fictional payment discrepancy | User distinguishes pending/verified/unmatched states without declaring money received |
| W-01 | Workshop lead | Review and assign a fictional job | User selects an eligible simulated assignment and understands the status change |
| T-01 | Electrical/diagnostics technician | Record findings on an assigned sample job | User enters useful fictional findings within their task scope |
| T-02 | Mechanic technicians | Update an assigned sample job and handover note | Valid permitted progress and a clear handover are recorded in simulation |
| O-01 | Operations Supervisor | Review a mixed fictional work queue | User distinguishes responsibilities and routes an issue appropriately |
| E-01 | CEO/MD | Interpret a sample oversight view | User understands metric scope, sample date range and available review responsibilities |
| AD-01 | Admin | Practise an invitation/access procedure | User understands intended role, limits and simulated invitation outcome |
| SA-01 | Super Admin | Review privileged configuration/recovery guidance | User identifies the approved procedure without using real secrets or changing live access |

If the product does not support a listed action, make it a written explanation only where useful, or mark it deferred. Do not create fictional buttons in the live UI to make a tutorial appear complete.

## 16. Detailed example: Toyota Corolla 2018 brake pads

Goal: teach the customer to find a candidate part and interpret fitment, rather than equating matching words with compatibility.

Prerequisites: the product has a supported vehicle-selection feature and a defined representation of compatibility. If either is absent, document the dependency and offer an honest search/enquiry guide.

Proposed practice sequence:

1. Enter Practice mode and see the fictional-data label.
2. Open the simulated Parts catalogue.
3. Select Toyota, Corolla and 2018 using the supported dependent fields.
4. Provide engine/trim or other attributes if the fixture requires them; explain why they matter.
5. Search for brake pads and inspect a sample result.
6. Compare three fixture outcomes: compatible, incompatible and compatibility not confirmed.
7. For unknown compatibility, select the supported enquiry/check-details path rather than treating the part as a verified fit.
8. Review a simulated next step. End without creating a live order or payment.
9. Show task-specific feedback and offer restart or return to the live Parts page, with a clear boundary and no copied sample cart.

Feedback should explain the choice. It should not shame the user, invent a score suggesting professional competence or imply the fixture certifies real-world vehicle compatibility.

## 17. Progress, completion and feedback

Track a guide/scenario’s stable ID, definition version, current step, status and last activity. If persisted server-side, scope progress to the authenticated user and current environment. Keep anonymous progress local and non-sensitive unless a justified alternative exists.

Do not store entered form contents as tutorial progress. Clear or isolate client state on sign-out and account changes, especially on shared workshop computers.

If a guide changes materially, explain that a restart is needed; do not treat completion of an old version as proof of new training. Let users revisit completed topics.

Use supportive feedback: what was completed, what needs correction, why it matters and how to try again. Do not gate normal access on training completion by default. Any future mandatory training or staff completion reporting requires an explicit business decision and an appropriate privacy/access model.

## 18. Conceptual data and contracts

Adapt the following concepts to existing conventions. They are not a mandatory migration or a requirement to create a table for every item.

| Concept | Suggested fields / responsibility |
| --- | --- |
| HelpArticle | Stable ID/slug, title, summary, content, visibility, required permissions/features, source references, version, review/publication status |
| GuideDefinition | Stable ID/version, page IDs, eligibility, prerequisites, ordered steps, fallback article, environment constraints |
| GuideStep | Stable step ID, semantic target, instruction, expected event, safe fallback, allowed navigation |
| PracticeScenario | Stable ID/version, audience/capabilities, simulator type, fixture reference, objectives, completion criteria |
| LearningProgress | Owner/environment, definition ID/version, state, step and timestamps; no operational record payload |
| PracticeSession | Owner, allowed scenario, environment, expiry, scoped synthetic state; required only for server-backed practice |
| HelpFeedback | Article/guide reference, helpfulness, optional carefully handled comment, minimal context |
| AssistantConversation | Optional AI-phase concept; keep transient by default unless a documented retention policy says otherwise |
| ContentSource | Authoritative reference, owner/reviewer, publication/review date and relevant feature version |

Prefer existing content structures and capability services. Do not require a vector store for a small help corpus. Keep eligibility and source metadata available independently of AI.

## 19. API responsibilities

The following routes are illustrative. Match the actual API versioning, naming, validation, session, CSRF and error conventions. Reuse an equivalent service instead of duplicating it.

| Operation | Example route | Contract |
| --- | --- | --- |
| Search help | GET /api/help/search | Search only eligible published content; bounded query/results |
| Read article | GET /api/help/articles/:slug | Enforce audience and capability rules, including direct requests |
| List eligible guides | GET /api/help/guides | Resolve page/feature context and server-side user eligibility |
| Read guide | GET /api/help/guides/:id | Versioned definition with allowed targets/actions only |
| Save progress | PUT /api/help/progress/:id | Validate definition/version/step; bind ownership on server |
| Submit feedback | POST /api/help/feedback | Bounded payload; abuse controls; safe optional comment handling |
| List practice scenarios | GET /api/training/scenarios | Eligible scenario metadata only |
| Create practice session | POST /api/training/sessions | Optional for server-backed training; isolated environment and scoped fixtures |
| Reset/end practice | POST /api/training/sessions/:id/reset or /end | Owner-scoped and idempotent where appropriate; never live operational deletion |
| Ask a grounded question | POST /api/help/chat | Optional AI phase; permission-filtered retrieval, bounded cost, no operational writes |

Local simulations may not need training endpoints. Do not create fake server infrastructure simply to match this table.

Apply resource-level authorisation to progress and training sessions. Revalidate permission changes on protected requests. Error responses must not expose secrets, stack traces, restricted article content or another person’s session.

## 20. Optional AI: grounded conversational help

Add this only when selected and when maintained source content is available. The AI layer should explain verified help content and suggest allowlisted article/navigation/guide actions. It is not a general company administrator or an automotive diagnosis authority.

Required answer behaviour:

- Answer from eligible approved sources and provide source article links.
- Distinguish product instructions, business policy, fictional examples and live information.
- State when the available sources do not support an answer.
- Ask a focused clarification when the user’s task is ambiguous.
- Avoid revealing internal help to public users or records from another account.
- Do not invent controls, routes, stock, prices, policies or transaction outcomes.
- Never request passwords, OTPs, recovery codes, session tokens, card details or privileged secrets.
- Keep users in control of navigation and guide activation.

Filter sources before retrieval results reach the model. Apply restrictions to vector queries if used, retrieval caches, excerpts and citation resolution. Do not retrieve everything and ask the model to hide the private parts.

Use separate public/internal indexes or an equivalently tested access-filtered design. Partition caches by the effective access context and content version; do not share private answers through public caches. Invalidate or bypass stale permission-dependent entries after access changes. Any future personalised answers require account/resource scoping too.

Treat retrieved documents, user messages, product names and record notes as untrusted content. Prompt instructions are not an authorisation boundary. Prevent arbitrary tools, SQL, URLs and code execution. Do not fetch arbitrary user-supplied URLs or render model-generated remote images that could exfiltrate information.

Render output safely. Validate structured actions against a server-owned registry and current permissions. Resolve links from approved article/route IDs, not arbitrary model-generated URLs. Reject unsafe markup and unsupported actions; do not auto-execute suggestions.

Keep model credentials server-side. Set request size, context size, output size, timeouts, per-user/IP abuse limits as appropriate, concurrency limits and deployment spend controls. A client cancellation should stop upstream generation where the provider supports it.

If the provider is disabled, unavailable, rate-limited or over budget, retain article search, guides and practice. Explain the limitation briefly without exposing provider internals. Do not block checkout, login or essential site functions on AI availability.

## 21. AI action boundaries and possible later extensions

Initial AI release: documentation answers and user-invoked navigation/guides only. Do not expose production order, booking, refund, invitation, access-change or job-update mutation tools to the model.

A future authorised read-only account lookup should be a separate milestone with narrow resource-scoped tools, refreshed server-side checks, minimal fields and clear timestamps. Documentation alone cannot answer whether a particular live payment was verified.

A future “help draft my real form” feature may propose supported field values for review. It must not overwrite user entries silently, invent facts or submit automatically. Keep normal client/server validation and existing business rules.

Do not build a generic browser-clicking agent for the production site. Do not let chat messages replace established approval, MFA, reconciliation or permission workflows. High-impact actions, if ever separately introduced, require dedicated product and security design beyond this brief.

## 22. Privacy, content separation and auditability

Collect the minimum data needed. Do not log raw form values or operational payloads into help analytics. Redact sensitive fields in error logs and avoid recording whole prompts by default.

For AI, document exactly what context is sent externally and the provider’s applicable data-handling settings. Do not assume retention or training-use terms. Verify current provider documentation before enabling it; keep persistence disabled until a justified retention/deletion policy is defined.

Provide a clear notice before any optional transcript is sent to support. Let the user review what will be included. Opening a help panel does not authorise sending a message or creating a support ticket.

Feedback text is untrusted input and may contain personal information. Apply validation, access control, retention and safe rendering; do not silently promote it into published help or AI sources.

Keep administrative content edits and publication changes auditable using existing conventions. Protect review/publication controls independently of help-reading access. Record guide starts/completions as learning activity, not proof of job performance.

## 23. Accessibility and responsive design

Use WCAG 2.2 AA as the baseline target unless an applicable stronger requirement exists. Verify relevant requirements against authoritative guidance and report the actual testing scope.

- Make help discoverable in a consistent location and usable without hover.
- Give launchers, controls, steps, status messages and close actions accessible names.
- Preserve heading structure, sufficient contrast, text resizing and reflow.
- For modal sheets, implement actual modal behaviour, initial focus, contained Tab navigation, Escape dismissal and sensible focus return.
- For non-modal guides, allow users to interact with highlighted page controls. Do not trap keyboard focus inside a tooltip while requiring an action outside it.
- Provide a written step list when an anchored overlay is unsuitable for assistive technology or narrow screens.
- Announce important step/completion changes without flooding a live region. Avoid streaming every AI token to screen readers.
- Honour reduced motion and avoid auto-scrolling that disorients users.
- Keep touch targets comfortable and prevent the panel or keyboard from covering the required control.
- Test zoom, long answers, multiline labels, error states, short screens and mobile orientation where supported.

Test representative widths such as 320, 390, 768, 1024 and 1440 CSS pixels, plus actual layout transition points. Distinguish emulator checks from physical-device testing. Automated accessibility scans supplement manual keyboard and appropriate assistive-technology checks.

## 24. Reliability and performance

Lazy-load optional help UI and training code where appropriate. Do not ship a model SDK, staff-only corpus or every training fixture in the public critical path. Reserve sensible space and avoid layout shifts.

Keep the core website usable if help fails to load. Bound network requests and search results. Handle stale guide definitions, cancelled requests, offline states, missing targets and session expiry gracefully.

Do not let a slower previous search replace newer results. Avoid opening multiple guides or practice sessions accidentally. Clean up listeners, observers and requests on close/navigation.

If the app does not support offline operation, do not promise it. A practice simulator that works locally should still label any persistence limits honestly.

Use existing infrastructure first. Document additional packages, services and runtime costs only when a selected phase requires them. Do not choose a provider/model based on assumed current pricing or a hard-coded “latest” model name.

## 25. Feature flags and rollout

Reuse the existing configuration system. Candidate independent controls: help, walkthroughs, practice, and AI. Names are illustrative, not required environment-variable spellings.

Production AI and full workflow training remain off until their own verification gates pass. Server-side enforcement is required for protected capability/integration controls; a hidden launcher is not an enforcement mechanism.

Roll out first to designated test users where a cohort mechanism exists. Preserve a kill switch for each optional layer without disabling the rest of the website. Document rollback and any schema compatibility requirements.

Do not deploy automatically because a local build succeeds. Follow the repository’s established publication workflow and the user’s actual instruction. BUILD NOW authorises implementation and suitable local/test verification, not an unrequested production publication.

## 26. Phased implementation and deliverables

### Phase 0 — Repository-grounded design

Deliver the actual capability/role/route map, source-of-truth list, architecture decision and risk/dependency register. Identify which suggested scenarios are feasible now. Verify the learning content’s access model before writing a public bundle.

Gate: proposed work is tied to actual code and clearly distinguishes observed facts, assumptions and missing business decisions.

### Phase 1 — Help foundation

Deliver the Help & Learn entry point, searchable role-appropriate articles, contextual links, safe direct article access, support route and relevant loading/error/empty states. Provide useful help coverage for every implemented role; shared roles may reuse articles.

Gate: public and restricted content remain separated, core help works without AI, and existing application journeys still work.

### Phase 2 — Guided workflows

Deliver the versioned walkthrough engine, stable anchors, progress handling and an initial set of high-value verified guides. Prioritise customer discovery and frequent staff tasks. Do not force every topic into an overlay; written guidance may be better for simple or sensitive procedures.

Gate: guides work across supported layouts, missing targets fail safely, users can leave/restart, and no guide performs real irreversible actions automatically.

### Phase 3 — Practice simulation

Deliver sample scenarios, example filling, reset, completion feedback and visible mode separation. Use local simulations first where adequate. Cover representative tasks across verified responsibilities; avoid redundant implementations for identical permissions.

Gate: tests prove that practice does not reach live mutation/integration paths and that users understand the simulated outcome. If full workflow training is selected, add separate environment and side-effect tests before enabling it.

### Phase 4 — Optional grounded AI

Deliver only when explicitly selected: backend model integration, permission-filtered retrieval, source links, validated navigation suggestions, limits, privacy notice, failure fallback and adversarial tests.

Gate: no private-source leakage, unsupported policy fabrication or operational mutation tools; deterministic help remains usable when AI fails.

### Phase 5 — Optional future extensions

Consider separately: authorised live read-only lookups, draft assistance, help-content administration, additional languages, staff training reports and advanced isolated workflow training. Each requires a concrete scope and acceptance criteria. Do not implement them merely because they appear in this roadmap.

Default BUILD NOW target is Phases 0–3. Stop at a documented checkpoint if a true external dependency blocks a phase, finish independent authorised work, and explain the remaining dependency precisely. Do not silently redefine an incomplete phase as complete.

## 27. Required tests and evidence

Use the existing test stack and browser tools. Add meaningful tests for permission boundaries, state transitions, fixture isolation and important regressions; avoid tests that merely mirror styling implementation.

| Area | Required verification |
| --- | --- |
| Public/internal separation | Visitor cannot retrieve internal article bodies, titles, snippets, bundles or guide definitions through direct requests or search |
| Role/resource boundaries | Representative positive and negative cases across actual permissions; another user’s progress/session is inaccessible |
| Changes of identity/access | Logout/account switching clears private client state; revoked access fails on subsequent protected requests and private caches do not leak |
| Help UI | Open, close, search, clear, no results, direct link, refresh, support link and route changes |
| Walkthroughs | Start, step, pause/exit, restart, missing target, changed route, viewport change, stale version and expired session |
| Unsaved work | Opening help or selecting a guide cannot silently discard or overwrite live form values |
| Example filling | Practice-only, editable, validation-aware, non-submitting and safe on repeat use |
| Simulation isolation | No live mutation client/integration calls; no actual stock, booking, payment, messaging or permission changes |
| Full training, if selected | Production rejects training credentials/IDs; jobs/webhooks/storage and outbound paths are isolated; reset is owner/session-scoped |
| Accessibility | Keyboard flow, focus, announcements, reduced motion, zoom/reflow and relevant manual assistive checks |
| Responsive behaviour | Representative widths, mobile scrolling/keyboard where testable, no blocked controls or overflowing overlays |
| AI, if selected | Restricted retrieval, cross-role cache tests, unsupported claims, prompt injection, malicious links/markup, timeout, rate limit and spend fallback |
| Regression | Existing relevant type/lint/build/tests and representative login, search, dashboard and transaction journeys |

Use synthetic fixtures and approved test environments. Do not conduct actual customer payments or operational submissions to prove a training feature works. Do not record real secrets in evidence.

Include explicit attack cases such as: a customer claiming to be admin; a modified guide ID; a changed progress owner ID; a role change during a session; a malicious instruction embedded in article content; a request for another customer’s order; and a practice reset pointed at a live-looking ID. Assert system behaviour, not merely that the model replies politely.

## 28. Acceptance criteria and definition of done

The selected milestone is complete only when all applicable criteria have evidence:

- **AC-01:** Relevant roles can find useful help for verified tasks without seeing restricted content.
- **AC-02:** Help is optional, replayable and does not block ordinary site use.
- **AC-03:** Answers and guides match actual routes, permissions, features and approved policies.
- **AC-04:** The core works without an AI provider.
- **AC-05:** Guides manage missing targets, responsive changes and session/permission changes safely.
- **AC-06:** Practice is unmistakably labelled and its data remains separate from live work.
- **AC-07:** Example filling cannot silently overwrite or submit a live form.
- **AC-08:** Practice produces no real operational or external side effects.
- **AC-09:** Protected operations are enforced on the server, including direct requests.
- **AC-10:** Relevant accessibility, responsive and regression checks pass, with untested areas named.
- **AC-11:** Content ownership, versioning and updates are documented.
- **AC-12:** Optional AI cites eligible sources, stays within its limited scope and degrades to deterministic help.
- **AC-13:** Rollout, disablement and rollback are documented for the implemented phase.
- **AC-14:** Remaining business decisions, deferred capabilities and known limitations are explicit.

Mark optional-phase criteria as not applicable with a reason; do not claim they passed. A compiling chatbot panel does not meet this definition by itself.

## 29. Maintenance and measurement

Maintain help alongside the features it documents. When changing a route, field, status, permission or workflow, check affected articles, tutorial anchors, fixtures and tests. Retire obsolete guides and invalidate stale indexes/caches when applicable.

Assign a real content reviewer through existing project responsibilities. Keep unresolved policy questions out of published procedural promises. Add a lightweight review checklist to the appropriate existing developer workflow rather than duplicating project governance.

Measure usefulness with minimal, proportionate events: guide started/completed/dismissed, search with no result, helpfulness feedback and scenario recovery. Define denominators before reporting completion rates. Distinguish resumed sessions from new attempts and exclude test traffic.

Evaluate task success, repeated support questions and observed mistakes with suitable baselines. Do not treat message count as product success or promise a specific support-cost reduction without evidence. Individual staff training reporting is a separate product decision, not a default analytics by-product.

## 30. Expected repository outputs

Follow existing documentation locations; the following paths are suggestions:

- docs/help-learn/IMPLEMENTATION_BRIEF.md — this brief, adapted only with clearly recorded repository findings.
- docs/help-learn/CAPABILITY_MAP.md — actual roles, routes, permissions and supported features.
- docs/help-learn/CONTENT_REGISTER.md — articles/guides/scenarios, sources, versions and review ownership.
- docs/help-learn/IMPLEMENTATION_STATUS.md — milestone status, evidence, deferred work and next action.
- docs/help-learn/OPERATIONS.md — configuration, content updates, rollout, disablement, privacy and troubleshooting.
- Relevant frontend/backend implementation, fixtures and tests, located according to existing conventions.

Reuse equivalent files if they already exist. Add only a concise scoped reference to applicable AGENTS.md if appropriate; do not replace it or paste the entire specification into every instruction file. AGENTS.md should require maintaining relevant help when changing supported workflows, not force unrelated future tasks to build this feature.

For PLAN ONLY, produce the planning documents and backlog without runtime code changes or dependency installations. Mark unverified implementation assumptions clearly. For BUILD NOW, maintain those documents as the code evolves.

## 31. Decisions that may genuinely need input

Proceed with routine implementation choices using existing conventions. Do not stop for approval on ordinary reversible layout or component decisions.

Potential unresolved decisions include: who approves policy content; verified support contacts; whether staff training is mandatory; whether managers may view individual completion; retention of AI conversations; external AI-provider selection and budget; and whether a full isolated training backend is required now.

Use safe defaults where a decision is not needed for the selected milestone: no mandatory training, no manager completion dashboard, no raw transcript retention, no AI provider, no live action tools, and local simulation rather than a new full backend. Document the default; do not turn every open question into a blocker.

If an essential business decision cannot be inferred, finish independent work and ask one focused question with the concrete dependent result explained.

## 32. Reporting expectations for Codex

Provide concise progress updates during sustained work. Report findings and decisions, not a stream of file edits.

At each milestone checkpoint, state:

1. What was implemented or prepared.
2. Which roles, routes and scenarios are covered.
3. Which tests and rendered checks actually ran and their results.
4. Whether any selected criteria remain incomplete.
5. Known limitations, blocked dependencies and the next concrete step.

Do not claim a browser audit, successful test, safe integration boundary or complete role coverage without evidence. Do not continue repainting working UI after the selected milestone is complete. Leave a clear resume checkpoint.

## 33. Ready-to-use Codex prompt: BUILD NOW

Copy the text below and attach this file, or place it in the repository and reference its actual path.

```text
Implement Allied AutoTech’s Help, Learn & Practice system using the attached Allied_AutoTech_Help_Learn_Practice_Codex_Brief.md as the detailed specification.

EXECUTION MODE: BUILD NOW.
DEFAULT SCOPE: Phases 0–3: repository discovery, role-aware deterministic help, guided workflows and clearly isolated practice simulations. Do not add generative AI, live account lookup tools, production action tools or a new full training backend unless separately required by the selected scope and existing infrastructure.

Read the entire brief, applicable AGENTS.md files and current repository documentation before editing. Inspect the actual framework, routes, components, APIs, permissions, feature flags and business-policy records. Preserve unrelated changes. Treat the brief’s role/topic tables and route examples as proposed requirements to reconcile with the actual implementation, not permission to invent features or expand access.

Create or update the capability map and implementation register, then implement a coherent first milestone immediately. Do not stop after a plan when authorised implementation is feasible. Continue through the selected milestones in verified increments; maintain a clear checkpoint if a real external dependency blocks further work.

Use the existing visual system. Provide accessible Help & Learn entry points, eligible published help content, contextual suggestions, useful search, written guide fallbacks and honest support links. Cover every implemented role with appropriate learning content; reuse common guides for shared capabilities.

Build walkthroughs against stable targets and actual completion events. Support dismissal, replay, route changes, permission changes and missing targets. Preserve unsaved work. Never auto-submit real operational actions to complete a guide.

Implement sample filling only in unmistakably labelled practice surfaces. Prefer deterministic synthetic fixtures and bounded local simulations where adequate. Prove that practice cannot call live mutation clients, send messages, initiate payments, reserve capacity, change stock, alter access or contaminate live reports. Do not use an isDemo flag in production records as the isolation mechanism.

Use current approved business policies. Preserve collection-only launch fulfilment and enquiry/inspection vehicle workflows where current records confirm them. Never invent delivery, payment, response-time, compatibility or appointment guarantees.

Run meaningful permission, isolation, state-transition, accessibility, responsive and regression checks appropriate to each milestone. Inspect rendered UI with available browser tools. Report unavailable test coverage explicitly. Do not deploy to production or conduct real operational transactions merely because this implementation prompt says BUILD NOW.

Keep help content and guides versioned and maintainable. Record content sources, review responsibilities, configuration, rollback and deferred capabilities. Update applicable existing developer guidance with a concise requirement to maintain help when its related workflows change.

At the end, report implemented scope, role coverage, checks actually run, remaining gaps and the next checkpoint. Do the work rather than returning only recommendations or a generic chatbot mockup.
```

## 34. Ready-to-use Codex prompt: SAVE FOR LATER

```text
Prepare Allied AutoTech’s Help, Learn & Practice system for future implementation using the attached Allied_AutoTech_Help_Learn_Practice_Codex_Brief.md.

EXECUTION MODE: PLAN ONLY / SAVE FOR LATER.

Read the complete brief, applicable AGENTS.md files and available repository documentation. Inspect the actual routes, features, roles, permissions, integration boundaries, test setup and relevant business decisions.

Save the full brief in the repository’s established documentation location. Create or update a repository-grounded capability map, content/scenario register, phased implementation backlog, acceptance criteria, isolation design, unresolved business decisions and an implementation-status file containing the exact next action.

Distinguish verified implementation facts from proposals. Cover all actual roles without granting new privileges. Specify deterministic help and guides first, safe practice simulations next, and optional grounded AI later. Include the safeguards, tests, feature flags and content-maintenance responsibilities from the brief.

Do not modify application runtime behaviour, add dependencies, execute database migrations, seed data, provision external services, call AI providers, deploy, or create a scheduled automation. This task authorises repository preparation and documentation only.

Preserve unrelated files and instructions. Add a concise reference to the appropriate existing project guidance if useful, clearly marking the feature as deferred so future unrelated tasks do not activate it accidentally.

Finish with the documentation paths, the agreed default scope, outstanding decisions and a copyable command/prompt for resuming implementation later. Do not claim the system is implemented.
```

## 35. Ready-to-use Codex prompt: RESUME LATER

```text
Resume Allied AutoTech’s Help, Learn & Practice implementation from its saved brief and implementation-status register.

Read current AGENTS.md instructions, the full saved specification, prior milestone evidence and current code. Revalidate routes, permissions, business policies and dependencies because they may have changed since the plan was written.

Continue the next incomplete milestone within Phases 0–3 unless I specify another phase. Preserve completed verified work. Do not add AI or live action tools as an incidental extension.

Implement, test and inspect the next coherent batch, updating the capability/content registers and checkpoint. Maintain the practice/live boundary and all existing security and business controls. Follow the repository’s actual deployment instructions and the publication scope I have authorised.

Report concrete changes, actual verification, remaining limitations and the next step. Do not restart from scratch or return only a fresh plan when implementation is feasible.
```

## 36. Ready-to-use Codex prompt: ADD GROUNDED AI LATER

```text
Add the optional grounded conversational-help layer to Allied AutoTech’s existing Help & Learn system, following Phase 4 and all applicable requirements of the saved Help, Learn & Practice brief.

First verify that deterministic articles, guides, permission filtering and practice isolation are working. If a prerequisite is broken, fix it before connecting a model. Inspect current official provider documentation and existing application conventions; do not assume an API, model name, data policy or price is current.

The AI may answer from eligible approved documentation and suggest validated article, navigation or guide actions. It may not mutate live records, perform account administration, initiate payments, send messages or execute arbitrary code/URLs. A live account lookup is a separate scope and is excluded here.

Enforce source eligibility before retrieval reaches the model. Protect private snippets, citations, caches and client state across roles/accounts. Treat model output and retrieved content as untrusted. Validate structured suggestions against an allowlisted registry and current server-side permissions. Render output safely.

Keep credentials server-side, set usage/time/concurrency/spend limits and provide a kill switch. Preserve deterministic search and guides when AI is disabled or fails. Document the data sent to the provider and verify applicable data handling; do not retain raw conversations by default.

Test cross-role leakage, prompt injection, fabricated policies/transaction claims, unsafe output, account switching, revocation, timeouts and provider unavailability. Report actual results and remaining dependencies. Do not publish or create live operational side effects without separate applicable authorisation.
```

## 37. Reference guidance

These references support selected design and security requirements; they do not replace repository discovery or a complete accessibility/security review. Check applicable current documentation during implementation. Reference review date: 24 October 2026.

- [Nielsen Norman Group: Onboarding Tutorials vs. Contextual Help](https://www.nngroup.com/articles/onboarding-tutorials/) — contextual, dismissible and revisitable guidance.
- [W3C: Understanding Consistent Help](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help) — discoverability and consistent placement of repeated help mechanisms.
- [W3C WAI-ARIA: Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — modal interaction and focus behaviour; use only when the UI is genuinely modal.
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — server-enforced, least-privilege access checks.
- [OWASP: LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) — treat untrusted inputs and retrieved content as potential instructions; enforce boundaries outside the model.
- [OWASP: LLM06 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) — minimise available tools, permissions and autonomy.

## 38. Governing goal

Make Allied AutoTech easier to learn without making it harder to use. Help each person understand their authorised tasks, practise safely and recognise what the system has actually done. Keep live business operations, user control and trustworthy information intact throughout.
