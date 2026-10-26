# Versioned content and scenario register

Source: backend/src/modules/learning/learning.content.ts. Article presentation is
version 2 after the Allie refinement; the original table below records the initial
version-1 inventory. Current additions and changed guide/scenario versions follow.
Reviewed against repository behaviour on 26 October 2026. Published status in source
means eligible for filtering when explicitly enabled; this is not a production
publication. Feature flags remain off in committed configuration examples.

| Article                 | Eligibility gate | Version / review | Actual destination         | Authority                                                                    |
| ----------------------- | ---------------- | ---------------- | -------------------------- | ---------------------------------------------------------------------------- |
| parts-fitment           | public           | 1 / 2026-10-26   | /parts                     | Parts discovery, fitment evidence and approved collection-only launch        |
| vehicle-enquiry         | public           | 1 / 2026-10-26   | /vehicles                  | Vehicle discovery and listing-less enquiry contracts                         |
| service-request         | public           | 1 / 2026-10-26   | /services                  | Public launch mode and Services page                                         |
| security-basics         | public           | 1 / 2026-10-26   | /forgot-password           | Identity recovery and published account security guidance                    |
| no-live-lookup          | public           | 1 / 2026-10-26   | /help                      | Launch restrictions and existing status contracts                            |
| own-conversation        | customer         | 1 / 2026-10-26   | /dashboard/support         | Customer support ownership, drafts and review-before-send                    |
| work-access             | work             | 1 / 2026-10-26   | /admin                     | Workforce snapshot, scope policy and dashboard navigation                    |
| care-triage             | care             | 1 / 2026-10-26   | /admin/workforce/enquiries | Managed care scope, public/internal separation and delivery acknowledgements |
| sales-enquiries         | sales            | 1 / 2026-10-26   | /admin/workforce/enquiries | SALES_ENQUIRIES and ENQUIRIES_ASSIGN contracts                               |
| finance-meaning         | finance          | 1 / 2026-10-26   | /admin/workforce/finance   | Workforce finance projection and permission boundary                         |
| assigned-findings       | jobs             | 1 / 2026-10-26   | /admin/workforce/jobs      | JOBS_READ/JOBS_UPDATE, assigned scope and work review                        |
| job-assignment          | assign           | 1 / 2026-10-26   | /admin/workforce/jobs      | JOBS_ASSIGN and QUALITY_APPROVE routes                                       |
| mixed-queues            | operations       | 1 / 2026-10-26   | /admin                     | OPERATIONS template and effective assignment union                           |
| oversight-scope         | oversight        | 1 / 2026-10-26   | /admin                     | CEO_MD position and permission-filtered overview                             |
| customer-account-review | admin            | 1 / 2026-10-26   | /admin/customers           | Customer account lock, session enforcement and audit contract                |
| access-review           | access           | 1 / 2026-10-26   | /admin/workforce/access    | Team access security and delegation policy                                   |
| privileged-recovery     | owner            | 1 / 2026-10-26   | /admin/security            | Existing identity/governance safeguards                                      |

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
AI, mandatory training, manager reports, transcripts and training-domain operations
are deferred. Missing policies are business decisions, not simulated code features.
