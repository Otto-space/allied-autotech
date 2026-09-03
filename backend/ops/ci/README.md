# Continuous integration gates

CI must run a clean locked dependency install, `npm run check`, `npm run build`,
and `npm run test:coverage`. Migration replay must run through
`npm run test:migrations` only against an ephemeral PostgreSQL database whose
name ends in `_test` or `_ci`, with `NODE_ENV=test` and
`ALLOW_DESTRUCTIVE_MIGRATION_REPLAY=true`. The guard deliberately refuses any
run missing one of these conditions.

Dependency audit results must be triaged rather than automatically force-fixed.
The current Prisma CLI transitive advisories require a compatible upstream
release and must not be addressed by npm's proposed breaking Prisma downgrade.
