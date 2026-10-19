# Vehicle stock index specification

Fresh built-in Image Gen desktop/mobile references were inspected before UI edits.
They show a compact operational stock table, thumbnail identity, grouped filters
and complete stacked records on mobile. Runtime UI must remain code-native and use
actual permitted stock images through the existing PublicMedia stock-preview path.

- Preserve the actual Allied authenticated shell, full navigation, account/search
  controls and cool-grey #f4f6f8 canvas. Generated abbreviated nav/branding/search
  placeholders are illustrative. Quicksand is the dashboard font.
- Allowed header copy: Overview / Vehicle stock; Vehicle stock; Review stock records
  and sale listings in your permitted branches.; Refresh vehicle stock; Add vehicle
  record. Creation and detail routes remain separate gates; index controls navigate
  to them and do not introduce inline writes, bulk actions or financial controls.
- Filter copy: Search stock records (Stock number, make, model or VIN); Listing
  status filter; All records, including unlisted; Listed records; Unlisted records;
  existing Draft/Available/Reserved/Sold/Inactive/Archived states; Branch filter;
  All branches; Exact make; Exact model; Model year filter; Apply stock filters;
  Clear stock filters. Make/model/year remain labelled text inputs, preserving the
  existing supported contract; generated dropdown facets are not invented.
- Admin/Super Admin may filter historical/inactive branches with AdminBranchPicker.
  Staff see their assigned branch scope without a cross-branch selector. Check the
  current active profile/identity before stock requests; require assigned branch
  for Staff and independently retain backend active-branch/MFA policy.
- Desktop uses a two-row white filter surface. Mobile uses one Filters disclosure
  (Search, listing status and branch); keep the full form mounted, accessible only
  when expanded. Applied filters and cursor history live in the URL; editing fields
  does not fetch until Apply. Applying/clearing filters resets cursor paging.
- Guidance: Stock records and sale listings are separate. Unlisted records have no
  sale listing. Show known page count and Page N only; generated Page 1 of 1/global
  totals are replaced by actual cursor information. Previous/Next are labelled and
  disabled while unavailable, loading or stale.
- Three table meanings: Vehicle, Branch, Sale listings. Vehicle identity includes
  a modest 88x64 thumbnail/fallback, one named management link, full stock number,
  recorded trim, condition, mileage and transmission. Branch includes actual name,
  code and inactive label where true. Each stored listing keeps its full title,
  neutral status and exact asking price. No internal acquisition costs are shown.
  Multiple historical/current listings remain distinct; a status filter matches a
  record containing that status and does not hide its other listing facts.
- No listing: Not listed; This stock record has no sale listing. No photo: use the
  existing protected/allowlisted media fallback with a car glyph and readable Image
  unavailable text. Never fabricate vehicle photos, prices, statuses or availability.
  Managed thumbnails must stay scoped to their vehicle/image IDs.
- Desktop rows use white surfaces/rules; mobile reflows the same semantic table to
  complete labelled records, without horizontal scrolling, hidden prices/codes or
  duplicated prominent status/price blocks. Neutral configuration/status styles
  replace generated green/amber availability pills; no live availability promise.
- Tokens: white surfaces, ink #01121A text/navigation, muted #50616c, borders #8998a3
  for controls/#dce2e6 for surfaces, brand red #e60301 action/focus accent. Heading
  24-28px, row identity 14px, body/labels/controls 13px; 44px inputs/buttons, 8px
  control corners, 12px panels, subtle shadows. No hero, charts or decorative metrics.
- Icons: existing shell family plus ChevronRight breadcrumb/paging, RefreshCw,
  Plus, Filter, CarFront fallback and ArrowLeft/ArrowRight paging. Outline 1.75-2px
  at 16-20px, larger fallback only where it fits the thumbnail. No invented logo.
- Reuse account session/own staff permissions, useResource, AdminBranchPicker,
  PublicMedia, exact money formatting and existing listing enums. Read-only stock
  response validation checks identity/branch consistency, duplicate records,
  statuses/prices, images and Staff acquisition-field omission. Reject invalid or
  repeated query fields before fetching. Backend search matching remains authoritative
  for Unicode/collation; validate stable branch/year/listing facts locally.
- Existing backend search needs literal wildcard escaping. Additive listed=true/
  false filtering distinguishes stock records from sale listings; listed=false and
  status are contradictory. No migration or permission expansion is required.
  Inherited public price/specification/sort parameters are outside this UI's supported
  filter set and remain an explicit backend contract follow-up, never fake controls.
- Required states: loading, empty, filtered empty, initial error/retry, temporary
  stale facts with navigation blocked, denied cache removal, invalid/mismatched or
  duplicate data, branch/profile changes, protected/failing/no images, multiple
  listings, inactive history, unlisted/zero-mileage records, large prices, long
  names/codes/titles, URL reload/back and both administrator/Staff scopes.
- Verify 320/375/430/768/1024/1440/1920px plus concept-native sizes. Compare saved
  concepts and final renders together through view_image; record at least five
  fidelity points, exact copy differences and computed type/control metrics.

Final QA disposition: preserve the existing pale semantic row-header identity surface within white records. Native generated-mobile width retains the real desktop shell; 430px/320px captures verify the actual mobile shell. Focus uses a darker red outline and halo while the input border retains its normal colour. These inspected adjustments preserve the existing dashboard theme and accessibly distinguish identity/focus without altering facts.
