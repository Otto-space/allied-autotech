-- Prisma timestamp-without-time-zone values represent UTC instants. Keep the
-- existing refund authorization checks independent of the caller's session zone.
-- No authorization predicates or stored financial timestamps are changed.
ALTER FUNCTION aat_guard_system_refund() SET timezone = 'UTC';
