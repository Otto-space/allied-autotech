# Managed-workforce bookings discovery

Milestone 106, 19 October 2026. The existing `GET /staff/workforce/bookings` now supports the dedicated read-only bookings workspace. Deploy the compatible backend and generated OpenAPI contract with its dependent frontend. Whole-application and deployed acceptance remain separate.

## Contract

- Existing `limit` (default 25, 1–50) and UUID cursor retain ascending-ID pagination.
- Optional `q` trims whitespace, accepts up to 120 characters, rejects control characters and searches literal case-insensitive substrings. All whitespace-separated terms must match a service name, customer first/last name/phone, or vehicle make/model/registration. Percent, underscore and backslash are escaped before database matching.
- Optional `status` accepts only REQUESTED, AWAITING_DEPOSIT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW or EXPIRED. Search, status, cursor and authorization scope compose together. Unknown or duplicated query parameters are rejected by existing strict validation.
- Existing row fields remain. Add minimal `branchId`, `branch: {id,name} | null`, and `vehicle: {make,model,year,registrationNumber} | null`. Add response `access` and `generatedAt` for current scope verification. No prices, deposits, customer identifiers, private notes or technical work-order fields enter this projection.
- The UI requests 25 records, validates row references, uniqueness, cursor metadata and eligible active branch assignments, and compares the response identity/scope with the shell. Pending, failed or mismatched refreshes hide retained customer facts.

## Authorization and audit

Active managed Operations and Customer Service assignments carry BOOKINGS_READ. Authentication/MFA, current actor/workforce checks, responsibility expiry and branch scope remain authoritative on the server. The separate bookings read method preserves the technical-jobs implementation and all unrelated queues. Reads use private no-store responses and an atomic BOOKING READ audit with action BOOKINGS_LIST and bounded result count. Search text and customer contact values are not added to that audit metadata.

No managed booking mutation or compatible detail endpoint exists. The page has no edit, assignment, payment or legacy detail shortcuts. A future operational action needs an explicit permission, state/version contract and its own acceptance gate.

## Verification and data preservation

Four integration scenarios have passing evidence: exact projections for both eligible roles; complete scoped paging and combined literal search/status; rejected roles/inactive accounts/anonymous callers; malformed/unsupported queries. Initial execution passed three scenarios; the denial test incorrectly expected 403 for a suspended account. Existing authentication correctly returns 401. Only that test was corrected and rerun. Initial evidence records 14 reads/14 audits; denial rerun records zero reads/audits. Both preserve original hashes and leave zero owned temporary sessions.

Connected production Edge/Express/PostgreSQL verifies Operations at 1440px and Customer Service at 430px. Each sees 33 permitted records through 25+8 paging, reload, Previous/Back/First, combined registration/status filtering, empty results, Clear and Refresh. A revoked technician makes no bookings request. Twenty collection reads produce twenty READ audits, with no domain mutation. Hashes across 18 original domain tables remain unchanged and all three temporary sessions are removed. Fixture financial transaction tables are empty; this is not new populated-financial-record preservation evidence.

Before session writes, both runners verify the actual isolated target `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test` and a role without elevated privileges, database/table ownership or TRUNCATE. Existing synthetic fixtures were reused; no new booking/customer data was needed. Prior unchanged migration replay/db:check evidence is reused; no schema/migration, application/shared database, existing-grant, backup/restore, provider activation, push or deployment operation ran. No new recoverability claim is made.

Evidence retained outside the repository: `C:/Users/PC/.codex/workforce-bookings-api-evidence.json`, `workforce-bookings-api-denials-evidence.json`, associated logs, and `workforce-bookings-real.json`. The page gate and remaining browser/rollout limitations are recorded in the frontend quality documentation.
