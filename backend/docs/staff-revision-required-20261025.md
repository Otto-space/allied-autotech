# Staff access revision requirement — 25 October 2026

The staff status, branch and role endpoints previously accepted a missing `expectedRevision`. Although the dashboard sent the revision, a direct or older client could omit it and overwrite a later administrator decision after obtaining the account lock.

All three mutations now require the selected account's revision. Missing input fails validation with 422. A revision that changed since review fails with 409 inside the locked transaction. The dashboard already reads and supplies this value; its review and unknown-outcome behavior is unchanged. There is no database schema or migration change.

Validation on a fresh isolated `_test` PostgreSQL database replayed all 71 migrations and found no Prisma schema difference. The two focused integration files passed 13 tests, including missing-revision rejection with unchanged state and competing status/branch decisions where exactly one wins. Backend typecheck, lint, format, OpenAPI, route checks, frontend generated API types and typecheck passed. Seven compiled dashboard browser fixtures passed at 320px and 1280px. These fixtures are mocked; real signed-in role and device acceptance remains outstanding.

Production rollout and hosted verification are pending. Preserve the active frontend because it already sends the required revision. Confirm all four backend images and the production database safety checks before rollout.
