# Vehicle detail concepts

Route: `/vehicles/[listingId]`. Created with the built-in ImageGen tool before implementation on 30 September 2026. These are design references, not production listing images. Original PNGs remain in the Codex generated-image directory; the selected WebP references are stored in the repository.

| Reference          | Coverage                                                                                       | Original file                                   |
| ------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [01.webp](01.webp) | Desktop identity, gallery, price and enquiry actions                                           | `exec-84a93acc-ec03-4618-8f51-6bac6de613b2.png` |
| [02.webp](02.webp) | Specifications, condition report, inspection form, related listings and footer                 | `exec-deec0d84-ab26-4c7a-ad5c-2e23d8e04a68.png` |
| [03.webp](03.webp) | Mobile layout, expanded gallery, missing data, validation, confirmation and unavailable states | `exec-50ea3fa1-a2a0-4511-b2d0-e82b42720c3d.png` |

## Implementation specification

- Use the actual local Nippo and Quicksand fonts, real Allied logo, approved phone and workshop address. Generated phone numbers, logos, taglines and example inventory are not authoritative.
- White public shell; navy `#091B38` request panel; ink `#01121A`; red `#E60301` primary actions; visible control borders `#8290A1`.
- Place readable breadcrumbs, vehicle identity and mobile price ahead of the gallery. Desktop uses a wider gallery and a narrower request panel. Preserve complete vehicle photos with `object-fit: contain`; never crop out condition information to match a concept.
- Keep specification labels paired with their real values. Include available trim, body, engine, drive, doors and seats. Show only published condition-report text, date, odometer and score.
- Place the inspection form in a pale section beneath the details. Use a required Lagos date/time, optional notes up to the backend's 2,000-character limit, visible borders, associated errors and focusable confirmations. The generated mobile board's 500-character label is superseded by the actual contract.
- Use customer account actions, explicit appointment-confirmation language and real backend requests. Preserve account-change cancellation and uncertainty handling. Do not add payment, financing, warranty or availability guarantees.
- Gallery controls support thumbnails, previous/next, arrow/Home/End keys, touch gestures and a native modal with Escape and focus restoration.
- Same-make alternatives come from the public API, exclude the current record and show an honest fallback when absent or unavailable. Keep the existing footer.
- Main listing validation precedes response streaming to preserve crawler 404/500 status. Related listings stream independently with a loading message. Mutation controls show their actual busy state.

## Prompt set

All three prompts specified `ui-mockup`, 1536 × 1024 landscape, Nippo display, Quicksand UI, the official white/ink/red/navy palette, compact 44px controls, clear borders, precise editorial spacing, and no fake ratings, finance, warranties or guarantees.

1. **Desktop upper page:** compact white Allied header and navigation; Home → Vehicles → Toyota Camry breadcrumb; 2021 / Used / Port Harcourt context; large title; approximately 62/38 gallery and navy summary split. Gallery with silver sedan, expand control, counter and thumbnails. Summary with listed price, mileage/transmission/fuel, branch, enquiry, save, account requirement, inspection anchor and phone/WhatsApp actions. Start the specifications section at the bottom. Example car and values are concept data only.
2. **Desktop lower page:** two-column specification list; description and published condition report with date and odometer; pale inspection band with three explanatory steps and a compact white form using Lagos time and 2,000-character notes; related vehicle rail and existing company footer. Use the verified contact details and Kilimanjaro landmark. Keep all sections readable in the focused image.
3. **Mobile and state board:** mobile identity/price/gallery/actions; mobile specifications/report/inspection; navy expanded gallery with close and navigation; no-photo, invalid date, inspection success, customer sign-in, unavailable listing and loading states. Use readable labels, clear focus controls and restrained state styling. Example photos and records are design-only.

The generated references were visually inspected before coding. Fidelity corrections and verification results belong in the [route report](../vehicle-detail.md).
