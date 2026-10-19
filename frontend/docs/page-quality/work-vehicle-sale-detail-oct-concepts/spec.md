# Workshop transaction detail specification

Fresh desktop/mobile concepts were inspected before UI edits. Preserve actual
Allied shell/logo/navigation and Find a page search. Route
`/admin/vehicle-sales/[transactionId]` is a separate gate from its accepted index.

- One named transaction breadcrumb and actual listing-title header with full
  transaction/customer context, neutral purchase status, Refresh vehicle purchase
  and Back to vehicle sales. Wrapping section anchors name facts, negotiation,
  progress, history and handover. No invented customer/branch detail links.
- Broad purchase facts beside a recorded-amount rail on desktop; stack on narrow
  screens. Retain linked stock ID/number, customer reference/null account state,
  branch reference, sale version, saved creation/update and all supplied lifecycle,
  terms/reservation/paid-hold dates with precise Lagos instants. Exact asking/
  agreed/required-reservation amounts and nulls stay distinct. No current payment
  balance or refund/collection total is supplied by this projection.
- Keep current negotiation and progress controls with complete review, including
  customer-visible notes and cancellation reason. Preserve all actual lifecycle
  restrictions and backend atomic versions. Stable form identity must preserve
  concurrent drafts and require explicit field reload; own validated success may
  advance/reset the form. Do not remount old drafts under a newer observed version.
- History uses only actual logged entries, statuses, times and reasons. The
  generated Stock linked/Customer linked examples are not real events. Treat
  negotiation/progress responses and refreshed history according to the actual
  transaction contract; do not fabricate a missing event or note.
- Handover appears only in applicable states. The desktop concept's separate paid
  example must not be inserted into a negotiating live record. PAID without a
  handover allows reviewed recipient/contact/odometer/keys and optional verified
  PDF creation. Existing handover retains immutable facts, own version and dates,
  allowed READY/COMPLETED/CANCELLED transitions and separate temporary document
  access. Preserve zero readings/keys and null legacy values. No fabricated PDF
  names, permanent links or unsupported replacement action.
- Read current own active profile before the record; Staff require assigned active
  branch. Strictly validate requested identity and role/branch scope. Current
  actor and relevant transaction/handover domain must still match before a write;
  server CAS and lifecycle checks protect the remaining race. Handover creation
  currently has no request expectedVersion and instead locks/checks PAID/uniqueness.
- Validate full success ID/next versions/status/body values before success.
  Negotiation/progress and handover READY/CANCELLED/COMPLETED have different sale/
  handover version effects. Keep newer observations through older reads. Temporary
  failures keep facts read-only; denial clears them.
- A minimal actor/role/transaction pending marker must survive uncertain results
  and reload without replay. Explicit fresh-read reconciliation replaces this
  page's drafts and releases a lock without proving the original outcome. Definite
  rejection differs from unsent preflight. Corrupt/unavailable recovery storage
  fails closed; session invalidation redacts metadata. Valid authorized document
  access stays independent of pending mutation locking. No new same-key retry is
  implied by an existing asset token.
- Replace unverified 'terms are absent' wording with the factual customer terms-
  acceptance requirement. BG-11 content/publication/deployment remains separate;
  no invented legal wording or hold guarantee. Cancelled handover recovery is a
  confirmed unsupported backend workflow and must be handed off honestly.
- Use actual dashboard Quicksand hierarchy, white 12px panels, cool canvas, subtle
  rules, restrained red actions/focus and neutral badges. Labels/controls/body
  13px and ordinary controls >=44px. Forms reflow in reading order; long IDs,
  notes, exact money and timestamps remain readable. Reuse review/pickers/upload/
  document helpers. No hero, chart, sales totals or repeated red review warnings.
- Run focused unit, all affected existing detail/handover/PDF browser flows and
  isolated API cases, plus connected real mutation/version/audit checks. Reuse
  unchanged database/build setup. Capture seven widths, native concept/final
  comparisons and at least five copy/fidelity points before accepting this gate.
