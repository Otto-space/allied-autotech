# Allied AutoTech — original scope and subsequent extensions

Prepared 13 October 2026 for a scope and fee discussion. Status: discussion draft, not an invoice, approved variation or completion certificate.

## 1. Finding that should lead the meeting

The original NGN 800,000 brief already described a substantial working automotive application: e-commerce, customer and staff dashboards, bookings, vehicle listings, images, payments, analytics, security and backups. It was not a brochure website or a visual mockup.

There is evidence of subsequent technical extensions and more detailed operating workflows. However, a feature introduced later in the code is not automatically an addition to the commercial scope. Several capabilities previously called “backend gaps” actually complete requirements already present in the original brief.

The fair basis for renegotiation is to agree which specific extensions the owner wants, distinguish those from completion of the original work, and acknowledge any original underestimation separately. The earlier suggested NGN 1.5 million total remains a negotiation proposal; this audit does not establish a NGN 700,000 debt or independently price that increase.

## 2. Evidence and limits

- **Original baseline:** [ORIGINAL_CLIENT_BRIEF.md](ORIGINAL_CLIENT_BRIEF.md), supplied by Mike in this conversation as the requirements associated with the original quote. Section numbers below refer to that document.
- **Implementation history:** inspected Git history from initial commit `f0896d8` (30 August 2026) through `5ea8822` (12 October 2026), plus the current uncommitted working tree on 13 October. Existing unrelated work was preserved.
- **Later requests:** this conversation explicitly requests image availability, form persistence across tab changes and reloads, and a private owner/staff hosting stage before public launch, keeping Vercel and requiring approval for every purchase. A request from Mike is not proof that the business owner approved a fee increase.
- **Owner policy evidence:** [owner implementation matrix](backend/docs/owner-implementation-matrix.md) reports inspection of a checklist signed on 22 September 2026 and its attachment. This trace reviewed the matrix, not the original signed PDF. Policy decisions do not establish agreement to extra development charges.
- **Uncertainty:** original quotation date, fee terms, payments received, revision allowance and approval of paid changes remain unknown. Commit dates establish recorded implementation history, not request dates, billable hours or acceptance dates. Some documents record local acceptance earlier than their eventual commit date.
- **Verification:** this was a read-only source/history review followed by creation of these documents. Application tests, live hosting, storage and payment checks were not rerun. “Locally accepted” below means reported by the cited implementation records; it does not mean publicly deployed.

## 3. What was already included

These should not be presented as wholly new paid features merely because they took substantial work.

| Original promise | Original section | Treatment in the revised discussion |
| --- | --- | --- |
| Home, services, About, customer care, contact, WhatsApp and Maps | 2–3, 7, 9 | Original scope; provider configuration may remain outstanding. |
| Booking forms, quotations, booking management and status/history | 2–5 | Original scope; particular operating rules may be extensions. |
| Product catalogue, compatibility, stock, cart, purchase, search, categories, filters and sorting | 3–6 | Original scope. Server-side implementation is not a new product feature by itself. |
| Marketplace with multiple photos, enquiries, inspection scheduling and staff listing management | 3, 5 | Original scope; online vehicle reservation/transaction processing is a separate candidate extension. |
| Customer accounts, profile editing, saved vehicles/products, orders and invoice viewing | 4 | Original scope. |
| Customer management, image uploads, inventory, promotions, testimonials and analytics | 5, 13–14 | Original scope; a missing implementation does not make the requirement new. |
| Product payments, confirmations and configurable Nigerian gateway integration | 6 | Original scope; do not bill basic payment safety as an optional extra. |
| Premium responsive design, SEO, performance, security, database and backup capability | 8, 10–12, 15–16 | Original scope and quality obligations. |

The first substantial database commit, `dfccfc4` (1 September), already included customer, booking, product, inventory, order, payment, listing, invoice, review, enquiry and complaint models. This reinforces the broad early intent, but the supplied brief is the more useful commercial baseline.

## 4. Specific extensions worth discussing

“Candidate” means the wording is absent or materially less specific in the original brief. It does not establish that the owner requested it or accepted an additional price.

### E1. Online vehicle transactions and reservations — strong candidate

**Original:** showcase vehicles, receive enquiries, schedule inspections and let staff mark vehicles sold (section 3).

**Extension:** negotiation/transaction history, customer reservation commitment, exclusive allocation to one buyer, reservation expiry and handover workflows. Approved-term publication and acceptance were subsequently added: the customer accepts a specific immutable agreement version, rather than an arbitrary “terms accepted” label.

**Business value:** the business can manage a buyer's commitment and retain the exact terms accepted, beyond receiving a sales lead.

**Evidence:** [vehicle sales](backend/docs/vehicles-and-sales.md); [reservation agreements](backend/docs/vehicle-reservation-terms.md). Domain foundations appear in `0584d16` (6 September); agreement backend `d9b2112` (11 October), frontend `7cd6bce` (12 October). Do not claim the whole reservation feature first appeared in October.

**Boundary/status:** local implementation evidence exists. Exact agreement wording remains unapproved; live deposit/hold rules are separately unresolved. Do not claim live reservations or payments are ready. Group these connected capabilities as one commercial package rather than charging repeatedly for the same reservation workflow.

### E2. Form drafts and recovery after navigation/reload — explicit later request

**Original:** working forms and error handling, without an explicit persistent-draft requirement (sections 3, 16).

**Extension:** Mike subsequently asked for entered form data to survive tab changes and reloads across customer and administrative forms. Shared draft handling and background-refresh protections were added.

**Business value:** less re-entry when a customer or employee leaves a form temporarily.

**Evidence:** conversation; commit `bc1275e` (6 October); [draft storage](frontend/lib/forms/drafts.ts), [draft component](frontend/app/components/form-drafts.tsx), [browser cases](frontend/tests/e2e/form-draft-submission.spec.ts).

**Boundary/status:** implementation uses browser session storage, scoped to identity/page/form. It is not cross-device syncing or an indefinite cloud autosave service. File inputs and sensitive authentication fields are excluded; agreement consent is deliberately not restored. Fixing accidental loss during ordinary interaction may overlap expected form quality; describe persistent drafts as the enhancement, not all form correctness as new work.

### E3. Downloadable invoice and verified-payment receipt PDFs — strong candidate with overlap

**Original:** view invoices and receive payment/order confirmation (sections 4, 6).

**Extension:** itemized private document projections, downloadable invoice PDFs, verified-payment receipt PDFs, sharing controls and immutable invoice snapshots.

**Business value:** customers can retain and share a financial document instead of only viewing an account summary.

**Evidence:** [invoice acceptance](frontend/docs/page-quality/invoice-detail.md) explicitly describes the earlier summary-only page and absent PDF routes; backend commit `a122d6c` (11 October), frontend work in `d549d61` (11 October). The document records local acceptance on 8 October.

**Boundary/status:** local acceptance recorded; deployed/accounting checks remain. Basic invoice viewing and payment confirmation stay in the original scope. Confirm whether downloadable invoices were already understood to be included before quoting this extension.

### E4. Detailed returns, refunds and payment-dispute operations — candidate requiring confirmation

**Original:** complete e-commerce, order/complaint management and secure payments (sections 3, 5–6, 11).

**Extension:** explicit return/inspection stages, partial aftercare requests, a four-person manual-refund process, private bank evidence, independent transfer checking, banking-calendar deadlines and assigned primary/backup dispute handling.

**Business value:** staff have an accountable process for exceptional cases after a sale.

**Evidence:** [owner implementation matrix](backend/docs/owner-implementation-matrix.md), especially Q4, Q6 and Q9; [customer aftercare](frontend/docs/page-quality/customer-aftercare.md); [Paystack dispute contract](backend/docs/paystack-dispute-contract.md). Later customer aftercare UI/recovery appears in `afbe5c2` and `57e50d6` (12 October).

**Boundary/status:** there is substantial overlap with a complete shop and secure payments. Only genuinely additional operational requirements are negotiation candidates. Standard payment correctness, duplicate-payment prevention and repair of unsafe processing are not optional paid extras. Staff mapping, some fee/deadline rules and deployed provider verification remain open.

### E5. Workshop capacity, reminders and complaint response rules — candidate requiring confirmation

**Original:** select a preferred booking time, manage bookings, track status and handle complaints (sections 3–5).

**Extension:** branch capacity calendars, explicit staff/resource review before confirmation, schedule-linked attendance/cancellation reminders, business-hour complaint deadlines, escalation and acknowledgement separate from resolution.

**Business value:** booking requests can be coordinated against operating capacity, and outstanding complaints have assigned follow-up rules.

**Evidence:** Q5, Q6 booking and Q11 in the [owner implementation matrix](backend/docs/owner-implementation-matrix.md); [remaining decisions](backend/docs/owner-decision-checklist.md).

**Boundary/status:** ordinary booking management remains included. More detailed operating rules need a clear owner requirement; engineering choices needed to make ordinary bookings reliable are not automatically extras. Real capacity, calendars and escalation definitions remain outstanding.

### E6. Customer-owned garage galleries and profile photos — narrower candidate

**Original:** profile updates, vehicle details on bookings, saved marketplace vehicles, and administrator image uploads (sections 3–5).

**Extension:** private photographs attached to a customer's own garage vehicles, ordered galleries/cover selection and private customer profile-photo replacement/removal.

**Business value:** customers can maintain a visual record of their own vehicles and personalise their account.

**Evidence:** BG-02 and BG-03 in the [historical gap inventory](frontend/docs/redesign-backend-gaps.md), [implementation handoff](backend/docs/backend-gaps-handoff.md), commits `0244120` and `7b629ca` (30 September).

**Boundary/status:** locally implemented; real storage verification remains outstanding. A profile photo could reasonably be interpreted as part of “update their profile.” Private garage galleries are a clearer extension. Do not confuse them with the marketplace photographs already promised.

### E7. Customer privacy-request review and retention controls — candidate, partly unfinished

**Original:** secure customer-information handling and database security (section 11).

**Extension:** customer deletion/anonymization requests, administrative review, record-specific holds and policy-controlled retention workflows.

**Business value:** requests about customer records can be tracked and reviewed consistently.

**Evidence:** Q13 in the [owner implementation matrix](backend/docs/owner-implementation-matrix.md); [remaining work](BACKEND_REMAINING_WORK.md), privacy execution section.

**Boundary/status:** intake/review exists; actual deletion/anonymization execution is disabled and still requires approved policies and implementation. Do not sell a complete automated deletion service as delivered, or claim that baseline privacy/security can be excluded from the original fee.

## 5. Later work that is not automatically expanded scope

| Recorded later work | Fair interpretation against the original brief |
| --- | --- |
| BG-01 customer directory, commit `a9adc8a` (30 September) | Implements the already promised “manage customers.” Special related-record aggregation may be an enhancement, but the directory itself is not clearly extra. |
| BG-04 service images, `cd66672` | Explicitly promised for each service and in admin uploads. Original-scope completion. |
| BG-05 direct product uploads, `6158834` | Product images and administrator uploads were promised. Replacing a URL-only limitation is not strong evidence for an extra charge. |
| BG-06 stock-image editing/removal, `ee416b5` | Multiple vehicle photos plus staff add/edit/remove management were promised. Normal image management is reasonably included. |
| Product discovery/search/filter/sort APIs in `a122d6c` | Explicitly required in section 3. Server-side searching is an implementation approach. Vehicle/service discovery may add detail, but do not package all search as new. |
| Expanded 7 October design brief and 8 October authentication follow-up | [Expanded brief](frontend/docs/page-quality/expanded-brief.md) records real additional acceptance work, including narrower responsive widths and page-by-page reassessment. Premium mobile design was already promised. Only specific redesign requests beyond an agreed revision allowance support a variation; that allowance is unknown. |
| Stronger retry handling, profile conflict recovery, payment ownership and quotation-expiry repairs | See `ecb3040`, `ba80e5a`, `ebd62f1`, `9d6ff36` and the remaining-work records. Separate optional durable recovery from defect repair. Do not charge twice to make an agreed action correct and secure. |
| New administrator service/category/product reads and controls in the working tree | Detailed implementation is recorded in [service catalogue](backend/docs/admin-service-catalogue.md), [categories](backend/docs/admin-service-categories.md) and [product catalogue](backend/docs/admin-product-catalogue.md). Broad administration was promised. Product frontend acceptance remains pending at this snapshot. |
| Private-testing gate, DigitalOcean preparation, backup safeguards and Vercel release checks | Mike explicitly requested a private testing stage and the hosting plan. See [hosting preparation](backend/docs/hosting-approval-plan.md). A separately operated staging environment may be additional; deployment readiness, basic security and backup capability substantially overlap the original promise. Subscriptions and ongoing operations need their own agreement. |

The six BG gaps are evidence of development work, not six automatically billable extras. A higher count of pages, endpoints, migrations or tests is not a substitute for comparing customer requirements.

## 6. A changed requirement that also reduced scope

Original section 6 explicitly requested **service deposits**. The later owner-policy matrix Q5 records bookings without a deposit, and the current meeting brief preserves that rule. This is a change of direction, not an additional feature to charge for as if both versions remain required.

The original payment-provider wording offered Paystack **or** Flutterwave as examples. Do not present multiple production gateways or Monnify as automatically required. Old commit titles mentioning deposit-backed scheduling or Monnify do not establish current enabled behavior.

Any revised agreement should replace superseded requirements explicitly and avoid charging for removed scope without explaining any separately agreed rework.

## 7. What still needs decisions or verification

The current [owner meeting brief](OWNER_MEETING_BRIEF.md) is the detailed decision worksheet. Relevant outstanding items include approved reservation wording; deposit/hold rules; delivery fees; cancellation/refund definitions; actual staff responsibilities; workshop calendars; accounting/invoice policy; complaint escalation; marketing and retention policy.

Marketing execution and destructive privacy execution remain unfinished/disabled. Hosting, actual storage uploads, provider integrations and the target environment still require their own acceptance. Remaining dashboard audits may expose more work. This document does not certify that every original requirement is delivered.

Private owner/staff testing comes first, with the frontend on Vercel. No purchase, live payment activation, public launch or policy publication is authorized by this report. Mike must approve every purchase.

## 8. Recommended owner conversation

> “Your original brief already included the shop, bookings, dashboards, vehicle listings and the supporting security. I am treating those as the original commitment.
>
> “As we developed the operating details, we also introduced specific extensions, including [choose only the extensions you requested and want to retain]. I have separated those from ordinary fixes and from work that is still awaiting your policies.
>
> “I also underestimated some of the work in the initial quote. I want to be transparent about that rather than label everything as a new feature. Can we agree on a fixed completion list, which extensions we keep now, and a revised fee or phased delivery arrangement?”

Do not say the owner changed everything or originally ordered a simple website. Do not describe the proposed NGN 1.5 million as an approved bill. The difference from NGN 800,000 is NGN 700,000; all payments already received must be credited against any agreed revised total. Hosting subscriptions and ongoing maintenance should be listed separately. This report assigns no invented historical hours or per-feature prices.

## 9. Decision worksheet for the variation

| Candidate | Owner requested/approved it? Evidence or date | Keep now / defer / already included | Agreed fee and acceptance |
| --- | --- | --- | --- |
| E1 vehicle transaction/reservation package | To confirm | To agree | To agree |
| E2 persistent form drafts | Mike's later request; owner commercial approval to confirm | To agree | To agree |
| E3 invoice/receipt PDF downloads and sharing | To confirm | To agree | To agree |
| E4 detailed aftercare/refund/dispute operations | Policy matrix evidence; fee approval to confirm | To agree | To agree |
| E5 advanced workshop and complaint rules | Policy matrix evidence; fee approval to confirm | To agree | To agree |
| E6 private garage gallery/profile photo | Later implementation brief; owner commercial approval to confirm | To agree | To agree |
| E7 privacy-request and execution scope | Policy matrix; execution not complete | To agree | To agree |

Record the final included/excluded features, revised total, payments credited, milestone balance, acceptance criteria, policy dependencies, handover, bug-fix period, maintenance boundary and both parties' approval. Avoid an unlimited promise of “all future work.”

## 10. Compact trace for the PDF appendix

| Date or record | Evidence | What it establishes |
| --- | --- | --- |
| Original brief, supplied 13 October; original quote date unknown | `ORIGINAL_CLIENT_BRIEF.md`, sections 1–16 | Broad original requirements, not an initial brochure-only scope. |
| 1 September | `dfccfc4` | Early schema already anticipated core commerce and operational domains. |
| 6 September | `0584d16` | Domain foundations already included vehicle-sale operations. |
| Checklist signature reported as 22 September; matrix updated 24 September | `backend/docs/owner-implementation-matrix.md` | Detailed business rules and remaining policy ambiguities; not fee approval. |
| 30 September | `a9adc8a`, `0244120`, `7b629ca`, `cd66672`, `6158834`, `ee416b5`, `42653e3` | Six implementation gaps addressed; only some extend the supplied original wording. |
| 6 October commit | `bc1275e` | Shared form drafts and related navigation/reload protections. |
| 7–8 October brief dates | `frontend/docs/page-quality/expanded-brief.md` | Further design/acceptance requirements; author/request provenance reported by the document, not independently verified as business-owner fee approval. |
| 11 October commits | `a122d6c`, `d549d61`, `d9b2112` | Discovery/document extensions and immutable reservation terms. |
| 12 October commits | `7cd6bce`, `afbe5c2`, `57e50d6` | Agreement UI, customer aftercare and durable recovery extensions. |
| 13 October working tree | Hosting plan, database-safety and admin catalogue documents | Current preparation and incremental implementation; uncommitted work is not a signed release or completed cloud rollout. |

Implementation records support a discussion of scope evolution. Only an agreed comparison with the original promise and the owner's requested changes can establish a commercial variation.
