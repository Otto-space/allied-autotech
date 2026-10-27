# Workforce jobs queue — pre-implementation specification, milestone 104

Route `/admin/workforce/jobs`. Milestone 103 overview is accepted. This milestone concerns the queue; the job detail's visual redesign follows separately. Its existing Back to jobs link may preserve the queue query to support the current list/detail/Back flow.

## Audit and baseline

Four native baselines at 430, 768, 1280 and 1440px were captured and inspected before runtime changes. Existing queue: sparse repeated cards, raw uppercase states, omitted vehicle information, no backend search/filter, no previous-page navigation, local-only cursor, no authoritative own-access response and retained values after background failure. Preserve the existing job-detail link, permission gates and UUID record ordering. The first baseline fixture lacked the mandatory API envelope metadata; that harness error was corrected before capture. All four resulting baselines have no overflow/runtime errors.

`GET /staff/workforce/jobs` requires live JOBS_READ; workshop leads see assigned branches, technicians only their assigned records within those branches. Current scope, actor/MFA and workforce locks are checked on every request. The existing projection includes service, vehicle, booking status, work order and scheduled date. Booking and work-order state are distinct. Cursor/limit are supported; search/status are not yet supported. Backend additions are authorized by the user's request to integrate gaps limiting the frontend.

## Concepts and locked design

Fresh built-in Image Gen desktop and mobile concepts are stored beside this document. The initial desktop had an unwanted eyebrow and purple badge; a new edited concept removed both before implementation. Use the accepted second desktop and fresh mobile images. They define the full header, filters, job list and pagination, not just a hero.

Keep the actual Allied shell/logo/navigation/search. Quicksand throughout, 28px desktop/24px mobile heading, 19px section heading, 14px body, 13px support, visible 1px neutral borders, 6px radius, cool gray canvas, ink text, restrained brand red Apply filters/focus. In-progress/quality states use cool neutral badges, awaiting parts warm, completed muted green, cancelled restrained red. Labels always communicate state independently of color. No imagery, KPI totals, create/export/bulk controls or customer contact data.

Breadcrumb Overview / Workshop jobs. Title Workshop jobs; subtitle Review permitted jobs, vehicle details and work progress. Refresh jobs aligned right on desktop with actual generatedAt formatted in Lagos time. Below 760px refresh follows the heading rather than reproducing the generated mobile image's infeasible side-by-side heading. All controls at least 44px.

One white filter region: Search jobs labeled input, placeholder Work order, service or vehicle; Work status select, default All work states; Apply filters and Clear filters controls. Helper Search covers all jobs in your current scope. Input/selection rows stack below 1100px; mobile buttons wrap. Applying requires explicit submission; no request per keystroke. Preserve entered drafts during background updates.

One white Jobs panel, count strictly N on this page. Desktop columns Job, Vehicle, Scheduled, Status. Job contains an ink underlined work-order link and service below; missing order says Work order pending and still opens the job. Vehicle displays make/model/year and registration, with accurate missing labels. Scheduled uses full Lagos date/time. Status shows work state and separately Booking: [booking state]. Tablet/narrow widths below 1000px use labeled stacked semantic rows without horizontal scroll. No truncation of important names. Render every returned row, not just the concepts' representative rows. Use actual Quicksand, ink links and named pagination controls rather than the mobile generation's blue links/icon-only footer.

Footer: Open a job to review its details and permitted actions. First page, Previous page and Next jobs controls preserve applied filters. A bounded URL cursor trail enables previous navigation; direct cursor links without a trail still permit First page. Browser Back, reload and job-detail return retain the applied query. Do not claim a total count or sort by time: preserve current stable UUID order.

## Backend/client contract and states

Extend only the jobs query with optional trimmed q (max120 characters) and workStatus (seven existing work-order statuses plus NOT_CREATED). Search work-order number, service name, vehicle make/model/registration case-insensitively with literal wildcard handling. Combine filters with the existing authorized booking scope and cursor; leave bookings and other queues' query contracts unchanged. Add generatedAt and own access snapshot to the jobs page. Preserve projection, private/no-store, minimal READ audits, existing endpoint and schema. No migration or new permission.

The client validates the query before requesting, strips the UI-only trail from the API request, verifies response identity/scope against the shell, and hides records on foreground/background loading/failure/mismatch. Unknown/duplicate URL fields, unsupported work status and malformed cursors give a clear reset state. Empty permitted scope differs from no filter matches. Personal shell access remains. Refresh rechecks access and jobs. Do not add mutations on this page.

## Required acceptance

Seven widths/Axe/native concept comparison, long data and missing fields, all work states, all three permitted templates and forbidden roles, search and combined filters, literal wildcard behavior, paging with reload/Back/detail-return, zero/loading/denied/failure/background/malformed data, scope mismatch/revocation/expiry, keyboard controls, no runtime errors, existing overview/queue/detail/notification regressions, focused units/API/connected reads, original test-data hashes and temporary-session cleanup, generated OpenAPI/types, type/lint/build and exact runtime hashes. No acceptance until these are evidenced. Deployed checks remain separate.
