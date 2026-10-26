-- Expand only. Existing assignments/delegation remain pinned to their original
-- reviewed version; no account, grant, history, scope or application row is removed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "WorkforceAssignment" ADD COLUMN "templateVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "WorkforceAccess" ADD COLUMN "delegationPolicyVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "WorkforceAssignment" ADD CONSTRAINT "WorkforceAssignment_templateVersion_positive" CHECK ("templateVersion" > 0);
ALTER TABLE "WorkforceAccess" ADD CONSTRAINT "WorkforceAccess_delegationPolicyVersion_positive" CHECK ("delegationPolicyVersion" > 0);
COMMIT;
