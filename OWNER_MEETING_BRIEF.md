# Allied AutoTech: owner meeting brief

Prepared 13 October 2026. **Decision today: approve a small private test environment first; public launch is a separate decision.** This document is a briefing and decision worksheet, not an approved customer agreement. No purchase, cloud provisioning or public launch is authorized by this file.

## What to say at the meeting

> We can first put the system online for you and selected staff to test privately. The recommended DigitalOcean backend costs about **US$45.15 per month** before tax and extra usage. We are keeping the website on Vercel. If we need a new Vercel Pro subscription, the combined baseline is about **US$65.15 per month**. We will approve each purchase before it happens.
>
> Hosting lets us test the system; it does not authorize taking customer money. We still need your written reservation agreement and the unresolved operating rules below. Where a rule is unclear, the affected action remains unavailable. We can approve those rules separately, test them, and then agree a public launch date.

## The hosting proposal in plain language

| Item                                              | What it does                                                                 | Proposed starting size                                                | Monthly USD |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------: |
| App Platform API                                  | Runs the business logic behind the website                                   | One shared CPU, 1 GiB memory                                          |       10.00 |
| Identity worker                                   | Sends account verification, reset and staff invitation messages when enabled | One shared CPU, 512 MiB                                               |        5.00 |
| General worker                                    | Handles reminders, payment checks, expiry and image cleanup                  | One shared CPU, 512 MiB                                               |        5.00 |
| Managed PostgreSQL                                | Stores business records, accounts and transaction history                    | Standard Basic, 1 GiB, one node, minimum 10 GiB disk                  |       15.15 |
| Container Registry Basic                          | Stores the four tested backend software images used for releases             | Five repositories, 5 GiB included                                     |        5.00 |
| Spaces Standard                                   | Stores vehicle/service/product images and private customer files             | 250 GiB storage and 1,024 GiB outbound transfer shared across buckets |        5.00 |
| **DigitalOcean baseline**                         | **One private testing environment**                                          |                                                                       |   **45.15** |
| Existing frontend on Vercel                       | Hosts the visible website                                                    | Pro, one deploying seat, if not already covered                       |   **20.00** |
| **Combined baseline if new Vercel Pro is needed** |                                                                              |                                                                       |   **65.15** |

Price sources checked 13 October 2026: [App Platform](https://docs.digitalocean.com/products/app-platform/details/pricing/), [Managed PostgreSQL](https://www.digitalocean.com/pricing/managed-databases), [Registry](https://docs.digitalocean.com/products/container-registry/details/pricing/), [Spaces](https://docs.digitalocean.com/products/spaces/details/pricing/), [Vercel Pro](https://vercel.com/docs/plans/pro-plan). Verify the actual checkout quote, currency conversion and tax before approving purchases. An existing paid Vercel plan should not be bought twice. Vercel's [Hobby plan](https://vercel.com/docs/plans/hobby) is for personal, non-commercial use; do not assume it covers this business site.

Staff application accounts do not each need a paid Vercel developer seat. The private access gate is implemented in the application; no paid Vercel password-protection add-on is proposed.

**Why this setup:** the API gets more memory for image validation and authentication; the two workers retain separate responsibilities. The existing PostgreSQL job system means we do not need to buy Redis, Kubernetes, another server or a load balancer for this first stage. DigitalOcean manages the database and application infrastructure. This is a modest testing setup, not a high-availability promise.

The absolute smaller alternative puts the API on 512 MiB too: **$40.15/month backend**. Saving $5 is not my recommendation before measuring image-upload and login memory use. The free Registry tier has only one repository and 500 MiB; it does not fit the current four-repository release layout. Avoid the $7 development database for shared business testing and the later public system.

### What the estimate does and does not buy

- The short deployment-check job is charged only while running; it is not another permanent $10/month server. Image storage, database growth and bandwidth can add charges.
- App Platform excess outbound traffic is $0.02/GiB; Registry excess storage is $0.02/GiB; Spaces excess storage/transfer is $0.02/$0.01 per GiB. Images served through the API can consume App Platform bandwidth as well as storage-provider bandwidth. The Spaces allowance does not cover the whole website's traffic.
- Account email can start on [Resend's free tier](https://resend.com/pricing) within its limits, after sender verification and safe testing. SMS credit, paid email upgrades, domain renewals, extra Vercel seats and payment-processing fees are outside this hosting baseline.
- A temporary **separate** database for a real backup-restore rehearsal may incur a small extra charge. Approve its exact quote and removal plan before creation. This is required verification, not permission to overwrite the working database.
- One environment is proposed now. Keeping private staging **and** a separate public production environment later adds resources. At the same starting backend sizes, two environments would be approximately **$80.30/month total DigitalOcean**, sharing only the Registry/Spaces subscription allowances; actual usage and database/storage isolation still need review. Public hosting is a separate approval.
- A spending alert is a notification, **not a hard cap**. Decide an acceptable usage allowance and response to an alert before activating metered resources. No upgrades or additional purchases are authorized automatically. [DigitalOcean spend alerts](https://docs.digitalocean.com/platform/billing/spend-alerts/)

## What private testing means

Selected people receive private-site access and then log in with their own application accounts. The same perimeter protects the website and direct API hostname; ordinary customers cannot use registration or browse test records without private-site access. The shared test password is an extra gate, not a substitute for individual permissions or MFA. Do not share it in a public group.

Use synthetic customer/order/payment records for acceptance testing. Keep live payments, SMS and marketing off. Account email starts disabled and is enabled only for verified, allowlisted testers. Do not make up a real reservation agreement just to demonstrate the button: an agreement awaiting approval remains unavailable on the hosted business environment. Synthetic agreement tests belong in isolated test databases.

A private deployment still needs working HTTPS, correct account permissions, private image storage, backups and a successful restore rehearsal. These checks happen on the actual resources after purchase approval; local tests cannot certify them in advance.

## The business decisions to leave the meeting with

The existing signed checklist has already been used. These questions resolve its remaining blanks and ambiguities; they do not replace previously approved decisions. Record the approver, exact wording, source/reference and effective date for every new policy.

### 1. Vehicle reservation agreement — exact customer wording

**Ask:** “What exact agreement must the customer read and accept when reserving a vehicle?”

**Bring back a document covering the business's legal identity and contact details; what vehicle/price is being agreed; what a reservation promises; when it starts and ends; inspection and document checks; each party's responsibilities; cancellation/refund treatment; what happens if the business cannot supply the car; complaints/disputes; and any **applicable** customer rights. Have the business's legal adviser review the terms where needed. These are drafting topics, not invented contract clauses.
**
Required publication details: agreement title, complete approved plain-text wording, version/effective date and time, named approver, and a written approval reference. The Super Admin can publish it at `/admin/reservation-terms`. The system saves the exact version accepted by each customer and retains old versions. **A heading, a checkbox, “terms apply”, or verbal approval alone is not the missing document.**

**Until supplied:** new online reservation acceptance remains blocked. Viewing a properly published vehicle and making an enquiry can be separate from reserving it. Agreement approval does not itself approve a deposit or enable live payments.

Owner's answer / document reference: ______________________________

### 2. Vehicle deposit and hold rules — money and timing

The **70% deposit and two-hour hold are still drafts**, not approved live collection rules.

**Ask:**

- Is the deposit really 70%, or another amount? When is the balance due?
- What event starts a paid hold: confirmed provider payment, staff confirmation, or another specified event?
- What happens when the hold expires? Release the vehicle, extend it after review, or another agreed process? What happens to money already paid?
- If payment was made on time but the provider confirms late, what happens?
- When does the stated 0.5% cancellation fee apply, when is it refundable, and who approves exceptions? Its draft basis is **vehicle value**, not the deposit. For a ₦10 million vehicle, 0.5% of vehicle value is ₦50,000; this example is not a charge authorization.
- Who handles an inspection failure, business cancellation or vehicle no longer being available?

**Until resolved:** no live vehicle deposit collection and no invented automatic forfeiture. Keep the agreement in item 1 consistent with these rules.

Owner's decision: _______________________________________________

### 3. Delivery areas and prices

**Ask:** “Which exact locations do we deliver to, and what fixed fee applies to each? How are areas outside that list handled?” Confirm who can change the fees and their effective date.

Collection address on record: **133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State**. The system needs approved delivery zones/fees before offering chargeable delivery.

Owner's area/fee list: ___________________________________________

### 4. Cancellation, returns and bank-refund timing

**Ask:** “For the ₦100,000 cancellation boundary, what happens at **exactly ₦100,000**? Is the calculation based on one unit, a whole line including quantity, or the whole order? Before or after VAT/discount? How does a partial cancellation work? What exact event counts as confirmation?” Record the complete fee rule, not only a percentage.

For returns, define when the 14 days start for collection orders, whether day 14 is included, and handling of defective goods and mandatory customer rights. Do not equate an approved return with goods received, money refunded or stock ready for resale.

For “10 business days” on bank refunds, define the exact starting event, whether that day counts, the banking working days and holiday calendar. A support team's opening hours do not define banking days.

**Until resolved:** requests can still be reviewed, but an unclear automatic fee, deadline or refund promise must not be presented as settled policy.

Owner's decision: _______________________________________________

### 5. Who is allowed to handle money

**Ask:** “Which actual people and accounts request, approve, send and independently check a manual bank refund?” Map Operations Supervisor, Managing Director and Cashier duties to verified MFA accounts. The existing workflow requires **four distinct people for the four stages**; do not quietly give one person multiple stages to make a test pass.

Name the real primary and backup for payment disputes (including the proposed Newworld Orlu / Confidence Olaka assignments), and who has access to the provider dashboard. Supply account identifiers securely, not passwords.

Names and responsibilities: ______________________________________

### 6. Workshop capacity and confirmation

**Ask:** “For each branch, how many jobs can we accept per day, on which days, and during which hours? Who checks people and equipment before confirming a booking? What are the holiday exceptions?”

Explain what the 10–30 minute acknowledgement/confirmation target means outside opening hours. A requested booking is not automatically accepted when a timer expires. **There is no booking deposit in this design.**

Branch schedule / capacity / responsible person: ___________________

### 7. Tax, quotations and invoices

The quotation-validity rule is already **seven days**. The system's current **exclusive 7.5% VAT setting is an owner draft awaiting accounting approval**, not a tax determination by the software.

**Ask the owner/accountant:** “Which products/services are taxable or exempt? Is VAT added to the displayed price? What is the rounding rule? How do discounts and delivery fees affect tax? What registered business name, address, tax identifiers and payment terms belong on invoices?” Different treatment from the currently supported simple policy may need additional implementation and testing.

**Until approved:** public checkout/payment/invoice issue remains gated by the applicable accounting controls. Hosting approval does not remove those controls.

Accountant / approved instruction reference: _______________________

### 8. Customer complaints and escalation

**Ask:** “Which email/phone should customers use? Who is first responsible and who is the backup? Which complaints are urgent? What are the working days, holidays and out-of-hours arrangements? What exactly does one business day mean?”

Acknowledging a complaint means “we received it”; it does not mean the issue is resolved or the payment provider has accepted a dispute. Confirm who watches operational alerts and who can respond when Mike is unavailable.

Contacts / calendar / escalation owner: ____________________________

### 9. Marketing and customer-data retention

**Marketing:** approve the sender identity, message types, exact opt-in wording/version and unsubscribe process. Optional marketing stays disabled until approval **and** implementation acceptance; essential account/transaction messages are separate.

**Retention:** ask the accountant/legal adviser how long each class of record must be retained, when the clock starts, and what disputes or obligations prevent deletion. Include invoices/payments, accounts, bookings, images, support records and backups. Name who may approve anonymization/deletion. The provisional “6–12 months” is **not** authorization to purge the database.

These items can remain deferred during private testing. Do not promise public marketing or automatic account/data deletion until the remaining work is reviewed and tested.

Owner's decision / adviser / due date: _____________________________

## Hosting approval worksheet — leave blanks until approved

| Decision                                                       | Record the actual answer                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Stage                                                          | Private owner/staff testing first (confirmed by Mike); public launch later                                |
| Billing account owner and payer                                | ____________________                                                                                      |
| API $10/month                                                  | Approve / defer: __________                                                                               |
| Identity worker $5/month                                       | Approve / defer: __________                                                                               |
| General worker $5/month                                        | Approve / defer: __________                                                                               |
| Managed PostgreSQL quoted $15.15/month                         | Approve / defer; actual quote: __________                                                                 |
| Registry Basic $5/month                                        | Approve / reuse existing / defer: __________                                                              |
| Spaces Standard $5/month                                       | Approve / reuse existing / defer: __________                                                              |
| Existing Vercel commercial plan                                | Covered already / approve quoted Pro / defer: __________                                                  |
| Metered usage, tax/FX and spending-alert response              | Approved allowance and responder: __________                                                              |
| Separate temporary restore resource                            | Exact resource, maximum charge and removal instruction: __________                                        |
| Region                                                         | London proposed, subject to availability and approved data location: __________                           |
| Tester names/emails and test coordinator                       | ____________________                                                                                      |
| Existing catalogue/vehicle records to carry into public launch | Approved records and responsible reviewer: __________                                                     |
| Backup recovery expectation                                    | Maximum acceptable data loss and downtime: __________                                                     |
| Technical access                                               | DigitalOcean, Vercel, domain DNS, verified sender; supplied securely: __________                          |
| Purchase authority                                             | Mike must explicitly approve every purchase; owner agreement alone is not a purchase instruction to Codex |

A useful follow-up message is: “Prepare the approved private-testing resources listed in the signed worksheet. My purchase approval covers [exact items and prices], [recurring billing], and [explicit usage/temporary-test allowance]. All other purchases and public activation need my approval.” Do not send credentials in that message.

## What happens after approval, and how public launch follows

1. Confirm the actual provider quote/account and buy only the approved resources. Configure private access, HTTPS, strict database access and private storage.
2. Enable and verify managed backups/PITR; restore into a separate approved target. Apply reviewed migrations through the guarded backup workflow, then deploy the exact tested images.
3. Test owner/staff accounts, role boundaries, form drafts, listing visibility, images, worker jobs, account email and Paystack **test-mode** flows. Resolve failures before declaring private testing ready.
4. Obtain/publish the missing business approvals and finish any policy-dependent implementation. Keep staging private and its credentials/test data separate.
5. Approve a production resource plan separately. Use the same release process and tested software, with fresh production secrets, approved public origins, live-provider verification and controlled cutover. Remove the private gate only from the approved production deployment; preserve the private test environment if its ongoing cost is approved.

The transition is a configuration/release process, not a rewrite. It still requires evidence: approved policies, correct accounting, healthy workers, private media, backups restored successfully and a measured load test. Preserve the current local database and agree which genuine catalogue/stock records should be transferred through a reviewed import. Do not simply relabel the test database as production or delete its test records to make it look clean.

## Files to give ChatGPT or the implementation engineer

- **Start with this file:** `OWNER_MEETING_BRIEF.md`.
- Technical cost/release plan: [backend/docs/hosting-approval-plan.md](backend/docs/hosting-approval-plan.md).
- Authoritative unresolved questions: [owner-decision-checklist.md](backend/docs/owner-decision-checklist.md).
- What the signed checklist already implemented: [owner-implementation-matrix.md](backend/docs/owner-implementation-matrix.md).
- Agreement publication/acceptance behavior: [vehicle-reservation-terms.md](backend/docs/vehicle-reservation-terms.md).
- Mandatory database workflow: [database-safety.md](backend/docs/database-safety.md).

Suggested prompt: “Explain OWNER_MEETING_BRIEF.md in everyday language. Help me conduct the meeting one decision at a time. Distinguish approved rules from drafts and hosting approval from public launch. Do not invent legal terms, business decisions, prices or purchase approval. Turn the owner's actual answers into a decision record with approver, source and effective date.”
