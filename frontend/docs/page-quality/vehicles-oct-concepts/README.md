# Vehicles — expanded marketplace concepts

Generated with the built-in ImageGen tool on 7 October 2026, before implementation. These are design references, not production catalogue assets.

- [Opening and inventory](01-marketplace.webp): compact navy showroom hero, raised white search panel, body-type shortcuts, cool-grey inventory canvas and three-column comparison cards.
- [Guidance and continuation](02-guidance-lifestyle.webp): open numbered buying guidance, lifestyle imagery and the existing contact invitation.
- [Mobile and states](03-mobile-states.webp): wrapping shortcuts, full-height filter drawer, missing-image treatment and recoverable empty/error states.

Implementation specification: existing public container; ink `#01121A`, red `#E60301`, marketplace navy `#091B38`, white and `#f3f5f8`; real bundled Nippo and Quicksand; 42px maximum hero title, 34px maximum editorial headings, 44px controls, 5–8px radii and restrained shadows. Desktop/tablet/mobile inventory uses three/two/one columns. Fields retain Login's red border and one-pixel focus shadow. Motion is limited to pointer-hover card elevation and arrow movement, disabled under reduced motion.

The existing brand assets, business copy, public shell and backend remain authoritative. Generated logos, inventory examples, incidental image lettering, fake device chrome, altered promotional copy and unrequested eyebrows are excluded. Preserve the breadcrumb above the hero. Keep all ten supported body types in the existing select; common shortcuts do not imply available stock or exhaustive catalogue facets. A selected uncommon type appears in the shortcut row. Keep the existing year input and featured select rather than the generated mockup's altered controls.

Existing lifestyle image overlays and the secondary everyday panel are retained to stay consistent with Home and preserve approved copy; the concept guides spacing and heading scale rather than replacing that shared component. Listing photos use `contain` to preserve the entire supplied vehicle photograph. Missing photos use a compact vehicle icon rather than invented inventory photography. Prices, labels and condition-report availability come exclusively from the API. The report indicator means a report is published, not that the vehicle is certified or guaranteed. Saving and inspection submission remain in the existing vehicle-detail workflow, avoiding speculative per-card mutations or duplicated session requests.

No suitable walk-around footage or 3D assets are provided for this listing. No empty player, decorative video controls or heavy rendering dependency is introduced. Their applicability remains open for the separate detail-page audit.
