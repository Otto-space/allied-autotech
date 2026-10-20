# Managed workforce complaints — milestone 108 specification

Route `/admin/workforce/complaints` is the only active page. Milestone 107 remains locally accepted. The preceding owner-advice turn did not change implementation state (no progress); this continuation revalidated current files and all four saved native baselines before design work.

## Audit and scope

The current generic queue repeats an oversized reply form for every complaint. It has raw statuses, no search or priority/status filtering, no named branch, no current conversation/history read and only in-memory paging. Refresh can retain old records on failure; the uncertainty boolean is not durable. Existing CUSTOMER_SERVICE assignments supply COMPLAINTS permission only within their active branch scopes. Preserve current actor, MFA, CSRF, workforce transaction locks and branch checks. Replies are customer-visible and reject stale versions and RESOLVED/CLOSED records. Legacy support routes must not bypass the managed-workforce boundary.

Existing APIs are GET `/staff/workforce/complaints` (UUID paging, limit 1–50 default 25) and POST `/staff/workforce/complaints/:id/replies` (expectedVersion and trimmed body 1–5000). There are no managed acknowledgement, resolution, priority-change or assignment endpoints. Show recorded response tracking and resolution as read-only facts; do not invent those actions.

## Locked composition

Fresh built-in Image Gen desktop and corrected phone concepts are `desktop.png` and `mobile.png`, viewed before implementation. The first phone concept (`exec-8044a757-7e64-43b2-94a5-a7d971e686e2.png`, retained externally) was rejected for horizontal record facts. Final prompts are in `prompts.json`.

Reuse the actual shell, logo and navigation. Ink #01121A, red #E60301, cool #f4f6f8 canvas, white surfaces, #ccd6df borders, 6px corners; Quicksand UI 14px, support 13px, Nippo-compatible compact headings 28px desktop/24px phone. Controls at least 44px, visible red focus, restrained shadows. No photographs, metrics, exports, new navigation or financial controls.

Sequence: ordered Overview / Complaints breadcrumb; heading Complaints; subtitle “Review complaints and respond within your responsibilities.”; Refresh records and current-read time; compact filter panel; table/mobile records; queue pagination; selected workspace. Filters: Search complaints (Subject or message), Priority (All priorities), Status (All complaint states), Apply filters, Clear filters. Search covers the full current scope, not the loaded page.

Queue columns: Complaint (subject and created date), Priority, Branch, Status, View complaint. First/Previous/Next controls and actual page count. Selected row uses a restrained wash. Mobile: every field remains labeled in vertical rows, filters stack, pagination wraps. Actual result count replaces illustrative concept count. No raw ID titles.

Selected workspace: subject, readable priority/status, Close selection, named branch and created date. Desktop wider Conversation beside Reply to customer then Response tracking. Phone stacks these sections. Conversation contains separately labeled Original complaint, only CUSTOMER-visible history, category/date/full text, Newest/Newer/Older paging. Text is escaped and preserves line breaks. Reply uses customer-visibility explanation, Message textarea, 5000-character bound, Review reply. Response tracking shows recorded acknowledgedAt, acknowledgementDueAt, escalatedAt, or Not recorded. Resolved/closed records show recorded resolution/resolvedAt/closedAt and history without a reply form. Do not derive promised SLAs or current overdue judgments from absent policy context.

Concept corrections locked before coding: retain the real ink mobile shell and stacked Allied logo, existing outline icons and semantic status colors; use ink outlined secondary controls and flat red primary actions (not generated red outline/gradient variants). Branch is plain text, not a badge. Restore explicit Conversation heading omitted from the phone image. Intrinsic content heights replace decorative blank space. Reuse MutationReview and persistent uncertain-operation patterns without adding another modal system.

## Compatible backend additions

Collection gains optional q (trimmed printable 1–120), priority LOW/MEDIUM/HIGH/URGENT and status OPEN/INVESTIGATING/RESOLVED/CLOSED, combined with existing UUID ascending paging and active branch scope. Match each literal search term in subject, description or CUSTOMER-visible message bodies; INTERNAL messages must never affect results. Preserve current fields and add named branch/branchId, updatedAt, access and generatedAt.

Add GET `/staff/workforce/complaints/:id` with bounded customer-visible message cursor/limit and current latestMessageId, active access and generation time. Validate history cursor belongs to this complaint and is CUSTOMER-visible. Return response tracking and recorded resolution fields only in detail; exclude contacts, customer identifiers, assigned author identifiers, related financial/order identifiers and policy snapshots. Scoped result-count READ audits and private no-store remain mandatory.

Reply takes the parent row lock before scoped state/version checks, matching existing customer/legacy writers. Add compatible optional expectedLatestMessageId so new clients reject changed conversations even when legacy writers do not increment complaint.version. Return additive exact receipt with actor, branch, version, access and created customer-visible message. No schema/migration, new role or permission change is planned.

## Interaction and acceptance

Filters, cursor trail, selected complaint and message history paging survive reload and Back in validated URL parameters. Reject unknown/duplicate/malformed query state before data requests. Hide unverified records/actions on refresh, failures, scope mismatch and session expiry. Distinguish no complaints, no matches, unavailable selection and empty history. Preserve in-memory drafts through harmless refresh, but require explicit re-review on changed record/scope/latest message. Confirm exact reply text and visibility, recheck fresh access/current record immediately before sending, validate the exact receipt and prevent duplicates.

Persist a minimal pending marker before mutation. Unknown results stay locked across refresh/reload and require current inspection plus independent reconciliation; a later matching state alone does not prove the original request. Account/session changes clear private drafts and redact pending metadata. No automatic replay.

Gate: focused parser/pending tests; isolated API tests of role/branch/search/history privacy, stale/closed/latest-message and concurrency handling; browser tests of filters/history/errors/loading/empty/replies/uncertainty and forbidden roles; seven responsive widths, long content at 320px, keyboard/focus, Axe, native comparison, relevant existing workforce regressions; type/lint/format/OpenAPI/routes/build and final source hashes. Connected browser/API checks must preserve existing domain data, verify actual write/audit effects and clean temporary sessions. Application-wide/deployed acceptance remains separate. Do not mark this page accepted before the entire gate passes.
