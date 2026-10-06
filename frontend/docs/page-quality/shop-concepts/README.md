# Shop concepts and implementation specification

Generated before implementation and inspected at 1536 × 1024. The source PNGs remain outside the repository; these WebP copies preserve the references.

- [01: Introduction and product discovery](01.webp): compact split ink/photo introduction, Home → Shop breadcrumb, search/category/filter/sort toolbar, removable chips, current-page count, three-column product cards, pagination; single-column mobile with image above introductory copy.
- [02: Filters and category states](02.webp): three-column desktop panel, single-column mobile modal with sticky Clear/Apply actions; searchable, paginated category popup and loading, empty, retry and invalid-year states.
- [03: Results recovery and page ending](03.webp): distinct filtered-empty, no-inventory, error and loading states; fitment guidance, product-specific contact band and existing corporate footer.

Design system: true white page, ink `#01121A`, red `#E60301`, cool-grey surfaces `#F3F5F8`, readable muted copy `#4F6073`, visible control border `#8290A1`. Nippo headings, Quicksand controls/body. Controls are 44px with 5px corners, two-pixel focus outline and 3px offset. Use compact Lucide search, sliders, chevrons, check, close and arrow icons. Container follows existing public page gutters; 3/2/1 result columns at desktop/tablet/mobile. Mobile search/category span the toolbar, with Filters and Sort alongside each other below.

Allowed copy: “Quality parts. Reliable performance.”; “Explore parts, oils, fluids, tyres and automotive products. Check specifications and suitability for your vehicle.”; “Explore automotive products”; “Find the right fit.”; “Need help choosing a product?”; “Ask about a product”; “Chat on WhatsApp”. Preserve existing functional global navigation and footer.

Contract-driven deviations established before coding:

- Concept inventory, brand logos, prices, branch names and total page count are illustrative inventions, never production data. Cards use the public API and real approved media only. Show current-page count and cursor-based page position, without total matches/pages.
- Retain the existing unbranded `parts-editorial.webp` as decorative hero media with no tint or overlay. Generated branded packaging is not evidence of stocked products.
- Category search explicitly covers loaded options, accumulates pages, retains the selected label and exposes Load more. Shared category links resolve the category detail endpoint.
- Brand, make and model are exact-name text fields because no complete searchable options endpoint exists. Year accepts 1886–2100. Featured has three simple native choices. No price-range or stock filter, add-to-cart or favourite action is invented.
- Use neutral text for API stock availability. Retain the authentic site logo, current footer and brand address instead of generated variants and dates. Recovery illustrations remain small Lucide icons.

Interactions: debounce text search by 400ms; query-backed filters/sort and cursor history survive reload, Back and Forward; filter changes reset pagination. Drawer drafts survive closing, modal traps focus and restores the trigger, and resizing closes the drawer. Category popup handles keyboard, long names, viewport collision, loading, retry and continued pagination. Empty/error states never imply invented success.
