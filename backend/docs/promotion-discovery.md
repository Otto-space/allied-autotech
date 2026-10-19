# Promotion discovery

Locally verified 17 October 2026 with frontend
[gate 65](../../frontend/docs/page-quality/work-promotions.md).

`GET /api/v1/admin/promotions` now accepts optional trimmed printable `search`
text (1–160 characters) and `discountType` (`PERCENTAGE`/`FIXED_AMOUNT`). Search is
a case-insensitive literal substring of name or code; percent, underscore and
backslash are escaped before Prisma's contains filters. These filters compose with
the existing `isActive`, limit and createdAt/ID-descending cursor pagination. Clients
reset the cursor when changing filters. No global count or cross-request snapshot
is implied. Administrator/Super Admin role and verified MFA remain required.

The administrator router now explicitly uses `Cache-Control: private, no-store`,
including successful list/direct/mutation responses. Customer preview semantics,
discount calculations, eligibility checks, limits, versioned edits and auditing are
unchanged. Enabled remains a configuration flag; the list does not expose redemption
counts, remaining uses or a computed checkout-eligibility status.

Three database-enabled cases passed: 25+3 tied-date paging; name/code search and
combined configuration/type filters; literal special characters; precise saved
timestamps; absent invented counts; administrator/MFA and denied role/anonymous
boundaries; invalid and repeated query values. Synthetic promotions and usage/audit
checks confirmed that discovery did not mutate promotion records or create usage.

Real production-browser/Express/PostgreSQL acceptance passed 25+3 paging with stable
reload, combined filters, literal name and case-insensitive code lookup, exact 12.34%
and fixed-kobo display, sub-minute dates, named detail navigation/back, denied refresh
clearing cached private records and Staff/Customer/anonymous rejection. Promotion
rows were unchanged, with zero promotion writes, usages, promotion audits or browser
errors. Backend typecheck/lint, formatting, exported OpenAPI/types, 269-path validation
and 322-operation coverage passed. Production-volume search performance was not
benchmarked; no new database index is claimed.

Deploy the additive query contract before the matching frontend. Deployed access,
private caching, literal search and paging acceptance remain open. Creation and detail
have separate frontend gates; this work did not approve business content or activate
an application promotion.

Only isolated `allied_work_aftercare_20261017_test` on `127.0.0.1:55480` was used,
with actual target identity verified before helper writes. The preceding 58-migration
empty replay, db:check and restricted-runtime verification were reused because the
database schema is unchanged. Fixtures remain preserved; helpers remove only their
own synthetic sessions. No application/shared/staging/production data or grants changed. No database schema
migration, backup operation, restore rehearsal, off-device recovery verification
or deployment occurred.
