# Administrator service catalogue contracts

Reviewed locally on 12 October 2026. ADM-01 and ADM-02 are implemented with API/PostgreSQL acceptance. Catalogue integration is locally accepted as the fifty-second frontend milestone; administrator detail is accepted as the fifty-third. Deployment remains pending.

## Behavior

`GET /api/v1/admin/services` now accepts optional `search` and `categoryId` alongside the existing `cursor`, `limit`, `pricingType` and `isActive` parameters. Search trims surrounding whitespace and accepts 2-100 characters without control characters. It performs a case-insensitive literal substring match across `name`, `shortDescription` and `description`; `%`, `_`, backslashes and SQL-like input are treated as text. Category, pricing and visibility predicates combine before pagination. Assigned inactive categories remain available to administrators.

The list retains ascending UUID order, its existing page envelope and UUID `nextCursor`. Administrator paging now uses the exclusive `id > cursor` position, so a removed or reclassified cursor record cannot terminate traversal. Existing UUID callers continue working. Cursors are positions, not signed filter bindings or snapshots. Clients must reset them when filters change and refresh page one to observe newly inserted or changed records before the current position. This does not modify public service list/discovery pagination.

`GET /api/v1/admin/services/{serviceId}` reads one service independently of pagination. It returns the current editable fields, revision, assigned category and authorized image metadata, including inactive services. The existing explicit projection excludes media storage internals. Image URLs use the existing authenticated service-image content route. Missing services return 404; malformed IDs or unexpected query parameters return 422.

Both reads use the existing Admin/Super Admin authorization and MFA checks. Staff, customers and anonymous callers remain denied. Responses retain private/no-store headers. A detail read does not relax PATCH version checks, CSRF checks, category-assignment policy or the rules for deactivating services with active bookings. Service creation and media mutation contracts are unchanged.

## Implementation

- [Query validation](../src/modules/service-operations/service-operations.schemas.ts), [repository](../src/modules/service-operations/service-operations.repository.ts), [service](../src/modules/service-operations/service-operations.service.ts), [controller](../src/modules/service-operations/service-operations.controller.ts) and [routes](../src/modules/service-operations/service-operations.routes.ts).
- [OpenAPI definitions](../src/modules/service-operations/service-operations.openapi.ts) explicitly type administrator list/detail responses. The [exported contract](api/allied-autotech.openapi.json), [handbook](api/endpoint-handbook.md) and [frontend types](../../frontend/lib/api/generated.d.ts) were regenerated.
- Existing service discovery indexes cover the searched text fields and category scope. A normal `EXPLAIN (ANALYZE, BUFFERS)` for selective search after a 10,000-record synthetic bulk load selected the existing `Service_name_search_idx`. No planner switches were forced. This is evidence for selective search, not a claim that broad or two-character searches always use GIN or that production latency is established. No schema change or migration was added.

## Local evidence

Tests used the explicitly enabled isolated PostgreSQL database `allied_slots_20261012_test` on localhost port 55439, not the application database. Providers were disabled by test setup; generated account sessions were removed after the new suite. Synthetic catalogue records remain in that disposable database.

The [new integration suite](../tests/integration/admin-service-catalogue.test.ts) passes all 14 cases. It covers full-catalogue traversal beyond page one, combined filters, literal matching in all three fields, unchanged UUID clients, changed/deleted anchors, both administrator roles, inactive services/categories, null legacy fields, private headers, authorization/MFA, malformed/repeated/oversized inputs, current revisions, stale PATCH and CSRF rejection, exactly one update audit, actual managed-image attachment with safe projections, and the 10,000-record query-plan check.

The initial combined run passed 40 cases across the new suite and existing service discovery, service media, HTTP boundary and policy tests. The final 14-case run added one query-plan case, yielding **41 distinct passing cases**, not 54. Existing discovery coverage also exercises 10,000 synthetic services. Commands ran with `RUN_DATABASE_TESTS=true`, `TEST_DB_NAME=allied_slots_20261012_test` and explicit local test-database connection settings:

```text
npx vitest run tests/integration/admin-service-catalogue.test.ts tests/integration/service-discovery.test.ts tests/integration/service-media.test.ts tests/api/phase5-service-operations-boundaries.test.ts tests/unit/phase5-service-operations-security.test.ts --maxWorkers=1
npx vitest run tests/integration/admin-service-catalogue.test.ts --maxWorkers=1
npm run typecheck
npm run build
npm run check:scripts
npm run openapi:export
npm run check:openapi
npm run check:routes
npm run lint
npm run check:secrets
```

All passed. OpenAPI validation covers 267 paths; route coverage matched 317 documented operations and four explicit infrastructure routes. Changed source/test formatting passed. In `frontend/`, `npm run api:types` and `npx tsc --noEmit` passed; the generated declaration was formatted using the repository's Prettier configuration. Runtime emitted existing experimental Web Crypto and pg concurrent-query deprecation warnings; no test failed.

Local logs: `C:/Users/PC/.codex/admin-services-contract-tests.log`, `admin-services-contract-final.log`, `admin-services-contract-types.log` and `admin-services-frontend-types.log`. These machine-local logs supplement the committed tests; they are not deployment evidence.

## Remaining integration and release

1. Catalogue integration is locally accepted: administrator search/category controls use URL-backed filters, cursor reset and browser history. Real browser/API/database checks verified 25+2 pagination and search beyond the first page. See the [page acceptance](../../frontend/docs/page-quality/work-services.md).
2. The inline editor now uses direct reads and pre-save reconciliation, preserving versioned review, explicit uncertain-outcome handling and authorized media management. A fresh read is still subject to a concurrent change before PATCH, which retains its atomic revision check.
3. The catalogue gate passed 45 distinct production-browser scenarios, six final layout/interaction repeats, static/build checks and real browser/API/database verification. The separately addressable service detail route has now passed its own [local gate](../../frontend/docs/page-quality/work-service-detail.md): direct/reloaded URLs outside the current catalogue page, exact-money edits, cancellation, revision/CSRF rejection, uncertain-response recovery without replay and image upload/description/reload/removal. The detail and shared regression suite has 65 distinct passing scenarios; two initial artifact-teardown failures passed unchanged with a dedicated output directory. These remain separate local acceptance scopes.
4. Deploy the additive API before its dependent frontend; no new migration or provider activation is required. Verify authenticated reads, private media and existing mutation behavior in the target environment. Deployment has not been performed.
