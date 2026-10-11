# Invoice and receipt concepts

Generated with the built-in ImageGen tool on 8 October 2026, before invoice production implementation. The three concepts cover the complete desktop invoice workspace, mobile adaptation and share fallback, and printable invoice/receipt documents.

- [Desktop](01-desktop.webp): white invoice sheet with a red rule, dark total summary, compact toolbar, source link and payment history.
- [Mobile](02-mobile.webp): summary first, paired document actions, stacked line descriptions with visible amounts, narrow-screen totals.
- [PDF documents](03-documents.webp): restrained invoice table and confirmed-payment receipt, repeatable identity and page footer.

Implementation constraints take precedence over generated sample content: use Nippo/Quicksand, the existing dashboard shell and approved company identity. Retain the exact tagline “Built on Trust, Driven by Quality.” Remove the concepts' invented secondary slogans, blue links, green status and tax percentage. Sample amounts/descriptions are synthetic design data; production displays only server records. Use the actual receipt method and settlement date. A payment receipt does not certify fulfilment or full invoice settlement. PDF typography uses the licensed bundled Quicksand font; Nippo is not converted or subset for PDF embedding.

Toolbar actions remain at least 44px. At narrow widths the summary and its payment action wrap into a vertical arrangement instead of reproducing the generated concept's cramped horizontal row. Itemization comes from historical source records or the new immutable invoice document snapshot, with an explicit legacy summary when reliable itemization is unavailable. Sharing uses native browser file sharing where supported and an authenticated-page link/download fallback.
