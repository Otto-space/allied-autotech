# Brand asset inventory

All production imagery is stored locally as WebP. User-supplied originals remain unchanged in attachments. Generated imagery is editorial only and never populates inventory cards, staff profiles, reviews or customer records. Decorative banners use empty alt text; informative photographs have contextual descriptions in their components. Generated technician imagery is explicitly described as an editorial scene. The actual supplied technician is used for the company story.

| File                      | Dimensions  | Size    | Source                                                   | Placement                                                     |
| ------------------------- | ----------- | ------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| executive-campaign.webp   | 1200 x 1594 | 262 KiB | Supplied image 2                                         | About campaign archive                                        |
| family-campaign.webp      | 1200 x 1594 | 200 KiB | Supplied image 5                                         | About campaign archive                                        |
| family-editorial.webp     | 1659 x 948  | 153 KiB | Generated editorial bdd10f57-56a9-40e1-a3af-5d3ce69e739e | Home slide 3; lifestyle discovery                             |
| lifestyle-campaign.webp   | 1200 x 1594 | 225 KiB | Supplied image 1                                         | About campaign archive                                        |
| operating-principles.webp | 1200 x 1593 | 175 KiB | Supplied image 3                                         | About archive; principles also transcribed into semantic HTML |
| parts-editorial.webp      | 1659 x 948  | 134 KiB | Generated editorial f22ee345-2aa7-472c-9e9c-b38e4cfa4c46 | Home slide 4; Shop banner and Home shop editorial             |
| showroom-editorial.webp   | 1659 x 948  | 124 KiB | Generated editorial e0154ed2-7f65-47e3-b220-fe28817c2b0d | Home slide 2; marketplace banner and discovery                |
| technician-original.webp  | 1200 x 1593 | 200 KiB | Supplied image 4                                         | Authentic company image on Home and About                     |
| workshop-editorial.webp   | 1659 x 948  | 101 KiB | Generated editorial 792ad01c-17cf-4391-9172-3e48aee41d1c | Home slide 1; services/contact banners                        |

## Fonts

Nippo variable (200-700) was downloaded directly from Fontshare on 2026-09-29 after the user corrected the font name. Official source: https://api.fontshare.com/v2/fonts/download/nippo; CSS source: https://api.fontshare.com/v2/css?f[]=nippo@1&display=swap. The unmodified WOFF2 and supplied ITF Free Font License are in app/fonts. Quicksand (300-700) uses the pre-existing public/fonts/quicksand-variable.ttf. Both load locally with next/font/local, so rendering does not depend on Google Fonts or Fontshare availability. The previously bundled Nibble file is no longer referenced; it was pre-existing and has not been deleted.

## Concepts

Fifteen focused concept images are in docs/design-concepts, with their original generation identifiers in sources.json. They cover Home, services, marketplace, shop, trust, four role dashboards, customer management, forms, authentication, media, Help and mobile. These are visual planning artifacts, not published data. Generated sample identity, figures, logos, foreign locations and policies were rejected in favour of the supplied brief and real contracts.

Production prompt direction: realistic Nigerian automotive editorial photography; ink/red/white palette; generous negative space for code-rendered type; no text, logos, prices or embedded UI. Workshop: technician inspecting dark SUV. Showroom: silver executive sedan and dark SUV. Family: African family beside white SUV. Parts: brake components, filters and unlabelled oil containers.
