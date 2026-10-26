# Revision 4 implementation checkpoint

Canonical brief: [Revision 4](REVISION_4_BRIEF.md), read completely on 26 October 2026.
It supersedes the earlier optional-AI completion criterion. The active goal includes
the entire brief, not just the first batch. The owner subsequently authorised deployment of committed W1?W3 batches; unfinished work is not published.

Source: feat/workforce-allie-r4-20261026, reusing the clean release worktree and
verified dependencies at 9b1728fe; live runtime 3ccee21a was checked in the preceding
release. Other worktrees and their uncommitted work remain preserved.

| Dependency / requirements | Current status | Evidence / remaining gate |
| --- | --- | --- |
| Reconcile supplied workforce definitions, account tier, position and independent grants | Source inspected | Existing WorkforceAccess/WorkforceAssignment, controlled eight-template catalogue plus CEO position; no automatic staffing or grants |
| W1 scoped management directory | Implemented; bounded isolated checks passed | GET /admin/workforce/accounts, bounded scoped rows and responsibility summaries; existing editor reused; role/position/status/search filters |
| Effective access, provenance, scope, immutable template evolution, atomic promotion/demotion, active sessions and subscriptions | Incomplete | Existing transactional scope and 30-second UI revalidation are foundations; complete Revision 4 negative and transition acceptance is still required |
| W2 role/delegation dependencies | Released; hosted fixture acceptance passed; actual-role mutations open | Atomic delegation removal and reason/revisions; no dormant authority on invitation acceptance; WORKFORCE_ROLE_DEPENDENCIES_W2.md |
| W3 pinned template/delegation versions and canonical fitment/recipient eligibility | Released at migration 72; hosted fixture acceptance passed; actual-role mutations open | Forward migration 72, fresh replay/schema check, populated reduced fixture; WORKFORCE_TEMPLATE_VERSIONS_W3.md |
| Complete website/dashboard matrix | Baseline recorded; incomplete | REVISION_4_COVERAGE.json overlays the maintained source inventory; entries remain pending until exact role/state evidence exists |
| Canonical conversational retrieval and actual AI provider | Not implemented | Current Allie is reviewed search only, not completed conversational AI; provider/model/quotas/data-flow/evaluation work remains required |
| All-dashboard reviewed topics, guides and isolated practice | Incomplete | Preserve current working content; extend and verify per-page decisions and actual task states |
| Reviewed persisted human handoff | Not implemented | Must reuse canonical Customer Care records and customer/operator pages; model cannot send a message |
| Gated live transport, availability, takeover and replay | Not implemented | Staffing, separate support schedule and hosting readiness unverified; do not promise live service |
| At least 100 reviewed AI evaluation cases and critical security checks | Not implemented | Provider mocks alone will not establish actual answer quality or live-provider acceptance |

Run from backend:

- npm run learning:coverage:check: structural integrity only; reports open coverage.
- npm run learning:coverage:complete: completion gate; must fail while gaps remain.

W1 uses the existing schema and grants. It does not migrate accounts, grant duties,
change a person's tier/position, enroll legacy accounts or send invitations. The
owner baseline and the explicit legacy-enrollment compatibility boundary remain.
Delegated discovery requires current management authority and is limited to Staff
in the owner-approved branch envelope; responsibility summaries exclude definitions
outside the operator's delegation. Active expiry/revocation and invalid scopes grant
nothing. The directory exposes no customer profiles or security credentials.

W1 evidence: [directory implementation and checks](WORKFORCE_DIRECTORY_W1.md).

W2 evidence: [role dependency implementation and checks](WORKFORCE_ROLE_DEPENDENCIES_W2.md).

W3 evidence: [versioned definitions, scope fix and compatibility](WORKFORCE_TEMPLATE_VERSIONS_W3.md).

Next: complete effective-access provenance,
versioned template semantics, role-change dependencies and live-session continuity
before basing AI eligibility or human-chat assignment on that foundation.

Production checkpoint: runtime c4e0005d, backend 707a200f-17c3-4947-a0bd-21b39496cf6a, frontend dpl_GRVrwacMhYkrqktFvGRChY5LB2Ln; both custom domains verified. Full evidence, qualifications and compatible recovery: backend/docs/workforce-versions-production-20261026.md. The full Revision 4 goal remains incomplete.
