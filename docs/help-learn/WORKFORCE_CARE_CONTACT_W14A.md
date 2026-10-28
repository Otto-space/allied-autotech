# W14A: branch-specific Customer Care contact boundary

Local branch `fix/workforce-care-contact-scope-20261027`, based on W13 `a17cdb3b`.
This prerequisite fixes a verified existing boundary before granular Care duties.
It does not complete reviewed handoff, live transport or all-route learning.

## Reproduction and correction

Synthetic Staff and enrolled Admin accounts with Care responsibility in branch A
and assigned Sales access in branch B could read legitimate branch-B cases, but
the global permission check also included structured customer contact there.
Three initial native failures and two frontend parser failures reproduced this.
The contact projection now requires Care on the actual case branch; Sales access
to the case and public conversation is retained. Raw contact/account fields are
always removed. Existing complaint projection and former-customer fallback remain.

Two further native cases held the enquiry row lock until Care naturally expired.
The original snapshot incorrectly returned contact or the now-inaccessible case.
Detail reads now check initial scope before locking, refresh scope after the lock
wait, and recheck before the final projection. Collection reads refresh scope after
query/audit work and reject a page whose records are no longer visible, rather than
returning a misleading partial page/cursor. Explicit access changes remain under
the existing workforce and actor locks. This is bounded read-time authorisation;
it does not promise retroactive removal of a response already delivered.

The frontend independently rejects a supplied contact object without matching
current branch Care authority. An invalid list/detail response fails closed and
does not put the supplied identity into the DOM. No new grant, template or role.

## Verification

- Six focused native HTTP/restricted-CI-DB cases passed: Staff/Admin mixed branches,
  same-branch expiry, both lock-wait expiry outcomes and complaint regression.
- Thirteen enquiry parser units passed, including both initially failing cases.
- Eight rendered fixtures passed at 390/1440: permitted/redacted contact and injected
  foreign list/detail contact. Existing reply editor remains usable. Axe, overflow,
  no writes, no external requests and console assertions passed. The narrowly
  verified existing Next not-found CSS preload warning remains annotated separately.
- Backend source typecheck and changed frontend lint passed. One cached optimized
  frontend build passed; reused Next 16.3.8 differs from lock 16.4.3, so exact-lock
  CI/hosted acceptance remains open. Native and browser evidence are separate;
  browser responses used isolated fixtures, not a full browser-to-DB composition.
- Screens inspected: `%TEMP%/allied-care-contact-scoped-390.png` and `1440.png`.
  Synthetic fixture content only. Native logs: the retained isolated W7 CI evidence
  directory, `w14-contact-integration.log`; no operational data was changed.

No schema change, provider call, real message, publication, dependency install or
new worktree. Production prevalence was not inspected; this is a locally verified
defect, not a claim that production customer data was observed. W9's paid allowance
remains exhausted. Granular view/reply/assign/live authority, persisted handoff and
staffed shared transport are subsequent work; availability must never grant access.
