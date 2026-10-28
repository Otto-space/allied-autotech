# Public copy and imagery implementation - 28 October 2026

Source brief: owner's `Downloads/Allied_AutoTech_Homepage_Copy_Imagery_Codex_Brief_2026-10-27.md`, instruction 7 and acceptance/handoff 8-9. Scope: Home, Services, Shop, Vehicles, About and shared public footer. This does not assert full-site, authenticated-role or physical-phone acceptance.

## Source and publication boundary

Worktree: `allied-contact-validation-20261027`, branch `feat/public-copy-imagery-20261028`. Started from verified apex/www runtime `a51a58b8` / `dpl_5LscxLnZGRXNBorSWq3GFgfUBcGq`; incorporated subsequent live `2725efea` / `dpl_Ch3kcHTq565fAMKne6hFT8NPKw7R` and live fitment fix `8d2dfd69` / `dpl_DfQ8TmtFujaCL215HnWRuaTRuRZr` before release. Existing notification preferences, Allie conversations, permissions, scroll/focus repairs and enquiry restrictions remain. No backend/schema, production stock, reviews, messages, appointments or transaction writes.

## Final Home order and purpose

1. Stable offer hero: one H1, Services and Contact actions. No carousel or autoplay.
2. How can we help: Services, Shop and vehicle-requirements enquiry, three distinct tasks.
3. Published services: one full-width list, comfortable with one record; no portrait poster determining the row height.
4. Inside the workshop: actual Autel equipment photo, linked to the equipment anchor on About.
5. Shop: editorial illustration plus eligible actual product records. Missing-photo records remain in the catalogue.
6. Vehicle panel: compact requirements enquiry on verified zero; actual cards when published; loading/failure are distinct.
7. Published feedback only when present. A verified zero omits this Home section; Reviews remains in the footer.
8. Before you visit: three practical FAQs, Help Centre and one contextual invitation to the existing Allie dialog.
9. Practical visit band: maintained address, directions, Contact, Whatsapp and explicitly labelled Customer Care hours.
10. Footer: official brand and one quiet motto signature.

Services owns the service process; About owns the full mission and principles. No invented advice-card or latest-work module was added.

## Copy inventory and changes

| Source / before                                                                         | After / decision                                                                                                |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| HomeHero client carousel: motto, vehicle pitch and Quality parts / Reliable performance | Static `Diagnostics, repairs and automotive essentials.`; explanation and two actions                           |
| One trusted automotive partner; For the vehicle you drive today...                      | How can we help? with three task descriptions                                                                   |
| Service & repairs; Shop & automotive products; Vehicle marketplace                      | Services & repairs; Shop parts & oils; Vehicle enquiries                                                        |
| Services/Home Care for every next kilometre                                             | Home Explore our services; Services Find the service your vehicle needs                                         |
| Marquee mixing work categories and values                                               | Removed from Home                                                                                               |
| Home portrait Precision Autocare campaign beside sparse service list                    | Removed from Home; original stays on About                                                                      |
| Home three-step journey; Services six-step journey                                      | Home repetition removed; Services has three enquiry steps in limited mode and existing full-mode journey        |
| Home Built on Trust artwork / four principles / What you can expect                     | Removed repeated block; About retains official principles unchanged                                             |
| Services No Guesswork artwork + repeated slogan / three principles                      | Removed repeated block; process and relevant enquiry limitations remain                                         |
| Home Your next chapter starts here + empty vehicle stage                                | Looking for a vehicle? with verified no-listings text and Discuss a vehicle                                     |
| Home Quality parts / Reliable performance                                               | Parts, oils and automotive essentials.                                                                          |
| Precision starts with understanding                                                     | Inside the workshop; factual tool context                                                                       |
| Empty review invitation                                                                 | Omitted on successful zero; real failures still visible with recovery                                           |
| A little clarity / Before you set off; generic intro                                    | Before you visit; three practical disclosures                                                                   |
| Let's take care of your next move; Speak with us                                        | Visit Allied AutoTech in Port Harcourt; directions, Contact the team and Whatsapp                               |
| Footer unpunctuated motto                                                               | Built on trust. Driven by quality.                                                                              |
| Services count with matching/page count on every result                                 | 0 services found / 1 service found / N services found; page count only for pagination                           |
| Repeated Quotation required / Custom Quote / Request a quote in cards                   | Quotation required once per quote card; fixed-price label retained                                              |
| Before you book; generic procedural intro                                               | Before you enquire; limited-mode visit confirmation answer beside relevant process                              |
| Shop Auto Parts & Automotive Essentials                                                 | Parts, oils & automotive essentials                                                                             |
| Find the right fit plus unrelated workshop illustration                                 | Check before you choose; concise part/specification, compatibility and branch guidance                          |
| Vehicles Find the car that fits your life                                               | Tell us what you're looking for on verified unfiltered zero; Explore vehicle listings otherwise                 |
| Repeated closer-look guide and closing vehicle pitch                                    | One short Discuss a vehicle panel with query-preserving actions and no reservation/viewing confirmation promise |
| About Precision Autocare heading plus identical image caption                           | Automotive care in Port Harcourt; remove redundant caption, preserve artwork and alt text                       |
| About Built on trust driven by quality heading                                          | How we work; mission, vision and all 11 principles unchanged                                                    |

Hard-coded/shared presentation is in `app/components/public-home.tsx`, `home-hero.tsx`, `brand-editorial.tsx`, public route pages, `lib/brand-content.ts` and `site-footer.tsx`. Business address, Customer Care hours and destinations still come from `lib/business.ts`. Catalogue titles, descriptions, prices, stock, images, service categories and published reviews remain API-authored. No frontend competing description was introduced.

The owner's direct instruction to show **Whatsapp** takes precedence over the brief's suggested Chat on WhatsApp. Links still use the maintained HTTPS destination; no telephone number is rendered. The destination necessarily contains its routing identifier; this change makes no new claim about third-party chat encryption.

## Image placement and colour

| Asset/source                                             | Treatment, crop and destination                                                                                                                                                                      | Status                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `images/allied-autotech/workshop-editorial.webp`         | Existing source retained in static Home hero and Services hero; desktop right focal point, mobile Home image below copy, reserved 16:9 area                                                          | Editorial illustration, never described as actual premises/staff                |
| API service image                                        | Actual thumbnail beside source description, 3:2; no generic substitution                                                                                                                             | Source-authored service media                                                   |
| `images/equipment/autel-mk808s.jpg`                      | Home evidence feature; contain, reserved 16:9, factual screen blue preserved; About equipment gallery unchanged                                                                                      | Actual equipment photograph                                                     |
| `images/allied-autotech/parts-editorial.webp`            | Home Shop and Shop hero, bounded landscape crop                                                                                                                                                      | Editorial; never used as a listing photo                                        |
| API product media                                        | Only eligible published media on Home; preserve names, prices and authoritative availability; errors retain honest fallback                                                                          | Actual record media; unknown stock remains unknown                              |
| `images/allied-autotech/showroom-editorial.webp`         | Source original preserved intact                                                                                                                                                                     | Editorial original                                                              |
| `images/allied-autotech/showroom-neutral-editorial.webp` | Separate generated derivative: replace decorative left navy vignette with charcoal, retain silver/dark vehicles, windows and red wall; 1659x948 WebP, 150,776 bytes; Vehicles hero right focal point | Editorial derivative; caption explicitly says illustration                      |
| `CampaignArtwork` originals in `public/brand/r2`         | Home/Services repeated campaign slots removed; About portrait stays contained and readable, original files unchanged                                                                                 | Official supplied campaign artwork; embedded text included in repetition review |
| Family editorial image                                   | Duplicate hero journey removed; no new family crop introduced                                                                                                                                        | Original retained, not on changed Home                                          |

Home's earlier navy CSS band had already become the shared black/red gradient before this cycle; verified baseline computed that fact. This cycle replaces the zero-inventory stage with a compact white/light-grey panel and red accent. Vehicles' remaining conspicuous blue was baked into the showroom source; the separate neutral derivative and shared charcoal caption resolve it without global hue/saturation/grayscale filters. Factual equipment/product/vehicle colours and semantic states are preserved.

## Sparse, failure and optional-content rules

- Services: zero has the existing useful empty enquiry route; one and several use real records without a poster-sized gap. Source wording survives on Home, catalogue and detail.
- Products: zero is explicit; records with no eligible real image are not featured and do not cause a false no-products claim. One/several eligible records use responsive cards. Unknown branch availability and listed-branch unavailability remain distinct. Runtime image errors show a truthful fallback, not a generic replacement or a claim that a slow load is broken.
- Vehicles: successful zero alone gets compact empty copy. Positive records retain media, price, specifications and branch. Failures expose recovery; filtered zero never becomes a claim about the entire catalogue. Query-preserving enquiry helpers remain in use.
- Reviews: successful zero omits the Home section; published records retain ratings and carousel controls; errors/loading stay distinct.
- New standalone guides and workshop stories are deferred. No unreviewed oil grades, universal intervals, fabricated cases or dead links. Existing Help/Learn and Allie are reused behind the existing feature flag.

## Design comparison ledger

Concept directory: `C:/Users/PC/.codex/generated_images/01a17c67-8a90-7763-ab26-1dd4fbcc77ce/`.

- Hero/tasks: `exec-9dedb09d-1efe-4a7c-801f-3e4d796625fd.png`.
- Services/equipment: `exec-2c54df53-43f0-4e8a-b607-b7f4c6d6ad46.png`.
- Shop/vehicle panel: `exec-a78da790-1143-4bd8-af09-36717723f333.png`.
- FAQ/visit/footer: `exec-c9b7a384-829f-4c58-b092-977308ab950f.png`.

An earlier lower-page concept inventing premises/branding was rejected and never shipped. The brief and existing approved assets override incidental invented imagery or wordmarks in concepts. Deliberate implementation differences: preserve actual Brand, Nippo/Quicksand, existing header, supplied workshop editorial, actual equipment photo, source-authored service wording and existing support dock. Concepts are layout references, not replacement brand/evidence assets.

Compared points: stable hero hierarchy and two actions; distinct three-task arrangement; one-service row without poster gap; contained real equipment feature; descriptive Shop with truthful sparse data; compact neutral vehicle panel; practical FAQ/contact/footer hierarchy. Above-fold implementation uses exactly the brief's H1, explanation, eyebrow and two actions. Concept's invented logo/workshop scene was deliberately not substituted. Latest rendered comparison and native viewport evidence are recorded in the verification receipt below.

## Editorial dependencies

1. Production service record **Tyre Change**, ID `669f57ce-6e45-46f8-a9c4-75aa56f9d169`, current `description`: `We use high-end technical equipments to change your tyres`. Proposed exact edit: **Tyre removal and fitting using workshop tyre-changing equipment.** Use the existing Services authoring workflow after a responsible editor verifies scope; align `shortDescription` if populated. No source-content write or competing UI override was made in this cycle.
2. Engine Oil Filter needs a suitable actual product photograph in its record before homepage eligibility. The catalogue/detail honest fallback remains.
3. New oil/maintenance guides need an identified qualified reviewer, appropriate sources and review date. Actual completed-work stories need verified photographs and consent. Workshop opening hours remain unverified; only maintained Customer Care hours are shown.

## Verification receipt

Local typecheck, full lint and formatting passed; focused state/notification regression suite passed 23 cases. Home fixture layout checks passed at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536 pixels. Separate rendered acceptance passed FAQ/keyboard/product navigation, verified empty state, independent outage/retry recovery, real review rating/refresh controls, image failure with long content, 200% text, stable mobile offer/menu, and scoped Axe at 390/1440px. These use isolated fictional API records and perform no business writes.

Read-only actual public-data captures cover all five routes at 320, 430, 768, 1280 and 1536px with no horizontal overflow or page exceptions. Existing lazy images in closed equipment disclosures are not failures. One first-load service image was still pending at the sampling point and loaded at later widths; no permanent missing-image claim was made. Existing Allie open/Escape/focus return and FAQ keyboard operation passed across the five widths.

Failures corrected: stale legacy fixture stock wording and session-refresh count assumptions; missing fixture product detail response; a cold development compilation exceeding the standalone harness timeout; mobile hero contrast; visit-panel text contrast; and a real background-refresh race changing the Home vehicle CTA destination while clicked. The final action remains the same requirements enquiry throughout loading/error states. A failed refresh also no longer presents stale zero records as a fresh empty result.

The corrected vehicle enquiry, query-preserving filtered vehicle link, equipment anchor and Services breadcrumb journeys passed at 430/1536px. Native 1774px Home and 430px phone captures were inspected with `view_image` alongside all four concept references: hero hierarchy, task links, service row, equipment image, Shop/vehicle panel and FAQ/contact/footer were compared. Approved Brand/assets, existing container/font tokens and source content deliberately take precedence over incidental concept inventions. Above-fold copy matches the brief; no material mismatch against that bounded specification remains.

Playwright with installed Microsoft Edge was used because no Browser/IAB plugin was available. Screenshots: `%TEMP%/aat-copy-verified-home-{430,1536,1774}.png` and matching `top` captures; route captures `%TEMP%/aat-copy-final-{320,430,768,1280,1536}-{home,services,parts,vehicles,about}.png`. Read-only inventory/exception receipt: `%TEMP%/aat-public-copy-final.json`; corrected journey receipt: `%TEMP%/aat-copy-final-journeys.json`.

The initial exact-source GitHub frontend gate passed lint, types, the full unit suite and production compilation, then rejected register formatting introduced while merging the live release. Register formatting is corrected and all final exact-source gates are rerunning. Final release identity and hosted acceptance remain pending below. Physical iOS/Android, full screen-reader, signed-in roles and unrelated site routes are untested in this cycle. No assertion that the entire website is bug-free.
