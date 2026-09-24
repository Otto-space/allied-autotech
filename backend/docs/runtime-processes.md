# Runtime process configuration

The current exact command and per-process environment matrix is in [the owner staging runbook](owner-staging-runbook.md#package-build-and-process-commands). Use `.env.staging.example` and `.env.production.example` as placeholder inventories, then scope secrets per process.

The general worker runs notification delivery, webhook retry, one-hour reminders, refund submission/reconciliation, expiration and operational alerts. Payment reconciliation is separately enabled. Persisted leases/state provide recovery; worker heartbeats report starts, successes and failures. Monitor `/admin/operations/status` externally; the endpoint itself is not a paging service.

All hosted processes use strict PostgreSQL TLS through `aat-with-database-ca`. Migrations receive only DB configuration. General-worker signing keys must match the API. Identity-worker delivery can be disabled without falsely recording delivery or bypassing verification. Hosted docs remain disabled.
