# Refund observation integrity

Updated 11 October 2026.

## Behavior

Paystack refund callbacks correlate only with refunds on Paystack payment attempts, including when a provider refund ID is supplied. A matching ID from another provider cannot mutate or attach that refund to the event. Missing correlation retains the existing bounded retry behavior.

Completed refunds and their ledger entries remain unchanged after later pending, failed, amount-mismatched or currency-mismatched observations. Failed or mismatched observations create a `REFUND_MISMATCH` anomaly under the refund row lock. The anomaly records expected/observed amount and currency, recorded/observed status, observation source and whether the provider identity matched. It does not copy raw provider payloads or credentials. PostgreSQL's existing succeeded-refund immutability trigger remains intact; no migration was required.

Previously, Monnify mismatch handling attempted a prohibited rewrite of a completed refund, causing the callback to fail. Paystack and reconciliation could silently discard discrepancies after completion. The new handling retains those discrepancies while allowing the owning webhook attempt to finish. If event ownership is lost, the existing transactional claim guard rolls back the anomaly and financial writes together.

An exact pending or failed callback leaves an existing `NEEDS_ATTENTION` hold and its reason unchanged. A reconciliation response arriving after a callback has completed or held the refund cannot reopen it. Exact successful callbacks retain the existing completion workflow and single ledger entry. These changes do not replay refund submissions, change approval authority, enable a payment provider or automatically resolve anomalies.

## Focused verification

The isolated `allied_refund_observation_20261011_test` database contains all 51 committed migrations. No application database was changed.

The initial 17-case suite reproduced 14 failures (`%TEMP%/allied-refund-observation-before.json`); the first repair passed all 17. Four additional hold-preservation cases then reproduced three failures (`%TEMP%/allied-refund-hold-before.json`). With the callback guards applied, all 21 cases passed (`%TEMP%/allied-refund-observation-final.json`).

The cases use actual PostgreSQL transactions and injected providers. They cover both providers, late worker responses coordinated with callback completion, held-state preservation, cross-provider matching, exactly one ledger entry and rejection of direct completed-refund rewrites by PostgreSQL. No external payment or message was sent.

The broader 14-file payment regression run recorded **117 passes and one failure** (`%TEMP%/allied-refund-observation-regression.json`). The failure was the webhook retry test counting every dispatch during a second worker run, including an unrelated queued receipt. The test now counts dispatches for its own event claim and independently asserts that the receipt remains `DEAD_LETTER` at attempt nine. The final three-file refund/webhook follow-up passed **42 tests**, with no skips (`%TEMP%/allied-refund-observation-followup.json`). The original broad run is not represented as fully green.

Backend typecheck, lint, build and affected-file formatting passed. OpenAPI validation passed for 265 paths; route coverage matched 314 operations plus four infrastructure routes. OpenAPI, endpoint handbook and frontend types were regenerated with descriptive changes only; frontend `tsc --noEmit` passed. The secret guard passed for 1,658 non-ignored files, and `git diff --check` passed. Rendered frontend behavior did not change for this repair, so browser tests were not repeated.

## Rollout and remaining work

Deploy the API and general workers together after draining older processes. This change has not been deployed. It adds no endpoint or response field; webhook descriptions document the behavior in the generated API artifacts.

Review historical failed callbacks and anomalies against provider evidence before requesting any retry. This repair does not rewrite financial history or reset retry budgets. Live provider acceptance, overlapping reconciliation retry scheduling and historical stranded notification recovery remain separate work. Existing owner policy and disabled Monnify configuration remain unchanged.
