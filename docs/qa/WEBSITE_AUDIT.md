# Website audit (in progress)

Audit baseline: 23 October 2026. Source: `098b580c` in `allied-email-evidence-20261023`; production frontend deployment `dpl_GaG2tZE9e7YbQ1U2pSq7LnHGxUcS` was READY when checked. This is a staged audit record, not full release approval. No production state-changing actions were taken.

## Inspected

- Anonymous browser: `/`, `/services`, `/parts`, `/vehicles`, `/about`, `/help`, `/contact`, `/login` and `/shop` at 320px; `/help` also at 1440px. The tested pages rendered headings and had no horizontal document overflow. `/shop` redirected to `/parts`.
- Help search for `refund` returned one relevant topic. The Help → customer-care sign-in link opened `/login?next=%2Fdashboard%2Fsupport` without an “enable JavaScript” error.
- Read-only live API: `/api/v1/health/live` and `/api/v1/health/ready` returned 200; anonymous session, customer-payment and staff-payment endpoints returned 401.
- Source: refund replay and decision paths, authentication/CSRF/role middleware, payment reconciliation worker, and relevant API and unit tests.
- Local browser fixtures: repaired stale header-session button/MFA expectations; five sign-in/MFA cases and two Help search cases passed against the local Next.js server.
- Published service detail: followed Tyre Change from `/services` at 390px. The quotation enquiry exposes review-before-send, branch selection, optional preferred time and explicit staff confirmation wording. Its generic preparation list asked about warning lights; updated that list to request vehicle details, needed work/symptoms and relevant service history.
- Responsive sweep: the eight core public routes listed above and the published Tyre Change detail were checked at 320, 360, 390, 414, 768, 1024, 1280, 1440 and 1920px (81 route/width combinations); each had a main H1 and no horizontal document overflow. This was a rendering smoke check, not interactive or screenshot review at every width.
- Notification source review: the active customer and staff notification pages use `AccountNotifications`, which renders an authorized resource link when a valid target exists. `DashboardNavigation` consumes unread counts for sidebar badges/dots. The older `NotificationsPanel` component is not the page entrypoint. Ten targeted notification unit tests passed; live authenticated delivery remains unverified.
- Isolated refund verification: a third new `_test` PostgreSQL database replayed all 62 migrations with no schema difference, then four refund suites passed 49 tests. Payment concurrency and reconciliation verification remain open as detailed in the test results.

## Scope limits

No authenticated QA credentials were available in `AAT_QA_EMAIL`/`AAT_QA_PASSWORD`; customer, staff, admin and super-admin live journeys remain untested in this pass. Isolated refund suites passed, while the payment suite's direct-host guard rejected Docker's port mapping and three reconciliation large-batch cases timed out; see test results. No provider sandbox was run. Browser keyboard and accessibility coverage beyond the listed checks is pending. The public catalogue currently has no published product or vehicle records, so live detail and checkout flows could not be exercised.

See [bug register](BUG_REGISTER.md), [test results](TEST_RESULTS.md) and [release readiness](RELEASE_READINESS.md) for bounded findings and next gates.

24 October follow-up: the live `/parts` page search for `engine oil` updated the query URL, showed an active filter chip and a relevant empty state; no product exists in the public catalogue to validate product detail or stock behavior. The live guidance still said “before purchase” and described a cart although the public release is in browse/enquiries mode. The release worktree now uses mode-aware page guidance and neutral fitment-filter copy. A local enquiry-mode render returned 200 and a browser snapshot confirmed the changed page text and an opening filter dialog. The local API was absent, so product data and suggestions showed unavailable states; this does not establish catalogue API acceptance. No production deployment occurred.

Parts filter contract review: the UI sends search, category, brand, make, model, year, featured, inclusive minimum/maximum price, availability and sort through `normalizeProductQuery` to `/public/catalog/products/discovery`. The strict backend schema accepts these fields; `productWhere` applies the category, exact case-insensitive brand/make/model, same-row year, featured and literal search predicates, while the discovery repository applies price/availability and cursor pagination. This supports the visible controls at source level. With zero public product records and no local API in this pass, result correctness for actual inventory remains unverified.
