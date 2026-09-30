# Backend gaps implementation handoff

Local implementation for BG-01 through BG-06 is complete. Staging storage verification remains outstanding. This report supplements the generated [endpoint handbook](api/endpoint-handbook.md), [OpenAPI contract](api/allied-autotech.openapi.json), and [managed media lifecycle](managed-media.md).

## 1. Initial repository findings

The application uses Express 5, Prisma 7/PostgreSQL, Next.js 16/React 19 and npm lockfiles. Cookie sessions, CSRF, MFA, role policies, optimistic versions, audit events, signed object uploads, workers and redesigned frontend components already existed. Customer promotion-candidate lookup was unsuitable for a customer directory. Customer-owned garage vehicles and marketplace stock vehicles have distinct ownership rules. Product hosted-URL metadata and stock upload/confirmation routes already worked and needed compatibility.

The referenced attachment named `Pasted markdown(6).md` was not present. The supplied pasted-text attachment and repository `BACKEND_IMPLEMENTATION_GAPS.md` provided the six-gap requirements. Final routes follow the existing modules rather than assuming proposed paths existed. Initial stock storage confirmation did not perform the full managed image validation now required; IMAGE uploads now fail closed and verify actual bytes. Other stock asset contracts are retained.

## 2. Existing infrastructure reused

The implementation extends the existing Prisma client, transaction/advisory locks, authentication, MFA and branch policies, CSRF and rate limits, strict Zod validation, response envelopes, safe error codes, audit writer, S3 adapter, worker runtime/heartbeat and generated OpenAPI/types. Frontend changes use the existing API client, record editors, mutation review, feedback/focus behavior, responsive dashboard and upload controls. Sharp was added for bounded decoding, orientation correction, metadata stripping and WebP encoding; PostgreSQL stores metadata, not image bytes.

## 3. Final endpoint list

All paths below are relative to `/api/v1`. Existing read/update endpoints gain safe optional media projections. The exact operation schemas are in OpenAPI.

| Capability | New operations                                                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BG-01      | GET `/admin/customers`; GET `/admin/customers/{customerId}`; separate GET subpaths `/vehicles`, `/bookings`, `/quotations`, `/orders`, `/payments`, `/enquiries`, `/complaints`                                                                                                                        |
| BG-02      | POST `/customers/profile/photo/upload`; PUT and DELETE `/customers/profile/photo`; GET `/customers/media/images/{imageId}`                                                                                                                                                                             |
| BG-03      | POST `/customers/vehicles/{vehicleId}/assets/upload`; POST `/customers/vehicles/{vehicleId}/images`; PATCH and DELETE `/customers/vehicles/{vehicleId}/images/{imageId}`; reads reuse the owner-only customer media route                                                                              |
| BG-04      | GET `/admin/services/{serviceId}/images`; POST `/admin/services/{serviceId}/assets/upload`; PUT `/admin/services/{serviceId}/image`; PATCH and DELETE `/admin/services/{serviceId}/images/{imageId}`; GET `/admin/services/{serviceId}/images/{imageId}/content`; GET `/public/media/images/{imageId}` |
| BG-05      | POST `/admin/catalog/products/{productId}/assets/upload`; POST `/admin/catalog/products/{productId}/images/confirm`; GET `/admin/catalog/products/{productId}/images/{imageId}/content`; GET `/public/catalog/products/images/{imageId}`                                                               |
| BG-06      | PATCH and DELETE `/staff/vehicles/{vehicleId}/images/{imageId}`; GET `/staff/vehicles/{vehicleId}/images/{imageId}/content`                                                                                                                                                                            |

Preserved routes include product hosted-image POST/PATCH/DELETE, stock POST `/staff/vehicles/{vehicleId}/assets/upload` and POST `/staff/vehicles/{vehicleId}/images`. Stock public GET `/public/vehicles/images/{imageId}` now streams verified bytes instead of redirecting to a temporary storage URL.

## 4. Final DTO and response design

JSON responses retain the existing success/data/error/meta envelope and request ID. Binary image responses are documented as bytes. Directory rows contain customer profile ID, first/last name, email, phone, status, email/phone verification booleans and registration time. Detail adds address/city/state/country. Related rows are bounded summaries containing ID/title/status/date and nullable string amounts/currency. No password, MFA, session, payment credential or image ticket fields appear in these projections.

Media preparation accepts MIME, byte count and lowercase SHA-256, returning an opaque token, signed PUT method/URL/required headers/expiry and limits. Resource ownership is derived by the server. Confirmations accept token, version and permitted image metadata. Read projections contain ID, safe application URL, alt text, order, primary state and dimensions. Legacy/external dimensions are nullable. Product and stock projections distinguish image source without exposing internal relations or keys. Profile/garage/product use media versions; services and stock reuse their existing resource versions. Stock confirmation preserves its flat legacy image response while adding version/source/dimensions. Exact response shapes remain resource-specific and generated into frontend types.

## 5. Authorization matrix

| Operation                            | Customer           | Staff                                         | Admin                                        | Super Admin                                  | Anonymous          |
| ------------------------------------ | ------------------ | --------------------------------------------- | -------------------------------------------- | -------------------------------------------- | ------------------ |
| Customer directory and detail        | Denied             | Denied                                        | Allowed with MFA and related-domain policies | Allowed with MFA and related-domain policies | Denied             |
| Profile/garage media                 | Own records only   | Denied                                        | Denied                                       | Denied                                       | Denied             |
| Service/product media management     | Denied             | Denied                                        | Existing administrator policy + MFA          | Existing administrator policy + MFA          | Denied             |
| Stock management and private preview | Denied             | Active assigned branch matching vehicle + MFA | Existing cross-branch policy + MFA           | Existing cross-branch policy + MFA           | Denied             |
| Public service/product/stock image   | Publication checks | Publication checks                            | Publication checks                           | Publication checks                           | Publication checks |

Every mutation requires CSRF. Tokens are bound to the actor who prepared them, including administrators. Image IDs must belong to the path resource. Customer records gain no invented branch relation. No directory route grants impersonation, suspension or role-assignment powers. Admins do not gain private personal-photo access or Super Admin assignment authority.

## 6. Search and pagination decisions

Directory search trims and collapses whitespace, lowercases name/email queries and uses indexed prefixes. Name matches normalized full-name or surname prefix. Phone strips punctuation to digits without inventing a country code. ID matches the complete customer profile UUID. Nonempty name/email queries need two characters; phone needs three digits; maximum input is 120 characters. An empty query lists customers. Status allows ACTIVE/SUSPENDED/DEACTIVATED; verification filters existing email verification. Only newest/oldest sorts are accepted.

Keyset pagination uses immutable `User.createdAt` with unique `User.id` as tie-breaker. Default page size is 25, maximum 50; one extra row determines the next cursor without an aggregate COUNT. The bounded validated base64url cursor includes a filter/sort binding; it is not an authorization credential. Related collections use bounded UUID cursors with deterministic ID order and independently enforce their domain policy. Unchanged datasets traverse without omission/duplication. Concurrent inserts are not a snapshot; changes to filter membership may change later results, so refresh restarts traversal. Expression/partial and relation indexes avoid an unindexed arbitrary substring search. A 5,000-customer EXPLAIN test verifies representative prefix index use.

## 7. Persistence changes

New managed-media models record hashed upload tokens and scope, immutable verified image metadata, profile/garage/service references and durable cleanup jobs. Existing product/stock rows receive nullable unique verified-asset references; existing images remain readable. Customer profile/garage and product media counters default to zero. Existing service/stock versions are reused. Constraints cover purpose/resource binding, valid metadata, one profile/service image and one garage primary. Resource locks serialize count checks and primary changes. No historical migrations were rewritten, no extension was added and no data reset or `db push` was used.

## 8. Migration names

1. `20260930010000_customer_directory_indexes`
2. `20260930020000_managed_media_lifecycle`
3. `20260930030000_product_media_version`

All 45 repository migrations replayed successfully on the new isolated `allied_bg_final_replay_20260930_test` and final verification `allied_bg_verified_20260930_test` databases. During investigation of the reported 500, the original local PostgreSQL server was found stopped. It was restarted against its existing data directory. Before applying pending migrations, a full custom-format dump was saved outside the repository at `C:/Users/PC/.codex/backups/allied-autotech-before-bg-20260930-0833.dump`. Two previously committed receipt-integrity migrations were also pending; their prerequisite duplicate/empty receipt checks passed before normal `prisma migrate deploy` applied all five pending migrations. No receipt data was rewritten. The application database now has all 45 migrations.

## 9. Media ticket lifecycle

The server generates a random 32-byte opaque token, persists only its hash and binds actor/owner/resource/purpose/branch/key/MIME/size/checksum/expiry. Signed uploads alone never create visible image records. Confirmation reads bounded actual bytes, checks exact size/hash/signature, fully decodes and checks dimensions/animation before sanitized WebP output. Inputs are non-animated JPEG/PNG/WebP, 32-8192 pixels per side and at most 40 million pixels. Profile limits are 5 MiB/1024px output; other image purposes use 10 MiB/2048px output. Gallery limits are garage 12, product 12 and stock 20; profile/service each have one image.

Confirmation locks ticket/resource and commits attachment, version increment, audit and cleanup scheduling together. Exact original-body retries return the original safe receipt for 24 hours, including after a lost response. Different-body/late replay, wrong binding, expired ticket or stale version fails. Database failure leaves old media intact and new unreferenced objects eligible for cleanup. Stock can adopt a still-valid encrypted legacy IMAGE ticket once with the same byte validation. Replacement uses a verified new attachment and removes the old reference only in the successful transaction.

## 10. Private and public media rules

Profile/garage reads require the owning customer. Neither public media endpoints nor admin directory projections expose them. Service public reads require an active service; product reads require active product and category. Stock public reads require an AVAILABLE listing at an active branch. Authorized staff/admin preview routes allow unpublished stock or inactive service/product management without making them public. Private storage configuration is required. Uploaded managed media never returns a signed download URL in ordinary read projections.

## 11. Cleanup and cache invalidation

Cleanup uses durable jobs and the existing general worker with reference checks, bounded claims and retry backoff. Invalid/unconfirmed upload keys become eligible after ticket expiry plus one hour. Replaced/deleted verified keys are queued in the mutation transaction; cascaded unreferenced assets are discovered after one hour. Storage failure does not resurrect deleted application references. Managed and recognized legacy owned keys are eligible; external hosted files are never deleted. Storage lifecycle policies must preserve referenced verified objects.

Media responses use `private, no-store` and `nosniff`, checking visibility on each request. Detach/unpublish immediately revokes subsequent application reads. Already downloaded bytes and previously issued legacy stock signed URLs cannot be revoked before their original TTL. Stock last-image deletion is rejected while any AVAILABLE/RESERVED listing exists; replacement remains possible. Removing a stock cover selects the first remaining image by order/ID. Garage requires a cover while nonempty; product retains its existing optional-primary behavior. Numeric order values are retained, with ID tie-breaking. Existing oversized legacy galleries remain readable/editable/removable; additional attachments are blocked at the new limits.

## 12. Audit behavior

Existing audit facilities record actor, resource, operation, timestamp and permitted non-secret result metadata. Directory reads record collection and returned count without the searched personal data. Media mutations never audit file bytes, source metadata, raw tokens, signed URLs or credentials. Logger redaction covers upload fields and keys. Cleanup stores safe failure codes rather than provider exception contents.

## 13. OpenAPI changes

The regenerated contract has 251 paths and 299 mounted API operations, including 31 new operations. Validation and mounted-route coverage pass. Contracts include strict bodies, role/CSRF requirements, bounded pagination, upload limits, version compatibility, exact retry semantics, machine-readable errors and binary reads. The endpoint handbook and `frontend/lib/api/generated.d.ts` were regenerated from that contract. No hand-maintained replacement API type layer was introduced.

## 14. Frontend integrations

The admin directory uses persisted server search/filter/sort/cursors, responsive table, customer details and separately paged activity. Profile has initials fallback, preview/progress, replacement/removal and owner-only image reads. Garage detail supports multiple upload slots, per-file retry/cancel, descriptions/order/cover/removal. Service management has one-image editing and public card/detail integration with fallback. Product media retains hosted URL entry alongside a distinct file-upload path and existing gallery controls. Stock detail supports authenticated unpublished previews, metadata/primary changes, replacement and confirmed removal with publication constraints.

All use real API confirmation and refresh after mutation. Stale drafts and confirmation uncertainty remain visible; controls wait for refreshed versions. Invalid replacements preserve valid media. Permission, loading, empty, validation, rate-limit and recovery states use the existing design system. Concurrent unrelated public-page redesign changes were preserved and were not included in capability commits.

## 15. Tests added

Focused directory unit/database/performance tests cover normalization, filters, cursor validation/traversal, minimal projections, role policy, related limits and indexes. Shared/profile tests exercise full byte validation, bad MIME/signature/hash/dimensions, animation, owner/purpose/resource/expiry/replay, private isolation, storage failure, transactional rollback, cleanup retry and reference protection. Garage tests cover counts, covers/order, stale updates and deletion. Service tests cover role/CSRF, shared-version races and public visibility. Product tests cover direct upload, hosted compatibility, count/primary semantics and external deletion safety. Stock tests cover all operator roles, branch scope, legacy adoption, metadata/version races, full-gallery replacement, last published image, private/public reads and owned cleanup.

Browser suites cover all six capabilities using a real API/PostgreSQL and explicitly injected storage receiving the selected bytes. Existing product and stock browser suites remain intact. Unit/HTTP assertions verify private personal images cannot be read through new public endpoints. Exact test files are in the change manifest.

## 16. Commands executed and results

Capability checkpoints and historical counts are recorded in [managed-media.md](managed-media.md). All database tests use a separate loopback `_test` database; production build verification uses an isolated frontend copy sharing installed dependencies.

| Command/check                                                                                                     | Result                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend `npm run prisma:format`, `npm run prisma:generate`, `npm run check:prisma`                                | Passed; schema valid and all 45 migrations applied; formatting introduced no schema change                                                                                        |
| `npm run test:db:create` then `CONFIRM_EMPTY_MIGRATION_DATABASE=true npm run test:migrations`                     | Passed on fresh final regression, owner-provisioning and workshop-access databases; all 45 migrations replayed without resetting an existing database                             |
| Backend `npm run check` with `RUN_DATABASE_TESTS=true`, `VITEST_MAX_WORKERS=1` and isolated `DB_*`/`TEST_DB_NAME` | Passed on `allied_bg_verified_20260930_test`: 90 test files / 451 tests passed; four intentionally gated tests passed separately on their required isolated databases (455 total) |
| Backend `npm run build`                                                                                           | Passed again after the complete final check                                                                                                                                       |
| `npm run openapi:export`, `npm run check:openapi`, `npm run check:routes`                                         | Passed: 251 paths, 299 operations; regenerated artifacts have no drift                                                                                                            |
| Frontend `npm run api:types`, Prettier on `lib/api/generated.d.ts`, Git drift comparison                          | Passed; regenerated types match the committed contract                                                                                                                            |
| Frontend `npm run lint`, `npm run typecheck`, `npm run format:check`                                              | Passed; changed browser-test files also passed focused lint/format after fixes                                                                                                    |
| Frontend `npm test -- --maxWorkers=1`                                                                             | 26 files, 192 tests passed                                                                                                                                                        |
| Frontend `npm run build` in isolated QA copy with the final source                                                | Passed: optimized build, 70 static-generation entries, all routes and standalone packaging                                                                                        |
| Playwright directory/profile/garage final batch                                                                   | Nine tests passed                                                                                                                                                                 |
| Playwright service/product/stock final batch plus corrected service rerun                                         | Four tests passed cumulatively; all six capabilities total 13 live API browser scenarios                                                                                          |
| Existing product and stock browser regressions                                                                    | 12 product and 12 stock scenarios passed at their capability checkpoints                                                                                                          |
| Owner-provisioning suite with `RUN_OWNER_PROVISIONING_TESTS=true` on its own fresh database                       | Three tests passed                                                                                                                                                                |
| Workshop-access suite with `RUN_WORKSHOP_ACCESS_TESTS=true` on its own database                                   | One test passed with `--testTimeout=30000`; initial default five-second run timed out under concurrent checks                                                                     |

The initial broad backend run passed 450 tests and exposed one cleanup-test assumption: a single bounded worker batch need not reach a newly discovered orphan behind earlier fixtures. The test now waits for successive production-sized batches, retaining its deletion/reference assertions; its full nine-test file passed. The fresh-database run then exposed a pre-existing finance-test ordering assumption: another suite can approve the shared draft policy. That test now creates its draft inside a transaction that is deliberately rolled back, checks the same production rejection and staging acceptance, and preserves the other suite's approved policy. All six finance-control tests passed after the fix. The first final service browser run hit a CSS selector removed by the concurrent public-page redesign; the test now observes `aria-busy` instead, and its complete lifecycle passed again. No production authorization, payment behavior, rate limit, storage validation or assertion was weakened.

The broad financial regression suites also retain reviewed refund-timing policies. Reusing a populated test database caused the unchanged Phase 8 test to encounter an approved refund clock where it expects the original pending seed. The final complete check passed on the newly created and fully replayed `allied_bg_verified_20260930_test` database. Use a fresh `_test` database for a complete financial regression run; no existing database was reset and the Phase 8 assertions were preserved.

Browser commands use `PLAYWRIGHT_BASE_URL=http://localhost:3011`, `BG_DIRECTORY_SESSION_FILE`, `BG_MEDIA_IMAGE_FILE` and the isolated harness documented in [managed-media.md](managed-media.md):

```powershell
npx playwright test tests/e2e/customer-directory.spec.ts tests/e2e/profile-photo.spec.ts tests/e2e/garage-media.spec.ts --output "$env:TEMP/allied-bg-final-private"
npx playwright test tests/e2e/service-media.spec.ts tests/e2e/product-media.spec.ts tests/e2e/stock-media.spec.ts --output "$env:TEMP/allied-bg-final-public"
npx playwright test tests/e2e/service-media.spec.ts --output "$env:TEMP/allied-bg-final-service"
```

Restart only the test harness between large browser batches to clear accumulated synthetic rate-limit state. The production limiter stays enabled. Existing stock binary tests additionally require `RUN_ASSET_BROWSER_TESTS=true` and their documented test-storage hostname.

## 17. Browser workflows verified

The directory suite covers real persisted search, filters, stable pagination, detail navigation, related tabs, denial/loading/errors and responsive layout. Profile covers upload/refresh/invalid replacement/replacement/removal, lost-response retry and failure states. Garage covers multiple prepared files, transfer retry, stale edits, ordering/cover fallback, cross-owner denial and read revocation. Service covers upload/replacement/alt text, public card/detail visibility and removal. Product covers upload, hosted URL compatibility, metadata/order/primary, failure preservation and both deletion paths. Stock covers branch denial, unpublished preview, publish/read, metadata/primary, invalid/valid replacement, last-image constraint and stale draft recovery. Desktop/mobile screenshots and mobile accessibility/overflow were checked during the capability runs.

## 18. Staging checks completed

No deployed staging storage pass is claimed. Local tests transfer actual bytes through an injected adapter and execute real confirmation, database, authorization and cleanup code. They do not certify S3 signatures, CORS, server-side encryption or deployed identity permissions. Production compilation succeeds; browser workflows were exercised in the development preview. Automatic approval review rejected configured production-preview startup, stating only "blocked by policy"; that restriction was not bypassed.

## 19. Missing credentials/infrastructure and remaining verification

The local backend environment has no `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY`, `OBJECT_STORAGE_ENDPOINT` or explicit `OBJECT_STORAGE_REGION`. Region defaults to `us-east-1`. Although the S3 adapter supports its default credential chain, the existing production environment validator requires explicit access-key variables and an HTTPS endpoint; this task preserves that deployment policy. No staging bucket or workload identity was verified. Frontend `ASSET_STORAGE_HOSTS` must contain the real signed-upload hostname. Configure a private bucket, appropriate GetObject/PutObject/DeleteObject permissions and CORS allowing the staging frontend PUT with all returned content-type/checksum/encryption headers. Supply credentials through the normal secret manager, never chat or committed files.

Remaining staging procedure:

1. Set the existing database/storage/session environment through deployment secrets. From `backend`, run `npm ci`, `npm run prisma:generate`, `npm run db:migrate`, `npm run check:prisma`, `npm run build`. Do not reset the database. Start the normal API and `npm run worker:general` through the existing process manager.
2. Set frontend `BACKEND_ORIGIN` and `ASSET_STORAGE_HOSTS`; run `npm ci`, `npm run api:types`, `npm run build` and the existing deployment process. This task did not deploy.
3. With synthetic staging accounts for Customer, Staff, Admin and Super Admin, use the six integrated pages. Confirm the browser sends PUT to the real storage host with the exact returned headers and receives successful storage CORS responses, then successful API confirmation. Inspect network status locally without copying signed URLs into logs or tickets.
4. For each resource, refresh, edit, replace with valid/invalid bytes and remove. Reuse the original confirmation body after a simulated response loss and verify exact retry; change the body and verify rejection. Let a prepared ticket expire before confirmation. Try cross-owner/resource/purpose tickets and branch mismatch. Verify an anonymous request to personal media fails, and public reads disappear after deactivation/removal.
5. Verify the bucket rejects anonymous object access. Introduce a controlled storage outage in staging, verify safe errors and preserved prior media, then restore access. Run the general worker and verify cleanup retries delete only detached owned objects; referenced and external images must survive. Allow expiry plus the documented one-hour grace for abandoned uploads. Check media-cleanup heartbeat and audit redaction. Record actual browser/worker evidence before release.

## 20. Known limitations and local database recovery

Optional legacy product/stock confirmation versions preserve compatibility, so older callers that omit versions do not gain optimistic stale-write protection. Existing stock publication permits an initially empty gallery; this behavior is retained, while deleting its last attached published image is blocked. Expired unconfirmed legacy stock objects lack a database inventory and require a reviewed provider inventory before cleanup. No automatic deletion of unknown external objects is attempted. Production-scale load and real S3 staging remain unverified. The existing dependency audit reported four high-severity findings in Prisma/deepmerge-ts and fast-uri chains; no broad dependency downgrade or unrelated upgrade was made.

The reported `pino-http` 500 was a consequence of PostgreSQL `ECONNREFUSED`, not a logger defect. After restoring the original local database and deploying pending migrations, `/api/v1/public/services` and `/api/v1/health/ready` returned 200; `/api/v1/auth/session` with an intentionally invalid synthetic cookie returned the expected 401 instead of 500. Windows service-control permission was denied, so PostgreSQL was started using its existing data directory through `pg_ctl`. The database is running as a manually started process; the Windows service still reports Stopped although its startup mode is Automatic. Restoring service-managed control requires the machine owner's Windows service permissions. No user passwords or session tokens were inspected or printed.

## 21. Exact files changed

The companion [change manifest](backend-gaps-changed-files.txt) lists all 141 exact repository paths changed by the six capability commits and final test/documentation corrections. Capability commits, in order: `a9adc8a` (directory), `0244120` (shared media/profile), `7b629ca` (garage), `cd66672` (service), `6158834` (product), `ee416b5` (stock). Unrelated concurrent working-tree changes were not staged into those commits.

## 22. Scope preservation

No role-promotion, payment authority, booking-deposit, checkout, MFA, support-history, notification, Local Help or deployment behavior was changed by this implementation. Monnify was not enabled. Existing hosted product images and non-image vehicle asset workflows remain supported. The local migration deployment included two already-committed receipt-integrity migrations as described above; no new payment implementation was introduced. No destructive Git operation, database reset, migration squash or `db push` was used.
