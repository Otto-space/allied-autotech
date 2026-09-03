-- PostgreSQL requires newly-added enum values to be committed before application
-- code or later migrations can safely use them. Keep this migration enum-only.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'READ';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INVITATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INVITATION_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BRANCH_ASSIGNED';

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'BRANCH';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'PRIVILEGED_INVITATION';
