# Allied AutoTech

The Next.js frontend deploys to Vercel. The Express API, PostgreSQL database and
identity/general background workers run on separate infrastructure.

## Vercel setup

Import this repository and set **Root Directory** to `frontend`, **Framework** to
Next.js and **Node.js** to 24.x. The checked-in `frontend/vercel.json` supplies
`npm ci` and `npm run build`; leave Output Directory at the framework default.

Enter these variables in Vercel's **Production** environment before deploying:

| Variable         | Value                                                         |
| ---------------- | ------------------------------------------------------------- |
| `BACKEND_ORIGIN` | Your hosted HTTPS API origin, without `/api/v1`               |
| `SITE_ORIGIN`    | Your production HTTPS frontend origin                         |
| `SITE_INDEXING`  | `disabled` until public launch, then `enabled` if appropriate |

The API and frontend origins must be different. Production builds reject missing
or invalid origins. A Preview deployment can render without an API by leaving
`BACKEND_ORIGIN` unset; previews always disable search indexing.

Configure the backend's allowed frontend origins, passkey hostname, email links,
storage and payment callbacks for the same production domain. Database/provider
credentials stay on the backend. See the complete
[deployment runbook](frontend/docs/vercel-deployment.md),
[frontend environment inventory](frontend/.env.production.example) and
[backend runbook](backend/docs/owner-staging-runbook.md).

## Local release checks

```powershell
npm --prefix frontend ci
$env:BACKEND_ORIGIN = "https://your-api-host.example"
$env:SITE_ORIGIN = "https://your-frontend-host.example"
$env:SITE_INDEXING = "disabled"
npm run check:production
```

Use your actual origins. These checks validate configuration and the production
artifact; they do not prove API reachability, live payments or end-to-end workflows.
GitHub Actions runs the same frontend checks on Linux with example origins.

For local development, run `npm run dev` after installing frontend dependencies.
Use the [frontend README](frontend/README.md) and [backend README](backend/README.md)
for full setup. Backend migrations and workers require their own deployment;
Vercel hosting does not start them. Remaining platform verification is tracked in
the [completion audit](frontend/docs/completion-audit.md).
