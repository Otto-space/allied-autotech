# Category detail: pre-implementation specification

Prepared 13 October 2026, before production changes. Gate 55. Implementation and [final acceptance](../work-category-detail.md) subsequently passed; this specification retains the decisions recorded before code.

## Evidence and contract

The direct category URL returned the public 404 in the gate-54 production build. Baseline: `.codex/work-category-detail-before.png`. Fresh generated concepts are [desktop](desktop.png), [mobile](mobile.png), and [states](states.png); all three were inspected locally before implementation. The existing Admin/Super Admin private GET supplies the eight validated category fields independently of paging. Existing expected-version PATCH and the reviewed category editor cover editing. No backend or schema change is required.

## Layout and visual extraction

- Retain DashboardShell, actual wordmark, navigation, account controls and Quicksand. Main title 28px desktop/24px phone, section headings 18px, body 13px, labels 12px; 44px controls.
- Named breadcrumb: Overview > Service categories > actual category name. Fallback is Category details. Never display an opaque identifier as a title.
- Header: actual name, “Review category details and service grouping.”, outlined Back to categories and red Refresh category.
- Ink `#01121A` summary: two equal columns, Visibility and URL name. White values, muted light labels, dividing rule. Stack into two rows on phones.
- Cool `#F4F6F8` canvas; white panels, subtle borders and shadow, 8px corners. Desktop record/guidance columns approximately 2:1; stacked at narrower widths.
- Record panel: Category details and outlined Edit category; ruled Name, Created and Updated facts; full description or Not provided. Dates explicitly use Lagos time.
- Guidance panel: explain category grouping, conditional public visibility and preservation of active services when a category is deactivated. Link to `/admin/services?categoryId=<id>` without inventing counts or media.
- All names, slugs and descriptions wrap. Dates remain legible; stack fact labels at narrow widths. Keep 320px and landscape usable.
- Reloadable `?view=edit` uses the existing category editor, four-field review, explicit conflict replacement and interrupted-save recovery. Cancel causes no write. Parent refresh also refreshes editor data. Preserve drafts on transient errors; remove private content on denied/missing records.
- Loading skeleton, unavailable/retry, stale/blocking, missing description, inactive, edit/validation/review, conflict and uncertain-save states follow the fresh state sheet and existing verified behavior.

## Explicit concept corrections

1. Keep the actual brand mark and shell: generated alternate lettering and mobile ink search header are illustrative.
2. Use the established compact type scale rather than oversized generated lettering.
3. Keep existing 7–8px button corners; the state sheet's pill buttons conflict with the approved dashboard system.
4. The mobile illustration is wider than a 390px viewport; allow facts, dates and actions to wrap rather than reducing text size.
5. Preserve exact verified editor/review wording, field coverage, recovery controls and focus behavior even where the illustration simplifies them.
6. Conditional visibility guidance is not proof a category has active services. Do not invent a service count, image or history.
7. Preserve the editor's existing refresh/close placement and transaction boundaries.

## Acceptance plan

Test direct reads beyond catalogue paging, reload/history, named breadcrumb, category-list links, service-filter destination, Admin/Super Admin access and Staff/Customer denial; reviewed changes, cancellation, revision conflicts, mismatched/malformed/missing records, transient draft preservation, permission loss, committed/uncommitted uncertain saves and explicit recovery. Run relevant static checks, production build and shared regressions. Inspect production captures at required widths, landscape and failure states, run accessibility/overflow checks, then compare the final screenshots with all three concepts across at least five concrete fidelity points. Database evidence must follow the updated repository safety rules; no application data may be changed.
