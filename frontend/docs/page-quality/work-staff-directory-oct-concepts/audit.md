# Staff directory — gate 88 audit

Four production baselines at430/768/1280/1440 were captured and natively inspected. Oversized filter padding and stacked account sections hide the first records below most of the mobile viewport and limit desktop comparison to about two records. Filter and cursor state is local, so reload and browser navigation lose the view. Name/email search is absent. The list exposes friendly account identity but does not distinguish verification, job title or self/protected accounts in its summary.

Existing API GET /admin/staff supports role, status, branch and UUID cursor/limit, orders by id ascending, returns a safe staff/profile/branch projection and atomically audits successful reads. Admin and Super Admin can read all privileged roles. Account mutation permissions are narrower and belong to the separate detail page. Invitations/promotions have an existing separate route. Do not invent a direct create-user, export, bulk change, sort, workforce-duty or suspension action.

Add bounded literal case-insensitive name/email search to the existing audited query and document the actual response. Send private/no-store. Preserve all existing authorization, mutations and database data. Frontend should verify current own profile before privileged requests, retain URL filters/cursor trail and clear privileged records on denial. No schema migration is needed.
