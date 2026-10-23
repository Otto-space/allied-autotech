# Team notifications, browser push and email branding

## Behaviour

Customer, Staff, Admin and Super Admin accounts share an account-owned inbox, unread bell, read controls and delivery preferences. Staff sidebar counts now follow permitted navigation. Notification links use the actual resource identifier; workforce accounts open the scoped workspace and never fall back to legacy administration routes.

New support requests and customer replies notify active, verified team members whose current branch/responsibility permits the conversation, including the Super Admin. Sales responsibilities receive their permitted product/vehicle enquiries; assigned-only staff receive only assigned conversations. Assignments notify the recipient. Existing assigned-staff email delivery for customer replies is preserved. Workshop job assignments notify the technician. Existing dispute and complaint escalation recipients remain policy-controlled; dispute alerts now identify the dispute resource correctly.

Notifications are generic reminders, not copies of customer messages. Operational access is checked again when opening a record. Unknown resource types and inaccessible destinations have no guessed link. Existing historical notifications are not rewritten or broadcast again.

## Browser push

The Notifications page offers an explicit device opt-in, with no permission prompt on page load. It supports all account roles and provides an off switch. Unsupported, denied, failed and unconfigured states remain honest; the in-app inbox continues working independently. iPhone/iPad users need the Home Screen app on a supported OS/browser.

The push-only service worker caches no pages or API responses. Push text is generic, even on the lock screen. Clicks open an owned notification and resolve its permitted destination after authentication. Sign-out unsubscribes locally and closes displayed alerts. The server binds subscriptions to sessions and checks active status, ownership, expiry, revocation and staff MFA before delivery. A provider request already in flight can still deliver its generic alert; TTL is five minutes and opening it still requires account ownership.

Subscriptions contain encrypted endpoints/keys and a hash for uniqueness. CSRF is mandatory for registration and removal. Only recognised browser push provider hosts are accepted. One active registration is retained per session. Events use the durable outbox, fenced claims, bounded retries and 404/410 endpoint retirement. Re-enabling a subscription does not resurrect earlier queued updates. Delivery is best-effort; browser permission, OS settings, connectivity and session expiry can prevent it.

Configuration on the API and general worker: `PUSH_DELIVERY_ENABLED`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. The private key is a runtime secret. Enabled configurations must contain a matching P-256 key pair and a valid `mailto:` contact. Staging push delivery fails closed. Rotate keys only with a resubscription plan.

## Database and release

The additive `20261023010000_browser_push_subscriptions` migration creates `PushSubscription`; it does not change existing application rows or notification preferences. Deploy the reviewed migration with `npm run db:migrate` before API/worker code, then deploy the matching frontend. Keep runtime credentials non-owning and separate from migration/backup credentials. The existing `browse_enquiries` feature gates are preserved.

Validation completed locally: generated Prisma client; empty PostgreSQL 18 isolated `_ci` replay; isolated restricted-role integration checks for all roles, CSRF, ownership, provider validation, generic payloads, logout cancellation, expired endpoints and team scopes; `db:check`; backend type/script/lint/OpenAPI/route/secret checks; frontend typecheck/build and focused unit/browser/accessibility tests. A fresh production backup was restored into a separately created `_test` database, the migration replayed through the guarded runner, and existing data digests remained unchanged. Production rollout evidence is recorded separately; this document is not a deployment receipt.

## Emails and provider access

The shared HTML/text renderer covers account verification, resets, invitations, notifications and both support mail workers. It uses the supplied red mark on white, restrained red actions, a dark brand footer, escaped content and responsive table layouts. Support replies and status changes retain distinct wording. Email logo assets alone permit cross-origin image loading.

See [email designs and provider setup](email-branding/README.md) for ten reviewable templates and Google Groups assets. All company groups are in scope, but provider-side changes require an authorised session. Preserve every group's access, membership, moderation, subscriptions and routing. No email sending is included in this work.
