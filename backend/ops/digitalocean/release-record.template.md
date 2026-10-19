# Staging release record

Store the completed record with the private deployment evidence. Do not insert
credentials, certificates, provider payloads, or environment-variable values.

- Deployment date (UTC): `REPLACE_UTC_TIMESTAMP`
- Release commit (full SHA): `REPLACE_RELEASE_COMMIT`
- Reviewer: `REPLACE_REVIEWER`
- DigitalOcean project: `REPLACE_PROJECT_NAME`
- App Platform app ID: `REPLACE_APP_ID`
- PostgreSQL cluster ID: `REPLACE_DATABASE_CLUSTER_ID`
- Spaces bucket: `REPLACE_PRIVATE_BUCKET_NAME`
- API image reference: `registry.digitalocean.com/REPLACE_REGISTRY/allied-autotech-api@sha256:REPLACE_API_DIGEST`
- Identity-worker image reference: `registry.digitalocean.com/REPLACE_REGISTRY/allied-autotech-identity-worker@sha256:REPLACE_IDENTITY_WORKER_DIGEST`
- General-worker image reference: `registry.digitalocean.com/REPLACE_REGISTRY/allied-autotech-general-worker@sha256:REPLACE_GENERAL_WORKER_DIGEST`
- Migration image reference: `registry.digitalocean.com/REPLACE_REGISTRY/allied-autotech-migrate@sha256:REPLACE_MIGRATION_DIGEST`
- Approved purchase worksheet/reference and actual quoted prices: `REPLACE_REFERENCE`
- Confirmed migration target (host:port/database) and environment: `REPLACE_TARGET`
- Durable backup receipt reference (no contents): `REPLACE_REFERENCE`
- Managed backup/PITR retention and encryption evidence: `REPLACE_REFERENCE`
- Separate restore target, actual restore result and recovery time: `REPLACE_REFERENCE`
- External guarded migration execution record: `REPLACE_REFERENCE`
- Read-only PRE_DEPLOY job ID/result: `REPLACE_JOB_ID_AND_RESULT`
- Private frontend/default/preview/API access denial and authenticated tests: `REPLACE_RESULTS`
- Proposed-size load/memory/database connection evidence: `REPLACE_REFERENCE`
- Migration result: `REPLACE_PASS_OR_FAIL`
- Seed version: `allied-autotech-public-v1`
- Seed result: `REPLACE_CREATED_OR_UNCHANGED`
- Booking/reminder worker smoke result: `REPLACE_PASS_OR_FAIL`
- Paystack test webhook result: `REPLACE_PASS_OR_FAIL_OR_DEFERRED`
- Monnify: disabled; not required for first infrastructure deployment
- OpenAPI/handbook artifact commit: `REPLACE_RELEASE_COMMIT`
- Post-deployment checklist reviewer: `REPLACE_REVIEWER`
- Rollback-forward notes: `REPLACE_NOTES`
