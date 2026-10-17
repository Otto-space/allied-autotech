# Administrator product categories

Reviewed 13 October 2026. These additive contracts support `/admin/categories`.
They apply to product categories; service categories have a separate contract and
different deactivation rules. Deployment and target-environment acceptance remain open.

## Contracts

- `GET /admin/catalog/categories` accepts optional `search`: a trimmed, literal,
  case-insensitive **name prefix**, up to 120 characters. `%`, `_` and backslashes
  are escaped for the database pattern. It combines with `isActive` and existing
  UUID cursor pagination, ordered by name then ID. Default limit is 25; maximum 100.
  This is live pagination, not a historical snapshot. Changing a filter resets the
  browser cursor and bounded history. Public category discovery is unchanged.
- `GET /admin/catalog/categories/{categoryId}` reads any existing category directly,
  including inactive or empty categories, independently of the current page. It
  requires a UUID and an empty query; missing records return 404. The projection is
  exactly `id`, `name`, `slug`, nullable `description`, `isActive`, `createdAt` and
  `updatedAt`. It exposes no products, stock or customer records and creates no audit.
  Administrator list and direct responses use `Cache-Control: private, no-store`.
- `PATCH /admin/catalog/categories/{categoryId}` accepts optional
  `expectedUpdatedAt`, an offset-aware timestamp with millisecond precision. It
  must accompany a changed-field payload. The service takes the category advisory
  lock and row lock, compares the observed timestamp, then writes and audits in
  the same transaction. A mismatch returns 409 without mutation/audit. Every
  successful update advances `updatedAt` by at least one millisecond, including
  legacy requests and timestamps ahead of the application clock. Audit field lists
  exclude the precondition.

Admin/Super Admin, MFA, CSRF and validation rules remain authoritative. Older
clients may omit the precondition but then receive no stale-snapshot protection.
The dedicated editor always sends it. No original-request receipt is introduced.

## Category eligibility under concurrency

An active product cannot belong to an inactive category. A category containing
active products cannot be deactivated. Product creation already used the shared
category advisory lock; product updates now acquire it for the destination category
before checking eligibility. Category deactivation uses the same lock. This closes
the activation/reassignment race with deactivation without deleting products.
The update path retains its product row lock; category deactivation reads the active
product count without taking product row locks.

## Local backend verification

`tests/integration/admin-product-categories.test.ts` adds 14 cases: both administrator
roles and visibility states, Staff/Customer denial, literal prefix search and paging,
direct reads beyond 25 records, strict UUID/query validation, anonymous/MFA/CSRF
boundaries, simultaneous observed edits, monotonic timestamps and legacy writes,
payload/deactivation rules, and a deterministic category-lock race. The race holds
an uncommitted category deactivation, observes the product update waiting on the
advisory lock, then verifies rejection with no product/audit change.

All **34 focused and related cases** passed: 14 new cases, 16 administrator-product
cases, one phase-four flow and three phase-four boundary cases. TypeScript, lint,
backend build, client generation, OpenAPI export/validation (267 paths), route
coverage (320 operations) and frontend type generation passed. An initial OpenAPI
typing error was corrected by importing the existing empty-query schema and removing
its default wrapper for route documentation.

Fresh isolated PostgreSQL 18 databases:

- `127.0.0.1:55440 / allied_product_categories_20261013_test` — backend scenarios.
- `127.0.0.1:55440 / allied_product_categories_ui_20261013_test` — browser/API scenarios.

For each, cluster identity and database absence were verified before creation; all
58 migrations replayed from empty and `npm run db:check`'s database-safety checker
passed. Newly created runtime roles had no superuser, role/database creation,
replication, bypass-RLS, schema CREATE, table ownership or TRUNCATE privileges.
Migration credentials were separate. Tests preserve synthetic domain records and
remove only their own synthetic sessions. No schema or migration changed, no
application/shared/staging/production data or existing grants changed, and no
backup/restore rehearsal, off-device recovery verification or deployment occurred.

## Frontend and release handoff

See [page acceptance](../../frontend/docs/page-quality/work-product-categories.md)
for final browser/static evidence, concepts and the responsive comparison. The editor
uses direct reads, observed timestamps and explicit review. Interrupted saves stay
locked through reload; edits can reload the saved category, while creation requires
manual catalogue reconciliation before a new blank draft. This is not a durable
original-request receipt.

Deploy the API before the dependent frontend, then verify target role/MFA/CSRF,
private reads, name-prefix filtering, simultaneous edits and category eligibility.
Product-category creation receipts remain an optional separate reliability extension.


## Detail-page acceptance — 17 October 2026

The separately addressable [product-category detail page](../../frontend/docs/page-quality/work-product-category-detail.md) is locally accepted with 43 detail/catalogue browser cases, 31 unit cases, static/build checks and real browser/API/database evidence. It uses these existing contracts without further backend/schema changes. A fresh isolated `allied_product_category_detail_20261017_test` at `127.0.0.1:55480` replayed 58 migrations, passed database safety checks and used a verified restricted runtime role. No application-data/grant change, backup/restore rehearsal or deployment occurred. Creation receipts and deployed verification remain separate.
