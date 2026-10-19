# Payment disputes overview — gate 85 audit

Status: locally accepted as gate 85. See the [final report](../work-payment-disputes.md) for behavior, visual comparison and verification. The audit below preserves the pre-implementation findings.

Production `/admin/payment-disputes` was captured and visually inspected at430,
768,1280 and1440 ×1050. Private evidence: `work-payment-disputes-baseline-{width}`
viewport/full-page PNGs. No overflow, page error or mutation request occurred.

The first record starts below a long introduction, oversized filters and separate
refresh controls. Its disputed amount inherits a retail `.price` strikethrough,
which incorrectly suggests a previous price. Raw status/category enums, long UUIDs
and repeated lifecycle metadata slow scanning. Filters/cursor state disappear on
reload. The management destination appears for every administrator, including those
without the capability its API requires.

## Verified contract and access

- Overview: current Admin/Super Admin under the existing authenticated privileged
  session and workforce boundary. GET `/admin/operations/payment-disputes` supports
  status/category and UUID cursor, limit1–100/default25. Order openedAt then ID
  descending. A minimal successful queue READ audit is already present.
- The safe overview includes provider/reference, status/category, exact amountKobo,
  nullable confirmed chargeback, provider status/resolution/review reason/update time,
  currencyNGN, response deadline, opened/responded/resolved/updated times and
  hasEvidence. Raw evidence keys are excluded. Unknown chargebacks are not zero;
  evidence recorded does not establish provider acceptance.
- Successful overview responses currently lack an explicit private no-store header.
  Add it without a schema/migration or financial mutation.
- `/admin/payment-disputes/work` is a separate existing page. Its API `/staff/disputes`
  requires a current DISPUTE_MANAGE capability even for Admin/Super Admin. Delegated
  Staff additionally needs primary/backup assignment. The overview link must follow
  the verified live capability, not role alone. Do not broaden access.
- No named detail route or GET-by-ID contract exists in this workflow. Keep overview
  disclosures honest about the loaded result set; do not invent a direct current
  endpoint, management selection parameter or provider action.

## Reuse and scope

Reuse the real Allied shell, Quicksand, visible form borders, profile/resource hooks,
cursor history helper, exact money/date formatters and DisputeProviderFacts. Improve
only the read-only overview; work-queue actions are the next separate gate.

Use compact status/category filters and a scannable ruled record list with distinct
disputed amount, confirmed chargeback, response deadline and evidence availability.
Technical/provider/lifecycle facts remain complete in labelled disclosures. Persist
supported filters, cursor history and expanded reference in the URL; UI expansion
must not refetch or forward unsupported API parameters. Page-only counts, explicit
loading/error/empty/denied states, live access confirmation, refresh and privacy
clearing are required. No money mutation or unsupported statistics.

Next: fresh desktop/mobile built-in image concepts, native inspection/correction
ledger, implementation, focused boundary/browser/API checks, production visual
verification, source hashes and acceptance documentation.
