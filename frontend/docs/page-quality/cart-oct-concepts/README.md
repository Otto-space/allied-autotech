# Cart and checkout concepts — 8 October 2026

These three fresh ImageGen concepts were generated and inspected before implementation for the `/dashboard/cart` page gate. Existing dashboard navigation is retained; its own redesign remains a separate milestone.

1. [Desktop cart](01-desktop-cart.webp): compact product rows with thumbnails, quantity controls, a dark subtotal band and a separate collection/delivery editor.
2. [Delivery editor](02-delivery-editor.webp): visible field borders, selectable fulfilment options, approved-area selection, recipient details and explicit payment guidance.
3. [Review and confirmation](03-review-confirmation.webp): review before creation, editable details, copyable server reference, server-returned money and clear next-step navigation.

The accepted implementation uses Nippo/Quicksand and the existing brand mark. Generated logos, slogans, sample inventory, sample prices, fixed delivery promises and navigation additions are not production requirements. Actual product imagery and prices come from the API. The address uses the owner's confirmed “beside Kilimanjaro” landmark. Address input supports the real 500-character contract, not the generated 250-character counter. Narrow mobile fields occupy one column.

No concept image is rendered as application UI. The generated tax figures are illustrative only; checkout displays authoritative server amounts and does not initiate payment.
