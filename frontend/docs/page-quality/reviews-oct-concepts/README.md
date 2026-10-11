# Reviews concepts — 7 October 2026

These three concepts were generated with the built-in ImageGen tool and inspected before implementing the expanded public Reviews page. They cover the complete page, populated review anatomy and mobile continuation. They are design references, not production screenshots or customer testimonials.

| Reference                                                  | Design scope                                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [Introduction and feedback](01-introduction-feedback.webp) | Compact introduction, contrasting statement, feedback filters, truthful empty state and submission guidance.              |
| [Review anatomy and guidance](02-review-guidance.webp)     | Editorial rating/content row, native FAQ and workshop Customer Care panel. The example review is explicitly illustrative. |
| [Mobile](03-mobile.webp)                                   | Single-column order, full-width filter controls, pagination, guidance, FAQ and Customer Care continuation.                |

## Implementation specification

- Retain the shared production header/footer, real logo and existing navigation. Generated footer suggestions such as Careers and Special Offers are outside scope and were rejected before implementation.
- Use the bundled Nippo and Quicksand fonts. The written brief's 36px maximum desktop heading and 28px mobile heading take precedence over the generator's enlarged lettering. Section headings are 22–27px; review titles use 17px Quicksand.
- Use a centered 1200px container; desktop gutters 32px, mobile gutters 20px. Palette: ink `#01121A`, red `#E60301`, white and cool grey `#F2F5F7`. Inputs use `#82939F` borders and a `#B80201` focus treatment. Controls are at least 44px high.
- Keep the feedback list wider than the guidance panel. Use horizontal rating/content rows on desktop and stacked rows on mobile. Numeric ratings retain accessible labels; decorative stars do not repeat the announcement.
- Use the existing `workshop-editorial.webp` rather than generating another production photograph. It is supporting imagery, not evidence of a reviewer's identity or purchase.
- Render the backend's approved records only. No reviewer identities, avatars, aggregate scores, global counts, purchased-review badges or fabricated testimonials. Counts explicitly refer to the current page.
- The public page has customer, anonymous, Staff and administrator account-link states; the concepts illustrate the anonymous state. Existing account pages and backend policies determine authorization and eligibility.
- Use native FAQ disclosure and native styled selection. Empty, loading, failure, retry, paginated and filtered states follow the same component geometry. Respect reduced motion.

## Prompt record

The three prompts requested: (1) a complete upper-page desktop screenshot with exact introduction, filter, empty-state and three-step guidance copy; (2) an explicitly illustrative review-row specimen and the complete lower FAQ/Customer Care section; (3) the entire single-column mobile page. Each specified Nippo/Quicksand, brand palette, bounded typography, visible borders, 44px controls, practical HTML/CSS, no invented ratings/counts/customer identities and no unrelated sections. The generated navigation and oversized typography were constrained by the implementation specification above.

Original tool outputs: `exec-a90f31e5-f49a-44f0-ae74-9560efdc8543.png`, `exec-b0eaa55f-b92f-42a0-b04e-81586be92908.png`, `exec-07d331dc-e87c-4e24-b7c6-ea034bda81fd.png`. Repository copies preserve the full concepts as quality-88 WebP; no generated screenshot is embedded in the application UI.
