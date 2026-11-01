# Allied AutoTech delivery handoff - 1 November 2026

Implementation and independent verification are complete. External payment/AI
activation and operational acceptance remain incomplete, as listed below. This
supersedes historical pending-implementation notes; it does not claim every live
role, physical device or external account has been accepted.

## Published outcomes

- Catalogue cards retain prominent, moderately sized authentic images and essential
  information, restrained shadows and shared controls. The workshop story is on the
  homepage, absent from Tyre Change detail. Eight owner service groups and contextual
  enquiry links are preserved. Tyre Change is exactly NGN1,000.
- Booking source supports service/concern/group context, vehicle/contact details,
  preferred times, sign-in draft, review/retry, persistent reference and authorised
  staff proposal/confirmation/cancellation/capacity checks. A preferred time is not
  a confirmed slot. Current public browse/enquiry restrictions remain unchanged;
  booking deposits remain disabled under the approved request-and-confirm policy.
- Paystack source uses server-owned amounts, signed durable events, verified identity,
  duplicate protection, delayed reconciliation and review holds for reversals.
  See backend/docs/payment-requirement-audit-20261101.md for assertion mapping.
- Allie has a genuine server-side Responses adapter, bounded encrypted history,
  source/permission invalidation and canonical catalogue retrieval. Reviewed Help
  remains available without AI. Privacy guidance now links to the actual notice,
  preserves deletion/retention caveats and cannot expose staff privacy work.
- Destination-version negotiation preserves older open Help tabs during rollout.
  It changes supported destinations, never permissions. OpenAPI and client types
  were regenerated. No new database migration was needed for this release;
  83 migrations remain applied, including earlier reviewed implementation batches.

Runtime: 5d310b10ffb6b34119ef849dca0400b30de71a2a.
Frontend: dpl_xw7An14AFK7Nh17SnUpyEQGmJqCe, verified for apex and www.
Backend: dcb30c90-80d1-4ba4-9733-11e736ddc47b, ACTIVE with eight healthy workers.

## Verification

Required exact-master frontend/backend/secrets checks passed. Frontend CI had
1,311 passed and 12 deliberately skipped tests. The final package additionally
passed 82 focused backend cases, 38 frontend cases, 11 fresh-isolated HTTP cases,
67 payment contract cases, types/lint, canonical API validation, two local rendered
cases and ten packaged image/database checks. These overlap CI coverage; they
must not be summed into a claim of unique whole-site tests.

Six hosted cases passed: four intercepted-transport Help fixtures and two real-data
homepage/group journeys. Live Privacy search/refresh/navigation passed at 390/1440;
homepage/group journeys passed at both sizes on both domains. Legacy live Help and
both API destination versions passed during rollout. The first www image check
had a five-second timeout; independent diagnosis and bounded repeat passed. Logs
retain that failure. No real transactions/messages or paid model calls were used.

Current database health/privileges were checked read-only with strict TLS. Managed
backup retention was verified; the prior populated restore was reused only after
proving the schema and safety scripts unchanged. This is not fresh managed PITR
acceptance. Detailed evidence is in the completion tracker and quality register.

## Activation checklist

| Area                        | Status                                                                                                 | Exact remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Paystack application code   | Complete and independently tested                                                                      | Production PAYSTACK_MODE is disabled and PAYSTACK_LIVE_ENABLED is false. A secret setting exists, but its merchant/mode usability was not verified. Verify the existing PAYSTACK_SECRET_KEY, matching test mode, merchant NGN/settlement eligibility and dashboard callback/webhook registration. Complete provider test-mode return, webhook, duplicate and reconciliation acceptance before a separately reviewed live activation.                   |
| Paystack URLs               | Application routes implemented; dashboard registration unverified                                      | PAYSTACK_CALLBACK_URL: https://alliedautotech.com/payments/complete. Webhook: https://api.alliedautotech.com/api/v1/webhooks/paystack. A browser return alone is not settlement.                                                                                                                                                                                                                                                                       |
| OpenAI/Allie                | Adapter and independent tests complete; live activation incomplete                                     | Production OPENAI_API_KEY and ALLIE_OPENAI_MODEL are absent. Configure them server-side, verify project/model Responses access, billing and retention notice. A new explicitly bounded evaluation allowance is required: the previous 120 reservations were exhausted. Review HELP_LEARN_AI_ENABLED and ALLIE_AI_DAILY_TOKEN_LIMIT with frontend visibility and worker configuration after evaluation. No fake answer substitutes for live acceptance. |
| Published Help              | Enabled                                                                                                | HELP_LEARN_ENABLED, guides and practice are currently enabled. AI defaults off. Preserve these actual settings; no new activation occurred in this release.                                                                                                                                                                                                                                                                                            |
| Workshop booking            | Functional source and isolated customer/staff acceptance complete; public launch/operations incomplete | PUBLIC_LAUNCH_MODE remains browse_enquiries. Configure real branch calendars, service duration/buffers, staff and equipment capacity; review public booking enablement and authorised confirmation. Preferred requests must stay pending until approved. Verify notification delivery with an authorised operational test; queue atomicity and worker health do not prove email delivery.                                                              |
| Remaining acceptance limits | Explicitly unverified                                                                                  | No new signed-in staff production browser acceptance, physical-phone Safari/native 200% zoom/full screen-reader acceptance, or production-volume Allie retrieval benchmark. These are not represented by synthetic roles, desktop emulation or bounded catalogue tests.                                                                                                                                                                                |

Do not send keys, passwords or verification codes in chat. Configure provider
secrets through the existing protected hosting/account settings.

## Durable rules and records

AGENTS.md retains the approved design/delivery guidance via
docs/UI_UX_AND_CONTENT_RULES.md and docs/DELIVERY_AND_VERIFICATION.md.
Current requirement ledger: docs/EFFICIENT_DELIVERY_20261030.md.
Public content register/checkpoint: docs/help-learn/CONTENT_REGISTER.md and
docs/help-learn/PRIVACY_GUIDANCE_20261101.md.
Release/coverage: backend/docs/site-completion-tracker.md and
frontend/docs/UI_UX_QUALITY_REGISTER.md.

Current provider references: [Paystack acceptance](https://paystack.com/docs/payments/accept-payments/),
[Paystack webhooks](https://paystack.com/docs/payments/webhooks/) and
[OpenAI production guidance](https://developers.openai.com/api/docs/guides/production-best-practices).
