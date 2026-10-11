# Product detail expanded concepts — 7 October 2026

Three ImageGen references preceded implementation of `/parts/[productId]`:

- [Gallery and purchase](01-gallery-purchase.webp): cool-grey canvas, compact product identity and section links, contained gallery with factual identifiers, and white purchasing panel with ink top rule and subtle shadow.
- [Information and delivery](02-information-delivery.webp): dark assistance band, description/specifications and compatibility, ordering guidance with collection/delivery disclosures, related products and footer.
- [Mobile and account states](03-mobile-access.webp): one mobile price, compact gallery and purchase flow, anonymous/work/checking/error access, quantity validation, receipt and expanded photos.

Use actual Nippo and Quicksand, ink `#01121A`, red `#E60301`, white and cool-grey `#F3F5F8`. Keep the existing public header, navigation and footer. Generated wordmarks, slogans, search tools, counts, product labels and example photographs are not authoritative. No new inventory imagery is shipped; the API's real photos and explicit fallback remain the only product-media sources.

The first concept defines the upper composition. The second concept's extra repeated gallery is omitted because that gallery already appears above it; the information and compatibility sections remain two readable columns. Preserve the current horizontal thumbnails, modal navigation and number input rather than inventing a second gallery or custom quantity stepper. Retain the backend's total-quantity semantics and reservation disclaimer.

Generated mobile red pricing and decorative account icons are optional illustration details, not new brand requirements; retain readable ink pricing and concise account guidance. The actual site uses its existing white header, working contact controls and smaller container gutters. Section links are anchors, not fake tabs: all product information remains rendered and indexable. At narrow widths the links may wrap to preserve their touch targets.

Customer controls appear only after the account check succeeds. Anonymous visitors can sign in; work accounts can open their dashboard; failed checks offer retry. Fresh preflight, CSRF, account-change reset, error and receipt behavior remain required.

Delivery copy is grounded in the existing checkout and fulfilment contracts. Collection uses the approved Kilimanjaro address. Delivery areas and charges depend on current approved configuration shown at checkout. Do not infer delivery dates, nationwide coverage, free shipping, warranties, reviews or return terms. No Buy now action bypasses the required cart, branch, delivery and policy checks. No password input, video or 3D feature is applicable to this product detail change.
