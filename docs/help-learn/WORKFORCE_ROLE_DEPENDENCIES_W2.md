# Revision 4 W2: account-role dependency reconciliation

W1 checkpoint: `72a8aeaf`. W2 keeps the established owner-only Admin-to-Staff
demotion and existing invitation/recipient-acceptance promotion flow. It introduces
no new promotion authority, workforce position, responsibility or financial grant.

## Implemented behaviour

`PATCH /admin/staff/:staffUserId/role` still checks the current owner, protected
target, account revision, active destination branch and session/MFA security.
For an enrolled workforce account it additionally requires the exact reviewed
`expectedWorkforceVersion` and a reason. A changed/missing workforce review returns
409; an omitted reason on an enrolled target returns 422. Neither case partially
changes the account. Unsupported promotion/self/owner modifications remain forbidden.

The frontend reads the current permitted workforce account before presenting a
role review. It shows the reason, how many management delegation entries/branches
will be removed, and the active operational assignments retained. It submits the
account and workforce revisions only after the existing confirmation safeguard.
A failed dependency read prevents the review and offers recovery. Status and branch
requests retain their existing payload contract.

The existing organization/account locks protect one transaction containing the role,
branch, delegation removal, workforce revision increment, invitation/session
revocation and attributable audit event. Delegation cannot remain dormant and
reactivate after later promotion. Accepted secure invitations also remove any old
role-dependent delegation before granting the Admin tier, without recreating duties.

Existing operational assignments and independent financial grants remain intact:
those are individually authorised for Staff as well as Admin, and keep their
existing scope and independent-approval rules. No case, booking, message or audit
history is deleted or automatically reassigned. Role changes preserve the existing
security requirement to sign in again; assignment-only current-session continuity
is a separate foundation requirement, not demonstrated by these demotion tests.

Compatibility: the new fields are additive in the schema and generated contracts.
An un-enrolled legacy target still accepts the old reviewed-account payload, with a
clearly identified default legacy role-change audit reason. Enrolled targets fail
closed until the client has reviewed their current workforce revision and reason.
This intentionally prevents an older cached client from silently removing delegation
it did not review. The new management UI always records the operator's reason.

## Verification and limits

- The same explicitly created isolated W1 `_ci` target was identity-checked again;
  `db:check` passed. No schema change or application/shared database write.
- All 37 integration tests passed in five files, including six new real HTTP/DB
  tests: atomic removal with duty/financial/history preservation, stale workforce
  versus unchanged account revision, missing reason/version, concurrent owner
  updates (200/409), owner/self/promotion restrictions, and dormant delegation
  removal through actual encrypted invitation-token acceptance. Fixture invitation
  writes queue only isolated example.test outbox events; no delivery worker or real
  customer communication was invoked.
- Four new DOM/component tests cover reason validation, failed dependency reads,
  the impact review and exact combined revision payload, plus unchanged status
  requests. The backend's audit column is `userId`; an initial test assertion used
  the event input name `actorUserId` and was corrected without an application change.
- Full frontend suite: 1,053 tests passed in 161 files. Optimized build and standalone postbuild passed.
  Backend types/lint, 365-path OpenAPI, 425-operation route parity and generated
  frontend API types were checked. No database migration or Prisma-client regeneration required.
- The existing owner-demotion browser specification now includes reason and
  workforce revision expectations. It has **not** been rerun for W2. Automatic
  approval review rejected starting the compiled preview with "blocked by policy";
  no alternative startup was used. W1's development-preview browser acceptance
  does not prove W2's new controls render correctly. Hosted real-role, physical and
  full screen-reader acceptance also remain open.

## Remaining full-goal work

W2 does not complete effective-access provenance, immutable/versioned template
evolution, the shared navigation/action registry, role-specific restrictions,
assignment revocation and support/subscription continuity, or complete workforce
learning coverage. Actual conversational AI, the complete website/dashboard matrix,
reviewed persisted Customer Care handoff, gated human chat and at least 100 reviewed
AI evaluations remain required. Nothing in W1/W2 authorises production publication.

Postflight: C: 28.04 GiB free (20 GiB reserve checked). No Docker build or
cleanup in W1/W2: existing 71 images/12.17 GB, 13 stopped containers, 14 volumes
and 7.66 GB useful cache retained. No duplicate dependency install/worktree/profile.
The useful current compiled output and isolated CI data are retained for follow-up
verification. The owned development preview is stopped; shared native PostgreSQL
is preserved. Reasons accept normal textarea line breaks while rejecting other
control characters; the final 37-case integration rerun includes both behaviours.
