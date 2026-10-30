### 30 October 2026: completed source package published

Source e8a40784 is integrated into master and published to both domains with matching
backend c886268a-6929-4053-95b0-7930f054bdb7. Exact-master CI, fresh backup/isolated
restore, protected forward migration (80 total), runtime privilege checks, seven
worker heartbeats and six hosted fixture journeys have passing evidence. Capability
flags remain unchanged. Full brief and actual owner category import remain open.
See backend/docs/efficient-delivery-production-20261030.md for receipts, failures,
corrections and acceptance limits.

# Owner service structure — 30 October 2026

Source: owner attachment 38377853-30d5-443f-aa6b-55bdd6c6eaa5/Pasted text.txt, read in full.
Navigation stays Services, Shop, Vehicles. Shop still includes oils and automotive essentials.

## Current evidence and mapping

Read-only public API inspection found one Tyre Change service, ID
669f57ce-6e45-46f8-a9c4-75aa56f9d169, slug tyre-change, version 4,
categoryId null, fixed NGN 1,000,000 and duration 30 minutes. Preserve those values.
/public/services/categories?limit=50 returned an empty list; this does not prove
there are no inactive or empty categories because the existing endpoint filters them out.
Inspect the authorised full category list before import.

| Owner group | Existing service to associate |
| --- | --- |
| Tyre & Wheel Maintenance | Existing Tyre Change, after full association recheck |
| Vehicle Diagnostics & Inspections | No published individual service identified |
| ECU Programming & Vehicle Electronics | No published individual service identified |
| Suspension Repairs | No published individual service identified |
| Engine & Drive System Maintenance | No published individual service identified |
| Vehicle AC Maintenance | No published individual service identified |
| Bodywork & Painting | No published individual service identified |
| Interior Repairs | No published individual service identified |

## Implementation checkpoint

ServiceCategory already has stable IDs, unique slugs, descriptions, publication,
versions and service relationships. Existing administrator APIs edit descriptions
and associations with authorization, CSRF, audit and stale-version guards.
Ordering and category media are absent. Public category responses omit descriptions
and exclude groups without active services: these contracts need extending.

owner-service-structure.ts contains the eight approved names and conservative
explanations as import input, not a parallel public catalogue. Its reconciliation
planner reuses IDs and legacy slugs, includes all supplied records (including inactive
ones), creates only missing groups and rejects ambiguous name/slug matches.
Three unit tests pass: identity preservation, repeated-import planning and ambiguity.
It does not yet perform an import, reactivate categories or change production.

## Remaining implementation and acceptance

1. Extend existing category authoring for order and imagery using existing media controls;
   forward migration and isolated replay required if fields are added.
2. Add reviewed authenticated idempotent import using all existing categories; verify
   Tyre Change current version/association immediately before its ordinary update.
3. Expose active empty groups with descriptions; implement responsive icon/image cards,
   direct category links, truthful filtered-empty versus group-enquiry states.
4. Carry stable category context through enquiry, concern requests, sign-in and stored
   bookings, customer/staff views and normal review actions. No invented service/price.
5. Update Home pathways, detail breadcrumbs, metadata, Help/Learn and allowlisted
   Allie sources from actual published category records with invalidation.
6. Test role checks, historical identity preservation, repeated import, mobile/keyboard,
   enquiry context, booking persistence, sparse/populated groups and unavailable data.

No production category mutation, new price, duration, guarantee, payment or message.

## Public group API acceptance

Active empty groups are now discoverable by list and direct ID, with maintained
description. Inactive groups remain absent/404. This reuses ServiceCategory and adds
no records or schema changes. Existing filter-bound cursors and active-service
filters are preserved. Nested service category responses remain compatible.
OpenAPI and frontend generated contracts regenerated; frontend parser accepts the
additive description field.

Fresh isolated aat_service_groups_3cd085809d_test at 127.0.0.1:60041 passed all
80 migration replays, no drift and db:check. All 25 native HTTP tests passed across
service-discovery and admin-service-category-detail (30.36 seconds), including
empty group detail/description, pagination, inactive exclusion, service associations,
permissions, MFA, CSRF and stale versions. Backend types and scoped oxlint passed.
The first export attempt lacked required environment fields; rerun used inert local
test values solely for contract generation, with no database connection or write.

Still pending: actual approved import, ordering/media authoring, customer group cards,
enquiry/booking category identity persistence, Allie sources and relevant learning
updates. API acceptance does not prove those customer journeys are implemented.

Service-request learning article advanced from v8 to v9: groups are broad work
areas, not priced services; no published individual offering does not mean the work
is unavailable. Four catalogue-learning units pass after correcting the version
bump. Frontend full type checking and scoped lint also pass. No guide targets,
permissions or feature flags changed. Customer rendering is still pending.

## Reviewed staff import implemented locally

Administrator workspace now offers Review owner service groups with the shared
accessible confirmation dialog. GET/POST /admin/service-categories/owner-structure
require verified administrator access; mutation also requires CSRF and the reviewed
revision. Category create/update/import share a transaction lock. Relevant category
identities and current Tyre Change version/association bind the review. Unrelated
category edits do not invalidate it. Conflicting name/slug mappings, changed relevant
records or Tyre Change already assigned elsewhere stop without partial writes.

Missing groups are created with approved names/descriptions; existing IDs, legacy
slugs, authored descriptions and active/inactive state remain intact. Only an existing
unassigned tyre-change service named Tyre Change is associated. Prices/duration and
service identity are preserved, no service is fabricated, and repeat application of
a fresh review adds neither duplicate records nor duplicate audit entries. Existing
inactive groups require a separate deliberate activation through their editor.

Native tests on fresh aat_owner_groups_cf5c1a3b17_test at 127.0.0.1:65031 passed
80-migration replay, no drift and db:check. All 30 integration cases passed across
owner import, discovery and category administration (58.35 seconds). The first run
caught overly broad revision invalidation under unrelated concurrent fixture writes;
corrected relevant-record revision and scoped assertions, retained failed-run evidence.
Backend types/oxlint and route coverage (476 documented operations) passed.

Two rendered fixture cases passed at 390/1440 (22.8 seconds), covering eight-group
review, no write before confirmation, cancel/focus return, one explicit save, scoped
Axe and overflow. Screenshots inspected under TEMP/aat-owner-groups-ui-fixed-20261030.
Initial runs exposed focus loss from disabling the asynchronous review opener;
kept it focusable with busy/disabled semantics and the existing synchronous operation
guard. This is mocked browser plus native API evidence, not native browser/API
composition or production acceptance. Full frontend types and scoped lint passed.

Added administrator-only owner-service-groups learning article v1. Seventeen role
and catalogue guidance tests passed, including exclusion of public/customer/staff
and unverified admin. Actual import has not run against production. Category ordering,
imagery, customer cards/context, and public Allie category knowledge remain pending.

## Customer group discovery and enquiry — 30 October 2026

Services now renders published categories from the existing API, with responsive
group cards, maintained descriptions and an empty-group enquiry route. Contact
verifies the category ID before prefilling its canonical name and stable link.
Untrusted query names/redirects are ignored. This uses the existing GENERAL enquiry
message and draft flow; structured booking category persistence is still pending.
No invented service, price, availability or production category import.

Eight enquiry units and two rendered fixture journeys at 390/1440 passed; scoped
Axe, refresh preservation, navigation and overflow were checked, with screenshots
reviewed under TEMP/aat-service-groups-ui-fixed-20261030. The first fixture run used
the wrong message selector and failed; the corrected rerun passed (35.8s).
Service-request guidance is v10; seven catalogue/planner units, full backend types
and backend lint passed during release preparation. Generated API declarations
were regenerated without formatting, honoring frontend/.prettierignore.

The owner explicitly requested publication on 30 October. This supersedes the
earlier brief's deployment prohibition, but does not enable gated capabilities or
authorize real charges. Production publication still requires exact-master CI,
compatible backend rollout and the documented database backup/recovery gates.
Ordering/media authoring, structured booking group context and Allie group sources
remain unfinished. This is local evidence, not a production acceptance claim.
