# Branches — completed local gate

Started and locally accepted19 October2026. The existing `/admin/branches` route now has a dedicated workspace. Accepted total is91. See the [final acceptance report](work-branches.md).

Audit of current UI/API/validation/permissions is complete. Four baseline widths430/768/1280/1440 were captured and inspected; page overflow/errors were absent, but the mobile table clips the action column internally. Fresh desktop/mobile concepts, native inspection and implementation corrections precede runtime edits. See the [audit and specification](work-branches-oct-concepts/audit.md).

The dedicated list/editor and compatible backend search/revision/private-response changes are implemented. Development checks cover seven responsive widths, selection/history, search/status/paging, reviewed creation/update, stale actor/target, rejected deactivation, lost/malformed responses, unavailable storage, exact-code creation recovery and temporary/denied reads. Six unit cases pass.

Four focused isolated API cases now have passing evidence: search/scope/DTO and revision/concurrency passed initially; corrected public-route and validation-status test assumptions passed in a two-case continuation using the retained fixtures. Original55 users and33 branches, their customer/staff profiles, invitations, outbox, capabilities and workforce records were hash-unchanged. Only new synthetic branches/accounts were changed; temporary sessions were removed. No schema/migration change ran.

Final native production captures430/768/1280/1440 show no page overflow or browser errors. Production build, all20 browser scenarios, six units, connected five-write verification and eight matching source hashes pass. Connected hashes preserve all original records, and the owned temporary session was removed. Audit logs are next; the full goal remains active.
