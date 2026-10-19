# Administrator invoice detail audit — gate 82

Route `/admin/invoices/[invoiceId]`. Gate 81 remains accepted independently. Initial
inspection is read-only; no UI changes precede four-width baseline inspection and
fresh desktop/mobile concepts.

Current hierarchy is a Back link, generic Manage invoice heading, loose refresh
button, one plain totals/status section and an unstructured payment-request list.
The source/branch, full record reference/version, created/updated/voided timestamps
and exact lifecycle chronology are incomplete. There is no staff document preview,
download or share control. Mobile retains large inherited gaps and monetary figures
need deliberate protection from clipping. Existing issue/void buttons are supported.

Backend direct invoice GET is Admin/Super Admin with verified MFA, strict UUID/empty
query validation, private no-store and privileged READ auditing. Issue/void require
CSRF, expectedVersion and row locking; issue checks approved finance policy. Void
rejects successful linked payments. Transition and STATUS_CHANGE audit commit
atomically and return safe invoice facts. Preserve these rules and source pricing.

Existing frontend shortcomings: session-role-only gate; loose invoice parsing with
no route-ID check; no fresh identity/current-record preflight; unvalidated transition
response; generic success after any resolved POST; refresh even on cancellation; and
no reload-persistent lock after an uncertain transition. Use the accepted current-
profile pattern, strict invoice helper, exact transition validation and minimal
actor/invoice/action/version/fingerprint markers. Explicit current reads do not
prove the original outcome or replay it. Preserve focus and fields on cancellation.

The existing financial-document service exposes customer-owned non-draft documents
only. Add separate verified-admin, audited staff invoice document/download endpoints,
including clearly marked draft preview/export, by reusing the same snapshot/total/
receipt validation and PDF renderer. Retain customer routes/contracts and protect
bill-to data. Return current invoice version/status headers on staff downloads so
the frontend can reject a stale lifecycle export. Do not create a public PDF URL.

Reuse DocumentActions with opt-in staff scope/current identity and current-version
checks, shared PDF validation/blob cleanup/native share/fallback. Customer defaults
and existing receipt flows must remain compatible and receive focused regressions.
Preview must expose actual stored/safely reconciled source lines and distinguish
legacy source/summary basis, totals, linked requests and confirmed receipts. Do not
manufacture an outstanding balance or treat a payment request as a receipt.

No schema, migration, grant or existing-data rewrite is planned. Reuse unchanged
database safety evidence; re-confirm the actual isolated target before fixture or
session writes. No application/shared database or deployment operation is authorized
as part of this local page gate.

## Foundation evidence — recorded before UI implementation

Production gate81 server baselines at430/768/1280/1440px were captured and viewed.
No horizontal page overflow occurred, but large gaps, loose totals/action layout and
missing paper/lifecycle detail confirmed the audit. Fresh desktop/mobile ImageGen
concepts are saved and viewed; the specification records concrete generated-copy,
navigation, date and responsive corrections before UI implementation.

The missing staff document/download routes are now implemented and backend-verified.
Five new isolated API/database scenarios and24 existing financial-document regressions
pass; generated contracts cover276 paths/329 documented operations plus4 infrastructure
routes. The target was confirmed as127.0.0.1:55480/allied_work_aftercare_20261017_test
before fixture/session writes. Existing identities/catalogue were reused, three new
item-backed sources/drafts were added and existing financial fixtures preserved.
No schema/migration/grant/shared database operation occurred.

An actual authenticated draft export was rendered and viewed. Latest-renderer offline
one-page and seven-page drafts were then checked for draft footers on every page and
visually inspected on first/last pages, without database access. Backend contract:
`backend/docs/administrator-invoice-detail.md`. Private evidence: work-invoice-detail-
api-tests.log, work-invoice-detail-api-fixtures.json and draft PDF/PNG files under
C:/Users/PC/.codex/.

New frontend helpers validate direct route identity, document/source/version/money/
lifecycle matching, confirmed receipt relationships, exact issue/void responses and
minimal actor-bound pending markers. Six new detail helper units plus six accepted
invoice-list units pass. At that foundation checkpoint, the detail component, private
export integration, responsive/browser/API/DB acceptance and fidelity ledger remained
unfinished. They have now passed the separate [gate 82 acceptance record](../work-invoice-detail.md).
The current accepted total is 82; refund requests are next. See that record for the
later committed workforce migration compatibility step and exact database evidence.
