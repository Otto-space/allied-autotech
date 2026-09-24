# Deploy the frontend to Vercel

## Preview just the frontend — no backend required

1. Push the frontend changes to your Git repository and import it into Vercel.
2. Set **Root Directory** to `frontend` and **Framework Preset** to **Next.js**.
3. Keep **Install Command** as `npm ci`, **Build Command** as `npm run build`,
   and **Output Directory** at the framework default.
4. Leave `BACKEND_ORIGIN` unset (remove it if you already added a localhost or
   tunnel URL). Set `SITE_INDEXING=disabled` and leave `SITE_ORIGIN` unset.
5. Click **Deploy**, or **Redeploy** if the project already exists.

No database, API host or tunnel is needed. The landing page, public layouts,
navigation and forms can render. Live lists show unavailable states; login,
protected dashboards and saves will work after an API is connected. This mode
does not simulate accounts, data or successful submissions.

The sections below are optional guidance for connecting a backend later.

The Next.js frontend is a separate Vercel project. The Express API, PostgreSQL
database and background workers can continue running on your PC. A hosted frontend
does not require changing the backend to staging or production.

## Use the backend on your PC

For development, connect Vercel to your local API through an HTTPS tunnel:

```text
Vercel frontend /api/v1 → HTTPS tunnel → your PC:5000 → your local database
```

Requests from the deployed frontend read and write the same database as your local
backend. Backend code changes take effect after its development server reloads;
frontend code changes still require a Vercel redeploy. Setting `localhost` in
Vercel points at a Vercel machine, not your PC.

1. Keep your existing local backend settings and database credentials. Use
   `NODE_ENV=development` and `DEPLOYMENT_ENV=local`; do not copy production env
   templates. Run `npm run dev` from `backend` if the API is not already running.
2. Install Cloudflare's tunnel client on Windows:

   ```powershell
   winget install --id Cloudflare.cloudflared --exact
   ```

   Open a new PowerShell window after installation, then run:

   ```powershell
   cloudflared tunnel --url http://127.0.0.1:5000
   ```

   Keep this window open. It prints an HTTPS address such as
   `https://random-words.trycloudflare.com`. Cloudflare Quick Tunnels do not require
   an account or a domain. This address makes your API reachable over the Internet;
   the application's authentication and permissions still apply.

3. Import the frontend using the settings below. In Vercel, set `BACKEND_ORIGIN`
   to the actual tunnel address, with no `/api/v1` suffix. Set
   `SITE_INDEXING=disabled` and leave `SITE_ORIGIN` empty. Apply the variables to
   the Vercel environment used by this deployment, then deploy/redeploy. Vercel's
   “Preview”/“Production” labels are hosting labels; they do not change your local
   backend's `NODE_ENV` or `DEPLOYMENT_ENV`.
4. Add your actual Vercel frontend origin to the local backend's existing
   `FRONTEND_URL` list. Preserve any origins already needed locally. For example:

   ```dotenv
   FRONTEND_URL=http://localhost:3000,https://your-app.vercel.app
   ```

   Restart the backend after editing its env file. Use the frontend address here,
   not the tunnel address. This allows login and form saves through the existing
   CORS/CSRF checks.

5. Open the Vercel frontend and log in using your existing local account. Keep your
   PC, database, backend and tunnel running while using it. If the backend is
   stopped, its data-dependent pages and saves will stop working.

A new Quick Tunnel normally gets a new URL. When that happens, update
`BACKEND_ORIGIN` in Vercel and redeploy. Backend code or database changes do not
require this while the tunnel URL stays the same.

If you use **passkeys**, their relying-party hostname and allowed origins must
match the Vercel frontend hostname. A passkey registered for `localhost` cannot
authenticate a different domain; TOTP uses the existing account enrollment.
For email links opened on the deployed frontend, set the local backend's frontend
verification/reset/invitation URLs to that frontend as described below.

This workflow keeps the database on your PC. The database port is not tunneled.
The tunnel connects only to the API on port 5000.

## Import settings

Import this Git repository into Vercel with these settings:

| Setting          | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| Root Directory   | `frontend`                                                          |
| Framework Preset | Next.js                                                             |
| Node.js Version  | 24.x (also set in `package.json`)                                   |
| Install Command  | `npm ci`                                                            |
| Build Command    | `npm run build`                                                     |
| Output Directory | Leave the framework default; do not set `out` or `.next/standalone` |

`frontend/vercel.json` supplies the framework and commands. Keep Vercel's automatic
system environment variables enabled. `VERCEL=1` selects native Next.js output and
skips standalone asset copying. Local builds and other Node hosts still produce
the standalone server used by `npm start`. Vercel does not run `npm start`.

## Frontend environment variables

These settings are optional for a frontend-only preview. For the local-backend workflow,
use the tunnel URL and keep indexing disabled. A separately hosted backend can
also be used later.

| Variable                  | Value                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND_ORIGIN`          | Leave unset for frontend-only previews. To connect an API later, use its reachable HTTPS origin, for example `https://api.example.com`. No `/api/v1`, credentials, query or fragment. |
| `SITE_INDEXING`           | `disabled` for previews/staging. Enable only for the intended public production site.                                                                                                 |
| `SITE_ORIGIN`             | Approved production HTTPS frontend origin for canonical URLs. Leave empty on previews.                                                                                                |
| `NEXT_PUBLIC_MEDIA_HOSTS` | Optional comma-separated image-storage hostnames; no scheme or path. Needed for externally hosted product/vehicle images.                                                             |
| `ASSET_STORAGE_HOSTS`     | Optional comma-separated private-upload/download storage hostnames. Must match backend storage and its browser CORS configuration.                                                    |

An omitted backend origin enables a frontend-only preview. If supplied, the
origin must be a reachable HTTPS URL; local or non-HTTPS origins are rejected. A build
does not prove that the remote API is online or correctly configured. Redeploy
after environment changes: API rewrites and public media settings are compiled
at build time. Keep database credentials, signing keys and provider secrets on
the backend. Local `.env` files are excluded from CLI uploads.

## Connect authentication and payments

Browser requests keep using `/api/v1` on the frontend origin. The existing Next.js
rewrite forwards requests to the API. Server-rendered public pages call that same
configured backend directly. No public API base URL is needed.

On the **backend**, configure the actual frontend address:

- `FRONTEND_URL`: comma-separated exact allowed frontend HTTPS origins. Used by
  CORS and CSRF checks; adding a Vercel deployment alone does not update this list.
- `WEBAUTHN_RP_ID`: the stable frontend hostname, without `https://` or a path.
  `WEBAUTHN_ORIGINS`: exact corresponding HTTPS origins. Passkeys are domain-bound;
  use a stable staging hostname for preview authentication testing.
- `FRONTEND_VERIFY_EMAIL_URL`: `<frontend-origin>/verify-email`.
- `FRONTEND_RESET_PASSWORD_URL`: `<frontend-origin>/reset-password`.
- `FRONTEND_PRIVILEGED_INVITATION_URL`: `<frontend-origin>/staff/accept-invitation`.
- If payment providers are enabled, set their configured callback URLs to
  `<frontend-origin>/payments/complete`. Provider webhooks remain backend endpoints.

For a separately hosted production backend, use its production runtime settings, including secure
host-only session cookies. Existing cookies and CSRF protections remain in place;
do not add a cookie domain or bypass origin validation. Configure trusted proxy
settings for the actual backend ingress topology using the backend runbook.

For authenticated previews, explicitly allow the chosen preview/staging origin on
the selected backend (including your local backend). A changing preview URL does
not automatically become trusted.

## Verification after deployment

1. Open public services/products and verify data loads through the deployed API.
2. Log in with a test account, refresh the dashboard, and verify the session remains.
3. Check a permitted form save and logout; confirm there are no CSRF/origin errors.
4. Check staff MFA on its configured stable hostname.
5. If configured, verify images and a test private upload against storage CORS.
6. Keep preview robots disabled. Check canonical links only on the approved domain.

Typical configuration failures:

- A supplied `BACKEND_ORIGIN` is rejected: remove it for a frontend-only preview, or use a valid HTTPS API origin, then redeploy.
- `/api/v1` returns 502/504: check the backend origin, HTTPS certificate and reachability.
- Mutations return 403: check exact backend origin allowlists and the account's permissions.
- Passkeys fail: check the RP hostname and WebAuthn origin configuration.

Local verification can simulate Vercel build mode in PowerShell (example origin
only; this does not deploy or prove API connectivity):

```powershell
$env:VERCEL = "1"
$env:VERCEL_ENV = "preview"
$env:BACKEND_ORIGIN = "https://api.example.com"
npm run build
```

Run this in a dedicated terminal so these settings do not replace your normal local
development environment. Build from `frontend`, not the repository root.

References: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/),
[Vercel Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs),
[monorepo root directories](https://vercel.com/docs/monorepos),
[Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
[system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables),
and [external rewrites](https://vercel.com/docs/rewrites).
