### 1 November 2026: rollout-compatible Privacy guidance ready for publication

The new destination initially would have broken older open tabs that validate the
entire catalogue against the prior destination list. Before publication, added the
bounded destinationsVersion=2 request; absent/1 callers retain the previous list.
Version selection cannot grant private content. Internal Allie retrieval uses the
current reviewed source and source-set invalidation. Updated OpenAPI and client types.
The earlier d31918bb candidate is READY but remains unpublished; production is still
6de6c86f. Exact-master checks and hosted/live acceptance must pass for this correction.

Passed 82 distinct focused backend unit cases, 38 frontend cases, types/scoped lint,
OpenAPI validation (410 paths) and 390/1440 local privacy search/refresh/navigation.
Fresh isolated HTTP run passed all 11 cases (17.50s), 83-migration replay and schema
check. The first compatibility run expected 400 rather than the established 422
validation response; corrected the assertion, with the failed log retained. Native
servers were stopped. No schema, grant, price, feature-flag or application-data change.
Payment audit additionally passed 67 provider-independent unit cases; see
backend/docs/payment-requirement-audit-20261101.md for implementation/assertion mapping.

Remaining handoff: guarded publication and live checks, then the final activation
summary. Merchant/provider test-mode acceptance, new bounded live model evaluation,
real operational calendars/capacity and notification delivery remain external setup.
Physical-device/native zoom/full screen-reader and signed-in staff production
acceptance have not been newly established by this batch. Tyre Change stays NGN1,000.

### 1 November 2026: reviewed privacy Help guidance, locally verified

Added public privacy-and-allie v1, grounded in the published Privacy notice,
through the existing eligible Help/Allie corpus. Added /privacy to both safe
navigation lists. The guidance preserves retention, provider, backup and saved
support-message caveats; it does not promise deletion or expose staff privacy work.
Current server release mode and guide/practice flags remain part of retrieval and
history invalidation. No schema, price, permissions or production flags changed.
Tyre Change remains NGN1,000, explicitly reconfirmed by the owner.

Passed 81 backend unit checks, 34 frontend checks, types/scoped lint and two
390/1440 rendered browser fixtures using the actual generated public catalogue.
Fresh isolated aat_privacy_help_edfef254b1_test at 127.0.0.1:58983 replayed all
83 migrations, passed schema compatibility and all 11 real HTTP learning tests
(21.44s). The server stopped cleanly. Two preceding Windows launcher attempts
stalled while waiting for descendants; both temporary servers were stopped and
those failed logs retained. Neither was counted as a pass. No application or
production database was written, no paid model call or customer message sent.

Privacy search, article refresh and navigation to the actual notice passed locally
without page errors or horizontal overflow. This is local intercepted-transport
UI evidence, not hosted/live or authenticated staff acceptance. Production remains
6de6c86f until exact-master CI and guarded publication pass. Remaining full-goal
work: finish payment requirement-to-assertion audit and the final activation handoff.
