-- PostgreSQL requires a newly added enum value to be committed before a later
-- migration can reference it in constraints, indexes, triggers, or data.
ALTER TYPE "ReviewTargetType" ADD VALUE IF NOT EXISTS 'PRODUCT';
