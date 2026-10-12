# Paystack dispute contract acceptance

Recorded 13 October 2026. This closes the local BG-12 implementation gap and records SEC-031. Deployed provider acceptance remains open.

## Behavior

Every signed raw `charge.dispute.*` event triggers an authenticated lookup of its exact dispute ID. The parser no longer requires a fabricated top-level amount. The adapter validates test/live domain, nested transaction identity, currency, integer amounts and timestamps. Processing correlates the result with a successful stored capture and its verified amount/currency and gateway transaction ID. A conflicting webhook reference, capture identity or future timestamp retains a failed receipt and a bounded anomaly rather than creating financial records.

The [Paystack Dispute API](https://paystack.com/docs/api/dispute/) distinguishes transaction amount from `refund_amount` and supplies provider status and resolution. The [dispute guide](https://paystack.com/docs/payments/manage-disputes/) permits partial acceptance. Accordingly, `amountKobo` preserves the original transaction exposure while the new nullable `chargebackAmountKobo` stores only a confirmed loss. The ledger debit uses that loss and the provider resolution time. [Paystack's support guide](https://support.paystack.com/en/articles/2125698) describes merchant decline as evidence for bank review; the application does not infer a win from that action.

| Provider facts | Application outcome | Financial effect |
| --- | --- | --- |
| `awaiting-merchant-feedback` | Awaiting response | None |
| `awaiting-bank-feedback`, `pending` | Under review | None |
| `resolved` plus `merchant-accepted`, positive bounded refund amount and resolution time | Accepted | One debit for confirmed amount |
| Explicit `lost` or `accepted`, positive bounded amount and resolution time | Lost or accepted | One debit for confirmed amount |
| Explicit `won`, resolution time and no positive refund | Won | None |
| Explicit `expired`, resolution time and explicit zero refund | Expired | None |
| Declined, archived, unsupported resolution or incomplete terminal facts | Under review with reason | None |

The explicit internal status aliases are compatibility handling, not a claim that Paystack documents all of them. Unknown future provider outcomes remain reviewable. No automated provider evidence submission was added.

Provider status, resolution, review reason, provider update time and confirmed amount are available in both authorized dispute APIs. The admin overview and assigned-operator work queue display the confirmed amount separately and explain ambiguous outcomes. Historical null values display as unconfirmed, not zero. Existing role, capability, assignment, MFA and private-evidence boundaries remain in force.

## Delivery, concurrency and history

Raw event content hashes distinguish changed reminders while deduplicating identical deliveries. Durable retries, including receipts saved by older code, always obtain a fresh provider result. No raw provider payload or credential is saved. An unavailable lookup leaves the existing retry/dead-letter workflow in control.

Provider calls run outside database transactions. The dispute advisory lock, shared refund-dispatch lock, row lock and webhook claim check protect applied state and ledger effects together. Older provider update timestamps cannot regress an open record. The first resolved outcome, timestamp and confirmed chargeback amount are immutable; later conflicting amounts are retained as anomalies with bounded comparison facts. A lost webhook claim rolls back financial and anomaly writes.

Migration `20261013080000_paystack_dispute_contract` adds five nullable fields and a chargeback amount constraint. It extends the resolved-record trigger to protect the confirmed amount. It does not guess or backfill historical financial facts.

## Verification

- Provider/parser unit run: 40 cases across dispute-contract and identifier suites passed.
- Broad backend regression: 154 cases across 13 files passed with no skips (`%TEMP%/allied-paystack-dispute-regression.json`).
- Final backend run on a fresh migrated database: 41 cases across dispute contract, dispute integrity and webhook financial ownership passed with no skips (`%TEMP%/allied-paystack-dispute-final.json`). This includes five additional cases, giving 159 unique backend cases across the two regression runs.
- Six frontend unit cases passed for workflow handling, partial amount presentation and ambiguous review states.
- Prisma validation, typecheck, backend build/lint, targeted frontend lint, affected formatting, OpenAPI validation (266 paths), route coverage (315 operations plus four infrastructure routes), secret scanning and diff checks passed. Generated OpenAPI, handbook and frontend types include the new facts. The final Prisma validation command completed successfully after a slow startup.
- All 55 migrations replayed on new `allied_paystack_dispute_contract_20261013_test`. Upgrading `allied_refund_poll_replay_20261012_test` preserved all 12 historical synthetic disputes and 52 ledger rows, compared by canonical row digest. Only isolated test databases were migrated.

### Browser verification

Flow: super-admin dispute work queue → include resolved disputes → inspect a partial chargeback → open the overview → refresh with an unresolved provider outcome. Playwright uses synthetic API fixtures; signed HTTP/provider adapter/database behavior is verified separately above.

Environment: `http://localhost:3000`, Next development server, Edge headless, desktop 1440×1000 and mobile 390×844. Browser plugin not available; the existing Playwright configuration is used. All 14 browser scenarios passed across the regression and final targeted reruns: 12 existing workflow cases, the new provider-facts scenario and the responsive/accessibility scenario. The latter checks eleven widths from 320 to 1920 pixels.

| Check | Result |
| --- | --- |
| Page title, URL and meaningful content | Passed for work queue and overview |
| Confirmed partial amount and unconfirmed review state | Passed after navigation and reload |
| Framework error overlay | None |
| Application console/page errors | None; development-tool messages recorded separately |
| Horizontal overflow | None at eleven tested widths |
| Mobile accessibility | No axe violations in the tested states |
| Private evidence, assignment, permissions and uncertain actions | Existing regression cases passed |
| Screenshot inspection | Desktop facts and mobile review explanation readable |

Screenshots: `%TEMP%/allied-dispute-contract-desktop.png` and `%TEMP%/allied-dispute-contract-mobile.png`. Final targeted browser output: `%TEMP%/allied-dispute-contract-final2-playwright`. Key commands were `npx playwright test tests/e2e/dispute-workflow.spec.ts` and a targeted rerun with `--grep 'work queue fits|super admin sees'`, each using a separate output directory.

The initial cold navigation exceeded the 15-second assertion timeout while the overview route compiled. Shared Playwright output also collided with another run; subsequent runs use `%TEMP%/allied-dispute-contract-playwright`. The second run exposed a test-fixture mismatch: the overview API omits an absent cursor while the work API returns null. The fixture was corrected to match each real contract.

Two console assertions subsequently reported only injected Console Ninja failures: a blocked loopback WebSocket and its named log-delivery warning. Tests now attach those narrowly identified development-tool messages separately while continuing to fail on application errors/warnings. CSP was not changed. The final two-case rerun passed after that separation. These checks use a development server and synthetic browser fixtures, not a deployed production build or a live Paystack account.

## Rollout and limits

Drain old API/general workers, apply migrations, and deploy matching API/workers and frontend. Older code does not understand partial confirmed amounts and must not keep processing dispute receipts. Historical resolved records remain unchanged; discrepancies require evidence-based financial review.

Validate real Paystack test-mode webhook delivery and authenticated dispute lookup in the deployed environment before live acceptance. No provider account, application database or deployment was modified. Reservation wording remains pending owner approval; online reservation stays gated by approved published terms. This slice does not certify the full backend or close other release/infrastructure gates.
