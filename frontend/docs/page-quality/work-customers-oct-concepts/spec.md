# Customer directory specification, gate 74

One breadcrumb and compact Customers header with Refresh customers. A grouped filter
panel holds search/by/status/email verification/sort and Search/Clear actions. Labels
explain prefix matching; UUID search uses a complete profile reference. All supported
state persists in URL through cursor/reload/Back; changed filters restart the cursor.
Reject unknown/duplicate/invalid query values before collection reads. Limit stays25.
Cursor is opaque base64url, max1024; do not treat it as a UUID. Show page-local count,
never total customers/pages. Trim/collapse search whitespace consistently with API.

Admin/Super Admin active own-profile identity gates reads; Staff/Customer see no
directory data or controls. Strict complete row/status/date/unique-ID parsing, <=25
rows and valid opaque next cursor prevent malformed snapshots. Denied reads clear
facts. Temporary refresh failures retain labelled old facts with paging disabled.
Loading, initial error, empty and filtered-empty remain distinct. Current profile
refresh must not repeat on search keystrokes. No domain mutations.

Desktop customer records group name/profile reference, email/phone, status, independent
email/phone verification and precise registered date. A real full-name detail link
replaces generic View. Initials are decorative and hidden from screen readers. Narrow
records reflow into complete labelled groups, preserving long values and full UUIDs.
Keep existing optional column-resize patterns only if applicable; cards require none.

Quicksand 30/24px headings,16px panel titles,13px body/labels,>=44px controls, white
12px panels on cool canvas with restrained red actions/focus. Keep actual Allied
shell and route links; no hero, fake metrics/charts/portraits, messaging or edit actions.
Fresh desktop/mobile Image Gen concepts must be inspected before UI edits. Verify
focused browser/unit/API cases, connected read-only real API/database workflow and
privacy audit counts, seven widths/Axe/native fidelity and >=5 copy/fidelity points.
Reuse accepted DB safety/build environment; no schema/grant/migration change expected.
