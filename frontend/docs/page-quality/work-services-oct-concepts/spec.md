# Administrator services design specification

Prepared on 12 October 2026 before production page implementation. Fresh built-in ImageGen references: [desktop](desktop.png) (1467 x 1072), [mobile composition](mobile.png) (850 x 1850), and [editing, media and recovery states](states.png) (1536 x 1024). All three were inspected with `view_image`. These are design references, not completed-page acceptance.

## Baseline and scope

The existing `/admin/services` generic editor has a Name/Reference/Visibility/Action table without pricing or appointment duration. Mobile row actions sit outside the visible table region even though document-level overflow is false. The creation form sits below the entire table. Baseline browser screenshots at 1505 and 390 pixels are saved outside the repository as `C:/Users/PC/.codex/work-services-before-{width}.png`.

Gate 52 covers the service catalogue, creation, inline editing and its existing image editor. Keep all supported fields and actions. The independently addressable detail page requires its own subsequent concept and gate; do not link to an unimplemented detail route. The new administrator list and single-service read contracts have [local backend acceptance](../../../../backend/docs/admin-service-catalogue.md). Catalogue integration subsequently passed its [local acceptance gate](../work-services.md); this specification retains the pre-implementation design decisions.

## Extracted system

- Preserve the existing real Allied wordmark, dashboard sidebar/topbar, session identity and navigation. Quicksand throughout the operational UI. Ink `#01121A`, red `#E60301`, true white surfaces and cool-grey `#F4F6F8` workspace; slate secondary text and visible cool-grey borders.
- Ordered breadcrumb: Overview, chevron, Services. H1 28px desktop / 24px mobile. Section titles 18px, body and control text 13px, secondary labels 12px. Retain readable wrapping and minimum 44px touch targets.
- Header keeps **Services** and **Maintain published services, pricing and appointment durations.** Actions: **Refresh records** and **Create service**, the latter moving focus to the actual form rather than opening a dead route.
- One compact filter strip: **Search services**, **Visibility**, **Pricing**, **Category**, **Apply filters**, **Clear filters**. Search placeholder **Name or description**. Real server filters, URL state, cursor reset on changes and bounded Previous/Next history. Category discovery must include inactive categories for filtering and handle paginated choices.
- At wide desktop widths, an approximately 3:2 catalogue/form grid with a 20px gutter. The catalogue uses an ink heading band, **Service catalogue**, and a page-local count such as **3 services on this page**. Columns: **Service**, **Pricing**, **Duration**, **Visibility**, **Actions**. Service identity combines an authorized small photo or restrained wrench fallback, name and category. Keep **View & edit** and **Manage image** controls.
- White creation/editing panel with subtle shadow, 8px corners and clear focus rings. Preserve Name, URL name, optional category, short/full descriptions, pricing type, optional naira price, duration and Active. Retain **Review changes**, **Create a new service**, and the existing review-before-save behavior. Required fixed pricing, integer duration, canonical slug and backend length bounds remain authoritative.
- Below desktop split width, stack catalogue and form. Below 768px, semantic table rows become complete labeled records without horizontal scrolling. At phone widths place actions beneath the record facts and stack form fields. Long names, money values and category labels must not squeeze actions outside the viewport.
- Use existing outline icon families: search, refresh, plus, chevrons, wrench/image fallback, warning and document/empty-state icon. Decorative icons are hidden from assistive technology. No extra analytics, total catalogue counts, bulk actions, auto-save or service deletion.

## State and behavior requirements

Editing reads the selected service directly, verifies its identity/current version and retains the complete draft during recoverable read errors. Saving uses the existing CSRF/versioned contract and a focused error summary. Freshness failures block mutation; authorization loss hides private content. No automatic POST/PATCH replay after uncertain outcomes. Show the existing explicit uncertain-save wording and allow read reconciliation.

Keep the existing `ServiceImageEditor`, `FileUpload`, `ServicePhoto` and `MutationReview` behaviors. Media preparation, upload, confirmation, description changes and removal remain separate real operations. Failed replacement preserves the old asset. Apply the page's compact presentation without weakening upload validation, authorization or version handling.

Loading uses row-shaped placeholders. Empty filters offer **No services match these filters.**, explanatory text and **Clear filters**. Failed reads use **Services unavailable.** and a retry. Background errors disclose stale data and disable editing; access-denied states reveal no records. Review retains **Save this service?**, the existing live-catalogue description, factual field values, **Cancel** and **Confirm save**. Mobile dialog dimensions and focus restoration must be tested.

## Corrections required when translating generated references

Generated illustrations do not override the audited app contract:

1. The desktop image added green status dots despite the palette brief. Use the mobile reference's neutral, text-labeled Active/Inactive treatment.
2. The mobile sheet is a scaled composition, not a literal 390px screenshot. Its paired form fields and right-aligned row actions are too dense at actual phone widths. Stack fields and move actions below facts at narrow widths; verify native 320, 360 and 390px renders.
3. Do not stretch the three-row table to the height of the form solely to reproduce the desktop image's blank lower area. Keep the catalogue at its content height.
4. The state sheet invented a 5 MB upload limit and omitted buttons. Preserve the actual **JPEG, PNG or WebP, up to 10 MiB. Each side must be between 32 and 8192 pixels.** Keep **Refresh image**, **Close image editor**, **Save description**, **Remove service image**, **Upload selected file** and **Save service image**. The backend remains authoritative for returned limits.
5. Price inputs use the established valid naira input format without comma separators; displayed prices use the existing currency formatter. Preserve actual returned category labels and nullable legacy duration/image data. The illustrated names, sample descriptions, prices, photo subjects and counts are QA examples, not production catalogue data or new company claims.
6. Keep the existing review component's full facts, validation and recovery controls even where the state sheet abbreviates them. Preserve established copy where the generated sheet changed it; avoid adding implementation terminology to customer/operator flows.

These adjustments are required for contract fidelity, readable mobile controls and the approved palette. Record the final implementation comparison against this specification and all relevant reference states before accepting the page.

## Generation record

Built-in ImageGen was used, not the CLI. The desktop prompt requested a complete administrator catalogue with the existing shell, search/visibility/pricing/category filters, pricing/duration table and complete creation rail. The mobile prompt requested the full mobile page, visible row actions and complete form. The state prompt requested complete edit/media panels plus empty, failure, review and uncertain-save treatments. Prompts specified Quicksand, the approved palette, native-code controls, existing workflow preservation, real backend authority and no invented metrics or product sections. Generated originals remain under the Codex `generated_images/01a0ee83-4516-7760-bc1b-b4ceaf4d6a66` directory; the project copies above are the durable references.

Before acceptance, compare latest native desktop/mobile browser screenshots with these references in the same `view_image` QA pass, record at least five concrete comparisons, verify above-the-fold copy, test interactions and roles, and complete static/build/API/browser checks. None of that final page acceptance is claimed by this design checkpoint.
