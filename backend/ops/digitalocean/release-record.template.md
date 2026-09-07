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
- Migration image reference: `registry.digitalocean.com/REPLACE_REGISTRY/allied-autotech-backend-migrate@sha256:REPLACE_MIGRATION_DIGEST`
- Migration deployment/job ID: `REPLACE_MIGRATION_JOB_ID`
- Migration result: `REPLACE_PASS_OR_FAIL`
- Seed version: `allied-autotech-public-v1`
- Seed result: `REPLACE_CREATED_OR_UNCHANGED`
- Post-deployment checklist reviewer: `REPLACE_REVIEWER`
- Rollback-forward notes: `REPLACE_NOTES`
