### 3 November 2026: resource authoring reconciled with current master

The signed resource lookup/editor checkpoints were cherry-picked onto current
master 3be68d5d, then merged with d9cf9d09 in b9c9c089. This preserves the newer
purchasing reviews, canonical 97 migrations, saved monetary allocations, approved
rounding rule, own-profile access, home imagery and audit fixes. The alternate
20261103103000 prototype migration stays only on the retained historical branch;
it is not merged over master. Other active page-audit work remains untouched.
Both financial and resource tests are retained in the combined CI configurations.

Pre-financial-merge source 418705dc passed all 116 native booking/resource HTTP and
database cases on an exact task-owned temporary isolated database after all 97
migrations replayed, Prisma diff and db:check passed, and a restricted CRUD runtime
was verified. The initial 107-pass run retained one Docker identity timeout;
an attempted reuse failed test authentication and was cleaned up. The final full
run passed without skips and removed its exact tmpfs container. No application,
shared or production database was written. Final log:
%TEMP%/aat-resource-current-master-native-final.log.

D09 prevents customer cancellation after a recorded start even if a legacy status
still says Confirmed; D15 skips missed one-hour reminders instead of sending them
immediately. No cutoff or proposed extra reminder interval is activated. The screen
now checks the recorded start, with two new 320/1440px refresh regressions. Public
service-request guidance advances to v24 with unchanged gates/targets. Exact-source
post-merge frontend/backend compilers, 33 focused frontend and 49 backend unit
cases, scoped frontend/full backend lint, formatting and a 3,839-file secret scan
pass. The old v23 learning assertion initially failed and was updated to the
explicit v24 definition; its final 12-case file passes. Hosted rendered checks
remain pending until recorded.
The previous 19-case editor browser result remains synthetic pre-integration
acceptance, not evidence for this new composition or real operational accounts.

Read-only Vercel checks identify both aliases at audit source 7384abf8. Its
recorded backend receipt is schema 92; no fresh backend schema probe is claimed;
this resource/97-migration composition has not been deployed. Exact-master CI,
fresh backup, populated restore, reviewed pending migrations, matching backend and
runtime/alias verification are still required. Resource-aware public offer
filtering and remaining D01-D17 items are not marked complete. Purchasing remains
separately gated; the owner's approved aggregate half-up/largest-remainder rule is
preserved, while invoice identities, VAT applicability and provider acceptance
remain separate. Historical evidence below retains its original source/migration
counts and does not supersede this current checkpoint.

### 3 November 2026: D06 owner resource editor checkpoint

The source owner editor now covers real-record selection, explicit qualifications,
physical condition/calendars, versioned approval and reference-only uncertain-save
recovery. Local evidence (19 rendered, 70 frontend and 22 backend learning tests) is in
the completion tracker.
Operational resource facts/configuration, public offer filtering and D07 extension/
legacy workflows remain; no production readiness or publication is claimed.
D01-D17 approvals, delegated choices and unresolved values below are preserved.

### 3 November 2026: D06 authoring foundation checkpoint

Real-record owner-only lookup, strict resource approval receipts and reference-only
recovery are locally verified: 18 native resource-policy/lookup and 43 frontend
contract/API tests pass. The authoring UI and public resource-aware offer filtering
remain implementation work; no operational approval, UI acceptance or production
publication is claimed. D01-D17 instructions, delegation and unresolved values below
are unchanged. See the completion tracker for exact evidence and failed attempts.

## 3 November 2026: owner-approved monetary arithmetic

The user explicitly selected "Use the recommended rule" in this chat after
reviewing the concrete proposal: for future orders, round the percentage discount
and VAT once per order to the nearest kobo, resolve exact halves upward, and
allocate partial refunds by largest fractional remainder, breaking ties by the
saved line order. Allocations must reconcile to saved totals. Issued historical
amounts remain unchanged. This resolves the former tie/boundary/allocation question;
do not request that decision again. Implement the same saved snapshot across
review, payment, invoice/receipt, verification and refunds.

This is owner decision evidence, not a fabricated runtime publisher or policy
activation. Live payments and existing controlled finance settings remain unchanged.
Actual invoice identity, VAT exceptions and provider/operational acceptance retain
their separate unresolved requirements.

# Remaining owner and operator decisions

The signed checklist and attachment were implemented with explicit gates. These are unresolved details, not a request to repeat already approved decisions. Record new approvals with source, evidence, effective time and a verified approver; never edit old policy versions.

1. **Delivery (Q1):** actual approved areas and fixed fees. Collection is 133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State.
2. **Vehicles (Q3):** confirm or replace draft 70% deposit/2-hour hold; choose paid-hold start, expiry disposition and delayed provider-confirmation treatment. Clarify professional review and refundable fee handling; 0.5% is of vehicle value, not deposit. Real collection remains blocked.
3. **Refund staff (Q4):** map Operations Supervisor, Managing Director and Cashier duties to distinct verified MFA accounts. Supply actual account IDs through the owner process; no guessed invitations.
4. **Workshop (Q5 / D05–D07):** Monday–Saturday 08:00–18:00 Africa/Lagos is already approved; do not ask the normal hours again. Record actual per-branch daily capacity, dated exceptions/holidays, qualified staff and breaks, each machine’s working condition and shared-space constraints through the owner authoring controls. The prepared resource editor is now integrated in source; actual operating facts still require authorised entry and acceptance. An unspecified response target must not become a customer promise.
5. **Cancellation and returns (Q6):** exactly NGN100,000; item versus order, unit versus line/quantity, VAT/discount and partial treatment; precise confirmation event. Confirm collection return anchor, inclusive 14-day boundary and defective-item/mandatory-rights review.
6. **Bank refund timing (Q6):** interpret ?10 business days after refund is received or confirmed?; approve start event, counting convention, banking days and holiday calendar. No due date is promised until those inputs exist.
7. **Accounting (Q7?8):** resolve genuine applicability/exceptions, discount/delivery tax treatment, registered invoice identity and terms. Exclusive 7.5% VAT after discounts, seven-day quotations and the arithmetic above are already approved. Public checkout/invoice issue stays blocked until approval.
8. **Disputes/complaints (Q9/Q11):** map Newworld Orlu/Confidence Olaka to actual primary/backup accounts; supply pending customer-service/escalation emails, working-day coverage, urgent classes, public holidays and ordinary business-day meaning. Acknowledgement is separate from resolution.
9. **Marketing (Q12):** approve content, consent wording/version, sender identity and unsubscribe mechanism. Marketing execution remains disabled; essential messages remain available.
10. **Retention (Q13):** legal/accounting rules by record type, start events, holds and reviewed anonymization/deletion. The provisional 6?12 months is not an operative purge policy. Destructive execution remains disabled.

Mike's separate staging tasks are in [the runbook](owner-staging-runbook.md): real provider credentials, private cloud resources, ingress/TLS verification, controlled testers, backups and operational responders. No cloud purchase, deployment or live activation was performed.
