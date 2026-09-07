# Deployment configuration

The first DigitalOcean App Platform staging specification is maintained as a
fail-closed template in
[`../digitalocean/staging.app.yaml.template`](../digitalocean/staging.app.yaml.template).
It defines a digest-pinned API service, a digest-pinned pre-deploy migration
job, managed PostgreSQL attachment, readiness/liveness checks, and runtime-only
environment scopes.

Do not submit the template directly. Create a private deployment copy, replace
every `REPLACE_*` marker, validate the proxy and database assumptions in the
staging runbook, and keep the populated copy out of Git.
