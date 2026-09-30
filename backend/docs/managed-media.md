# Managed image lifecycle

BG-02 extends the existing S3 adapter, cookie sessions, CSRF middleware, audit events and general worker. The new `mediaStorage` adapter fails closed when storage is unavailable. It does not use the legacy synthetic fallback. Tests explicitly inject a byte-storing adapter; that is not a deployed-storage verification.

## Profile photo contract

Customer owners use `POST /customers/profile/photo/upload`, `PUT /customers/profile/photo` and `DELETE /customers/profile/photo`. Routes are under `/api/v1`. Admin, Super Admin and Staff cannot access personal photos. GET/PATCH profile responses include `mediaVersion` and nullable `photo`; existing metadata fields remain compatible. The frontend shows initials when no photo is attached.

Preparation accepts JPEG, PNG or WebP MIME type, actual byte count and lowercase SHA-256. Profile limits are 5 MiB, 32–8192 pixels per side, at most 40 million pixels and one non-animated image. Extreme aspect ratios that would shrink below 32 pixels are rejected. The server reads bounded bytes, verifies length/checksum/signature, fully decodes, rotates, resizes within 1024 pixels and re-encodes to WebP without source metadata. SVG, GIF, APNG, animated WebP and remote URLs are not accepted by this flow.

The random opaque token is stored only as a SHA-256 hash, bound to actor, owner, resource, purpose, branch, object, declared content and expiry. Upload keys are server-generated. Preparation returns a short-lived signed PUT credential only in the no-store preparation response. Uploading alone never changes the profile. Confirm uses the profile's `mediaVersion`, locks the ticket and profile, attaches the validated object, increments the media version and queues replaced objects in one transaction. Text-profile edits are independent. A failed transaction leaves the old photo attached and the unattached object eligible for cleanup.

Exact confirmation retries with the original body replay the stored safe result for 24 hours. Changed-body or later replays return `MEDIA_TICKET_CONSUMED`. The client rereads the profile after an uncertain response; it never creates another attachment to guess the outcome. Expired unconfirmed tokens cannot be confirmed. Stale mutations return `STALE_VERSION`. Removal is version-checked; uncertain removal requires rereading before another mutation.

Photos are served by `GET /customers/media/images/{imageId}` with owner authorization, `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. Cross-account IDs return 404. There is no public storage URL or signed download URL in profile projections. Removal revokes subsequent application reads at commit; already downloaded bytes cannot be revoked.

## Persistence and cleanup

Migration `20260930020000_managed_media_lifecycle` adds upload tickets, verified-asset metadata, resource-image references and durable cleanup jobs. It adds nullable references to existing catalogue/stock images without rewriting them. Private records hold no binary bytes. Database constraints enforce supported formats, valid resource binding, one profile/service image and at most one primary garage image.

The existing general worker runs `media-cleanup` on the expiration cadence, with an operations heartbeat. It claims bounded jobs, checks current managed and legacy image references before deletion, retries failures with backoff and stores only a safe failure code. Pending and unconfirmed verified keys are scheduled at upload expiry plus one hour, after signed PUT credentials expire. Replacement/removal queues the previous verified key immediately. Unreferenced assets left by cascaded resource deletion are discovered after one hour. A failed storage delete does not restore a removed application reference. Storage lifecycle rules must not independently delete referenced verified objects.

Successful preparation, replacement and removal use existing audit facilities with actor/resource/action/result. Request rejections use existing error logs; sensitive tokens, object keys and signed upload fields are redacted. Source filename and image metadata are never copied into audit values. Existing payment, booking, staff-role and deployment behavior is unchanged.

## Deployment verification still required

Configure a private bucket, region (default `us-east-1`), credentials or workload identity, and an endpoint for non-AWS S3 storage using the existing `OBJECT_STORAGE_*` variables. The API/worker identity needs GetObject, PutObject and DeleteObject on managed prefixes. Bucket CORS must allow the frontend origin's PUT and the signed content-type, checksum and encryption headers. Set frontend `ASSET_STORAGE_HOSTS` to the actual signed-upload hostname. Keep public access blocked. Run the normal migrations and general worker; do not use database reset or `db push`.

Live storage credentials/bucket are absent in this workspace. Before release, verify real signed PUT/checksum/SSE/CORS, confirm/read/replace/remove, expiry, storage outage, worker retries and private-bucket access denial in staging. No live-storage or staging pass is claimed by the local tests.

## Local acceptance evidence

The isolated PostgreSQL test database received migration 44 without changing the existing application database. Backend tests cover role/ownership/CSRF boundaries, real byte decoding, metadata stripping, spoofing, checksums, dimensions, invalid/expired/substituted tickets, exact replay, concurrency, stale versions, database rollback, cleanup retry, reference protection and cascaded orphan recovery. Browser tests use the real API/database and an explicitly injected storage adapter that receives the selected bytes; upload, refresh, invalid replacement, replacement, removal, cross-owner denial, loading, storage failure, conflict and lost-response retry pass. Existing profile form keyboard, narrow-screen and accessibility checks also pass. Desktop/mobile screenshots were inspected with no horizontal overflow.

`npm audit` reports four existing high-severity dependency findings in the Prisma/deepmerge-ts and fast-uri chains; no sharp finding was reported. No incompatible Prisma downgrade or broad dependency update was applied as part of media work.

BG-02 checkpoint: backend typecheck/build/lint, all 117 backend unit tests, 11 profile integration/HTTP tests, OpenAPI validation (236 paths), route coverage (281 operations), script typecheck, frontend typecheck/targeted lint, all 163 frontend unit tests and the isolated production build passed. Three browser scenarios passed (full photo lifecycle, failure/retry recovery, and the existing profile-form accessibility scenario). Binary image responses are documented as bytes rather than fabricated JSON envelopes. No deployment was performed.
