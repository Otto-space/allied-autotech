# Versioned content and scenario register

## 1 November presentation refinement checkpoint

Ordinary Help/Learn article bodies omit maintenance source/version/review metadata.
The Privacy Notice remains a human-readable destination link. Catalogue responses
retain their compatible source field as the article title, while original provenance
remains in the versioned server corpus. Article eligibility, permission checks,
guide targets, scenario state and feature flags are unchanged. Public projection
unit evidence is recorded in `docs/MOBILE_FITMENT_SIMPLIFICATION_20261101.md`;
rendered and release acceptance are still pending for this batch.

Source: backend/src/modules/learning/learning.content.ts. Versions and review dates
below reflect current source definitions, including W9-W13 corrections. Published
status in source means eligible for filtering when explicitly enabled; it does not
mean a production publication. Feature flags remain off in committed examples.

| Article                 | Eligibility gate     | Version / review | Actual destination           | Authority                                                                                                                                   |
| ----------------------- | -------------------- | ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| privacy-and-allie       | public               | 1 / 2026-11-01   | /privacy                     | Published Privacy notice v2, actual encrypted Allie history lifecycle and reviewed customer handoff                                         |
| financial-aftercare     | financial-aftercare  | 3 / 2026-10-27   | /admin/workforce/aftercare   | Scoped financial aftercare adapter, shared OrderAftercareService fee/inspection/audit core and customerAftercareView review-note projection |
| booking-confirmation    | booking-confirmation | 3 / 2026-10-27   | /admin/workforce/bookings    | Scoped confirmation adapter, shared ServiceOperations transition/capacity/schedule/reminders and reviewed booking form                      |
| refund-work             | refunds              | 3 / 2026-10-27   | /admin/refunds               | ManualRefundsService scope/current/check, PaymentsService refund decisions and StaffRefunds review/recovery                                 |
| dispute-work            | disputes             | 3 / 2026-10-27   | /admin/payment-disputes/work | DisputesRouter authorized/current/assignment and WorkDisputeHandling review/recovery                                                        |
| privacy-work            | privacy              | 3 / 2026-10-27   | /admin/privacy               | PrivacyRouter assertCapability, hold protection and WorkPrivacy review/recovery                                                             |
| financial-policy-work   | financial-policy     | 3 / 2026-10-27   | /admin/finance-policy        | readFinancePolicy and publishPolicy FINANCE branch, FinancePolicy current/version/review                                                    |
| parts-fitment           | public               | 4 / 2026-11-01   | /parts                       | Parts discovery, fitment evidence and approved collection-only launch                                                                       |
| vehicle-enquiry         | public               | 2 / 2026-10-26   | /vehicles                    | Vehicle discovery and listing-less enquiry contracts                                                                                        |
| service-request         | public               | 13 / 2026-11-01  | /services                    | Public launch mode and Services page                                                                                                        |
| security-basics         | public               | 2 / 2026-10-26   | /forgot-password             | Identity recovery and published account security guidance                                                                                   |
| no-live-lookup          | public               | 2 / 2026-10-26   | /help                        | Launch restrictions and existing status contracts                                                                                           |
| own-conversation        | customer             | 4 / 2026-10-27   | /dashboard/support           | Customer support ownership, drafts and review-before-send                                                                                   |
| work-access             | work                 | 5 / 2026-10-27   | /admin                       | Current workforce scope, registered navigation and access-change recovery                                                                   |
| care-triage             | care                 | 3 / 2026-10-27   | /admin/workforce/enquiries   | Managed care scope, public/internal separation and delivery acknowledgements                                                                |
| sales-enquiries         | sales                | 3 / 2026-10-27   | /admin/workforce/enquiries   | SALES_ENQUIRIES and ENQUIRIES_ASSIGN contracts                                                                                              |
| product-photos          | admin                | 3 / 2026-10-27   | /admin                       | ProductExtrasEditor, ProductImageForm and administrator-only product-media routes                                                           |
| finance-meaning         | finance              | 3 / 2026-10-27   | /admin/workforce/finance     | Workforce finance projection and permission boundary                                                                                        |
| assigned-findings       | jobs                 | 3 / 2026-10-27   | /admin/workforce/jobs        | JOBS_READ/JOBS_UPDATE, assigned scope and work review                                                                                       |
| job-assignment          | assign               | 3 / 2026-10-27   | /admin/workforce/jobs        | JOBS_ASSIGN and QUALITY_APPROVE routes                                                                                                      |
| mixed-queues            | operations           | 3 / 2026-10-27   | /admin                       | OPERATIONS template and effective assignment union                                                                                          |
| oversight-scope         | oversight            | 3 / 2026-10-27   | /admin                       | CEO_MD position and permission-filtered overview                                                                                            |
| customer-account-review | admin                | 3 / 2026-10-27   | /admin/customers             | Customer account lock, session enforcement and audit contract                                                                               |
| access-review           | access               | 4 / 2026-10-27   | /admin/workforce/access      | Team access security, pinned delegation and reviewed responsibility impact                                                                  |
| privileged-recovery     | owner                | 3 / 2026-10-27   | /admin/security              | Existing identity/governance safeguards                                                                                                     |

## Guides

- parts-find v1: /parts; parts-search (input), parts-results (read).
- own-request v1: /dashboard/support; support-start (click), support-subject (input), support-subject (read).
- care-queue v1: /admin/workforce/enquiries; care-search (input), care-results (read).

## Local scenarios

The Corolla exercise includes an explicit local catalogue search and three public
fictional part fixtures with inspectable compatible, incompatible and unconfirmed
evidence. Changing a vehicle/search field clears its old results; completion
requires searching the sample catalogue before reviewing the next step. These
fixtures never represent real stock or recommendations.

- corolla-fitment v1: public; fitment; linked article parts-fitment.
- enquiry-draft v1: customer; draft; linked article own-conversation.
- care-triage v1: care; decision; linked article care-triage.
- sales-evidence v1: sales; decision; linked article sales-enquiries.
- payment-discrepancy v1: finance; decision; linked article finance-meaning.
- job-handover v1: jobs; draft; linked article assigned-findings.
- assignment-review v1: assign; decision; linked article job-assignment.
- mixed-queue v1: operations; decision; linked article mixed-queues.
- oversight-review v1: oversight; decision; linked article oversight-scope.
- access-review v1: access; decision; linked article access-review.
- owner-recovery v1: owner; decision; linked article privileged-recovery.

## Review and maintenance responsibility

Allie refinement (26 October 2026): `care-triage` now presents "Handle a Customer
Care request" and the owner procedure has a plain-language title; IDs and access
rules remain unchanged. Added `product-photos` v2, legacy administrator gate,
the existing `/admin` work entry, then Products, based on ProductExtrasEditor/ProductImageForm and the existing
administrator-only media API. No product editing permission is created. Product
photo/image synonyms work only where this help is eligible.

`parts-find` v2 refreshes the instruction and reconciles interaction evidence across
same-page target remounts/access checks. The other two guides remain v1. All
decision-helper scenarios are now v2 with scenario-specific feedback; `care-triage`
v2 is a bounded editable sample public-reply draft. Fitment, customer enquiry and
job handover scenarios retain their v1 field contracts. Choice-only exercises use
an honest hint, never a pretend field insertion. No text-quality assessment or
operational competence is inferred from required-length/choice validation.

The same eligible model serves hub search and Allie. Search covers articles,
guides and scenarios independently, includes synonyms and eligible parent context,
and never retrieves a private item merely because a query mentions its title.
See ALLIE_IMPLEMENTATION.md for current verification and publication status.

The developer changing a covered workflow must recheck its source, permission gate,
links, target anchors, validation and fixtures; increment the affected definition
version when meaning, steps or prerequisites change. Re-run role/direct-link and
browser tests. The owner or existing authorised policy owner reviews business
claims before publication; this task creates no new content-manager permission.
The source-controlled register and review date are the content administration
workflow for this milestone. No CMS or user-written help publication endpoint exists.

Global legacy Admin/owner care content points to /admin/support; managed care
content follows its actual enquiry/complaint capabilities. A managed ADMIN does
not gain the legacy customer-account procedure. CEO_MD receives scope guidance,
not finance powers. Generic staff get access/security guidance without invented
responsibilities. Full operational scope remains enforced by the domain APIs.

Delivery/refund/warranty/escalation guarantees absent from approved records remain
absent here. Future paid-customer transaction tutorials depend on launch policy;
The former optional-AI deferral is superseded by Revision 4: W6-W9 implement and
evaluate the real provider, owned transient state and conversation UI locally.
Default AI remains off; new-source and hosted acceptance are separate gates.
Mandatory training, manager reports and training-domain operations remain outside
the implemented milestone. Missing policies are business decisions, not simulated
code features.

## W11 independent-duty guidance (27 October 2026)

`work-access` v5 explains independent owner grants without widening branch scopes.
Four new backend-only topics use their actual explicit grants: `refund-work`,
`dispute-work`, `privacy-work` and `financial-policy-work`. They describe the current
stage/ownership, independent approval, review and uncertain-outcome safeguards in
the existing workspaces. They supply ordinary navigation and written guidance;
no walkthrough or practice mode is invented for them. Native eligibility/removal
and retrieval tests are included. W9's completed provider allowance is exhausted;
these new source passages have no fresh real-provider quality evaluation.
Business publication approval and full per-route learning acceptance remain open.

## W14C operational Care composition (27 October 2026)

care-triage v2 keeps public reply and internal assignment reasons distinct. Managed
view-only Care gets queue/history/contact and the read-only walkthrough; public-reply
practice requires current view/reply on the same branch. New duty names require v2.
Native direct-scenario and retrieval tests pass, with no operational records in the
provider corpus. This new passage has no fresh real-provider evaluation: W9 allowance
is exhausted. See WORKFORCE_CARE_CASES_W14C.md; full route acceptance stays open.

## W15 reviewed human handoff (27 October 2026)

own-conversation v5 describes the verified customer review/edit/selected-sharing,
queued persistence and recovery flow. Existing guide/practice IDs remain stable;
no new walkthrough is claimed for the handoff form. Customer ownership is independent
of workforce Care duties, and neither public nor work help gains customer-history
access. New source passages have unit/native eligibility checks and rendered/native
handoff evidence; no fresh real-provider evaluation is authorised under the exhausted
W9 allowance. See REVIEWED_HANDOFF_W15.md. Shared staffed transport and all106 full
route completion decisions remain open.

## Visual audit candidate, 27 October 2026

Added public `home-next-step`, version 1, reviewed 2026-10-27 against existing Home routes, published branch availability and the approved enquiries-only launch. Its homepage context describes Services, Shop and Vehicles without claiming to read records, confirm appointments or reserve vehicles. Destination: /services; contextual links preserve /parts and /vehicles. Eligibility remains the existing public gate; private content remains server-filtered. No flags or permission rules changed. Existing article versions above are historical; source remains authoritative.

### 1 November 2026 — service-group ordering

`owner-service-groups` v2 (admin gate, reviewed 2026-11-01) explains Display order,
alphabetical ties, explicit review/save and preservation of existing order during
owner imports. Destination remains /admin/service-categories; permissions and guide
targets are unchanged. New groups use the owner's supplied sequence. This is source
implementation pending the additive migration and verified release; feature flags
are unchanged. Unit acceptance covers version, admin gate and the actual workflow.

Service-group image authoring checkpoint (1 November 2026): owner-service-groups v3
adds the actual Manage group image workflow, explicit review and active/inactive
visibility. Admin eligibility and guide targets are unchanged. Implementation is
not yet published; no AI/provider flag changes.

Booking group context checkpoint (1 November 2026): service-request v12 describes
selected-group continuity through sign-in/review and the original group retained
on booking details. Public eligibility and existing launch gates are unchanged.
Source acceptance is pending final rendered checks and release; no feature flag
is activated by this guidance update.

Service enquiry checkpoint (1 November 2026): service-request v13 describes structured main-service references, independent editable messages and unchanged appointment confirmation boundaries. Source only until migration, backend and frontend rollout gates pass. Eligibility and practice permissions are unchanged. See docs/SERVICES_COMMERCE_READINESS_20261101.md.

Parts quotation checkpoint (1 November 2026): parts-fitment v4 documents customer-owned requests, issued revisions, expiry/decline and guarded collection order acceptance. Payment remains separate from compatibility, final availability and collection readiness. Backend issue/acceptance, customer/admin request screens and original-order links are implemented; rollout and provider test-mode acceptance remain unverified. No practice permissions or feature flags were enabled.

Appointment display checkpoint (1 November 2026): customer booking summary distinguishes requested time from confirmed appointment and shows a Nigeria-time upcoming reminder only while status is CONFIRMED and the scheduled time is future. Existing request/reschedule/cancellation semantics, service-request v13 guidance, eligibility and semantic targets remain unchanged; no definition or flag activation is required for this presentation change.

1 November 2026 booking-label maintenance: presentation-only status casing and
progressive reference disclosure use existing booking contracts. service-request v13,
review requirements, semantic guide targets and server eligibility are unchanged;
no feature flag or tutorial permission changed.

Booking-label release checkpoint (1 November 2026): presentation source 36f4c51d
is published on apex/www. Four-width detail and reviewed state transitions passed
with synthetic hosted fixtures. service-request v13, role eligibility, guide targets
and transaction gates remain unchanged. This does not prove real operational acceptance.
