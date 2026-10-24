# Initial owner provisioning

## Production provisioning completed — 22 October 2026

Production is separate from staging. Its canonical frontend is now
https://alliedautotech.com, with private access retained during verification.
The selected production owner remains `alliedautotechltd@gmail.com`.

The user registered using their own password and confirmed production email
verification. Read-only inspection independently confirmed the selected account
was active and email-verified and that no production Super Admin existed.
The operator then used the existing guarded `provisionInitialOwner` function
with the exact inspected account UUID. No account, password, verification
timestamp or authenticator was created by the operator.

The actual target was confirmed as managed PostgreSQL host
`allied-autotech-staging-db-do-user-44970995-0.k.db.ondigitalocean.com`, port
`25060`, database `allied_autotech_production`, environment `production`, using
strict CA/hostname verification. The separate migration account passed
`npm run db:check`. A fresh custom-format backup was created and its receipt,
hash and archive index verified through `npm run db:backup` using the dedicated
backup account. This fresh dump was not itself restore-rehearsed; the separate
managed PITR and isolated recovery restore evidence remains as described in
the production release record.

Provisioning used the restricted production runtime role, the existing
transaction/advisory lock, exact-account checks and installed ownership
protections. Post-change verification confirmed one Super Admin, the selected
active/verified account, zero unrevoked sessions for it and exactly one initial
provisioning role-change audit entry. No schema, grants, migration history,
staging account or other user was changed. Temporary operator-IP database
access was removed, and the original two app-only firewall rules were verified.

Do not rerun initial provisioning: it now correctly refuses replacement of the
existing owner. The owner signed in again and confirmed completion of MFA and
entry to the production admin dashboard on 22 October. A subsequent read-only
check confirmed the same active, email-verified sole Super Admin, at least one
active verified MFA factor and a current unrevoked MFA-verified session. It
selected counts only; no factor secret, recovery code or session credential was
read or copied. Temporary operator-IP access was removed and the original
app-only firewall verified again.

At the MFA check, production had zero branches, services, products and vehicle
listings. The owner then confirmed branch creation through their own authenticated
`/admin/branches` page. A subsequent public API read confirmed one active
Port Harcourt branch, street address `133 Stadium Road`, state `Rivers`, country
Nigeria, timezone `Africa/Lagos`, phone `08136075567` and email
`support@alliedautotech.com`. The saved street field omits the landmark; the
public site's approved address text still includes it. No appointment capacity
or calendar was inferred. Media workflows still need their own checks;
successful MFA and branch creation do not certify uploads.

See [the production release record](digitalocean-production-release.md) for the
database target, current deployments and remaining launch checks. The local
production perimeter credential is separate from the user's account password;
keep it in the protected operator file, never in this document or chat.


## Staging provisioning completed - 21 October 2026

`alliedautotechltd@gmail.com` is now the sole staging `SUPER_ADMIN`. The selected account was already active and email-verified through the normal application workflow before the operator ran the existing guarded provisioning function with its inspected UUID. No account, password or verification timestamp was created by the operator.

The target was confirmed as managed PostgreSQL host `allied-autotech-staging-db-do-user-44970995-0.k.db.ondigitalocean.com`, port `25060`, database `allied_autotech_staging`, environment `staging`. Strict CA/hostname verification remained enabled. The latest managed backup was dated `2026-10-21T05:22:09Z`; the separate-cluster restore rehearsal from 17 October remains the recovery evidence.

The release checkout's read-only database history/schema check passed using the separate migration account. The role change itself used the restricted runtime account and the existing transaction, advisory lock, exact-account checks and installed owner protections. Verification confirmed one owner, zero unrevoked sessions for the selected account and a role-change audit record. Temporary operator-IP database access was removed and the original app-only firewall verified restored. No schema, grants, migration history or other user account was changed.

The user must sign in again at https://staging.alliedautotech.com/login with the password chosen at registration and complete the existing MFA enrollment. The operator did not handle the password, enrol an authenticator or test a logged-in owner session. Do not rerun initial provisioning: it deliberately rejects replacement of an existing owner.

The business owner selected `alliedautotechltd@gmail.com`. This identifies the intended account; it does not establish that the account exists or has verified its email. A read-only check on September 17, 2026 found no matching user in the configured local development database. No real account was provisioned by that September local check; the separate staging outcome is recorded above.

Use the existing registration and email-verification flow to establish an active account in the intended environment. Do not create a password through this script or set verification timestamps manually. The public business contact email remains unchanged.

The project root includes a shortcut forwarding this command to the backend. Run it from either `allied-autotech` or `allied-autotech/backend`; no additional root dependency installation is needed. Running it without arguments or with `-- --help` prints usage without connecting to the database.

If npm reports `Missing script: "bootstrap:super-admin"`, it has not found that shortcut in the current directory's package manifest. The current local checkout is `C:\Users\PC\Desktop\allied-autotech`; the former OneDrive path is absent. In PowerShell, verify the command from the current checkout:

```powershell
Set-Location 'C:\Users\PC\Desktop\allied-autotech'
npm run bootstrap:super-admin -- --help
```

The equivalent direct backend command, run from the project root, is `npm --prefix backend run bootstrap:super-admin -- --help`. Both print usage without connecting to the database or changing roles.

After reviewing and applying forward migrations in the target environment, inspect the selected account using the existing approved backend database configuration:

```text
npm run bootstrap:super-admin -- --email alliedautotechltd@gmail.com
```

This is read-only. It reports whether an owner already exists, the selected account's ID and eligibility. Inspect the environment and returned identity before applying. To provision, supply that exact ID:

```text
npm run bootstrap:super-admin -- --email alliedautotechltd@gmail.com --expected-user-id <verified-account-id> --apply
```

The script refuses to run a mutation without both account identifiers, installed owner protections, no existing SUPER_ADMIN, and an active, already verified matching user. Provisioning uses a transaction and advisory lock, preserves credentials, changes the selected user's role, revokes all its sessions and appends an audit event. Sign in again and complete the existing mandatory MFA flow before using privileged endpoints.

The forward migration `20260917190000_protect_sole_owner` adds a partial unique index, active/verified check and update/delete trigger. Existing conflicting ownership data causes migration failure; the migration does not choose an account, drop data or change roles. Ordinary application operations cannot remove, demote, suspend, deactivate or replace the owner's identity. Password resets, MFA and normal login bookkeeping remain available through the existing security flows. No ownership transfer policy or transfer endpoint is implemented.

Use an explicitly named fresh disposable `_test` or `_ci` database for `tests/integration/owner-provisioning.test.ts`, with `RUN_OWNER_PROVISIONING_TESTS=true` and `TEST_DB_NAME` set. Run migrations first. The suite checks rejected account selections, competing provisioning, credential preservation, session revocation, audit evidence and direct database bypass attempts. It intentionally does not disable the owner trigger to reset fixtures. Other database suites share one synthetic protected owner through `tests/helpers/owner.ts`.
