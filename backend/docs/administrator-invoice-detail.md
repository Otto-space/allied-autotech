# Administrator invoice detail and documents

Backend and frontend gate 82 are locally verified. See the [detail-page acceptance
record](../../frontend/docs/page-quality/work-invoice-detail.md). Deployment and
application-wide acceptance remain open.

The existing direct invoice GET and reviewed issue/void POSTs retain administrator
role/MFA, strict UUID/query validation, CSRF, expectedVersion, locks, lifecycle rules
and atomic STATUS_CHANGE audits. Issue retains finance-policy approval checks; void
retains the successful-payment guard. No pricing or source mutation is introduced.

New routes:

- `GET /api/v1/staff/invoices/{invoiceId}/document` returns a verified administrator's
  invoice snapshot projection, including draft preview. It reuses customer document
  construction, total/source/bill-to checks, legacy reconciliation and confirmed-
  receipt rules. Staff metadata additionally includes createdAt, updatedAt and voidedAt.
- `GET /api/v1/staff/invoices/{invoiceId}/download?expectedVersion=0&expectedStatus=DRAFT`
  returns a bounded private PDF attachment. Both expectations are required; a changed
  invoice lifecycle is rejected with a conflict. Successful downloads carry
  `X-Document-Id`, `X-Document-Type: invoice`, `X-Document-Version` and
  `X-Document-Status`. Filenames are sanitized and drafts include `DRAFT` in the name.

Admin/Super Admin with verified MFA may use these routes. Staff, customers and
unverified administrator sessions are denied. Unknown queries are rejected. Both
responses use private no-store/nosniff. Downloads are rate limited. Successful reads
append a minimal invoice READ audit with document/format/version/status and normal
actor/request context, without copying bill-to names, addresses or source lines into
audit values. Draft PDFs prominently state that they are not issued, must not be
used to request payment and are unavailable to customers; every page has a draft footer.

Customer document routes keep their original owned, non-draft-only contracts and
projections. Receipt eligibility and refund reporting remain unchanged. There is no
public document URL, customer impersonation, automatic invoice issuance or payment
creation. Separate authenticated file sharing must warn that PDFs contain private
account information. A private staff page link does not grant access to a recipient.

Five integration scenarios passed on the guarded isolated database, reusing existing
synthetic identity/catalogue fixtures and adding three item-backed sources/drafts:
safe draft document/audit projection; role/MFA/query/privacy boundaries; real PDF
headers and zero payment effects; exact issue/void versions/customer projection and
stale-download rejection; competing issue/void serialization with one transition
audit. Twenty-four existing financial-document unit/API regressions passed.

The actual exported draft was rendered and inspected. An offline latest-renderer
check then verified one-page and seven-page draft PDFs, with a draft footer on every
page and inspected first/last pages. The offline check made no database calls.
The later change uses ASCII hyphens in the new draft labels and preserves all
financial/document behavior tested above. Backend TypeScript and route/OpenAPI checks
pass: 276 paths, 329 documented operations and four explicit infrastructure routes.

No schema, migration, existing grant or shared/application database change is
required. New fixtures are additive in the preserved isolated test database; only
the test's temporary sessions are removed. No backup/restore or deployment occurred.
Do not repeat financial fixture effects merely to refresh evidence after a visual
or punctuation-only change. Unchanged migration/privilege evidence can be reused.

The accepted UI validates current identity, route-bound invoice/document version and
totals, exact transition receipts, persistent uncertain locks, focused confirmation/
recovery and private download/share behavior. Connected production UI/API/DB checks
verified two issue/void writes and two transition audits, zero payment rows, committed-
lost-response recovery without replay and preserved other financial/customer records.
The final shared-dialog stylesheet change passed 12 focused production checks without
repeating financial writes. A current read cannot prove an original transition outcome;
durable actor/invoice/action/body-bound receipts remain optional under ADM-43.

Later workspace workforce code required its existing committed additive migration on
the preserved isolated test database. All 60 migrations replayed on an empty isolated
database; the actual test target passed the fresh-backup-protected migration runner,
client generation and `db:check`. Existing rows/grants were preserved; two SELECT-only
grants on new empty workforce tables were separately reviewed for the restricted test
runtime. This compatibility step is not a gate82 schema change or a production rollout.
No shared/application database, destructive cleanup or restore rehearsal occurred.
