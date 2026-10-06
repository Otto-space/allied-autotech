# Service detail concepts

Generated and inspected before implementing `/services/[serviceId]`.

- [01 — Service overview and appointment selection](01.webp): compact split hero, actual price and duration, open service context, bordered appointment panel, searchable branch, Lagos-time slots and account details.
- [02 — Appointment request states](02.webp): mobile form density, notes, policy, confirmation and uncertain-response treatment. State examples are alternatives, not simultaneous panels.
- [03 — Quotation enquiry](03.webp): service context beside a compact enquiry form, review dialog and accepted receipt.

Use the existing shared header, footer and authentic logo. Display headings use locally bundled Nippo; interface copy uses Quicksand. White, ink `#01121A`, red `#E60301` and restrained navy `#091B38` remain the palette. Controls have visible `#8290A1` borders, five-to-six-pixel radii and a minimum 44-pixel height. The desktop container is capped at 1280px. On mobile, identity and pricing precede media; the request panel precedes supporting context.

Generated photographs, branch names, sample prices and durations are design references only. Render published API records and their authorized image projection, with an explicit missing-image state. Do not use the generated technician image as a photograph of an actual service. Retain real backend field limits (2,000 characters for booking notes; 4,000 for support messages), the live booking policy, and real receipt status. Omit invented wizard steps, unsupported branches and generated contact details. A received booking request is not a confirmed appointment; an enquiry is not a formal quotation.
