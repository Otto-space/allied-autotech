# Public search, dashboard focus and responsive images - 2 November 2026

Package started 14:16 UTC. Source baseline e561c842; public runtime 2c6f58d0,
frontend dpl_2tmoL1nPgoL4R8pxQ6g5boYiaBzf and ACTIVE backend
9e7d8b5c-82a1-4660-be23-4fca2a9b6828 were rechecked before implementation.
The preceding goal turn was progress: that public-content batch was released.
The full objective is retained in the quality register; this is a further batch.

The public header now exposes Search on phones and desktops. The /search page
uses a labelled native GET form, selects Services/Shop/Vehicles, validates their
existing query rules and opens the selected catalogue. It preserves literal
phrases, supports server/no-JavaScript submission and offers correction for invalid
queries. Destinations are a fixed public allowlist, never a supplied URL. Search
does not create inventory, establish fitment or imply availability. Existing
catalogue filters and result semantics remain authoritative. Home guidance v3 and
its unit/isolated HTTP expectations are updated together; no eligibility, guide
target, permission or activation flag is changed.

The shared dashboard-search wrapper now has a clear branded red focus indicator,
including sidebar collapse. The header, image and search changes were reviewed
with the React best-practices checklist: server-first form, no new request waterfall,
shared primitives, bounded input, real labels/focus and isolated failure state.

Static approved workshop photographs now use the existing Next image pipeline;
managed publication-checked media retain their native responsive stream, preserving
unpublication behavior. Original asset files and service identities are unchanged.
At 390x844/DPR1, fresh Edge contexts measured the same four catalogue photographs:
current public native images total 463,904 bytes; new local and held-production responsive requests both total 53,022 bytes
(384px WebP sources), with the same 352px-wide rendered frames. This is about
88.6% less image payload in that explicit profile. It does not establish page-speed,
LCP/CLS, field or physical-device performance. Hosted confirmation passed.

Initial rendered pass: 22 passed, one test locator failure because Next's route
announcer also has role=alert. The locator now scopes to main; invalid-input recovery
and an additional 320x667 pointer-submit case pass (two focused cases). All 24 distinct
local cases therefore have passing coverage. All four dashboard roles are synthetic
intercepted sessions; no actual account or grant changed. Six focused frontend
units, six learning units, scoped lint, types and formatting pass. Full exact-source
CI and hosted/public acceptance have now passed as recorded below. The original
failed run remains in its report.

Evidence directory: C:/Users/PC/AppData/Local/Temp/site-completion-20261102.
search-local.json preserves the initial 22/1 result; search-local-recovery.json
contains corrected recovery/short-phone results. responsive-image-bytes.json
contains the explicit profile, resources and response byte counts. No real enquiry,
booking, order, payment or browser-notification permission was submitted.

## Genuine operator content follow-up

An anonymous current public read found one product and one vehicle listing.
Engine Oil Filter, public product 89fd9258-c580-43e9-9040-c7e52623e82d, has no brand,
manufacturer part number, description, product photograph or classification, and
no compatibility entries. The published record does contain its price, NEW
condition, OIL_FILTER type and branch in-stock indicator; those are not guessed
missing. The operator must supply verified product identity/photos and supporting
fitment evidence before making stronger product/compatibility claims. No stock,
quantity, authenticity or suitability was invented. The published BMW listing and
its known-fault information are untouched. Safe records remain separate from
real-authoring acceptance.

The full goal remains active: notification invitation, appointment/calendar/countdown,
records/table/authoring improvements, wider wording review and unsampled role/device/
provider acceptance retain their individual ledger status. No new business-policy
decision is needed for this batch; existing financial/operational activation remains
gated. The complete supplied objective and repository records define ongoing explicit
scope; no additional attachment is required from the owner to continue.

## Publication and actual checks

Signed runtime source `27bf3559bd0f2cc494e3cd1af2d6079f05d0839e` is published as
frontend `dpl_EDdQ6vkaD7AF6M9qkQnppBmdiBPE`. Both apex and www identify that
artifact; www redirects to apex. Backend `a047b0c2-8d70-4281-b8a8-5e428a50008d`
is ACTIVE, 16/16, all four manifest digests match and readiness returns 200.
Anonymous learning-article read returns home-next-step v3 with Search guidance.

| Evidence                                             | Actual result                                                                                                                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact-source frontend CI 41465551617                 | Passed: 1,328 unit tests; 12 pre-existing fixture-gated skips; production build, types, lint, formatting and audit pass                                                                             |
| Backend safety CI 41465551589; secret CI 41465551925 | Both passed on the exact runtime source                                                                                                                                                             |
| Packaged checks                                      | 10 passed, including fresh isolated replay and separate restore                                                                                                                                     |
| Held production frontend                             | 44 passed, zero skipped/flaky/unexpected: 15 search/focus, 9 service presentation, 20 full hero regressions                                                                                         |
| Actual apex routes after promotion                   | 24 passed, zero skipped/flaky/unexpected: search/focus and service presentation                                                                                                                     |
| Actual www Search                                    | 390px and 1440px both 200 after expected apex redirect, no horizontal overflow                                                                                                                      |
| Backend safety                                       | Fresh verified backup; managed backups/PITR evidence; unchanged-schema same-day populated restore revalidated; pre/post schema 87, strict TLS, runtime least privilege and eight fresh workers pass |

The 20 hero cases include three real-time loops, continued desktop hover, explicit
manual/focus pause and Play, keyboard/touch, offscreen and simulated visibility,
slow/stalled/failed/all-failed images, no JavaScript and eight responsive widths.
They ran on this exact artifact before promotion; another full timed run was not
necessary after only domain assignment changed. Physical background-tab behavior
and real devices are not inferred from simulated browser state.

A first registry login attempt failed. Registry state was inspected before a
scoped retry, which pushed all four verified images. No deployment was blindly
retried. Only four image digests changed in the backend proposal; the predeploy
command remained read-only. No new migration, business-row edit, price/quantity/
version change, grant or feature-flag change. Temporary database trusted-source
access was removed and independently verified; concurrent rules were preserved.
Local dependencies were reused (Next 16.3.8); CI/hosted production used Next 16.4.3.

Evidence remains in the stated Temp directory: `search-hosted.json`,
`search-public.json`, `search-www-smoke.json`, `search-aliases-before.json`,
`search-aliases-after.json` and `responsive-image-bytes-hosted.json`. Protected
backend image/backup/health/release receipts remain outside version control.

## Safe screenshots and limits

Anonymous before: `public-after-catalogue-390.png` and
`public-after-catalogue-1440.png` show the preceding runtime header without Search.
Anonymous after: `public-after-search-390.png` and
`public-after-search-1440.png` show the released Search entry, form and focus.
All four are under `C:/Users/PC/AppData/Local/Temp/site-completion-20261102`.
Search screenshots were visually inspected at both widths. Settled same-route
after captures `public-after-search-header-390.png` and
`public-after-search-header-1440.png` also show the catalogue header with Search;
the mobile capture was inspected after service groups and fonts finished loading. The published service
frames retain the approved workshop imagery and previous before/after evidence.

The four dashboard screenshots in `search-public` use synthetic intercepted roles
and records; the Admin capture was visually inspected for branded focus, readable
results and unchanged layout. They establish rendered shared-component behavior,
not actual-account authorization or authoring acceptance. No customer, vehicle,
stock, price, payment or booking was modified for tests; no browser permission
was requested. Safari, native phones and full screen-reader journeys are untested.

Public search and service presentation are released and verified within the
reported browser coverage. Shared focus is released with synthetic-role acceptance.
Other goal requirements and financial/operational activation retain their separate
status; this is not a claim of whole-site launch readiness. C: reserve passed
before builds and after publication; current/rollback resources and warm caches
were retained.
