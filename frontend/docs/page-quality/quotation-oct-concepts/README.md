# Quotation workflow concepts

Generated with the built-in ImageGen tool on 7–8 October 2026, before implementation. These are design references; production UI remains semantic React controls and real API data.

| Concept                                          | Native size | Surface                                                                 |
| ------------------------------------------------ | ----------- | ----------------------------------------------------------------------- |
| [Desktop editor](01-desktop-editor.webp)         | 1435 × 1096 | Staff booking quotation section, two-column editor, saved records       |
| [Mobile editor](02-mobile-editor.webp)           | 882 × 1783  | Single-column form, side-by-side quantity and unit price, review footer |
| [Record and confirmation](03-record-review.webp) | 1505 × 1045 | Saved quotation, server totals and issue confirmation                   |

## Prompt set

**Desktop:** Create a crisp, readable desktop quotation section inside Allied AutoTech's existing workshop booking dashboard. Ink `#01121A` sidebar, cool-grey canvas, Quicksand interface text and compact headings. The section explains “Prepare a draft, review the saved totals, then issue it to the customer.” A white editor has a subtle border/shadow and 8px corners. “Edit draft Q-2026-1042” explains that saving replaces it with a new version. Use a 64/36 split for line items and a grey “Review & timing” aside. Include labour/catalogue-part/fee type, description, quantity, NGN unit price, remove/add, Lagos draft expiry, tax guidance and optional notes. Use 44px controls. The footer says “A draft is not sent to the customer.” with Review quotation draft and Close editor. Follow with saved quotations, revision information, a compact line table and an ink subtotal/tax/total strip. No photography, decorative metrics, oversized fields or marketing hero.

**Mobile:** Generate a fresh narrow-screen version of the complete quotation editor with a compact existing Allied header, 16px content padding, 14px labels and 15px controls. Stack line items above the grey review/timing section; retain quantity and unit price side by side. Preserve every field, the Lagos timezone and seven-day issuance explanation. Use full-width review/close actions, compact spacing, visible borders and no fabricated totals, tabs or timestamps. Show the beginning of saved records below the editor.

**Record/review:** Generate a focused saved-quotation and issue-confirmation concept. Show a white draft record with number, status, version/revision, draft expiry, notes and the actual line-table fields; place subtotal, tax and total on an ink strip. Include Edit draft, Review issue and Review void. Overlay a compact white modal, “Issue this quotation?”, with the existing seven-day acceptance explanation and warning that other issued quotations will be voided. Show quotation number, revision and total; provide Go back and Confirm change. No payment or deposit action, invented success, or document-download control.

## Implementation decisions from contract review

- Preserve the real dashboard shell and navigation. Generated global search, invented staff identity, last-saved timestamp and extra branding are outside this section and are not supported reference data.
- Keep authoritative API currency formatting, dynamic records, existing dates/timezone labels and pricing explanations. Never hard-code concept sample totals or tax rates.
- Keep the existing button labels “Create quotation”, “Review issue” and “Confirm change”. The third image's appended word “outline” is an ImageGen annotation artifact, not product copy.
- Desktop line controls use two columns where space permits; mobile retains quantity/price side by side. The review/timing panel stacks below at smaller widths.
- Saved rows remain visible and their line table is horizontally scrollable on narrow screens. The generated disclosure chevrons imply a collapse behavior that is not needed for this workflow.
- Keep the established confirmation dialog's Go back button and Escape behavior; no redundant close icon is necessary.

The [implementation report](../quotation-form.md) records browser comparisons, corrections and acceptance evidence.
