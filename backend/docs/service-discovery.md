# Service discovery and category management

API-03 adds catalogue-wide service discovery while preserving the existing service list, detail, media and booking contracts.

## Routes

| Method | Path | Authority |
| --- | --- | --- |
| GET | `/public/services/discovery` | Anonymous |
| GET | `/public/services/categories` | Anonymous |
| GET | `/public/services/categories/{categoryId}` | Anonymous |
| GET | `/admin/service-categories` | Admin or Super Admin with verified MFA |
| POST | `/admin/service-categories` | Admin or Super Admin with verified MFA and CSRF |
| PATCH | `/admin/service-categories/{categoryId}` | Admin or Super Admin with verified MFA and CSRF |

All paths are relative to `/api/v1`, use the existing response/error envelopes and inherit global request limits. Category creation has an additional sensitive-operation rate limit. Staff and customers cannot administer categories. Administrative responses are private and uncached.

## Discovery

The discovery endpoint accepts `search`, `categoryId`, `pricingType`, `sort`, `cursor` and `limit`. Unknown keys fail validation. Search trims surrounding whitespace, requires 2–100 characters, rejects control characters and performs literal case-insensitive substring matching across service name, short description and description. SQL wildcard characters are escaped and request values remain parameters. Existing PostgreSQL `pg_trgm` support supplies separate GIN indexes for these fields.

Only active services are returned. `pricingType` is `FIXED` or `QUOTE_REQUIRED`. A category filter must refer to an active category; inactive or unknown category IDs match no services. Without a category filter, active services with no category or an archived category remain visible.

Sort options are `name` (default, ascending), `newest` (creation time descending) and `duration_asc` (ascending, unknown durations last). Unique service IDs break ties in the matching direction. No quote-required price is presented as a comparable fixed price. Limits default to 20 and cap at 50; the frontend requests 12.

Responses include safe service/media/category projections, exact `totalMatches` and optional `nextCursor`. The page and filtered count share one repeatable-read transaction. Signed cursors bind endpoint, filters and sorting, carry the last sort value/ID and continue after a deleted or unpublished anchor. Changing filters/sort or tampering with the cursor fails with 422. A legacy UUID cursor is accepted only when its anchor currently matches the query. Separate requests do not share a snapshot: concurrent edits can move records between pages. Changing page size is allowed.

## Category lifecycle

Categories have a stable UUID, name, unique normalized slug, optional description, active flag, optimistic version and timestamps. Admins create and update them at `/admin/service-categories`; `expectedVersion` is required for updates. No hard-delete endpoint is provided. Duplicate slugs and stale versions return 409. After an uncertain creation response, refresh the list before retrying; the unique slug prevents duplicate records with that slug.

Service create/update bodies accept nullable `categoryId`. New assignments require an active category. Omission preserves the existing assignment; `null` clears it. Category mutations and assignment validation share a transaction-scoped advisory lock. Category changes are audited as `SERVICE_CATEGORY`; service changes retain their existing `SERVICE` audit events and version checks. Audit filtering accepts the new entity type.

Archiving a category removes its public options and category metadata. It does not deactivate services, hide their images, cancel bookings or change pricing. Reactivation restores grouping for active assigned services. The service admin form omits unchanged category assignments, so an archived assignment does not prevent unrelated service edits.

Category options support literal case-insensitive name-prefix search and signed pagination in ascending name/ID order. Public options include only active categories with at least one active service and cap at 50. The public detail endpoint applies the same rule and supports restoring a selected option after reload. Admin options include inactive and empty categories, support `isActive` filtering, and cap at 100. Category assignment pickers request active options only.

## Frontend and rollout

`/services` uses the new discovery endpoint for both server rendering and client navigation. Search, category, pricing, sorting and page cursors persist in the URL. Previous-page history is bounded to 3,500 characters and is never forwarded to the API. A failed cursor can restart the current search. Category options are searched and paged on the backend. Admin and Super Admin navigation exposes Service categories; service editing includes optional category assignment.

Deploy migration `20261009140000_service_discovery`, regenerate Prisma, and deploy the backend before the dependent frontend. Existing services receive a nullable category relationship; there is no taxonomy backfill or publication change. The migration requires the `pg_trgm` extension already installed by `20260904111500_phase_4_query_indexes`. It adds category persistence, an audit enum value, a nullable foreign key and discovery indexes. Index creation can take locks on an existing catalogue; schedule migration execution accordingly.

Local verification uses `allied_service_discovery_20261009_test`, created separately from the application database. The browser helper refuses any other database and writes synthetic session credentials only to a temporary local fixture file. It does not enable external storage or payment/notification providers. Deployment and real object-storage verification remain separate acceptance steps.

## Verification commands

The subsequent [complete backend audit](backend-completion-audit.md) found that the four migrated service/category GIN indexes were missing from `schema.prisma`. Their exact declarations are now included, so schema comparison no longer proposes dropping them. The migration-replay command now checks that comparison automatically. No additional database migration or search behavior change is required.

Backend: `npm run prisma:generate`, `npm run typecheck`, `npm run lint`, `npm run check:secrets`, `npm run openapi:export`, `npm run check:openapi`, `npm run check:routes`, and the discovery/service-flow/media/security/OpenAPI/migration Vitest suites.

Frontend: `npm run api:types`, `npm run typecheck`, `npm test`, targeted ESLint/Prettier, `npm run build`, and Playwright `services-quality.spec.ts` plus `service-discovery-real.spec.ts`. The real browser tests require `SERVICE_DISCOVERY_REAL=true`, the isolated helper API on 5025 and the preview configured with `BACKEND_ORIGIN=http://127.0.0.1:5025`. Browser plugin not available; verification uses the repository Playwright workflow with Microsoft Edge.
