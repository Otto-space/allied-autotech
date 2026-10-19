# Product-category detail — gate 59 design spec

Designed 13–17 October 2026 for `/admin/categories/[categoryId]`. Gate 58 is accepted;
this separate detail gate is pending. The existing list has inline editing but no
named, independently addressable read page. The seven-field administrator direct
read and observed-update contract already supply everything needed; no backend
extension or schema change is required.

## Complete concepts

- [Desktop](desktop.png), generated source `exec-f976c07e-6b47-4b35-8c5d-ac8615df26bf.png`.
- [Mobile](mobile.png), source `exec-7abce202-2ede-484f-9f79-c0d58eee8a63.png`.
- Editing/review/recovery reuse the accepted [category editor](../work-product-categories-oct-concepts/editor.png)
  and its existing controls, without another duplicate grouping panel.

Both detail concepts were generated and inspected locally before implementation.
The first mobile generation was interrupted; the resumed generation completed.
The prompts specify the full read page, exact seven-field contract, real navigation,
named breadcrumb, visibility/URL-name strip, facts, description, product grouping,
filtered-products link, mobile stacking, and reuse of the accepted editor.

## Extracted system and copy

Preserve the real shell, logo, account controls and Quicksand typography. The generated
logo/account variations and mobile invented catalogue-search placeholder are not
authoritative: the established search remains “Find a page.” Use 27px desktop /24px
mobile headings, 18px section headings and 13–14px body, 44px controls, 8px corners,
20–24px section spacing, ink `#01121A`, red `#E60301`, white and cool-grey `#f4f6f8`.
Use existing Lucide arrows, chevrons, pencil and refresh icons. Refresh retains the
established neutral outlined treatment consistently; avoid the generated conflicting
red outline/filled variants. Existing business date formatting supplies Lagos time.

Read view: named breadcrumb “Overview > Product categories > Braking”; actual record
name as h1; “Review category details and product grouping.”; Back to categories and
Refresh category. Ink strip: Visibility/Active or Inactive and URL name/actual slug.
Two-column desktop content, approximately 1.8:1, stacks below 1100px. White details:
Category details, Edit category, Name, Created, Updated, Description. Missing
description displays “Not provided.” White guidance: Product grouping;
“Categories organise related parts in the product catalogue.”;
“Active products must be deactivated before their category can be deactivated.”;
“Changing a category does not delete its products.”;
“View products in this category” linking to the real category-filtered catalogue.
Mobile summary and facts stack. Full descriptions and long names wrap without clipping.

The existing catalogue name becomes a real detail link; its inline edit action remains.
`?view=edit` opens the reused editor. Invalid/duplicate view values show recovery and
no edit controls. Strict UUID route validation prevents malformed record requests.
Private denied/missing/mismatched records cannot show fields. Transient failures can
retain stale information but block mutations; parent and editor refresh together.

## Verification gate

Check direct/reloaded inactive records beyond page one, one breadcrumb, list-to-detail
and filtered-products navigation, all fields, reviewed edit/cancel/focus, atomic stale
rejection and lost-response recovery. Verify role restrictions, invalid URL, loading,
empty description, failure/retry, denied, malformed, mismatch, stale parent/editor,
long data, 320/375/390/430px plus tablet/desktop/landscape, Axe and page errors.
Compare actual captures against both concepts in a final ledger of at least five
points. Keep deployment and application-wide acceptance separate from this local gate.
