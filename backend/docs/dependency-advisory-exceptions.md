# Dependency advisory exceptions

## Prisma CLI / deepmerge-ts recursive-graph denial of service

- Recorded: 2026-09-11
- Review by: 2026-10-11 and on every Prisma release
- Owner: backend/security maintainer
- Status: temporarily accepted with restricted exposure
- Advisory: `GHSA-ggr8-5vv4-36mx` (`deepmerge-ts` stack exhaustion for recursive object graphs)
- Current chain: `prisma@7.10.0` → `@prisma/config@7.10.0` → `deepmerge-ts@7.1.5`

`npm audit` reports three high-severity entries for the single transitive advisory. At review time,
`@prisma/client` 7.10.0 was the latest stable client, the Prisma CLI package exposed only an 8.0
release candidate beyond 7.10.0, and npm's offered remediation was a breaking downgrade to Prisma
6.12.0. The patched `deepmerge-ts` is a new major version and Prisma pins 7.1.5, so an unreviewed
override is not considered compatible evidence.

Exposure is constrained as follows:

- `prisma` and `@prisma/config` are development/optional tooling and are omitted from the API and
  worker runtime dependency layer.
- The CLI exists in the build stage and the one-shot private migration image. The migration job
  accepts a reviewed repository-owned `prisma.config.ts` and operator-controlled environment;
  public HTTP input never reaches Prisma configuration merging.
- The migration component is non-public, runs only during reviewed releases, uses a least-privilege
  migration database role, and exits after `prisma migrate deploy`.
- Dependency audit output remains a release gate requiring triage. `npm audit fix --force` is
  prohibited because it would silently cross the locked Prisma major-version boundary.

Remove this exception as soon as a stable compatible Prisma release consumes `deepmerge-ts` 8 or
otherwise resolves the advisory. Any candidate upgrade must pass client generation, schema
validation, complete empty-database migration replay, development-database forward migration,
strict compilation, all database/security tests, and all four Linux container builds before merge.
