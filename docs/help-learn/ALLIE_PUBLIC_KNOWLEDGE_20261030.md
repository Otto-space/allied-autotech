
### 30 October 2026: Allie candidate ranking before limits

Found a recall defect: public service/product/vehicle queries selected twelve matches
by ID before downstream relevance ranking. With many weak matches, the requested
record could never reach Allie. Added parameterised database candidate ranking using
title/name/brand/make/model term coverage before description coverage, with stable
ID tie-breaking and twelve IDs per catalogue. The bounded eight-term input uses
literal substring matching, not SQL patterns or user-supplied SQL.

The SQL prefilter mirrors current public visibility; canonical ORM visibility filters
and public projections are reapplied when loading candidates. Existing follow-up
IDs, exact amounts, full faults/restrictions, four-source/8000-character context
budget, permission checks and invalidation remain intact. Empty/no-keyword requests
no longer retrieve twelve arbitrary services. Pipeline revision is public-knowledge-v3
to invalidate old conversation context on rollout. No new migration or dependency.

The new native test creates 753 public catalogue records, placing the relevant
service/product/vehicle listing after 250 weaker IDs in each catalogue. All three
rank first; full retrieval finds them within the 36-new-source cap, preserves price
and fault disclosure, returns no arbitrary result for a stopword-only query, and
excludes all three after unpublication. This is a bounded local relevance proof,
not a production latency/load benchmark. Whole-catalogue revision hashing remains
linear and production-volume performance still needs evidence.

Fresh aat_allie_ranking_fa1c0e7425_test at 127.0.0.1:49293 passed 80-migration replay,
no drift and db:check. All 18 native integration tests pass across ranking, canonical
knowledge and conversation security (20.55s). All 76 focused unit tests, backend
types, scoped lint, formatting and diff whitespace checks pass. Initial scale
fixture failed publication constraints; corrected timestamps and one vehicle per
live listing, without relaxing database rules. That failed run is not a pass.
No paid OpenAI call, application database write or deployment occurred. Both test
clusters stopped and their disposable data removed; logs retained in TEMP under
aat-allie-ranking-03f09291385842a283ef5c33741950c1 and
aat-allie-ranking-58028acd4fa24e1b987061f6dea45d1b.

Remaining: complete policy/capability source audit, native rendered booking/Allie
journeys, remaining delivery/auth acceptance, provider test-mode setup and broader
completion gates. Full objective remains active; production stays at fc318618.

# Allie canonical knowledge checkpoint

## Allie public service knowledge — 30 October 2026

Implemented canonical public Service retrieval in the existing Allie conversation
pipeline. Search reads only active services, uses the existing serviceSelect public
projection, bounds question terms to eight and new matches to twelve, and re-reads
up to twenty-four prior source IDs for bounded follow-ups. No catalogue write, URL
fetch, private record, stock claim or appointment availability inference is added.
Fixed prices retain integer minor-unit precision; quotations remain unknown. Complete
conditions are preserved; passages exceeding 6000 characters are omitted rather than
cropped. The established four-source/8000-character model budget remains intact.

Internal sources include the canonical record ID, public permission, record version,
content SHA-256, record update time and retrieval time. A database-computed SHA-256
of current public service fields supplies the conversation revision. Changes even
without a version bump, and unpublication, invalidate history through existing read,
in-flight permission checks, pre/post-provider validation and final commit checks.
The versioned canonical records remain the source of truth; no duplicated index or
new migration was introduced. Browser citation validation now permits only a service
UUID whose destination exactly matches its source, never a model-supplied URL.

Verification: 71 backend unit tests, 20 frontend conversation tests, backend/frontend
type checks, scoped lint and formatting pass. A fresh native loopback
`aat_allie_services_native_20261030_test` replayed all 80 migrations and passed
no-drift/db:check. Sixteen integration tests passed, including the fifteen existing
actual-HTTP conversation security tests and new canonical service retrieval,
quotation/price precision, draft exclusion, follow-up, edit-during-answer rejection
and unpublication checks. Provider transport was mocked; no paid call occurred.
The initial Docker run stopped at the strict native-loopback identity guard before
fixtures; it is not counted as passing. The native rerun preserved that guard.
Task Docker container removed. Native cluster stopped and its 76,976,538 disposable
bytes removed after path/link/process checks; small log retained under temporary
`aat-allie-native-f5baa113bbca441087772d0d65991ac0`. Final C: reserve: 22.94 GiB.

Remaining: public product/vehicle/business sources and full capability/policy source
coverage, service-citation rendered browser acceptance, large-catalogue retrieval
quality/performance, workforce booking integration and external provider acceptance.
Current source package is not the complete knowledge pipeline or an activation.
No flags, production deployment, actual customer message or application DB changed.

## Product and vehicle knowledge checkpoint — 30 October 2026

Extended the same pipeline to canonical published products and vehicles. Product
reads reuse activeProductWhere, including category/parent visibility. Vehicle reads
reuse publicWhere and a subset of publicListingSelect, retaining owner-reported
faults and the latest public inspection. Private VIN, acquisition cost, stock number,
report object key and document hash never enter passages. Prices preserve minor
units. Product text does not infer stock or fitment; vehicle text does not infer
safety, reserve stock or authorise payment. Each type has at most twelve new matches
and twenty-four previously cited records, with previous IDs fetched separately so
new matches cannot displace follow-up evidence. Overall four-source/model limits
remain. Browser links are bound to the exact type and UUID.

The combined SHA-256 revision now covers the public catalogue fields, relevant
publication predicates, branch location and inspection content. Hiding a parent
category or vehicle branch removes the corresponding source and changes the revision.
The internal transformation revision is public-knowledge-v2. Products have no record
version column, so their source format version is 1; content hash and global revision
track edits rather than claiming a product record version exists.

Verification: 71 backend unit tests, 22 frontend conversation tests, both type checks,
scoped lint, formatting and diff whitespace checks pass. Fifteen existing native HTTP
conversation security cases passed. The new catalogue fixture initially failed the
existing report-reference/checksum pairing constraint; the synthetic fixture was
corrected without changing application safeguards. Its two focused integration cases
then passed on fresh loopback aat_allie_catalogue_final_20261030_test, including
public price precision, draft/private-field exclusion, source changes, faults,
inspection updates, follow-ups and category/branch removal. Both native targets
replayed all 80 migrations, no drift and db:check passed. Native clusters were
stopped; 153,451,142 task-generated bytes removed after exact path/link/process checks.
Small diagnostic logs retained. Final C: reserve 22.93 GiB.

No production write, deployment, extra migration, paid model call or feature activation.
Business-information sources, full capability/policy coverage, rendered catalogue
citation acceptance, larger-catalogue retrieval quality/performance and the other
booking/payment readiness work remain open. Current source coverage is not a claim
that live stock or individual booking status tools have been implemented.

## Business information and rendered citations — 30 October 2026

Added reviewed public business-contact article v1, sourced from the existing
frontend/lib/business.ts Contact copy and the backend collection address. It states
the full Stadium Road address, public support email and published customer-care
hours, explicitly distinct from workshop availability. Whatsapp is a normal Contact
link; no number is exposed in the article and opening it does not send a message or
confirm a visit. This is a reviewed static publication, not a live opening-hours tool.
Changes to the referenced business sources require article review/versioning; current
article text is included in the existing history/in-flight source hash. /contact is
now an allowed help/navigation destination in backend and frontend contracts.

76 backend unit checks and 35 frontend help/conversation checks pass. Both type
checks and scoped lint pass. New rendered fixture tests pass 2/2 at 390x900 and
1440x900 on http://127.0.0.1:3021. They display business, service, product and vehicle
citations, verify each exact link, follow Open Contact, check modal dismissal,
address content and visible destination breadcrumb, and assert no overflow,
unexpected writes/requests or console errors. Scoped Axe found zero violations.
Screenshots were inspected at both sizes. Browser plugin absent; existing Playwright
workflow used. Allie responses were mocked; no model or customer operation occurred.

Initial render run found the reused local preview had HELP_LEARN disabled; its
verified task-owned process was restarted with the local test flag enabled. The
next run exposed the fixture's missing public-branches response on Contact; the
fixture was completed without suppressing assertions, then both cases passed.
These failed setup/fixture runs are not counted as passing. Current preview remains
available for subsequent local checks. Screenshots are outside the repository under
%TEMP%/aat-allie-catalogue-browser-final, in the two canonical-citation test folders.
C: reserve passed at 23.10 GiB. No production configuration, deployment or paid call.

Remaining scope includes actual catalogue-detail navigation/browser acceptance beyond
link identity, larger-catalogue retrieval quality/performance, complete capability
and policy coverage audit, workforce booking integration, notification/capacity and
provider test-mode/operational acceptance. This checkpoint does not complete the goal.
