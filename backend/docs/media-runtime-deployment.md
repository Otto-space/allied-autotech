# Media runtime deployment correction

Reviewed 12 October 2026. Local checks and Linux container verification passed; deployed Spaces verification remains pending.

## Changes

The general worker owns managed-media cleanup but the staging template previously supplied object storage only to the API. The template now supplies the same six storage settings to both processes, with access credentials scoped as runtime secrets. Identity workers and migrations receive no storage credentials. Production startup rejects a general worker with missing endpoint, bucket or credentials, or an endpoint that does not use HTTPS. This validates configuration, not provider connectivity or permissions. Development behavior remains unchanged while Spaces setup is deferred.

The production dependency image previously omitted optional dependencies. Sharp requires its platform-specific optional binaries for image validation/transformation, so importing it could fail before the API or general worker started. The Dockerfile now includes optional production dependencies. No package versions, API contracts, migrations or business policies changed.

The image test suite now exercises a real PNG decode and WebP encode inside both API and general-worker images, with networking disabled and no database. The standalone probe uses only synthetic image bytes.

A further runtime probe imports the compiled API and both workers from the shared production runtime, verifies Argon2 password hashing (including wrong-password rejection), and checks that both invoice/receipt fonts are packaged. It blocks socket connections and starts no listeners or worker loops. Container verification runs this probe in the API image; all three processes inherit the same runtime stage.

## Local evidence

- Process environment tests: 16 passed, covering both processes' required fields, HTTPS enforcement, secret-safe errors and deferred local configuration.
- Focused environment, media validation and unavailable-storage unit run: 25 passed, with no skips or failures (includes those 16 environment cases).
- Deployment specification tests: 17 passed, including matching API/cleanup storage and absence of storage credentials from identity/migration processes.
- A fresh isolated Windows production install reproduced the old command's Sharp import failure. Reinstalling with `--omit=dev --include=optional` passed the PNG-to-WebP probe, reporting a 32 by 32 WebP image. Repository dependencies were not replaced for this experiment.
- Backend type checking, lint and secret guard passed. The container test file passed Node syntax checking.
- The compiled application/worker import, password and font probe passed in the isolated Windows production install with synthetic TLS configuration. An initial exploratory run timed out at 45 seconds; a diagnostic run revealed a probe assertion incorrectly expected an exported identity-worker entrypoint. The final probe checks the actual exported worker class and passed. No application change was needed for these checks.

The Windows result alone did not establish Linux container success. An initial Linux/amd64 API build on 12 October was cancelled when C: free space fell from about 2.57 GiB to about 52 MiB. Buildx records that attempt as an error; its log remains `allied-container-api-build.log` in the OS temporary directory. A later connection attempt encountered Docker Desktop still starting; it did not build an image.

After free disk space and the Linux engine became available, all four images (API, identity worker, general worker and migration job) built successfully for revision `5ea8822eae9b53f286dc6b854febea78d5e74440`, using matching full-SHA tags and revision labels. Backend runtime sources remained unchanged throughout the builds. `node --test scripts/deployment/images.test.mjs` then passed all eight cases with zero failures or skips, exit code zero. This verifies the commands, non-root user and certificate bootstrap in all four images, rejection of unsafe certificate inputs, Sharp PNG-to-WebP processing in API/general-worker images, and the application/worker import, password and font probe. Runtime probes used no network or database access.

Successful logs are `allied-container-api-rebuild-ready.log`, `allied-container-identity-worker-rebuild.log`, `allied-container-general-worker-rebuild.log`, `allied-container-migrate-rebuild.log` and `allied-container-image-tests.log` in the OS temporary directory. No images were pushed, no app was deployed, and no real storage credentials or application database records were changed. Real Spaces behavior remains a separate release gate.

The companion `node --test scripts/deployment/postgres.test.mjs` check also passed (one case, zero failures or skips, exit code zero). It exercised the staging SQL in an isolated PostgreSQL container, verifying runtime DML/default privileges and denial of runtime DDL. It used synthetic roles, no host ports or volumes, and removed its own container. Its report is `allied-container-postgres-tests.log` in the OS temporary directory; this does not certify privileges on a deployed database.

## Release requirements

1. Configure the general worker with the API's private bucket, HTTPS endpoint, region and path-style setting, plus credentials authorized for cleanup in that bucket. Supply these before deploying the stricter worker startup guard. Existing private input substitution now populates both processes; do not copy secrets into checked-in files.
2. Rebuild the runtime images. Follow the local build and image-test steps in [the release runbook](digitalocean-staging-release.md#build-push-and-immutable-images). From `backend`, run `node --test scripts/deployment/spec.test.mjs` and, after building the four local images, `node --test scripts/deployment/images.test.mjs`. The image tests expect full Git-SHA tags and matching revision labels. Local verification does not authorize a push or deployment.
3. With approved staging resources configured, verify upload, confirmation, read, replacement and removal, then run the cleanup worker against synthetic unreferenced assets. Confirm referenced assets remain readable and interrupted cleanup retries safely. Check actual Spaces CORS, signing headers and permissions as part of the existing media release gate.

DigitalOcean Spaces configuration remains deferred by the owner. Reservation agreements remain unpublished pending approved wording; this correction does not enable reservations or any payment/provider capability.
