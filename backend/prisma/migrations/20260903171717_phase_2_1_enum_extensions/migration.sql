-- PostgreSQL requires newly-added enum values to be committed before a later
-- transaction can use them in expressions such as CHECK constraints and
-- partial-index predicates. Keep these additions in their own migration.

ALTER TYPE "AuditAction" ADD VALUE 'MFA_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE 'MFA_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_INITIALIZED';
ALTER TYPE "AuditAction" ADD VALUE 'MANUAL_PAYMENT_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'REFUND_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'REFUND_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'DISPUTE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'VEHICLE_RESERVED';
ALTER TYPE "AuditAction" ADD VALUE 'VEHICLE_RELEASED';

ALTER TYPE "AuditEntityType" ADD VALUE 'MFA_FACTOR';
ALTER TYPE "AuditEntityType" ADD VALUE 'QUOTE';
ALTER TYPE "AuditEntityType" ADD VALUE 'WORK_ORDER';
ALTER TYPE "AuditEntityType" ADD VALUE 'PAYMENT_ATTEMPT';
ALTER TYPE "AuditEntityType" ADD VALUE 'REFUND';
ALTER TYPE "AuditEntityType" ADD VALUE 'DISPUTE';
ALTER TYPE "AuditEntityType" ADD VALUE 'VEHICLE';
ALTER TYPE "AuditEntityType" ADD VALUE 'VEHICLE_TRANSACTION';

ALTER TYPE "InspectionStatus" ADD VALUE 'RESCHEDULED';

ALTER TYPE "NotificationType" ADD VALUE 'QUOTATION';
ALTER TYPE "NotificationType" ADD VALUE 'WORK_ORDER';
ALTER TYPE "NotificationType" ADD VALUE 'REFUND';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE';
ALTER TYPE "NotificationType" ADD VALUE 'VEHICLE_TRANSACTION';

ALTER TYPE "ReviewTargetType" ADD VALUE 'VEHICLE_TRANSACTION';
ALTER TYPE "VehicleListingStatus" ADD VALUE 'INACTIVE';
