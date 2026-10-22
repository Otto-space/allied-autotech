# Administrator invoice detail specification — gate 82

Use the accepted Allied/Quicksand dashboard shell and actual logo/navigation. Ordered
Overview > Invoices > readable invoice number breadcrumb. Current title is the named
invoice, with friendly status, compact refresh controls and a 30px/24px heading.
No duplicated generic breadcrumb or oversized blank region.

Domain-specific composition: a wide invoice paper beside a compact value/lifecycle/
handling rail. On mobile, summary and authorized handling precede the full-width
paper; line items become labelled records. Paper shows actual snapshot issuer,
bill-to, source, line quantities/prices, discount/delivery if recorded, subtotal,
tax, deposit credit, total, approved terms and document basis. Drafts and voids are
explicitly marked and never implied to request payment. Source/branch, exact Lagos
lifecycle timestamps, full references/version and all returned payment facts remain
accessible. No invented balance, customer communication, price editing or deletion.

Current active Admin/Super Admin identity gates private reads. Strict invoice parsing
must bind route UUID. Document response must bind invoice UUID, source, version,
status, due/issued/paid instants and every total. Divergent invoice/document versions
are labelled stale and disable export. Error/loading/no-document/legacy states are
deliberate; successful metadata reads cannot conceal a failed paper read.

Add authorized staff document and private download endpoints by sharing existing
snapshot/total/receipt construction with customer documents. Permit clearly labelled
staff draft preview/export; preserve non-draft-only customer contracts. Staff reads
receive minimal invoice READ audits and private no-store/nosniff. Staff PDFs carry
document ID/type/version/status headers; expected version/status and current identity
are checked before a local file is offered. No publicly signed or unauthenticated URL.
Reuse document controls via opt-in staff options, preserving customer/receipt defaults.
Share the file through native share or a clear download/copy-private-page fallback.

Issue and void remain reviewed expectedVersion operations. Preserve approved finance
policy, locks, allowed transitions, successful-payment void guard and atomic audit.
Fresh identity/current invoice + exact snapshot preflight precede one POST. Validate
immutable source/money, expected version increment, exact target status/lifecycle and
unchanged payment facts before success. Cancel does not refresh. Focus the saved
result or current-read recovery. Temporary failures retain labelled facts read-only;
denial clears paper, invoice, proposal and export state.

Minimal actor/invoice/action/version/fingerprint pending markers survive reload and
redact references on session invalidation. Never replay uncertain transitions.
Explicit Load current invoice returns current facts without proving the original
request outcome. Current terminal facts may require independent reconciliation before
clearing a local lock. Durable original-request transition receipts are a separate gap.

Acceptance: four inspected baselines, fresh viewed desktop/mobile concepts and an
intentional-correction ledger before UI edits; seven widths, state/native captures,
keyboard/focus/Axe, meaningful helper/receipt tests, document/privacy/transition API
tests and real UI/API/DB acceptance. Reuse unchanged migration/privilege evidence,
reconfirm isolated target before writes and preserve all application data. Finish the
page and document backend gaps before beginning the next financial route.

## Inspected concept corrections before implementation

Both new complete screenshots have been viewed. Retain the actual application
sidebar, logo and account strip rather than generated Credit Notes/Payouts/Reports
navigation or an invented admin identity. Use only one Refresh invoice and one
Refresh invoice access control, both secondary actions; the mobile image repeats
the first label and incorrectly makes refresh primary. Preserve the dark summary
on both widths. Invoice issue is the primary handling action; void remains a
reviewed secondary danger action, not a mandatory step labelled optional.

Use real backend policy/snapshot issuer, names, terms, source/branch and exact Lagos
dates. Do not adopt the mobile image's invented January dates or calculate a 7.5%
tax label from a sample. The displayed tax is the recorded tax. Show actual created,
updated, due, issued, paid and voided timestamps/version in the lifecycle disclosure.
Use labelled mobile line records and stack actions below430px when required; do not
squeeze the reference's long invoice number or amounts. All payment links use real
existing routes, not the generated View all payment requests label as an invented
invoice-specific collection. Keep private page sharing distinct from file sharing.
