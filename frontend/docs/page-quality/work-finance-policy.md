# Financial policy — local acceptance

Accepted locally on 18 October 2026, milestone 87. Route: `/admin/finance-policy`. Overall application and deployed acceptance remain open. Next separate page: staff management `/admin/staff`.

## Result and behavior

The page now leads with the effective policy, followed by distinct next scheduled and latest recorded facts. The server selects from the complete version history, preventing 100 future records from hiding the currently effective version. Invoice identity, payment terms, configured VAT treatment, applicability, discount ordering and rounding remain visible. History expands one compact version at a time. Existing Quicksand, Allied branding, dashboard navigation, form controls, feedback and confirmation dialog are reused.

Staff/Admin read access follows live FINANCE_POLICY_APPROVE; Super Admin retains read access without it. Every publisher still needs the grant. Fresh profile/version preflight, full publication receipt validation, retained drafts, session-bound unknown-result locks and explicit reconciliation protect the workflow. Existing policy scheduling/concurrency and transaction snapshots are unchanged. See the [backend contract](../../../backend/docs/finance-policy-workspace.md) and root gaps ADM-51/ADM-52.

## Design and fidelity

Production baselines at 430, 768, 1280 and 1440 pixels preceded fresh built-in ImageGen [desktop](work-finance-policy-oct-concepts/desktop.png) and [mobile](work-finance-policy-oct-concepts/mobile.png) concepts, both inspected at native resolution. The [audit](work-finance-policy-oct-concepts/audit.md), [specification](work-finance-policy-oct-concepts/spec.md), [prompts](work-finance-policy-oct-concepts/prompts.md) and [corrections](work-finance-policy-oct-concepts/corrections.md) record design decisions before implementation.

| Comparison              | Rendered evidence                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and hierarchy     | Real Allied shell; current policy precedes schedule/latest and approval form. No generated branding, invented search, source dropdown or payment terms.                                                                                                             |
| Type and content bounds | Quicksand, 30px desktop / 24px mobile heading and 14px body. At 1440, x292 and width1112; at 430, x16 and width398.                                                                                                                                                 |
| Current facts           | Desktop tracks564/470px with28px gap; mobile full-width invoice facts and paired calculation facts. Current summary is approximately297px high desktop and567px mobile with all actual contract facts retained.                                                     |
| Form density            | Desktop two520px tracks with22px horizontal/16px vertical gaps. Mobile one364px track with16px gaps. Inherited field margins were explicitly removed.                                                                                                               |
| Controls                | Name input520×48px desktop /364×48px mobile,16px text and visible border. Textareas retain the established132px height after native inspection, allowing full address, terms and approval provenance.                                                               |
| History                 | Ruled expandable records show version, approval status and Lagos effective time; complete settings/provenance remain available without 100 expanded cards.                                                                                                          |
| Interaction states      | Native desktop, laptop, tablet, mobile, form, expanded history, review, reconciliation and success captures inspected. Cancel returns focus; success focuses a visible confirmation heading. Generated inline mobile labels were replaced by labels above controls. |

## Verification

- 28 distinct production browser scenarios passed. Final six affected cases passed after the success-focus correction: three publishing roles, cancel/draft retention and both reload-recovery cases. Success visibility also passed a focused mobile check.
- Five frontend unit tests passed: authoritative state/receipt validation and minimal recovery storage, redaction, unavailable storage and actor changes. The three state/receipt tests were rerun after validation was strengthened.
- Three backend API/database cases have passing evidence. An initial fixture timestamp failed before policy seeding; the corrected setup passed the read/publication cases. A validation expectation was corrected from400 to the existing422 response and only that failed case was rerun, without repeating policy mutations.
- Seven responsive widths320/375/430/768/1280/1440/1920 plus empty/error/denied, desktop recovery and five mobile form/history/review/recovery/success states yielded16 distinct new page/state Axe checks with no violations. The legacy mobile review scan also passed. No horizontal overflow or browser page errors were observed.
- Production build, frontend/backend types and focused lint passed. OpenAPI export/types and route coverage passed:304 paths,358 documented operations plus four explicit infrastructure routes.
- Connected production Edge/API/PostgreSQL verified two future publications/two CREATE audits, exact returned settings, draft retirement, a committed-lost response, reload lock and fresh-read independent reconciliation without replay. The first publication was preserved when the focus check failed; continuation performed only the remaining publication. The resumed baseline preserved122 policy records, current effective policy and38 payments/38 attempts/31 refunds/37 invoices/eight ledger entries/29 disputes. Nine READ audits were recorded during continuation and zero owned temporary sessions remained.

Evidence files under `C:/Users/PC/.codex/` use the `work-finance-policy-` prefix: baseline/final captures, state/success captures, measurements, production/focused Playwright output, API logs, connected result/progress and source hashes. The connected preservation window explicitly includes the earlier successful future publication. No claim is made that a later current read proves the original request by itself.

All 12 tracked frontend runtime/contract/test source hashes match the final production snapshot. Only test-source formatting/assertion updates were synchronized after the final build; runtime source remained unchanged. Final focused formatting and lint checks passed.

## Limits

Only the verified isolated test database received synthetic fixtures/future publications. No application/shared database, schema migration, existing privilege change, destructive maintenance, backup/restore rehearsal, external provider, push or deployment operation ran. Existing migration checks were reused. Business/accounting provenance remains supplied by authorized approvers. The full goal remains active.
