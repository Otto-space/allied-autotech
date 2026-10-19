# Dispute work queue — implementation specification

Use the established ink sidebar, pale grey work surface, white bordered controls and restrained red selection/primary actions. Quicksand throughout; heading 30px desktop / 24px mobile; body 14px, control text 16px mobile. No decorative automotive photography in this sensitive operational workflow.

## Composition

Compact route-aware breadcrumb, heading and one sentence of guidance. Admin/Super Admin overview link follows live access. One toolbar combines a visibly labelled open/all history select, refresh and loaded-page result count (never a fabricated global total). A ruled queue shows reference/provider, friendly status, exact disputed amount, response deadline and assignment. Review opens an independently fetched current-record workspace below the compact list; on mobile move focus/scroll to its heading. Keep safe drafts mounted when the workspace closes, scoped by actor and record. URL owns history, cursor trail and selection; browser Back/Forward restores them.

The selected workspace uses a compact identity header, separate disputed/confirmed-chargeback facts, two operator facts, full provider facts and lifecycle disclosure, then assignment (administrators only), acknowledgement, original evidence and provider receipt sections in clear operational order. Desktop related fields use two columns; mobile uses one column. Controls have strong borders and 44–48px touch height. Notes are compact textareas. Long references and exact large money wrap without truncation or strikethrough. Separate status, evidence preservation and provider outcome.

## Safety and state behavior

Live own-profile capability gates every fetch and action. Staff scope is validated in both client DTO and backend. Denial clears privileged facts and private links. Fresh profile/current record are checked before confirmation. Use the real conditional payload and validate the complete action-specific response. An ambiguous send leaves a minimal actor-bound persistent lock; no automatic replay. Recovery requires a fresh current read and an explicit independent reconciliation acknowledgement; it never asserts that observed facts prove the original request or audit note. Clear earlier recovery facts on every new review/current lookup. Retire only the successful action's draft after a verified receipt. Cancellation returns focus to the opener.

Do not persist upload tokens, files, signed URLs or sensitive prepared evidence. Abort stale uploads and clear private state on denial. Closed history remains readable, including authorized evidence access, but offers no write forms. Missing deadlines, missing assignments, uncertain provider outcomes and absent evidence have precise labels.

## Acceptance

Inspect desktop/mobile generated concepts at native size and record necessary corrections before implementation. Verify 320, 375, 430, tablet, laptop, desktop and wide desktop. Cover keyboard review/cancel/success focus, filter URL history, cursor bounds, expired capability/assignment, stale records, duplicate sends, uncertain-response reload/recovery, upload evidence, private download host validation, immutable closed history, long references and maximum exact money. Run focused production browser/Axe, helper tests, backend authorization/DTO/audit tests, type/lint/build and connected isolated-database workflow with financial preservation evidence. Do not repeat unchanged completed database migration checks.
