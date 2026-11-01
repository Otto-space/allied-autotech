# Finance review packet — 1 November 2026

Status: proposal for owner/accountant review only. Not an issued invoice, tax advice,
financial-policy approval or permission to activate purchasing. No real order,
customer, stock, payment, invoice number or identifier is created by this document.

## Recorded instructions and fields still required

| Field | Recorded value / required decision |
| --- | --- |
| Business name | Allied Autotech Limited; retain supplied identity, verify invoice identity with accountant |
| Address | 133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria |
| Tax ID | Awaiting owner/accountant verification. Do not fabricate or record “none” |
| CAC registration number | Awaiting verification of actual number and applicability |
| Currency | NGN, display two decimal places |
| VAT | Retain existing exclusive 7.5% after discounts; accountant must verify applicability/exceptions. This packet grants no new tax approval |
| Rounding | Proposed half-up to nearest kobo; calculation boundaries below need approval |
| Product payment terms | Full payment at checkout, then required compatibility and availability checks. Payment does not establish compatibility, allocation or readiness for collection |
| Quotation purchase terms | Payment after acceptance of a valid quotation; seven-day validity is not a credit period |
| Workshop booking | Request-and-confirm; deposits disabled |
| Service invoice payment due | Separate unresolved owner decision |
| Publication provenance | Verified approving actor/capability, exact policy version, source, approval evidence and effective date remain required through the controlled workflow |

Current finance schema fields: vatBasisPoints, pricesIncludeVat, rounding,
discountTreatment, deliveryTaxable, invoiceName, invoiceAddress, paymentTerms and
applicability. Publication also requires expectedVersion, effectiveAt, source and
approvalEvidence. The strict schema currently has no dedicated Tax ID/CAC fields:
verified identifiers need reviewed schema/snapshot/rendering support before use;
do not hide them in approvalEvidence or relax validation to bypass this gap.
Collection remains the supplied fulfillment method. Delivery-tax applicability
must be resolved explicitly before any future delivery activation.

## Exact rounding proposal (not approved or enabled)

1. Parse monetary decimal strings directly into integer kobo, rejecting more than
   two fractional digits; never multiply binary floating-point currency values.
   Unit price times integer quantity is exact; sum gross lines in kobo.
2. Calculate an order-level percentage discount once on the eligible gross total:
   floor((eligibleKobo * rateBasisPoints + 5000) / 10000). Apply approved discount
   caps and cap to eligible subtotal. Fixed discounts are already integer kobo.
   Do not round independently per item and then recompute the order discount.
3. Subtract the discount to obtain the taxable amount exactly. In this collection
   example there is no delivery fee. VAT is rounded once on the discounted taxable
   total using the same formula with rate 750. Do not sum independently rounded
   line VAT and present it as this aggregate calculation.
4. Total = gross lines - discount + VAT, in integer kobo. Use this single saved
   total for invoice, checkout and provider minor-unit amount. No display rounding
   may change that amount; currency and returned amount must match on reconciliation.
5. Show discount and VAT as order-summary rows so itemisation reconciles exactly.
   Per-line tax/discount allocation and partial-refund allocation need a separately
   reviewed deterministic remainder rule if those representations are required.
   Never recalculate an issued historical snapshot using a later policy version.

Existing source differs at step 2: promotions.service.ts divides by 10000 with
integer truncation; policy-money.ts rounds aggregate VAT half-up. For a 10% discount
on NGN 0.15, current discount is NGN 0.01; proposed half-up is NGN 0.02. The difference
is recorded for review, not silently changed. Existing order creation compares
quotation VAT/total to calculated values and rejects financial-term mismatches.

## Sample invoice — illustrative only, not payable

Allied Autotech Limited
133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt,
Rivers State, Nigeria

Tax ID: awaiting verification (review placeholder; not production metadata).
CAC number: awaiting verification (review placeholder; not production metadata).
Customer: synthetic review example. Invoice number: not issued.

| Illustrative item | Quantity | Unit price (NGN) | Gross (NGN) |
| --- | ---: | ---: | ---: |
| Example part A (not a catalogue item or stock claim) | 2 | 12,345.67 | 24,691.34 |
| Example part B (not a catalogue item or stock claim) | 1 | 2,000.00 | 2,000.00 |
| Gross subtotal | | | 26,691.34 |
| Illustrative 10% discount, proposed half-up | | | -2,669.13 |
| Taxable subtotal | | | 24,022.21 |
| Illustrative VAT at recorded 7.5%, proposed aggregate half-up | | | 1,801.67 |
| Total | | | 25,823.88 |

Expected hypothetical provider amount: 2,582,388 kobo, currency NGN. No payment
was initiated or accepted. The example discount is not an approved promotion.
Remaining checks after hypothetical full payment: compatibility and availability;
collection readiness requires staff confirmation. For a quotation purchase, accept
within its seven-day validity before payment. Service-invoice timing is unresolved.

## Verification and activation boundary

Review arithmetic: 2,669,134 gross kobo; 266,913 discount; 2,402,221 taxable;
180,167 VAT; 2,582,388 total. Half-kobo boundary: 20 taxable kobo at 750 bps gives
2 kobo VAT. This is arithmetic evidence, not provider, tax or financial acceptance.

Before activation: verified identifiers; approved applicability and exact rounding
boundaries; appropriate snapshot/rendering support; service timing separately;
controlled publication/provenance; real stock/capacity/permissions; merchant NGN
success/cancel/duplicate/wrong-currency/reconciliation acceptance. Keep purchasing,
payment and booking-deposit gates unchanged. Existing policy/payment safeguards,
quote validity and the required post-payment checks remain intact.
