# Shop — expanded concepts

Generated with built-in ImageGen before implementation on 7 October 2026. These are visual specifications, not production inventory or branding.

- [Discovery and cards](01-discovery-cards.webp): compact parts hero, raised discovery panel, real category shortcuts and four compact product columns.
- [Fitment and contact](02-fitment-contact.webp): workshop image beside product-selection guidance, followed by the existing contact invitation.
- [Mobile and states](03-mobile-states.webp): compact thumbnail/identity rows, wrapping discovery controls, advanced filters, category picker and recovery states.

The selected product-card structure follows the first concept: photo beside category/title/brand/identifier, then price, availability, fitment and the View product link. It is intentionally distinct from the full-width photography used for vehicle cards. The same compact anatomy works at narrow widths; the result grid uses four desktop, two tablet and one mobile column.

Tokens: ink `#01121A`, brand red `#E60301`, white, `#f3f5f8` canvas, `#8290a1` control border and `#4f6073` supporting text. Real bundled Nippo and Quicksand; maximum hero 40px, guidance 34px, card title 16px, price 20px and 44px controls. Use modest 5–8px radii, thin borders, restrained form shadows and pointer-only reduced-motion-aware card elevation. Focus follows the Login input's red border and one-pixel shadow.

Backend truth and existing assets override invented concept content. Keep the actual logo, navigation, breadcrumb above the hero, approved parts/workshop images and verified footer details. Do not publish generated product examples, category names, brands, branch names, stock counts or ratings. Category shortcuts are the first three loaded category records plus a known selected category when necessary; they are not popular-category claims or a complete catalogue taxonomy. The existing picker retains search over loaded categories, load more, error and selected-label recovery.

Keep exact-name brand/make/model inputs and the numeric year field: no options API exists for the generated dropdowns. A comparison price is displayed only when supplied and greater than the current price. Compatibility is explicitly listed data, not a claim that a product fits the visitor's vehicle. No quick-add or favourite button bypasses the existing product-detail account/quantity workflow. Use the actual formatted NGN prices and no generated currency spelling.

Keep the existing white header and shared footer, including current year and approved destinations; generated logos, social destinations and footer dates are rejected. Reuse the existing editorial workshop image rather than presenting a generated person as an actual staff member. No video or 3D feature is needed for catalogue comparison; no empty player or heavy dependency is introduced.
