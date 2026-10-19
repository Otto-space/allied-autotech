# Staff support list audit, gate 76

Route `/admin/support`; conversations are a separate page gate. Existing staff
enquiry/complaint collections are read-only here. Status, enquiry type or complaint
priority, branch (administrator) and assignee filters are supported, with bounded
UUID cursor paging. Staff scope comes from the current branch; Admin/Super Admin
can select historical inactive branches. StaffPicker offers ordinary Staff their own
profile; administrators use the private directory. Reads create privacy audits.
No free-text search, aggregate queue counts, live-chat promise or list mutation exists.

Current presentation repeats generic headings/lead copy, uses a category select
above disconnected filter/actions, and shows sparse cards missing full references,
versions, contact, assignment and precise lifecycle/deadline dates. Filters/category/
cursor are memory-only and change requests fire immediately. Active own-profile
identity should gate collection reads. Strict unique/bounded pages, branch/filter
scope and consistent assignment projections must fail closed. Temporary refresh
failures should label preserved records and block paging; denial clears contacts.

Reuse accepted workshop list/panel theme, active profile gate, URL cursor helpers,
branch/staff pickers and precise date formatting. Keep picker failures independent
of read-only queue availability; do not erase a saved filter merely because its
selected staff is off-page. Subject links lead to actual conversation routes.
Preview text is labelled and abbreviated; full text remains in the conversation.
Complaint acknowledgement/escalation dates are recorded facts, not invented SLA
guarantees or live-agent availability. No backend schema change is expected.
