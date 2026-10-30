# Concern intake: reviewed additive expansion

Migration: 20261030190000_booking_concern_intake. Adds nullable customerConcern,
allows serviceId to be null, and requires a meaningful concern when serviceId is
null. Existing bookings retain their service, prices, status, timestamps and foreign
keys. No UPDATE, DELETE, table replacement, backfill or data removal is performed.
The constraint accepts all existing non-null service IDs. The safe migration gate
matches the exact reviewed SQL hash; changed or renamed SQL remains blocked.

Verification must include fresh isolated replay, db:check, existing booking flows,
concern idempotency/ownership, preserved existing records and classification before
capacity confirmation. This is not a production migration approval or proof of an
off-device restore. Shared rollout still requires the normal target/history check,
fresh verified backup, off-device recovery evidence and npm run db:migrate.

Release order: ship nullable-safe customer/staff readers before exposing concern
intake; apply the reviewed migration through the protected runner, then deploy the
backend and intake UI as a coordinated release. Keep feature gates unchanged.
Rollback must preserve concern records: disable new intake and forward-fix any
problem. Do not set serviceId NOT NULL, delete concerns or create dummy services to
roll back. An old reader that assumes every service exists is not compatible once
concerns have been created. Retain the compatible reader release for recovery.
