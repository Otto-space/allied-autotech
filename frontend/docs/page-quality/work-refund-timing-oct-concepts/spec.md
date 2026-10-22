# Bank refund timing — implementation specification

Created before runtime edits, 19 October 2026. Built-in ImageGen desktop and mobile/form/review concepts inspected. See `desktop.png`, `mobile-form-review.png` and `prompts.md`.

## Authoritative corrections to generated concepts

Keep the existing Allied logo, navigation, account/search controls and actual Quicksand font. No invented person, timestamp, audit actor, source or policy reference. Refresh is outlined and labelled **Refresh refund timing**, without the generated word “outline”. Use a neutral impact strip and neutral approved label, not bright blue. Current banking days are plain read-only facts, never interactive checkboxes. Keep all actual ISO holidays accessible in a disclosure. Source length is 10–500; evidence is 20–1,000. One labelled datetime-local control. Use existing exact purpose/review copy. All example dates/data are fixture-only. No decorative mobile stepper, phone status bar or duplicate page header in continuation. Real functional history label is **Refund timing history**.

## Layout and tokens

- Existing dark dashboard shell, cool-grey main canvas, white panels, ink #01121A, red #E60301 actions/focus, neutral secondary text #536479, borders #8799AC for controls and #D8E1EB for panels. No extra visual assets or dependencies.
- Main max width 1360px. Title 30px desktop / 24px mobile; section headings 20px; Quicksand body 14px, labels 13–14px. Compact 44px touch controls, 6px panel radii, 22px desktop / 16px mobile panel padding.
- Breadcrumb and title; refresh toolbar; neutral impact paragraph. Desktop at >=1100px uses 38/62 current-state/editor grid, 24px gap. Below that stack current state, editor, history. Preserve normal page scrolling.
- Current panel shows approval/readiness, selected revision/effective time, start event, counting rule, banking days, excluded dates and evaluated time. Next scheduled and latest recorded disclosures expose full revision/date while closed. Only an approved higher-version future policy can supersede the selected clock.
- Form has **Approve a calendar** heading, numbered **Banking calendar**, **Effective date**, **Approval record** groups. Labels above controls for readability in the existing dashboard width. Weekdays compact grid (2 columns mobile, up to 3 desktop), source/evidence full width, modest holiday textarea. Divider lines between groups. Red review action.
- Native details/summary for history and revision records, lazy render expanded facts. Existing MutationReview supplies desktop modal/mobile inline review, complete facts, cancellation, rejected and uncertain states. Every date is explicit Lagos time.

## State/interaction requirements

Use active Super Admin own-profile check. Current-policy read is private, bounded history with independently selected current/next. Refresh failures disable approval while retaining useful stale facts and draft. Empty/unapproved/malformed settings are explicit, never imply approved readiness. Preserve draft key `refund-timing-policy:1`, retained base revision, fresh unchecked confirmation, identity redaction and focus restoration. Review cancel preserves inputs but clears confirmation. Successful exact Q6 actor-bound receipt retires the draft and focuses confirmation. Uncertain outcomes persist across reload and reconcile read-only with explicit independent acknowledgement; no automatic retry. Fresh profile/current-version checks before write. Calendar/day/date validation is associated with its field; non-restored consent and no automatic approval source/evidence.

## Verification required

Native-rendered refinement: the existing `MutationReview` API always uses a native modal dialog, including mobile, with a scrollable labelled facts region and focus/inert-background handling. Preserve this tested accessible interaction rather than introduce a shared review rewrite for this page. The inline mobile concept is therefore intentionally implemented as a bounded scrollable native dialog. Native comparison also required an 8px breadcrumb bottom margin, nonshrinking outlined refresh action and a scoped 112px textarea height to override the general dashboard's taller control rule.

Seven viewport widths 320/375/430/768/1280/1440/1920 with Axe, native baseline/concept comparison at four original widths, mobile form/review inspection; calendar normalization, malformed receipts, selection semantics, version conflicts, access revocation, draft restoration, cancel, exact success, failed reads, lost response/reload recovery. Isolated API coverage must prove current outside history cap, version-first selection, skipped ineffective future lower versions, atomic audit, permissions/CSRF, guarded publication. Connected production browser/API test and source hashes; type/lint/build/OpenAPI parity. Keep current refund engine unchanged and verify meaningful existing clock tests. No schema/migration or shared data writes.
