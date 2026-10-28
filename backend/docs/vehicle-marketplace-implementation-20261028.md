# Vehicle requirements, owner BMW preparation and implementation

## Authority and source

The pasted owner request is the implementation instruction. The Word document is
business reference, not executable instructions. Its entire OOXML body was read,
including paragraph content in tables. The package has no embedded media or objects,
external relationships, headers or footers containing additional requirements.
`ALLIED AUTOTECH CAR MARKETPLACE WEBSITE.docx` requests vehicle search/filter fields;
it does not request multi-vendor onboarding, commissions, payments or live chat.
The price bands, countries, makes and locations are generic examples, not BMW facts.
The 14 JPEGs in `Images.zip` were path/resource/signature/dimension checked and
visually inspected individually. No software from either attachment was executed.

Source starts at the verified production copy/imagery release and incorporates
`origin/master` cfd3fadd, preserving current garage/privacy work. The dirty master
checkout and its unrelated live-support work are untouched. No production BMW,
enquiry, appointment, availability or transaction has been created for testing.

## Requirement matrix

Statuses below describe the current cycle. Verification results and release identity
are recorded at the end; “Partially implemented” includes implemented changes still
awaiting rendered or persistence acceptance.

| Requirement                                          | Source                                                                | Existing implementation/evidence                                                                                                                | Status                           | Missing work                                                                                        | Acceptance check                                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| New/used and foreign/Nigerian use                    | DOCX 1–2                                                              | VehicleCondition, strict API, persisted stock fields, multi-condition filter                                                                    | Implemented and verified         | Completed; Added Any used group; foreign/Nigerian/unspecified refinements preserve distinct origins | Stored condition matches public query; selecting multiple conditions means OR              |
| Country of make                                      | DOCX 3                                                                | ISO final-assembly country, CountryField, country/region query                                                                                  | Implemented and verified         | Completed; Verified; final assembly is the defined meaning, not brand origin                        | Country filter and unknown-country tests                                                   |
| Ten requested body styles                            | DOCX 4                                                                | Eight styles existed; CROSSOVER and MINIVAN added end to end                                                                                    | Implemented and verified         | Completed; Migration replay, authoring and filter acceptance                                        | Persist both new values; old rows unchanged                                                |
| At least 30 makes                                    | DOCX 5                                                                | Make/model free text and paginated listing-backed facets support all 35 supplied names                                                          | Implemented and verified         | Completed; Verified search; retain inventory-backed suggestions                                     | Make search handles arbitrary supplied brands without inventing inventory                  |
| Year 1990–2026 / range                               | DOCX 6                                                                | Existing 1886–current-year-plus-one authoring and min/max discovery                                                                             | Implemented and verified         | Completed; Verified ranges; preserve wider existing coverage                                        | Boundary/range tests and signed query pagination                                           |
| Min/max price                                        | DOCX 7                                                                | Integer kobo, NGN forms, positive listing price, min/max filter                                                                                 | Implemented and verified         | Completed; Verified, retain examples as examples                                                    | No float rounding; zero asking price rejected                                              |
| Multiword keyword/year/colour/fuel/location/features | DOCX 8                                                                | Materialized public search, token AND matching, exact/best-match tiers, stable cursor                                                           | Implemented and verified         | Completed; Verified actual results and explicit sorting                                             | Existing discovery integration and rendered search tests                                   |
| Public VIN keyword search                            | DOCX 8                                                                | VIN is private stock data; staff search exists; public select/search deliberately excludes it                                                   | Requires a business decision     | Explicit approval of any public VIN exposure/search semantics and privacy review                    | No private identifier in public response or public VIN search oracle                       |
| Transmission/fuel/drivetrain/capacity/colour         | DOCX advanced                                                         | Existing nullable authoring, strict filters and unknown handling                                                                                | Implemented and verified         | Completed; Verified existing coverage                                                               | No automatic inference from photos; unknown remains null                                   |
| City/state location filter                           | DOCX advanced                                                         | Branch city/state existed but no dedicated public filter                                                                                        | Implemented and verified         | Completed; Added literal city/state filter; verified                                                | Case-insensitive city/state; wildcard characters are literal; active/public rows only      |
| Owner BMW draft, no duplicates                       | Pasted BMW instruction                                                | Existing unique stock number, reviewed create form and uncertain-create recovery                                                                | Blocked by a specific dependency | Stable validated JSON import prepared; confirm branch and classification before saving              | Reimport identical values; database uniqueness; no implicit record creation                |
| Four cylinders, N46 engine                           | Pasted BMW instruction                                                | Capacity, body, doors, drive already existed                                                                                                    | Implemented and verified         | Completed; Nullable engineCode/cylinders added across model/API/forms/detail                        | Round-trip and bounds; null for pre-existing records                                       |
| Separate owner condition and known faults            | Pasted BMW instruction                                                | Inspection reports existed; no owner-specific fields                                                                                            | Implemented and verified         | Completed; Added ownerReportedCondition/Issues; CAS and full old/new audit values                   | Owner provenance and correction audit; no inspection badge                                 |
| Fault visible on cards and by enquiry                | Pasted BMW instruction                                                | Card/detail previously exposed inspection report only                                                                                           | Implemented and verified         | Completed; Text/icon card note and full summary disclosure added                                    | Populated catalogue and detail, mobile and keyboard                                        |
| Unknown price/mileage/specs                          | Pasted BMW instruction                                                | Nullable stock specs, positive mandatory listing price                                                                                          | Implemented and verified         | Completed; Preserve unknowns; no price in BMW preparation                                           | Null versus actual zero tests; no fabricated asking price                                  |
| Real photos and private originals                    | Pasted photo instruction                                              | Managed STOCK upload checks signature/hash/decoding/size, strips metadata, authenticated previews; public bytes require available active branch | Blocked by a specific dependency | Prepared private plate-masked derivatives; upload awaits actual stock record                        | Visual masks/warnings, secure media integration tests                                      |
| Gallery cover/order/alt/failure                      | Pasted photo instruction                                              | Existing image CAS, primary selection/order, protected previews, public gallery fallback                                                        | Implemented and verified         | Completed; Preserve; card now uses supplied view alt                                                | Upload/reorder/replacement/failed image and gallery interaction tests                      |
| Draft preview                                        | Pasted authoring instruction                                          | Saved listing text and protected stock gallery existed                                                                                          | Implemented and verified         | Completed; Added explicit saved-content preview with cover/specs/disclosures                        | Authenticated staff preview; no public draft route                                         |
| Publication readiness                                | Pasted authoring instruction; recommendation to align media invariant | Positive price and lifecycle existed; no photo check on publish                                                                                 | Implemented and verified         | Completed; Fixed active-branch/positive-price/photo gate, vehicle-before-listing lock order         | No-photo/inactive/stale rejected; last-photo race cannot leave published row without image |
| Permissions, branch scope, workforce boundary        | Pasted authoring instruction                                          | Existing MFA/CSRF/role/assigned active branch and managed-workforce boundary                                                                    | Implemented and verified         | Completed; Verified, no privileges granted or new responsibility templates                          | Anonymous/customer/foreign branch denial; existing workforce boundary regression           |
| Customer saved vehicles and inspection requests      | Pasted journey instruction                                            | Account-owned saves, current availability checks, request idempotency and expiry                                                                | Implemented and verified         | Completed; Verified preserved flows; gated actions stay gated                                       | Existing sales, saved-vehicle and idempotency suites                                       |
| Listing-specific and listing-less enquiries          | Pasted journey instruction                                            | Existing vehicle enquiry intents, Customer Care persistence/routing/reference and request recovery                                              | Implemented and verified         | Completed; Verified existing complete flow, no second inbox                                         | Persistence, branch routing, changed replay conflict, uncertain retry                      |
| Loading/error/empty/no-match/mobile                  | Pasted journey instruction                                            | Existing public discovery state components and exact totals                                                                                     | Implemented and verified         | Completed; Render regression checks with populated/empty/failure fixtures                           | Desktop/tablet/phone, missing images, keyboard and console                                 |
| Homepage naturally displays eligible records         | Pasted brand instruction                                              | HomeVehiclesPreview uses actual published API, no embedded BMW                                                                                  | Implemented and verified         | Completed; Verified empty and populated response; reused card shows disclosure                      | No hardcoded/featured BMW or fake stock                                                    |
| Black/red/white with factual car colours             | Pasted brand instruction                                              | Existing neutral gallery and public identity                                                                                                    | Implemented and verified         | Completed; Retain palette; add readable amber semantic disclosure with icon/text                    | Responsive screenshots and contrast/accessibility review                                   |
| Help/Learn guidance and permissions                  | AGENTS; recommendation                                                | Backend-owned public vehicle-enquiry article, current eligibility                                                                               | Implemented and verified         | Completed; Article revision 3 explains owner-versus-inspection/known issues                         | Eligibility unchanged, versioned content tests                                             |
| Payments/reservations/delivery/finance               | Release safeguards, not requested in DOCX                             | Existing restricted production flags and policy                                                                                                 | Implemented and verified         | Completed; No activation or scope expansion                                                         | Source diff and environment flag review; no test transaction in production                 |

## BMW: supplied, observed and missing

Owner supplied: BMW 120i, 2007, 2,000 cc, four cylinders, N46, compact five-door
hatchback, rear-wheel drive. The owner describes the engine, transmission, interior
and exterior as excellent. This is an attributed statement, not an Allied inspection.
Known issue: **AC not working. Owner reports a leak. Diagnosis and repair required.**

Proposed title: **2007 BMW 120i — 2.0L, 5-door hatchback**.

Proposed description:

> 2007 BMW 120i compact five-door hatchback with a 2.0-litre four-cylinder N46
> engine and rear-wheel drive. The owner describes the engine, transmission,
> interior and exterior as being in excellent condition.
>
> Known issue: the air conditioning is currently not working. The owner reports a
> leak; diagnosis and repair are required.

Verified in this cycle: file signatures, dimensions, hashes, visual views and
apparent photographic continuity. Mechanical condition, exact vehicle identity,
current dashboard state and owner specifications have not been independently
inspected. Image 01 visibly includes warning indicators and an odometer display;
neither its reading nor its displayed unit is imported as mileage. Ask the owner
to explain/currently verify the warning indicators; do not diagnose them from a photo.

Missing: actual branch/location, asking price/currency confirmation, negotiability,
mileage and units, transmission, fuel, colours, origin/import/registration status,
ownership, accident/service history, warranty, inspection/certification, repair
diagnosis/cost/completion, actual availability and finance eligibility. The form's
existing generic USED default is an authoring default, not a supplied origin fact;
the operator must explicitly review classification before saving. No fields have
been filled from the DOCX's generic examples or visual guesses.

Status: **private validated stock preparation; no production stock/listing ID**.
`backend/data/vehicle-drafts/bmw-120i-2007.json` carries stable proposed stock identity
`OWNER-BMW120I-2007-01`, known specifications and attributed notes only. It cannot
carry price, branch or a publication command. Import it in Add vehicle record after
choosing the genuine branch, review the condition classification, then use the
existing save/reconciliation workflow. Search the stock number first to resume an
existing record. The unique backend stock constraint prevents a duplicate on replay.
Never auto-create a second stock number to work around a conflict.

The sale-listing workflow still requires a genuine positive price; this preparation
does not invent one or relax pricing rules. After stock exists, upload the prepared
photos using Vehicle photos, review the cover/order/alt, create a priced DRAFT
listing with the proposed title/description, inspect the saved-content preview and
publish only after the missing publication information has been reviewed.

## Photograph inventory and delivery

All 14 files are JPEG; 13 are 1000×750 and image 06 is 750×1000. No exact checksum
duplicates or EXIF/GPS keys were found. Visual near-duplicates are noted below.
All appear to show the same BMW; background vehicles are not separate listings.
The original ZIP and original extracted JPEGs are outside Git/public assets.

| Image | View                                     | Decision                                                   |
| ----- | ---------------------------------------- | ---------------------------------------------------------- |
| 01    | Dashboard warning/odometer close-up      | Gallery 6; preserve warning indicators; reading unverified |
| 02    | Cabin from rear                          | Omit; overlaps cabin coverage                              |
| 03    | Driver doorway/front cabin               | Omit; near-duplicate of 04                                 |
| 04    | Front cabin from driver doorway          | Gallery 3                                                  |
| 05    | Engine bay/bonnet open                   | Gallery 7; preserve dirt and wear                          |
| 06    | Front, doors open, portrait              | Omit; visible plate, stronger cover exists                 |
| 07    | Front three-quarter close                | Omit; overlaps cover, partial plate                        |
| 08    | Alternate front angle                    | Omit; tilted framing and visible plate                     |
| 09    | Rear seats                               | Gallery 4                                                  |
| 10    | Rear three-quarter                       | Gallery 2; opaque plate mask on derivative                 |
| 11    | Driver door panel                        | Omit; identifiable bystanders and redundant view           |
| 12    | Dashboard/front cabin                    | Gallery 5                                                  |
| 13    | Closed-door front three-quarter exterior | Gallery 1/cover; opaque plate mask on derivative           |
| 14    | Alternate rear three-quarter             | Omit; overlaps 10, partial plate                           |

No boot view, straight side profiles or dedicated AC diagnostic evidence was
supplied. Those views are not fabricated. Current exterior framing is slightly
tilted; photos remain factual, with neutral framing in the application.

`bmw-photo-review.json` records all hashes, dimensions, selection reasons and the
reviewed plate polygons. `scripts/prepare-bmw-photo-draft.ts` refuses changed source
hashes and output inside the repository, produces private 1000px WebP plus 640/320px
derivatives, strips metadata, and creates a cover/order/alt manifest. It performs no
upload or database write. Server STOCK upload performs its normal independent
signature/checksum/decoding validation, sanitisation and access enforcement.
Only plate pixels in 10/13 are masked. Vehicle colour, wear and warnings are retained.

## Changes and migration

Forward migration `20261028180000_vehicle_owner_disclosures` adds nullable engine
code, cylinders and owner condition/issues to the existing Vehicle model; extends
BodyType with CROSSOVER/MINIVAN and constrains cylinders to 1–24 when known.
Existing rows remain null; no backfill or applied migration was changed.
Canonical schemas/OpenAPI/generated frontend types, public/staff projections,
shared forms, card/detail display, staff preview, location discovery and audit were
updated together. Owner corrections retain actor-attributed full old/new notes in
the existing audit log and use Vehicle.version. Inspection reports remain separate.

Managed staff titles still do not open broad legacy inventory endpoints; the
existing workforce boundary remains authoritative. No responsibility, owner grant,
role, branch assignment or feature flag was changed by this cycle.

## Verification and release

Frontend focused unit checks pass (66 cases). Local backend typecheck, script typecheck, lint, OpenAPI validation (385 paths)
and secret guard passed. A fresh isolated database at 127.0.0.1:63888 replayed
all forward migrations and passed db:check with no schema difference. Restricted
runtime verification passed 78 distinct checks across the existing vehicle/media/
enquiry journeys, new disclosure/audit/publication/media-race case, workforce
boundaries and guidance. Test records are synthetic and isolated; no real
availability or communications were changed. An initial old fixture published
before attaching a photo; its setup now uploads first. A new session fixture was
corrected to respect the existing MFA timestamp constraint.

Mocked Edge rendered tests passed at 320/390/768/1440px using the actual prepared
photos, covering cards, city/state controls, unknown specs, enquiry context,
gallery interaction, empty catalogue, missing image fallback, no overflow and
WCAG Axe checks. The Any used refinement and populated-to-empty homepage transitions also passed.
Three staff-fixture cases passed for draft import/review/save,
private preview/photo URL and correction at 390/1440px. Known browser-plugin
capabilities do not include rendered-app automation in this session, so the
installed Playwright/Edge fallback was used. Screenshots and traces remain private
under %TEMP%/aat-owner-vehicle-public-final and aat-owner-vehicle-authoring-final-v2.
These are mocked account/API tests, separate from the real isolated persistence checks.

Rendered defects repaired during the cycle: early search/filter interaction before
hydration, owner-note contrast inherited from the dark summary, duplicate named
landmarks in a staff record plus listing preview. Vehicle decorative navy surfaces
were neutralised; actual vehicle colours, wear and warning symbols were retained.
The Any used group selects all three recorded use origins and allows refinement.

Final exact-source CI, current-provider reconciliation, backup/restore and production
rollout are pending. Physical-device, real-role, screen-reader and independent BMW
inspection acceptance is not established by these fixtures.

Three pre-existing backend format failures in document-snapshot.ts, the booking
browser helper and public-cutover.test.mjs were normalised without behaviour changes
so the repository format gate can pass. No billing, booking or cutover logic changed.
