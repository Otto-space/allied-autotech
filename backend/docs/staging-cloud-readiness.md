# Staging and Cloud Readiness

## When DevOps work begins

DevOps engineering begins during Phase 8. Payments introduce externally delivered HTTPS webhooks, provider secrets, reconciliation, financial alerts, and recovery obligations that cannot be validated faithfully only on localhost. Phase 8 development may continue locally, but it is not accepted for release until a production-shaped staging environment exists.

## Recommended topology

Use Cloudflare for DNS, TLS, WAF/DDoS controls, rate-limit rules, and optionally an outbound-only Cloudflare Tunnel. Run the containerized API and workers on DigitalOcean App Platform or hardened Droplets. Prefer DigitalOcean Managed PostgreSQL for production; do not colocate the sole production database on an application Droplet.

For the browser-facing staging slice, publish one HTTPS origin. Cloudflare serves the frontend and
routes `/api/v1/*` to the API origin. This keeps the host-only session cookie and strict
same-origin CSRF/fetch-metadata checks intact. Do not set `TRUST_PROXY_HOPS` from a template:
validate the exact Cloudflare/Tunnel/App Platform or Droplet path first, then set the observed fixed
hop count and test spoofed forwarding headers.

```text
Browser / Paystack
        |
Cloudflare TLS, WAF, Access (docs/admin)
        |
Tunnel or restricted DigitalOcean ingress
        |
API containers ---- worker containers
        |                   |
        +---- Managed PostgreSQL
        +---- private S3-compatible storage
```

## Staging gate for Phase 8

Before live payment testing:

1. Create an isolated DigitalOcean project, private network, managed PostgreSQL cluster, container registry, API service, worker service, and migration job.
2. Put `api-staging` behind Cloudflare with Full (strict) TLS. Prefer Tunnel; otherwise allow origin ingress only from the intended proxy path.
3. Inject secrets at deploy time. Never build them into images or commit them: database password,
   managed-database CA file, four independent crypto keys, Paystack test secret, Resend key, and
   object-store credentials. Use `DB_SSL_MODE=verify-full`; run `npm run check:db-tls` in the
   staging network and retain the sanitized result.
4. Set exact HTTPS frontend/WebAuthn/callback origins and determine the real proxy hop count from observed requests. Test spoofed `X-Forwarded-For` handling.
5. Register the Paystack test webhook URL and exercise valid, forged, duplicate, delayed, reordered, and amount/currency-mismatch events.
6. Enable encrypted backups and point-in-time recovery where available; restore a backup into an isolated database and run integrity checks.
7. Ship redacted structured logs, payment anomaly metrics, webhook retry/dead-letter alerts, readiness alerts, and reconciliation mismatch alerts.
8. Run migration replay and the full database-enabled test suite as a release job before promoting the same immutable image.
9. Keep hosted Swagger/OpenAPI disabled. Share the generated OpenAPI JSON privately with the
   frontend developer and regenerate/validate it from the release revision.

## Droplet baseline

If Droplets are used, keep SSH key-only, disable password/root login, enable automatic security updates, run containers as non-root, use a host firewall plus DigitalOcean Cloud Firewall, expose no database port publicly, and retain off-host backups. Use at least two API instances and separately deploy workers when availability matters. App Platform is operationally safer unless low-level host control is required.

## Promotion criteria

Promote staging to production only after Paystack test-mode end-to-end settlement/refund tests, Cloudflare ingress validation, restore testing, observability alerts, zero-secret image inspection, migration rollout-forward rehearsal, and external security testing pass. Phase 10 completes the reusable deployment manifests and production runbooks; the environment design and staging account should not wait until Phase 10.
