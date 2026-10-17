# Service-category administration design specification

Prepared on 12 October 2026 before frontend implementation. Gate 54 follows the 53 accepted milestones. Fresh built-in ImageGen [desktop](desktop.png), [mobile](mobile.png) and [states](states.png) references were saved and inspected with `view_image`.

## Baseline and scope

The generic `/admin/service-categories` screen has no exposed server search or visibility filter. Its table requires horizontal scrolling to reach mobile actions, and the creation form sits below the list on wide screens. The backend already supports literal case-insensitive name-prefix search, visibility filtering, signed filter-bound cursors, creation and versioned editing. Category deactivation removes public grouping without deactivating services. Public category reads omit inactive/empty categories and cannot support administrator recovery. A new administrator-only direct read is being implemented and verified separately; frontend acceptance depends on it.

The baseline production screenshots are `C:/Users/PC/.codex/work-service-categories-before-desktop.png` and `work-service-categories-before-mobile.png`, captured with synthetic records on the previously accepted production build. The browser plugin was unavailable; installed Playwright and Edge were used. Page overflow alone was false, but the table still hid actions inside its scroll region.

## Extracted system and complete surface

- Preserve the real dashboard shell, logo, role-aware navigation and session controls. Admin and Super Admin only; Staff and Customer issue no administrator category reads. Quicksand throughout. Ink `#01121A`, red `#E60301`, white and cool-grey `#F4F6F8`, cool borders, 8px corners and subtle panel shadows.
- Compact heading: 28px desktop, 24px phone; section titles 18px, body/controls 13px, labels 12px, controls at least 44px. Lucide outline chevron, refresh, plus and information icons; decorative icons are hidden from assistive technology.
- Breadcrumb Overview > Service categories. Title Service categories. Subtitle Group services for customers to browse. Header actions Refresh records and Create category. Guidance: Deactivating a category removes the grouping while its active services remain available.
- Full-width white filter strip: Category name starts with, Visibility (All categories/Active/Inactive), Apply filters, Clear filters. Search accepts the actual 1–120 character prefix contract, not substring search. Applied values and signed paging position survive reload and browser history. Invalid query state issues no category request and offers reset.
- Below, approximately 62:38 desktop list/editor split. The list has an ink Categories heading with the count on this page only. Semantic table: Category (name, URL name and description), Visibility, Action (View & edit). Fine row separators. Previous/Page/Next controls below. No invented global totals or category service counts.
- The white editor rail has Create category or Edit category, instructions, all four fields (Name, URL name, optional Description, Active) and Review changes. Editing has Refresh category and Close editing. Selected editing identity is URL-backed for reload. Name and description limits follow the API; blank optional description saves null. Existing mutation review, owner-scoped draft support and feedback components are reused.
- A full review shows Name, URL name, Description and Active, followed by Go back / Confirm save. Deactivation explains its effect. Before PATCH, reload identity and revision; the backend still atomically checks expectedVersion. Cancel writes nothing. Ambiguous writes remain locked through reload, with explicit recovery and no automatic mutation replay. Creation has no original-request receipt, so it requires manual list reconciliation before explicitly starting a blank draft.
- Phone layout stacks filter fields, then complete labeled records with reachable actions and pagination, then the editor. Long names/slugs/descriptions wrap without shrinking type. Desktop list remains a table rather than separate cards. No category media exists in the contract, so no photography or upload controls are added.
- Loading, empty, filter validation, read error, stale read, permission loss, edit conflict, interrupted create/edit and complete review states are part of the surface. Transient errors retain drafts and block mutations; permission/malformed responses remove private records and editors.

## Reference corrections fixed before coding

1. Retain the real shell and wordmark. The state sheet's invented horizontal navigation is excluded.
2. Use neutral ink/cool-grey visibility treatments; the desktop concept's green badges are outside this page's palette.
3. Omit the generated claim that an active category is necessarily visible to customers: public discovery also requires an active assigned service.
4. Use outlined View & edit consistently. The mobile concept's red row actions would compete with the primary action.
5. The generated mobile composition is scaled wider than 390 CSS pixels. At actual phone widths, stack filters and wrap row facts/actions while preserving readable text and 44px targets. No forced tiny two-column inputs.
6. Preserve shared review labels and complete review facts, actual validation, refresh/close controls and explicit uncertain-save recovery. Do not copy duplicate empty-state headings or invented helper copy from the sheet.

## Acceptance required

Verify URL-backed prefix/visibility filtering, paging/history/reload, direct edit reads beyond page one, create/edit validation, full review, cancellation, exact mutations/audits, concurrent revision rejection, reload/draft recovery after committed and uncommitted failures, access loss and malformed identity. Exercise Admin/Super Admin and denied roles. Verify real API/PostgreSQL create/update/deactivation without altering active services. Run scoped unit and browser regressions, lint/types/build, responsive/state/Axe/console checks, native reference-size captures and final concept-to-render inspection across at least five fidelity points. This specification does not establish page acceptance.

## Generation record

Built-in ImageGen used three fresh prompts covering the full desktop list/editor/filter surface, full mobile continuation, and edit/review/loading/empty/error/stale/permission/recovery states. Prompts explicitly named all fields, roles, wording, API semantics, palette, typography and no invented metrics/media/destructive actions. Originals in the thread's Codex generated-images directory: `exec-24115e66-7c34-4be3-bee6-9facfafb3619.png`, `exec-03856d3a-443f-4bc3-af3b-713882a5c985.png`, `exec-4331ed47-8a25-4ce8-b187-2dd0e92a74dd.png`.
