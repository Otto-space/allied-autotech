# Administrator service detail design specification

Prepared on 12 October 2026 before page implementation. Fresh built-in ImageGen [desktop](desktop.png), [mobile](mobile.png), and [editor/media/state](states.png) concepts were generated, saved here and inspected with `view_image`. Baseline `/admin/services/{id}` returned HTTP 404; the screenshot and probe are `C:/Users/PC/.codex/work-service-detail-before.*`.

## Scope and extracted system

Gate 53 adds the independently addressable service detail route for Admin and Super Admin. The catalogue's inline editing and image management remain supported. The existing administrator detail read supplies all fields; no new backend endpoint is required. Staff and Customer must not issue administrator service reads.

- Preserve the existing real dashboard shell, Allied wordmark, page search, session controls and Services navigation. Quicksand throughout this operational page. Ink `#01121A`, red `#E60301`, white panels, cool-grey `#F4F6F8` workspace, cool borders, 8px corners and subtle panel shadows.
- Heading 28px desktop/24px phone, section titles 18px, body and controls 13px, labels 12px, minimum 44px controls. Outline Lucide icons: chevron, arrow-left, refresh, tag, clock, eye, pencil, image and wrench. Decorative icons are hidden from assistive technology.
- Ordered breadcrumb Overview > Services > actual service name. During loading/failure use Service details without exposing an opaque ID. Header repeats the service name, with Review service details, pricing and workshop information. Back to services and Refresh service actions.
- One ink summary band: Pricing (formatted NGN, Fixed price or Quote required), Duration (minutes or Not set), Visibility (Active/Inactive). No invented totals, history, capabilities, public availability promises or service deletion.
- Below: nearly equal desktop columns (approximately 1.1:1 from the generated reference), white Service details panel and Service image panel. The details heading has Edit service. Ruled facts: category, URL name, created and updated with Lagos timezone. Short description and full description follow; absent optional text explicitly says Not provided.
- The image panel displays only backend-authorized media at 4:3 without tint/overlay, a caption, Manage image, and One image is used for the service card and detail page. Missing/broken media uses the existing service fallback. Concept photos are examples, not production inventory.
- Editor and image modes are addressable through a bounded view query so reload can retain the selected workflow. Reuse the existing complete reviewed editor/media components. Close editing and Close image editor return to the same detail record. Successful edits return to refreshed saved details; image writes refresh the summary metadata.
- Catalogue service names link to their detail URLs without removing existing row actions. Long names, descriptions and money wrap inside their region. Below the desktop split breakpoint, stack details before media. At native phone widths use one-column form fields and readable facts without horizontal scrolling.

## Contract and reference corrections

1. Keep the real shell/wordmark and approved brand copy. The state sheet's invented gear logo, slogans, dashboard title and extra header are excluded.
2. Preserve separate Upload selected file and Save service image steps, all existing image controls, and actual JPEG/PNG/WebP, 10 MiB, 32–8192 pixel constraints. The generated combined upload/save button is incompatible with preparation/attachment semantics.
3. Preserve every review fact and existing Go back / Confirm save labels. Do not shorten the form or review to the state sheet's abbreviated facts.
4. Use the established neutral/info feedback treatment for stale information; the generated orange notice is outside the brand palette. Permission failures remove sensitive record contents and controls. Transient background failures preserve drafts but block mutations.
5. The mobile image is a scaled composition. At 390/320 CSS pixels its three-column summary and long inline date values require wrapping or stacking; use a full-width pricing row and paired duration/visibility below when needed. Do not reduce type or touch targets to force the composition.
6. Use the existing integer-kobo formatting and Lagos date formatter rather than generated currency/date typography. No false record/version or saved confirmation is introduced.

## Verification gate

Verify direct and reloaded URLs beyond the first catalogue page, inactive/null records, name breadcrumbs, list navigation, all fields, cancellation and one versioned write, stale review, committed/uncommitted uncertain outcomes, draft recovery, image management, missing/broken media, role/access loss and malformed/mismatched reads. Check desktop/mobile/short-landscape widths, loading/error/stale/edit/media/review states, Axe, console/asset health, lint/types/build, and real API/PostgreSQL mutation evidence. Compare all three concepts with latest production screenshots in the final QA pass and record at least five fidelity points. This pre-implementation specification does not establish acceptance.

## Generation record

Built-in ImageGen was used with three fresh prompts: complete desktop read state with the existing shell and all facts/media; complete mobile continuation with all actions; complete editor/media/recovery state sheet. Prompts specified exact fields, labels, roles, palette, Quicksand, real API authority, no invented metrics/destructive actions and practical code-native controls. Originals: `exec-f1357714-e784-451b-9cf6-bf61ade2f721.png`, `exec-dbc8dc65-e9b2-4333-ae54-846b5ea7d90c.png`, `exec-ca35bdf4-e0f4-4129-bafc-6f8cfc531704.png` under the thread's Codex generated-images directory.
