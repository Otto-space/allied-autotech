# Customer care - expanded page gate

Route: `/dashboard/support`.

Status: locally accepted on 12 October 2026, the forty-fifth expanded frontend milestone. Detail routes remain separate subsequent gates; whole-application and deployed acceptance are not implied.

## Audit and design

Four pre-edit views at 390, 768, 1280 and 1440 showed a large filter wrapper and a creation form below the first desktop viewport. Customer unknown outcomes were kept only in component state. Fresh [desktop and mobile/state concepts](customer-care-oct-concepts/README.md) and the extracted specification preceded production edits.

The customer page now places the compact request form beside a ruled conversation history. The history has an ink header, explicit statuses, actual branch and Lagos date, complaint priority and owned detail links. Mobile stacks fields and sections; full subjects wrap. The existing account shell and Quicksand typography remain in use. A functional history anchor and Help centre link provide navigation.

SupportPanel routes CUSTOMER sessions to account-keyed customer state. Staff queues remain on the existing implementation. Shared SupportCreateForm receives opt-in dashboard presentation and guarded creation. SupportSourcePicker and SlotCatalogPicker report unavailable/stale reads; branch-picker behavior is opt-in for this page. Public Contact and customer/staff thread regressions remain in scope.

## Contract and recovery

Existing GET/POST `/customers/support/enquiries` and `/customers/support/complaints` remain authoritative. Six enquiry types and four complaint source choices are preserved. The backend validates ownership, active branches, related records, body fields, CSRF and rate limits. No backend endpoint, schema or migration was added for this page.

- A fresh CUSTOMER session check precedes every confirmed creation. A different account, different role or failed session read prevents POST.
- An account/category-scoped session marker contains only `pending`, written and verified before POST. Unknown or contradictory outcomes retain it across reload/category changes; no automatic replay.
- Explicit successful history refresh resets to the first unfiltered page and precedes acknowledgement. Customers are told to check all relevant pages; absence from page one does not prove failure. A failed manual read cannot be replaced by a later background success.
- Foreground history errors hide obsolete records. Temporary background failures preserve records with a stale warning and block creation. Previous navigation remains available after a failed later page.
- Required picker staleness also blocks creation, including when confirmation is already open. Source/branch refresh permits recovery. The backend still validates final source availability.
- Known rejections clear the marker and Retry-After pauses creation. Unavailable marker storage prevents POST. Successful creation clears the account/category draft before navigation to the returned detail.
- Type, related source, branch and text participate in existing account-scoped draft restoration. These are unsent drafts; recovery markers contain no request content or credentials.

The [backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md#support-creation-replay---optional-enhancement) records durable support replay as an optional contract extension. Current local frontend recovery does not implement backend idempotency or verify notification delivery.

## Verification evidence

Local artifacts are under `C:/Users/PC/.codex/`.

| Check                       | Result and evidence                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial production build    | `customer-care-oct-build.log` passed compilation, TypeScript, 71 routes and standalone preparation.                                                                                                                                                                                                                                                                                    |
| Initial browser suite       | `customer-care-oct-browser.log`: 78 passed, 3 failed. One short-viewport timeout had an anomalous 8.8-minute duration; a pagination test set failure before initial loading completed; the initial bundle lacked the subsequently added branch-staleness refresh control. All three passed in the subsequent 111-case run, including the unchanged short-viewport case in 2.1 seconds. |
| Initial responsive captures | `customer-care-oct-captures-recheck.log`: all 11 widths 320/360/375/390/430/768/1024/1280/1440/1505/1536 had no horizontal overflow. An earlier capture timed out waiting for fonts; the unchanged capture helper then completed. A subsequent concept-native review identified clipped status text; final CSS correction and captures are tracked below.                              |
| Real browser/API/PostgreSQL | `customer-care-oct-real.log`: complete helper passed against fresh `allied_customer_care_test`, exact database guard, disabled delivery providers, cleaned-up sessions/API/browser.                                                                                                                                                                                                    |
| Database preparation        | `customer-care-oct-migrations.log`: all 56 current migrations replayed successfully and read-only schema comparison found no difference. No application database was migrated.                                                                                                                                                                                                         |
| Backend safeguards          | `customer-care-oct-backend-unit.log`: six support/notification security cases passed.                                                                                                                                                                                                                                                                                                  |
| Resource refresh            | `customer-care-oct-resource-recheck.log`: five cases passed. The initial attempt failed to start its Vitest fork worker and ran no tests; no assertions were relaxed.                                                                                                                                                                                                                  |
| Scoped lint/format          | `customer-care-oct-lint-final.log` and final scoped formatting check passed.                                                                                                                                                                                                                                                                                                           |
| Final build                 | The attempted build in `customer-care-oct-build-final.log` exited because another build was already active. That process was verified live; its lock/output were not deleted. After that build finished, the independently recorded `customer-care-oct-build-accepted.log` passed all build stages and standalone preparation.                                                         |

Real acceptance exercised browser creation for all six enquiry types and four complaint source choices, saved OPEN status/default complaint priority, authoritative handling branch, 20+1 owned paging, cancellation with zero writes, and one record/creation audit after a committed response was deliberately dropped. Reload, refresh and acknowledgement did not replay the write. Direct API checks covered private no-store projections, absence of private contact/message fields, owner isolation, foreign source/detail 404, inactive branch 404, forged owner 422, missing CSRF 403, excessive limit 422, privileged customer-route denial and anonymous 401. No page errors were recorded.

Two helper fixture mistakes were corrected before the successful run: StaffProfile has no employeeCode field; a draft quotation is intentionally excluded from customer source choices and needed an issued fixture. Neither required a production backend change or relaxed visibility rule.

## Final acceptance

The final styling build passed in `customer-care-oct-build-layout.log`. All 19 affected responsive, accessibility, confirmation and short-viewport checks passed against that bundle in `customer-care-oct-browser-layout.log`. The preceding complete run passed all 111 customer-care, shared-support and public Contact scenarios.

`customer-care-oct-captures-accepted-recheck.log` records no horizontal overflow at all 11 widths. `customer-care-oct-states-accepted.log` records eight state captures without overflow or page errors. Native 1505 x 1045, 1440, tablet and mobile views were inspected against the retained concepts; empty, loading, error, source, complaint, confirmation, uncertain-outcome and bottom-of-page states were checked. One earlier final capture attempt received connection refused before the preview reported ready; the same preview and unchanged capture helper then completed successfully.

`customer-care-oct-health.log` verifies the expected page identity, nonblank rendering, no framework overlay, no console or page errors, and functioning filter/clear actions with zero writes. The standalone helper emitted a Node module-format warning while importing its TypeScript fixture; this was not a browser error.

Next: customer-care detail routes `/dashboard/support/[kind]/[supportId]`, followed by the remaining dashboard and role gates. Deployed integration acceptance remains separate.

## Final comparison and regression

`customer-care-oct-browser-final.log` records **111 passing cases**: 37 customer-care quality cases, 46 shared-support regressions and 28 Contact cases. This covers all enquiry/complaint choices, cancellation, exact source/body fields, private detail/message boundaries, public receipts, staff moderation/assignment and customer recovery. Four customer page/dialog accessibility widths, ten automated responsive widths, four extra state accessibility checks, short 320 x 480 with reduced motion, and account/role/stale-read/storage/rate-limit/draft cases are included. All 19 targeted cases passed again after the final visual-only correction.

| Comparison point        | Concept and browser evidence                                   | Result / correction                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition             | Accepted 1505 x 1045 desktop versus native browser capture     | Compact category toolbar and aligned form/history columns; existing breadcrumb adds necessary shell height.                                                                              |
| History controls        | Initial native capture clipped the last letter of All statuses | Set a 170px minimum on the status field and explicitly size desktop button padding/text. Final production captures at 1505 and 1440 show the complete value with all actions in one row. |
| Typography and branding | Both concepts versus real shell and section headings           | Actual Quicksand and approved logo retained; generated larger headings, altered logo and fictional account are excluded as recorded before coding.                                       |
| Form hierarchy          | Desktop pair and mobile stacked fields                         | Type/branch pairing, conditional source group, full-width subject/message, explicit 4000-character hint and review CTA preserved. General is title-cased for dashboard presentation.     |
| History content         | Ruled desktop/mobile records                                   | Full subject, neutral status, actual branch/date and complaint priority. No invented unread count, reply guarantee or internal contact data.                                             |
| Responsive controls     | Final production 320-1536 captures                             | No overflow at 11 widths; mobile control stack, large touch targets and readable text. Final desktop control correction passed the targeted repeat.                                      |
| Confirmation            | Mobile state concept versus confirmation screenshot            | Existing business-impact explanation and all actual facts remain; dialog fits 390 x 844 and the tested 320 x 480 viewport, with Escape and focus restoration.                            |
| Recovery/error          | Mobile state concept versus actual uncertain/error screenshots | Explicit unknown-outcome instructions, disabled new submission, available history navigation and manual acknowledgement; safe error text remains separate from empty state.              |

Browser tools: Browser plugin absent; Playwright with installed Edge on `http://localhost:3001` used the production standalone build. Baselines and concepts were inspected before edits. Both accepted concept images and the resulting native/mobile screenshots were opened directly for comparison. Final production captures confirmed the last desktop CSS adjustment.

The real API/database run passed before that final styling-only adjustment. It does not certify deployed notification delivery, Maps configuration, other browsers or remaining dashboard/detail routes.

## Customer creation recovery contract update

Customer enquiry and complaint creation now requires an original request key, with explicit recovery after response loss and reload. The retained normalized request is reviewed in a separate confirmation; current form edits do not change it, and no navigation/reconnect event sends it automatically. Recovery opens the current owned conversation without duplicate creation or audit. Account changes close the confirmation and require session verification. Legacy or expired markers retain the existing history-reconciliation flow. Customer reply recovery has its own account/conversation-scoped key and confirmation flow; anonymous public-contact recovery remains separate.

Local acceptance: 94 unique production-Edge browser cases passed across the new recovery cases and customer-care/shared-support regression, including four real API/database cases. Both operations passed recovery-dialog accessibility/overflow checks at 1440 and 390 pixels. See [support creation recovery](../../../backend/docs/support-creation-recovery.md) for exact backend/frontend evidence, release coordination and limitations. This updates the contract beneath the accepted design; it does not certify deployed provider delivery.
