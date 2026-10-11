# Customer vehicle purchases concepts

Prepared before production implementation, 9 October 2026. Built-in ImageGen generated a complete [desktop](desktop.webp) and [mobile/state sheet](mobile-states.webp). Original PNGs remain under the Codex generated_images directory. These are visual concepts only; no generated car photo is inserted into a production inventory record.

## Extracted implementation specification

Keep the actual Allied dashboard shell, logo, search, navigation and support controls. Use Quicksand, ink #01121A, red #E60301 for the primary action, canvas #F4F6F8, white rows and #EAF0F5 guidance/table header. Body 13-14px, heading 30px desktop/27px mobile, fields 16px and 48px high, actions 44px minimum; 6px controls, 8px table corners, visible #82939F field border and red focus outline. No rainbow status colors.

Breadcrumb Overview / Vehicle purchases uses semantic navigation, ordered list, chevron and aria-current. Heading Vehicle enquiries & purchases; subtitle Follow each enquiry from your first conversation through payment and handover. Actions Refresh enquiries outline and Browse vehicles red. Guidance Your vehicle journey / Open an enquiry to review its progress and payment requests. Use a small outline car icon and stack guidance copy when width requires it.

Filters Purchase status (all 12 actual states), Rows per page 10/20/50, Reset filters and All times in Lagos. No unsupported server search or sort. Page count N enquiries on this page, including purchases at later stages; no global total. Four-column table Vehicle / Price / Status / Progress. Vehicle combines a safe actual thumbnail 88x64, readable title, transactionNumber and Started date/time in Lagos. Price shows Asking price when agreedPriceKobo is null, otherwise Agreed price; preserve exact integer-kobo decimals including zero. Status comes only from the API. All neutral bluegrey; Cancelled and Expired pale red. View progress links to the existing owned detail route with a vehicle-specific accessible label, without triggering a payment or reservation.

Below 1100px show compact semantic stacked rows: thumbnail/title/reference/date first, status, price label/amount and ink progress link. At 320px allow safe wrapping of long titles, references and prices, with no horizontal overflow. Missing, unsafe or failed photos use existing PublicMedia image-unavailable treatment with a car icon. Do not request staff/private preview routes or substitute campaign photographs. Public image visibility may exclude archived listings, so that fallback is expected.

Footer Previous / Page N / Next and customer-care link. URL status, limit and cursor survive reload and Back/Forward; bounded 50-entry history stays browser-side. Direct cursor without history shows Later page and First page. Filter changes reset pagination. Count only the returned page.

Design and verify loading skeleton, no enquiries, filtered empty, later-page empty, unavailable/malformed/offline/rate-limited/denied and background-stale states. Manual errors hide rows; background errors keep labelled rows and disable pagination. Session changes discard private data and late responses. No mutations on this page. Recovery actions remain keyboard accessible; reduced motion disables skeleton animation.

## Intentional concept corrections

Use the existing shell and logo rather than generated substitutes, and keep actual mobile search/header/support bars. Maintain Quicksand even where the artwork resembles another sans font. Desktop artwork bright-blue links become ink; Page 1 is text rather than a button, without mobile artwork's invented total. Use compact neutral bordered status labels, not large pills. Price values and dates come from the API and never the artwork. Mobile empty state remains compact with a restrained car icon rather than a large illustration/dead zone. Stale and full error examples are separate states. The full-length heading/actions may wrap naturally because of real font metrics and accessible sizes.

## Prompt record

Desktop prompt requested a 1536x1024 complete Allied customer shell with four compact vehicle/price/status/progress rows, safe inventory thumbnails, exact naira prices, status/page-size filters and pagination. Mobile prompt requested four coordinated panels for normal/long-record/missing-media/empty/error/stale states at 360px. Both specified the official palette, Quicksand, supported API fields, 44/48px controls, no invented totals/search/payment/reservation actions and code-native layout. Retained WebPs change encoding only.
