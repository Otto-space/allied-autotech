# Vehicle stock creation

Locally accepted 17 October 2026, milestone 69. Route `/admin/vehicles/new`.

## Implemented experience

The page now has one named breadcrumb/header, four numbered form groups and a
compact after-save rail. Identity, specifications, identifiers and acquisition
keep all existing required/optional fields and exact serialization. Staff see
their verified assignment and acquisition time; only Admin/Super Admin see and
send acquisition cost. Photos and a sale listing remain separate later actions.
The confirmed record opens in the existing photo editor. The shared edit export
and its detail consumers remain intact.

Current own identity/active role gates the form. Staff additionally prove active
assigned stock scope. Review checks fresh identity/branch eligibility and lists
every permitted submitted fact; confirmation checks access again before POST.
Returned records must match the reviewed fields, active branch, role projection,
empty initial collections and version zero before navigation. Optional nulls,
zero mileage, maximum exact cost, enum values, normalized stock/VIN and Lagos time
are preserved. Drafts survive reload and definite rejection, including a selected
branch outside the first choice page; assignment changes use a different draft
scope. Validation focuses the first invalid field in visual reading order.

A minimal owner/role-scoped pending marker is verified before sending. Uncertain
saves, malformed/mismatched responses, 408/429 and reload never automatically
repeat a POST. Corrupt or unavailable recovery storage fails closed. Account
invalidation redacts metadata while retaining the lock. Definite first rejections
release only their own marker. Validated success stores the saved reference and
clears the submitted draft. An uncertain user can read stock and explicitly
acknowledge a new empty draft; the message never equates an observed stock record
with proof of the original request outcome. Original-request receipts remain an
optional backend extension, ADM-24.

The backend correction checks the 40-character stock-number limit after uppercase
normalization, preventing an expanded Unicode value from reaching the database
column bound. Frontend validation also rejects impossible calendar dates. No
endpoint, permission, schema, migration or grant expansion was required. See the
[backend workflow and recovery boundary](../../../backend/docs/vehicle-stock-creation.md).

## Concepts and fidelity

Fresh built-in Image Gen [desktop](work-vehicle-create-oct-concepts/desktop.png) and
[mobile](work-vehicle-create-oct-concepts/mobile.png) concepts were inspected before
UI edits. The [source audit](work-vehicle-create-oct-concepts/audit.md),
[specification](work-vehicle-create-oct-concepts/spec.md) and
[prompt set](work-vehicle-create-oct-concepts/prompts.md) record the choices. No new
image enters the application. The Browser plugin was unavailable; QA used the
production Next.js build in Playwright/Edge, Axe and `view_image` comparison of
both concepts and final native/practical captures in the same pass.

Native dimensions are **1487x1058 desktop** and **882x1783 mobile**. Both viewport
and full-page continuation captures were inspected, plus practical 430px, 320px
review, pending, invalid and long-assignment views. The generated mobile reference
includes a centered phone frame; runtime uses the actual available viewport and
existing shell. Full-page captures stitch content below the fixed viewport shell;
the native viewport view is authoritative for shell positioning.

| Comparison      | Final disposition                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition     | The named header, four white numbered groups, two-column desktop fields and ~250px after-save rail follow the specification. The real Allied logo/navigation/search/account replace generated approximations.                                     |
| Typography      | Computed Quicksand; heading 28px desktop/native-wide and 24px at practical mobile, group headings 16px, labels/controls/body 13px.                                                                                                                |
| Surfaces        | Cool #f4f6f8 canvas, white 12px grouped panels, subtle rules/shadows and restrained red action match the concept. No hero, chart, stock total or pre-save upload is introduced.                                                                   |
| Controls        | Inputs and ordinary controls measure at least 44px, with 8px corners and explicit red focus outlines. Generated compressed controls were enlarged; the complete form continues below the viewport rather than shrinking targets.                  |
| Field layout    | Uniform two-column fields retain every input on desktop and native-wide mobile; below 600px they stack. Identifiers stay readable rather than reproducing a compressed generated three-column row. All long values remain available.              |
| Guidance/icons  | Existing CarFront/Image/Tag outline icons explain the same three steps. Narrow guidance moves above the form with concise titles; descriptive paragraphs remain on desktop. Numbered form groups preserve progression.                            |
| Review/recovery | The complete scrollable 22/21-fact review, first-invalid-field focus, pending panel and explicit stock/new-draft actions extend the reference to real write/failure states. Maximum money and precise Lagos time remain visible in narrow review. |

Copy differences are explicit: retained field labels include **Mileage (optional,
km)**, **Acquisition cost (optional, NGN)** and **Acquired at (optional, Lagos time)**.
Make/model/year/trim/engine/colour/numeric values remain existing text inputs;
generated dropdown facets and repeated “Not set” text in text fields are omitted.
Stock guidance names the actual required fields. Staff see assigned-branch copy
instead of an editable branch selector. The actual currency formatter uses the
naira symbol. Footer/review actions reuse **Review new vehicle**, **Confirm change**
and **Go back**; the existing photo route replaces any invented upload action.
Recovery explains that another draft does not prove the previous outcome.

## Acceptance evidence

- **26 distinct browser scenarios have passing evidence:** 22 creation scenarios
  and four existing create/edit/listing regressions. Twenty passed in the initial
  production run; the first-invalid-field focus case was corrected and the
  additional off-page draft case completed. Nine targeted final cases passed,
  including those fixes, Admin/Super Admin complete review, responsive/long review,
  all three existing role create/edit flows and interrupted creation/listing flow.
- **Six frontend contract cases** pass, with a focused repeat after adding the
  inactive-response assertion. They cover exact body/result matching, Staff cost
  omission, zero/null values, timestamps, pending ownership/token checks, confirmed
  state, actor/branch draft isolation, redaction, storage failure, calendar validity
  and canonical stock-number bounds.
- **Three API/database cases** have passing evidence. The first run passed denial
  and validation cases; the creation/audit case passed its focused repeat after
  correcting its audit-field lookup. All three roles create one complete record
  and one CREATE audit, with no listing/photo/document/report. Duplicate, MFA,
  CSRF, Customer, foreign/inactive/unassigned branch, Staff cost/null, invalid
  date/value and expanded canonical stock-number cases are covered.
- Final responsive checks at **320/375/430/768/1024/1440/1920px**, narrow long review,
  three role regression scans and nine final native/state captures give **20 final
  Axe scans** with zero violations. Page-width checks pass; all final capture states
  record zero page errors. Captures include Staff, pending, profile error, invalid
  first-field focus, long assignment and the scrolled review footer.
- Real production Edge -> Express -> isolated PostgreSQL verified **three UI POSTs,
  three saved records and exactly three CREATE audits**. Complete review and cancel
  precede the first save. Exact maximum cost, zero mileage and Lagos instant persist;
  valid saves focus/open the existing photo editor. A committed dropped response
  stays locked after reload; manual stock reading and explicit new-draft actions
  send no POST. Staff cost is omitted, reassignment before confirmation sends no
  request, a direct foreign-branch POST is forbidden, and Customer/anonymous reads
  are denied. No photo or listing is created. Detail reads retain their existing
  separate READ audits. Synthetic fixtures are preserved; owned sessions are removed.
- Frontend/backend TypeScript, focused lint and the final standalone build pass.
  OpenAPI validates **270 paths** and **323 operations** match mounted routes; client
  types are regenerated and coverage is updated. **18 SHA-256 source hashes** match
  the final tested production snapshot. No application source changed after that
  build.

Earlier failures are retained: an invalid union access was caught by TypeScript;
the initial API audit assertion used actorUserId instead of the stored userId;
the first browser run exposed React Hook Form registration order skipping the
first visual invalid branch. The assertion and focus behavior were corrected and
affected cases passed. Off-page draft restoration was added before final acceptance.
An initial API attempt ran while the stopped owned cluster was still starting; it
made no fixture writes and was resumed only after readiness. No database repair or
test weakening was used.

## Database and release boundaries

The owned existing cluster was confirmed stopped and restarted at **127.0.0.1:55480**;
its data directory was preserved. Before fixture writes the actual database
**allied_work_aftercare_20261017_test**, host, port and isolated-test environment
were verified. The existing restricted runtime account was reused. Current
`db:check` passes all **59 migrations**, history/checksums and schema compatibility
without changing the database. Unchanged empty replay and privilege evidence from
milestone 67 were reused. No reset, application/shared database write, grant change,
new migration, backup/restore operation, push or deployment occurred.

Deploy the canonical-length validation with the dependent frontend and verify the
target. ADM-24 is optional durable original-request recovery; ADM-23 remains the
separate inherited stock-query contract gap. Next: vehicle detail
`/admin/vehicles/[vehicleId]`. The overall goal remains active.

Evidence lives outside the repository under `C:/Users/PC/.codex/`:
`work-vehicle-create-initial-e2e.log`, `work-vehicle-create-final-e2e.log`,
`work-vehicle-create-unit.log`, `work-vehicle-create-unit-focused.log`,
`work-vehicle-create-api-tests.log`, `work-vehicle-create-api-focused.log`,
`work-vehicle-create-real.log`, `work-vehicle-create-dbcheck.log`,
`work-vehicle-create-captures.json`, `work-vehicle-create-source-hashes.json`, and
matching final build/static/contract logs and captures.
