# Owner policy decisions — meeting record

Meeting date: 13 October 2026, Africa/Lagos.

This records decisions relayed by Mike while meeting the owner. It is not a published application policy, a tax opinion, a purchase approval or permission to activate live payments. Preserve earlier policy history. Record unresolved details explicitly rather than inserting defaults.

## FIN-01 — product/service pricing and VAT

Source: Mike's reply in this conversation to the accountant-confirmation question. Mike answered “Yes” and supplied the instructions below. Accountant confirmation is reported by Mike; no separate accountant document was inspected.

### Confirmed instructions

- Advertised product/service prices exclude VAT.
- Add 7.5% VAT when calculating the total, and show the tax separately for transparency.
- Apply this treatment to all products and services, as stated by Mike.
- Apply discounts before calculating VAT.
- Add 7.5% VAT on top of the delivery fee for both Allied-handled delivery and delivery handled by an external logistics company. Show the delivery VAT explicitly in the breakdown.

### Delivery clarification — 13 October 2026

Mike's latest response explicitly says 7.5% for both delivery arrangements, resolving the earlier message's inconsistent “75%” wording. The delivery fee entered for this calculation is before VAT. For example, a NGN 5,000 fee plus NGN 375 VAT gives NGN 5,375 total delivery cost.

Latest instruction:

> Let the 7.5% VAT show that it is being added to the delivery fee. The new update is that both the allied-handled delivery and another logistics company delivery both contain the 7.5% VAT

Superseded instruction, retained for the decision history:

> If the delivery logistics is being handled by allied autotech, then VAT is included, whereas if it's handled by another logistics company, then VAT isn't added

The earlier external-delivery exclusion no longer applies. The response to who collects the courier charge referred back to the VAT answer; it did not explicitly identify the payee. Do not infer that Allied collects a fee merely because the owner specified its VAT rate.

### Questions pending

1. For external delivery, does Allied collect the delivery fee and its VAT in the website checkout, or does the customer pay the logistics company separately? The rate and tax-exclusive calculation are settled; payment collection remains open. If a courier supplies a VAT-inclusive quotation, it must not be entered as a net delivery fee and taxed again.
2. Invoice business identity/address, payment terms, rounding approval, named approval evidence and effective date remain to be completed before application publication. These were not inferred from this pricing answer.

### Jumia reference checked on 13 October 2026

- [Jumia shipping and delivery](https://vendorhub.jumia.com.ng/shipping-and-delivery/) distinguishes stock stored/packed by Jumia Express from stock stored/packed by a seller and handed to Jumia. In the latter model, Jumia still describes delivering to the customer. It is not a simple distinction between Jumia delivery and an independent customer-paid courier.
- [Jumia marketplace terms](https://pay.jumia.com.ng/cms/customers-terms-and-conditions.html), clauses 3.2.2–3.2.3, describe product prices including taxes and clearly disclosed additional charges. This differs from the owner's requested VAT-exclusive advertised prices.
- [Jumia 2026 seller fees](https://vendorhub.jumia.com.ng/fees-copy/) describe VAT included in their seller-fee table. Seller charges are not evidence of the tax treatment on Allied's customer invoice.

These sources do not establish a rule that non-Express delivery has no VAT. Use Jumia as a reference for identifying who fulfils an order and explaining fees clearly, not as authority for Allied's tax treatment. This research does not overrule the owner's reported accountant instructions; it identifies that the proposed analogy does not substantiate them.

### Current application fit and remaining boundary

The current finance policy has one global `deliveryTaxable` boolean. Checkout applies that single value to the approved delivery-zone fee. The latest uniform tax rule fits `deliveryTaxable: true` for delivery fees collected through the existing checkout. A carrier-specific tax switch is no longer needed for this decision. The policy does not currently distinguish Allied delivery from third-party delivery or record who collects the courier charge.

Sources: `backend/src/modules/policies/policies.schemas.ts`, `backend/src/modules/orders/orders.service.ts`, and `frontend/app/components/finance-policy.tsx`.

Confirm payment collection before deciding whether the existing checkout is sufficient or a separately paid courier arrangement needs implementation. Any explicit delivery-VAT presentation still needs UI verification; a compatible calculation setting is not evidence that every requested label is already rendered. Preserve policy versions and historical financial snapshots in any later implementation.

### Status

Product/service pricing and the uniform 7.5% delivery-VAT calculation are confirmed as owner instructions relayed by Mike. External courier payment collection, invoice metadata and publication details remain open. No application code, database policy, financial record or live payment setting was changed by recording this decision.
