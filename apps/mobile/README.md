# Allied AutoTech Companion scaffold

Independent npm package: run all commands from `apps/mobile`. Do not add this
package to a workspace or change the root package/lockfile. Use Node **24.x**.

```sh
npm ci
npm ci --prefix tools/api-codegen
npm run api:generate
npm run lint
npm run typecheck
npm test
npm run format:check
npx expo-doctor
npm start
```

Copy `.env.example` to an ignored local `.env`. Set `EXPO_PUBLIC_API_BASE_URL`
explicitly to a local backend or demonstrably isolated staging API with test-mode
providers. It must end exactly in `/api/v1`. There is **no default API URL**.
An absent, malformed or blocked URL shows an in-app configuration error before
providers or queries mount. Production hosts are refused in **every** app
environment; `EXPO_PUBLIC_ALLOW_PRODUCTION_API` has no effect. Extending production
access requires a separately reviewed change. Owner must identify the isolated
staging URL and any further hosts to block before staging use.

Android emulator reaches the host at `10.0.2.2`; a physical phone needs the host's
LAN address and an accessible local backend listener. Cleartext HTTP is for local
development only. Use HTTPS for isolated staging. Do not put credentials, session
secrets or perimeter passwords into `EXPO_PUBLIC_*`: these values are embedded in
the bundle. The staging Basic perimeter is deliberately unsupported here; public
GETs behind that gate will fail with an honest error. Never fake Origin or CSRF.

For an explicitly **mocked**, empty emulator preview (not backend acceptance), run
`node scripts/preview-api.mjs` in another terminal, then temporarily configure the
API to that host's port 5155 and `/api/v1`. This loopback-only fixture supplies no
invented service names/prices and deliberately returns unavailable capabilities.
It makes no outbound requests. Shut it down with Ctrl+C after verification.

The shell has five tabs: Home (S05), Explore (S07–S09), Garage (S10), Activity
(S20), You (S24). Explore now provides the service catalogue, detail screens and
a read-only selected-service handoff for a future booking flow. The transport
permits `/public/services` (including validated cursor pagination),
`/public/services/:serviceId` (UUID only) and `/public/capabilities` GETs.
Selection carries only the service ID; details are loaded from the backend again.
No appointment is submitted or confirmed. No authentication, enquiry submission, bookings, payment, push,
analytics, image uploads or private-image transport exists. Generated types cover
the committed API document; the actual transport allows only those public reads.
Runtime Zod schemas validate the envelope, service identity and displayed fields.
List/detail errors support retry; unavailable services cannot be selected. Test
fixtures are confined to tests, never used as application fallback data.

Capabilities are advisory, memory-only and expire after 60 seconds. Unknown,
failed, malformed, inconsistent and expired snapshots disable all six action
helpers. Allie remains disabled because this response has no Allie entitlement.
Even a valid permission never enables a write in this scaffold. A global 403
handler shows the server message, drops the capability allowance, and refetches
the snapshot without retrying the rejected operation. A forbidden capabilities
read does not trigger a loop. Public/private queries use a session-generation
key; the signed-out session stub clears private queries and secure storage on
sign-out. There is no query persistence or disk cache. SecureStore's registry
only covers this wrapper's namespace, preserving unrelated app keychain items.

`src/api/client` documents unwired future perimeter-header and native-session
interfaces. Neither implements a credential flow or selects a native header.
Native auth needs the separately reviewed backend work described in Blueprint
§18.3/G06 and [the proposed ADR](../../docs/mobile/NATIVE_AUTH_DESIGN.md).

Expo SDK 58 uses React Native 0.88.1 / React 19.3.0 and SDK-matched native modules.
Quicksand is bundled via Expo Font, with system fallback on loading/failure;
owner must confirm font licensing for store distribution. Light mode only;
there are no animations or skeleton shimmer, so Reduce Motion is respected.
Controls expose native labels/roles and visible focus, and text scaling is not
capped. Physical VoiceOver/TalkBack, 200% type and full native focus acceptance
remain release gates, independent of Jest assertions.

The selected native modules (SecureStore, Font, NetInfo, safe-area-context,
screens and Router) are supported by the matching Expo Go; no scaffold dependency
requires a custom development build. Install a compatible SDK 58 Expo Go version.
[Expo Go guidance](https://expo.dev/go) and
[development-build guidance](https://docs.expo.dev/develop/development-builds/introduction/)
distinguish the sandbox from your own binary. Future sign-in redirects, own app
links and native push need an EAS development build, Android first; they are not
implemented here. No EAS configuration or credentials are included.

The owner must set the iOS bundle identifier and Android package before creating
an own-app binary. They are deliberately omitted from native config and marked
`OWNER_TO_SET` under `extra.ownerDecisions` in `app.json`.

The app uses TypeScript 6.0.3 as recommended for Expo SDK 58. OpenAPI generation
is an independent private npm package under `tools/api-codegen`, pinned to
`openapi-typescript` 7.13.0 and its supported TypeScript 5.9.3 compiler. Both
packages have their own lockfile and explicit `npm ci` step; there are no npm
workspaces or automatic install hooks. `npm run api:generate` delegates to that
tool package without installing anything. Keep both installs available when
regenerating contracts. See the report for actual verification results.

API generation reads only `backend/docs/api/allied-autotech.openapi.json` and
records its last-change Git commit in the generated header. The mobile-only CI
workflow regenerates it and rejects drift; it does not deploy, use secrets or
contact an app API. No source code is imported from the backend or frontend.

Read [the scaffold report](SCAFFOLD_REPORT.md) and
[the pre-launch checklist](../../docs/mobile/PRE_LAUNCH_CHECKLIST.md) before later
packages. Passing scaffold checks is not beta/store/production approval.
