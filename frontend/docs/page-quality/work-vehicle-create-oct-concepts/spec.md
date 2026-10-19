# Vehicle creation specification

Fresh built-in Image Gen desktop/mobile concepts were inspected before UI edits.
They establish a compact header, four numbered form groups and an after-save rail.
Preserve the actual Allied shell and Quicksand dashboard typography. Native desktop
is 1487x1058 and mobile 882x1783; verify those PNG dimensions during final capture.

- Header: Overview / Vehicle stock / Add vehicle record. Add vehicle record.
  Record the vehicle first. Photos and sale listings follow. Back to vehicle stock.
- Four groups: Vehicle identity; Specifications; Identifiers; Acquisition.
  Preserve every existing field, label, optional marker, maximum length, numeric
  limit and enum. Identity includes active Workshop branch, Stock number, Make,
  Model, Model year, Trim (optional), Condition. Stock numbers are unique.
- Specification fields are Mileage (optional, km), Transmission (optional), Fuel
  type (optional), Body type (optional), Drive type (optional), Engine size
  (optional), Colour (optional), Doors (optional), Seats (optional). Identifiers
  preserve VIN, Chassis number and Registration number optional fields.
- Acquisition keeps Acquisition cost (optional, NGN) for Admin/Super Admin only;
  Acquired at (optional, Lagos time) remains available to Staff. Staff never send
  acquisition cost/currency, including null. Empty optionals stay null; zero
  mileage is explicit. Make/model/year/trim/engine/colour/doors/seats remain text
  controls; generated dropdown facets are not invented.
- Reuse recordSchema, vehicleDefaults, vehicleRecordBody, own profile, useResource,
  AdminBranchPicker and MutationReview. Preserve VehicleRecordForm's edit export
  and existing detail consumers. Creation can have its own composed component.
- Desktop form uses a two-column grid and distinct white 12px grouped panels;
  aside is a compact ~250px rail: After you save; Save stock record; Add photos and
  choose a primary image; Create a sale listing. Saving a stock record does not
  publish a sale listing. On narrow screens guidance moves above the form; fields
  stack below 600px and all groups continue in ordinary page flow.
- Use #f4f6f8 canvas, #01121a text, #50616c secondary copy, #dce2e6 panel borders,
  darker control borders, brand red action and darker red focus/halo. Headings
  28/24px, group headings 16px, body/labels/controls 13px, inputs/buttons >=44px,
  8px control corners. Existing outline CarFront/Image/Tag/Arrow icons only. No
  hero, metric, upload control, made-up branch or production photography.
- Initial/current own identity, active permitted role and Staff branch must be
  verified before creating. Backend independently enforces MFA/active branch and
  acquisition privacy. Refresh profile/branch eligibility again before POST.
- Review all permitted submitted values, full branch identity and exact amounts
  and Lagos acquisition time. A valid full created record must match the reviewed
  request and role projection before navigation to its existing photo editor.
- Persist a minimal actor-scoped pending marker before sending. Uncertain saves,
  invalid success responses, 408/429 and reload never automatically resend. Offer
  stock-list reconciliation and an explicit acknowledged new draft; do not claim
  an observed matching stock record proves the original request outcome. Storage
  failure blocks sending. Definite first rejections may release only their own
  marker. Account changes redact pending metadata while preserving a lock.
- Form drafts use the existing actor/path-scoped mechanism. Confirmed success
  clears the submitted draft; reconciliation/new-draft actions must not silently
  overwrite later edits or move a Staff draft to a different assignment.
- Verify initial/profile/branch loading and error, empty branches, roles and Staff
  reassignment, required/invalid fields, all enum/optional/zero/maximum values,
  complete review/cancel/double click, exact one-write/audit and photo navigation,
  conflicts, stale permissions/branch, uncertain response/reload/manual recovery,
  storage/session failures, responsive/keyboard/Axe/long content and named stock
  navigation. Compare concept and final native/practical renders together; save
  copy differences and at least five fidelity points.
