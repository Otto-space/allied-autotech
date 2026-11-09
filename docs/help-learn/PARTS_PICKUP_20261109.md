# Private parts pickup and collection calendar ? 9 November 2026

Scope: authenticated customer/private guest issuance and revoke, current verified
Staff actual branch/Admin review, partial physical handover, explicit safe review
resolution, exact remaining quantities and immutable history. No real order, money,
provider, policy publisher, workforce grant or production database was changed.

Migrations 108 and 109 are forward additions. They were replayed in a new isolated
loopback tmpfs test DB; schema diff, db:check and restricted runtime checks passed.
Native 67/67 tests in four suites passed, including the full pre-payment review to
synthetic provider capture, allocation, ready and private pickup journey. First
exclusive-review run: 66 passed, one test failed because a synchronous schema error
was incorrectly asserted as a rejected promise. Corrected that assertion, keeping
the false acknowledgement rejected. Owned test containers were verified and removed.
Receipt: TEMP/aat-d03-service-payments-20261109/native-exclusive-pickup-reviewed.log.

The code has 256 random bits and an order/purpose-bound HMAC. Raw codes stay in
request/response memory, never a URL or persisted browser store, and are log-redacted.
Issuance replay cannot display a secret twice. The 24-hour token lifetime is an
engineering security choice, separate from the owner-approved five-day business
hold. New code revokes an unused prior code; an active physical review blocks
replacement/revocation. Code security expiry never frees goods or takes money.

Verification creates one exclusive durable claim bound to actual Staff session and
selected quantities. It does not record collection. Competing sessions cannot claim
or commit that same authorisation. There is no automatic lease takeover after an
ambiguous physical handover. The current reviewer/current verified Admin can resolve
only with reason and explicit goods-not-handed-over confirmation, revoking the code.
Actual handover rechecks current authority, version, settled receipts, financial
holds and exact goods, then consumes claim/code and appends an immutable event in
one transaction. Final completion requires the last quantities; no second stock
consumption or charge. Database tests do not prove real physical acceptance.

Customer/guest/staff UI advertises only when actual backend pickupCapabilityVersion
is present. Controls show remaining goods, review before mutation, explicit physical
fact and history. Uncertain outcomes block blind retries; refresh/reopen and review
saved state. Session/access changes discard secrets and mutation proposals. Staff
notes do not request ID numbers/copies. Browser/source verification remains distinct.

Server-only learning: parts-collection v1 (verified customer), staff-parts-collection
v1 (verified work audience). Eligibility and exact Allie retrieval pass; destinations
are existing owned orders/staff orders. Guides never grant operational authority.
Existing global learning/AI/practice/publication flags stay unchanged.

Owner's latest calendar answer: five days, Monday-Saturday, public holidays count,
exclude the anchor day after both actual readiness and successful notification;
imported/custom parts use the same rule. The date-only engine has no payment or
stock side effects. Pending notification yields no deadline. D12 durable evidence,
reasoned extensions, customer/staff rendering and failed-notification acceptance
still require implementation. Older unresolved calendar notes are superseded.

Verification checkpoint: 10 calendar tests and one audience eligibility test pass;
28/28 combined calendar/eligibility/retrieval/sourcing tests pass. Three pickup UI
unit cases pass after fixing receipt comparison to normalise actual item IDs and
quantities, independent of JSON key order and extra display names. New hosted pickup
browser tests are source only until an actual hosted run passes. D14 real role/
physical acceptance and exact combined release gates remain open.

Prior source cf558f32 hosted frontend 42696301898: sourcing recovery/media/calendar
stages passed; full matrix 304 passed, five CSS-preload verifier failures, 484 not
run. No full-matrix pass is claimed. The shared footer preload now requires exact
same-origin CSS, every selector constrained to the known footer/fitment-summary chunk and actual
104px bottom clearance where a footer is rendered. Unknown warnings/errors still fail. No production change.
