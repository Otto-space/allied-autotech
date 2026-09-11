-- Enum values are committed separately before structural constraints reference them.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'AWAITING_DEPOSIT';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'BOOKING_DEPOSIT';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'MONNIFY';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'BOOKING_SLOT';
