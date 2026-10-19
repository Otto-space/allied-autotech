# Product categories — gate 58 design spec

Designed 13 October 2026 for `/admin/categories`, Admin and Super Admin. At design
time the accepted count was 57; final verification is in the separate page report. The baseline generic
page has no name search, omits descriptions from its table and always shows the create
form. Direct administrator reads and observed-update protection were missing.

## Complete concept set

- [Desktop catalogue](desktop.png): builtin Image Gen source
  `exec-03f543f4-f6b9-4ad0-b865-0686de55124b.png`.
- [Mobile catalogue](mobile.png): source `exec-218db19d-6359-4f62-a6ba-3d1c7bad45f0.png`.
- [Editor](editor.png): source `exec-c8255239-00fd-431e-9e4f-6ee1b9f62820.png`.

All were generated and inspected before frontend implementation. The first editor
generation failed on connection; a builtin retry succeeded. No CLI or generated
production imagery is used. The concepts are UI specifications, not shipped UI images.

Prompt set: a complete catalogue preserving the existing Allied shell, name-prefix
search and visibility filter, four-column category/description/visibility/actions table,
real page count and cursor controls; a fresh narrow mobile version with all records
labelled; and a four-field edit screen with visibility guidance. Prompts specified
Quicksand, ink/red/white/cool-grey, 44px controls, complete workflows and no fake metrics,
product images or unsupported controls. The editor prompt requires name, URL name,
optional description, Active, reviewed save, return/refresh and the actual deactivation
rule. Creation uses the same form with a blank draft and no saved-category products link.

## Extracted design

Use existing shell and Quicksand scale: approximately 27px h1, 18px section titles,
13–14px body and 12–13px labels. Ink `#01121A`, red `#E60301`, white forms/records,
cool-grey `#f4f6f8` page, `#dce4ec` borders, 8px corners, 20–24px spacing. Compact
Lucide RefreshCw, Plus, ArrowLeft/Right and breadcrumb chevrons remain code-native.

Desktop has a compact white filter strip, ink catalogue heading and complete rows;
mobile has an open section heading and individually grouped labelled records, as in
the generated mobile concept. Pagination follows the records; visibility guidance
is an unboxed note. The editor uses a 2:1 white-form/ink-guidance split, stacking on
smaller screens. Review and recovery reuse the accepted shared mutation dialog and
feedback system. No photography, raster controls, gradients or extra dashboard metrics.

Allowed copy: Overview, Product categories, Organise parts with clear names and
descriptions., Refresh categories, Add category, Search category names, Starts with
a category name, Visibility, All visibility, Clear filters, Apply filters, Category
catalogue, actual page count, Category, Description, Actions, View & edit, View products,
Previous, Next, and truthful pagination position. Editor: Edit/Create category,
Back to categories, Refresh category, Category details, Name, URL name, Description
(optional), Active, Review changes, Close editing, Category visibility, Last updated,
and the existing form instructions/recovery text. Guidance: Active products must be
deactivated before their category can be deactivated. Changing a category does not
delete its products. An active category can contain active products.

Intentional corrections: retain the actual brand logo, navigation and mobile account
controls instead of generated substitutes; no invented Brands route. Use existing
neutral status badges rather than generated green, and existing restrained type sizes
rather than the oversized editor raster text. Category order comes from the API,
not the concept's illustrative row order. Timestamps use Lagos time. Sample categories
and descriptions are isolated test fixtures only.

## Integration and acceptance requirements

The added administrator category read includes inactive/empty records independently
of paging. Name search is a literal case-insensitive prefix. UUID cursor pagination is
live, with no invented total; filters reset the cursor, and direct/deep cursors must not
invent a page number. Edits send `expectedUpdatedAt`; existing product/category
eligibility and uniqueness rules remain authoritative. Category creation has no durable
original-request receipt: an uncertain save needs explicit manual reconciliation.

Verify direct edits, list history/reload, all four reviewed fields, cancellation,
exact response validation, changed records, uncertain saved/unsaved responses, role
boundaries, failure/malformed/missing/mismatch/empty states, long content and keyboard.
Cover 320/375/430px through wide desktop, tablet and landscape, Axe, lint, types,
production build and real isolated API/database persistence. Compare final screenshots
with all concepts and record at least five specific fidelity points before acceptance.
