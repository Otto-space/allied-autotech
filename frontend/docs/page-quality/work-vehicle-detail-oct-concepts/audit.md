# Vehicle detail source audit

Preparation for the separate vehicle-detail gate after milestone 69. This is not
an acceptance report and no detail UI has been redesigned yet.

Sources inspected: `app/admin/vehicles/[vehicleId]/page.tsx`,
`app/components/staff-vehicle-detail.tsx`, `vehicle-record-form.tsx`,
`lib/forms/vehicle-record.ts` and the existing vehicle service policies referenced
by the accepted stock/creation contracts.

The UUID server route guard is already present. The current client detail uses a
generic title, a small partial fact list, repeated nested sections/details and
several mutation surfaces: vehicle specifications, listing creation/content/price/
status, protected photos, documents and condition reports. Preserve these existing
routes, exports, independent versions, photo-editor hash focus and public links.
The separate listing and creation pages have already passed their own gates.

The next audit/implementation must:

- Add a named breadcrumb/header and complete grouped record facts with exact
  optional/zero values and role-appropriate acquisition information.
- Gate reads on current permitted identity and Staff assignment, validate the
  requested record identity and reject unexpected Staff acquisition projections.
  Reuse the accepted stock validation where suitable; administrator detail must
  still require its full acquisition projection. Inspect mutation policies for
  inactive historical branches rather than inferring them from creation rules.
- Reuse shared form/branch/media/review infrastructure and preserve existing
  photo, listing, document and condition workflows while applying the detail theme.
- Make reviewed specification edits complete and fresh, retaining expectedVersion
  and the user's draft on conflict. Existing edit review lists only a partial
  summary. Validate saved results and prevent an older read replacing a newer
  confirmed version.
- Preserve acquisition timestamp precision. Current vehicleDefaults reduces an
  existing timestamp to minutes and vehicleRecordBody reconstructs :00 seconds;
  an unrelated specification edit can therefore replace recorded seconds and
  milliseconds. Use compatible partial updates or explicitly retain unchanged
  saved timestamps, with a focused regression proving preservation.
- Audit uncertain writes/reload reconciliation for each mutation domain. Existing
  memory-only flags must not permit an automatic replay after reload. Reads that
  observe a changed record must not claim a proven original request outcome.
- Handle initial/temporary/denied/not-found reads, branch/session changes and
  metadata/image failures honestly. Keep direct protected assets and all record
  identifiers/versions available where operationally meaningful.
- Generate fresh desktop/mobile concepts and inspect/save the concrete spec before
  detail UI edits, then run affected detail/media/listing/form checks and real API
  acceptance. Reuse unchanged stock/creation and database-safety evidence.
