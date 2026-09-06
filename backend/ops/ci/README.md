# Continuous integration gates

CI must run a clean locked dependency install, `npm run check`, `npm run build`,
and `npm run test:coverage`. Migration replay must run through
`npm run test:migrations` only against an ephemeral PostgreSQL database whose
name ends in `_test` or `_ci`, with `NODE_ENV=test` and
`CONFIRM_EMPTY_MIGRATION_DATABASE=true`. The guard deliberately refuses any
run missing one of these conditions.

Dependency audit results must be triaged rather than automatically force-fixed.
The supported `mysql2` same-major override removes its advisories. Prisma CLI's
remaining `deepmerge-ts` advisory requires a compatible upstream release and
must not be addressed by npm's proposed breaking Prisma downgrade or an
untested transitive major override. Production-only API/worker installs omit
the Prisma CLI and both advisory-related packages.
