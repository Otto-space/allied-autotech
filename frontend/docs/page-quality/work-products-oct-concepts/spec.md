# Administrator products — pre-implementation specification

Prepared 13 October 2026 before frontend implementation. Gate 56 subsequently passed its [local acceptance](../work-products.md), bringing the accepted total to 56. This document retains the original design requirements and reference corrections; deployed acceptance remains open.

## Baseline and references

The baseline `/admin/products` used `AdminResourcePanel` through the generic route. Desktop/390px baseline screenshots at `C:/Users/PC/.codex/work-products-before-{1467,390}.png` show a sparse four-column table, absent search/filter controls, and a long creation form below the list. Mobile actions are outside the visible table viewport, despite no document overflow. List paging/edit/media selections do not survive reload. Existing image/compatibility management and complete product fields must remain usable.

Fresh complete references: [desktop catalogue](desktop.png), [mobile catalogue](mobile.png), [editor](editor.png), [review, recovery and media states](states.png). All four were inspected locally with the image viewer before frontend code. They are illustrative design references, not production inventory or assets.

## Contract and scope

Admin and Super Admin only; backend authentication, staff MFA and CSRF remain authoritative. Existing administrator list supports search across name/SKU/brand/part number, category, active/featured, exact brand, compatibility make/model/year, sort and UUID paging. Do not substitute public-only discovery or filter one downloaded page. No exact total, stock-count edit, bulk operation or product deletion is supported here.

ADM-06 adds `GET /admin/catalog/products/{productId}` for independent reload/edit/media recovery, including inactive records. ADM-07 adds optional `expectedUpdatedAt` to PATCH, checked under the product row lock; the new editor must always supply it. Existing clients remain compatible but do not receive stale-snapshot protection when they omit it. Product creation has no original-request receipt; uncertain creation requires manual reconciliation, with no automatic replay. See [backend contract](../../../../backend/docs/admin-product-catalogue.md).

## Visual system and permitted copy

- Keep actual DashboardShell, wordmark, menu labels and account controls. Quicksand interface, 28px desktop/24px phone title, 18px section title, 13px body and 12px label; 44px controls, 7–8px corners, 16px action icons.
- Palette: ink `#01121A`, red `#E60301`, white, cool `#F4F6F8` canvas, pale blue-gray borders and muted ink text. Neutral active/inactive labels. No gradients or green status treatment.
- Catalogue header: breadcrumb Overview > Products; Products; Manage product details, pricing and catalogue visibility.; outlined Refresh products; red Add product.
- White filter panel. First desktop row: Search products, Category, Visibility. Search placeholder Name, SKU, brand or part number. Second row: Featured, Sort, More filters, Clear filters, Apply filters. Dropdown defaults All categories, All visibility, All products, Newest. More filters reveals exact Brand, Vehicle make, Vehicle model and Year. Use API sort values newest/name/price_asc/price_desc and active/featured booleans. Phone fields stack; actions pair or wrap without shrinking text.
- Ink results band: Product catalogue and actual `N products on this page`; never a global count. Ruled white table columns Product, Category, Price, Visibility, Actions. Product: small actual approved image or explicit no-image fallback, name, SKU and optional brand. Price uses existing NGN formatter; availability says In stock at a branch or No available stock from returned branch booleans. Optional comparison price and Featured text preserve real fields. Visibility remains distinct from category visibility/stock.
- Actions View & edit and Compatibility & images remain reachable. Mobile table becomes labeled stacked records, with names/slugs/actions wrapping. Bottom Previous, Page N, Next. Pagination/filter history persists in URL; do not promise a cross-request database snapshot.
- Creation/editing is a separate URL-backed view within the catalogue, not permanently appended below the table. Header Create product/Edit product, Review product details before saving changes., Back to products and Refresh product for an existing record. Main bounded white form and smaller guidance rail; stack on phones.
- Product details group: Name full width; URL name and SKU paired; Category full width; Brand (optional) and Manufacturer part number (optional) paired; Description (optional) full width. Pricing group: Selling price (NGN) and Comparison price (NGN, optional). Visibility group: Featured and Active checkboxes. Complete optional-field guidance. All eleven values appear in review with category name and formatted prices.
- Guidance: An active product requires an active category. Stock is managed in Product inventory. Photos and vehicle compatibility are managed separately. Real Product inventory link and, for an existing record, Compatibility & images action. Category selection uses paged administrator choices, preserves the selected ID/name beyond page one, blocks while unavailable, and does not silently replace a selection.
- Review: Save this product?; These changes affect the live catalogue.; all eleven facts; Go back and Confirm save. Cancel makes no write. Preserve shared MutationReview focus, uncertainty and dismissal semantics.
- Media mode reuses ProductExtrasEditor, product image upload/hosted URL and compatibility forms. Retain actual controls, preview, ordering/primary image, limits, review and deletion rules. Read the selected product independently of list position. Persist owner-scoped uncertainty through reload and explicitly reconcile before allowing a further mutation.

## Behavior and states

Use typed payload boundaries, bounded/validated URL filters, UUID cursor trails, direct identity checks and exact money conversion. Keep amounts as integer-kobo strings; comparison price cannot be less than selling price. Preserve API text/SKU/slug limits and normalization. Description supports 10,000 characters. Render optional values clearly. Maintain owner-scoped drafts across temporary refresh errors, block writes on stale/unavailable data, and remove private content on denied/missing reads. Server conflict and pre-save check keep drafts until explicit replacement. Never replay uncertain mutations automatically.

Required states: matching skeletons; No products found with filter reset; Products unavailable/Retry products; denied; malformed/mismatched record; Product information may be out of date; changed draft/replacement; unconfirmed save/read recovery; blank and existing forms; validation; review; success; empty media/compatibilities; upload/failed upload/primary image/remove review. Keep loading and recovery status accessible.

## Explicit reference corrections before code

1. Generated logos, slogans, sidebar group names, notifications and account initials differ from the real shell. Keep the existing shell and branding exactly.
2. The mobile image is wider than real 390px content. Stack fields and record facts at actual phone widths; retain the desktop ink results band on mobile. Preserve the compact specified font scale.
3. Remove generated green status fills/dots and red stock dots. Text and neutral badges provide status; do not imply stock quantity.
4. Generated product photographs are illustrative. Production uses only returned approved product media, safe URL handling and the existing no-image fallback. Do not ship synthetic products/images as inventory.
5. Use actual page counts; the mobile illustration shows two rows while saying three. Pagination says Page 1 rather than a red numbered selection button.
6. The editor illustration's description counter/limit is wrong: API allows 10,000, not 1,000. Comparison price may equal selling price. Active visibility remains conditional on an active category. Use accurate existing validation/helper copy.
7. The state illustration splits replacement/recovery into unsafe-looking separate actions. Keep one explicit Load latest product and replace this draft action and one Discard draft and reload saved product action. Preserve verified shared review labels, dialog dismissal and transaction handling.
8. Media management retains real labels such as Use hosted image URL and the actual upload limits/formats from the existing implementation. Do not adopt the illustrated 5MB limit, invented upload tiles/tabs or review claims without checking the contract.
9. Brand is an optional text field, not a dropdown. Optional field examples are not saved values. Use real selected category names and one complete review.

## Original acceptance requirements

Implement the catalogue/editor/media integration and typed fixtures; verify URL/history/filter pagination, literal searches, direct edits beyond paging, exact prices, active/category/reservation rules, complete reviews/cancellation, stale/uncertain committed and uncommitted updates, creation reconciliation, uploads/compatibility/primary/removal, role denial and draft isolation. Run relevant static/unit/API/production-browser checks, 320–1920px/landscape/state captures and Axe/console checks. Use a fresh isolated database for the real integrated page gate. Finish with direct local concept/latest-render comparison across at least five fidelity points and source/build hash verification. A passing backend prerequisite does not accept this page.
