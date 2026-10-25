# Shop and Vehicles, revision 2

Implementation source: `feat/shop-vehicles-r2-20261025`, starting at `b45513f1`.
This combines the restored homepage with deployed backend `ff42b0e2`; unrelated
work in the homepage/audit and other worktrees is retained. Provider inspection
confirmed frontend `dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU` READY and backend
`f9239c36-d4b7-4ef0-b8ba-479cda926a13` ACTIVE before implementation.

## Contracts established before implementation

- Vehicle enquiries: `vehicleEnquiryIntent` is `LISTING` or `REQUIREMENTS`.
  Legacy requests with a listing and no intent persist as LISTING without changing
  their request body or idempotency hash. Legacy stored
  null intent with a listing remains valid. REQUIREMENTS explicitly forbids a
  listing; LISTING requires a currently public listing. Invalid references never
  turn into sourcing enquiries. Other enquiry-type invariants are preserved.
- Requirements routing reuses the existing public branch choice: an explicit
  active branch, or the sole active branch. No arbitrary fallback among multiple
  branches. Listing intent continues to enforce the listing's branch. Existing
  assignment, branch and workforce template scope governs queue visibility.
- Product families: nullable controlled REPLACEMENT_PART / ENGINE_OIL; null keeps
  existing shared products unchanged. No inferred backfill. Initial oil contract:
  recorded SAE viscosity grade and positive pack volume in explicit millilitres;
  these are label data, never fitment or approval evidence. Optional manufacturer
  specification/approval authoring awaits an established business data contract.
- Search: all normalized tokens must match permitted fields of the same record;
  ordinary final token prefix from three characters, never identifier/grade prefix.
  Engine oil/motor oil is a controlled family phrase alias; 5W30 and 5W-30 are
  equivalent grades; code suffixes and distinct grades remain distinct.
- Ordering: implicit query sort is best match; implicit browse sort is newest.
  Explicit sorts, including newest, win. Tiers: exact identifier; exact name or
  make/model; all core fields; remaining public description. Stable time/ID ties.
  Changed relevance cursors are versioned and bound to effective query and sort.
  Pages are fresh reads, not a snapshot across requests; fixed-data traversal must
  have no duplicates/omissions.
- Facet options are server-derived public values. Counts, if shown, use the current
  intersection with the requested facet relaxed; never count the visible page.
- Transfers contain bounded public criteria, both kobo budget limits formatted in
  naira, and no private vehicle identity. No automatic submission.
- Same-context drafts restore edits. Different-context conflict offers Keep current
  draft / Start this enquiry, retaining both; a resume action returns to the prior
  draft. Context comparison is deterministic and principal/session scoped. No merge.

## Acceptance and evidence

| Batch              | Meaningful fixture acceptance                                                                                                                                            | Status                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Vehicle domain     | Both intents, legacy request/receipt replay, illegal combinations, stale/private listing, branch routing, real persistence, branch/assignment/workforce queue boundaries | Passed isolated API/database tests; hosted acceptance pending        |
| Product data/admin | Typed grade/volume, unknowns, family/category compatibility, published visibility, unchanged other products                                                              | Passed isolated API/database tests; admin browser acceptance pending |
| Search             | Cross-field Corolla, exclude Camry, oil alias/grade, exact code/suffix, explicit sort, equal-score/price cursors, private exclusion                                      | Passed isolated PostgreSQL integration; hosted acceptance pending    |
| Handoffs/drafts    | Both budgets, Vehicle requirements, listing reference, review/submission, both conflict choices, resume and identity transitions                                         | Pending                                                              |
| Rendered quality   | 360/390/768/1024/1440, keyboard, modal focus, empty/no-match/error, history and stale requests                                                                           | Pending                                                              |

All persistence fixtures require a newly created isolated `_ci` database. External
mail/SMS/payment delivery stays disabled. No production fixture seed or real enquiry.
Schema changes require forward migration, generated client, empty replay and
`db:check`; rollout retains backup/recovery and least-privilege release gates.

25 October implementation checkpoint: all 70 migrations replayed into a newly
created loopback `_ci` target; Prisma reported no difference. Final `db:check`
passed with 70 migrations. Eight focused backend files passed 57 checks; the
separately enabled physical missing-column/rollback schema-guard test passed 1/1.
Backend typecheck/lint passed; route coverage matched 408 mounted operations.
The frontend optimized build passed using reused Next 16.3.8 dependencies (CI's
lockfile remains Next 16.4.3). Full frontend units initially passed 997/998: one
old detail-link expectation needed updating for the revised preference transfer.
This is not a production or browser acceptance receipt.

Automatic approval review rejected local Next server startup with “blocked by
policy”. No alternative local startup was attempted. Browser specs are prepared,
but remain unexecuted until an allowed hosted candidate is available.

## Migration and query implementation

Five forward migrations add nullable intent/family/label fields, enforce enquiry
and oil invariants, and maintain derived public search documents/brand keys.
Triggers cover old application writers and category/vehicle name edits. Backfills
recompute search documents and normalized brand keys only; no family, suitability,
approval, stock, price or business timestamps are inferred. Applied migrations
are unchanged. Application rollback keeps these compatible migrations and an
up-to-date migration artifact; rolling back application code does not roll back
database history or permit an older migration runner to ignore newer migrations.

Ordinary searches use ALL-token cross-field matching and bounded rank-tier reads;
identifiers retain punctuation and suffixes. Existing literal `%`, backslash and
quote queries use escaped literal public-field matching for compatibility, rather
than dropping those symbols and broadening results. Option lists use the complete
public result scope with the requested facet relaxed; family relaxation also clears
its dependent typed fields. They return bounded choices and cursors, not counts.

Oil grade is an SAE viscosity label; pack volume is stored in millilitres and shown
with explicit units. Neither is a manufacturer approval or a fitment decision.
The [Shell technical sheet](https://www.epc.shell.com/DocumentManagement/BlobDocumentDownload?DocId=100863412)
was consulted to distinguish grade from separate specifications/approvals; this
does not establish Allied's stock or authorise an approval claim. Optional oil
specifications/approvals remain outside this batch pending the business contract.

Draft form values stay in the existing principal-scoped session storage. The new
registry tracks context/choice references only. Start/resume never deletes the
other form draft. Browser-storage failure is explicit and blocks switching away
from potentially unsaved work; refresh persistence cannot be guaranteed then.

## Business data versus code

Real categories/products, recorded oil labels/volumes, actual vehicle listings and
reviewed fitment evidence are business inputs, not invented fixtures to publish.
New tyre/battery/other-fluid/car-care specialist filters are deferred; existing
shared support remains. Homepage and broader dashboard redesign are out of scope.
