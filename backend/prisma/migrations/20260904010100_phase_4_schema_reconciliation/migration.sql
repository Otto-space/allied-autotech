-- Reconcile the Phase 3 hand-written UUID default with Prisma's client-side
-- uuid() default representation. Existing identifiers remain unchanged.
ALTER TABLE "PrivilegedInvitation" ALTER COLUMN "id" DROP DEFAULT;
