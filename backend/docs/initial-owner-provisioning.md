# Initial owner provisioning

The business owner selected `alliedautotechltd@gmail.com`. This identifies the intended account; it does not establish that the account exists or has verified its email. A read-only check on September 17, 2026 found no matching user in the configured local development database. No real account was provisioned.

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
