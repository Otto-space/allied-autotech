# Versioned content and scenario register

Source: backend/src/modules/learning/learning.content.ts. Versions and review dates
below reflect current source definitions, including W9-W12 corrections. Published
status in source means eligible for filtering when explicitly enabled; it does not
mean a production publication. Feature flags remain off in committed examples.

| Article                 | Eligibility gate     | Version / review | Actual destination           | Authority                                                                                                              |
| ----------------------- | -------------------- | ---------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| booking-confirmation    | booking-confirmation | 3 / 2026-10-27   | /admin/workforce/bookings    | Scoped confirmation adapter, shared ServiceOperations transition/capacity/schedule/reminders and reviewed booking form |
| refund-work             | refunds              | 3 / 2026-10-27   | /admin/refunds               | ManualRefundsService scope/current/check, PaymentsService refund decisions and StaffRefunds review/recovery            |
| dispute-work            | disputes             | 3 / 2026-10-27   | /admin/payment-disputes/work | DisputesRouter authorized/current/assignment and WorkDisputeHandling review/recovery                                   |
| privacy-work            | privacy              | 3 / 2026-10-27   | /admin/privacy               | PrivacyRouter assertCapability, hold protection and WorkPrivacy review/recovery                                        |
| financial-policy-work   | financial-policy     | 3 / 2026-10-27   | /admin/finance-policy        | readFinancePolicy and publishPolicy FINANCE branch, FinancePolicy current/version/review                               |
| parts-fitment           | public               | 2 / 2026-10-26   | /parts                       | Parts discovery, fitment evidence and approved collection-only launch                                                  |
| vehicle-enquiry         | public               | 2 / 2026-10-26   | /vehicles                    | Vehicle discovery and listing-less enquiry contracts                                                                   |
| service-request         | public               | 2 / 2026-10-26   | /services                    | Public launch mode and Services page                                                                                   |
| security-basics         | public               | 2 / 2026-10-26   | /forgot-password             | Identity recovery and published account security guidance                                                              |
| no-live-lookup          | public               | 2 / 2026-10-26   | /help                        | Launch restrictions and existing status contracts                                                                      |
| own-conversation        | customer             | 4 / 2026-10-27   | /dashboard/support           | Customer support ownership, drafts and review-before-send                                                              |
| work-access             | work                 | 5 / 2026-10-27   | /admin                       | Current workforce scope, registered navigation and access-change recovery                                              |
| care-triage             | care                 | 3 / 2026-10-27   | /admin/workforce/enquiries   | Managed care scope, public/internal separation and delivery acknowledgements                                           |
| sales-enquiries         | sales                | 3 / 2026-10-27   | /admin/workforce/enquiries   | SALES_ENQUIRIES and ENQUIRIES_ASSIGN contracts                                                                         |
| product-photos          | admin                | 3 / 2026-10-27   | /admin                       | ProductExtrasEditor, ProductImageForm and administrator-only product-media routes                                      |
| finance-meaning         | finance              | 3 / 2026-10-27   | /admin/workforce/finance     | Workforce finance projection and permission boundary                                                                   |
| assigned-findings       | jobs                 | 3 / 2026-10-27   | /admin/workforce/jobs        | JOBS_READ/JOBS_UPDATE, assigned scope and work review                                                                  |
| job-assignment          | assign               | 3 / 2026-10-27   | /admin/workforce/jobs        | JOBS_ASSIGN and QUALITY_APPROVE routes                                                                                 |
| mixed-queues            | operations           | 3 / 2026-10-27   | /admin                       | OPERATIONS template and effective assignment union                                                                     |
| oversight-scope         | oversight            | 3 / 2026-10-27   | /admin                       | CEO_MD position and permission-filtered overview                                                                       |
| customer-account-review | admin                | 3 / 2026-10-27   | /admin/customers             | Customer account lock, session enforcement and audit contract                                                          |
| access-review           | access               | 4 / 2026-10-27   | /admin/workforce/access      | Team access security, pinned delegation and reviewed responsibility impact                                             |
| privileged-recovery     | owner                | 3 / 2026-10-27   | /admin/security              | Existing identity/governance safeguards                                                                                |

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
