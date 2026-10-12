# Runtime process configuration

The current exact command and per-process environment matrix is in [the owner staging runbook](owner-staging-runbook.md#package-build-and-process-commands). Use `.env.staging.example` and `.env.production.example` as placeholder inventories, then scope secrets per process.

The general worker runs notification delivery, webhook retry, one-hour reminders, refund submission/reconciliation, media cleanup, expiration and operational alerts. Payment reconciliation is separately enabled. Persisted leases/state provide recovery; worker heartbeats report starts, successes and failures. Monitor `/admin/operations/status` externally; the endpoint itself is not a paging service.

All hosted processes use strict PostgreSQL TLS through `aat-with-database-ca`. Migrations receive only DB configuration. General-worker signing keys must match the API. Identity-worker delivery can be disabled without falsely recording delivery or bypassing verification. Hosted docs remain disabled.

Hosted API and general-worker startup require an HTTPS object-storage endpoint, bucket and explicit credentials. The cleanup worker must target the same private storage as the API. The deployment template supplies these settings only to those two processes. Runtime images must install platform-specific optional dependencies: Sharp uses them for image validation/transformation. `scripts/deployment/media-runtime-probe.mjs` exercises PNG decode and WebP encode without a database or network.

See [media runtime deployment correction](media-runtime-deployment.md) for local evidence and the remaining Linux-container and Spaces release checks.

Operational alert scans use migration 58's durable checkpoints to advance through disputes, refunds, payments and paid vehicle holds in pages of 100. Apply that migration before starting the matching general worker. See [scan recovery and verification](operational-alert-scans.md).
