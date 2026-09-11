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
- API image reference: `registry.digitalocean.com/REPLACE_REGISTRY/allied-autotech-backend-api@sha256:REPLACE_API_DIGEST`
- Identity-worker image reference: `registry.digitalocean.com/REPLACE_REGISTRY/allied-autotech-backend-identity-worker@sha256:REPLACE_IDENTITY_WORKER_DIGEST`
- General-worker image reference: `registry.digitalocean.com/REPLACE_REGISTRY/allied-autotech-backend-general-worker@sha256:REPLACE_GENERAL_WORKER_DIGEST`
- Migration image reference: `registry.digitalocean.com/REPLACE_REGISTRY/allied-autotech-backend-migrate@sha256:REPLACE_MIGRATION_DIGEST`
- Migration deployment/job ID: `REPLACE_MIGRATION_JOB_ID`
- Migration result: `REPLACE_PASS_OR_FAIL`
- Seed version: `allied-autotech-public-v1`
- Seed result: `REPLACE_CREATED_OR_UNCHANGED`
- Booking/reminder worker smoke result: `REPLACE_PASS_OR_FAIL`
- Paystack test webhook result: `REPLACE_PASS_OR_FAIL_OR_DEFERRED`
- Monnify sandbox hosted-bank/webhook result: `REPLACE_PASS_OR_FAIL_OR_DEFERRED`
- OpenAPI/handbook artifact commit: `REPLACE_RELEASE_COMMIT`
- Post-deployment checklist reviewer: `REPLACE_REVIEWER`
- Rollback-forward notes: `REPLACE_NOTES`
