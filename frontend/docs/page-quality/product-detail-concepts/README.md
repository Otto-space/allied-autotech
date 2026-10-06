# Product detail concepts

Generated before implementation for `/parts/[productId]` on 30 September 2026 and inspected at 1536 × 1024. These are design references, not product photographs for the live catalogue.

- [01 — Product identity, gallery and purchase controls](01.webp)
- [02 — Specifications, compatibility and related products](02.webp)
- [03 — Mobile layout and interaction states](03.webp)

Use the existing Allied wordmark, Nippo display font and Quicksand UI font. Tokens: white surfaces, ink `#01121A`, navy `#091B38`, red `#E60301`, muted text `#4F6073`, control border `#8290A1`. Container: at most 1280px. Controls: at least 44px. Gallery: contained images, thumbnails, keyboard/touch navigation and an accessible expanded dialog. Desktop places a bordered purchase panel beside the gallery; mobile presents the name and price before the images. Lower content uses two open columns and compact related-product links.

The generated examples are illustrative. Product names, photos, descriptions, prices, branch names, availability, brand, SKU, manufacturer part number and compatibility must come from the API. Preserve missing-data states. Do not publish the generated Denso packaging or sample products as inventory.

Required corrections to generated text: concept 03 incorrectly claims a temporary cart reservation; the application must say that adding a product does **not** reserve it. The API saves the total quantity, so the primary action remains “Save quantity to cart.” There is no product-type field in this DTO. Use the real SKU instead. Preserve existing header/footer links and verified business contact information; generated footer links and logo variations are not authoritative. Comparison prices are displayed only when supplied and higher than the current price. No fabricated rating, promotion percentage, shipping promise or warranty is permitted.

Original PNG files are retained in the Codex generated-images directory. These WebP copies are the durable workspace references.
